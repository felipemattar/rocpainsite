// Página do projeto: Resumo · Diárias · Equipamentos · Equipe
import { S, can, canEditProject } from '../store.js';
import { esc, fmtD, fmtDM, wday, todayStr, openSheet, closeSheet, toast, armButton, $$ } from '../utils.js';
import { FUNCTIONS, DEFAULT_TIMES } from '../config.js';
import { blocks, projectStatus, featuredDay, getDay, conflictsFor, warningsFor, sortPeople, personName, personFuncs, funcLabel,
  vehiclesOf, projItems, stockOf, groupsSorted, gName, itemsSorted, allMembers, dayPeople, ackState, ITEM_STATUS, CONDITIONS, timeline } from '../logic.js';
import { projBody, setProject, saveProjectChecked, deleteProject } from '../actions.js';
import { dayCardHTML, personLine, thumbHTML, emptyHTML, funcsText } from '../components.js';
import { openItem } from './inventory.js';

const TABS = [['resumo', 'Resumo'], ['diarias', 'Diárias'], ['equipamentos', 'Equipamentos'], ['equipe', 'Equipe']];

export function renderProject(el, pid, tab = 'resumo') {
  const raw = S.projects.get(pid);
  if (!raw) { el.innerHTML = emptyHTML(S.loaded.projects ? 'Projeto não encontrado ou sem acesso. <a href="#/">Voltar</a>' : 'Carregando…'); return; }
  const p = { id: pid, ...raw }; const st = projectStatus(p); const E = canEditProject(p), DEL = can('edit');
  if (!TABS.some(t => t[0] === tab)) tab = 'resumo';
  el.innerHTML = `
    <a class="btn ghost back" href="#/">← Projetos</a>
    <div class="phead"><div style="min-width:0"><span class="pill ${{ ongoing: 'p-use', upcoming: 'p-acc' }[st.k] || 'p-idle'}">${st.t}</span><h2>${esc(p.name)}</h2>
      ${p.notes ? `<p class="hint" style="font-size:14px;margin:6px 0 0">${esc(p.notes)}</p>` : ''}</div>
      ${E ? `<div style="display:flex;gap:6px"><button class="btn sm" id="pedit">Editar</button>${DEL ? '<button class="btn sm danger" id="pdel">Excluir</button>' : ''}</div>` : ''}</div>
    <nav class="tabs subtabs">${TABS.map(([k, t]) => `<a class="tab" href="#/projeto/${esc(pid)}/${k}" aria-selected="${k === tab}">${t}</a>`).join('')}</nav>
    <div id="pbody"></div>`;
  if (E) {
    el.querySelector('#pedit').addEventListener('click', () => editProject(pid));
    el.querySelector('#pdel') && armButton(el.querySelector('#pdel'), 'Confirmar exclusão', () => { deleteProject(pid); toast('Projeto excluído'); location.hash = '#/'; });
  }
  const body = el.querySelector('#pbody');
  ({ resumo: tabResumo, diarias: tabDiarias, equipamentos: tabEquip, equipe: tabEquipe })[tab](body, p);
}

function editProject(pid) {
  const p = S.projects.get(pid);
  openSheet(`<div class="sheet-h"><div><span class="hint">Editar projeto</span><h2>${esc(p.name)}</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
    <form class="form" id="pf"><label>Nome<input type="text" id="p-name" required value="${esc(p.name)}"></label><label>Observações<textarea id="p-notes">${esc(p.notes || '')}</textarea></label>
    <div class="actions"><span></span><div class="r"><button type="button" class="btn" data-close>Cancelar</button><button class="btn pri" type="submit">Salvar</button></div></div></form>`, sh => {
    sh.querySelector('#pf').addEventListener('submit', e => { e.preventDefault(); const np = projBody(pid);
      np.name = sh.querySelector('#p-name').value.trim() || np.name; np.notes = sh.querySelector('#p-notes').value.trim(); setProject(pid, np); closeSheet(); });
  });
}

