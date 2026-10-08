# Expedições IUR

App para organizar as diárias de projetos de documentário e fotografia de natureza: datas, equipe, horários, frentes de trabalho, carros e equipamentos.

## Publicar (GitHub Pages)
1. Apague o `index.html` antigo do repositório e envie **todo o conteúdo desta pasta**, mantendo as subpastas `css/` e `js/`.
2. No Firebase → Firestore → **Regras**, cole o `firestore.rules` e clique em **Publicar**. Sem esse passo as diárias e o "ciente" não funcionam.
3. Os dados que já estão no Firebase (inventário, grupos, projetos, equipe) continuam valendo.

## Perfis (aba Equipe, só para administradores)
| Perfil | Pode |
|---|---|
| Administrador | tudo, inclusive dar e tirar acesso |
| Editor | criar e editar projetos, diárias, equipamentos e grupos |
| Membro | ver os projetos em que foi incluído, consultar o inventário e marcar "ciente" |

Quem estava como "Membro" na versão anterior agora só visualiza. Mude para **Editor** quem precisa editar.

## Como o app está organizado
```
index.html            estrutura da página
css/base.css          cores, tipografia, componentes básicos
css/app.css           telas de projetos e diárias
js/config.js          ← AJUSTES: funções e hierarquia, horários padrão, veículos, perfis, nome do app
js/firebase.js        acesso ao banco (único arquivo que fala com o Firebase)
js/store.js           estado, assinaturas em tempo real, permissões
js/logic.js           regras: blocos de datas, diária do dia, conflitos, ciência
js/actions.js         gravações (salvar diária, projeto, item…)
js/components.js      peças visuais reaproveitadas (cartão da diária, linha do tempo)
js/views/*.js         uma tela por arquivo: home, project, diaria, inventory, groups, labels, team
js/seed.js            inventário inicial (botão Importar com banco vazio)
```

### Ajustes comuns em `js/config.js`
- **Funções:** edite a lista `FUNCTIONS`. A ordem é a hierarquia. Não mude o `id` de uma função já usada.
- **Horários padrão:** `DEFAULT_TIMES` (saída 08:00, almoço 12:00, volta 18:00).
- **Hora em que o resumo passa a mostrar a diária de amanhã:** `NEXT_DAY_FROM_HOUR` (20).
- **Veículos de todo projeto novo:** `DEFAULT_VEHICLES`.
- **Administrador fixo:** `OWNERS`. Mude também a função `proprietario()` no `firestore.rules`.

## Onde ficam os dados no Firestore
- `team/{email}`: nome e perfil de quem tem acesso
- `items`, `groups`: inventário
- `projects/{id}`: nome, blocos de datas, equipe e funções, veículos, lista de equipamentos
- `projects/{id}/days/{AAAA-MM-DD}`: a diária (frentes, local, horários, equipe, carros, equipamentos)
- `projects/{id}/acks/{data__email}`: quem marcou "ciente"

## Testar localmente
Abrir o `index.html` direto do disco não funciona (os módulos JS precisam de um servidor). Use, por exemplo, `python -m http.server` dentro da pasta e acesse `http://localhost:8000`. Também adicione `localhost` em Authentication → Domínios autorizados.
