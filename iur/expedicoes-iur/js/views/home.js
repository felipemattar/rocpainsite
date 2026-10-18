// Página inicial: projetos do usuário em ordem de data
import { S, can } from '../store.js';
import { esc, fmtDM, ls, openSheet, closeSheet, wday } from '../utils.js';
import { sortProjects, blocks, featuredDay, conflictsFor, personFuncs, funcLabel } from '../logic.js';
import { createProject } from '../actions.js';
import { emptyHTML } from '../components.js';

const SECTIONS = [['ongoing', 'Em andamento'], ['upcoming', 'Próximos'], ['nodates', 'Sem datas definidas'], ['past', 'Encerrados']];

export function renderHome(el) {
  const canAll = can('allProjects');
  let scope = canAll ? ls.get('iur.scope', S.role === 'admin' ? 'all' : 'mine') : 'mine';
  const list = sortProjects([...S.projects.entries()].map(([id, p]) => ({ id, ...p })))
    .filter(p => scope === 'all' || (p.team || []).includes(S.me));
  el.innerHTML = `
    <div class="pagehead"><h2>Projetos</h2>
      <div class="bar" style="margin:0">
        ${canAll ? `<div class="seg small"><button data-scope="mine" aria-pressed="${scope === 'mine'}">Meus</button><button data-scope="all" aria-pressed="${scope === 'all'}">Todos</button></div>` : ''}
        ${can('edit') ? '<button class="btn pri" id="newProj">+ Projeto</button>' : ''}
      </div></div>
    ${!S.loaded.projects ? emptyHTML('Carregando…') : !list.length ? emptyHTML(scope === 'mine' ? 'Você ainda não foi incluído em nenhum projeto.' + (canAll ? ' Veja “Todos”.' : '') : 'Nenhum projeto ainda.') :
      SECTIONS.map(([k, t]) => { const arr = list.filter(p => p.st.k === k); if (!arr.length) return '';
        return `<div class="gsec"><div class="ghead"><h2>${t}</h2><small>${arr.length}</small></div><div class="grid">${arr.map(cardHTML).join('')}</div></div>`; }).join('')}`;
  el.querySelectorAll('[data-scope]').forEach(b => b.addEventListener('click', () => { ls.set('iur.scope', b.dataset.scope); renderHome(el); }));
  el.querySelector('#newProj')?.addEventListener('click', newProjectSheet);
}

function cardHTML(p) {
  const bl = blocks(p), fd = featuredDay(p);
  const nc = can('edit') ? conflictsFor(p).length : 0;
  const mine = personFuncs(p, S.me).map(funcLabel).join(', ');
  const stc = { ongoing: 'p-use', upcoming: 'p-acc', past: 'p-idle', nodates: 'p-idle' }[p.st.k];
  return `<a class="card ${nc ? 'conf' : ''}" href="#/projeto/${esc(p.id)}">
    <div class="pills" style="justify-content:flex-start"><span class="pill ${stc}">${p.st.t}</span>${nc ? `<span class="pill p-bad">⚠ ${nc} conflito${nc > 1 ? 's' : ''}</span>` : ''}</div>
    <h3>${esc(p.name)}</h3>
    <div class="meta">${bl.length ? bl.map(b => `${fmtDM(b.start)}${b.end !== b.start ? '–' + fmtDM(b.end) : ''}${b.label ? ' ' + esc(b.label) : ''}`).join(' · ') : 'Sem datas'}</div>
    ${fd && p.st.k !== 'past' ? `<div class="meta">Diária de ${fd.kind}: <b>${wday(fd.date)} ${fmtDM(fd.date)}</b></div>` : ''}
    <div class="meta">${(p.team || []).length} na equipe${mine ? ` · você: ${esc(mine)}` : ''}</div>
  </a>`;
}

function newProjectSheet() {
  openSheet(`<div class="sheet-h"><div><span class="hint">Novo projeto</span><h2>Criar projeto</h2></div><button class="x" data-close aria-label="Fechar">×</button></div>
    <form class="form" id="pf"><label>Nome do projeto<input type="text" id="p-name" required placeholder="Ex.: Manguezais Capixabas – expedição 1"></label>
    <label>Observações<textarea id="p-notes" placeholder="Objetivo, região, contatos…"></textarea></label>
    <div class="actions"><span></span><div class="r"><button type="button" class="btn" data-close>Cancelar</button><button class="btn pri" type="submit">Criar</button></div></div></form>`, sh => {
    sh.querySelector('#p-name').focus();
    sh.querySelector('#pf').addEventListener('submit', e => { e.preventDefault();
      const name = sh.querySelector('#p-name').value.trim(); if (!name) return;
      const id = createProject({ name, notes: sh.querySelector('#p-notes').value.trim() });
      closeSheet(); location.hash = `#/projeto/${id}/equipe`; });
  });
}
