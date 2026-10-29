'use strict';
// Takvim görünümü (gün / hafta / ay) ve ders pencereleri.

const SAAT_PX = 64;
const Takvim = {
  gorunum: matchMedia('(max-width: 760px)').matches ? 'gun' : 'hafta',
  tarih: bugun(),
  ogretmen: 'ekip', ogrenci: '', kategori: '', durum: '',
  renk: 'kategori',
  kaydirma: null,
};

function dersFiltrele(u, f) {
  const yetkili = yetkiliOgretmenIdleri(u);
  return DB.list('dersler').filter(d => {
    if (f.ogretmen === 'ekip' && !yetkili.includes(d.ogretmenId)) return false;
    if (f.ogretmen && f.ogretmen !== 'ekip' && f.ogretmen !== 'tumu' && d.ogretmenId !== f.ogretmen) return false;
    if (f.ogrenci && !(d.ogrenciIdleri || []).includes(f.ogrenci)) return false;
    if (f.kategori && d.kategoriId !== f.kategori) return false;
    if (f.durum === 'bekliyor') { if (d.onay !== 'bekliyor') return false; }
    else if (f.durum === 'geciken') { if (!dersGecikmis(d)) return false; }
    else if (f.durum && d.durum !== f.durum) return false;
    return true;
  });
}

function ogretmenFiltreSecenekleri(u, secili) {
  const ogretmenler = DB.list('ogretmenler').slice().sort((a, b) => trSirala(a.ad, b.ad));
  return `<option value="ekip" ${secili === 'ekip' ? 'selected' : ''}>${yoneticiMi(u) ? 'Tüm öğretmenler' : (ekipIdleri(u).length ? 'Ben ve ekibim' : 'Benim derslerim')}</option>
    ${yoneticiMi(u) ? '' : `<option value="tumu" ${secili === 'tumu' ? 'selected' : ''}>Tüm öğretmenler (görüntüle)</option>`}
    <optgroup label="Öğretmen">${secenekler(ogretmenler, secili)}</optgroup>`;
}

function filtreCubugu(u, f, { durumlar = true } = {}) {
  const ogrenciler = DB.list('ogrenciler').slice().sort((a, b) => trSirala(a.ad, b.ad));
  const kategoriler = DB.list('kategoriler').slice().sort((a, b) => trSirala(a.ad, b.ad));
  return `
    <label class="filtre"><span>Öğretmen</span><select data-filtre="ogretmen">${ogretmenFiltreSecenekleri(u, f.ogretmen)}</select></label>
    <label class="filtre"><span>Öğrenci</span><select data-filtre="ogrenci">${secenekler(ogrenciler, f.ogrenci, { bos: 'Tümü' })}</select></label>
    <label class="filtre"><span>Kategori</span><select data-filtre="kategori">${secenekler(kategoriler, f.kategori, { bos: 'Tümü' })}</select></label>
    ${durumlar ? `<label class="filtre"><span>Durum</span><select data-filtre="durum">
      <option value="">Tümü</option>
      ${Object.entries(DURUMLAR).map(([k, v]) => `<option value="${k}" ${f.durum === k ? 'selected' : ''}>${v.ad}</option>`).join('')}
      <option value="bekliyor" ${f.durum === 'bekliyor' ? 'selected' : ''}>Onay bekleyen</option>
      <option value="geciken" ${f.durum === 'geciken' ? 'selected' : ''}>Durumu girilmemiş</option>
    </select></label>` : ''}`;
}

function dersRengi(d) {
  const renk = Takvim.renk === 'ogretmen' ? DB.get('ogretmenler', d.ogretmenId)?.renk : kategoriBul(d.kategoriId)?.renk;
  return renk || '#64748b';
}

// Çakışan dersleri yan yana dizmek için şerit hesabı.
function yerlesim(dersler) {
  const ogeler = dersler.map(d => ({ d, s: dk(d.baslangic), e: dersBitis(d) })).sort((a, b) => a.s - b.s || b.e - a.e);
  const sonuc = [];
  let kume = [], kumeSonu = -1;
  const bosalt = () => {
    const seritler = [];
    kume.forEach(it => {
      let l = seritler.findIndex(son => son <= it.s);
      if (l < 0) { l = seritler.length; seritler.push(0); }
      seritler[l] = it.e;
      it.serit = l;
    });
    kume.forEach(it => { it.seritSayisi = seritler.length; });
    sonuc.push(...kume);
    kume = [];
    kumeSonu = -1;
  };
  ogeler.forEach(it => {
    if (kume.length && it.s >= kumeSonu) bosalt();
    kume.push(it);
    kumeSonu = Math.max(kumeSonu, it.e);
  });
  if (kume.length) bosalt();
  return sonuc;
}