// ---------------- RESUMO ----------------
function tabResumo(el, p) {
  const fd = featuredDay(p); const bl = blocks(p);
  const E = canEditProject(p); const conf = E ? conflictsFor(p) : []; const warn = E ? warningsFor(p) : [];
  el.innerHTML = `
    ${fd ? (S.proj.loaded ? dayCardHTML(p, p.id, fd.date, getDay(p, fd.date), { kind: fd.kind, button: true }) : emptyHTML('Carregando diária…'))
      : `<div class="empty">${bl.length ? 'As diárias deste projeto já passaram.' : 'Defina as datas na aba Diárias.'}</div>`}
    ${conf.length ? `<div class="section"><div class="alert bad"><strong>⚠ Conflito de equipamento</strong><ul>${conf.map(c => `<li><span class="id">${esc(c.itemId)}</span> ${esc(S.items.get(c.itemId)?.name || '')} — ${fmtD(c.date)}: também em ${c.others.map(o => `<a href="#/projeto/${esc(o)}/equipamentos">${esc(S.projects.get(o)?.name || '')}</a>`).join(', ')} (precisa ${c.need}, há ${c.have})</li>`).join('')}</ul></div></div>` : ''}
    ${warn.length ? `<div class="section"><div class="alert warn"><strong>Equipamentos com atenção</strong><ul>${warn.map(w => `<li><span class="id">${esc(w.itemId)}</span> ${esc(S.items.get(w.itemId)?.name || '')} — ${esc(w.t)}</li>`).join('')}</ul></div></div>` : ''}
`;
}

