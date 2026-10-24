---
description: Executa tarefas do TASKS.md chamando o comando do modelo da coluna "Quem" (/etapa-haiku, /etapa-sonnet ou /etapa-opus)
argument-hint: [IDs ou bloco, ex. "2.1 2.2" ou "2"; vazio = próximas pendentes]
---
Alvo: $ARGUMENTS

Você só despacha: não execute tarefa aqui nem leia o `TASKS.md` inteiro.

Modo coordenador (opcional): se o alvo tiver `--coordenar`, não siga os passos abaixo; chame a skill `etapa-coordenar`
com o alvo sem `--coordenar` e pare quando ela terminar.

1. Rode `python .ia/tasks.py comando $ARGUMENTS`. Cada linha da saída é um passo, já na ordem do `TASKS.md`.
   Anote também `git rev-parse --short HEAD` (início do lote, para o passo 3b).
2. Siga as linhas na ordem:
   - `/etapa-haiku <IDs>`, `/etapa-sonnet <IDs>`, `/etapa-opus <IDs>`: chame a skill de mesmo nome (`etapa-haiku`,
     `etapa-sonnet` ou `etapa-opus`) com os IDs como argumento. O cabeçalho `model:` dela escolhe o modelo. Ela termina
     com "Pare aqui": isso vale para aquele grupo; quando ela terminar, siga para a próxima linha.
     Não mostre linha própria: a skill chamada mostra a linha de anúncio de cada tarefa (passo 3 do `etapa-sonnet.md`).
   - `powershell ... ia-rodar.ps1 ... -Tarefa <ID>` (tarefa `Local`): pergunte ao dono se pode rodar (demora minutos e
     precisa do llama-server ligado). Com o sim, rode o comando em segundo plano e espere ele terminar antes da próxima
     linha, sem mexer no projeto enquanto isso (ele vigia os arquivos e faz commit; duas IAs ao mesmo tempo dão conflito).
   - `outra IA: <IDs>`: não faça; dê ao dono o texto para a outra ferramenta (`/continuar <IDs>` no OpenCode).
   - `perguntar (...)`, `aguardando decisão do dono`, `já feita`, `bloco sem tarefa aberta`, `não encontrada`: diga
     ao dono e não execute.
   Com mais de uma linha `/etapa-*`, chame todas com ` --continua` depois dos IDs (ex.: `etapa-haiku` com "2.1 --continua"):
   elas não escrevem passagem e você fecha uma vez só no passo 4.
3. Se um grupo parar com dúvida, `[!]` ou pedido de outro comando (ex.: "a tarefa X pede o `/etapa-opus`"), pare e mostre
   ao dono antes de seguir para a próxima linha.
3b. **Conferência do lote** (só se mais de uma tarefa ficou `[x]` neste lote): chame UMA vez o subagente `conferente` (Haiku,
   só lê) com o intervalo `<início do lote>..HEAD` e, de cada tarefa `[x]` do lote, o ID e a linha dela no `TASKS.md` (o
   cartão). Ele responde uma linha por tarefa: `entregue`, `parcial: <o que falta>` ou `faltou: <o quê>`. Tudo `entregue`:
   uma frase no resumo final. Qualquer outra resposta: mostre ao dono como veio, sugira `/revisar` e, se ainda vai escrever
   a passagem (passo 4), registre em `--cuidado` o que não foi entregue.
4. Se usou `--continua` (no fim ou ao parar antes): atualize "Estado atual" no `CLAUDE.md` (2–3 linhas), escreva a passagem
   com `python .ia/passagem.py --escrever --commitar --ferramenta "Claude (<modelos usados>)" --feito ... --parou ...
   --cuidado ... --proximo ...` (o que todos os grupos fizeram) e rode `python .ia/passagem.py --conferir` até dar "Passagem OK".
   Mudança significativa no turno: `--revisar` na passagem (quando usar: passo 3 de `.claude/commands/passar.md`).
5. No fim, responda em até 6 linhas: o que cada comando fez, o que ficou para o dono e o próximo passo. Se o lote fez
   mudança significativa e a passagem foi gravada com `--revisar`, diga que o `/inicio` seguinte revisa sozinho; se não
   (grupo que fechou a própria passagem), sugira `/revisar`.