function takvimView(el, u) {
  const ay = DB.ayarlar();
  const T = Takvim;
  const t = parseYmd(T.tarih);
  let baslik, gunler = [];
  if (T.gorunum === 'ay') {
    baslik = `${TR_AY[t.getMonth()]} ${t.getFullYear()}`;
  } else if (T.gorunum === 'gun') {
    gunler = [t];
    baslik = tarihYaz(T.tarih, true);
  } else {
    const b = haftaBasi(t, ay.haftaBasi);
    gunler = [...Array(7)].map((_, i) => addDays(b, i));
    const s = gunler[6];
    baslik = b.getMonth() === s.getMonth()
      ? `${b.getDate()} – ${s.getDate()} ${TR_AY[s.getMonth()]} ${s.getFullYear()}`
      : `${b.getDate()} ${TR_AY[b.getMonth()]} – ${s.getDate()} ${TR_AY[s.getMonth()]} ${s.getFullYear()}`;
  }
  const dersler = dersFiltrele(u, T);
  const yetkili = yetkiliOgretmenIdleri(u);
  const geciken = DB.list('dersler').filter(d => yetkili.includes(d.ogretmenId) && dersGecikmis(d)).length;

  el.innerHTML = `
    <div class="sayfa-ust">
      <div class="takvim-nav">
        <button class="btn ikon" data-act="onceki" aria-label="Önceki">‹</button>
        <button class="btn" data-act="bugun">Bugün</button>
        <button class="btn ikon" data-act="sonraki" aria-label="Sonraki">›</button>
        <h1>${esc(baslik)}</h1>
      </div>
      <div class="sag">
        <div class="segment" role="group" aria-label="Görünüm">
          ${[['gun', 'Gün'], ['hafta', 'Hafta'], ['ay', 'Ay']].map(([k, a]) => `<button class="${T.gorunum === k ? 'aktif' : ''}" data-gorunum="${k}">${a}</button>`).join('')}
        </div>
        <button class="btn birincil" data-act="yeni">+ Yeni ders</button>
      </div>
    </div>
    <details class="filtre-kap" ${T.ogretmen !== 'ekip' || T.ogrenci || T.kategori || T.durum ? 'open' : ''}>
      <summary>Filtreler</summary>
      <div class="filtreler">
        ${filtreCubugu(u, T)}
        <label class="filtre"><span>Renk</span><select data-filtre="renk">
          <option value="kategori" ${T.renk === 'kategori' ? 'selected' : ''}>Kategoriye göre</option>
          <option value="ogretmen" ${T.renk === 'ogretmen' ? 'selected' : ''}>Öğretmene göre</option>
        </select></label>
      </div>
    </details>
    ${geciken ? `<div class="kutu uyari satir"><span>⚠️ Zamanı geçmiş <b>${geciken}</b> dersin durumu henüz girilmedi.</span> <button class="link" data-act="geciken">Listele</button></div>` : ''}
    <div id="takvim-alani">${T.gorunum === 'ay' ? ayHtml(t, dersler, ay) : izgaraHtml(gunler, dersler, ay)}</div>
    <div class="lejant">
      ${Object.entries(DURUMLAR).map(([k, v]) => `<span class="rozet-d s-${k}">${v.ikon} ${v.ad}</span>`).join('')}
      <span class="rozet-d s-bekliyor">⏳ Onay bekliyor</span>
    </div>`;

  const kap = $('.izgara-kap', el);
  if (kap) {
    if (T.kaydirma != null) kap.scrollTop = T.kaydirma;
    else {
      const ilk = $('.ders-blok', kap);
      const simdi = $('.simdi-cizgi', kap);
      const hedef = simdi || ilk;
      if (hedef) kap.scrollTop = Math.max(0, hedef.offsetTop - SAAT_PX);
    }
    kap.addEventListener('scroll', () => { T.kaydirma = kap.scrollTop; }, { passive: true });
  }

  el.onclick = e => {
    const h = e.target.closest('[data-act],[data-gorunum],[data-gun],[data-ders]');
    if (h?.dataset.ders) return dersDetay(h.dataset.ders);
    if (h?.dataset.gun) { T.tarih = h.dataset.gun; T.gorunum = 'gun'; return render(); }
    if (h?.dataset.gorunum) { T.gorunum = h.dataset.gorunum; T.kaydirma = null; return render(); }
    const act = h?.dataset.act;
    if (act === 'onceki' || act === 'sonraki') {
      const yon = act === 'onceki' ? -1 : 1;
      const d = parseYmd(T.tarih);
      T.tarih = T.gorunum === 'ay' ? ymd(new Date(d.getFullYear(), d.getMonth() + yon, 1))
        : ymd(addDays(d, yon * (T.gorunum === 'gun' ? 1 : 7)));
      return render();
    }
    if (act === 'bugun') { T.tarih = bugun(); T.kaydirma = null; return render(); }
    if (act === 'yeni') return dersFormu(null, { tarih: T.tarih });
    if (act === 'geciken') { Object.assign(DersListe, { durum: 'geciken', ogretmen: 'ekip' }); location.hash = '#/dersler'; return; }

    const sutun = e.target.closest('.gun-sut');
    if (sutun && e.target === sutun) {
      const bas = Number($('.iz-govde', el).dataset.bas);
      const dakika = bas + Math.floor((e.offsetY / SAAT_PX) * 60 / 30) * 30;
      return dersFormu(null, { tarih: sutun.dataset.tarih, baslangic: saat(Math.min(dakika, 23 * 60 + 30)) });
    }
    const hucre = e.target.closest('.ay-hucre');
    if (hucre && (e.target === hucre || e.target.classList.contains('ay-bosluk'))) {
      return dersFormu(null, { tarih: hucre.dataset.tarih });
    }
  };
  el.onchange = e => {
    const f = e.target.dataset.filtre;
    if (f) { T[f] = e.target.value; render(); }
  };
}

