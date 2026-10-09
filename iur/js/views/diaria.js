// Página da diária: frentes (local, horários, equipe, carros), equipamentos do dia e "ciente"
import { S, can, canEditProject } from '../store.js';
import { DEFAULT_TIMES, PLACE_SEARCH } from '../config.js';
import { esc, fmtD, fmtDM, wday, wdayLong, todayStr, toast, armButton, $$ } from '../utils.js';
import { getDay, projectDays, blockOf, blocks, newFront, dailyVehicles, vehName, sortPeople, personName, ackState, dayPeople, projItems, gName, destinations, carPlan, unseat, placeFromPhoton, isMapsLink, mapsSearchURL } from '../logic.js';
import { saveDay, setAck } from '../actions.js';
import { personLine, timelineHTML, thumbHTML, emptyHTML, carsHTML, placeHTML, ackPanelHTML } from '../components.js';
import { stepper } from './project.js';
import { openItem } from './inventory.js';
import { ls } from '../utils.js';

const clone = o => JSON.parse(JSON.stringify(o));

export function renderDiaria(el, pid, date) {
  const raw = S.projects.get(pid);
  if (!raw) { el.innerHTML = emptyHTML(S.loaded.projects ? 'Projeto não encontrado ou sem acesso. <a href="#/">Voltar</a>' : 'Carregando…'); return; }
  const p = { id: pid, ...raw };
  const days = projectDays(p);
  if (!days.includes(date)) { el.innerHTML = emptyHTML(`Esta data não faz parte do projeto. <a href="#/projeto/${esc(pid)}/diarias">Ver diárias</a>`); return; }
  if (!S.proj.loaded) { el.innerHTML = emptyHTML('Carregando diária…'); return; }
  const E = canEditProject(p);
  const day = getDay(p, date);
  const idx = days.indexOf(date), prev = days[idx - 1], next = days[idx + 1];
  const blk = blockOf(p, date); const bIdx = blocks(p).findIndex(b => b === blk || (b.start === blk?.start && b.end === blk?.end));
  const commit = mut => { const d = clone(day); mut(d); saveDay(pid, date, d); };

  el.innerHTML = `
    <a class="btn ghost back" href="#/projeto/${esc(pid)}/diarias">← ${esc(p.name)}</a>
    <div class="dayhead">
      <a class="btn sm ${prev ? '' : 'disabled'}" ${prev ? `href="#/projeto/${esc(pid)}/diaria/${prev}"` : 'aria-disabled="true"'} aria-label="Dia anterior">‹</a>
      <div class="dh-mid"><span class="eyebrow">${esc(blk?.label || `Bloco ${bIdx + 1}`)} · dia ${blk ? blk.days.indexOf(date) + 1 : idx + 1} de ${blk ? blk.days.length : days.length}</span>
        <h2>${esc(wdayLong(date))}, ${fmtD(date)}</h2>
        ${date === todayStr() ? '<span class="pill p-use">hoje</span>' : ''}</div>
      <a class="btn sm ${next ? '' : 'disabled'}" ${next ? `href="#/projeto/${esc(pid)}/diaria/${next}"` : 'aria-disabled="true"'} aria-label="Próximo dia">›</a>
    </div>
    ${E && !day.saved ? '<div class="banner">Rascunho com os valores padrão. Qualquer alteração já salva a diária.</div>' : ''}
    <div class="section">${ackPanelHTML(p, date, day)}</div>
    <div class="section"><h3>Informações gerais</h3>
      ${E ? `<textarea class="area" id="d-info" placeholder="Maré, previsão do tempo, contatos, avisos para todos…">${esc(day.info)}</textarea>` : (day.info ? `<p class="info">${esc(day.info)}</p>` : '<p class="hint">—</p>')}
      ${E && prev ? '<div class="bar"><button class="btn sm" id="copyPrev">Copiar tudo do dia anterior</button></div>' : ''}
    </div>
    <div class="section"><h3>${day.fronts.length > 1 ? `Frentes de trabalho · ${day.fronts.length}` : 'Programação'}</h3>
      <div class="fronts">${day.fronts.map((f, i) => E ? frontEdit(p, day, f, i) : frontView(p, day, f)).join('')}</div>
      ${E ? '<div class="bar"><button class="btn" id="addFront">+ Nova frente</button><span class="hint">Use frentes quando parte da equipe e dos equipamentos vai para outro local no mesmo dia.</span></div>' : ''}
    </div>
    ${equipSection(p, day, E)}`;

  // ---- ciente ----
  el.querySelector('[data-ack]')?.addEventListener('click', () => { const st = ackState(pid, date, S.me, day).k; setAck(pid, date, st !== 'ok'); });
  $$('[data-item]', el).forEach(a => a.addEventListener('click', e => { if (e.target.closest('select,button,.stepper')) return; openItem(a.dataset.item); }));
  $$('[data-dview]', el).forEach(s => s.addEventListener('change', () => { ls.set('iur.dview', s.value); renderDiaria(el, pid, date); }));
  if (!E) return;

  // ---- edição ----
  el.querySelector('#d-info').addEventListener('change', e => commit(d => { d.info = e.target.value.trim(); }));
  el.querySelector('#copyPrev')?.addEventListener('click', () => {
    const src = getDay(p, prev); const d = clone(src); delete d.saved; d.fronts.forEach(f => { f.extra = f.extra || []; });
    saveDay(pid, date, d); toast(`Copiado de ${fmtDM(prev)}`); });
  el.querySelector('#addFront').addEventListener('click', () => commit(d => { d.fronts.push(newFront(p, d.fronts.length + 1)); }));
  const fr = (fid, fn) => commit(d => { const f = d.fronts.find(x => x.id === fid); if (f) fn(f, d); });
  $$('[data-fld]', el).forEach(inp => inp.addEventListener('change', () => { const [fid, k] = inp.dataset.fld.split('|'); fr(fid, f => { f[k] = inp.value.trim(); }); }));
  $$('[data-time]', el).forEach(inp => inp.addEventListener('change', () => { const [fid, k] = inp.dataset.time.split('|'); fr(fid, f => { f.times = { ...f.times, [k]: inp.value }; }); }));
  $$('[data-ex]', el).forEach(inp => inp.addEventListener('change', () => { const [fid, i, k] = inp.dataset.ex.split('|'); fr(fid, f => { f.extra[+i] = { ...f.extra[+i], [k]: inp.value.trim() }; }); }));
  $$('[data-rmex]', el).forEach(b => b.addEventListener('click', () => { const [fid, i] = b.dataset.rmex.split('|'); fr(fid, f => { f.extra.splice(+i, 1); }); }));
  $$('[data-addex]', el).forEach(b => b.addEventListener('click', () => fr(b.dataset.addex, f => { f.extra.push({ t: '', txt: '' }); })));
  $$('[data-tperson]', el).forEach(b => b.addEventListener('click', () => { const [fid, e] = b.dataset.tperson.split('|');
    commit(d => { const adding = !b.classList.contains('on');
      for (const f of d.fronts) { const had = f.people.includes(e);
        if (f.id === fid) f.people = had ? f.people.filter(x => x !== e) : [...f.people, e]; else if (adding) f.people = f.people.filter(x => x !== e);
        if (!f.people.includes(e)) unseat(f, e); } }); }));
  $$('[data-tveh]', el).forEach(b => b.addEventListener('click', () => { const [fid, v] = b.dataset.tveh.split('|');
    commit(d => { for (const f of d.fronts) { if (f.id === fid) f.vehicles = f.vehicles.includes(v) ? f.vehicles.filter(x => x !== v) : [...f.vehicles, v]; else if (!b.classList.contains('on')) f.vehicles = f.vehicles.filter(x => x !== v);
        if (!f.vehicles.includes(v) && f.seats) delete f.seats[v]; }
      for (const r of Object.values(d.items)) if (r.v === v && !d.fronts.find(f => f.id === r.f)?.vehicles.includes(v)) r.v = ''; }); }));
  // local no mapa
  $$('[data-psearch]', el).forEach(inp => {
    const fid = inp.dataset.psearch, box = el.querySelector('#ps-' + fid), gl = el.querySelector('#pg-' + fid);
    inp.addEventListener('input', () => { const q = inp.value.trim(); gl.href = mapsSearchURL(q || inp.placeholder);
      clearTimeout(searchTimer); if (q.length < 3) { box.hidden = true; return; }
      searchTimer = setTimeout(() => searchPlaces(q, box, pl => { box.hidden = true; inp.value = ''; inp.dataset.dirty = '';
        fr(fid, f => { f.place = pl; if (!f.local) f.local = pl.name; }); }), 450); });
    inp.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 200));
    inp.addEventListener('change', e => e.stopPropagation());
  });
  $$('[data-plink]', el).forEach(inp => inp.addEventListener('change', () => { const u = inp.value.trim(); if (!u) return;
    if (!/^https?:\/\//i.test(u)) return toast('Cole um link completo (https://…).');
    if (!isMapsLink(u)) toast('Link salvo, mas não parece ser do Google Maps.');
    fr(inp.dataset.plink, f => { f.place = { name: f.local || 'Local', desc: '', url: u }; }); }));
  $$('[data-rmplace]', el).forEach(b => b.addEventListener('click', () => fr(b.dataset.rmplace, f => { f.place = null; })));
  // lugares nos carros
  $$('[data-driver]', el).forEach(s => s.addEventListener('change', () => { const [fid, v] = s.dataset.driver.split('|');
    fr(fid, f => { const e = s.value; f.seats ||= {}; if (e) unseat(f, e); f.seats[v] = { ...(f.seats[v] || { people: [] }), driver: e }; }); }));
  $$('[data-seat]', el).forEach(b => b.addEventListener('click', () => { const [fid, v, e] = b.dataset.seat.split('|');
    fr(fid, f => { f.seats ||= {}; const inThis = (f.seats[v]?.people || []).includes(e); unseat(f, e);
      if (!inThis) { f.seats[v] = { driver: '', ...(f.seats[v] || {}) }; f.seats[v].people = [...(f.seats[v].people || []), e]; } }); }));
  $$('[data-rmfront]', el).forEach(b => armButton(b, 'Confirmar remoção', () => commit(d => { const fid = b.dataset.rmfront;
    d.fronts = d.fronts.filter(f => f.id !== fid); for (const k of Object.keys(d.items)) if (d.items[k].f === fid) delete d.items[k]; })));
  // equipamentos
  $$('[data-dest]', el).forEach(s => s.addEventListener('change', () => commit(d => { const id = s.dataset.dest;
    if (!s.value) delete d.items[id]; else { const [f, v] = s.value.split('|'); d.items[id] = { ...(d.items[id] || {}), f, v }; } })));
  $$('[data-dq]', el).forEach(b => b.addEventListener('click', () => commit(d => { const id = b.dataset.dq; const pq = (p.items.find(x => x.id === id)?.qty) || 1;
    const r = d.items[id]; if (!r) return; r.qty = Math.max(1, Math.min(pq, (r.qty || pq) + (+b.dataset.d))); })));
  el.querySelector('#allTo')?.addEventListener('change', e => { const v = e.target.value; if (!v) return; const [f, vv] = v.split('|');
    commit(d => { for (const x of projItems(p)) if (!d.items[x.id]) d.items[x.id] = { f, v: vv }; }); });
  el.querySelector('#allBase')?.addEventListener('click', () => commit(d => { d.items = {}; }));
}

