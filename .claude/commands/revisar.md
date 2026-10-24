---
description: Revisão com contexto limpo das mudanças recentes (subagente revisor, só lê); use depois de mudança significativa
argument-hint: [intervalo git, ex. "abc123..HEAD"; vazio = o último turno, desde a passagem anterior]
model: claude-sonnet-5-5
effort: low
---
Alvo: $ARGUMENTS

Você só coordena a revisão: não revise você mesmo (você pode ter feito as mudanças) e não corrija nada ainda.

1. **Intervalo.** Use o alvo, se for um intervalo git. Vazio: o último turno, da passagem anterior até agora:
   `git log --format=%h --grep="^Handoff" -n 2` e use o 2º hash como início (`<2º>..HEAD`); com menos de duas passagens,
   `HEAD~10..HEAD`. Se `git status --short` mostrar mudanças sem commit, diga ao revisor para incluí-las.
2. **Revisor.** Chame o subagente `revisor` com o intervalo, o caminho do projeto e, se o alvo trouxer, o que olhar com
   mais atenção. Mudança em vários projetos: um `revisor` por projeto, em paralelo.
3. **Resultado.** Mostre ao dono os achados (graves primeiro), em até 10 linhas, com `arquivo:linha`. Confira você mesmo
   os graves antes de mostrar (abra o trecho): achado errado do revisor, diga que descartou e por quê.
4. Chamado pelo `/inicio`: pule este passo; o resumo termina com os achados e a decisão fica com o dono. Senão, pergunte quais corrigir. Correção vira tarefa no `TASKS.md` ou é feita com o OK do dono, com commit próprio.

Quando sugerir: depois de mudança significativa (regras do `CLAUDE.md`, `.ia/`, scripts de instalação, vários arquivos ou
vários projetos de uma vez) e antes de passar o turno de um trabalho grande. Para uma revisão maior ou para discutir os
achados com calma, o dono pode abrir um chat novo e rodar `/revisar` lá.