function izgaraHtml(gunler, dersler, ay) {
  const gunStr = gunler.map(ymd);
  const gunDersleri = gunStr.map(s => dersler.filter(d => d.tarih === s));
  let bas = ay.gunBasi * 60, son = ay.gunSonu * 60;
  gunDersleri.flat().forEach(d => {
    bas = Math.min(bas, Math.floor(dk(d.baslangic) / 60) * 60);
    son = Math.max(son, Math.ceil(dersBitis(d) / 60) * 60);
  });
  son = Math.min(Math.max(son, bas + 60), 24 * 60);
  const saatler = [];
  for (let m = bas; m < son; m += 60) saatler.push(m / 60);
  const bugunS = bugun();
  const simdi = simdiDk();

  return `<div class="izgara-kap"><div class="izgara" style="--sutun:${gunler.length}">
    <div class="iz-bas"><div class="kose"></div>${gunler.map((g, i) => `
      <button class="gun-bas ${gunStr[i] === bugunS ? 'bugun' : ''}" data-gun="${gunStr[i]}">
        <span>${TR_GUN_KISA[g.getDay()]}</span><b>${g.getDate()}</b>${gunDersleri[i].length ? `<small>${gunDersleri[i].length} ders</small>` : ''}
      </button>`).join('')}</div>
    <div class="iz-govde" data-bas="${bas}" style="height:${(son - bas) / 60 * SAAT_PX}px;--saat:${SAAT_PX}px">
      <div class="saat-sut">${saatler.map((h, i) => `<div style="top:${i * SAAT_PX}px">${pad(h)}:00</div>`).join('')}</div>
      ${gunStr.map((s, i) => `<div class="gun-sut ${s === bugunS ? 'bugun' : ''}" data-tarih="${s}" title="Boş alana tıklayarak ders ekleyin">
        ${yerlesim(gunDersleri[i]).map(it => dersBlok(it, bas)).join('')}
        ${s === bugunS && simdi >= bas && simdi <= son ? `<div class="simdi-cizgi" style="top:${(simdi - bas) / 60 * SAAT_PX}px"></div>` : ''}
      </div>`).join('')}
    </div>
  </div></div>`;
}

function dersBlok(it, bas) {
  const d = it.d;
  const kat = kategoriBul(d.kategoriId);
  const ust = (it.s - bas) / 60 * SAAT_PX;
  const yuk = Math.max((it.e - it.s) / 60 * SAAT_PX - 2, 22);
  const gen = 100 / it.seritSayisi;
  const bekliyor = d.onay === 'bekliyor';
  const ikon = bekliyor ? '⏳' : DURUMLAR[d.durum].ikon;
  const ogrenciler = ogrenciAdlari(d.ogrenciIdleri);
  const ipucu = `${d.baslangic}–${saat(it.e)} ${ogrenciler} · ${kat?.ad || ''} · ${ogretmenAdi(d.ogretmenId)} · ${bekliyor ? 'Onay bekliyor' : DURUMLAR[d.durum].ad}`;
  return `<button class="ders-blok d-${d.durum}${bekliyor ? ' bekliyor' : ''}${dersGecikmis(d) ? ' geciken' : ''}" data-ders="${d.id}"
    style="--c:${esc(dersRengi(d))};top:${ust}px;height:${yuk}px;left:calc(${it.serit * gen}% + 2px);width:calc(${gen}% - 4px)" title="${esc(ipucu)}">
    <span class="db-ust"><span>${d.baslangic}–${saat(it.e)}</span><span class="db-durum">${ikon}</span></span>
    <span class="db-ad">${esc(ogrenciler)}</span>
    <span class="db-alt">${esc(kat?.ad || '')}${Takvim.ogretmen === 'ekip' || Takvim.ogretmen === 'tumu' ? ' · ' + esc(ogretmenAdi(d.ogretmenId)) : ''}</span>
  </button>`;
}

