'use strict';
// Tanımlamalar: öğrenciler, öğretmenler, kategoriler, eşleştirmeler.

const Yonetim = { ogrenciAra: '', pasifler: false, eslesmeOgretmen: 'ekip' };

function dersSayilari(filtre) {
  const d = DB.list('dersler').filter(filtre);
  return { toplam: d.length, yapildi: d.filter(x => x.durum === 'yapildi').length };
}

// ---------------------------------------------------------------- Öğrenciler

function ogrencilerView(el, u) {
  const q = Yonetim.ogrenciAra.toLocaleLowerCase('tr');
  const liste = DB.list('ogrenciler')
    .filter(o => (Yonetim.pasifler || !o.pasif) && (!q || [o.ad, o.veli, o.telefon, o.sinif].join(' ').toLocaleLowerCase('tr').includes(q)))
    .sort((a, b) => trSirala(a.ad, b.ad));
  const pasifSayisi = DB.list('ogrenciler').filter(o => o.pasif).length;

  el.innerHTML = `
    <div class="sayfa-ust"><h1>Öğrenciler</h1><div class="sag"><button class="btn birincil" data-act="yeni">+ Öğrenci</button></div></div>
    <div class="filtreler">
      <label class="filtre genis"><span>Ara</span><input type="search" data-alan="ara" value="${esc(Yonetim.ogrenciAra)}" placeholder="Ad, veli, telefon, sınıf…"></label>
      ${pasifSayisi ? `<label class="filtre onay-satir"><input type="checkbox" data-alan="pasif" ${Yonetim.pasifler ? 'checked' : ''}> Pasifleri göster (${pasifSayisi})</label>` : ''}
    </div>
    ${liste.length ? `<div class="tablo-kap"><table class="tablo tikla">
      <thead><tr><th>Ad soyad</th><th>Sınıf</th><th>Veli</th><th>Telefon</th><th>Dersleri</th><th class="sag-hiza">Yapılan / toplam</th><th></th></tr></thead>
      <tbody>${liste.map(o => {
        const es = DB.list('eslesmeler').filter(e => e.ogrenciId === o.id && e.aktif !== false);
        const s = dersSayilari(d => (d.ogrenciIdleri || []).includes(o.id));
        return `<tr data-id="${o.id}" class="${o.pasif ? 'pasif' : ''}">
          <td><b>${esc(o.ad)}</b>${o.pasif ? ' <span class="rozet-d">Pasif</span>' : ''}</td>
          <td>${esc(o.sinif || '')}</td>
          <td>${esc(o.veli || '')}</td>
          <td class="nw">${o.telefon ? `<a href="tel:${esc(o.telefon)}" data-dur>${esc(o.telefon)}</a>` : ''}${o.veliTelefon ? `<br><small class="soluk">Veli: <a href="tel:${esc(o.veliTelefon)}" data-dur>${esc(o.veliTelefon)}</a></small>` : ''}</td>
          <td>${es.map(e => `<span class="cip kucuk" style="--c:${esc(kategoriBul(e.kategoriId)?.renk || '#64748b')}">${esc(kategoriBul(e.kategoriId)?.ad || '?')} · ${esc(ogretmenAdi(e.ogretmenId))}</span>`).join(' ')}</td>
          <td class="sag-hiza">${s.yapildi} / ${s.toplam}</td>
          <td class="nw sag-hiza"><button class="btn kucuk" data-act="dersler">Dersler</button></td>
        </tr>`;
      }).join('')}</tbody></table></div>` : `<div class="bos">${DB.list('ogrenciler').length ? 'Aramaya uyan öğrenci yok.' : 'Henüz öğrenci eklenmedi.'}</div>`}`;

  el.onclick = e => {
    if (e.target.closest('[data-dur]')) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'yeni') return ogrenciFormu(null);
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (!id) return;
    if (act === 'dersler') {
      Object.assign(DersListe, { ogrenci: id, ogretmen: yoneticiMi(u) ? 'ekip' : 'tumu', durum: '', bas: '', son: '' });
      location.hash = '#/dersler';
      return;
    }
    ogrenciFormu(DB.get('ogrenciler', id));
  };
  el.onchange = e => {
    if (e.target.dataset.alan === 'ara') { Yonetim.ogrenciAra = e.target.value; render(); }
    if (e.target.dataset.alan === 'pasif') { Yonetim.pasifler = e.target.checked; render(); }
  };
}

