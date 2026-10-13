# Expedições IUR

Webapp do **Instituto Últimos Refúgios (IUR)** para organizar expedições de documentário e fotografia de natureza: projetos, blocos de datas, diárias (frentes, local, horários, equipe, carros, motoristas), confirmação de "ciente", lista de equipamentos e inventário.

- Idioma da interface, do código comentado e das respostas: **português do Brasil**.
- Usuários usam muito no **celular, em campo** (às vezes sem sinal). Toda tela precisa funcionar a ~400px de largura.
- Hospedagem: **GitHub Pages** (site estático), na pasta `iur/expedicoes-iur/` do repositório do site [felipemattar/rocpainsite](https://github.com/felipemattar/rocpainsite) → **https://rocpaingames.com/iur/expedicoes-iur/**. Banco: **Firebase** (Firestore + Authentication com Google), projeto `equipamentosiur`.

## Stack e regras de arquitetura
- HTML + CSS + **JavaScript puro em módulos ES** (sem framework, sem build, sem bundler). Não introduzir React/Vite/etc. sem pedido explícito.
- Firebase JS SDK **10.12.2** importado da CDN `gstatic` só em `js/firebase.js`.
- **Só `js/firebase.js` fala com o Firebase.** As telas chamam `js/actions.js` (escrita) e leem de `js/store.js` (estado).
- Escritas não esperam o servidor (`setDoc(...).catch(handler)`): o Firestore tem cache local persistente, então funciona offline e sincroniza depois.
- Ajustes de negócio ficam em **`js/config.js`** (funções e hierarquia, horários padrão, veículos, perfis, busca de locais, nome do app). Preferir mudar lá a espalhar constantes.
- Tema único **claro**, cores do site ultimosrefugios.org.br (tokens em `css/base.css`: `--forest #1B3017`, `--moss #35612E`, `--sage`, `--lime`…). Não reintroduzir modo escuro sem pedido; já causou texto preto em fundo escuro.
- Renderização: cada tela gera HTML com template strings e **sempre** passa texto do usuário por `esc()` (`js/utils.js`). Rerender completo a cada mudança de dados (`store.onChange`); `main.js` preserva foco e texto digitado em inputs com `id`. Todo input editável precisa de `id` estável.
- Sem `alert/confirm/prompt`: confirmações usam `armButton()` (segundo clique confirma) ou um painel (`openSheet`).

## Estrutura
```
index.html          casca (topo, nav, #view, sheet e toasts)
css/base.css        tokens de cor/tipografia + componentes básicos
css/app.css         telas de projeto/diária + tema Últimos Refúgios (final do arquivo)
img/logo-ur.png     logo (inserido via CSS em .brand h1::before)
js/config.js        AJUSTES
js/firebase.js      camada de dados (auth, listen, save, merge, remove, batchSet, newId)
js/store.js         estado S, assinaturas em tempo real, permissões can()/canEditProject()
js/logic.js         regras puras: blocos/dias, diária em destaque (20h → amanhã), getDay/normalizeDay,
                    ciência (scheduleSig/ackState), carros (carPlan/unseat), conflitos de equipamento, mapa
js/actions.js       gravações (projeto com checagem de conflito, diária com timesAt, ciente, itens, grupos, equipe)
js/components.js    peças reaproveitadas (cartão da diária, painel ciente, carros, mapa, linha do tempo)
js/views/*.js       uma tela por arquivo: home, project (abas resumo/diarias/equipamentos/equipe),
                    diaria, inventory, groups, labels, team
js/main.js          rotas por hash, login, nav, redesenho
js/seed.js          inventário inicial (botão "Importar" com banco vazio)
firestore.rules     regras de segurança (colar no console do Firebase)
tests/              teste ponta a ponta com Firebase simulado, check.mjs (sintaxe), serve.mjs (servidor local)
```

### Rotas
`#/` projetos · `#/projeto/ID[/resumo|diarias|equipamentos|equipe]` · `#/projeto/ID/diaria/AAAA-MM-DD` · `#/projeto/ID/diaria/AAAA-MM-DD/equipamentos` (equipamentos do dia, tela à parte) · `#/inventario` · `#/grupos` · `#/etiquetas` · `#/equipe` · `#/item/ID` (QR code). `#SUB-03` (formato antigo) também abre o item.

## Modelo de dados (Firestore)
- `team/{email}` → `{ name, role: 'admin'|'editor'|'producer'|'member', addedBy, addedAt }` (o dono fixo pode ter `role:'owner'`)
- `items/{GRP-NN}` → `{ name, group, qty, accessories, status: owned|ordered|tobuy, condition: ok|needs|repair, returnDate, location, notes, photo (data URL ~30-50KB) }`
- `groups/{SIGLA}` → `{ name, desc, order }`
- `projects/{id}` → `{ name, notes, dates:[{start,end,label}], team:[emails], roles:{email:[funcIds]}, vehicles:[{id,name,daily}], items:[{id,qty}], checked:{itemId:true}, load:{itemId:vehicleId}, created, createdBy }`
  - campo legado `days` (mapa) pode existir em projetos antigos; `getDay()` converte.
- `projects/{id}/days/{AAAA-MM-DD}` → `{ info, fronts:[{ id, name, local, place:{name,desc,lat,lon,url}|null, times:{saida,almoco,volta}, extra:[{t,txt}], obs, people:[emails], vehicles:[ids], seats:{vehicleId:{driver, people:[emails]}} }], items:{itemId:{f:frontId, v:vehicleId, qty}}, timesAt, updatedAt, updatedBy }`
  - `timesAt` muda quando muda algo de `scheduleSig()` (local, mapa, horários, equipe, carros, lugares) → confirmações anteriores viram "confirmar de novo".
- `projects/{id}/acks/{AAAA-MM-DD__email}` → `{ email, date, at }`

## Perfis e permissões
| Perfil | Pode |
|---|---|
| Administrador (`OWNERS` em config.js + role admin) | tudo, aba Equipe, Etiquetas QR e QR code na ficha do equipamento (só admin vê QR) |
| Editor | criar/excluir/editar todos os projetos, inventário e grupos |
| Produtor (`producer`) | ver **e editar** só projetos em que está em `team` (não cria/exclui projeto, não sai da equipe), marcar ciente. **Não vê equipamentos**: menu só com Projetos, sem aba Equipamentos do projeto nem equipamentos do dia; não altera `items`/`checked`/`load` do projeto nem `items` da diária. Edita os veículos (aparecem na aba Diárias) |
| Membro | só **ver** projetos em que está em `team` e marcar ciente; não edita nada e não vê equipamentos |

Capacidades por perfil ficam em `ROLES` (config.js): `edit`, `editOwn`, `equip`, `qr`, `team`, `allProjects`. No cliente: `can(cap)`, `canEditProject(p)`, `canEditEquip()`. Quem não pode editar equipamentos não faz cascata neles (remover carro/frente deixa o destino do equipamento "inválido" para o editor revisar), senão a regra do Firestore recusa a gravação.

As mesmas regras estão em **dois lugares**: no cliente (`can()`, `canEditProject()`) e em `firestore.rules`. **Ao mudar permissões, mudar os dois.** O e-mail do dono fixo também está duplicado: `OWNERS` (config.js) e `proprietario()` (firestore.rules).

Produtores e membros listam projetos com consulta `where('team','array-contains', email)` — a regra de leitura depende disso.

## Rodar e testar
- Os scripts são em Node puro (sem bash/python), para rodar igual no Windows, macOS e Linux.
- Local: `npm run dev` (servidor estático de `tests/serve.mjs`) e abrir `http://localhost:8000`. Abrir o `index.html` direto do disco **não** funciona (módulos ES). Para login real, `localhost` precisa estar em Authentication → Domínios autorizados.
- Checagem de sintaxe: `npm run check`.
- Teste ponta a ponta: `npm install`, `npx playwright install chromium` (uma vez) e `npm run test:e2e`.
  - `tests/run-e2e.mjs` copia o app para uma pasta temporária, troca `js/firebase.js` por `tests/firebase-stub.js` (banco em memória via localStorage, usuário via `?as=email`) e roda `tests/e2e.mjs`.
  - O teste importa o inventário, cria equipe (editor/membro), funções, blocos, uma diária com 2 frentes, mapa (busca Photon simulada), motoristas/passageiros, ciente, e testa a visão de membro, editor e de alguém sem acesso. Ele imprime o estado salvo e **falha só se houver erro de JavaScript** na página; leia a saída para conferir valores. Capturas ficam em `tests/screenshots/`.
  - Se mudar nomes de ids/atributos usados no teste (`#d-info`, `#fl-<frente>`, `[data-ack]`, `#dr-<frente>-<carro>`…), atualizar `tests/e2e.mjs`.
- Antes de entregar uma mudança: `npm run check` + `npm run test:e2e` e olhar as capturas em largura de celular.

## Publicar
O app **não** tem repositório git próprio: o repositório é o do site, com raiz em `D:\GitHub\rocpainsite` (o resto do site — `index.html`, `CNAME`, `Games/`… — não é deste app; não mexer). Caminhos nos comandos git são relativos a essa raiz (`iur/expedicoes-iur/...`).
1. Commit só dos arquivos de `iur/expedicoes-iur/` e push do `main` do `rocpainsite`; o GitHub Pages publica sozinho em alguns minutos. `node_modules/` e `tests/screenshots/` ficam fora pelo `.gitignore` da pasta.
2. Como o app fica numa subpasta, todo caminho no código precisa ser **relativo** (`css/…`, `js/…`), nunca começando com `/`.
3. `rocpaingames.com` precisa estar em Firebase → Authentication → Domínios autorizados.
4. Se `firestore.rules` mudou: colar no console do Firebase → Firestore → Regras → Publicar.

## Serviços externos
- **Photon** (`photon.komoot.io`, OpenStreetMap): sugestões de local, grátis e sem chave. Debounce de 450ms. Google Places exigiria chave com cobrança — só trocar `searchPlaces()` em `js/views/diaria.js` se pedirem.
- Links de mapa usam URLs públicas do Google Maps (`/maps/search/?api=1`, `/maps/dir/?api=1`), sem chave.
- Compartilhar a diária (botões no topo da diária, texto e links em `dayShareText()`/`whatsappURL()`/`gcalURL()` no `logic.js`): WhatsApp por `wa.me/?text=` e Google Agenda pelo link público `calendar.google.com/calendar/render?action=TEMPLATE` (fuso em `TIMEZONE` no config.js). Não atualizam sozinhos se a diária mudar. Ideia discutida para depois: convites automáticos no Google Agenda via Google Apps Script (botão "Avisar equipe").
- QR code: `qrcode-generator@1.4.4` via jsDelivr (global `qrcode`).
- Fontes: Google Fonts (Nunito Sans, Open Sans condensada, Barlow Condensed, Public Sans).

## Pendências / ideias já discutidas
- Fotos dos equipamentos ainda não foram cadastradas (campo existe; miniatura salva no próprio item).
- Etiquetas QR: só admin por enquanto; o QR usa `location.origin + pathname`, então as etiquetas apontam para o endereço onde foram geradas — gerar a partir de https://rocpaingames.com/iur/expedicoes-iur/. Se o endereço mudar, as etiquetas impressas param de funcionar.
- Rádios, lanternas e grampos: quantidades a confirmar no inventário.
