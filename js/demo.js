'use strict';
// Denemek için örnek veri seti: bugünün iki hafta öncesi ve sonrası.

function demoYukle() {
  const ogr = (id, ad, sinif, veli, telefon) => ({ id, ad, sinif, veli, telefon, veliTelefon: '', eposta: '', okul: '', notlar: '', pasif: false });
  const veri = {
    ayarlar: { kurumAdi: 'Demo Özel Ders', onaySureci: true, gunBasi: 9, gunSonu: 21, haftaBasi: 1, varsayilanSure: 60 },
    ogretmenler: [
      { id: 't1', ad: 'Elif Kaya', rol: 'yonetici', sorumluId: null, brans: 'İngilizce', telefon: '0555 000 00 01', eposta: '', renk: '#4f46e5' },
      { id: 't2', ad: 'Mert Demir', rol: 'ogretmen', sorumluId: 't1', brans: 'Matematik', telefon: '0555 000 00 02', eposta: '', renk: '#059669' },
      { id: 't3', ad: 'Zeynep Arslan', rol: 'ogretmen', sorumluId: 't2', brans: 'Fizik / Matematik', telefon: '0555 000 00 03', eposta: '', renk: '#d97706' },
    ],
    ogrenciler: [
      ogr('o1', 'Ali Yılmaz', '11. sınıf', 'Ayten Yılmaz', '0532 111 11 11'),
      ogr('o2', 'Ayşe Demir', '8. sınıf', 'Hakan Demir', '0532 222 22 22'),
      ogr('o3', 'Can Öztürk', '12. sınıf', 'Selin Öztürk', '0532 333 33 33'),
      ogr('o4', 'Deniz Şahin', '6. sınıf', 'Murat Şahin', '0532 444 44 44'),
      ogr('o5', 'Ece Kılıç', 'Hazırlık', 'Nur Kılıç', '0532 555 55 55'),
    ],
    kategoriler: [
      { id: 'k1', ad: 'Matematik', renk: '#2563eb', varsayilanSure: 60, ucret: 800, aciklama: '' },
      { id: 'k2', ad: 'Fizik', renk: '#7c3aed', varsayilanSure: 60, ucret: 850, aciklama: '' },
      { id: 'k3', ad: 'İngilizce', renk: '#db2777', varsayilanSure: 45, ucret: 700, aciklama: '' },
      { id: 'k4', ad: 'Türkçe', renk: '#0d9488', varsayilanSure: 60, ucret: 650, aciklama: '' },
    ],
    eslesmeler: [
      { id: 'e1', ogrenciId: 'o1', kategoriId: 'k1', ogretmenId: 't2', haftalikHedef: 2, ucret: '', baslangic: '', aktif: true, notlar: '' },
      { id: 'e2', ogrenciId: 'o1', kategoriId: 'k2', ogretmenId: 't3', haftalikHedef: 1, ucret: 900, baslangic: '', aktif: true, notlar: '' },
      { id: 'e3', ogrenciId: 'o2', kategoriId: 'k3', ogretmenId: 't1', haftalikHedef: 2, ucret: '', baslangic: '', aktif: true, notlar: '' },
      { id: 'e4', ogrenciId: 'o3', kategoriId: 'k1', ogretmenId: 't3', haftalikHedef: 2, ucret: '', baslangic: '', aktif: true, notlar: '' },
      { id: 'e5', ogrenciId: 'o4', kategoriId: 'k4', ogretmenId: 't2', haftalikHedef: 1, ucret: '', baslangic: '', aktif: true, notlar: '' },
      { id: 'e6', ogrenciId: 'o5', kategoriId: 'k3', ogretmenId: 't1', haftalikHedef: 1, ucret: 600, baslangic: '', aktif: true, notlar: '' },
    ],
    dersler: [],
  };
  // [eşleştirme, haftanın günü (0=Paz), saat, konu]
  const program = [
    ['e1', 1, '17:00', 'Türev'], ['e1', 4, '17:00', 'İntegrale giriş'],
    ['e2', 2, '18:00', 'Newton yasaları'],
    ['e3', 3, '16:00', 'Present perfect'], ['e3', 6, '11:00', 'Reading'],
    ['e4', 1, '18:30', 'TYT problemler'], ['e4', 5, '17:00', 'Fonksiyonlar'],
    ['e5', 2, '16:00', 'Paragraf'],
    ['e6', 4, '18:00', 'Speaking'],
  ];
  const simdi = new Date();
  const b = bugun();
  let n = 0;
  for (let i = -14; i <= 14; i++) {
    const g = addDays(simdi, i);
    program.filter(p => p[1] === g.getDay()).forEach(([eId, , saatStr, konu]) => {
      const e = veri.eslesmeler.find(x => x.id === eId);
      const kat = veri.kategoriler.find(k => k.id === e.kategoriId);
      const tarih = ymd(g);
      const d = {
        id: 'd' + (++n), tarih, baslangic: saatStr, sure: kat.varsayilanSure, ogretmenId: e.ogretmenId, ogrenciIdleri: [e.ogrenciId],
        kategoriId: e.kategoriId, eslesmeId: e.id, yer: n % 3 ? 'Online' : 'Öğrencinin evi', konu, plan: '', notlar: '',
        durum: 'planlandi', onay: null, olusturan: e.ogretmenId, gecmis: [{ t: new Date().toISOString(), kim: e.ogretmenId, metin: 'Ders oluşturuldu' }],
      };
      if (tarih < b) {
        const r = n % 9;
        if (r === 4) Object.assign(d, { durum: 'yapilmadi', durumNotu: 'Öğrenci gelmedi', durumGiren: e.ogretmenId, durumZamani: new Date().toISOString() });
        else if (r === 7) Object.assign(d, { durum: 'ertelendi', durumNotu: 'Okul gezisi', durumGiren: e.ogretmenId, durumZamani: new Date().toISOString() });
        else if (i >= -3 && e.ogretmenId === 't3') Object.assign(d, { onay: 'bekliyor', talep: { durum: 'yapildi', not: 'Konu tamamlandı', kim: 't3', t: new Date().toISOString() } });
        else if (i < -2) Object.assign(d, { durum: 'yapildi', durumNotu: konu + ' işlendi', durumGiren: e.ogretmenId, durumZamani: new Date().toISOString(), onay: 'onaylandi', onaylayan: 't1' });
      }
      veri.dersler.push(d);
    });
  }
  Oturum.giris('t1');
  DB.iceAktar(veri);
  bildir('Demo verileri yüklendi — Elif Kaya (yönetici) olarak giriş yapıldı');
}