// ---------- frente: visualização ----------
function frontView(p, day, f) {
  return `<section class="front">
    ${day.fronts.length > 1 ? `<h4>${esc(f.name)}</h4>` : ''}
    <div class="kv"><span>Local</span><b>${esc(f.local || 'a definir')}</b></div>
    ${placeHTML(f)}
    ${timelineHTML(f)}
    ${f.obs ? `<p class="info">${esc(f.obs)}</p>` : ''}
    ${carsHTML(p, f)}
    <div class="kv"><span>Equipe</span><div class="people">${f.people.length ? sortPeople(p, f.people).map(e => personLine(p, e)).join('') : '—'}</div></div>
  </section>`;
}

// ---------- frente: edição ----------
function frontEdit(p, day, f, i) {
  const team = sortPeople(p, p.team || []); const vehs = dailyVehicles(p);
  const where = (e, key) => day.fronts.find(x => x.id !== f.id && x[key].includes(e))?.name;
  return `<section class="front edit">
    <div class="front-top"><input class="title-in" id="fn-${f.id}" data-fld="${f.id}|name" value="${esc(f.name)}" aria-label="Nome da frente">
      ${day.fronts.length > 1 ? `<button class="btn sm danger" data-rmfront="${f.id}">Remover frente</button>` : ''}</div>
    <label class="lbl">Local / atividade<input type="text" id="fl-${f.id}" data-fld="${f.id}|local" value="${esc(f.local)}" placeholder="Ex.: Manguezal da Barra do Jucu — filmagem de caranguejos"></label>
    ${placeEdit(f)}
    <div class="lbl">Horários</div>
    <div class="times">
      ${DEFAULT_TIMES.map(t => `<label class="time"><span>${esc(t.label)}</span><input type="time" id="ft-${f.id}-${t.id}" data-time="${f.id}|${t.id}" value="${esc(f.times?.[t.id] || '')}"></label>`).join('')}
    </div>
    <div class="extras">${f.extra.map((x, j) => `<div class="extra"><input type="time" id="fx-${f.id}-${j}-t" data-ex="${f.id}|${j}|t" value="${esc(x.t || '')}" aria-label="Horário">
      <input type="text" id="fx-${f.id}-${j}-x" data-ex="${f.id}|${j}|txt" value="${esc(x.txt || '')}" placeholder="O que acontece (ex.: mudança para a praia de Guriri)"><button class="x" data-rmex="${f.id}|${j}" aria-label="Remover horário">×</button></div>`).join('')}
      <button class="btn sm" data-addex="${f.id}">+ Horário com observação</button></div>
    <label class="lbl">Observações da frente<textarea class="area sm" id="fo-${f.id}" data-fld="${f.id}|obs" placeholder="Ponto de encontro, maré, contato local…">${esc(f.obs)}</textarea></label>
    <div class="lbl">Equipe</div>
    <div class="chipset">${team.map(e => { const on = f.people.includes(e), w = where(e, 'people');
      return `<button class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-tperson="${f.id}|${esc(e)}">${esc(personName(e))}${w && !on ? ` <small>· ${esc(w)}</small>` : ''}</button>`; }).join('') || '<span class="hint">Adicione pessoas na aba Equipe do projeto.</span>'}</div>
    <div class="lbl">Carros</div>
    <div class="chipset">${vehs.map(v => { const on = f.vehicles.includes(v.id), w = where(v.id, 'vehicles');
      return `<button class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-tveh="${f.id}|${esc(v.id)}">${esc(v.name)}${w && !on ? ` <small>· ${esc(w)}</small>` : ''}</button>`; }).join('') || '<span class="hint">Nenhum veículo de diária. Ajuste na aba Equipamentos.</span>'}</div>
    ${seatsEdit(p, f)}
  </section>`;
}

