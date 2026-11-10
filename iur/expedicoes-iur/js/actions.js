// Ações que gravam dados. As telas chamam estas funções, nunca o Firebase direto.
import { save, merge, remove, newId, idToken } from './firebase.js';
import { S } from './store.js';
import { conflictsFor, scheduleSig, personName, dayInvites } from './logic.js';
import { NOTIFY_URL, NOTIFY_REMINDERS } from './config.js';
import { esc, fmtD, openSheet, closeSheet, toast } from './utils.js';

const clone = o => JSON.parse(JSON.stringify(o));
export const projBody = pid => clone(S.projects.get(pid) || {});

// ---------- projetos ----------
export function createProject({ name, notes }) {
  const id = newId('projects');
  save('projects/' + id, { name, notes: notes || '', dates: [], items: [], team: [S.me], roles: {}, checked: {}, load: {}, created: new Date().toISOString(), createdBy: S.me });
  return id;
}
export function setProject(pid, body) { const b = clone(body); delete b.id; save('projects/' + pid, b); }
export const deleteProject = pid => remove('projects/' + pid);

// Salva verificando se surgem novos conflitos de uso de equipamento
export function saveProjectChecked(pid, np, msg) {
  const key = c => c.itemId + '|' + c.others.join(',');
  const before = new Set(conflictsFor({ id: pid, ...S.projects.get(pid) }).map(key));
  const added = conflictsFor({ id: pid, ...np }).filter(c => !before.has(key(c)));
  const go = () => { setProject(pid, np); msg && toast(msg); };
  if (!added.length) return go();
  const rows = added.map(c => `<li><span class="id">${esc(c.itemId)}</span> ${esc(S.items.get(c.itemId)?.name || '')} — ${fmtD(c.date)}: também em ${c.others.map(o => `<b>${esc(S.projects.get(o)?.name || 'outro projeto')}</b>`).join(', ')} (precisa ${c.need}, há ${c.have})</li>`).join('');
  openSheet(`<div class="sheet-h"><div><span class="pill p-bad">Conflito de uso</span><h2>Equipamento já reservado nessas datas</h2></div></div>
    <div class="alert bad"><ul>${rows}</ul></div>
    <p class="hint" style="font-size:14px">Se continuar, o projeto fica marcado com conflito até que você mude as datas, a quantidade ou remova o equipamento de um dos projetos.</p>
    <div class="actions"><span></span><div class="r"><button class="btn" data-close>Cancelar</button><button class="btn danger solid" id="cg">Continuar com conflito</button></div></div>`,
    sh => sh.querySelector('#cg').addEventListener('click', () => { closeSheet(); go(); }));
}

// ---------- diárias ----------
// Grava a diária. Se mudou local/horário/equipe, as confirmações anteriores passam a "precisa confirmar de novo".
export function saveDay(pid, date, day) {
  const prev = S.proj.days.get(date);
  const body = clone(day); delete body.saved;
  const sigNow = scheduleSig(body), sigPrev = prev ? scheduleSig(prev) : null;
  body.timesAt = (prev && sigNow === sigPrev) ? (prev.timesAt || '') : new Date().toISOString();
  if (!prev && !body.timesAt) body.timesAt = new Date().toISOString();
  body.updatedAt = new Date().toISOString(); body.updatedBy = S.me;
  save(`projects/${pid}/days/${date}`, body);
}
export function setAck(pid, date, on) {
  const path = `projects/${pid}/acks/${date}__${S.me}`;
  if (on) save(path, { email: S.me, date, at: new Date().toISOString() }); else remove(path);
}
// "Avisar equipe": manda os convites da diária para o Apps Script (cria/atualiza/apaga eventos no Google Agenda).
// Precisa de sinal (não fica na fila offline). Devolve true se deu certo.
export async function notifyTeam(p, date, day) {
  const invites = dayInvites(p, date, day);
  if (!invites.length) { toast('Ninguém na equipe desta diária para avisar.'); return false; }
  try {
    const body = { idToken: await idToken(), projectId: p.id, date, reminders: NOTIFY_REMINDERS, invites };
    const r = await fetch(NOTIFY_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const res = await r.json();
    if (!res.ok) { toast('Não foi possível avisar: ' + (res.error || 'erro no script')); return false; }
    const parts = [[res.created, 'novo', 'novos'], [res.updated, 'atualizado', 'atualizados'], [res.removed, 'removido', 'removidos']]
      .filter(([n]) => n).map(([n, a, b]) => `${n} ${n > 1 ? b : a}`);
    toast('Equipe avisada' + (parts.length ? ` (convites: ${parts.join(', ')})` : ''));
    return true;
  } catch (e) {
    toast(navigator.onLine === false ? 'Sem sinal: avise a equipe quando tiver internet.' : 'Não foi possível avisar a equipe agora. Tente de novo.');
    return false;
  }
}

// ---------- inventário ----------
export const saveItem = (id, data) => save('items/' + id, data);
export function deleteItem(id) {
  for (const [pid, p] of S.projects) if ((p.items || []).some(e => e.id === id)) {
    const np = clone(p); np.items = np.items.filter(e => e.id !== id);
    if (np.checked) delete np.checked[id]; if (np.load) delete np.load[id];
    setProject(pid, np);
  }
  remove('items/' + id);
}
export const saveGroup = (id, data) => save('groups/' + id, data);
export function deleteGroup(id, moveTo) {
  for (const [iid, it] of S.items) if (it.group === id) save('items/' + iid, { ...it, group: moveTo });
  remove('groups/' + id);
}

// ---------- equipe (acesso ao app) ----------
export const saveMember = (email, data) => save('team/' + email, data);
export const mergeMember = (email, data) => merge('team/' + email, data);
export const removeMember = email => remove('team/' + email);
export { personName };