function ayHtml(t, dersler, ay) {
  const bas = haftaBasi(ayBasi(t), ay.haftaBasi);
  const hucreSayisi = addDays(bas, 35) <= aySonu(t) ? 42 : 35;
  const hucreler = [...Array(hucreSayisi)].map((_, i) => addDays(bas, i));
  const bugunS = bugun();
  return `<div class="ay">
    <div class="ay-bas">${[...Array(7)].map((_, i) => `<div>${TR_GUN_KISA[(ay.haftaBasi + i) % 7]}</div>`).join('')}</div>
    <div class="ay-govde">${hucreler.map(g => {
      const s = ymd(g);
      const gd = dersler.filter(d => d.tarih === s).sort(dersSirala);
      return `<div class="ay-hucre${g.getMonth() !== t.getMonth() ? ' diger' : ''}${s === bugunS ? ' bugun' : ''}" data-tarih="${s}">
        <button class="ay-gun" data-gun="${s}" aria-label="${esc(tarihYaz(s, true))}">${g.getDate()}</button>
        ${gd.slice(0, 3).map(d => `<button class="ay-ders d-${d.durum}${d.onay === 'bekliyor' ? ' bekliyor' : ''}" data-ders="${d.id}" style="--c:${esc(dersRengi(d))}">
          <span class="ay-ikon">${d.onay === 'bekliyor' ? '⏳' : DURUMLAR[d.durum].ikon}</span><b>${d.baslangic}</b> ${esc(ogrenciAdlari(d.ogrenciIdleri))}</button>`).join('')}
        ${gd.length > 3 ? `<button class="ay-daha" data-gun="${s}">+${gd.length - 3} ders daha</button>` : ''}
        <div class="ay-bosluk"></div>
      </div>`;
    }).join('')}</div>
  </div>`;
}

// ---------------------------------------------------------------- Ders detayı

