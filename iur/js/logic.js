// Regras de negócio: projetos, diárias, equipe, inventário. Sem HTML aqui.
import { S } from './store.js';
import { OWNERS, FUNCTIONS, DEFAULT_TIMES, DEFAULT_VEHICLES, DEFAULT_FRONT_NAME, NEXT_DAY_FROM_HOUR, ITEM_STATUS, CONDITIONS } from './config.js';
import { todayStr, addDays, parseD, dateStr } from './utils.js';

// ---------- pessoas ----------
export const personName = e => S.team.get(e)?.name || e;
export const firstName = e => personName(e).split(' ')[0];
const FN_RANK = Object.fromEntries(FUNCTIONS.map((f, i) => [f.id, i]));
export const funcLabel = id => FUNCTIONS.find(f => f.id === id)?.label || id;
export const personFuncs = (p, e) => (p.roles?.[e] || []).slice().sort((a, b) => (FN_RANK[a] ?? 99) - (FN_RANK[b] ?? 99));
const personRank = (p, e) => Math.min(99, ...personFuncs(p, e).map(f => FN_RANK[f] ?? 99));
export const sortPeople = (p, emails) => [...emails].sort((a, b) => personRank(p, a) - personRank(p, b) || personName(a).localeCompare(personName(b)));
export const allMembers = () => [...new Set([...OWNERS, ...S.team.keys()])].sort((a, b) => personName(a).localeCompare(personName(b)));

// ---------- inventário ----------
export const groupsSorted = () => [...S.groups.entries()].map(([id, g]) => ({ id, ...g })).sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
export const gName = id => S.groups.get(id)?.name || 'Sem grupo';
export const itemsSorted = () => [...S.items.entries()].map(([id, it]) => ({ id, ...it })).sort((a, b) =>
  (S.groups.get(a.group)?.order ?? 99) - (S.groups.get(b.group)?.order ?? 99) || a.id.localeCompare(b.id, undefined, { numeric: true }));
export const stockOf = id => Math.max(0, S.items.get(id)?.qty ?? 0);
export function nextItemId(group) {
  let max = 0; for (const id of S.items.keys()) { const m = id.match(/^([A-Z0-9]+)-(\d+)$/); if (m && m[1] === group) max = Math.max(max, +m[2]); }
  return `${group}-${String(max + 1).padStart(2, '0')}`;
}
export function projItems(p) {
  return (p.items || []).map(e => ({ ...e, it: S.items.get(e.id) })).filter(x => x.it).sort((a, b) =>
    (S.groups.get(a.it.group)?.order ?? 99) - (S.groups.get(b.it.group)?.order ?? 99) || a.id.localeCompare(b.id, undefined, { numeric: true }));
}

// ---------- veículos ----------
export const vehiclesOf = p => (p.vehicles && p.vehicles.length) ? p.vehicles : DEFAULT_VEHICLES;
export const dailyVehicles = p => vehiclesOf(p).filter(v => v.daily);
export const vehName = (p, id) => vehiclesOf(p).find(v => v.id === id)?.name || '';

// ---------- datas do projeto: blocos e dias ----------
export function blocks(p) {
  return (p.dates || []).map((r, i) => ({ ...r, idx: i, days: rangeDays(r) })).sort((a, b) => a.start.localeCompare(b.start));
}
export function rangeDays(r) {
  const out = []; let d = r.start, guard = 0;
  while (d <= r.end && guard++ < 400) { out.push(d); d = addDays(d, 1); }
  return out;
}
export const projectDays = p => [...new Set(blocks(p).flatMap(b => b.days))].sort();
export const blockOf = (p, date) => blocks(p).find(b => date >= b.start && date <= b.end);

// Data "de referência": hoje, ou amanhã a partir das 20h
export function targetDate() {
  const now = new Date(); return now.getHours() >= NEXT_DAY_FROM_HOUR ? addDays(todayStr(), 1) : todayStr();
}
export function projectStatus(p) {
  const days = projectDays(p); if (!days.length) return { k: 'nodates', t: 'Sem datas' };
  const t = todayStr(), first = days[0], last = days[days.length - 1];
  if (t > last) return { k: 'past', t: 'Encerrado', first, last };
  if (t >= first) return { k: 'ongoing', t: 'Em andamento', first, last };
  return { k: 'upcoming', t: 'Próximo', first, last };
}
// Diária em destaque: a da data de referência, ou a próxima
export function featuredDay(p) {
  const days = projectDays(p), tg = targetDate();
  if (days.includes(tg)) return { date: tg, kind: tg === todayStr() ? 'hoje' : 'amanhã' };
  const nx = days.find(d => d > tg); return nx ? { date: nx, kind: 'próxima' } : null;
}
export function sortProjects(arr) {
  const rank = { ongoing: 0, upcoming: 1, nodates: 2, past: 3 };
  return arr.map(p => ({ ...p, st: projectStatus(p) })).sort((a, b) =>
    rank[a.st.k] - rank[b.st.k] ||
    (a.st.k === 'past' ? (b.st.last || '').localeCompare(a.st.last || '') : (a.st.first || '9').localeCompare(b.st.first || '9')) ||
    a.name.localeCompare(b.name));
}