function ogrenciFormu(o) {
  const v = o || { ad: '', sinif: '', okul: '', telefon: '', eposta: '', veli: '', veliTelefon: '', notlar: '', pasif: false };
  const dersVar = o && DB.list('dersler').some(d => (d.ogrenciIdleri || []).includes(o.id));
  const butonlar = [{ ad: 'Vazgeç' }, {
    ad: 'Kaydet', sinif: 'birincil', tik: g => {
      const f = formOku(g);
      if (!f.ad) return hataGoster(g, 'Ad soyad zorunludur.');
      const ayni = DB.list('ogrenciler').find(x => x.id !== o?.id && x.ad.toLocaleLowerCase('tr') === f.ad.toLocaleLowerCase('tr'));
      if (ayni && !g.dataset.ayniOnay) { g.dataset.ayniOnay = '1'; return hataGoster(g, 'Aynı isimde bir öğrenci zaten var. Yine de kaydetmek için tekrar Kaydet’e basın.'); }
      DB.save('ogrenciler', { ...(o || {}), ...f });
      bildir(o ? 'Öğrenci güncellendi' : 'Öğrenci eklendi');
    },
  }];
  if (o) butonlar.unshift({
    ad: 'Sil', sinif: 'tehlike-cizgi sol', tik: async () => {
      if (dersVar) { bildir('Bu öğrencinin dersleri var; silmek yerine “Pasif” işaretleyin.', 'uyari'); return false; }
      if (await onayKutusu(`<b>${esc(o.ad)}</b> silinsin mi? Eşleştirmeleri de silinir.`, { evet: 'Sil', tehlike: true })) {
        DB.tx(() => {
          DB.list('eslesmeler').filter(e => e.ogrenciId === o.id).forEach(e => DB.remove('eslesmeler', e.id));
          DB.remove('ogrenciler', o.id);
        });
        bildir('Öğrenci silindi');
      }
    },
  });
  modal({
    baslik: o ? 'Öğrenciyi düzenle' : 'Yeni öğrenci',
    genis: true,
    butonlar,
    icerik: `<form class="form" onsubmit="return false">
      <label>Ad soyad *<input name="ad" value="${esc(v.ad)}" required autocomplete="off"></label>
      <div class="ikili">
        <label>Sınıf / seviye<input name="sinif" value="${esc(v.sinif || '')}" placeholder="Örn. 11. sınıf"></label>
        <label>Okul<input name="okul" value="${esc(v.okul || '')}"></label>
      </div>
      <label>Telefon<input name="telefon" type="tel" value="${esc(v.telefon || '')}"></label>
      <label>E-posta<input name="eposta" type="email" value="${esc(v.eposta || '')}"></label>
      <label>Veli adı<input name="veli" value="${esc(v.veli || '')}"></label>
      <label>Veli telefonu<input name="veliTelefon" type="tel" value="${esc(v.veliTelefon || '')}"></label>
      <label class="tam">Notlar<textarea name="notlar" rows="3" placeholder="Hedefler, eksik konular, özel durumlar…">${esc(v.notlar || '')}</textarea></label>
      ${o ? `<label class="tam onay-satir"><input type="checkbox" name="pasif" ${v.pasif ? 'checked' : ''}> Pasif (artık ders almıyor; listelerde gizlenir)</label>` : ''}
    </form>`,
  });
}

// ---------------------------------------------------------------- Öğretmenler

