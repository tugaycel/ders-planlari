'use strict';
// Raporlar ve ayarlar sayfaları.

const Rapor = { bas: ymd(ayBasi(new Date())), son: ymd(aySonu(new Date())) };

function raporTablosu(dersler, anahtarlar, adBul, tutarBul) {
  const satirlar = new Map();
  dersler.forEach(d => anahtarlar(d).forEach(k => {
    if (!satirlar.has(k)) satirlar.set(k, { ad: adBul(k), toplam: 0, planlandi: 0, yapildi: 0, yapilmadi: 0, ertelendi: 0, bekliyor: 0, dakika: 0, tutar: 0 });
    const s = satirlar.get(k);
    s.toplam++;
    s[d.durum]++;
    if (d.onay === 'bekliyor') s.bekliyor++;
    if (d.durum === 'yapildi') { s.dakika += Number(d.sure) || 0; s.tutar += tutarBul(d, k); }
  }));
  return [...satirlar.values()].sort((a, b) => trSirala(a.ad, b.ad));
}

const RAPOR_SUTUNLARI = [['toplam', 'Toplam'], ['yapildi', 'Yapıldı'], ['yapilmadi', 'Yapılmadı'], ['ertelendi', 'Ertelendi'], ['planlandi', 'Planlı'], ['bekliyor', 'Onay bekl.']];

