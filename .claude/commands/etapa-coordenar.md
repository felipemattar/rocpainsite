---
description: "Modo coordenador (opcional): o Opus planeja, despacha as tarefas aos subagentes executor-haiku/executor-sonnet pela coluna 'Quem', revisa e manda corrigir"
argument-hint: [bloco ou IDs, ex. "2" ou "2.1 2.2"; vazio = próximas pendentes]
model: claude-opus-5-5
effort: medium
---
Alvo: $ARGUMENTS

Você é o coordenador: entende, divide, despacha, revisa e fecha. A escrita de código fica com os executores
(`.claude/agents/executor-haiku.md` e `executor-sonnet.md`). Regra de modelos e esforço: seção 0 do `.ia/delegacao.md`.
Modo experimental: compare com o `/etapa` comum antes de adotar (tarefa de bateria no `TASKS.md` do kit).

1. **Lote.** Rode `python .ia/tasks.py comando $ARGUMENTS`. Cada linha diz o executor:
   - `/etapa-haiku <IDs>` → subagente `executor-haiku`; `/etapa-sonnet <IDs>` → `executor-sonnet`;
   - `/etapa-opus <IDs>` → faça você mesmo, como o `/etapa-opus`, com a trava de esforço do passo "Modelo" dele:
     leia a linha `Esforço:` do cartão (sem marca = `low`); diferente do esforço atual, avise o dono para rodar
     `/effort <nível>` e espere; `high` sem "(confirmado pelo dono)" não roda, e com a marca peça antes um "sim" do
     dono no chat;
   - `ia-rodar.ps1`, `outra IA`, `perguntar`, `aguardando decisão`, `já feita`, `não encontrada`: diga ao dono e não
     execute.
   Leia só a tabela do bloco, o plano dele (se houver) e a última passagem.
2. **Despachar.** Antes de cada tarefa, mostre ao dono uma linha
   `▶ Tarefa <ID> → <executor> · <modelo> · esforço <nível>` (`executor-haiku`: Haiku `low`; `executor-sonnet`: Sonnet
   `medium`; você: Opus 5.5 e o esforço do cartão). Marque `[~]` e mande ao executor um pedido autossuficiente: ID,
   arquivos envolvidos, o que fazer, o teste que confirma e as convenções do `CLAUDE.md` que importam. Tarefas sem
   dependência entre si e sem arquivo em comum podem ir em paralelo; o resto em sequência. Nunca use o subagente `fork`
   (copia a conversa e roda no Opus).
3. **Revisar como adversário.** O resumo do executor é uma alegação, não prova: `git diff --stat`, leia os trechos
   que importam e rode `python .ia/checar.py`. Confira: escopo a mais (mudou o que não foi pedido?), partes faltando,
   suposições escondidas, casos de borda e caminhos de erro, testes alterados para passar e regressão no código vizinho.
   - Veio errado: devolva ao executor a lista exata dos defeitos. Código direto só para ajuste de 1 ou 2 linhas.
   - Devolveu "pede executor-sonnet": reenvie ao `executor-sonnet`; "pede o coordenador": faça você.
   - No máximo 2 devoluções por tarefa; depois disso, replaneje (cartão mais preciso, executor acima) ou marque `[!]`,
     registre em `DUVIDAS.md` ("Abertas") e siga.
4. **Fechar cada tarefa** (você, não o executor): `[x]`, coluna "Real", "Claude (<modelo do executor>)" em "Quem",
   **um commit por tarefa**. Não mude o formato do `TASKS.md`.
5. **Fechar o lote.** Atualize "Estado atual" no `CLAUDE.md` (2–3 linhas), escreva a passagem com
   `python .ia/passagem.py --escrever --commitar --ferramenta "Claude (Opus 5.5 + executores)" --feito ... --parou ...
   --cuidado ... --proximo ...` e rode `python .ia/passagem.py --conferir` até dar "Passagem OK".
   Mudança significativa no turno: `--revisar` na passagem (quando usar: passo 3 de `.claude/commands/passar.md`).
   Responda em até 6 linhas: o que fez, quantos executores e quantas correções por tarefa (dado para a bateria), o que
   ficou pendente e o próximo passo. **Pare aqui.**
