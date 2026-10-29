'use strict';
// Ders listesi ve onaylar sayfaları.

const DersListe = {
  bas: ymd(ayBasi(new Date())), son: ymd(aySonu(new Date())),
  ogretmen: 'ekip', ogrenci: '', kategori: '', durum: '',
};

function derslerView(el, u) {
  const F = DersListe;
  let dersler = dersFiltrele(u, F);
  // "Durumu girilmemiş" filtresinde tarih aralığı yok sayılır.
  if (F.durum !== 'geciken') dersler = dersler.filter(d => (!F.bas || d.tarih >= F.bas) && (!F.son || d.tarih <= F.son));
  dersler.sort(dersSirala);
  const say = k => dersler.filter(d => d.durum === k).length;

  el.innerHTML = `
    <div class="sayfa-ust"><h1>Dersler</h1>
      <div class="sag">
        <button class="btn" data-act="csv">CSV indir</button>
        <button class="btn birincil" data-act="yeni">+ Yeni ders</button>
      </div>
    </div>
    <div class="filtreler">
      <label class="filtre"><span>Başlangıç</span><input type="date" data-filtre="bas" value="${F.bas}" ${F.durum === 'geciken' ? 'disabled' : ''}></label>
      <label class="filtre"><span>Bitiş</span><input type="date" data-filtre="son" value="${F.son}" ${F.durum === 'geciken' ? 'disabled' : ''}></label>
      <div class="filtre"><span>&nbsp;</span><div class="segment kucuk">
        <button data-aralik="hafta">Bu hafta</button><button data-aralik="ay">Bu ay</button><button data-aralik="gecenay">Geçen ay</button>
      </div></div>
      ${filtreCubugu(u, F)}
    </div>
    <div class="ozet-satir">
      <span><b>${dersler.length}</b> ders</span>
      ${Object.keys(DURUMLAR).map(k => `<span class="rozet-d s-${k}">${DURUMLAR[k].ikon} ${say(k)}</span>`).join('')}
      <span class="rozet-d s-bekliyor">⏳ ${dersler.filter(d => d.onay === 'bekliyor').length}</span>
    </div>
    ${dersler.length ? `<div class="tablo-kap"><table class="tablo tikla">
      <thead><tr><th>Tarih</th><th>Saat</th><th>Öğrenci</th><th>Kategori</th><th>Öğretmen</th><th>Konu</th><th>Durum</th><th></th></tr></thead>
      <tbody>${dersler.map(d => {
        const kat = kategoriBul(d.kategoriId);
        const hizli = dersDuzenleyebilir(u, d) && d.durum === 'planlandi' && d.onay !== 'bekliyor';
        return `<tr data-ders="${d.id}" class="${dersGecikmis(d) ? 'geciken' : ''}">
          <td class="nw">${tarihKisa(d.tarih)} <span class="soluk">${TR_GUN_KISA[parseYmd(d.tarih).getDay()]}</span></td>
          <td class="nw">${d.baslangic}–${saat(dersBitis(d))}</td>
          <td>${esc(ogrenciAdlari(d.ogrenciIdleri))}</td>
          <td><span class="nokta" style="--c:${esc(kat?.renk || '#64748b')}"></span>${esc(kat?.ad || '—')}</td>
          <td>${esc(ogretmenAdi(d.ogretmenId))}</td>
          <td class="kirp">${esc(d.konu || '')}</td>
          <td class="nw">${durumRozet(d)}</td>
          <td class="nw sag-hiza">${hizli ? `<button class="btn kucuk s-yapildi" data-hizli="yapildi" title="Yapıldı olarak işaretle">✓</button><button class="btn kucuk" data-hizli="diger" title="Diğer durumlar">…</button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table></div>` : '<div class="bos">Bu filtrelere uyan ders yok.</div>'}`;

  el.onclick = e => {
    const ar = e.target.closest('[data-aralik]')?.dataset.aralik;
    if (ar) {
      const n = new Date();
      if (ar === 'hafta') { const b = haftaBasi(n, DB.ayarlar().haftaBasi); F.bas = ymd(b); F.son = ymd(addDays(b, 6)); }
      if (ar === 'ay') { F.bas = ymd(ayBasi(n)); F.son = ymd(aySonu(n)); }
      if (ar === 'gecenay') { const g = new Date(n.getFullYear(), n.getMonth() - 1, 1); F.bas = ymd(g); F.son = ymd(aySonu(g)); }
      if (F.durum === 'geciken') F.durum = '';
      return render();
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'yeni') return dersFormu(null, {});
    if (act === 'csv') return dersCsv(dersler);
    const satir = e.target.closest('[data-ders]');
    if (!satir) return;
    const d = DB.get('dersler', satir.dataset.ders);
    const hizli = e.target.closest('[data-hizli]')?.dataset.hizli;
    if (hizli === 'yapildi') {
      const r = durumBildir(d, u, { durum: 'yapildi', not: '' });
      return bildir(r === 'bekliyor' ? 'Onaya gönderildi' : 'Yapıldı olarak işaretlendi');
    }
    if (hizli === 'diger') return durumModal(d, 'yapilmadi');
    dersDetay(d.id);
  };
  el.onchange = e => {
    const f = e.target.dataset.filtre;
    if (f) { F[f] = e.target.value; render(); }
  };
}

function dersCsv(dersler) {
  const satirlar = [['Tarih', 'Başlangıç', 'Bitiş', 'Süre (dk)', 'Öğretmen', 'Öğrenci(ler)', 'Kategori', 'Yer', 'Konu', 'Ders planı', 'Durum', 'Onay', 'Durum notu']];
  dersler.forEach(d => satirlar.push([
    tarihKisa(d.tarih), d.baslangic, saat(dersBitis(d)), d.sure, ogretmenAdi(d.ogretmenId), ogrenciAdlari(d.ogrenciIdleri),
    kategoriBul(d.kategoriId)?.ad || '', d.yer || '', d.konu || '', d.plan || '', DURUMLAR[d.durum].ad,
    { bekliyor: 'Bekliyor', onaylandi: 'Onaylandı', reddedildi: 'Reddedildi' }[d.onay] || '', d.durumNotu || '',
  ]));
  dosyaIndir(`dersler-${bugun()}.csv`, csvYap(satirlar), 'text/csv;charset=utf-8');
}

function onaylarView(el, u) {
  const ayar = DB.ayarlar();
  const bekleyen = onayBekleyenler(u).sort(dersSirala);
  const benim = DB.list('dersler').filter(d => d.onay === 'bekliyor' && d.talep?.kim === u.id && !bekleyen.includes(d)).sort(dersSirala);
  const reddedilen = DB.list('dersler').filter(d => d.onay === 'reddedildi' && dersDuzenleyebilir(u, d)).sort(dersSirala).reverse().slice(0, 20);

  const kart = (d, butonlu) => `
    <div class="onay-kart" data-ders="${d.id}">
      <div class="ok-sol">
        <div><b>${esc(ogrenciAdlari(d.ogrenciIdleri))}</b> · ${esc(kategoriBul(d.kategoriId)?.ad || '')}</div>
        <div class="soluk">${esc(tarihYaz(d.tarih, true))} ${d.baslangic} · Öğretmen: ${esc(ogretmenAdi(d.ogretmenId))}</div>
        ${d.talep ? `<div>${esc(ogretmenAdi(d.talep.kim))} bildirdi: ${durumRozetTalep(d.talep)}${d.talep.yeniTarih ? ` → ${tarihKisa(d.talep.yeniTarih)} ${d.talep.yeniSaat || ''}` : ''}</div>
          ${d.talep.not ? `<div class="soluk">“${esc(d.talep.not)}”</div>` : ''}` : ''}
        ${d.onay === 'reddedildi' ? `<div class="soluk">Red nedeni: ${esc(d.redNedeni || '—')}</div>` : ''}
      </div>
      <div class="ok-sag">
        <button class="btn" data-act="detay">Detay</button>
        ${butonlu ? `<button class="btn tehlike-cizgi" data-act="reddet">Reddet</button><button class="btn birincil" data-act="onayla">Onayla</button>` : ''}
      </div>
    </div>`;

  el.innerHTML = `
    <div class="sayfa-ust"><h1>Onaylar</h1>
      ${bekleyen.length > 1 ? `<div class="sag"><button class="btn birincil" data-act="tumu">Tümünü onayla (${bekleyen.length})</button></div>` : ''}
    </div>
    ${!ayar.onaySureci ? `<div class="kutu bilgi">Onay süreci şu anda <b>kapalı</b>: öğretmenlerin bildirdiği durumlar doğrudan işlenir.
      ${yoneticiMi(u) ? '<a href="#/ayarlar">Ayarlar</a>’dan açabilirsiniz.' : 'Yönetici Ayarlar’dan açabilir.'}</div>` : ''}
    <h2 class="bolum">Onayınızı bekleyenler</h2>
    ${bekleyen.length ? bekleyen.map(d => kart(d, true)).join('') : '<div class="bos">Onayınızı bekleyen bildirim yok.</div>'}
    ${benim.length ? `<h2 class="bolum">Gönderdiğiniz, onay bekleyen bildirimler</h2>${benim.map(d => kart(d, false)).join('')}` : ''}
    ${reddedilen.length ? `<h2 class="bolum">Reddedilen bildirimler</h2>${reddedilen.map(d => kart(d, false)).join('')}` : ''}`;

  el.onclick = async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'tumu') {
      if (await onayKutusu(`${bekleyen.length} bildirimin tümü onaylansın mı?`, { evet: 'Tümünü onayla' })) {
        DB.tx(() => bekleyen.forEach(d => talebiOnayla(d, u)));
        bildir(`${bekleyen.length} bildirim onaylandı`);
      }
      return;
    }
    const id = e.target.closest('[data-ders]')?.dataset.ders;
    if (!id) return;
    const d = DB.get('dersler', id);
    if (act === 'onayla') { talebiOnayla(d, u); return bildir('Onaylandı'); }
    if (act === 'reddet') return reddetModal(d);
    dersDetay(id);
  };
}

function durumRozetTalep(talep) {
  return `<span class="rozet-d s-${talep.durum}">${DURUMLAR[talep.durum].ikon} ${DURUMLAR[talep.durum].ad}</span>`;
}
