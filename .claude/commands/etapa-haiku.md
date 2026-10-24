---
description: Como o /etapa-sonnet, mas no Haiku 5.5, só para tarefas simples e mecânicas com teste
argument-hint: [bloco ou IDs, ex. "2" ou "2.1 2.2"; vazio = próximas pendentes]
model: claude-haiku-5-5
effort: low
---
Alvo: $ARGUMENTS

Leia `.claude/commands/etapa-sonnet.md` e siga os passos 1, 3, 4 e 5 dele com este alvo. Só mudam:

- **Quais tarefas** (passo 1): só as que a coluna "Quem" diz Haiku. Outro modelo: não faça; diga o comando certo
  (`/etapa-sonnet <ID>` ou `/etapa-opus <ID>`); `Local` e outra IA, como lá.
- **Modelo** (no lugar do passo 2): este comando roda no Haiku 5.5 (campo `model:` do cabeçalho) e é só para tarefas
  **simples e mecânicas com teste** (tradução de textos de interface, boilerplate, renomeação, porte simples). Tarefa que
  exige julgamento, muda mais de um módulo ou não tem teste que diga quando está pronta: NÃO a faça; pare e diga "a tarefa X
  pede o `/etapa-sonnet`" (ou `/etapa-opus`). Tarefa que falhar duas vezes no `checar.py`: marque `[!]`, registre em
  `DUVIDAS.md` e passe para a próxima.
- **Passagem**: `--ferramenta "Claude (Haiku 5.5)"`.
