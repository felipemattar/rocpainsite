---
description: Planeja um bloco do TASKS.md para qualquer IA executar depois (Claude ou outra IA)
argument-hint: <bloco ou IDs, ex. "Engine" ou "2.1 2.2 2.3">
model: claude-opus-5-5
effort: medium
---
Alvo: $ARGUMENTS

Planeje SÓ este bloco (não o projeto inteiro: o plano envelhece). Aqui vale gastar raciocínio para que a
execução depois seja simples para qualquer IA. Este comando roda no Opus 5.5 com esforço `medium` (o `effort:` do
cabeçalho; vale só para o planejamento, não para as tarefas).

0. **Alinhar com o dono antes de planejar** (só se o bloco ainda for vago: faltam o resultado esperado, um limite ou uma
   escolha que muda o desenho; bloco já bem descrito no `TASKS.md` pula este passo). Pergunte UMA coisa por vez, sempre com
   uma sugestão de resposta. O que o projeto responde (`CLAUDE.md`, `TASKS.md`, código) você lê em vez de perguntar. Termine
   com um resumo de 3–5 linhas do que ficou decidido e espere o "ok" do dono; só então siga. Sem o "ok", não escreva tarefas.
   Sem interação possível (`claude -p`, subagente): não invente o "ok"; escreva as suposições no topo do bloco e pare.
1. **Entender o mínimo:** as linhas do bloco no `TASKS.md`, as seções do `CLAUDE.md` que importam e só os
   arquivos que o bloco vai tocar (prefira grep a ler arquivos inteiros). Busca ampla (onde algo é usado, quais arquivos
   tocam um tema, muitos arquivos para varrer): peça ao subagente Explore (Haiku, só lê) e use só a conclusão dele, em vez
   de ler os arquivos aqui no Opus. Bloco com vocabulário próprio que uma IA não
   adivinharia, ou decisão que alguém desfaria sem saber o motivo: crie `docs/GLOSSARY.md` ou `docs/decisions/NNNN-nome.md`
   a partir de `.ia/modelos/` (só nesses casos; o kit não os cria) e faça commit junto com o molde.
2. **Dividir em tarefas** coesas, cada uma com teste próprio e que uma IA consiga fazer numa sessão. Não
   picar demais. Trabalho de descoberta (protocolo desconhecido, teste no aparelho) fica como uma tarefa só,
   marcada "+ dono" se depender do aparelho. Prefira fatias finas: cada tarefa entrega algo que funciona de ponta a ponta,
   mesmo que pequeno, e não uma camada isolada (ex.: "ler e mostrar um item", não "todo o parser" e depois "toda a tela").
3. **Fixar as interfaces:** para o que uma tarefa entrega a outra, escreva você mesmo o molde (assinaturas,
   tipos, um exemplo e os testes que ainda falham, marcados como falha esperada na ferramenta de teste do
   projeto). Se o teste do projeto for `unittest discover -s tests -t .`, crie `tests/__init__.py` (e `__init__.py` na pasta do código) junto com o molde; sem ele o hook reprova o primeiro commit. Rode `python .ia/checar.py` e faça commit do molde.
4. **Escrever o plano** logo abaixo do título do bloco no `TASKS.md`: ordem, dependências e interfaces
   combinadas (3–8 linhas). Cada tarefa vira uma linha da tabela com descrição autossuficiente: arquivos,
   o que fazer, critério de pronto (qual teste deve passar), e a coluna "Quem" (ver "Quem executa"). Sem URLs.
   Dependência no próprio cartão, com estas palavras: "depende de 2.1" ou "depende de 2.1 e 2.3" (o `/etapa` sem IDs só
   escolhe a tarefa quando elas estão `[x]`).
4b. **Aceite de TODA tarefa com comportamento testável** (de qualquer executor, não só da IA local): `python .ia/aceite.py
   esqueleto <ID>` e preencha os casos de `tests/test_aceite_<ID>.py` (uma regra por frase do cartão; classes
   `unittest.TestCase`, que rodam também no pytest). A checagem de cada commit (`checar.py`) roda os testes do projeto, aceites
   incluídos; o esqueleto é pulado enquanto a tarefa está `[ ]` e vale a partir de `[~]`. Se o cartão admitir duas leituras,
   reescreva-o antes. Tarefa sem comportamento testável (docs, textos, configuração): não crie o arquivo e escreva no cartão
   "sem teste de aceite: <motivo>". Faça commit do aceite junto com o molde.
