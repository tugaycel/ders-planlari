'use strict';
// Uygulama kabuğu: giriş, kurum kurulumu, menü ve sayfa yönlendirme.

const SAYFALAR = [
  { id: 'takvim', ad: 'Takvim', ikon: '📅', view: takvimView },
  { id: 'dersler', ad: 'Dersler', ikon: '📋', view: derslerView },
  { id: 'onaylar', ad: 'Onaylar', ikon: '✅', view: onaylarView },
  { id: 'ogrenciler', ad: 'Öğrenciler', ikon: '🎓', view: ogrencilerView },
  { id: 'eslesmeler', ad: 'Eşleştirmeler', ikon: '🔗', view: eslesmelerView },
  { id: 'ogretmenler', ad: 'Öğretmenler', ikon: '👥', view: ogretmenlerView },
  { id: 'kategoriler', ad: 'Kategoriler', ikon: '🏷️', view: kategorilerView },
  { id: 'raporlar', ad: 'Raporlar', ikon: '📊', view: raporlarView },
  { id: 'ayarlar', ad: 'Ayarlar', ikon: '⚙️', view: ayarlarView },
];

function aktifSayfa() {
  const h = location.hash.replace(/^#\/?/, '');
  return SAYFALAR.find(s => s.id === h) || SAYFALAR[0];
}

function render() {
  const app = $('#app');
  document.title = Oturum.durum === 'hazir' ? DB.ayarlar().kurumAdi : 'Özel Ders Programı';
  if (Oturum.durum === 'yukleniyor') return bilgiEkrani(app, '<div class="donen" aria-label="Yükleniyor"></div><p class="soluk">Yükleniyor…</p>');
  if (Oturum.durum === 'giris') return girisEkrani(app);
  if (Oturum.durum === 'kurulum') return kurulumEkrani(app);
  if (Oturum.durum === 'hata') return bilgiEkrani(app, `<h1>Bir sorun oluştu</h1><p class="kutu hata">${esc(Oturum.hata)}</p>`, true);

  const u = Oturum.kullanici();
  if (!u) return kimlikEkrani(app);
  if (u.pasif) return bilgiEkrani(app, '<h1>Hesabınız pasif</h1><p class="soluk">Bu kurumda pasif olarak işaretlendiniz. Yöneticinizle görüşün.</p>', true);

  const sayfa = aktifSayfa();
  const bekleyen = onayBekleyenler(u).length;
  app.innerHTML = `
    <div class="kabuk">
      <aside class="yan">
        <div class="marka"><span class="logo">ÖD</span><span>${esc(DB.ayarlar().kurumAdi)}</span></div>
        <nav>${SAYFALAR.map(s => `<a href="#/${s.id}" class="${s === sayfa ? 'aktif' : ''}" ${s === sayfa ? 'aria-current="page"' : ''}>
          <span class="nav-ikon" aria-hidden="true">${s.ikon}</span><span>${s.ad}</span>${s.id === 'onaylar' && bekleyen ? `<b class="sayac">${bekleyen}</b>` : ''}</a>`).join('')}</nav>
        <div class="kullanici">
          <button class="kul-btn" data-act="profil" title="Profilim">${avatar(u)}<span><b>${esc(u.ad)}</b><small>${rolAdi(u)}</small></span></button>
          <button class="btn kucuk" data-act="cikis">Çıkış</button>
        </div>
      </aside>
      <main id="icerik"></main>
    </div>`;
  $('.kullanici', app).onclick = e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'cikis') Oturum.cikis();
    if (act === 'profil') ogretmenFormu(u);
  };
  sayfa.view($('#icerik'), u);
}

function kartEkrani(app, icerik) {
  app.innerHTML = `<div class="giris"><div class="giris-kart"><span class="logo buyuk">ÖD</span>${icerik}</div></div>`;
  return $('.giris-kart', app);
}

function bilgiEkrani(app, icerik, cikisli = false) {
  const kart = kartEkrani(app, icerik + (cikisli ? `<button class="btn genis-btn" data-act="cikis">Çıkış yap${Oturum.eposta ? ` (${esc(Oturum.eposta)})` : ''}</button>` : ''));
  kart.onclick = e => { if (e.target.closest('[data-act=cikis]')) Oturum.cikis(); };
}