function ogretmenlerView(el, u) {
  const yon = yoneticiMi(u);
  const liste = DB.list('ogretmenler').slice().sort((a, b) => (a.pasif - b.pasif) || trSirala(a.ad, b.ad));
  el.innerHTML = `
    <div class="sayfa-ust"><h1>Öğretmenler</h1>${yon ? '<div class="sag"><button class="btn birincil" data-act="yeni">+ Öğretmen</button></div>' : ''}</div>
    <p class="soluk aciklama">Bir öğretmenin <b>sorumlusu</b>, o öğretmenin adına ders girebilir ve durum bildirimlerini onaylayabilir. Yöneticiler tüm öğretmenler için yetkilidir.</p>
    <div class="tablo-kap"><table class="tablo tikla">
      <thead><tr><th>Ad soyad</th><th>Rol</th><th>Sorumlusu</th><th>Ekibi</th><th>Branş</th><th>İletişim</th><th class="sag-hiza">Yapılan / toplam</th></tr></thead>
      <tbody>${liste.map(t => {
        const ekip = ekipIdleri(t);
        const s = dersSayilari(d => d.ogretmenId === t.id);
        const duzenlenir = yon || t.id === u.id;
        return `<tr data-id="${t.id}" class="${t.pasif ? 'pasif' : ''} ${duzenlenir ? '' : 'salt'}">
          <td class="nw">${avatar(t, 'kucuk')} <b>${esc(t.ad)}</b>${t.id === u.id ? ' <span class="soluk">(siz)</span>' : ''}${t.pasif ? ' <span class="rozet-d">Pasif</span>' : ''}</td>
          <td>${rolAdi(t)}</td>
          <td>${t.sorumluId ? esc(ogretmenAdi(t.sorumluId)) : '<span class="soluk">—</span>'}</td>
          <td>${ekip.length ? ekip.map(id => esc(ogretmenAdi(id))).join(', ') : '<span class="soluk">—</span>'}</td>
          <td>${esc(t.brans || '')}</td>
          <td class="nw">${t.telefon ? `<a href="tel:${esc(t.telefon)}" data-dur>${esc(t.telefon)}</a>` : ''}${t.eposta ? `<br><small class="soluk">${esc(t.eposta)}</small>` : ''}</td>
          <td class="sag-hiza">${s.yapildi} / ${s.toplam}</td>
        </tr>`;
      }).join('')}</tbody></table></div>`;

  el.onclick = e => {
    if (e.target.closest('[data-dur]')) return;
    if (e.target.closest('[data-act=yeni]')) return ogretmenFormu(null);
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (id && (yon || id === u.id)) ogretmenFormu(DB.get('ogretmenler', id));
  };
}

