// Estado do app + assinaturas em tempo real + permissões
import { listen } from './firebase.js';
import { OWNERS, ROLES } from './config.js';

export const S = {
  user: null, me: '', role: null,          // role: 'admin' | 'editor' | 'member' | 'none' | null (carregando)
  items: new Map(), groups: new Map(), team: new Map(), projects: new Map(),
  loaded: { items: false, groups: false, team: false, projects: false },
  proj: { pid: null, days: new Map(), acks: new Map(), loaded: false },
  error: '',
};

const listeners = new Set();
let queued = false;
export const onChange = fn => listeners.add(fn);
export function changed() {
  if (queued) return; queued = true;
  requestAnimationFrame(() => { queued = false; listeners.forEach(fn => fn()); });
}

export const can = cap => !!ROLES[S.role]?.[cap];
export const isOwner = () => OWNERS.includes(S.me);

let subs = {}; // nome → unsubscribe
function sub(name, path, opts, apply, onErr) {
  subs[name]?.();
  subs[name] = listen(path, m => { apply(m); changed(); }, opts, onErr || (err => { S.error = err.code || 'erro'; changed(); }));
}
function unsubAll() { Object.values(subs).forEach(u => u && u()); subs = {}; }

function computeRole() {
  if (isOwner()) return 'admin';
  const r = S.team.get(S.me)?.role;
  if (r === 'owner') return 'admin';
  return ROLES[r] ? r : (S.loaded.team ? 'none' : null);
}

let projectsMode = null;
function subscribeData() {
  if (!S.role || S.role === 'none') return;
  if (!subs.items) sub('items', 'items', {}, m => { S.items = m; S.loaded.items = true; });
  if (!subs.groups) sub('groups', 'groups', {}, m => { S.groups = m; S.loaded.groups = true; });
  const mode = can('allProjects') ? 'all' : 'mine';
  if (mode !== projectsMode) {
    projectsMode = mode;
    sub('projects', 'projects', mode === 'all' ? {} : { where: ['team', 'array-contains', S.me] },
      m => { S.projects = m; S.loaded.projects = true; });
  }
}

export function start(user) {
  stop();
  S.user = user; S.me = (user?.email || '').toLowerCase();
  if (!user) { changed(); return; }
  S.role = isOwner() ? 'admin' : null;
  sub('team', 'team', {}, m => {
    S.team = m; S.loaded.team = true; S.role = computeRole(); subscribeData();
  }, err => {
    if (err.code === 'permission-denied') { S.loaded.team = true; S.role = isOwner() ? 'admin' : 'none'; }
    else S.error = err.code;
    subscribeData(); changed();
  });
  subscribeData();
  changed();
}
export function stop() {
  unsubAll(); projectsMode = null;
  Object.assign(S, { user: null, me: '', role: null, items: new Map(), groups: new Map(), team: new Map(), projects: new Map(), error: '' });
  S.loaded = { items: false, groups: false, team: false, projects: false };
  S.proj = { pid: null, days: new Map(), acks: new Map(), loaded: false };
}

// Diárias e confirmações do projeto aberto (subcoleções)
export function openProjectData(pid) {
  if (S.proj.pid === pid) return;
  subs.days?.(); subs.acks?.();
  S.proj = { pid, days: new Map(), acks: new Map(), loaded: false };
  if (!pid) return;
  sub('days', `projects/${pid}/days`, {}, m => { S.proj.days = m; S.proj.loaded = true; }, () => { S.proj.loaded = true; changed(); });
  sub('acks', `projects/${pid}/acks`, {}, m => { S.proj.acks = m; }, () => {});
}
