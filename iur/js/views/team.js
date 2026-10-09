// Pessoas com acesso ao app (só administradores)
import { S, can } from '../store.js';
import { OWNERS, ROLES } from '../config.js';
import { esc, fmtD, toast, armButton, $$ } from '../utils.js';
import { personName } from '../logic.js';
import { saveMember, mergeMember, removeMember } from '../actions.js';
import { emptyHTML } from '../components.js';

const roleOptions = cur => Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${r.label}</option>`).join('');
const RANK = { owner: 0, admin: 1, editor: 2, member: 3 };

export function renderTeam(el) {
  if (!can('team')) { el.innerHTML = emptyHTML('Só administradores gerenciam a equipe.'); return; }
  const list = [...OWNERS.map(e => ({ ...(S.team.get(e) || {}), email: e, role: 'owner' })),
    ...[...S.team.entries()].filter(([e]) => !OWNERS.includes(e)).map(([e, d]) => ({ email: e, ...d }))]
    .sort((a, b) => (RANK[a.role] ?? 9) - (RANK[b.role] ?? 9) || (a.name || a.email).localeCompare(b.name || b.email));
  el.innerHTML = `<div class="pagehead"><h2>Equipe</h2></div>
    <div class="section"><h3>Dar acesso</h3>
      <form class="inline-form" id="tform" style="margin-top:0">
        <label style="flex:1 1 180px">Nome<input type="text" id="t-name" required placeholder="Ex.: Leonardo" autocomplete="off" style="width:100%"></label>
        <label style="flex:1 1 220px">E-mail da conta Google<input type="email" id="t-mail" required placeholder="nome@gmail.com" autocomplete="off" style="width:100%"></label>
        <label>Perfil<select id="t-role">${roleOptions('member')}</select></label>
        <button class="btn pri" type="submit">Dar acesso</button></form>
      <ul class="plain hint"><li><b>Administrador</b>: tudo, inclusive esta tela.</li><li><b>Editor</b>: cria e edita projetos, diárias e inventário.</li><li><b>Membro</b>: vê e edita só os projetos em que foi incluído, e marca “ciente” nas diárias.</li></ul>
    </div>
    <div class="section"><h3>Com acesso · ${list.length}</h3><div class="rows">${list.map(m => { const me = m.email === S.me, fixed = m.role === 'owner';
      return `<div class="row static">
        <span class="main"><input type="text" class="search" id="tn-${esc(m.email)}" data-name="${esc(m.email)}" value="${esc(m.name || '')}" placeholder="Nome" aria-label="Nome" style="padding:5px 8px;font-weight:600;max-width:260px;width:100%">${me ? ' <span class="pill p-use">você</span>' : ''}
          <div class="meta">${esc(m.email)}${m.addedBy ? ` · adicionado por ${esc(personName(m.addedBy))}${m.addedAt ? ' em ' + fmtD(m.addedAt.slice(0, 10)) : ''}` : ''}</div></span>
        ${fixed || me ? `<span class="pill ${fixed ? 'p-acc' : 'p-idle'}">${fixed ? 'Administrador fixo' : ROLES[m.role]?.label || m.role}</span>` : `<select class="sel" data-role="${esc(m.email)}" aria-label="Perfil">${roleOptions(ROLES[m.role] ? m.role : 'member')}</select>`}
        ${fixed || me ? '<span></span>' : `<button class="btn sm danger" data-rm="${esc(m.email)}">Remover</button>`}</div>`; }).join('')}</div></div>`;
  el.querySelector('#tform').addEventListener('submit', e => { e.preventDefault();
    const name = el.querySelector('#t-name').value.trim(), mail = el.querySelector('#t-mail').value.trim().toLowerCase();
    if (!name) return toast('Informe o nome.');
    if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(mail)) return toast('E-mail inválido.');
    if (S.team.has(mail) || OWNERS.includes(mail)) return toast('Essa pessoa já tem acesso.');
    saveMember(mail, { name, role: el.querySelector('#t-role').value, addedBy: S.me, addedAt: new Date().toISOString() }); toast(`${name} agora tem acesso`); });
  $$('[data-name]', el).forEach(i => i.addEventListener('change', () => { const e = i.dataset.name;
    mergeMember(e, OWNERS.includes(e) ? { name: i.value.trim(), role: 'owner' } : { name: i.value.trim() }); toast('Nome salvo'); }));
  $$('[data-role]', el).forEach(s => s.addEventListener('change', () => { mergeMember(s.dataset.role, { role: s.value }); toast('Perfil alterado'); }));
  $$('[data-rm]', el).forEach(b => armButton(b, 'Confirmar', () => { removeMember(b.dataset.rm); toast('Acesso removido'); }));
}