// ---------------- DIÁRIAS ----------------
function summaryHTML(p) {
  const bl = blocks(p); const team = sortPeople(p, p.team || []);
  const nDays = bl.reduce((a, b) => a + b.days.length, 0);
  return `
    <div class="summary">
      <div class="section"><h3>Expedição</h3>
        ${bl.length ? `<ul class="plain">${bl.map((b, i) => `<li><b>${b.label ? esc(b.label) : `Bloco ${i + 1}`}</b> · ${fmtD(b.start)}${b.end !== b.start ? ' a ' + fmtD(b.end) : ''} <span class="hint">(${b.days.length} dia${b.days.length > 1 ? 's' : ''})</span></li>`).join('')}</ul>
        <p class="hint">${nDays} diárias no total.</p>` : '<p class="hint">Sem datas.</p>'}
      </div>
      <div class="section"><h3>Equipe · ${team.length}</h3><div class="people">${team.length ? team.map(e => personLine(p, e)).join('') : '<span class="hint">Ninguém ainda.</span>'}</div></div>
      <div class="section"><h3>Recursos</h3><ul class="plain">
        <li>${vehiclesOf(p).map(v => esc(v.name)).join(' · ')}</li>
        <li>${(p.items || []).length} equipamentos na lista</li></ul></div>
    </div>`;
}
function tabDiarias(el, p) {
  const E = canEditProject(p); const bl = blocks(p); const t = todayStr();
  el.innerHTML = `${summaryHTML(p)}
    ${E ? `<div class="section"><h3>Blocos de datas</h3>
      <form class="inline-form" id="dform"><label>Início<input type="date" id="d-s" required></label><label>Fim<input type="date" id="d-e"></label>
      <label>Nome do bloco<input type="text" id="d-l" placeholder="Ex.: Expedição Guriri" size="18"></label><button class="btn" type="submit">Adicionar bloco</button></form></div>` : ''}
    ${!bl.length ? emptyHTML('Nenhuma data ainda.') : bl.map((b, i) => `
      <div class="gsec block"><div class="ghead"><h2>${b.label ? esc(b.label) : `Bloco ${i + 1}`}</h2><small>${fmtD(b.start)}${b.end !== b.start ? ' a ' + fmtD(b.end) : ''} · ${b.days.length} dia${b.days.length > 1 ? 's' : ''}</small>
        ${E ? `<span style="margin-left:auto;display:flex;gap:6px"><button class="btn sm ghost" data-rnblock="${b.idx}">Renomear</button><button class="btn sm danger" data-rmblock="${b.idx}">Remover</button></span>` : ''}</div>
        <div class="daylist">${b.days.map((d, j) => dayRow(p, d, j + 1, t)).join('')}</div></div>`).join('')}`;
  if (!E) return;
  const ds = el.querySelector('#d-s'), de = el.querySelector('#d-e');
  ds.addEventListener('change', () => { if (!de.value || de.value < ds.value) de.value = ds.value; });
  el.querySelector('#dform').addEventListener('submit', e => { e.preventDefault();
    const s = ds.value, en = de.value || s; if (en < s) { toast('A data final é antes da inicial.'); return; }
    const np = projBody(p.id); np.dates = [...(np.dates || []), { start: s, end: en, label: el.querySelector('#d-l').value.trim() }].sort((a, b) => a.start.localeCompare(b.start));
    saveProjectChecked(p.id, np, 'Bloco adicionado'); });
  $$('[data-rmblock]', el).forEach(b => armButton(b, 'Confirmar', () => { const np = projBody(p.id); np.dates.splice(+b.dataset.rmblock, 1); setProject(p.id, np); }));
  $$('[data-rnblock]', el).forEach(b => b.addEventListener('click', () => {
    const i = +b.dataset.rnblock; const cur = p.dates[i];
    openSheet(`<div class="sheet-h"><div><span class="hint">${fmtRange2(cur)}</span><h2>Bloco de datas</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
      <form class="form" id="bf"><label>Nome<input type="text" id="b-l" value="${esc(cur.label || '')}"></label>
      <div class="two"><label>Início<input type="date" id="b-s" value="${cur.start}"></label><label>Fim<input type="date" id="b-e" value="${cur.end}"></label></div>
      <div class="actions"><span></span><div class="r"><button type="button" class="btn" data-close>Cancelar</button><button class="btn pri" type="submit">Salvar</button></div></div></form>`, sh => {
      sh.querySelector('#bf').addEventListener('submit', e => { e.preventDefault(); const np = projBody(p.id);
        const s = sh.querySelector('#b-s').value, en = sh.querySelector('#b-e').value || s; if (en < s) { toast('A data final é antes da inicial.'); return; }
        np.dates[i] = { start: s, end: en, label: sh.querySelector('#b-l').value.trim() }; np.dates.sort((a, b) => a.start.localeCompare(b.start));
        closeSheet(); saveProjectChecked(p.id, np, 'Bloco atualizado'); });
    });
  }));
}
const fmtRange2 = r => fmtD(r.start) + (r.end !== r.start ? ' a ' + fmtD(r.end) : '');
function dayRow(p, d, n, t) {
  const day = getDay(p, d);
  const locs = day.fronts.map(f => f.local).filter(Boolean);
  const saida = day.fronts.map(f => f.times?.saida).filter(Boolean).sort()[0];
  const people = dayPeople(day); const ok = people.filter(e => ackState(p.id, d, e, day).k === 'ok').length;
  const nItems = Object.keys(day.items || {}).length;
  const meIn = people.includes(S.me); const myAck = meIn ? ackState(p.id, d, S.me, day).k : null;
  return `<a class="dayrow-link ${d === t ? 'today' : ''} ${d < t ? 'past' : ''}" href="#/projeto/${esc(p.id)}/diaria/${d}">
    <span class="dnum"><b>${fmtDM(d)}</b><small>${wday(d)} · dia ${n}</small></span>
    <span class="dmain"><span class="name">${locs.length ? esc(locs.join(' / ')) : '<span class="hint">Local a definir</span>'}</span>
      <span class="meta">${saida ? `saída ${esc(saida)} · ` : ''}${day.fronts.length > 1 ? day.fronts.length + ' frentes · ' : ''}${people.length} pessoas · ${nItems} equip.</span></span>
    <span class="pills">${d === t ? '<span class="pill p-use">hoje</span>' : ''}${!day.saved ? '<span class="pill p-idle">rascunho</span>' : ''}
      ${people.length ? `<span class="pill ${ok === people.length ? 'p-ok' : 'p-warn'}">${ok}/${people.length}</span>` : ''}
      ${myAck === 'none' || myAck === 'old' ? '<span class="pill p-bad">confirme</span>' : ''}</span>
  </a>`;
}

