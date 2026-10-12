// Pedaços de interface reaproveitados em várias telas
import { S } from './store.js';
import { esc, fmtD, fmtDM, wday, wdayLong, todayStr } from './utils.js';
import { personName, personFuncs, funcLabel, sortPeople, timeline, vehName, itemFlags, ITEM_STATUS, CONDITIONS, dayPeople, ackState, gName, carPlan, firstName, mapsDirURL } from './logic.js';

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
      ${people.length && !opts.ack ? `<span class="pill ${ackOk === people.length ? 'p-ok' : 'p-warn'}">${ackOk}/${people.length} cientes</span>` : ''}
    </header>
    ${opts.ack ? ackPanelHTML(p, date, day) : ''}
    ${day.info ? `<p class="info">${esc(day.info)}</p>` : ''}
    ${day.fronts.map(f => `<section class="front-sum">
      ${multi ? `<h4>${esc(f.name)}</h4>` : ''}
      <div class="kv"><span>Local</span><b>${esc(f.local || 'a definir')}</b></div>
      ${placeHTML(f)}
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
// Local no mapa
export function placeHTML(f) {
  const pl = f.place; if (!pl?.url) return '';
  return `<div class="kv"><span>Mapa</span><div class="place-view"><b>${esc(pl.name || 'Local')}</b>${pl.desc ? ` <small>${esc(pl.desc)}</small>` : ''}
    <div class="place-links"><a class="btn sm" href="${esc(pl.url)}" target="_blank" rel="noopener">Abrir no Google Maps</a>${mapsDirURL(pl) ? `<a class="btn sm" href="${esc(mapsDirURL(pl))}" target="_blank" rel="noopener">Como chegar</a>` : ''}</div></div></div>`;
}
// Painel "ciente": botão para quem está no projeto + quem já confirmou
export function ackPanelHTML(p, date, day) {
  const people = sortPeople(p, dayPeople(day).length ? dayPeople(day) : (p.team || []));
  const me = people.includes(S.me) || (p.team || []).includes(S.me);
  const mine = ackState(p.id, date, S.me, day).k;
  const btn = !me ? '' : mine === 'ok' ? '<button class="btn ok" data-ack="1">✓ Você está ciente · desfazer</button>'
    : mine === 'old' ? '<button class="btn pri" data-ack="1">Horários mudaram — confirmar de novo</button>'
    : '<button class="btn pri" data-ack="1">Estou ciente dos horários</button>';
  const st = e => ackState(p.id, date, e, day).k;
  const ok = people.filter(e => st(e) === 'ok'), old = people.filter(e => st(e) === 'old'), none = people.filter(e => st(e) === 'none');
  return `<div class="ackbox"><div class="ackhead"><h3>Ciente · ${ok.length}/${people.length}</h3>${btn}</div>
    <div class="ackgrid">${[...ok, ...old, ...none].map(e => { const s = st(e);
      return `<span class="ack ${s}"><i>${s === 'ok' ? '✓' : s === 'old' ? '!' : '○'}</i>${esc(personName(e))}${s === 'old' ? ' <small>confirmar de novo</small>' : ''}</span>`; }).join('')}</div>
    ${none.length || old.length ? `<p class="hint" style="margin:8px 0 0">Faltam: ${[...old, ...none].map(e => esc(personName(e))).join(', ')}</p>` : people.length ? '<p class="hint" style="margin:8px 0 0">Todos confirmaram.</p>' : ''}</div>`;
}
export const emptyHTML = t => `<div class="empty">${t}</div>`;
export { gName };
