// Ponto de entrada: login, navegação (rotas por #) e redesenho da tela
import { APP_NAME, APP_SUB, ROLES } from './config.js';
import { onUser, signIn, signOutUser, redirectResult, setWriteErrorHandler, batchSet } from './firebase.js';
import { S, start, onChange, can, openProjectData } from './store.js';
import { $, esc, toast, ls, sheetOpen, closeSheet } from './utils.js';
import { renderHome } from './views/home.js';
import { renderProject } from './views/project.js';
import { renderDiaria } from './views/diaria.js';
import { renderInventory, openItem } from './views/inventory.js';
import { renderGroups } from './views/groups.js';
import { renderLabels } from './views/labels.js';
import { renderTeam } from './views/team.js';
import { personName } from './logic.js';

// ---------- rotas ----------
// #/                         projetos
// #/projeto/ID[/aba]         resumo | diarias | equipamentos | equipe
// #/projeto/ID/diaria/DATA   página da diária
// #/inventario  #/grupos  #/etiquetas  #/equipe   #/item/ID (QR code)
const NAV = [
  { href: '#/', label: 'Projetos', match: r => r.view === 'home' || r.view === 'project' || r.view === 'diaria' },
  { href: '#/inventario', label: 'Equipamentos', match: r => r.view === 'inventory' },
  { href: '#/grupos', label: 'Grupos', match: r => r.view === 'groups', cap: 'edit' },
  { href: '#/etiquetas', label: 'Etiquetas QR', match: r => r.view === 'labels', cap: 'team' },
  { href: '#/equipe', label: 'Equipe', match: r => r.view === 'team', cap: 'team' },
];
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const parts = h.split('/').filter(Boolean);
  if (/^[A-Z]{2,4}-\d+$/.test(h)) return { view: 'inventory', item: h };          // QR antigo (#SUB-03)
  switch (parts[0]) {
    case 'projeto': return parts[2] === 'diaria' ? { view: 'diaria', pid: parts[1], date: parts[3] } : { view: 'project', pid: parts[1], tab: parts[2] || 'resumo' };
    case 'inventario': return { view: 'inventory' };
    case 'item': return { view: 'inventory', item: parts[1] };
    case 'grupos': return { view: 'groups' };
    case 'etiquetas': return { view: 'labels' };
    case 'equipe': return { view: 'team' };
    default: return { view: 'home' };
  }
}

// ---------- redesenho ----------
let lastKey = '';
function render() {
  document.body.classList.toggle('nophotos', !ls.get('iur.photos', true));
  const v = $('#view'), r = route();
  // usuário / login
  $('#who').hidden = !S.user;
  if (S.user) $('#whoMail').textContent = `${personName(S.me)}${S.role && ROLES[S.role] ? ' · ' + ROLES[S.role].label : ''}`;
  if (!S.user) { $('#nav').hidden = true; v.innerHTML = loginHTML(); $('#gsign').addEventListener('click', doSignIn); return; }
  if (S.role === null) { $('#nav').hidden = true; v.innerHTML = '<div class="empty">Verificando acesso…</div>'; return; }
  if (S.role === 'none') { $('#nav').hidden = true;
    v.innerHTML = `<div class="login"><h2>Sem acesso</h2><p>A conta <b>${esc(S.me)}</b> ainda não foi cadastrada. Peça a um administrador para incluir este e-mail na aba Equipe.</p><button class="btn" id="out2">Entrar com outra conta</button></div>`;
    $('#out2').addEventListener('click', signOutUser); return; }
  // navegação
  $('#nav').hidden = false;
  $('#nav').innerHTML = NAV.filter(n => !n.cap || can(n.cap)).map(n => `<a class="tab" href="${n.href}" aria-selected="${n.match(r)}">${n.label}</a>`).join('');
  $('#banner').hidden = !S.error; $('#banner').textContent = S.error ? `Problema de conexão com o banco (${S.error}). Recarregue a página.` : '';
  $('#importBox').hidden = !(can('edit') && S.loaded.items && S.loaded.groups && S.items.size === 0 && S.groups.size === 0);
  // dados do projeto aberto
  openProjectData(r.pid || null);
  // preserva foco/texto em edição quando os dados chegam
  const a = document.activeElement, keep = a && a.id && v.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) ? { id: a.id, val: a.value, s: a.selectionStart, e: a.selectionEnd, dirty: a.dataset.dirty } : null;
  const scroll = window.scrollY; const key = location.hash;
  switch (r.view) {
    case 'home': renderHome(v); break;
    case 'project': renderProject(v, r.pid, r.tab); break;
    case 'diaria': renderDiaria(v, r.pid, r.date); break;
    case 'inventory': renderInventory(v); break;
    case 'groups': can('edit') ? renderGroups(v) : renderHome(v); break;
    case 'labels': can('team') ? renderLabels(v) : renderHome(v); break;
    case 'team': renderTeam(v); break;
  }
  if (keep) { const n = document.getElementById(keep.id); if (n) { if (keep.dirty) n.value = keep.val; n.dataset.dirty = keep.dirty || ''; n.focus(); try { n.setSelectionRange(keep.s, keep.e); } catch (e) { } } }
  if (key === lastKey) window.scrollTo(0, scroll); else { window.scrollTo(0, 0); lastKey = key; }
  if (r.item && S.loaded.items && !sheetOpen()) { openItem(r.item); history.replaceState(null, '', '#/inventario'); }
}
// marca campos com texto ainda não salvo (para não perder o que está sendo digitado)
document.addEventListener('input', e => { if (e.target.id) e.target.dataset.dirty = '1'; });
document.addEventListener('change', e => { if (e.target.dataset) e.target.dataset.dirty = ''; }, true);

const loginHTML = () => `<div class="login"><h2>Entrar</h2><p class="hint" style="font-size:14px;margin:0">Use a conta Google cadastrada pela equipe do IUR.</p>
  <button class="btn pri" id="gsign" style="justify-content:center">Entrar com Google</button><p class="hint" id="loginMsg"></p></div>`;
async function doSignIn() { try { await signIn(); } catch (e) { const m = $('#loginMsg'); if (m) m.textContent = 'Não foi possível entrar (' + e.code + ').'; } }

// ---------- inicialização ----------
document.title = APP_NAME;
$('#appName').textContent = APP_NAME; $('#appSub').textContent = APP_SUB;
$('#logout').addEventListener('click', () => signOutUser());
setWriteErrorHandler(e => toast(e?.code === 'permission-denied' ? 'Seu perfil não permite essa alteração.' : 'Não foi possível salvar (' + (e?.code || 'erro') + ').'));
redirectResult().catch(e => toast('Não foi possível entrar (' + e.code + ').'));
$('#doImport').addEventListener('click', async () => {
  const b = $('#doImport'); b.disabled = true; b.textContent = 'Importando…';
  try { const { SEED } = await import('./seed.js'); const entries = [];
    for (const [k, col] of [['groups', 'groups'], ['items', 'items'], ['projects', 'projects']]) for (const [id, d] of Object.entries(SEED[k] || {})) entries.push([`${col}/${id}`, k === 'projects' ? { ...d, team: d.team || [S.me] } : d]);
    await batchSet(entries); toast('Inventário importado'); }
  catch (e) { b.disabled = false; b.textContent = 'Importar'; toast('Falha ao importar (' + (e.code || e.message) + ').'); }
});
onChange(render);
window.addEventListener('hashchange', () => { closeSheet(); render(); });
onUser(u => start(u));
render();
