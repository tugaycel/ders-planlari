// Firebase arka ucu: giriş, kurum üyeliği, davetler ve verilerin eşitlenmesi.
// Veri modeli:
//   kullanicilar/{uid}                 -> { kurumId }
//   davetler/{kod}                     -> { kurumId, ogretmenId }
//   kurumlar/{kurumId}                 -> { sahip, ayarlar }
//   kurumlar/{kurumId}/uyeler/{uid}    -> { ogretmenId, eposta }
//   kurumlar/{kurumId}/<koleksiyon>/{id}  (ogretmenler, ogrenciler, kategoriler, eslesmeler, dersler)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Çevrimdışı önbellek: internet kesilse de çalışır, bağlantı gelince eşitlenir.
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

const DAVET_ANAHTARI = 'ozelders.davet';
let kullanici = null;
let kurumId = null;
let abonelikler = [];

// Davet linkiyle gelindiyse kodu sakla (giriş/kayıt sonrasında kullanılır).
const davetEslesme = location.hash.match(/^#davet=([A-Za-z0-9]+)/);
if (davetEslesme) {
  sessionStorage.setItem(DAVET_ANAHTARI, davetEslesme[1]);
  history.replaceState(null, '', location.pathname + location.search);
}

function durum(d, ek = {}) {
  Object.assign(Oturum, { durum: d, hata: '' }, ek);
  render();
}
function aboneligiBitir() {
  abonelikler.forEach(f => f());
  abonelikler = [];
}
function hataMetni(e) {
  const kod = e?.code || '';
  return {
    'auth/invalid-email': 'E-posta adresi geçersiz.',
    'auth/invalid-credential': 'E-posta ya da şifre hatalı.',
    'auth/wrong-password': 'E-posta ya da şifre hatalı.',
    'auth/user-not-found': 'Bu e-postayla kayıtlı hesap yok.',
    'auth/email-already-in-use': 'Bu e-postayla zaten bir hesap var; giriş yapın.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı; biraz sonra tekrar deneyin.',
    'auth/network-request-failed': 'İnternet bağlantısı yok.',
    'permission-denied': 'Bu işlem için yetkiniz yok.',
  }[kod] || e?.message || String(e);
}
const yazmaHatasi = e => {
  console.error(e);
  bildir('Kaydedilemedi: ' + hataMetni(e), 'hata');
};
const kRef = (...yol) => doc(db, 'kurumlar', kurumId, ...yol);

// DB katmanına bağlanan arka uç.
DB._baglan({
  yaz: (k, n) => setDoc(kRef(k, n.id), n).catch(yazmaHatasi),
  sil: (k, id) => deleteDoc(kRef(k, id)).catch(yazmaHatasi),
  ayarYaz: a => updateDoc(doc(db, 'kurumlar', kurumId), { ayarlar: a }).catch(yazmaHatasi),
  hepsiniDegistir: (eski, yeni) => tumunuYaz(kurumId, eski, yeni),
});

// Toplu yazma (bir batch en fazla 500 işlem alır).
async function tumunuYaz(kId, eski, yeni) {
  const islemler = [];
  KOLEKSIYONLAR.forEach(k => {
    const kalan = new Set(yeni[k].map(x => x.id));
    eski[k].forEach(x => { if (!kalan.has(x.id)) islemler.push(b => b.delete(doc(db, 'kurumlar', kId, k, x.id))); });
    yeni[k].forEach(x => islemler.push(b => b.set(doc(db, 'kurumlar', kId, k, x.id), x)));
  });
  islemler.push(b => b.update(doc(db, 'kurumlar', kId), { ayarlar: yeni.ayarlar }));
  for (let i = 0; i < islemler.length; i += 450) {
    const b = writeBatch(db);
    islemler.slice(i, i + 450).forEach(f => f(b));
    await b.commit();
  }
}

async function kurumaBaglan(kId) {
  const uye = await getDoc(doc(db, 'kurumlar', kId, 'uyeler', kullanici.uid));
  if (!uye.exists()) return durum('kurulum', { hata: 'Bu kurumdaki erişiminiz kaldırılmış. Yöneticinizden yeni davet isteyin.' });
  kurumId = kId;
  Oturum.ogretmenId = uye.data().ogretmenId;
  const bekleyen = new Set(['kurum', ...KOLEKSIYONLAR]);
  const yuklendi = ad => { if (bekleyen.delete(ad) && !bekleyen.size) durum('hazir'); };
  const dinlemeHatasi = e => { console.error(e); durum('hata', { hata: hataMetni(e) }); };

  abonelikler.push(onSnapshot(doc(db, 'kurumlar', kId), s => {
    DB._ayarlarUygula(s.data()?.ayarlar || {});
    yuklendi('kurum');
  }, dinlemeHatasi));
  KOLEKSIYONLAR.forEach(k => abonelikler.push(onSnapshot(collection(db, 'kurumlar', kId, k), s => {
    DB._degisiklikleriUygula(k, s.docChanges().map(c => ({ tur: c.type, id: c.doc.id, belge: c.doc.data() })));
    yuklendi(k);
  }, dinlemeHatasi)));
  // Kendi üyeliğimi izle: yönetici erişimi kaldırırsa ya da kimlik değişirse.
  abonelikler.push(onSnapshot(doc(db, 'kurumlar', kId, 'uyeler', kullanici.uid), s => {
    if (!s.exists()) {
      aboneligiBitir();
      DB._temizle();
      return durum('kurulum', { hata: 'Bu kurumdaki erişiminiz kaldırıldı.' });
    }
    Oturum.ogretmenId = s.data().ogretmenId;
    if (!bekleyen.size) render();
  }, () => {}));
}

async function davetKabul(kod) {
  sessionStorage.removeItem(DAVET_ANAHTARI);
  const d = await getDoc(doc(db, 'davetler', kod));
  if (!d.exists()) return durum('kurulum', { hata: 'Davet linki geçersiz ya da daha önce kullanılmış.' });
  const { kurumId: kId, ogretmenId } = d.data();
  await setDoc(doc(db, 'kurumlar', kId, 'uyeler', kullanici.uid), { ogretmenId, eposta: kullanici.email, davetKodu: kod });
  await setDoc(doc(db, 'kullanicilar', kullanici.uid), { kurumId: kId });
  await updateDoc(doc(db, 'kurumlar', kId, 'ogretmenler', ogretmenId), { uid: kullanici.uid, hesapEposta: kullanici.email });
  await deleteDoc(doc(db, 'davetler', kod));
  await kurumaBaglan(kId);
}

onAuthStateChanged(auth, async u => {
  aboneligiBitir();
  DB._temizle();
  kurumId = null;
  kullanici = u;
  Object.assign(Oturum, { eposta: u?.email || '', ogretmenId: null, davetVar: !!sessionStorage.getItem(DAVET_ANAHTARI) });
  if (!u) return durum('giris');
  durum('yukleniyor');
  try {
    const davet = sessionStorage.getItem(DAVET_ANAHTARI);
    const k = (await getDoc(doc(db, 'kullanicilar', u.uid))).data();
    if (davet && !k) return await davetKabul(davet);
    if (davet && k) sessionStorage.removeItem(DAVET_ANAHTARI);
    if (!k) return durum('kurulum');
    await kurumaBaglan(k.kurumId);
  } catch (e) {
    console.error(e);
    durum('hata', { hata: hataMetni(e) });
  }
});

window.Bulut = {
  hataMetni,
  girisYap: (eposta, sifre) => signInWithEmailAndPassword(auth, eposta, sifre),
  kayitOl: (eposta, sifre) => createUserWithEmailAndPassword(auth, eposta, sifre),
  sifreSifirla: eposta => sendPasswordResetEmail(auth, eposta),
  cikis: () => signOut(auth),

  // Yeni kurum kurar; kurucu yönetici olur. demoVeri verilirse onunla doldurulur.
  async kurumOlustur({ kurumAdi, ad, demoVeri }) {
    const yeniRef = doc(collection(db, 'kurumlar'));
    const ayarlar = { ...DB.varsayilanAyarlar(), ...(demoVeri?.ayarlar || {}), ...(kurumAdi ? { kurumAdi } : {}) };
    await setDoc(yeniRef, { sahip: kullanici.uid, ayarlar, olusturma: serverTimestamp() });
    const ogretmenId = demoVeri ? demoVeri.ogretmenler[0].id : uid();
    await setDoc(doc(db, 'kurumlar', yeniRef.id, 'uyeler', kullanici.uid), { ogretmenId, eposta: kullanici.email });
    await setDoc(doc(db, 'kullanicilar', kullanici.uid), { kurumId: yeniRef.id });
    const veri = demoVeri || { ogretmenler: [{ id: ogretmenId, ad, rol: 'yonetici', sorumluId: null, brans: '', telefon: '', eposta: kullanici.email, renk: RENKLER[0] }] };
    const ben = veri.ogretmenler.find(t => t.id === ogretmenId);
    Object.assign(ben, { uid: kullanici.uid, hesapEposta: kullanici.email });
    const bosVeri = { ayarlar, ogretmenler: [], ogrenciler: [], kategoriler: [], eslesmeler: [], dersler: [] };
    await tumunuYaz(yeniRef.id, bosVeri, JSON.parse(JSON.stringify({ ...bosVeri, ...veri, ayarlar })));
    await kurumaBaglan(yeniRef.id);
  },

  davetKoduIleKatil: kod => davetKabul(kod.trim()),

  async davetOlustur(ogretmenId) {
    const harfler = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const kod = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => harfler[b % harfler.length]).join('');
    await setDoc(doc(db, 'davetler', kod), { kurumId, ogretmenId, olusturan: kullanici.uid, t: serverTimestamp() });
    return kod;
  },

  // Oturumdaki kullanıcıyı kurumdaki bir öğretmen kaydıyla eşleştirir (yedekten yükleme sonrası).
  async kimligimiSec(ogretmenId) {
    await updateDoc(doc(db, 'kurumlar', kurumId, 'uyeler', kullanici.uid), { ogretmenId });
    const t = DB.get('ogretmenler', ogretmenId);
    if (t) DB.save('ogretmenler', { ...t, uid: kullanici.uid, hesapEposta: kullanici.email });
    Oturum.ogretmenId = ogretmenId;
    render();
  },

  // Bir öğretmenin uygulamaya erişimini kaldırır.
  async erisimiKaldir(ogretmen) {
    if (ogretmen.uid) await deleteDoc(doc(db, 'kurumlar', kurumId, 'uyeler', ogretmen.uid));
    const { uid: _u, hesapEposta: _e, ...kalan } = ogretmen;
    DB.save('ogretmenler', kalan);
  },
};

render();
