// Armazenamento: mochilas, cases e caixas (recipientes aninhados) e os equipamentos guardados em cada um
import { S, can } from '../store.js';
import { esc, openSheet, closeSheet, toast, armButton, $$ } from '../utils.js';
import { containerTree, containerItems, containerLabel, canMoveContainer, itemsSorted } from '../logic.js';
import { createContainer, saveContainer, deleteContainer } from '../actions.js';
import { CONTAINER_KINDS } from '../config.js';
import { emptyHTML } from '../components.js';
import { openItem } from './inventory.js';

const COLORS = [['', 'Sem cor'], ['#c0392b', 'Vermelho'], ['#e1a800', 'Amarelo'], ['#2e7d32', 'Verde'], ['#1f6fb2', 'Azul'], ['#6d4c9f', 'Roxo'], ['#555555', 'Cinza']];
const kindOf = k => CONTAINER_KINDS[k] || { t: 'Recipiente', ic: '📦' };

export function renderStorage(el) {
  const E = can('edit');
  el.innerHTML = `<div class="pagehead"><h2>Armazenamento</h2>${E ? '<button class="btn pri" id="addContainer">+ Recipiente</button>' : ''}</div>
    <p class="hint">Mochilas, cases e caixas guardam equipamentos e outros recipientes. Cada equipamento fica em um só lugar.</p>
    <div id="ctree">${!S.loaded.containers || !S.loaded.items ? emptyHTML('Carregando…') : treeHTML(E)}</div>`;
  $$('[data-cedit]', el).forEach(b => b.addEventListener('click', () => editContainer(b.dataset.cedit)));
  $$('[data-citem]', el).forEach(b => b.addEventListener('click', () => openItem(b.dataset.citem)));
  el.querySelector('#addContainer')?.addEventListener('click', () => editContainer(null));
}

function treeHTML(E) {
  const tree = containerTree();
  if (!tree.length) return emptyHTML('Nenhum recipiente cadastrado.');
  const items = itemsSorted();
  return tree.map(({ c, depth }) => {
    const k = kindOf(c.kind), n = containerItems(c.id).length, own = items.filter(i => i.container === c.id);
    return `<div class="card" data-cid="${esc(c.id)}" style="margin:0 0 8px ${Math.min(depth, 4) * 14}px;cursor:default;${c.color ? `border-left:6px solid ${esc(c.color)};` : ''}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h3>${k.ic} ${esc(c.name)}</h3><span class="pill p-idle">${n} ${n === 1 ? 'item' : 'itens'}</span></div>
      <div class="meta">${esc(k.t)}${depth ? ' · em ' + esc(containerLabel(c.parent)) : ''}${c.notes ? ' · ' + esc(c.notes) : ''}</div>
      ${own.length ? `<div class="rows">${own.map(it => `<button class="row static" style="cursor:pointer;grid-template-columns:auto 1fr" data-citem="${esc(it.id)}"><span class="id">${esc(it.id)}</span><span class="main"><span class="name">${esc(it.name)}</span>${(it.qty || 1) > 1 ? ` <span class="qty">× ${it.qty}</span>` : ''}</span></button>`).join('')}</div>` : ''}
      ${E ? `<div><button class="btn sm" data-cedit="${esc(c.id)}">Editar</button></div>` : ''}</div>`;
  }).join('');
}

function editContainer(cid) {
  const isNew = !cid, c = isNew ? { name: '', kind: 'mochila', parent: '', color: '', notes: '' } : S.containers.get(cid);
  if (!isNew && !c) return toast('Recipiente não encontrado.');
  const own = isNew ? 0 : itemsSorted().filter(i => i.container === cid).length;
  const kids = isNew ? 0 : [...S.containers.values()].filter(x => x.parent === cid).length;
  const parents = containerTree().filter(({ c: p }) => isNew || (p.id !== cid && canMoveContainer(cid, p.id)));
  const st = { kind: c.kind || 'mochila', color: c.color || '' };
  openSheet(`<div class="sheet-h"><div><span class="hint">${isNew ? 'Novo recipiente' : 'Editar recipiente'}</span><h2>${isNew ? 'Criar recipiente' : esc(c.name)}</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
    <form class="form" id="cf"><label>Nome<input type="text" id="cf-name" required value="${esc(c.name)}"></label>
      <label>Tipo<div class="seg" id="cf-kind">${Object.entries(CONTAINER_KINDS).map(([k, v]) => `<button type="button" class="s-acc" data-v="${k}" aria-pressed="${st.kind === k}">${v.ic} ${esc(v.t)}</button>`).join('')}</div></label>
      <label>Guardado em<select id="cf-parent"><option value="">Sem recipiente (raiz)</option>${parents.map(({ c: p, depth }) => `<option value="${esc(p.id)}" ${p.id === c.parent ? 'selected' : ''}>${'  '.repeat(depth)}${esc(p.name)}</option>`).join('')}</select></label>
      <label>Cor<div class="seg" id="cf-color">${COLORS.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="${st.color === v}" ${v ? `style="border-left:8px solid ${v}"` : ''}>${t}</button>`).join('')}</div></label>
      <label>Observações<textarea id="cf-notes">${esc(c.notes || '')}</textarea></label>
      ${!isNew && (own || kids) ? `<p class="hint">Ao excluir, ${own ? `os ${own} equipamentos` : ''}${own && kids ? ' e ' : ''}${kids ? `os ${kids} recipientes de dentro` : ''} sobem para ${c.parent && S.containers.has(c.parent) ? esc(containerLabel(c.parent)) : 'fora de qualquer recipiente'}. Nada é apagado.</p>` : ''}
      <div class="actions"><div>${isNew ? '' : '<button type="button" class="btn danger" id="cdel">Excluir recipiente</button>'}</div><div class="r"><button type="button" class="btn" data-close>Cancelar</button><button class="btn pri" type="submit">Salvar</button></div></div></form>`, sh => {
    const seg = (sel, key) => sh.querySelector(sel).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; st[key] = b.dataset.v;
      $$(sel + ' button', sh).forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
    seg('#cf-kind', 'kind'); seg('#cf-color', 'color');
    sh.querySelector('#cf').addEventListener('submit', e => { e.preventDefault();
      const name = sh.querySelector('#cf-name').value.trim(); if (!name) return sh.querySelector('#cf-name').focus();
      const parent = sh.querySelector('#cf-parent').value;
      if (!isNew && !canMoveContainer(cid, parent)) return toast('Um recipiente não pode ficar dentro dele mesmo.');
      const data = { name, kind: st.kind, parent, color: st.color, notes: sh.querySelector('#cf-notes').value.trim() };
      if (isNew) createContainer(data); else saveContainer(cid, data);
      closeSheet(); toast('Recipiente salvo'); });
    const del = sh.querySelector('#cdel');
    del && armButton(del, 'Confirmar exclusão', () => { deleteContainer(cid); closeSheet(); toast('Recipiente excluído'); });
  });
}