// ---------- local no mapa ----------
function placeEdit(f) {
  const pl = f.place;
  return `<div class="lbl">Local no mapa</div>
    ${pl?.url ? `<div class="place-cur"><span><b>${esc(pl.name || 'Local')}</b>${pl.desc ? ` <small>${esc(pl.desc)}</small>` : ''}</span>
      <span class="place-links"><a class="btn sm" href="${esc(pl.url)}" target="_blank" rel="noopener">Ver no Google Maps</a><button class="btn sm danger" data-rmplace="${f.id}">Remover</button></span></div>` : ''}
    <div class="psearch"><input type="search" id="pq-${f.id}" data-psearch="${f.id}" placeholder="${pl?.url ? 'Trocar: digite o nome do local…' : 'Digite o nome do local (ex.: Barra do Jucu)'}" autocomplete="off">
      <div class="psugg" id="ps-${f.id}" hidden></div></div>
    <div class="plink"><input type="url" id="pl-${f.id}" data-plink="${f.id}" placeholder="ou cole o link de compartilhamento do Google Maps">
      <a class="btn sm" id="pg-${f.id}" href="${esc(mapsSearchURL(f.local || ''))}" target="_blank" rel="noopener">Procurar no Google Maps</a></div>`;
}
let searchTimer = null, searchCtl = null;
async function searchPlaces(q, box, onPick) {
  searchCtl?.abort(); searchCtl = new AbortController();
  const u = `${PLACE_SEARCH.url}?q=${encodeURIComponent(q)}&limit=${PLACE_SEARCH.limit}&lat=${PLACE_SEARCH.lat}&lon=${PLACE_SEARCH.lon}`;
  box.hidden = false; box.innerHTML = '<div class="hint" style="padding:8px">Buscando…</div>';
  try {
    const r = await fetch(u, { signal: searchCtl.signal }); const js = await r.json();
    const list = (js.features || []).map(placeFromPhoton).filter(x => x.lat != null);
    box.innerHTML = list.length ? list.map((x, i) => `<button type="button" data-pick="${i}"><b>${esc(x.name)}</b>${x.desc ? `<small>${esc(x.desc)}</small>` : ''}</button>`).join('')
      : '<div class="hint" style="padding:8px">Nada encontrado. Tente outro nome ou cole o link do Google Maps.</div>';
    box.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('mousedown', e => { e.preventDefault(); onPick(list[+b.dataset.pick]); }));
  } catch (e) { if (e.name !== 'AbortError') box.innerHTML = '<div class="hint" style="padding:8px">Busca indisponível agora. Cole o link do Google Maps.</div>'; }
}

