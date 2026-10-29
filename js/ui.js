'use strict';
// Modal, onay kutusu, bildirim ve form yardımcıları.

let modalTemizle = null;

function modal({ baslik, icerik, genis = false, butonlar = [{ ad: 'Kapat' }], acilinca }) {
  modalTemizle?.();
  const kok = $('#modal-root');
  const onceki = document.activeElement;
  kok.innerHTML = `
    <div class="modal-arka">
      <div class="modal${genis ? ' genis' : ''}" role="dialog" aria-modal="true" aria-label="${esc(baslik)}">
        <div class="modal-ust"><h2>${esc(baslik)}</h2><button type="button" class="ikon-btn" data-kapat aria-label="Kapat">✕</button></div>
        <div class="modal-govde">${icerik}</div>
        <div class="modal-alt">${butonlar.map((b, i) => `<button type="button" class="btn ${b.sinif || ''}" data-b="${i}">${esc(b.ad)}</button>`).join('')}</div>
      </div>
    </div>`;
  const govde = $('.modal-govde', kok);
  const tus = e => { if (e.key === 'Escape') kapat(); };
  function kapat() {
    modalTemizle?.();
    kok.innerHTML = '';
    onceki?.focus?.();
  }
  modalTemizle = () => { document.removeEventListener('keydown', tus); modalTemizle = null; };
  document.addEventListener('keydown', tus);
  $('[data-kapat]', kok).onclick = kapat;
  $$('[data-b]', kok).forEach(btn => btn.onclick = async () => {
    const b = butonlar[btn.dataset.b];
    if (b.tik && (await b.tik(govde, kapat)) === false) return;
    kapat();
  });
  acilinca?.(govde, kapat);
  if (!matchMedia('(pointer: coarse)').matches) $('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea', govde)?.focus();
  return { govde, kapat };
}

function onayKutusu(metin, { evet = 'Evet', tehlike = false, baslik = 'Emin misiniz?' } = {}) {
  return new Promise(coz => {
    let sonuc = false;
    const m = modal({
      baslik, icerik: `<p>${metin}</p>`,
      butonlar: [{ ad: 'Vazgeç' }, { ad: evet, sinif: tehlike ? 'tehlike' : 'birincil', tik: () => { sonuc = true; } }],
    });
    // Kapanışı izle: modal kökü boşaldığında sonucu bildir.
    const gozcu = new MutationObserver(() => {
      if (!document.body.contains(m.govde)) { gozcu.disconnect(); coz(sonuc); }
    });
    gozcu.observe($('#modal-root'), { childList: true });
  });
}

function bildir(metin, tur = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${tur}`;
  el.textContent = metin;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.classList.add('git'), 2600);
  setTimeout(() => el.remove(), 3000);
}

// name niteliği olan alanları nesneye çevirir. data-coklu işaretli checkbox'lar dizi olur.
function formOku(kok) {
  const o = {};
  $$('[name]', kok).forEach(el => {
    if (el.type === 'checkbox') {
      if (el.hasAttribute('data-coklu')) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); }
      else o[el.name] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) o[el.name] = el.value;
    } else {
      o[el.name] = el.value.trim();
    }
  });
  return o;
}

function secenekler(liste, secili, { bos, etiket = x => x.ad } = {}) {
  return (bos !== undefined ? `<option value="">${esc(bos)}</option>` : '') +
    liste.map(x => `<option value="${esc(x.id)}" ${x.id === secili ? 'selected' : ''}>${esc(etiket(x))}</option>`).join('');
}

function avatar(t, boyut = '') {
  return `<span class="avatar ${boyut}" style="--c:${esc(t?.renk || '#64748b')}">${esc(basHarf(t?.ad))}</span>`;
}

function renkSecici(ad, deger) {
  return `<div class="renk-sec">${RENKLER.map(r => `<label><input type="radio" name="${ad}" value="${r}" ${r === deger ? 'checked' : ''}><span style="--c:${r}"></span></label>`).join('')}</div>`;
}

function hataGoster(govde, metin) {
  let el = $('.form-hata', govde);
  if (!el) { el = document.createElement('div'); el.className = 'kutu hata form-hata'; govde.prepend(el); }
  el.textContent = metin;
  el.scrollIntoView({ block: 'nearest' });
  return false;
}