5. **Passagem:** `python .ia/passagem.py --escrever --commitar --ferramenta "Claude (<modelo>)" --feito "plano do bloco X"
   --parou "nada em andamento" --cuidado "..." --proximo "seguir pelo AGENTS.md ou /etapa X"` (insere no topo, em
   UTF-8, com commit). Depois `python .ia/passagem.py --conferir` até dar "Passagem OK".
6. **Parar.** Responda em até 5 linhas: quantas tarefas, o que ficou de descoberta e o próximo passo
   (`/etapa <IDs>`, que chama o `/etapa-sonnet`, `/etapa-opus` ou `/etapa-haiku` do modelo marcado; IA local com
   `ia-rodar.ps1 -Caminho <projeto> -Tarefa <ID>`, uma por vez). Não execute nenhuma tarefa.

## Quem executa

Você decide, seguindo `.ia/delegacao.md`. Por enquanto há dois executores: o Claude (nos seus modelos) e a IA local (opcional);
outra IA de nuvem não entra na coluna "Quem", só como sugestão: tarefa média, bem especificada e com aceite que outra IA
faria tão bem quanto o Sonnet ganha no fim do cartão `(poderia ser: Outra IA)`; o dono decide se passa o turno. A melhor
candidata é a que exige ler muitos arquivos (levantamento, inventário, auditoria): é onde o Claude mais gasta tokens. NÃO verifique o servidor da IA local agora: a verificação é feita só ao executar a tarefa
(`ia-rodar.ps1`). Preencha a coluna "Quem" de cada tarefa só com os valores da legenda do `TASKS.md`: `Claude (Haiku 5.5)`,
`Claude (Sonnet 5.5)`, `Claude (Opus 5.5)`, `Local` ou `—` (Claude no Sonnet), mais ` + dono` se precisar de teste no aparelho
(o `/etapa` escolhe o comando por esse valor; `python .ia/checar.py` avisa valor fora do padrão).
- **`Claude (Sonnet 5.5)`** (padrão; `/etapa-sonnet`): blocos bem especificados (implementar a partir do molde e dos testes que
  falham), tradução, geração de arquivos e tudo o que não for para os outros abaixo.
- **`Claude (Opus 5.5)`** (`/etapa-opus`): decisões de arquitetura, algoritmo ou protocolo difícil,
  depuração difícil, e a revisão final do bloco. Tarefa que pede descobrir a causa E mexer com cuidado: divida em
  investigar (Opus) e implementar (Sonnet), como diz a seção 0 do `.ia/delegacao.md`.
  **Esforço da tarefa de Opus:** escreva no cartão `Esforço: medium` quando for arquitetura, algoritmo ou protocolo difícil,
  ou depuração sem causa clara (`low` é o padrão e não precisa de marca; use só `low`, `medium` e `high`).
  Se achar que precisa de `high`, tente dividir a tarefa; se não der, explique ao dono em 2 linhas e só escreva
  `Esforço: high (confirmado pelo dono)` depois do "ok" dele neste chat. Sem interação possível (`claude -p`, subagente),
  nunca escreva `high`: use `medium` e anote a dúvida no cartão.
- **`Claude (Haiku 5.5)`** (`/etapa-haiku`): só tarefa simples e mecânica COM teste (tradução, boilerplate, renomeação, porte
  simples). Regra completa (esforço, teto): seção 0 do `.ia/delegacao.md`.
- **Local (opcional):** só se o `.ia/config.json` não tiver `"ia_local": {"usar": "nunca"}`, houver um motivo (código sensível,
  cota do Claude acabando ou sem internet, lote grande e mecânico) e o tipo de tarefa estiver na tabela do `delegacao.md`. Com
  aceite visível (passo 4b) e cartão autossuficiente (arquivos, o que fazer, qual teste). Na resposta final, diga que as tarefas
  `Local` rodam com `ia-rodar.ps1`, que confere o servidor na hora e pergunta se você quer ligá-lo.
- Na resposta final, uma linha por executor: quais tarefas e por quê (ex.: "Local: 2.1, 2.3 — código privado, parser e catálogo"),
  e uma linha com as sugeridas para outra IA, se houver.
- Quem executa uma tarefa não a revisa: o turno seguinte faz a revisão cruzada (o `/inicio` do Claude revisa o que a local fez).
