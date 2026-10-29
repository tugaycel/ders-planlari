'use strict';
// Genel yardımcılar: tarih, biçimlendirme, DOM.

const TR_GUN = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const TR_GUN_KISA = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const TR_AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const RENKLER = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#2563eb', '#65a30d', '#ea580c', '#0d9488', '#9333ea'];

const $ = (sel, kok = document) => kok.querySelector(sel);
const $$ = (sel, kok = document) => [...kok.querySelectorAll(sel)];

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function bugun() { return ymd(new Date()); }
function simdiDk() { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function haftaBasi(d, ilkGun) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(x, -((x.getDay() - ilkGun + 7) % 7));
}
function ayBasi(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function aySonu(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function dk(hm) { const [h, m] = String(hm).split(':').map(Number); return h * 60 + (m || 0); }
function saat(dakika) { return `${pad(Math.floor(dakika / 60))}:${pad(dakika % 60)}`; }

function tarihYaz(s, gunAdi = false) {
  const d = parseYmd(s);
  return `${d.getDate()} ${TR_AY[d.getMonth()]} ${d.getFullYear()}${gunAdi ? ', ' + TR_GUN[d.getDay()] : ''}`;
}
function tarihKisa(s) { const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; }
function zamanYaz(iso) { const d = new Date(iso); return `${tarihKisa(ymd(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function sureYaz(dakika) {
  const h = Math.floor(dakika / 60), m = dakika % 60;
  return [h ? `${h} sa` : '', m ? `${m} dk` : ''].filter(Boolean).join(' ') || '0 dk';
}
function paraYaz(n) { return (Number(n) || 0).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }); }
function trSirala(a, b) { return String(a).localeCompare(String(b), 'tr'); }
function basHarf(ad) { return String(ad || '?').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toLocaleUpperCase('tr'); }

function dosyaIndir(ad, icerik, tip) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([icerik], { type: tip }));
  a.download = ad;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// Excel (TR) için noktalı virgül ayraçlı, BOM'lu CSV.
function csvYap(satirlar) {
  return '﻿' + satirlar.map(r => r.map(v => {
    const s = String(v ?? '');
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\r\n');
}