function raporHtml(id, baslik, satirlar) {
  if (!satirlar.length) return '';
  const top = k => satirlar.reduce((t, s) => t + s[k], 0);
  return `<section class="rapor-bolum">
    <div class="bolum-ust"><h2 class="bolum">${baslik}</h2><button class="btn kucuk" data-csv="${id}">CSV</button></div>
    <div class="tablo-kap"><table class="tablo">
      <thead><tr><th>${baslik.split(' ')[0]}</th>${RAPOR_SUTUNLARI.map(([, a]) => `<th class="sag-hiza">${a}</th>`).join('')}<th class="sag-hiza">Yapılan süre</th><th class="sag-hiza">Gerçekleşme</th><th class="sag-hiza">Tutar</th></tr></thead>
      <tbody>${satirlar.map(s => `<tr><td>${esc(s.ad)}</td>${RAPOR_SUTUNLARI.map(([k]) => `<td class="sag-hiza">${s[k] || ''}</td>`).join('')}
        <td class="sag-hiza nw">${sureYaz(s.dakika)}</td><td class="sag-hiza">${oran(s)}</td><td class="sag-hiza nw">${paraYaz(s.tutar)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th>Toplam</th>${RAPOR_SUTUNLARI.map(([k]) => `<th class="sag-hiza">${top(k)}</th>`).join('')}
        <th class="sag-hiza nw">${sureYaz(top('dakika'))}</th><th class="sag-hiza">${oran({ yapildi: top('yapildi'), yapilmadi: top('yapilmadi'), ertelendi: top('ertelendi') })}</th><th class="sag-hiza nw">${paraYaz(top('tutar'))}</th></tr></tfoot>
    </table></div></section>`;
}

// Gerçekleşme: yapılan / (yapılan + yapılmayan + ertelenen)
function oran(s) {
  const n = s.yapildi + s.yapilmadi + s.ertelendi;
  return n ? `%${Math.round(s.yapildi / n * 100)}` : '—';
}

function raporlarView(el, u) {
  const F = Rapor;
  const yetkili = yetkiliOgretmenIdleri(u);
  const dersler = DB.list('dersler').filter(d => yetkili.includes(d.ogretmenId) && (!F.bas || d.tarih >= F.bas) && (!F.son || d.tarih <= F.son));
  const tumOgrUcret = d => (d.ogrenciIdleri || []).reduce((t, o) => t + dersUcreti(d, o), 0);
  const tablolar = {
    ogretmen: ['Öğretmen bazında', raporTablosu(dersler, d => [d.ogretmenId], ogretmenAdi, tumOgrUcret)],
    ogrenci: ['Öğrenci bazında', raporTablosu(dersler, d => d.ogrenciIdleri || [], id => DB.get('ogrenciler', id)?.ad || '?', (d, o) => dersUcreti(d, o))],
    kategori: ['Kategori bazında', raporTablosu(dersler, d => [d.kategoriId || ''], id => kategoriBul(id)?.ad || 'Kategorisiz', tumOgrUcret)],
  };

  el.innerHTML = `
    <div class="sayfa-ust"><h1>Raporlar</h1></div>
    <div class="filtreler">
      <label class="filtre"><span>Başlangıç</span><input type="date" data-f="bas" value="${F.bas}"></label>
      <label class="filtre"><span>Bitiş</span><input type="date" data-f="son" value="${F.son}"></label>
      <div class="filtre"><span>&nbsp;</span><div class="segment kucuk">
        <button data-aralik="hafta">Bu hafta</button><button data-aralik="ay">Bu ay</button><button data-aralik="gecenay">Geçen ay</button><button data-aralik="yil">Bu yıl</button>
      </div></div>
    </div>
    ${!yoneticiMi(u) ? '<p class="soluk aciklama">Yalnızca sizin ve ekibinizin dersleri raporlanır.</p>' : ''}
    <p class="soluk aciklama">Tutar, yalnızca <b>yapıldı</b> durumundaki dersler için hesaplanır (öğrenciye özel ücret, yoksa kategori ücreti).</p>
    ${dersler.length ? Object.entries(tablolar).map(([id, [b, s]]) => raporHtml(id, b, s)).join('') : '<div class="bos">Bu tarih aralığında ders yok.</div>'}`;

  el.onclick = e => {
    const ar = e.target.closest('[data-aralik]')?.dataset.aralik;
    if (ar) {
      const n = new Date();
      if (ar === 'hafta') { const b = haftaBasi(n, DB.ayarlar().haftaBasi); F.bas = ymd(b); F.son = ymd(addDays(b, 6)); }
      if (ar === 'ay') { F.bas = ymd(ayBasi(n)); F.son = ymd(aySonu(n)); }
      if (ar === 'gecenay') { const g = new Date(n.getFullYear(), n.getMonth() - 1, 1); F.bas = ymd(g); F.son = ymd(aySonu(g)); }
      if (ar === 'yil') { F.bas = `${n.getFullYear()}-01-01`; F.son = `${n.getFullYear()}-12-31`; }
      return render();
    }
    const csv = e.target.closest('[data-csv]')?.dataset.csv;
    if (csv) {
      const [baslik, satirlar] = tablolar[csv];
      const veri = [[baslik.split(' ')[0], ...RAPOR_SUTUNLARI.map(([, a]) => a), 'Yapılan süre (dk)', 'Gerçekleşme', 'Tutar (TL)'],
        ...satirlar.map(s => [s.ad, ...RAPOR_SUTUNLARI.map(([k]) => s[k]), s.dakika, oran(s), s.tutar.toFixed(2).replace('.', ',')])];
      dosyaIndir(`rapor-${csv}-${F.bas}_${F.son}.csv`, csvYap(veri), 'text/csv;charset=utf-8');
    }
  };
  el.onchange = e => {
    const f = e.target.dataset.f;
    if (f) { F[f] = e.target.value; render(); }
  };
}

// ---------------------------------------------------------------- Ayarlar

function ayarlarView(el, u) {
  const a = DB.ayarlar();
  const yon = yoneticiMi(u);
  const sayilar = ['ogretmenler', 'ogrenciler', 'kategoriler', 'eslesmeler', 'dersler'].map(k => `${DB.list(k).length} ${{ ogretmenler: 'öğretmen', ogrenciler: 'öğrenci', kategoriler: 'kategori', eslesmeler: 'eşleştirme', dersler: 'ders' }[k]}`).join(' · ');
  el.innerHTML = `
    <div class="sayfa-ust"><h1>Ayarlar</h1></div>
    ${yon ? `<section class="panel">
      <h2 class="bolum">Genel</h2>
      <form class="form" id="ayar-form" onsubmit="return false">
        <label class="tam">Kurum / program adı<input name="kurumAdi" value="${esc(a.kurumAdi)}"></label>
        <label>Takvim başlangıç saati<input name="gunBasi" type="number" min="0" max="23" value="${a.gunBasi}"></label>
        <label>Takvim bitiş saati<input name="gunSonu" type="number" min="1" max="24" value="${a.gunSonu}"></label>
        <label>Hafta başlangıcı<select name="haftaBasi"><option value="1" ${a.haftaBasi === 1 ? 'selected' : ''}>Pazartesi</option><option value="0" ${a.haftaBasi === 0 ? 'selected' : ''}>Pazar</option></select></label>
        <label>Varsayılan ders süresi (dk)<input name="varsayilanSure" type="number" min="5" step="5" value="${a.varsayilanSure}"></label>
        <label class="tam onay-satir buyuk"><input type="checkbox" name="onaySureci" ${a.onaySureci ? 'checked' : ''}>
          <span><b>Onay süreci</b><br><small class="soluk">Açıkken, öğretmenlerin “yapıldı / yapılmadı / ertelendi” bildirimleri sorumlu öğretmen ya da yönetici onaylayana kadar işlenmez. Sorumlunun kendi girdiği bildirimler doğrudan işlenir.</small></span></label>
        <div class="tam"><button class="btn birincil" data-act="kaydet">Ayarları kaydet</button></div>
      </form>
    </section>` : ''}
    <section class="panel">
      <h2 class="bolum">Veriler</h2>
      <p class="soluk">Tüm veriler <b>bu cihazdaki tarayıcıda</b> saklanır (${sayilar}). Tarayıcı verilerini temizlemek kayıtları siler; düzenli yedek alın. Yedek dosyasını başka bir cihaza yükleyerek verileri taşıyabilirsiniz.</p>
      <div class="buton-satir">
        <button class="btn" data-act="yedek">⬇ Yedek indir (JSON)</button>
        ${yon ? `<label class="btn">⬆ Yedekten geri yükle<input type="file" accept=".json,application/json" data-act="geriyukle" hidden></label>` : ''}
      </div>
      ${yon ? `<div class="buton-satir tehlike-alan">
        <button class="btn" data-act="demo">Demo verilerini yükle</button>
        <button class="btn tehlike" data-act="sifirla">Tüm verileri sil</button>
      </div>` : ''}
    </section>`;

  el.onclick = async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'kaydet') {
      const f = formOku($('#ayar-form', el));
      const gunBasi = Math.min(23, Math.max(0, Number(f.gunBasi) || 0));
      const gunSonu = Math.min(24, Math.max(gunBasi + 1, Number(f.gunSonu) || 24));
      DB.ayarKaydet({ kurumAdi: f.kurumAdi || 'Özel Ders Programı', gunBasi, gunSonu, haftaBasi: Number(f.haftaBasi), varsayilanSure: Number(f.varsayilanSure) || 60, onaySureci: !!f.onaySureci });
      return bildir('Ayarlar kaydedildi');
    }
    if (act === 'yedek') return dosyaIndir(`ozel-ders-yedek-${bugun()}.json`, DB.disaAktar(), 'application/json');
    if (act === 'demo') {
      if (await onayKutusu('Mevcut tüm veriler silinip yerine demo verileri yüklenecek. Devam edilsin mi?', { evet: 'Demo yükle', tehlike: true })) demoYukle();
      return;
    }
    if (act === 'sifirla') {
      if (await onayKutusu('Bu cihazdaki <b>tüm veriler kalıcı olarak silinecek</b>. Önce yedek almanız önerilir. Devam edilsin mi?', { evet: 'Tümünü sil', tehlike: true })) {
        DB.sifirla();
        Oturum.cikis();
      }
    }
  };
  el.onchange = async e => {
    if (e.target.dataset.act !== 'geriyukle' || !e.target.files[0]) return;
    const dosya = e.target.files[0];
    e.target.value = '';
    try {
      const metin = await dosya.text();
      JSON.parse(metin);
      if (await onayKutusu(`“${esc(dosya.name)}” yüklenecek ve <b>mevcut veriler bununla değiştirilecek</b>. Devam edilsin mi?`, { evet: 'Geri yükle', tehlike: true })) {
        DB.iceAktar(metin);
        if (!Oturum.kullanici()) Oturum.cikis();
        bildir('Yedek geri yüklendi');
        render();
      }
    } catch (err) {
      bildir('Dosya okunamadı: ' + err.message, 'hata');
    }
  };
}