function dersDetay(id) {
  const u = Oturum.kullanici();
  const d = DB.get('dersler', id);
  if (!d || !u) return;
  const kat = kategoriBul(d.kategoriId);
  const duzenle = dersDuzenleyebilir(u, d);
  const onaylar = d.onay === 'bekliyor' && dersOnaylayabilir(u, d);
  const tl = d.talep;
  const butonlar = [];
  if (duzenle) {
    butonlar.push({ ad: 'Sil', sinif: 'tehlike-cizgi sol', tik: () => { dersSilSor(d); return false; } });
    butonlar.push({ ad: 'Düzenle', tik: () => { dersFormu(d); return false; } });
  }
  if (onaylar) {
    butonlar.push({ ad: 'Reddet', sinif: 'tehlike-cizgi', tik: () => { reddetModal(d); return false; } });
    butonlar.push({ ad: 'Onayla', sinif: 'birincil', tik: () => { talebiOnayla(d, u); bildir('Onaylandı'); } });
  } else {
    butonlar.push({ ad: 'Kapat', sinif: duzenle ? '' : 'birincil' });
  }

  modal({
    baslik: 'Ders',
    genis: true,
    butonlar,
    icerik: `
      <div class="detay-ust" style="--c:${esc(kat?.renk || '#64748b')}">
        <span class="kat-etiket">${esc(kat?.ad || 'Kategorisiz')}</span>${durumRozet(d)}
        ${d.seriId ? '<span class="rozet-d">🔁 Haftalık seri</span>' : ''}
      </div>
      <dl class="detay">
        <dt>Zaman</dt><dd>${esc(tarihYaz(d.tarih, true))}, ${d.baslangic}–${saat(dersBitis(d))} <span class="soluk">(${sureYaz(Number(d.sure))})</span></dd>
        <dt>Öğretmen</dt><dd>${avatar(DB.get('ogretmenler', d.ogretmenId), 'kucuk')} ${esc(ogretmenAdi(d.ogretmenId))}</dd>
        <dt>Öğrenci</dt><dd>${esc(ogrenciAdlari(d.ogrenciIdleri))}</dd>
        ${d.yer ? `<dt>Yer</dt><dd>${esc(d.yer)}</dd>` : ''}
        ${d.konu ? `<dt>Konu</dt><dd>${esc(d.konu)}</dd>` : ''}
        ${d.plan ? `<dt>Ders planı</dt><dd class="pre">${esc(d.plan)}</dd>` : ''}
        ${d.notlar ? `<dt>Notlar</dt><dd class="pre">${esc(d.notlar)}</dd>` : ''}
        ${d.durumNotu ? `<dt>Durum notu</dt><dd class="pre">${esc(d.durumNotu)}</dd>` : ''}
        ${d.durumGiren && d.durum !== 'planlandi' ? `<dt>Durumu giren</dt><dd>${esc(ogretmenAdi(d.durumGiren))} · ${zamanYaz(d.durumZamani)}${d.onaylayan ? ` · onaylayan: ${esc(ogretmenAdi(d.onaylayan))}` : ''}</dd>` : ''}
      </dl>
      ${tl ? `<div class="kutu uyari">⏳ <b>${esc(ogretmenAdi(tl.kim))}</b>, bu dersi <b>${DURUMLAR[tl.durum].ad}</b> olarak bildirdi
        ${tl.yeniTarih ? ` (yeni tarih: ${tarihKisa(tl.yeniTarih)} ${tl.yeniSaat || d.baslangic})` : ''}${tl.not ? `<br>Not: ${esc(tl.not)}` : ''}<br><small>Sorumlu öğretmen ya da yönetici onayı bekleniyor.</small></div>` : ''}
      ${d.onay === 'reddedildi' ? `<div class="kutu hata">Son durum bildirimi reddedildi${d.redNedeni ? ': ' + esc(d.redNedeni) : ''}.</div>` : ''}
      ${d.ertelemeKaynakId && DB.get('dersler', d.ertelemeKaynakId) ? `<p class="soluk">Bu ders, <button class="link" data-git="${d.ertelemeKaynakId}">${tarihKisa(DB.get('dersler', d.ertelemeKaynakId).tarih)} tarihli dersin</button> ertelemesidir.</p>` : ''}
      ${d.yeniDersId && DB.get('dersler', d.yeniDersId) ? `<p class="soluk">Ertelenen dersin yeni tarihi: <button class="link" data-git="${d.yeniDersId}">${tarihKisa(DB.get('dersler', d.yeniDersId).tarih)} ${DB.get('dersler', d.yeniDersId).baslangic}</button></p>` : ''}
      ${duzenle ? `<div class="hizli-durum">
        <span class="soluk">Durum bildir:</span>
        ${['yapildi', 'yapilmadi', 'ertelendi'].map(s => `<button class="btn durum-btn s-${s}" data-durum="${s}">${DURUMLAR[s].ikon} ${DURUMLAR[s].ad}</button>`).join('')}
        ${d.durum !== 'planlandi' ? `<button class="btn durum-btn" data-durum="planlandi">Geri al</button>` : ''}
      </div>` : '<p class="soluk">Bu dersi yalnızca görüntüleyebilirsiniz.</p>'}
      ${(d.gecmis || []).length ? `<details class="gecmis"><summary>İşlem geçmişi (${d.gecmis.length})</summary><ul>
        ${d.gecmis.slice().reverse().map(g => `<li><span class="soluk">${zamanYaz(g.t)} · ${esc(ogretmenAdi(g.kim))}</span><br>${esc(g.metin)}</li>`).join('')}
      </ul></details>` : ''}`,
    acilinca: govde => {
      govde.addEventListener('click', e => {
        const s = e.target.closest('[data-durum]')?.dataset.durum;
        if (s) return durumModal(d, s);
        const git = e.target.closest('[data-git]')?.dataset.git;
        if (git) dersDetay(git);
      });
    },
  });
}

function dersSilSor(d) {
  const seriSayisi = d.seriId ? DB.list('dersler').filter(x => x.seriId === d.seriId && x.tarih >= d.tarih && x.durum === 'planlandi').length : 0;
  const butonlar = [{ ad: 'Vazgeç', tik: () => { dersDetay(d.id); return false; } },
    { ad: 'Yalnızca bu dersi sil', sinif: 'tehlike', tik: () => { dersSil(d); bildir('Ders silindi'); } }];
  if (seriSayisi > 1) butonlar.push({ ad: `Bu ve sonraki ${seriSayisi} planlı dersi sil`, sinif: 'tehlike', tik: () => { dersSil(d, true); bildir('Seri dersleri silindi'); } });
  modal({
    baslik: 'Dersi sil',
    icerik: `<p><b>${esc(ogrenciAdlari(d.ogrenciIdleri))}</b> — ${esc(tarihYaz(d.tarih, true))} ${d.baslangic} dersi silinsin mi? Bu işlem geri alınamaz.</p>
      ${d.durum !== 'planlandi' ? '<p class="kutu uyari">Bu dersin durumu girilmiş. Silmek yerine durumunu güncellemeniz önerilir.</p>' : ''}`,
    butonlar,
  });
}

function reddetModal(d) {
  const u = Oturum.kullanici();
  modal({
    baslik: 'Bildirimi reddet',
    icerik: `<form class="form tek" onsubmit="return false"><label>Red nedeni (isteğe bağlı)<textarea name="neden" rows="3"></textarea></label></form>`,
    butonlar: [{ ad: 'Vazgeç', tik: () => { dersDetay(d.id); return false; } },
      { ad: 'Reddet', sinif: 'tehlike', tik: g => { talebiReddet(d, u, formOku(g).neden); bildir('Bildirim reddedildi', 'uyari'); } }],
  });
}

