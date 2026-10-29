'use strict';
// Uygulama kabuğu: kurulum, giriş, menü ve sayfa yönlendirme.

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
  document.title = DB.ayarlar().kurumAdi;
  if (!DB.list('ogretmenler').length) return kurulumEkrani(app);
  const u = Oturum.kullanici();
  if (!u || u.pasif) return girisEkrani(app);

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
    if (act === 'cikis') { Oturum.cikis(); render(); }
    if (act === 'profil') ogretmenFormu(u);
  };
  sayfa.view($('#icerik'), u);
}

function kurulumEkrani(app) {
  app.innerHTML = `
    <div class="giris"><div class="giris-kart">
      <span class="logo buyuk">ÖD</span>
      <h1>Özel ders programına hoş geldiniz</h1>
      <p class="soluk">İlk kurulum: kendinizi yönetici olarak tanımlayın. Diğer öğretmenleri, öğrencileri ve dersleri sonra eklersiniz.</p>
      <form class="form tek" id="kurulum" onsubmit="return false">
        <label>Kurum / program adı<input name="kurumAdi" placeholder="Örn. Kaya Özel Ders"></label>
        <label>Adınız soyadınız *<input name="ad" required autocomplete="name"></label>
        <label>Giriş PIN'i (isteğe bağlı)<input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" placeholder="4–6 hane"></label>
        <div class="form-hata-yer"></div>
        <button class="btn birincil genis-btn" data-act="basla">Başla</button>
      </form>
      <div class="ayrac"><span>ya da</span></div>
      <button class="btn genis-btn" data-act="demo">Demo verilerle dene</button>
      <p class="not">Veriler yalnızca bu cihazdaki tarayıcıda saklanır.</p>
    </div></div>`;
  app.onclick = null;
  $('.giris-kart', app).onclick = e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'demo') return demoYukle();
    if (act !== 'basla') return;
    const form = $('#kurulum', app);
    const f = formOku(form);
    if (!f.ad) return hataGoster($('.form-hata-yer', form), 'Adınızı yazın.');
    if (f.pin && !/^\d{4,6}$/.test(f.pin)) return hataGoster($('.form-hata-yer', form), 'PIN 4–6 haneli rakam olmalı.');
    DB.tx(() => {
      if (f.kurumAdi) DB.ayarKaydet({ kurumAdi: f.kurumAdi });
      const t = DB.save('ogretmenler', { ad: f.ad, rol: 'yonetici', sorumluId: null, brans: '', telefon: '', eposta: '', renk: RENKLER[0], ...(f.pin ? { pin: basitKarma(f.pin) } : {}) });
      Oturum.giris(t.id);
    });
    location.hash = '#/kategoriler';
  };
}

function girisEkrani(app) {
  const ogretmenler = DB.list('ogretmenler').filter(t => !t.pasif).sort((a, b) => trSirala(a.ad, b.ad));
  app.innerHTML = `
    <div class="giris"><div class="giris-kart">
      <span class="logo buyuk">ÖD</span>
      <h1>${esc(DB.ayarlar().kurumAdi)}</h1>
      <p class="soluk">Devam etmek için kendinizi seçin</p>
      <div class="kisi-liste">${ogretmenler.map(t => `
        <button class="kisi" data-id="${t.id}">${avatar(t)}<span><b>${esc(t.ad)}</b><small>${rolAdi(t)}${t.brans ? ' · ' + esc(t.brans) : ''}</small></span>${t.pin ? '<span class="kilit" title="PIN korumalı">🔒</span>' : ''}</button>`).join('')}
      </div>
      <p class="not">Veriler bu cihazdaki tarayıcıda saklanır.</p>
    </div></div>`;
  $('.kisi-liste', app).onclick = e => {
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (!id) return;
    const t = DB.get('ogretmenler', id);
    if (!t.pin) { Oturum.giris(id); return render(); }
    modal({
      baslik: `${t.ad} — PIN`,
      icerik: `<form class="form tek" onsubmit="return false"><label>PIN<input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label></form>`,
      butonlar: [{ ad: 'Vazgeç' }, {
        ad: 'Giriş', sinif: 'birincil', tik: g => {
          if (basitKarma(formOku(g).pin) !== t.pin) return hataGoster(g, 'PIN hatalı.');
          Oturum.giris(id);
          render();
        },
      }],
      acilinca: g => {
        const inp = $('input', g);
        inp.focus();
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') $('.modal-alt .birincil').click(); });
      },
    });
  };
}

DB.onChange(render);
window.addEventListener('hashchange', () => { Takvim.kaydirma = null; render(); window.scrollTo(0, 0); });
render();