// ---------- diária ----------
export const fixedTimes = () => Object.fromEntries(DEFAULT_TIMES.map(t => [t.id, t.value]));
export function newFront(p, n = 1) {
  return { id: 'f' + Date.now().toString(36) + n, name: n === 1 ? DEFAULT_FRONT_NAME : `Frente ${n}`, local: '', times: fixedTimes(), extra: [], obs: '',
    people: n === 1 ? [...(p.team || [])] : [], vehicles: n === 1 ? dailyVehicles(p).map(v => v.id) : [], seats: {} };
}
// Lê a diária salva (ou a do formato antigo, ou cria uma padrão)
export function getDay(p, date) {
  const raw = S.proj.days.get(date);
  if (raw) return normalizeDay(raw, p);
  const legacy = p.days?.[date];
  if (legacy) {
    const f = newFront(p); f.id = 'f1'; f.local = legacy.note || '';
    const items = {};
    for (const [id, r] of Object.entries(legacy.items || {})) if (r.take) items[id] = { f: 'f1', v: r.v || '', qty: r.qty || null };
    return { info: '', fronts: [f], items, timesAt: '', saved: false };
  }
  const f = newFront(p); f.id = 'f1';
  return { info: '', fronts: [f], items: {}, timesAt: '', saved: false };
}
function normalizeDay(raw, p) {
  const d = JSON.parse(JSON.stringify(raw));
  d.info ||= ''; d.items ||= {}; d.fronts = (d.fronts && d.fronts.length) ? d.fronts : [Object.assign(newFront(p), { id: 'f1' })];
  d.fronts.forEach(f => { f.times ||= fixedTimes(); f.extra ||= []; f.people ||= []; f.vehicles ||= []; f.local ||= ''; f.obs ||= ''; f.seats ||= {}; f.place ||= null; });
  d.saved = true; return d;
}
// Linha do tempo de uma frente (fixos + extras), em ordem de horário
export function timeline(f) {
  const fixed = DEFAULT_TIMES.filter(t => f.times?.[t.id]).map(t => ({ t: f.times[t.id], label: t.label, fixed: true }));
  const extra = (f.extra || []).filter(x => x.t || x.txt).map((x, i) => ({ t: x.t, label: x.txt, extra: true, i }));
  return [...fixed, ...extra].sort((a, b) => (a.t || '99').localeCompare(b.t || '99'));
}
// Assinatura do que exige nova confirmação (local, horários, equipe)
export function scheduleSig(day) {
  return JSON.stringify((day.fronts || []).map(f => [f.name, f.local, f.times, f.extra, f.people, f.vehicles, f.obs, f.seats || {}, f.place || null]).concat([day.info]));
}
// Quem vai em cada carro de uma frente: [{v, driver, people}] + quem ficou sem carro
export function carPlan(f) {
  const seats = f.seats || {}; const placed = new Set();
  const cars = (f.vehicles || []).map(v => { const s = seats[v] || {}; const driver = (f.people || []).includes(s.driver) ? s.driver : '';
    const people = (s.people || []).filter(e => (f.people || []).includes(e) && e !== driver);
    if (driver) placed.add(driver); people.forEach(e => placed.add(e)); return { v, driver, people }; });
  return { cars, loose: (f.people || []).filter(e => !placed.has(e)) };
}
// Tira uma pessoa de todos os lugares (motorista/passageiro) de uma frente
export function unseat(f, e) { for (const s of Object.values(f.seats || {})) { if (s.driver === e) s.driver = ''; s.people = (s.people || []).filter(x => x !== e); } }
// ---------- locais / mapa ----------
export const mapsSearchURL = q => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
export const mapsDirURL = pl => pl?.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${pl.lat},${pl.lon}` : '';
export function placeFromPhoton(ft) {
  const pr = ft.properties || {}; const [lon, lat] = ft.geometry?.coordinates || [];
  const name = pr.name || pr.street || pr.city || 'Local';
  const desc = [pr.city || pr.county, pr.state].filter(Boolean).filter(x => x !== name).join(' – ');
  return { name, desc, lat, lon, url: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` };
}
export const isMapsLink = u => /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps|(www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)/i.test(u.trim());