// ---------------------------------------------------------------- Durum bildirimi

const YAPILMADI_NEDENLERI = ['Öğrenci gelmedi', 'Öğrenci hasta', 'Öğretmen katılamadı', 'Haber vermeden iptal', 'Resmî tatil'];

function durumModal(d, secili) {
  const u = Oturum.kullanici();
  const onayli = onayGerekli(u, d);
  let cakismaOnaylandi = false;
  modal({
    baslik: 'Ders durumu',
    icerik: `
      <p class="soluk">${esc(ogrenciAdlari(d.ogrenciIdleri))} · ${esc(tarihYaz(d.tarih, true))} ${d.baslangic}</p>
      <form class="form tek" onsubmit="return false">
        <div class="durum-sec">
          ${Object.entries(DURUMLAR).map(([k, v]) => `<label class="s-${k}"><input type="radio" name="durum" value="${k}" ${k === secili ? 'checked' : ''}><span>${v.ikon} ${k === 'planlandi' ? 'Planlandı (geri al)' : v.ad}</span></label>`).join('')}
        </div>
        <div class="neden-alan">${YAPILMADI_NEDENLERI.map(n => `<button type="button" class="cip" data-neden="${esc(n)}">${esc(n)}</button>`).join('')}</div>
        <label><span class="not-etiket">Not</span><textarea name="not" rows="3"></textarea></label>
        <div class="ertele-alan form">
          <label>Yeni tarih<input type="date" name="yeniTarih"></label>
          <label>Yeni saat<input type="time" name="yeniSaat" step="300" value="${d.baslangic}"></label>
          <small class="tam soluk">Yeni tarih seçerseniz o tarihe otomatik ders oluşturulur. Boş bırakırsanız ders yalnızca “ertelendi” olarak işaretlenir.</small>
        </div>
        <div class="cakisma-alan"></div>
        ${onayli ? '<div class="kutu bilgi">ℹ️ Onay süreci açık: bildiriminiz sorumlu öğretmen / yönetici onayından sonra işlenecek.</div>' : ''}
        ${d.onay === 'bekliyor' ? '<div class="kutu uyari">Bu ders için bekleyen bir bildirim var; yeni bildirim onun yerine geçer.</div>' : ''}
      </form>`,
    butonlar: [{ ad: 'Vazgeç', tik: () => { dersDetay(d.id); return false; } }, {
      ad: onayli ? 'Onaya gönder' : 'Kaydet', sinif: 'birincil', tik: g => {
        const f = formOku(g);
        if (!f.durum) return hataGoster(g, 'Bir durum seçin.');
        const talep = { durum: f.durum, not: f.not };
        if (f.durum === 'ertelendi' && f.yeniTarih) {
          talep.yeniTarih = f.yeniTarih;
          talep.yeniSaat = f.yeniSaat || d.baslangic;
          const cak = cakismalar({ ...d, tarih: talep.yeniTarih, baslangic: talep.yeniSaat }, d.id);
          if (cak.length && !cakismaOnaylandi) {
            cakismaOnaylandi = true;
            $('.cakisma-alan', g).innerHTML = `<div class="kutu uyari"><b>Yeni tarihte çakışma var:</b><ul>${cak.map(c => `<li>${c.baslangic}–${saat(dersBitis(c))} · ${esc(ogretmenAdi(c.ogretmenId))} · ${esc(ogrenciAdlari(c.ogrenciIdleri))}</li>`).join('')}</ul>Yine de kaydetmek için tekrar basın.</div>`;
            return false;
          }
        }
        const r = durumBildir(d, u, talep);
        bildir(r === 'bekliyor' ? 'Bildirim onaya gönderildi' : 'Durum kaydedildi');
      },
    }],
    acilinca: g => {
      const guncelle = () => {
        const s = formOku(g).durum;
        $('.ertele-alan', g).hidden = s !== 'ertelendi';
        $('.neden-alan', g).hidden = s !== 'yapilmadi';
        $('.not-etiket', g).textContent = { yapildi: 'İşlenen konu / not', yapilmadi: 'Neden', ertelendi: 'Erteleme nedeni', planlandi: 'Not' }[s] || 'Not';
      };
      g.addEventListener('change', e => {
        if (e.target.name === 'yeniTarih' || e.target.name === 'yeniSaat') { cakismaOnaylandi = false; $('.cakisma-alan', g).innerHTML = ''; }
        guncelle();
      });
      g.addEventListener('click', e => {
        const n = e.target.closest('[data-neden]')?.dataset.neden;
        if (n) { $('[name=not]', g).value = n; }
      });
      guncelle();
    },
  });
}

