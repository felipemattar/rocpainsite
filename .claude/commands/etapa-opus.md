---
description: Como o /etapa-sonnet, mas no Opus 5.5 (esforço low, medium ou, confirmado pelo dono, high), para lotes com tarefa difícil
argument-hint: [bloco ou IDs, ex. "2" ou "2.1 2.2"; vazio = próximas pendentes]
model: claude-opus-5-5
---
Alvo: $ARGUMENTS

Leia `.claude/commands/etapa-sonnet.md` e siga os passos 1, 3, 4 e 5 dele com este alvo. Só mudam:

- **Quais tarefas** (passo 1): só as que a coluna "Quem" diz Opus. Outro modelo: não faça; diga o comando certo
  (`/etapa-sonnet <ID>` ou `/etapa-haiku <ID>`); `Local` e outra IA, como lá.
- **Modelo** (no lugar do passo 2): este comando roda no Opus 5.5 (campo `model:` do cabeçalho); esforço e teto na seção
  0 do `.ia/delegacao.md` (`/effort`). **Esforço do cartão:** leia a linha `Esforço:` de cada tarefa (sem marca = `low`;
  só valem `low`, `medium` e `high`). Se for diferente do esforço atual da sessão, avise o dono para rodar `/effort
  <nível>` antes e espere. `Esforço: high` sem "(confirmado pelo dono)" no cartão: não faça a tarefa; explique por que
  parece exigir e pergunte (ou divida). Com a marca, ela não basta (quem escreve o cartão é uma IA): antes de começar,
  peça ao dono neste chat um "sim" para o `high` dessa tarefa; sem resposta, não faça. Faça as tarefas marcadas com Opus
  mesmo que pareçam simples e diga no fim quais poderiam ter ido para o Sonnet (para ajustar a coluna "Quem" na
  próxima). Se parecer exigir mais que o Opus 5.5, divida a tarefa ou pergunte. Bug difícil: siga o roteiro da seção 0
  do `.ia/delegacao.md` (reproduzir, hipóteses, medir, causa provada no cartão).
- **Passagem**: `--ferramenta "Claude (Opus 5.5)"`.
