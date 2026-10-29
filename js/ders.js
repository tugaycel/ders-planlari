'use strict';
// Ders iş kuralları: oluşturma, durum bildirimi, onay, erteleme, ücret.

const DURUMLAR = {
  planlandi: { ad: 'Planlandı', ikon: '○' },
  yapildi: { ad: 'Yapıldı', ikon: '✓' },
  yapilmadi: { ad: 'Yapılmadı', ikon: '✕' },
  ertelendi: { ad: 'Ertelendi', ikon: '↻' },
};

function ogretmenAdi(id) { return DB.get('ogretmenler', id)?.ad || '—'; }
function ogrenciAdlari(ids) { return (ids || []).map(id => DB.get('ogrenciler', id)?.ad || '?').join(', ') || '—'; }
function kategoriBul(id) { return DB.get('kategoriler', id); }
function dersBitis(d) { return dk(d.baslangic) + Number(d.sure || 0); }
function dersSirala(a, b) { return a.tarih.localeCompare(b.tarih) || a.baslangic.localeCompare(b.baslangic); }

// Durumu girilmesi gereken (zamanı geçmiş, hâlâ "planlandı") ders mi?
function dersGecikmis(d) {
  if (d.durum !== 'planlandi' || d.onay === 'bekliyor') return false;
  const b = bugun();
  return d.tarih < b || (d.tarih === b && dersBitis(d) <= simdiDk());
}

function eslesmeEtiket(e) {
  return `${DB.get('ogrenciler', e.ogrenciId)?.ad || '?'} · ${kategoriBul(e.kategoriId)?.ad || '?'} · ${ogretmenAdi(e.ogretmenId)}`;
}

function gecmisEkle(ders, u, metin) {
  (ders.gecmis ||= []).push({ t: new Date().toISOString(), kim: u.id, metin });
}
function adinaMetni(u, ogretmenId) {
  return u.id !== ogretmenId ? ` (${ogretmenAdi(ogretmenId)} adına)` : '';
}

function dersleriOlustur(veri, u, tekrar = 1) {
  const seriId = tekrar > 1 ? uid() : null;
  return DB.tx(() => {
    const sonuc = [];
    for (let i = 0; i < tekrar; i++) {
      const d = {
        ...veri,
        tarih: ymd(addDays(parseYmd(veri.tarih), i * 7)),
        durum: 'planlandi', onay: null, seriId, olusturan: u.id, gecmis: [],
      };
      gecmisEkle(d, u, 'Ders oluşturuldu' + adinaMetni(u, d.ogretmenId));
      sonuc.push(DB.save('dersler', d));
    }
    return sonuc;
  });
}

function dersGuncelle(ders, veri, u) {
  Object.assign(ders, veri);
  gecmisEkle(ders, u, 'Ders bilgileri güncellendi' + adinaMetni(u, ders.ogretmenId));
  return DB.save('dersler', ders);
}

function dersSil(ders, seriyle = false) {
  DB.tx(() => {
    const silinecek = seriyle && ders.seriId
      ? DB.list('dersler').filter(d => d.seriId === ders.seriId && d.tarih >= ders.tarih && d.durum === 'planlandi')
      : [ders];
    silinecek.forEach(d => DB.remove('dersler', d.id));
    if (!silinecek.includes(ders)) DB.remove('dersler', ders.id);
  });
}

// Aynı öğretmen ya da aynı öğrenci için çakışan aktif dersler.
function cakismalar(veri, haricId) {
  const bas = dk(veri.baslangic), son = bas + Number(veri.sure);
  return DB.list('dersler').filter(d =>
    d.id !== haricId && d.tarih === veri.tarih &&
    (d.durum === 'planlandi' || d.durum === 'yapildi') &&
    dk(d.baslangic) < son && dersBitis(d) > bas &&
    (d.ogretmenId === veri.ogretmenId || (d.ogrenciIdleri || []).some(o => veri.ogrenciIdleri.includes(o))));
}

