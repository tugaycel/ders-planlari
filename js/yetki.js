'use strict';
// Oturum ve yetki kuralları.
//  - Yönetici: her şeyi görür/düzenler, tüm onayları verebilir.
//  - Öğretmen: kendi derslerini ve sorumlusu olduğu öğretmenlerin (alt ekibinin)
//    derslerini girebilir. Ekibinin bildirimlerini onaylayabilir.

// durum: yukleniyor | giris | kurulum | hazir | hata  (js/bulut.js günceller)
const Oturum = {
  durum: 'yukleniyor',
  hata: '',
  eposta: '',
  ogretmenId: null,
  davetVar: false,
  kullanici() { return this.ogretmenId ? DB.get('ogretmenler', this.ogretmenId) || null : null; },
  cikis() { window.Bulut?.cikis(); },
};

function yoneticiMi(u) { return !!u && u.rol === 'yonetici'; }
function rolAdi(t) { return t.rol === 'yonetici' ? 'Yönetici' : 'Öğretmen'; }

// u'nun doğrudan ya da dolaylı olarak sorumlu olduğu öğretmenler (kendisi hariç).
function ekipIdleri(u) {
  const hepsi = DB.list('ogretmenler');
  const sonuc = new Set();
  const yigin = [u.id];
  while (yigin.length) {
    const simdiki = yigin.pop();
    hepsi.forEach(t => {
      if (t.sorumluId === simdiki && t.id !== u.id && !sonuc.has(t.id)) { sonuc.add(t.id); yigin.push(t.id); }
    });
  }
  return [...sonuc];
}

function yetkiliOgretmenIdleri(u) {
  if (!u) return [];
  if (yoneticiMi(u)) return DB.list('ogretmenler').map(t => t.id);
  return [u.id, ...ekipIdleri(u)];
}

function dersDuzenleyebilir(u, ders) { return yetkiliOgretmenIdleri(u).includes(ders.ogretmenId); }

function dersOnaylayabilir(u, ders) {
  if (!u) return false;
  if (yoneticiMi(u)) return true;
  return ders.ogretmenId !== u.id && ekipIdleri(u).includes(ders.ogretmenId);
}

// Onay süreci açıksa, onay yetkisi olmayan kişinin durum bildirimi onaya düşer.
function onayGerekli(u, ders) { return !!DB.ayarlar().onaySureci && !dersOnaylayabilir(u, ders); }

function onayBekleyenler(u) {
  return DB.list('dersler').filter(d => d.onay === 'bekliyor' && dersOnaylayabilir(u, d));
}
