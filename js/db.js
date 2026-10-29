'use strict';
// Veri katmanı. Uygulama verileri bellekteki bir önbellekten okur (eşzamanlı);
// yazmalar önbelleğe hemen işlenir ve bağlı arka uca (Firebase, js/bulut.js) gönderilir.
// Arka uçtan gelen değişiklikler _degisiklikleriUygula ile önbelleğe yansır.

const KOLEKSIYONLAR = ['ogretmenler', 'ogrenciler', 'kategoriler', 'eslesmeler', 'dersler'];

const DB = (() => {
  const varsayilanAyarlar = () => ({
    kurumAdi: 'Ders Planları',
    onaySureci: false,
    gunBasi: 8,
    gunSonu: 22,
    haftaBasi: 1,
    varsayilanSure: 60,
  });
  const bos = () => ({ ayarlar: varsayilanAyarlar(), ogretmenler: [], ogrenciler: [], kategoriler: [], eslesmeler: [], dersler: [] });

  let veri = bos();
  let arka = null;
  const dinleyiciler = new Set();
  let islemDerinligi = 0;
  let kirli = false;

  function haberVer() {
    if (islemDerinligi) { kirli = true; return; }
    dinleyiciler.forEach(f => f());
  }
  // Firestore undefined değer kabul etmez; JSON gidiş-dönüşü bunları ayıklar.
  const temiz = n => JSON.parse(JSON.stringify(n));
  // Açık pencerelerdeki nesne referansları bozulmasın diye nesneyi yerinde günceller.
  function yerindeGuncelle(hedef, kaynak) {
    Object.keys(hedef).forEach(k => { if (!(k in kaynak)) delete hedef[k]; });
    Object.assign(hedef, kaynak);
  }

  function normallestir(d) {
    const sonuc = bos();
    sonuc.ayarlar = { ...sonuc.ayarlar, ...(d.ayarlar || {}) };
    KOLEKSIYONLAR.forEach(k => { sonuc[k] = Array.isArray(d[k]) ? d[k].filter(x => x && x.id) : []; });
    return sonuc;
  }

  return {
    varsayilanAyarlar,
    yeniId: () => uid(),
    ayarlar: () => veri.ayarlar,
    ayarKaydet(degisiklik) {
      Object.assign(veri.ayarlar, degisiklik);
      arka?.ayarYaz(temiz(veri.ayarlar));
      haberVer();
    },
    list: k => veri[k],
    get: (k, id) => veri[k].find(x => x.id === id),
    save(k, nesne) {
      const simdi = new Date().toISOString();
      if (!nesne.id) { nesne.id = uid(); nesne.olusturma = simdi; }
      nesne.guncelleme = simdi;
      const i = veri[k].findIndex(x => x.id === nesne.id);
      if (i >= 0) veri[k][i] = nesne; else veri[k].push(nesne);
      arka?.yaz(k, temiz(nesne));
      haberVer();
      return nesne;
    },
    remove(k, id) {
      veri[k] = veri[k].filter(x => x.id !== id);
      arka?.sil(k, id);
      haberVer();
    },
    // Birden çok değişikliği tek ekran yenilemesiyle yapar.
    tx(fn) {
      islemDerinligi++;
      try { return fn(); } finally {
        islemDerinligi--;
        if (!islemDerinligi && kirli) { kirli = false; haberVer(); }
      }
    },
    disaAktar: () => JSON.stringify({ surum: 1, ...veri }, null, 2),
    // Tüm verileri verilen yedekle değiştirir.
    async iceAktar(metinYaDaNesne) {
      const d = typeof metinYaDaNesne === 'string' ? JSON.parse(metinYaDaNesne) : metinYaDaNesne;
      if (!d || !Array.isArray(d.ogretmenler)) throw new Error('Geçersiz yedek dosyası');
      const yeni = normallestir(d);
      await arka?.hepsiniDegistir(veri, temiz(yeni));
      veri = yeni;
      haberVer();
    },
    async sifirla() {
      const yeni = bos();
      yeni.ayarlar = veri.ayarlar;
      yeni.ogretmenler = veri.ogretmenler;
      await arka?.hepsiniDegistir(veri, temiz(yeni));
      veri = yeni;
      haberVer();
    },
    onChange(f) { dinleyiciler.add(f); },

    // --- Arka uç tarafından kullanılır ---
    _baglan(a) { arka = a; },
    _temizle() { veri = bos(); },
    _ayarlarUygula(a) { veri.ayarlar = { ...varsayilanAyarlar(), ...a }; haberVer(); },
    _degisiklikleriUygula(k, degisiklikler) {
      const liste = veri[k];
      degisiklikler.forEach(({ tur, id, belge }) => {
        const i = liste.findIndex(x => x.id === id);
        if (tur === 'removed') { if (i >= 0) liste.splice(i, 1); return; }
        const n = { ...belge, id };
        if (i >= 0) yerindeGuncelle(liste[i], n); else liste.push(n);
      });
      haberVer();
    },
  };
})();
