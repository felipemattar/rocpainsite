---
description: Faz as próximas tarefas do TASKS.md no Sonnet 5.5 (o padrão) e deixa a passagem para a próxima IA
argument-hint: [bloco ou IDs, ex. "2" ou "2.1 2.2"; vazio = próximas pendentes]
model: claude-sonnet-5-5
effort: medium
---
Alvo: $ARGUMENTS

Faça UMA etapa do `TASKS.md`, gastando o mínimo de tokens. Leia só a tabela do bloco, a última entrada de
`PASSAGEM.md` e as seções do `CLAUDE.md` que precisar.

1. **Lote.** As tarefas do alvo; se vazio, as próximas pendentes (`[ ]`) cujas dependências já estão `[x]`,
   até ~5. Se o bloco tiver plano do `/planejar` (logo abaixo do título), siga-o sem replanejar.
   Sem alvo, pule as "+ dono" (precisam de teste no aparelho do dono) e as `[?]`; com o ID no alvo, faça a "+ dono" até
   onde der sem o aparelho e deixe-a `[~]` esperando o teste do dono (a passagem diz o que testar).
   Este comando faz só as tarefas cuja coluna "Quem" cita Sonnet, só "Claude", "—" ou outro valor
   sem Haiku, Opus, `Local`, `Outra IA` ou nome de outra IA. Tarefa de outro modelo: não a faça;
   diga o comando certo (`/etapa-haiku <ID>`, `/etapa-sonnet <ID>` ou `/etapa-opus <ID>`). Tarefa `Local`: diga para
   rodá-la com `ia-rodar.ps1 -Tarefa <ID>` (planejada para a IA local, às vezes por privacidade), ou para trocar a coluna "Quem". Tarefa com `Outra IA` ou nome de outra IA (`OpenCode`...): é dela; não a faça sem o dono pedir.
2. **Modelo.** Este comando roda no Sonnet 5.5 (campo `model:` do cabeçalho), mesmo que a sessão esteja no Opus. Se
   alguma tarefa exigir raciocínio difícil (arquitetura, algoritmo ou protocolo desconhecido, depuração difícil), NÃO a faça aqui:
   pare e diga "a tarefa X pede o `/etapa-opus`" (regra de modelos, esforço e teto: seção 0 do `.ia/delegacao.md`); se parecer exigir mais, divida a tarefa ou pergunte.
3. **Uma tarefa por vez:** antes de começar cada uma, mostre ao dono uma linha
   `▶ Tarefa <ID> — <título curto> · <modelo deste comando> · esforço <nível>` (o `effort:` do cabeçalho; no
   `/etapa-opus`, o do cartão); marque `[~]`, faça, rode `python .ia/checar.py`, marque `[x]`, a coluna "Real" e
   "Claude (<modelo>)" na coluna "Quem", e faça **um commit por tarefa**. Não mude o formato do `TASKS.md`.
4. **Travou?** Registre em `DUVIDAS.md` ("Abertas"), marque `[!]` e siga para a próxima que não dependa dela.
5. **Fechar.** Se o alvo terminar com `--continua` (o `/etapa` chama outro grupo depois e fecha por todos), não feche:
   confira que está tudo commitado, diga em 1–2 linhas o que fez e pare. Senão, atualize "Estado atual" no `CLAUDE.md` (2–3 linhas), escreva a passagem com
   `python .ia/passagem.py --escrever --commitar --ferramenta "Claude (<modelo>)" --feito ... --parou ... --cuidado ...
   --proximo ...` (UTF-8, no topo, com commit) e rode `python .ia/passagem.py --conferir` até dar "Passagem OK".
   Mudança significativa no turno: `--revisar` na passagem (quando usar: passo 3 de `.claude/commands/passar.md`).
   Mantenha o "Estado atual" do `CLAUDE.md` em ~10 linhas (detalhes em `docs/`).
   Responda em até 6 linhas: o que fez, o que ficou pendente e o próximo passo — dizendo se outra IA pode
   seguir sozinha pelo `AGENTS.md` — com o texto pronto para ela (ex.: `/continuar <IDs>` no OpenCode). **Pare aqui.**