function girisEkrani(app) {
  let kayit = Oturum.davetVar;
  const ciz = () => {
    const kart = kartEkrani(app, `
      <h1>${kayit ? 'Hesap oluştur' : 'Giriş yap'}</h1>
      ${Oturum.davetVar ? '<div class="kutu bilgi">Bir kuruma davet edildiniz. Hesap oluşturun ya da mevcut hesabınızla giriş yapın; kuruma otomatik katılacaksınız.</div>' : '<p class="soluk">Özel ders takvimine e-posta ve şifrenizle girin.</p>'}
      <form class="form tek" id="giris-form">
        <label>E-posta<input name="eposta" type="email" autocomplete="email" required></label>
        <label>Şifre<input name="sifre" type="password" autocomplete="${kayit ? 'new-password' : 'current-password'}" minlength="6" required></label>
        ${kayit ? '<label>Şifre (tekrar)<input name="sifre2" type="password" autocomplete="new-password" minlength="6" required></label>' : ''}
        <div class="form-hata-yer"></div>
        <button class="btn birincil genis-btn" type="submit">${kayit ? 'Hesap oluştur' : 'Giriş yap'}</button>
      </form>
      <div class="buton-satir orta">
        <button class="link" data-act="degistir">${kayit ? 'Hesabım var, giriş yap' : 'Hesabım yok, oluştur'}</button>
        ${kayit ? '' : '<button class="link" data-act="sifre">Şifremi unuttum</button>'}
      </div>
      <p class="not">Veriler güvenli bulut veritabanında saklanır; tüm cihazlarınızda aynı takvimi görürsünüz.</p>`);
    const form = $('#giris-form', kart);
    const hata = m => hataGoster($('.form-hata-yer', form), m);
    form.onsubmit = async e => {
      e.preventDefault();
      const f = formOku(form);
      if (kayit && f.sifre !== f.sifre2) return hata('Şifreler aynı değil.');
      const btn = $('button[type=submit]', form);
      btn.disabled = true;
      try {
        await (kayit ? Bulut.kayitOl(f.eposta, f.sifre) : Bulut.girisYap(f.eposta, f.sifre));
      } catch (err) {
        hata(Bulut.hataMetni(err));
        btn.disabled = false;
      }
    };
    kart.onclick = async e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'degistir') { kayit = !kayit; ciz(); }
      if (act === 'sifre') {
        const eposta = formOku(form).eposta;
        if (!eposta) return hata('Önce e-posta adresinizi yazın.');
        try {
          await Bulut.sifreSifirla(eposta);
          bildir('Şifre sıfırlama bağlantısı e-postanıza gönderildi');
        } catch (err) { hata(Bulut.hataMetni(err)); }
      }
    };
  };
  if (!window.Bulut) return bilgiEkrani(app, '<div class="donen"></div><p class="soluk">Bağlanıyor…</p>');
  ciz();
}

function kurulumEkrani(app) {
  const kart = kartEkrani(app, `
    <h1>Hoş geldiniz</h1>
    <p class="soluk">${esc(Oturum.eposta)} hesabı henüz bir kuruma bağlı değil.</p>
    ${Oturum.hata ? `<div class="kutu uyari">${esc(Oturum.hata)}</div>` : ''}
    <h2 class="bolum">Yeni kurum oluştur</h2>
    <p class="soluk kucuk-yazi">Kurumun yöneticisi siz olursunuz; diğer öğretmenleri davet linkiyle eklersiniz.</p>
    <form class="form tek" id="kurulum">
      <label>Kurum / program adı<input name="kurumAdi" placeholder="Örn. Kaya Özel Ders"></label>
      <label>Adınız soyadınız *<input name="ad" required autocomplete="name"></label>
      <div class="form-hata-yer"></div>
      <button class="btn birincil genis-btn" type="submit">Kurumu oluştur</button>
      <button class="btn genis-btn" type="button" data-act="demo">Demo verilerle oluştur</button>
    </form>
    <div class="ayrac"><span>ya da</span></div>
    <h2 class="bolum">Davet koduyla katıl</h2>
    <form class="form tek" id="davet">
      <label>Davet kodu<input name="kod" autocomplete="off" placeholder="Yöneticinizin gönderdiği kod"></label>
      <button class="btn genis-btn" type="submit">Katıl</button>
    </form>
    <button class="link" data-act="cikis">Farklı hesapla giriş yap</button>`);
  const kurulum = $('#kurulum', kart);
  const isle = async (btn, fn) => {
    btn.disabled = true;
    try { await fn(); } catch (err) {
      console.error(err);
      hataGoster($('.form-hata-yer', kurulum), Bulut.hataMetni(err));
      btn.disabled = false;
    }
  };
  kurulum.onsubmit = e => {
    e.preventDefault();
    const f = formOku(kurulum);
    if (!f.ad) return hataGoster($('.form-hata-yer', kurulum), 'Adınızı yazın.');
    isle(e.submitter || $('button[type=submit]', kurulum), async () => {
      await Bulut.kurumOlustur({ kurumAdi: f.kurumAdi, ad: f.ad });
      location.hash = '#/kategoriler';
    });
  };
  $('#davet', kart).onsubmit = e => {
    e.preventDefault();
    const kod = formOku(e.target).kod;
    if (kod) isle(e.submitter, () => Bulut.davetKoduIleKatil(kod));
  };
  kart.addEventListener('click', e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'cikis') Oturum.cikis();
    if (act === 'demo') isle(e.target, () => Bulut.kurumOlustur({ kurumAdi: formOku(kurulum).kurumAdi, demoVeri: demoVerisi() }));
  });
}

// Oturumdaki hesap kurumdaki hiçbir öğretmen kaydıyla eşleşmiyorsa (ör. yedekten yükleme sonrası).
function kimlikEkrani(app) {
  const ogretmenler = DB.list('ogretmenler').filter(t => !t.pasif).sort((a, b) => trSirala(a.ad, b.ad));
  const kart = kartEkrani(app, `
    <h1>Siz hangisisiniz?</h1>
    <p class="soluk">${esc(Oturum.eposta)} hesabını kurumdaki öğretmen kaydınızla eşleştirin.</p>
    <div class="kisi-liste">${ogretmenler.map(t => `
      <button class="kisi" data-id="${t.id}">${avatar(t)}<span><b>${esc(t.ad)}</b><small>${rolAdi(t)}${t.hesapEposta ? ' · ' + esc(t.hesapEposta) : ''}</small></span></button>`).join('')}
    </div>
    <button class="link" data-act="cikis">Çıkış yap</button>`);
  kart.onclick = async e => {
    if (e.target.closest('[data-act=cikis]')) return Oturum.cikis();
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (!id) return;
    try { await Bulut.kimligimiSec(id); } catch (err) { bildir(Bulut.hataMetni(err), 'hata'); }
  };
}

DB.onChange(() => { if (Oturum.durum === 'hazir') render(); });
window.addEventListener('hashchange', () => { Takvim.kaydirma = null; render(); window.scrollTo(0, 0); });
render();
