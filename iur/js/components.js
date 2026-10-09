// Pedaços de interface reaproveitados em várias telas
import { S } from './store.js';
import { esc, fmtD, fmtDM, wday, wdayLong, todayStr } from './utils.js';
import { personName, personFuncs, funcLabel, sortPeople, timeline, vehName, itemFlags, ITEM_STATUS, CONDITIONS, dayPeople, ackState, gName, carPlan, firstName } from './logic.js';

export const thumbHTML = (it, cls = 'thumb') =>
  `<span class="${cls}">${it.photo ? `<img src="${esc(it.photo)}" alt="" loading="lazy">` : esc((it.group || '?').slice(0, 3))}</span>`;

export function itemPills(it) {
  const fl = itemFlags(it); const p = [];
  if (it.status !== 'owned') p.push(`<span class="pill ${ITEM_STATUS[it.status].c}">${ITEM_STATUS[it.status].t}</span>`);
  else {
    if (it.condition === 'repair') { const late = it.returnDate && it.returnDate < todayStr(); p.push(`<span class="pill p-bad">Manutenção${it.returnDate ? ` · ${late ? 'atrasado ' : ''}volta ${fmtD(it.returnDate)}` : ' · sem data'}</span>`); }
    else if (it.condition === 'needs') p.push(`<span class="pill p-warn">Precisa manutenção</span>`);
    if (fl.use.length) p.push(`<span class="pill p-use">Em uso</span>`);
    else if (it.condition === 'ok') p.push(`<span class="pill p-ok">Livre</span>`);
  }
  return `<span class="pills">${p.join('')}</span>`;
}

export const funcsText = (p, e) => personFuncs(p, e).map(funcLabel).join(', ');
export function personLine(p, e) {
  const f = funcsText(p, e);
  return `<span class="person"><b>${esc(personName(e))}</b>${f ? ` <small>${esc(f)}</small>` : ''}</span>`;
}

export function timelineHTML(f) {
  const tl = timeline(f);
  if (!tl.length) return '<span class="hint">Sem horários</span>';
  return `<ol class="tl">${tl.map(x => `<li class="${x.fixed ? 'fx' : 'ex'}"><time>${esc(x.t || '--:--')}</time><span>${esc(x.label || '')}</span></li>`).join('')}</ol>`;
}

// Cartão-resumo de uma diária (usado no resumo do projeto e na lista de diárias)
export function dayCardHTML(p, pid, date, day, opts = {}) {
  const multi = day.fronts.length > 1;
  const people = dayPeople(day);
  const ackOk = people.filter(e => ackState(pid, date, e, day).k === 'ok').length;
  return `<article class="daycard">
    <header>
      <div><span class="eyebrow">${esc(opts.kind ? `Diária de ${opts.kind}` : wdayLong(date))}</span>
      <h3>${esc(wday(date))}, ${fmtD(date)}</h3></div>
      ${people.length ? `<span class="pill ${ackOk === people.length ? 'p-ok' : 'p-warn'}">${ackOk}/${people.length} cientes</span>` : ''}
    </header>
    ${day.info ? `<p class="info">${esc(day.info)}</p>` : ''}
    ${day.fronts.map(f => `<section class="front-sum">
      ${multi ? `<h4>${esc(f.name)}</h4>` : ''}
      <div class="kv"><span>Local</span><b>${esc(f.local || 'a definir')}</b></div>
      ${timelineHTML(f)}
      ${f.obs ? `<p class="hint" style="margin:6px 0 0">${esc(f.obs)}</p>` : ''}
      ${carsHTML(p, f)}
      <div class="kv"><span>Equipe</span><div class="people">${f.people.length ? sortPeople(p, f.people).map(e => personLine(p, e)).join('') : '—'}</div></div>
    </section>`).join('')}
    ${opts.button ? `<a class="btn pri" href="#/projeto/${esc(pid)}/diaria/${date}">Abrir diária completa →</a>` : ''}
  </article>`;
}

// Carros da frente: motorista e passageiros
export function carsHTML(p, f) {
  if (!f.vehicles.length) return '<div class="kv"><span>Carros</span><b>—</b></div>';
  const { cars, loose } = carPlan(f);
  return `<div class="kv"><span>Carros</span><div class="cars">${cars.map(c => `<div class="car"><b>${esc(vehName(p, c.v))}</b>
      <span>${c.driver ? `<span class="driver">${esc(personName(c.driver))} <small>motorista</small></span>` : '<span class="hint">sem motorista</span>'}${c.people.length ? ' · ' + sortPeople(p, c.people).map(e => esc(personName(e))).join(', ') : ''}</span></div>`).join('')}
    ${loose.length ? `<div class="car loose"><b>Sem carro definido</b><span>${sortPeople(p, loose).map(e => esc(personName(e))).join(', ')}</span></div>` : ''}</div></div>`;
}
export const emptyHTML = t => `<div class="empty">${t}</div>`;
export { gName };
