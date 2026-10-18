// Etiquetas com QR code (folha A4 para imprimir)
import { S } from '../store.js';
import { esc, qrSVG, toast, downloadText, $$ } from '../utils.js';
import { itemsSorted, groupsSorted } from '../logic.js';
import { itemLink } from './inventory.js';

const V = { group: '', status: 'owned', sel: new Set(), init: false };

export function renderLabels(el) {
  const arr = () => itemsSorted().filter(it => (!V.group || it.group === V.group) && (!V.status || it.status === V.status));
  if (!V.init && S.loaded.items) { arr().forEach(it => V.sel.add(it.id)); V.init = true; }
  el.innerHTML = `<div class="pagehead"><h2>Etiquetas QR</h2></div>
    <div class="bar">
      <select class="sel" id="lgroup"><option value="">Todos os grupos</option>${groupsSorted().map(g => `<option value="${esc(g.id)}" ${g.id === V.group ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
      <select class="sel" id="lstatus"><option value="owned" ${V.status === 'owned' ? 'selected' : ''}>Só itens em posse</option><option value="" ${!V.status ? 'selected' : ''}>Todos os itens</option></select>
      <button class="btn" id="lall">Marcar todos</button><button class="btn" id="lnone">Desmarcar</button><button class="btn pri" id="ldl">Baixar etiquetas (.html)</button>
    </div>
    <p class="hint">Escanear a etiqueta com a câmera do celular abre a ficha do equipamento. O arquivo é uma folha A4 pronta para imprimir.</p>
    <div class="chips">${arr().map(it => `<button class="chip" data-ls="${esc(it.id)}" aria-pressed="${V.sel.has(it.id)}">${esc(it.id)}</button>`).join('')}</div>
    <div class="labels">${arr().filter(it => V.sel.has(it.id)).slice(0, 60).map(it => `<div class="lab">${qrSVG(itemLink(it.id), 3)}<div class="lid">${esc(it.id)}</div><div class="lname">${esc(it.name)}</div></div>`).join('')}</div>`;
  const re = () => renderLabels(el);
  el.querySelector('#lgroup').addEventListener('change', e => { V.group = e.target.value; re(); });
  el.querySelector('#lstatus').addEventListener('change', e => { V.status = e.target.value; re(); });
  el.querySelector('#lall').addEventListener('click', () => { arr().forEach(it => V.sel.add(it.id)); re(); });
  el.querySelector('#lnone').addEventListener('click', () => { arr().forEach(it => V.sel.delete(it.id)); re(); });
  $$('[data-ls]', el).forEach(b => b.addEventListener('click', () => { const id = b.dataset.ls; V.sel.has(id) ? V.sel.delete(id) : V.sel.add(id); re(); }));
  el.querySelector('#ldl').addEventListener('click', () => { const ids = arr().filter(it => V.sel.has(it.id)).map(it => it.id); if (!ids.length) return toast('Selecione ao menos uma etiqueta.'); downloadLabels(ids); });
}

export function downloadLabels(ids) {
  const cells = ids.map(id => { const it = S.items.get(id) || { name: '' };
    return `<div class="l">${qrSVG(itemLink(id), 4)}<div class="t"><div class="i">${esc(id)}</div><div class="n">${esc(it.name)}</div><div class="o">IUR · Últimos Refúgios</div></div></div>`; }).join('');
  downloadText(ids.length === 1 ? `etiqueta-${ids[0]}.html` : 'etiquetas-equipamentos-IUR.html', `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas IUR</title><style>
@page{size:A4;margin:10mm}body{font-family:Arial,sans-serif;margin:0;color:#000}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.l{border:1px dashed #888;border-radius:2mm;padding:3mm;display:flex;gap:3mm;align-items:center;break-inside:avoid;height:30mm}
.l svg{width:24mm;height:24mm;flex:none}.i{font-weight:700;font-size:15pt}.n{font-size:8pt;line-height:1.15;margin-top:1mm}.o{font-size:6.5pt;color:#555;margin-top:1mm}
p{font-size:9pt;color:#555}@media print{p{display:none}}</style></head><body><p>Use Imprimir (Ctrl+P). ${ids.length} etiqueta(s).</p><div class="g">${cells}</div></body></html>`);
}