// ---------- quem vai em cada carro ----------
function seatsEdit(p, f) {
  if (!f.vehicles.length || !f.people.length) return '';
  const { cars, loose } = carPlan(f);
  const carOf = e => cars.find(c => c.driver === e || c.people.includes(e));
  return `<div class="lbl">Quem vai em cada carro</div>
    <div class="seats">${cars.map(c => `<div class="seatcar">
      <div class="seatcar-h"><b>${esc(vehName(p, c.v))}</b>
        <label class="drv">Motorista <select class="sel xs" id="dr-${f.id}-${esc(c.v)}" data-driver="${f.id}|${esc(c.v)}"><option value="">—</option>
          ${sortPeople(p, f.people).map(e => `<option value="${esc(e)}" ${c.driver === e ? 'selected' : ''}>${esc(personName(e))}</option>`).join('')}</select></label></div>
      <div class="chipset">${sortPeople(p, f.people).filter(e => e !== c.driver).map(e => { const on = c.people.includes(e); const other = !on && carOf(e);
        return `<button class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-seat="${f.id}|${esc(c.v)}|${esc(e)}">${esc(personName(e))}${other ? ` <small>· ${esc(vehName(p, other.v))}</small>` : ''}</button>`; }).join('')}</div>
    </div>`).join('')}</div>
    ${loose.length ? `<p class="hint">Sem carro: ${sortPeople(p, loose).map(e => esc(personName(e))).join(', ')}</p>` : '<p class="hint">Toda a equipe da frente está alocada.</p>'}`;
}

