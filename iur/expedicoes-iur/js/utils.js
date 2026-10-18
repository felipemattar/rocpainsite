// Utilitários genéricos (sem regra de negócio)
import { PHOTO_MAX_PX, PHOTO_QUALITY } from './config.js';

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pad = n => String(n).padStart(2, '0');

// ---------- datas (sempre 'AAAA-MM-DD', no fuso local) ----------
export const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayStr = () => dateStr(new Date());
export const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return dateStr(d); };
export const fmtD = s => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y.slice(2)}`; };
export const fmtDM = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '';
export const fmtRange = r => r.start === r.end ? fmtD(r.start) : `${fmtD(r.start)} → ${fmtD(r.end)}`;
const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WDL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const wday = s => WD[parseD(s).getDay()];
export const wdayLong = s => WDL[parseD(s).getDay()];
export const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);

// ---------- armazenamento local (só preferências do aparelho) ----------
export const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
};

// ---------- UI: aviso rápido e painel (sheet) ----------
export function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  $('#toastRoot').append(el); setTimeout(() => el.remove(), 2600);
}
export function openSheet(html, onMount) {
  const root = $('#sheetRoot');
  root.innerHTML = `<div class="scrim"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  const scrim = root.firstElementChild;
  scrim.addEventListener('click', e => { if (e.target === scrim) closeSheet(); });
  $$('[data-close]', scrim).forEach(b => b.addEventListener('click', closeSheet));
  onMount && onMount(scrim.firstElementChild);
}
export const closeSheet = () => { $('#sheetRoot').innerHTML = ''; };
export const sheetOpen = () => !!$('#sheetRoot').innerHTML;
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

// Botão que pede um segundo clique para confirmar (o app não usa confirm())
export function armButton(btn, label, onConfirm) {
  btn.addEventListener('click', () => {
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.classList.add('solid'); btn.textContent = label; return; }
    onConfirm();
  });
}

// ---------- QR code (biblioteca qrcode-generator carregada no index.html) ----------
export function qrSVG(text, cell = 4) {
  if (typeof window.qrcode !== 'function') return '';
  const q = window.qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), m = 2, size = (n + m * 2) * cell; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${(c + m) * cell},${(r + m) * cell}h${cell}v${cell}h-${cell}z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// ---------- foto: reduz e devolve data URL ----------
export async function photoToDataURL(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, PHOTO_MAX_PX / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/jpeg', PHOTO_QUALITY);
    if (out.length > 450000) throw new Error('too_large');
    return out;
  } finally { URL.revokeObjectURL(url); }
}

export function downloadText(filename, text, type = 'text/html') {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = u; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}