// Durum bildirimi. Onay gerekiyorsa talep olarak bekletilir, yoksa hemen uygulanır.
function durumBildir(ders, u, talep) {
  talep = { ...talep, kim: u.id, t: new Date().toISOString() };
  if (onayGerekli(u, ders)) {
    ders.talep = talep;
    ders.onay = 'bekliyor';
    delete ders.redNedeni;
    gecmisEkle(ders, u, `"${DURUMLAR[talep.durum].ad}" bildirildi, onay bekliyor${talep.not ? ' — ' + talep.not : ''}`);
    DB.save('dersler', ders);
    return 'bekliyor';
  }
  DB.tx(() => {
    durumUygula(ders, talep, u);
    ders.onay = DB.ayarlar().onaySureci ? 'onaylandi' : null;
    if (ders.onay) ders.onaylayan = u.id;
    DB.save('dersler', ders);
  });
  return 'uygulandi';
}

function durumUygula(ders, talep, u) {
  const eski = ders.durum;
  ders.durum = talep.durum;
  ders.durumNotu = talep.not || '';
  ders.durumGiren = talep.kim;
  ders.durumZamani = talep.t;
  delete ders.talep;
  delete ders.redNedeni;
  let metin = `Durum: ${DURUMLAR[eski].ad} → ${DURUMLAR[talep.durum].ad}${adinaMetni(DB.get('ogretmenler', talep.kim) || u, ders.ogretmenId)}`;

  if (talep.durum === 'ertelendi' && talep.yeniTarih) {
    const yeni = {
      ogretmenId: ders.ogretmenId, ogrenciIdleri: [...(ders.ogrenciIdleri || [])], kategoriId: ders.kategoriId,
      eslesmeId: ders.eslesmeId, sure: ders.sure, yer: ders.yer, konu: ders.konu, plan: ders.plan, notlar: ders.notlar,
      tarih: talep.yeniTarih, baslangic: talep.yeniSaat || ders.baslangic,
      durum: 'planlandi', onay: null, seriId: null, ertelemeKaynakId: ders.id, olusturan: u.id, gecmis: [],
    };
    gecmisEkle(yeni, u, `${tarihKisa(ders.tarih)} ${ders.baslangic} tarihli dersin ertelemesi olarak oluşturuldu`);
    DB.save('dersler', yeni);
    ders.yeniDersId = yeni.id;
    metin += ` → yeni tarih ${tarihKisa(yeni.tarih)} ${yeni.baslangic}`;
  }
  gecmisEkle(ders, u, metin + (talep.not ? ` — ${talep.not}` : ''));
  DB.save('dersler', ders);
}

function talebiOnayla(ders, u) {
  if (ders.onay !== 'bekliyor' || !ders.talep) return;
  DB.tx(() => {
    gecmisEkle(ders, u, `${ogretmenAdi(ders.talep.kim)} tarafından bildirilen "${DURUMLAR[ders.talep.durum].ad}" onaylandı`);
    durumUygula(ders, ders.talep, u);
    ders.onay = 'onaylandi';
    ders.onaylayan = u.id;
    DB.save('dersler', ders);
  });
}

function talebiReddet(ders, u, neden) {
  if (ders.onay !== 'bekliyor' || !ders.talep) return;
  gecmisEkle(ders, u, `"${DURUMLAR[ders.talep.durum].ad}" bildirimi reddedildi${neden ? ' — ' + neden : ''}`);
  delete ders.talep;
  ders.onay = 'reddedildi';
  ders.redNedeni = neden || '';
  DB.save('dersler', ders);
}

// Bir öğrencinin o dersteki ders başı ücreti: eşleştirmedeki ücret, yoksa kategori ücreti.
function dersUcreti(ders, ogrenciId) {
  const e = DB.list('eslesmeler').find(x => x.ogrenciId === ogrenciId && x.kategoriId === ders.kategoriId && x.ogretmenId === ders.ogretmenId);
  if (e && e.ucret !== '' && e.ucret != null) return Number(e.ucret) || 0;
  return Number(kategoriBul(ders.kategoriId)?.ucret) || 0;
}

function durumRozet(d) {
  if (d.onay === 'bekliyor') return `<span class="rozet-d s-bekliyor">⏳ Onay bekliyor: ${DURUMLAR[d.talep.durum].ad}</span>`;
  return `<span class="rozet-d s-${d.durum}">${DURUMLAR[d.durum].ikon} ${DURUMLAR[d.durum].ad}</span>`;
}