// ---------------------------------------------------------------- Ders formu

function dersFormu(mevcut, on = {}) {
  const u = Oturum.kullanici();
  const ay = DB.ayarlar();
  const yetkiliIdler = yetkiliOgretmenIdleri(u);
  const varsayilanOgretmen = yetkiliIdler.includes(Takvim.ogretmen) ? Takvim.ogretmen : u.id;
  const d = mevcut ? { ...mevcut } : {
    tarih: bugun(), baslangic: '16:00', sure: ay.varsayilanSure, ogretmenId: varsayilanOgretmen,
    kategoriId: '', ogrenciIdleri: [], konu: '', plan: '', notlar: '', yer: '', ...on,
  };
  const ogretmenler = DB.list('ogretmenler').filter(t => yetkiliIdler.includes(t.id) && (!t.pasif || t.id === d.ogretmenId)).sort((a, b) => trSirala(a.ad, b.ad));
  const ogrenciler = DB.list('ogrenciler').filter(o => !o.pasif || d.ogrenciIdleri.includes(o.id)).sort((a, b) => trSirala(a.ad, b.ad));
  const kategoriler = DB.list('kategoriler').slice().sort((a, b) => trSirala(a.ad, b.ad));
  const eslesmeler = DB.list('eslesmeler').filter(e => e.aktif !== false && yetkiliIdler.includes(e.ogretmenId))
    .sort((a, b) => trSirala(eslesmeEtiket(a), eslesmeEtiket(b)));
  const yerler = [...new Set(DB.list('dersler').map(x => x.yer).filter(Boolean))];
  let cakismaOnaylandi = false;

  if (!ogrenciler.length) {
    return modal({
      baslik: 'Önce öğrenci ekleyin',
      icerik: '<p>Ders planlayabilmek için en az bir öğrenci tanımlı olmalı.</p>',
      butonlar: [{ ad: 'Kapat' }, { ad: 'Öğrenci ekle', sinif: 'birincil', tik: () => { location.hash = '#/ogrenciler'; setTimeout(() => ogrenciFormu(null), 0); } }],
    });
  }

  modal({
    baslik: mevcut ? 'Dersi düzenle' : 'Yeni ders',
    genis: true,
    icerik: `<form class="form" onsubmit="return false">
      ${!mevcut && eslesmeler.length ? `<label class="tam">Eşleştirmeden doldur
        <select name="eslesmeId">${secenekler(eslesmeler, d.eslesmeId, { bos: '— Seçin (isteğe bağlı) —', etiket: eslesmeEtiket })}</select></label>` : ''}
      <label>Tarih<input type="date" name="tarih" value="${esc(d.tarih)}" required></label>
      <div class="ikili">
        <label>Başlangıç<input type="time" name="baslangic" step="300" value="${esc(d.baslangic)}" required></label>
        <label>Süre (dk)<input type="number" name="sure" min="5" max="600" step="5" value="${esc(d.sure)}" required></label>
      </div>
      <label>Öğretmen<select name="ogretmenId">${secenekler(ogretmenler, d.ogretmenId)}</select></label>
      <label>Kategori<select name="kategoriId">${secenekler(kategoriler, d.kategoriId, { bos: '— Seçin —' })}</select></label>
      <div class="tam kutu bilgi adina-not" hidden></div>
      <fieldset class="tam ogr-sec">
        <legend>Öğrenci(ler) <span class="soluk secili-sayi"></span></legend>
        <input type="search" class="ogr-ara" placeholder="Öğrenci ara…" aria-label="Öğrenci ara">
        <div class="secim-liste">${ogrenciler.map(o => `<label class="secim"><input type="checkbox" name="ogrenciIdleri" data-coklu value="${o.id}" ${d.ogrenciIdleri.includes(o.id) ? 'checked' : ''}> <span>${esc(o.ad)}</span>${o.sinif ? `<small>${esc(o.sinif)}</small>` : ''}</label>`).join('')}</div>
      </fieldset>
      <label>Yer<input name="yer" value="${esc(d.yer || '')}" list="yer-oneri" placeholder="Online, öğrencinin evi, kurum…"><datalist id="yer-oneri">${yerler.map(y => `<option value="${esc(y)}">`).join('')}</datalist></label>
      <label>Konu / başlık<input name="konu" value="${esc(d.konu || '')}" placeholder="Örn. Türev – giriş"></label>
      <label class="tam">Ders planı<textarea name="plan" rows="4" placeholder="İşlenecek konular, hedefler, ödevler…">${esc(d.plan || '')}</textarea></label>
      <label class="tam">Notlar<textarea name="notlar" rows="2">${esc(d.notlar || '')}</textarea></label>
      ${!mevcut ? `<label>Haftalık tekrar<input type="number" name="tekrar" min="1" max="52" value="1"><small class="soluk">Aynı gün ve saatte kaç hafta oluşturulsun</small></label>` : ''}
      <div class="tam cakisma-alan"></div>
    </form>`,
    butonlar: [{ ad: 'Vazgeç' }, {
      ad: 'Kaydet', sinif: 'birincil', tik: g => {
        const f = formOku(g);
        if (!f.tarih || !f.baslangic) return hataGoster(g, 'Tarih ve saat zorunludur.');
        if (!(Number(f.sure) > 0)) return hataGoster(g, 'Süre geçerli değil.');
        if (!f.ogretmenId) return hataGoster(g, 'Öğretmen seçin.');
        if (!f.ogrenciIdleri.length) return hataGoster(g, 'En az bir öğrenci seçin.');
        if (dk(f.baslangic) + Number(f.sure) > 24 * 60) return hataGoster(g, 'Ders gece yarısını geçemez.');
        const veri = {
          tarih: f.tarih, baslangic: f.baslangic, sure: Number(f.sure), ogretmenId: f.ogretmenId,
          kategoriId: f.kategoriId, ogrenciIdleri: f.ogrenciIdleri, yer: f.yer, konu: f.konu, plan: f.plan, notlar: f.notlar,
        };
        if (f.eslesmeId) veri.eslesmeId = f.eslesmeId;
        const cak = cakismalar(veri, mevcut?.id);
        if (cak.length && !cakismaOnaylandi) {
          cakismaOnaylandi = true;
          $('.cakisma-alan', g).innerHTML = `<div class="kutu uyari"><b>Çakışma var:</b><ul>${cak.map(c => `<li>${c.baslangic}–${saat(dersBitis(c))} · ${esc(ogretmenAdi(c.ogretmenId))} · ${esc(ogrenciAdlari(c.ogrenciIdleri))}</li>`).join('')}</ul>Yine de kaydetmek için tekrar <b>Kaydet</b>'e basın.</div>`;
          $('.cakisma-alan', g).scrollIntoView({ block: 'nearest' });
          return false;
        }
        if (mevcut) {
          dersGuncelle(DB.get('dersler', mevcut.id), veri, u);
          bildir('Ders güncellendi');
        } else {
          const tekrar = Math.min(52, Math.max(1, Number(f.tekrar) || 1));
          dersleriOlustur(veri, u, tekrar);
          bildir(tekrar > 1 ? `${tekrar} ders oluşturuldu` : 'Ders oluşturuldu');
        }
      },
    }],
    acilinca: g => {
      let sureElle = !!mevcut;
      const sayiGuncelle = () => {
        const n = $$('[name=ogrenciIdleri]:checked', g).length;
        $('.secili-sayi', g).textContent = n ? `(${n} seçili)` : '';
      };
      const adinaGuncelle = () => {
        const id = $('[name=ogretmenId]', g).value;
        const el = $('.adina-not', g);
        el.hidden = id === u.id;
        el.innerHTML = `ℹ️ Bu dersi <b>${esc(ogretmenAdi(id))}</b> adına giriyorsunuz.`;
      };
      g.addEventListener('input', e => {
        if (e.target.name === 'sure') sureElle = true;
        if (e.target.classList.contains('ogr-ara')) {
          const q = e.target.value.toLocaleLowerCase('tr');
          $$('.secim', g).forEach(l => { l.hidden = q && !l.textContent.toLocaleLowerCase('tr').includes(q); });
        }
        if (['tarih', 'baslangic', 'sure', 'ogretmenId', 'ogrenciIdleri'].includes(e.target.name)) {
          cakismaOnaylandi = false;
          $('.cakisma-alan', g).innerHTML = '';
        }
      });
      g.addEventListener('change', e => {
        const n = e.target.name;
        if (n === 'eslesmeId' && e.target.value) {
          const es = DB.get('eslesmeler', e.target.value);
          $('[name=ogretmenId]', g).value = es.ogretmenId;
          $('[name=kategoriId]', g).value = es.kategoriId;
          $$('[name=ogrenciIdleri]', g).forEach(c => { c.checked = c.value === es.ogrenciId; });
          const kat = kategoriBul(es.kategoriId);
          if (kat?.varsayilanSure && !sureElle) $('[name=sure]', g).value = kat.varsayilanSure;
        }
        if (n === 'kategoriId' && !sureElle) {
          const kat = kategoriBul(e.target.value);
          if (kat?.varsayilanSure) $('[name=sure]', g).value = kat.varsayilanSure;
        }
        sayiGuncelle();
        adinaGuncelle();
      });
      if (on.eslesmeId && !mevcut) $('[name=eslesmeId]', g)?.dispatchEvent(new Event('change', { bubbles: true }));
      sayiGuncelle();
      adinaGuncelle();
    },
  });
}