// ---------- equipamentos do dia ----------
function equipSection(p, day, E) {
  const items = projItems(p); if (!items.length) return `<div class="section"><h3>Equipamentos do dia</h3>${emptyHTML('A lista de equipamentos do projeto está vazia.')}</div>`;
  const dests = destinations(p, day); const destOf = id => { const r = day.items[id]; return r ? `${r.f}|${r.v || ''}` : ''; };
  const valid = new Set(dests.map(d => d.key));
  const view = ls.get('iur.dview', 'destino');
  const secs = [];
  if (view === 'destino') {
    for (const d of dests) secs.push({ title: d.label, list: items.filter(x => destOf(x.id) === d.key) });
    const orphan = items.filter(x => day.items[x.id] && !valid.has(destOf(x.id)));
    if (orphan.length) secs.push({ title: 'Destino inválido (revise)', list: orphan });
    secs.push({ title: 'Fica na base', list: items.filter(x => !day.items[x.id]), base: true });
  } else {
    const byG = new Map(); for (const x of items) { if (!byG.has(x.it.group)) byG.set(x.it.group, []); byG.get(x.it.group).push(x); }
    for (const [g, list] of byG) secs.push({ title: gName(g), list });
  }
  const nTake = items.filter(x => day.items[x.id]).length;
  const destSelect = x => { const cur = destOf(x.id);
    return `<select class="sel xs" data-dest="${esc(x.id)}" ${E ? '' : 'disabled'} aria-label="Destino">
      <option value="">Fica na base</option>
      ${day.fronts.map(f => `<optgroup label="${esc(f.name)}">${dests.filter(d => d.f === f.id).map(d => `<option value="${esc(d.key)}" ${cur === d.key ? 'selected' : ''}>${esc(d.v ? vehName(p, d.v) : 'sem carro')}</option>`).join('')}</optgroup>`).join('')}
    </select>`; };
  const row = x => { const r = day.items[x.id]; const pq = x.qty || 1; const q = Math.min(r?.qty || pq, pq);
    return `<div class="check eq ${r ? '' : 'base'}">${thumbHTML(x.it)}<span class="id">${esc(x.id)}</span>
      <span class="main" data-item="${esc(x.id)}"><span class="name">${esc(x.it.name)}</span>
        <div class="meta ctlrow">${E ? destSelect(x) : `<span>${r ? esc(dests.find(d => d.key === destOf(x.id))?.label || '') : 'Fica na base'}</span>`}${r && pq > 1 ? (E ? stepper('dq', x.id, q, pq, E) : `<span>× ${q}</span>`) : ''}</div></span></div>`; };
  return `<div class="section"><h3>Equipamentos do dia · ${nTake} levando, ${items.length - nTake} na base</h3>
    <div class="dates">${dests.map(d => { const n = items.filter(x => destOf(x.id) === d.key).length; return n ? `<span class="date">${esc(d.label)} <small>${n}</small></span>` : ''; }).join('')}<span class="date">Base <small>${items.length - nTake}</small></span></div>
    <div class="bar">
      ${E ? `<select class="sel" id="allTo" aria-label="Levar os que estão na base"><option value="">Levar o que está na base para…</option>${dests.map(d => `<option value="${esc(d.key)}">${esc(d.label)}</option>`).join('')}</select>
      <button class="btn sm" id="allBase">Tudo na base</button>` : ''}
      <span style="flex:1"></span>
      <label class="toggle">Agrupar por <select class="sel xs" data-dview><option value="destino" ${view === 'destino' ? 'selected' : ''}>destino</option><option value="grupo" ${view === 'grupo' ? 'selected' : ''}>grupo</option></select></label>
    </div>
    ${secs.filter(s => E || s.list.length).map(s => `<div class="gsec" style="margin-top:12px"><div class="ghead"><h2 style="font-size:16px">${esc(s.title)}</h2><small>${s.list.length}</small></div>
      ${s.list.length ? s.list.map(row).join('') : '<div class="hint" style="padding:6px 4px">—</div>'}</div>`).join('')}
  </div>`;
}
