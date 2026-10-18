// Grupos de equipamentos
import { S, can } from '../store.js';
import { esc, openSheet, closeSheet, toast, armButton, $$ } from '../utils.js';
import { groupsSorted, itemsSorted, itemFlags } from '../logic.js';
import { saveGroup, deleteGroup } from '../actions.js';
import { emptyHTML } from '../components.js';
import { setInventoryGroup } from './inventory.js';

export function renderGroups(el) {
  const E = can('edit'); const all = itemsSorted();
  el.innerHTML = `<div class="pagehead"><h2>Grupos</h2>${E ? '<button class="btn pri" id="addGroup">+ Grupo</button>' : ''}</div>
    <p class="hint">Grupos organizam o inventário e podem ser adicionados inteiros à lista de um projeto.</p>
    <div class="grid">${!S.loaded.groups ? emptyHTML('Carregando…') : groupsSorted().map(g => {
      const its = all.filter(i => i.group === g.id); const free = its.filter(i => itemFlags(i).free).length;
      const man = its.filter(i => i.status === 'owned' && i.condition !== 'ok').length, pend = its.filter(i => i.status !== 'owned').length;
      return `<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><h3>${esc(g.name)}</h3><span class="id">${esc(g.id)}</span></div>
        ${g.desc ? `<div class="meta">${esc(g.desc)}</div>` : ''}
        <div class="pills" style="justify-content:flex-start"><span class="pill p-idle">${its.length} itens</span>${free ? `<span class="pill p-ok">${free} livres</span>` : ''}${man ? `<span class="pill p-warn">${man} manutenção</span>` : ''}${pend ? `<span class="pill p-acc">${pend} a chegar/comprar</span>` : ''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" data-gview="${esc(g.id)}">Ver itens</button>${E ? `<button class="btn sm" data-gedit="${esc(g.id)}">Editar</button>` : ''}</div></div>`; }).join('')}</div>`;
  $$('[data-gview]', el).forEach(b => b.addEventListener('click', () => { setInventoryGroup(b.dataset.gview); location.hash = '#/inventario'; }));
  $$('[data-gedit]', el).forEach(b => b.addEventListener('click', () => editGroup(b.dataset.gedit)));
  el.querySelector('#addGroup')?.addEventListener('click', () => editGroup(null));
}

function editGroup(gid) {
  const isNew = !gid; const g = isNew ? { name: '', desc: '' } : S.groups.get(gid);
  const count = isNew ? 0 : itemsSorted().filter(i => i.group === gid).length;
  openSheet(`<div class="sheet-h"><div><span class="hint">${isNew ? 'Novo grupo' : 'Editar grupo'}</span><h2>${isNew ? 'Criar grupo' : esc(g.name)}</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
    <form class="form" id="gf"><label>Nome<input type="text" id="g-name" required value="${esc(g.name)}"></label>
      ${isNew ? '<label>Sigla (2 a 4 letras, usada nos IDs)<input type="text" id="g-id" required maxlength="4" placeholder="Ex.: SOM" style="text-transform:uppercase"></label>' : ''}
      <label>Descrição<input type="text" id="g-desc" value="${esc(g.desc || '')}"></label>
      ${!isNew && count ? `<label>Ao excluir, mover os ${count} itens para<select id="g-move">${groupsSorted().filter(x => x.id !== gid).map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label>` : ''}
      <div class="actions"><div>${isNew ? '' : '<button type="button" class="btn danger" id="gdel">Excluir grupo</button>'}</div><div class="r"><button type="button" class="btn" data-close>Cancelar</button><button class="btn pri" type="submit">Salvar</button></div></div></form>`, sh => {
    sh.querySelector('#gf').addEventListener('submit', e => { e.preventDefault();
      const name = sh.querySelector('#g-name').value.trim(); if (!name) return;
      let id = gid; if (isNew) { id = sh.querySelector('#g-id').value.trim().toUpperCase(); if (!/^[A-Z]{2,4}$/.test(id)) return toast('Use de 2 a 4 letras na sigla.'); if (S.groups.has(id)) return toast('Essa sigla já existe.'); }
      const order = isNew ? Math.max(-1, ...groupsSorted().map(x => x.order ?? 0)) + 1 : (g.order ?? 0);
      saveGroup(id, { name, desc: sh.querySelector('#g-desc').value.trim(), order }); closeSheet(); toast('Grupo salvo'); });
    const del = sh.querySelector('#gdel');
    del && armButton(del, count ? `Mover ${count} itens e excluir` : 'Confirmar exclusão', () => {
      const to = sh.querySelector('#g-move')?.value; if (count && !to) return toast('Crie outro grupo antes.');
      deleteGroup(gid, to); closeSheet(); toast('Grupo excluído'); });
  });
}
