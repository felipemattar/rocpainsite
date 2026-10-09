// Inventário de equipamentos + ficha do item
import { S, can } from '../store.js';
import { CONDITIONS, ITEM_STATUS } from '../config.js';
import { esc, fmtD, ls, openSheet, closeSheet, toast, armButton, qrSVG, photoToDataURL, $$ } from '../utils.js';
import { itemsSorted, groupsSorted, gName, matchesFilter, nextItemId, blocks } from '../logic.js';
import { saveItem, deleteItem } from '../actions.js';
import { thumbHTML, itemPills, emptyHTML } from '../components.js';
import { downloadLabels } from './labels.js';

const FILTERS = [['all', 'Todos', null], ['free', 'Livre', 'var(--ok)'], ['inuse', 'Em uso', 'var(--use)'], ['needs', 'Precisa de manutenção', 'var(--warn)'],
  ['repair', 'Em manutenção', 'var(--bad)'], ['ordered', 'Encomendado', 'var(--accent)'], ['tobuy', 'A comprar', 'var(--idle)']];
const V = { filter: 'all', group: '', q: '' };
export const itemLink = id => `${location.origin}${location.pathname}#/item/${id}`;
export const showPhotos = () => ls.get('iur.photos', true);

export function renderInventory(el) {
  const E = can('edit');
  el.innerHTML = `
    <div class="pagehead"><h2>Equipamentos</h2>${E ? '<button class="btn pri" id="addItem">+ Equipamento</button>' : ''}</div>
    <div class="bar">
      <input class="search" id="q" type="search" placeholder="Buscar por nome, ID, local…" autocomplete="off" value="${esc(V.q)}">
      <select class="sel" id="fgroup" aria-label="Filtrar por grupo"><option value="">Todos os grupos</option>${groupsSorted().map(g => `<option value="${esc(g.id)}" ${g.id === V.group ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
      <label class="toggle"><input type="checkbox" id="showPhotos" ${showPhotos() ? 'checked' : ''}> Fotos</label>
    </div>
    <div class="chips" id="fchips"></div><div id="list"></div>`;
  const draw = () => {
    const all = itemsSorted(), q = V.q.trim().toLowerCase();
    const base = all.filter(it => (!V.group || it.group === V.group) && (!q || [it.id, it.name, it.location, it.notes, it.accessories, gName(it.group)].join(' ').toLowerCase().includes(q)));
    el.querySelector('#fchips').innerHTML = FILTERS.map(([k, t, c]) => `<button class="chip" data-f="${k}" aria-pressed="${V.filter === k}">${c ? `<span class="dot" style="background:${c}"></span>` : ''}${t} <b>${base.filter(it => matchesFilter(it, k)).length}</b></button>`).join('');
    const list = base.filter(it => matchesFilter(it, V.filter));
    const L = el.querySelector('#list');
    if (!S.loaded.items) { L.innerHTML = emptyHTML('Carregando o inventário…'); return; }
    if (!all.length) { L.innerHTML = emptyHTML('Nenhum equipamento cadastrado.'); return; }
    if (!list.length) { L.innerHTML = emptyHTML('Nenhum equipamento com esses filtros.'); return; }
    const byG = new Map(); for (const it of list) { if (!byG.has(it.group)) byG.set(it.group, []); byG.get(it.group).push(it); }
    L.innerHTML = [...byG.entries()].map(([g, arr]) => `<div class="gsec"><div class="ghead"><h2>${esc(gName(g))}</h2><small>${arr.length}</small></div>
      <div class="rows">${arr.map(it => `<button class="row" data-item="${esc(it.id)}">${thumbHTML(it)}<span class="id">${esc(it.id)}</span>
        <span class="main"><span class="name">${esc(it.name)}</span>${(it.qty || 1) > 1 ? ` <span class="qty">× ${it.qty}</span>` : ''}
        ${it.location || it.notes ? `<div class="meta">${[it.location ? '📍 ' + esc(it.location) : '', it.notes ? esc(it.notes) : ''].filter(Boolean).join(' · ')}</div>` : ''}</span>${itemPills(it)}</button>`).join('')}</div></div>`).join('');
  };
  draw();
  el.querySelector('#fchips').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { V.filter = b.dataset.f; draw(); } });
  el.querySelector('#q').addEventListener('input', e => { V.q = e.target.value; draw(); });
  el.querySelector('#fgroup').addEventListener('change', e => { V.group = e.target.value; draw(); });
  el.querySelector('#showPhotos').addEventListener('change', e => { ls.set('iur.photos', e.target.checked); document.body.classList.toggle('nophotos', !e.target.checked); });
  el.querySelector('#list').addEventListener('click', e => { const r = e.target.closest('[data-item]'); if (r) openItem(r.dataset.item); });
  el.querySelector('#addItem')?.addEventListener('click', () => openItem(null));
}
export const setInventoryGroup = g => { V.group = g; V.filter = 'all'; };

export function openItem(id) {
  const E = can('edit'); const isNew = !id;
  if (!isNew && !S.items.has(id)) { toast('Equipamento não encontrado.'); return; }
  const it = isNew ? { name: '', group: V.group || groupsSorted()[0]?.id || '', qty: 1, accessories: '', status: 'owned', condition: 'ok', returnDate: '', location: '', notes: '', photo: '' } : { id, ...S.items.get(id) };
  const st = { ...it };
  const uses = isNew ? [] : [...S.projects.entries()].filter(([, p]) => (p.items || []).some(e => e.id === id));
  const ro = E ? '' : 'disabled';
  openSheet(`
    <div class="sheet-h"><div>${isNew ? '<span class="hint">Novo equipamento</span>' : `<span class="id">${esc(id)}</span>`}<h2>${isNew ? 'Cadastrar equipamento' : esc(it.name)}</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
    <form class="form" id="itemForm">
      <div class="photo-box"><span class="photo-big" id="pbig">${it.photo ? `<img src="${esc(it.photo)}" alt="">` : esc((it.group || '?').slice(0, 3))}</span>
        ${E ? `<div style="display:flex;flex-direction:column;gap:6px"><label class="btn sm" style="cursor:pointer"><input type="file" id="photoIn" accept="image/*" hidden>${it.photo ? 'Trocar foto' : 'Adicionar foto'}</label>
          ${it.photo ? '<button type="button" class="btn sm ghost" id="photoRm">Remover foto</button>' : ''}<span class="hint" id="photoMsg">A foto ajuda a identificar o item.</span></div>` : ''}</div>
      <label>Nome<input type="text" id="f-name" required value="${esc(it.name)}" ${ro}></label>
      <div class="two">
        <label>Grupo<select id="f-group" ${ro}>${groupsSorted().map(g => `<option value="${esc(g.id)}" ${g.id === it.group ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select></label>
        <label>Quantidade<span class="stepper"><button type="button" data-q="-1" ${ro}>−</button><input type="number" id="f-qty" min="0" value="${it.qty ?? 1}" ${ro}><button type="button" data-q="1" ${ro}>+</button></span></label>
      </div>
      <label>Situação<div class="seg" id="segStat">${Object.entries(ITEM_STATUS).map(([k, v]) => `<button type="button" class="s-acc" data-v="${k}" aria-pressed="${it.status === k}" ${ro}>${v.t}</button>`).join('')}</div></label>
      <label>Condição<div class="seg" id="segCond">${Object.entries(CONDITIONS).map(([k, v]) => `<button type="button" class="${v.s}" data-v="${k}" aria-pressed="${it.condition === k}" ${ro}>${v.t}</button>`).join('')}</div></label>
      <label id="retWrap" ${it.condition === 'repair' ? '' : 'hidden'}>Previsão de retorno da manutenção<input type="date" id="f-ret" value="${esc(it.returnDate)}" ${ro}></label>
      <div class="two"><label>Localização<input type="text" id="f-loc" value="${esc(it.location)}" ${ro}></label><label>Acessórios<input type="text" id="f-acc" value="${esc(it.accessories)}" ${ro}></label></div>
      <label>Pendência / observações<textarea id="f-notes" ${ro}>${esc(it.notes)}</textarea></label>
      ${isNew ? '' : `<div class="section" style="margin-top:4px"><h3>Projetos com este item</h3><div class="uses">${uses.length ? uses.map(([pid, p]) => `<a href="#/projeto/${esc(pid)}/equipamentos" data-close>${esc(p.name)}</a> <span class="hint">${blocks({ id: pid, ...p }).map(b => fmtD(b.start)).join(' · ') || 'sem datas'}</span>`).join('<br>') : '<span class="hint">Nenhum projeto.</span>'}</div></div>
      <div class="qrbox"><div class="qr">${qrSVG(itemLink(id), 3)}</div><div><b>QR code</b><div class="hint">Escaneie com a câmera do celular para abrir esta ficha.</div>${can('team') ? '<button type="button" class="btn sm" id="qrDl" style="margin-top:6px">Baixar etiqueta</button>' : ''}</div></div>`}
      <div class="actions"><div>${!isNew && E ? '<button type="button" class="btn danger" id="delItem">Excluir</button>' : ''}</div>
        <div class="r"><button type="button" class="btn" data-close>Fechar</button>${E ? `<button type="submit" class="btn pri">${isNew ? 'Cadastrar' : 'Salvar'}</button>` : ''}</div></div>
    </form>`, sh => {
    $$('[data-q]', sh).forEach(b => b.addEventListener('click', () => { const i = sh.querySelector('#f-qty'); i.value = Math.max(0, (+i.value || 0) + (+b.dataset.q)); }));
    const seg = (sel, key, cb) => sh.querySelector(sel).addEventListener('click', e => { const b = e.target.closest('button'); if (!b || b.disabled) return; st[key] = b.dataset.v;
      $$(sel + ' button', sh).forEach(x => x.setAttribute('aria-pressed', String(x === b))); cb && cb(); });
    seg('#segStat', 'status'); seg('#segCond', 'condition', () => { sh.querySelector('#retWrap').hidden = st.condition !== 'repair'; });
    const pin = sh.querySelector('#photoIn');
    pin?.addEventListener('change', async () => { const f = pin.files[0]; if (!f) return; const msg = sh.querySelector('#photoMsg'); msg.textContent = 'Processando…';
      try { st.photo = await photoToDataURL(f); sh.querySelector('#pbig').innerHTML = `<img src="${st.photo}" alt="">`; msg.textContent = 'Foto pronta. Salve para gravar.'; }
      catch (e) { msg.textContent = 'Não foi possível usar esta imagem.'; } });
    sh.querySelector('#photoRm')?.addEventListener('click', e => { st.photo = ''; sh.querySelector('#pbig').textContent = (st.group || '?').slice(0, 3); e.target.remove(); });
    sh.querySelector('#qrDl')?.addEventListener('click', () => downloadLabels([id]));
    const del = sh.querySelector('#delItem'); del && armButton(del, uses.length ? `Confirmar (sai de ${uses.length} projeto${uses.length > 1 ? 's' : ''})` : 'Confirmar exclusão', () => { deleteItem(id); closeSheet(); toast(`${id} excluído`); });
    sh.querySelector('#itemForm').addEventListener('submit', e => { e.preventDefault(); if (!E) return;
      const data = { name: sh.querySelector('#f-name').value.trim(), group: sh.querySelector('#f-group').value, qty: Math.max(0, parseInt(sh.querySelector('#f-qty').value) || 0),
        accessories: sh.querySelector('#f-acc').value.trim(), status: st.status, condition: st.condition, returnDate: st.condition === 'repair' ? sh.querySelector('#f-ret').value : '',
        location: sh.querySelector('#f-loc').value.trim(), notes: sh.querySelector('#f-notes').value.trim(), photo: st.photo || '' };
      if (!data.name) return sh.querySelector('#f-name').focus();
      if (!data.group) return toast('Crie um grupo antes.');
      if (data.condition === 'repair' && !data.returnDate) { sh.querySelector('#f-ret').focus(); return toast('Informe a previsão de retorno.'); }
      const nid = isNew ? nextItemId(data.group) : id; saveItem(nid, data); toast(isNew ? `${nid} cadastrado` : 'Alterações salvas'); closeSheet(); });
  });
}
