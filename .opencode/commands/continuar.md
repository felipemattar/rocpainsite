---
description: Continua o projeto seguindo o AGENTS.md (próximas tarefas do TASKS.md + passagem ao sair)
---
Siga o AGENTS.md deste projeto à risca.

Tarefas: $ARGUMENTS
(Se não houver nada acima, siga o passo 3 do AGENTS.md: comece pelas tarefas com o seu nome na coluna "Quem"; senão, as
próximas pendentes na ordem, pulando só as [?]. Antes de fazer uma tarefa que não foi declarada para você, pergunte ao dono.
As "+ dono": faça até onde der e deixe [~] com o que o dono deve testar.)

Última passagem e estado atual:
!`python .ia/passagem.py --resumo`

Regras que mais importam: um commit por tarefa (com python .ia/checar.py antes), TASKS.md no mesmo formato,
passagem escrita no PASSAGEM.md ao sair e, por último, `python .ia/passagem.py --conferir` até dar "Passagem OK".
Testes em `tests/test_<modulo>.py`. Se o comando de teste (`.ia/config.json`) usa `unittest`, use classes `unittest.TestCase`
(funções `test_*` soltas não rodam e a checagem reprova); se usa `pytest`, siga o estilo do projeto.
Se já existir `tests/test_aceite_<ID>.py`, faça-o passar sem alterá-lo nem apagá-lo.
Seu nome na coluna "Quem" e na passagem: "OpenCode (<modelo que você é>)".