function ogretmenFormu(t) {
  const u = Oturum.kullanici();
  const yon = yoneticiMi(u);
  const v = t || { ad: '', brans: '', telefon: '', eposta: '', renk: RENKLER[DB.list('ogretmenler').length % RENKLER.length], rol: 'ogretmen', sorumluId: u.id, pasif: false };
  // Döngü oluşmasın: kendisi ve alt ekibi sorumlu seçilemez.
  const yasak = t ? [t.id, ...ekipIdleri(t)] : [];
  const sorumluAdaylari = DB.list('ogretmenler').filter(x => !yasak.includes(x.id) && !x.pasif).sort((a, b) => trSirala(a.ad, b.ad));
  const kullanimda = t && (DB.list('dersler').some(d => d.ogretmenId === t.id) || DB.list('eslesmeler').some(e => e.ogretmenId === t.id) || DB.list('ogretmenler').some(x => x.sorumluId === t.id));

  const butonlar = [{ ad: 'Vazgeç' }, {
    ad: 'Kaydet', sinif: 'birincil', tik: g => {
      const f = formOku(g);
      if (!f.ad) return hataGoster(g, 'Ad soyad zorunludur.');
      if (f.pin && !/^\d{4,6}$/.test(f.pin)) return hataGoster(g, 'PIN 4–6 haneli rakam olmalı.');
      const yeni = { ...(t || {}), ad: f.ad, brans: f.brans, telefon: f.telefon, eposta: f.eposta, renk: f.renk || v.renk };
      if (yon) {
        yeni.rol = f.rol;
        yeni.sorumluId = f.sorumluId || null;
        yeni.pasif = !!f.pasif;
        const aktifYonetici = DB.list('ogretmenler').filter(x => x.id !== yeni.id && x.rol === 'yonetici' && !x.pasif).length + (yeni.rol === 'yonetici' && !yeni.pasif ? 1 : 0);
        if (!aktifYonetici) return hataGoster(g, 'En az bir aktif yönetici kalmalı.');
      }
      if (f.pin) yeni.pin = basitKarma(f.pin);
      if (f.pinKaldir) delete yeni.pin;
      DB.save('ogretmenler', yeni);
      bildir(t ? 'Öğretmen güncellendi' : 'Öğretmen eklendi');
    },
  }];
  if (t && yon && t.id !== u.id) butonlar.unshift({
    ad: 'Sil', sinif: 'tehlike-cizgi sol', tik: async () => {
      if (kullanimda) { bildir('Bu öğretmenin dersleri, eşleştirmeleri ya da ekibi var; silmek yerine “Pasif” işaretleyin.', 'uyari'); return false; }
      if (await onayKutusu(`<b>${esc(t.ad)}</b> silinsin mi?`, { evet: 'Sil', tehlike: true })) { DB.remove('ogretmenler', t.id); bildir('Öğretmen silindi'); }
    },
  });

  modal({
    baslik: t ? (t.id === u.id ? 'Profilim' : 'Öğretmeni düzenle') : 'Yeni öğretmen',
    genis: true,
    butonlar,
    icerik: `<form class="form" onsubmit="return false">
      <label>Ad soyad *<input name="ad" value="${esc(v.ad)}" required autocomplete="off"></label>
      <label>Branş<input name="brans" value="${esc(v.brans || '')}" placeholder="Örn. Matematik"></label>
      <label>Telefon<input name="telefon" type="tel" value="${esc(v.telefon || '')}"></label>
      <label>E-posta<input name="eposta" type="email" value="${esc(v.eposta || '')}"></label>
      ${yon ? `
        <label>Rol<select name="rol">
          <option value="ogretmen" ${v.rol !== 'yonetici' ? 'selected' : ''}>Öğretmen</option>
          <option value="yonetici" ${v.rol === 'yonetici' ? 'selected' : ''}>Yönetici (tüm yetkiler)</option>
        </select></label>
        <label>Sorumlu öğretmen<select name="sorumluId">${secenekler(sorumluAdaylari, v.sorumluId, { bos: '— Yok —' })}</select>
          <small class="soluk">Adına giriş yapabilir ve bildirimlerini onaylar</small></label>` : ''}
      <fieldset class="tam"><legend>Takvim rengi</legend>${renkSecici('renk', v.renk)}</fieldset>
      <label>Giriş PIN'i (isteğe bağlı)<input name="pin" inputmode="numeric" autocomplete="new-password" type="password" maxlength="6" placeholder="${t?.pin ? 'Değiştirmek için yeni PIN' : '4–6 hane'}"></label>
      ${t?.pin ? `<label class="onay-satir"><input type="checkbox" name="pinKaldir"> PIN'i kaldır</label>` : '<div></div>'}
      ${yon && t ? `<label class="tam onay-satir"><input type="checkbox" name="pasif" ${v.pasif ? 'checked' : ''}> Pasif (giriş yapamaz, yeni derslerde görünmez)</label>` : ''}
      <p class="tam soluk kucuk-yazi">PIN, aynı cihazı kullananların birbirinin yerine giriş yapmasını zorlaştırmak içindir; gerçek bir güvenlik önlemi değildir.</p>
    </form>`,
  });
}

// ---------------------------------------------------------------- Kategoriler

function kategorilerView(el, u) {
  const yon = yoneticiMi(u);
  const liste = DB.list('kategoriler').slice().sort((a, b) => trSirala(a.ad, b.ad));
  el.innerHTML = `
    <div class="sayfa-ust"><h1>Ders kategorileri</h1>${yon ? '<div class="sag"><button class="btn birincil" data-act="yeni">+ Kategori</button></div>' : ''}</div>
    ${liste.length ? `<div class="kart-izgara">${liste.map(k => {
      const s = dersSayilari(d => d.kategoriId === k.id);
      return `<button class="kat-kart" data-id="${k.id}" style="--c:${esc(k.renk)}" ${yon ? '' : 'disabled'}>
        <span class="kk-ad">${esc(k.ad)}</span>
        <span class="soluk">${sureYaz(Number(k.varsayilanSure) || 0)}${Number(k.ucret) ? ' · ' + paraYaz(k.ucret) + ' / ders' : ''}</span>
        ${k.aciklama ? `<span class="kucuk-yazi">${esc(k.aciklama)}</span>` : ''}
        <span class="kucuk-yazi soluk">${s.yapildi} yapılan / ${s.toplam} ders</span>
      </button>`;
    }).join('')}</div>` : '<div class="bos">Henüz kategori yok. Örn. Matematik, Fizik, İngilizce…</div>'}`;
  el.onclick = e => {
    if (!yon) return;
    if (e.target.closest('[data-act=yeni]')) return kategoriFormu(null);
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (id) kategoriFormu(DB.get('kategoriler', id));
  };
}

function kategoriFormu(k) {
  const v = k || { ad: '', renk: RENKLER[DB.list('kategoriler').length % RENKLER.length], varsayilanSure: DB.ayarlar().varsayilanSure, ucret: '', aciklama: '' };
  const kullanimda = k && (DB.list('dersler').some(d => d.kategoriId === k.id) || DB.list('eslesmeler').some(e => e.kategoriId === k.id));
  const butonlar = [{ ad: 'Vazgeç' }, {
    ad: 'Kaydet', sinif: 'birincil', tik: g => {
      const f = formOku(g);
      if (!f.ad) return hataGoster(g, 'Kategori adı zorunludur.');
      DB.save('kategoriler', { ...(k || {}), ad: f.ad, renk: f.renk || v.renk, varsayilanSure: Number(f.varsayilanSure) || 60, ucret: f.ucret === '' ? '' : Number(f.ucret), aciklama: f.aciklama });
      bildir(k ? 'Kategori güncellendi' : 'Kategori eklendi');
    },
  }];
  if (k) butonlar.unshift({
    ad: 'Sil', sinif: 'tehlike-cizgi sol', tik: async () => {
      if (kullanimda) { bildir('Bu kategori derslerde ya da eşleştirmelerde kullanılıyor.', 'uyari'); return false; }
      if (await onayKutusu(`<b>${esc(k.ad)}</b> silinsin mi?`, { evet: 'Sil', tehlike: true })) { DB.remove('kategoriler', k.id); bildir('Kategori silindi'); }
    },
  });
  modal({
    baslik: k ? 'Kategoriyi düzenle' : 'Yeni kategori',
    butonlar,
    icerik: `<form class="form" onsubmit="return false">
      <label class="tam">Ad *<input name="ad" value="${esc(v.ad)}" required placeholder="Örn. Matematik – TYT"></label>
      <label>Varsayılan süre (dk)<input name="varsayilanSure" type="number" min="5" step="5" value="${esc(v.varsayilanSure)}"></label>
      <label>Ders başı ücret (₺)<input name="ucret" type="number" min="0" step="any" value="${esc(v.ucret ?? '')}" placeholder="İsteğe bağlı"></label>
      <fieldset class="tam"><legend>Renk</legend>${renkSecici('renk', v.renk)}</fieldset>
      <label class="tam">Açıklama<textarea name="aciklama" rows="2">${esc(v.aciklama || '')}</textarea></label>
    </form>`,
  });
}

// ---------------------------------------------------------------- Eşleştirmeler

function eslesmelerView(el, u) {
  const yetkili = yetkiliOgretmenIdleri(u);
  const F = Yonetim;
  const hb = haftaBasi(new Date(), DB.ayarlar().haftaBasi);
  const hBas = ymd(hb), hSon = ymd(addDays(hb, 6));
  const liste = DB.list('eslesmeler').filter(e => {
    if (F.eslesmeOgretmen === 'ekip') return yetkili.includes(e.ogretmenId);
    if (F.eslesmeOgretmen === 'tumu') return true;
    return e.ogretmenId === F.eslesmeOgretmen;
  }).sort((a, b) => (a.aktif === false) - (b.aktif === false) || trSirala(eslesmeEtiket(a), eslesmeEtiket(b)));

  el.innerHTML = `
    <div class="sayfa-ust"><h1>Öğrenci – ders eşleştirmeleri</h1><div class="sag"><button class="btn birincil" data-act="yeni">+ Eşleştirme</button></div></div>
    <p class="soluk aciklama">Hangi öğrencinin hangi dersi hangi öğretmenden aldığını tanımlayın. Ders planlarken eşleştirmeyi seçmek alanları otomatik doldurur; öğrenciye özel ücret de burada belirlenir.</p>
    <div class="filtreler"><label class="filtre"><span>Öğretmen</span><select data-filtre>${ogretmenFiltreSecenekleri(u, F.eslesmeOgretmen)}</select></label></div>
    ${liste.length ? `<div class="tablo-kap"><table class="tablo tikla">
      <thead><tr><th>Öğrenci</th><th>Ders</th><th>Öğretmen</th><th class="sag-hiza">Bu hafta / hedef</th><th class="sag-hiza">Ücret</th><th>Başlangıç</th><th></th></tr></thead>
      <tbody>${liste.map(e => {
        const kat = kategoriBul(e.kategoriId);
        const buHafta = DB.list('dersler').filter(d => d.ogretmenId === e.ogretmenId && d.kategoriId === e.kategoriId && (d.ogrenciIdleri || []).includes(e.ogrenciId) && d.tarih >= hBas && d.tarih <= hSon && d.durum !== 'ertelendi').length;
        const hedef = Number(e.haftalikHedef) || 0;
        const yetkiliMi = yetkili.includes(e.ogretmenId);
        return `<tr data-id="${e.id}" class="${e.aktif === false ? 'pasif' : ''} ${yetkiliMi ? '' : 'salt'}">
          <td><b>${esc(DB.get('ogrenciler', e.ogrenciId)?.ad || '?')}</b>${e.aktif === false ? ' <span class="rozet-d">Pasif</span>' : ''}</td>
          <td><span class="nokta" style="--c:${esc(kat?.renk || '#64748b')}"></span>${esc(kat?.ad || '?')}</td>
          <td>${esc(ogretmenAdi(e.ogretmenId))}</td>
          <td class="sag-hiza ${hedef && buHafta < hedef ? 'eksik' : ''}">${buHafta}${hedef ? ' / ' + hedef : ''}</td>
          <td class="sag-hiza nw">${e.ucret !== '' && e.ucret != null ? paraYaz(e.ucret) : `<span class="soluk">${Number(kat?.ucret) ? paraYaz(kat.ucret) : '—'}</span>`}</td>
          <td class="nw">${e.baslangic ? tarihKisa(e.baslangic) : ''}</td>
          <td class="sag-hiza nw">${yetkiliMi && e.aktif !== false ? '<button class="btn kucuk" data-act="planla">Ders planla</button>' : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>` : '<div class="bos">Henüz eşleştirme yok.</div>'}`;

  el.onclick = e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'yeni') return eslesmeFormu(null);
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (!id) return;
    const es = DB.get('eslesmeler', id);
    if (!yetkili.includes(es.ogretmenId)) return;
    if (act === 'planla') {
      const kat = kategoriBul(es.kategoriId);
      return dersFormu(null, { eslesmeId: es.id, tarih: bugun(), ...(kat?.varsayilanSure ? { sure: kat.varsayilanSure } : {}) });
    }
    eslesmeFormu(es);
  };
  el.onchange = e => {
    if (e.target.hasAttribute('data-filtre')) { F.eslesmeOgretmen = e.target.value; render(); }
  };
}

function eslesmeFormu(es) {
  const u = Oturum.kullanici();
  const yetkili = yetkiliOgretmenIdleri(u);
  const v = es || { ogrenciId: '', kategoriId: '', ogretmenId: u.id, haftalikHedef: 1, ucret: '', baslangic: bugun(), aktif: true, notlar: '' };
  const ogrenciler = DB.list('ogrenciler').filter(o => !o.pasif || o.id === v.ogrenciId).sort((a, b) => trSirala(a.ad, b.ad));
  const kategoriler = DB.list('kategoriler').slice().sort((a, b) => trSirala(a.ad, b.ad));
  const ogretmenler = DB.list('ogretmenler').filter(t => yetkili.includes(t.id) && (!t.pasif || t.id === v.ogretmenId)).sort((a, b) => trSirala(a.ad, b.ad));
  if (!ogrenciler.length || !kategoriler.length) {
    return modal({ baslik: 'Eksik tanımlama', icerik: `<p>Eşleştirme için önce ${!ogrenciler.length ? '<b>öğrenci</b>' : ''}${!ogrenciler.length && !kategoriler.length ? ' ve ' : ''}${!kategoriler.length ? '<b>kategori</b>' : ''} tanımlanmalı.</p>` });
  }
  const butonlar = [{ ad: 'Vazgeç' }, {
    ad: 'Kaydet', sinif: 'birincil', tik: g => {
      const f = formOku(g);
      if (!f.ogrenciId || !f.kategoriId || !f.ogretmenId) return hataGoster(g, 'Öğrenci, kategori ve öğretmen zorunludur.');
      const ayni = DB.list('eslesmeler').find(x => x.id !== es?.id && x.ogrenciId === f.ogrenciId && x.kategoriId === f.kategoriId && x.ogretmenId === f.ogretmenId);
      if (ayni) return hataGoster(g, 'Bu öğrenci–ders–öğretmen eşleştirmesi zaten var.');
      DB.save('eslesmeler', { ...(es || {}), ...f, haftalikHedef: Number(f.haftalikHedef) || 0, ucret: f.ucret === '' ? '' : Number(f.ucret), aktif: f.aktif !== false });
      bildir(es ? 'Eşleştirme güncellendi' : 'Eşleştirme eklendi');
    },
  }];
  if (es) butonlar.unshift({
    ad: 'Sil', sinif: 'tehlike-cizgi sol', tik: async () => {
      if (await onayKutusu('Bu eşleştirme silinsin mi? Mevcut dersler etkilenmez.', { evet: 'Sil', tehlike: true })) { DB.remove('eslesmeler', es.id); bildir('Eşleştirme silindi'); }
    },
  });
  modal({
    baslik: es ? 'Eşleştirmeyi düzenle' : 'Yeni eşleştirme',
    genis: true,
    butonlar,
    icerik: `<form class="form" onsubmit="return false">
      <label>Öğrenci *<select name="ogrenciId">${secenekler(ogrenciler, v.ogrenciId, { bos: '— Seçin —' })}</select></label>
      <label>Ders (kategori) *<select name="kategoriId">${secenekler(kategoriler, v.kategoriId, { bos: '— Seçin —' })}</select></label>
      <label>Öğretmen *<select name="ogretmenId">${secenekler(ogretmenler, v.ogretmenId)}</select></label>
      <label>Haftalık ders hedefi<input name="haftalikHedef" type="number" min="0" max="14" value="${esc(v.haftalikHedef)}"></label>
      <label>Öğrenciye özel ders başı ücret (₺)<input name="ucret" type="number" min="0" step="any" value="${esc(v.ucret ?? '')}" placeholder="Boşsa kategori ücreti"></label>
      <label>Başlangıç tarihi<input name="baslangic" type="date" value="${esc(v.baslangic || '')}"></label>
      <label class="tam">Notlar<textarea name="notlar" rows="2">${esc(v.notlar || '')}</textarea></label>
      <label class="tam onay-satir"><input type="checkbox" name="aktif" ${v.aktif !== false ? 'checked' : ''}> Aktif</label>
    </form>`,
  });
}
