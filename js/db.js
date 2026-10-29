'use strict';
// Depolama katmanı. Şimdilik tarayıcının localStorage'ını kullanır.
// İleride sunucuya geçerken yalnızca bu dosyanın içi değişmelidir;
// uygulamanın geri kalanı sadece DB.* fonksiyonlarını kullanır.

const DB = (() => {
  const ANAHTAR = 'ozelders.veri.v1';
  const KOLEKSIYONLAR = ['ogretmenler', 'ogrenciler', 'kategoriler', 'eslesmeler', 'dersler'];

  const varsayilan = () => ({
    surum: 1,
    ayarlar: {
      kurumAdi: 'Özel Ders Programı',
      onaySureci: false,
      gunBasi: 8,
      gunSonu: 22,
      haftaBasi: 1,
      varsayilanSure: 60,
    },
    ogretmenler: [], ogrenciler: [], kategoriler: [], eslesmeler: [], dersler: [],
  });

  function normallestir(d) {
    const temel = varsayilan();
    const sonuc = { ...temel, ...d, ayarlar: { ...temel.ayarlar, ...(d.ayarlar || {}) } };
    KOLEKSIYONLAR.forEach(k => { if (!Array.isArray(sonuc[k])) sonuc[k] = []; });
    return sonuc;
  }

  function yukle() {
    try {
      const ham = localStorage.getItem(ANAHTAR);
      return ham ? normallestir(JSON.parse(ham)) : varsayilan();
    } catch (e) {
      console.error('Veri okunamadı', e);
      return varsayilan();
    }
  }

  let veri = yukle();
  const dinleyiciler = new Set();
  let islemDerinligi = 0;
  let kirli = false;

  function kaydet() {
    if (islemDerinligi) { kirli = true; return; }
    try {
      localStorage.setItem(ANAHTAR, JSON.stringify(veri));
    } catch (e) {
      alert('Veriler kaydedilemedi: ' + e.message);
    }
    dinleyiciler.forEach(f => f());
  }

  // Aynı cihazda başka sekmede yapılan değişiklikleri yakala.
  window.addEventListener('storage', e => {
    if (e.key === ANAHTAR) { veri = yukle(); dinleyiciler.forEach(f => f()); }
  });

  return {
    ayarlar: () => veri.ayarlar,
    ayarKaydet(degisiklik) { Object.assign(veri.ayarlar, degisiklik); kaydet(); },
    list: k => veri[k],
    get: (k, id) => veri[k].find(x => x.id === id),
    save(k, nesne) {
      const simdi = new Date().toISOString();
      if (!nesne.id) { nesne.id = uid(); nesne.olusturma = simdi; }
      nesne.guncelleme = simdi;
      const i = veri[k].findIndex(x => x.id === nesne.id);
      if (i >= 0) veri[k][i] = nesne; else veri[k].push(nesne);
      kaydet();
      return nesne;
    },
    remove(k, id) { veri[k] = veri[k].filter(x => x.id !== id); kaydet(); },
    // Birden çok değişikliği tek kayıtla yapar.
    tx(fn) {
      islemDerinligi++;
      try { return fn(); } finally {
        islemDerinligi--;
        if (!islemDerinligi && kirli) { kirli = false; kaydet(); }
      }
    },
    disaAktar: () => JSON.stringify(veri, null, 2),
    iceAktar(metin) {
      const d = typeof metin === 'string' ? JSON.parse(metin) : metin;
      if (!d || !Array.isArray(d.ogretmenler)) throw new Error('Geçersiz yedek dosyası');
      veri = normallestir(d);
      kaydet();
    },
    sifirla() { veri = varsayilan(); kaydet(); },
    onChange(f) { dinleyiciler.add(f); },
  };
})();