// ---------------- EQUIPAMENTOS ----------------
function tabEquip(el, p) {
  const E = canEditProject(p); const pid = p.id;
  const items = projItems(p); const vehs = vehiclesOf(p);
  const nk = items.filter(x => p.checked?.[x.id]).length;
  const byG = new Map(); for (const x of items) { if (!byG.has(x.it.group)) byG.set(x.it.group, []); byG.get(x.it.group).push(x); }
  const conf = conflictsFor(p);
  el.innerHTML = `
    <div class="section"><h3>Veículos</h3>
      <div class="dates">${vehs.map(v => `<span class="date">${esc(v.name)} ${E ? `<button class="pill ${v.daily ? 'p-use' : 'p-idle'}" style="border:0;cursor:pointer" data-vdaily="${esc(v.id)}">${v.daily ? 'viagem e diárias' : 'só viagem'}</button><button class="x" data-rmveh="${esc(v.id)}" aria-label="Remover veículo">×</button>` : `<small>${v.daily ? 'viagem e diárias' : 'só viagem'}</small>`}</span>`).join('')}</div>
      ${E ? '<form class="inline-form" id="vform"><label>Novo veículo<input type="text" id="v-n" placeholder="Ex.: Barco" size="16"></label><button class="btn" type="submit">Adicionar</button></form>' : ''}
      <p class="hint">“Só viagem” aparece no carregamento sede → hospedagem. Nas diárias entram os de “viagem e diárias”.</p></div>
    <div class="section"><h3>Lista geral · carregamento na sede ${nk}/${items.length}</h3>
      <div class="prog" style="margin-bottom:10px"><i style="width:${items.length ? Math.round(nk / items.length * 100) : 0}%"></i></div>
      ${E ? `<div class="bar" style="margin-top:0"><button class="btn pri" id="padd">+ Equipamentos</button>
        <select class="sel" id="pgsel" aria-label="Grupo para adicionar"><option value="">Adicionar grupo inteiro…</option>${groupsSorted().map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select>
        <label class="toggle"><input type="checkbox" id="pgall"> incluir encomendados / a comprar</label>
        <span style="flex:1"></span>${nk ? '<button class="btn sm" id="punchk">Desmarcar todos</button>' : ''}</div>` : ''}
      ${items.length ? [...byG.entries()].map(([g, arr]) => `<div class="gsec" style="margin-top:12px"><div class="ghead"><h2 style="font-size:17px">${esc(gName(g))}</h2><small>${arr.length}</small></div>
        ${arr.map(x => { const st = stockOf(x.id), q = x.qty || 1;
          return `<div class="check ${p.checked?.[x.id] ? 'done' : ''}">
          <input type="checkbox" data-chk="${esc(x.id)}" ${p.checked?.[x.id] ? 'checked' : ''} ${E ? '' : 'disabled'} aria-label="Conferido na saída">
          ${thumbHTML(x.it)}<span class="id">${esc(x.id)}</span>
          <span class="main" data-item="${esc(x.id)}"><span class="name">${esc(x.it.name)}</span>${conf.some(c => c.itemId === x.id) ? ' <span class="pill p-bad">conflito</span>' : ''}${q > st ? ` <span class="pill p-bad">só há ${st}</span>` : ''}
            <div class="meta ctlrow"><select class="sel xs" data-load="${esc(x.id)}" ${E ? '' : 'disabled'} aria-label="Veículo na viagem"><option value="">Veículo…</option>${vehs.map(v => `<option value="${esc(v.id)}" ${p.load?.[x.id] === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>
            ${st > 1 || q > 1 ? stepper('pq', x.id, q, st, E) : ''}</div></span>
          ${E ? `<button class="x" data-rmit="${esc(x.id)}" aria-label="Remover do projeto">×</button>` : '<span></span>'}
        </div>`; }).join('')}</div>`).join('') : emptyHTML('Nenhum equipamento nesta lista ainda.')}
    </div>`;
  $$('[data-item]', el).forEach(a => a.addEventListener('click', e => { if (e.target.closest('select,button,.stepper')) return; openItem(a.dataset.item); }));
  if (!E) return;
  const upd = fn => { const np = projBody(pid); fn(np); setProject(pid, np); };
  $$('[data-vdaily]', el).forEach(b => b.addEventListener('click', () => upd(np => { np.vehicles = vehiclesOf(np).map(v => v.id === b.dataset.vdaily ? { ...v, daily: !v.daily } : v); })));
  $$('[data-rmveh]', el).forEach(b => b.addEventListener('click', () => upd(np => { const id = b.dataset.rmveh; np.vehicles = vehiclesOf(np).filter(v => v.id !== id);
    if (np.load) for (const k of Object.keys(np.load)) if (np.load[k] === id) delete np.load[k]; })));
  el.querySelector('#vform').addEventListener('submit', e => { e.preventDefault(); const n = el.querySelector('#v-n').value.trim(); if (!n) return;
    upd(np => { const vs = vehiclesOf(np); let id = n.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'v'; while (vs.some(v => v.id === id)) id += '2'; np.vehicles = [...vs, { id, name: n, daily: true }]; }); });
  el.querySelector('#padd').addEventListener('click', () => pickItems(pid));
  el.querySelector('#pgsel').addEventListener('change', e => { const g = e.target.value; if (!g) return; e.target.value = '';
    const incl = el.querySelector('#pgall').checked; const np = projBody(pid); const have = new Set(np.items.map(x => x.id));
    const add = itemsSorted().filter(it => it.group === g && !have.has(it.id) && (incl || it.status === 'owned') && (it.qty || 0) > 0);
    if (!add.length) { toast('Nenhum item novo desse grupo para adicionar.'); return; }
    np.items = [...np.items, ...add.map(it => ({ id: it.id, qty: Math.max(1, it.qty || 1) }))];
    saveProjectChecked(pid, np, `${add.length} itens de ${gName(g)} adicionados`); });
  el.querySelector('#punchk')?.addEventListener('click', () => upd(np => { np.checked = {}; }));
  $$('[data-chk]', el).forEach(c => c.addEventListener('change', () => upd(np => { np.checked = { ...(np.checked || {}) }; if (c.checked) np.checked[c.dataset.chk] = true; else delete np.checked[c.dataset.chk]; })));
  $$('[data-load]', el).forEach(s => s.addEventListener('change', () => upd(np => { np.load = { ...(np.load || {}) }; if (s.value) np.load[s.dataset.load] = s.value; else delete np.load[s.dataset.load]; })));
  $$('[data-rmit]', el).forEach(b => b.addEventListener('click', () => upd(np => { const id = b.dataset.rmit; np.items = np.items.filter(x => x.id !== id); if (np.checked) delete np.checked[id]; if (np.load) delete np.load[id]; })));
  $$('[data-pq]', el).forEach(b => b.addEventListener('click', () => { const id = b.dataset.pq; const np = projBody(pid); const e = np.items.find(x => x.id === id); const st = stockOf(id);
    const nq = Math.max(1, Math.min(st || 1, (e.qty || 1) + (+b.dataset.d))); if (nq === (e.qty || 1)) return; e.qty = nq; saveProjectChecked(pid, np); }));
}
export const stepper = (key, id, q, max, on = true) =>
  `<span class="stepper sm">${on ? `<button data-${key}="${esc(id)}" data-d="-1" ${q <= 1 ? 'disabled' : ''} aria-label="Menos">−</button>` : ''}<span>${q}<small class="hint">/${max}</small></span>${on ? `<button data-${key}="${esc(id)}" data-d="1" ${q >= max ? 'disabled' : ''} aria-label="Mais">+</button>` : ''}</span>`;

function pickItems(pid) {
  const p = { id: pid, ...S.projects.get(pid) }; const have = new Set((p.items || []).map(x => x.id)); const sel = new Map();
  let q = '', g = '';
  const busy = id => { if (!(p.dates || []).length) return ''; const c = conflictsFor({ ...p, items: [...(p.items || []), { id, qty: sel.get(id) || 1 }] }).filter(x => x.itemId === id);
    return c.length ? `ocupado ${fmtD(c[0].date)} · ${S.projects.get(c[0].others[0])?.name || ''}` : ''; };
  openSheet(`<div class="sheet-h"><div><span class="hint">${esc(p.name)}</span><h2>Adicionar equipamentos</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
    <div class="bar" style="margin-top:0"><input class="search" id="pq" type="search" placeholder="Buscar…"><select class="sel" id="pg"><option value="">Todos os grupos</option>${groupsSorted().map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></div>
    <div id="plist"></div>
    <div class="actions stickyfoot"><span class="hint" id="pcount">Nenhum selecionado</span><div class="r"><button class="btn" data-close>Cancelar</button><button class="btn pri" id="pok">Adicionar</button></div></div>`, sh => {
    const count = () => { sh.querySelector('#pcount').textContent = sel.size ? `${sel.size} selecionado${sel.size > 1 ? 's' : ''}` : 'Nenhum selecionado'; };
    const draw = () => { const ql = q.toLowerCase();
      const arr = itemsSorted().filter(it => !have.has(it.id) && (it.qty || 0) > 0 && (!g || it.group === g) && (!ql || (it.id + ' ' + it.name).toLowerCase().includes(ql)));
      sh.querySelector('#plist').innerHTML = arr.length ? arr.map(it => { const b = busy(it.id); const na = it.status !== 'owned' ? ITEM_STATUS[it.status].t : it.condition !== 'ok' ? CONDITIONS[it.condition].t : '';
        const st = it.qty || 1, on = sel.has(it.id), qv = sel.get(it.id) || 1;
        return `<div class="pick ${na ? 'dis' : ''}"><input type="checkbox" data-pk="${esc(it.id)}" ${on ? 'checked' : ''} id="pk-${esc(it.id)}"><span class="id">${esc(it.id)}</span>
          <label class="main" for="pk-${esc(it.id)}"><span class="name">${esc(it.name)}</span>${st > 1 ? ` <span class="qty">· ${st} no inventário</span>` : ''}${b || na ? `<div class="meta">${[b ? `<span style="color:var(--bad)">⚠ ${esc(b)}</span>` : '', na ? esc(na) : ''].filter(Boolean).join(' · ')}</div>` : ''}</label>
          ${st > 1 ? stepper('sq', it.id, qv, st) : `<span class="hint">${esc(gName(it.group))}</span>`}</div>`; }).join('') : emptyHTML('Nada para adicionar com esse filtro.');
      $$('[data-pk]', sh).forEach(c => c.addEventListener('change', () => { c.checked ? sel.set(c.dataset.pk, sel.get(c.dataset.pk) || 1) : sel.delete(c.dataset.pk); count(); }));
      $$('[data-sq]', sh).forEach(b => b.addEventListener('click', () => { const id = b.dataset.sq, st = S.items.get(id)?.qty || 1; sel.set(id, Math.max(1, Math.min(st, (sel.get(id) || 1) + (+b.dataset.d)))); count(); draw(); }));
    };
    sh.querySelector('#pq').addEventListener('input', e => { q = e.target.value; draw(); });
    sh.querySelector('#pg').addEventListener('change', e => { g = e.target.value; draw(); });
    sh.querySelector('#pok').addEventListener('click', () => { if (!sel.size) { closeSheet(); return; } const np = projBody(pid);
      np.items = [...(np.items || []), ...[...sel].map(([id, qty]) => ({ id, qty }))]; closeSheet(); saveProjectChecked(pid, np, `${sel.size} equipamento${sel.size > 1 ? 's' : ''} adicionado${sel.size > 1 ? 's' : ''}`); });
    draw();
  });
}

// ---------------- EQUIPE ----------------
function tabEquipe(el, p) {
  const E = canEditProject(p); const pid = p.id;
  const team = sortPeople(p, p.team || []);
  const free = allMembers().filter(e => !team.includes(e));
  el.innerHTML = `
    ${E ? `<div class="section"><h3>Adicionar pessoa ao projeto</h3>
      ${free.length ? `<div class="inline-form" style="margin-top:0"><select class="sel" id="addp" aria-label="Pessoa"><option value="">Escolha da equipe cadastrada…</option>${free.map(e => `<option value="${esc(e)}">${esc(personName(e))}</option>`).join('')}</select></div>`
      : '<p class="hint">Todas as pessoas cadastradas já estão no projeto. Novos acessos são criados pelo administrador na aba Equipe do app.</p>'}</div>` : ''}
    <div class="section"><h3>Equipe do projeto · ${team.length}</h3>
      <p class="hint">Ordenada pela hierarquia de função. Membros só veem os projetos em que estão incluídos.</p>
      <div class="rows">${team.map(e => `<div class="row static">
        <span class="main"><span class="name">${esc(personName(e))}</span>${e === S.me ? ' <span class="pill p-use">você</span>' : ''}
          <div class="meta">${personFuncs(p, e).length ? personFuncs(p, e).map(f => `<span class="pill p-acc">${esc(funcLabel(f))}</span>`).join(' ') : '<span class="hint">sem função</span>'}</div></span>
        ${E ? `<button class="btn sm" data-funcs="${esc(e)}">Funções</button>${e !== S.me || can('edit') ? `<button class="x" data-rmp="${esc(e)}" aria-label="Retirar do projeto">×</button>` : '<span></span>'}` : '<span></span><span></span>'}
      </div>`).join('') || emptyHTML('Ninguém no projeto ainda.')}</div></div>`;
  if (!E) return;
  el.querySelector('#addp')?.addEventListener('change', e => { const v = e.target.value; if (!v) return; const np = projBody(pid); np.team = [...(np.team || []), v]; setProject(pid, np); funcSheet(pid, v); });
  $$('[data-rmp]', el).forEach(b => armButton(b, '✓', () => { const e = b.dataset.rmp; const np = projBody(pid); np.team = (np.team || []).filter(x => x !== e); if (np.roles) delete np.roles[e]; setProject(pid, np); }));
  $$('[data-funcs]', el).forEach(b => b.addEventListener('click', () => funcSheet(pid, b.dataset.funcs)));
}
function funcSheet(pid, email) {
  const p = S.projects.get(pid) || {}; const cur = new Set(p.roles?.[email] || []);
  openSheet(`<div class="sheet-h"><div><span class="hint">${esc(p.name || '')}</span><h2>Funções de ${esc(personName(email))}</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
    <div class="checks">${FUNCTIONS.map(f => `<label class="checkline"><input type="checkbox" value="${esc(f.id)}" ${cur.has(f.id) ? 'checked' : ''}> ${esc(f.label)}</label>`).join('')}</div>
    <div class="actions"><span class="hint">Pode marcar mais de uma.</span><div class="r"><button class="btn" data-close>Cancelar</button><button class="btn pri" id="fok">Salvar</button></div></div>`, sh => {
    sh.querySelector('#fok').addEventListener('click', () => { const np = projBody(pid); np.roles = { ...(np.roles || {}) };
      np.roles[email] = $$('input:checked', sh).map(i => i.value); if (!np.team?.includes(email)) np.team = [...(np.team || []), email];
      setProject(pid, np); closeSheet(); });
  });
}