export const dayPeople = day => [...new Set(day.fronts.flatMap(f => f.people || []))];
export function ackState(pid, date, email, day) {
  const a = S.proj.acks.get(`${date}__${email}`);
  if (!a) return { k: 'none' };
  if (day.timesAt && a.at < day.timesAt) return { k: 'old', at: a.at };
  return { k: 'ok', at: a.at };
}
export function destinations(p, day) { // opções de destino de equipamento no dia
  const out = [];
  for (const f of day.fronts) {
    for (const vid of f.vehicles) out.push({ key: `${f.id}|${vid}`, f: f.id, v: vid, label: `${f.name} · ${vehName(p, vid) || vid}` });
    out.push({ key: `${f.id}|`, f: f.id, v: '', label: `${f.name} · sem carro` });
  }
  return out;
}

// ---------- uso, conflitos e avisos de equipamentos ----------
function projectIntervals(override) {
  const out = [];
  const add = (pid, p) => { for (const r of (p.dates || [])) for (const e of (p.items || [])) out.push({ pid, itemId: e.id, qty: e.qty || 1, start: r.start, end: r.end }); };
  for (const [pid, p0] of S.projects) add(pid, override && override.id === pid ? override : p0);
  if (override && !S.projects.has(override.id)) add(override.id, override);
  return out;
}
export function inUseToday(itemId) {
  const t = todayStr(); const ps = [];
  for (const [pid, p] of S.projects) if ((p.items || []).some(e => e.id === itemId) && (p.dates || []).some(r => r.start <= t && r.end >= t)) ps.push(pid);
  return ps;
}
export function conflictsFor(p) {
  const all = projectIntervals(p); const res = new Map();
  for (const e of (p.items || [])) {
    const it = S.items.get(e.id); if (!it) continue;
    const ivs = all.filter(x => x.itemId === e.id), mine = ivs.filter(x => x.pid === p.id);
    for (const m of mine) {
      const cands = new Set(ivs.filter(o => o.start <= m.end && o.end >= m.start).map(o => o.start > m.start ? o.start : m.start));
      for (const d of cands) {
        const cover = ivs.filter(o => o.start <= d && o.end >= d), sum = cover.reduce((a, o) => a + o.qty, 0);
        const others = [...new Set(cover.filter(o => o.pid !== p.id).map(o => o.pid))];
        if (others.length && sum > (it.qty || 1)) { const key = e.id + '|' + others.sort().join(','); if (!res.has(key)) res.set(key, { itemId: e.id, date: d, others, need: sum, have: it.qty || 1 }); }
      }
    }
  }
  return [...res.values()];
}
export function warningsFor(p) {
  const w = []; const first = projectDays(p)[0];
  for (const e of (p.items || [])) {
    const it = S.items.get(e.id); if (!it) continue;
    if (it.status !== 'owned') w.push({ itemId: e.id, t: ITEM_STATUS[it.status].t });
    else if (it.condition === 'repair') w.push({ itemId: e.id, t: it.returnDate ? (first && it.returnDate > first ? `Em manutenção até ${it.returnDate.split('-').reverse().join('/')} (depois do início)` : `Em manutenção, retorno ${it.returnDate.split('-').reverse().join('/')}`) : 'Em manutenção, sem data de retorno' });
    else if (it.condition === 'needs') w.push({ itemId: e.id, t: 'Precisa de manutenção' + (it.notes ? ` — ${it.notes}` : '') });
    if ((e.qty || 1) > stockOf(e.id)) w.push({ itemId: e.id, t: `Na lista ${e.qty}, no inventário ${stockOf(e.id)}`, bad: true });
  }
  return w;
}
export function itemFlags(it) {
  const use = inUseToday(it.id);
  return { use, free: it.status === 'owned' && it.condition === 'ok' && use.length === 0 };
}
export function matchesFilter(it, f) {
  const fl = itemFlags(it);
  switch (f) {
    case 'free': return fl.free; case 'inuse': return fl.use.length > 0;
    case 'needs': return it.status === 'owned' && it.condition === 'needs'; case 'repair': return it.status === 'owned' && it.condition === 'repair';
    case 'ordered': return it.status === 'ordered'; case 'tobuy': return it.status === 'tobuy'; default: return true;
  }
}
export { ITEM_STATUS, CONDITIONS, parseD, dateStr };
