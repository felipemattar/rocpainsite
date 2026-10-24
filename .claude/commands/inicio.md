---
description: Início de sessão — o que outras IAs fizeram e o que vem a seguir
model: claude-sonnet-5-5
effort: low
---
Faça o início de sessão gastando o mínimo de tokens:

1. Se o contexto já tem o "Resumo automático do início de sessão" (hook `SessionStart` do `.claude/settings.json`), use-o
   e rode só `python .ia/checar.py` (o hook não roda os testes, para não estourar o tempo dele); senão, rode `python .ia/passagem.py --resumo`: última passagem, commits e arquivos do turno (sem as atualizações do kit),
   árvore, dúvidas abertas, próximas tarefas com o comando de cada uma e checagem. É tudo de que precisa: não leia
   `DUVIDAS.md`, `TASKS.md` nem diffs inteiros; abra um arquivo só se o resumo apontar problema.
2. Se a última passagem for de outra IA (a ferramenta na passagem não é Claude: OpenCode, Codex, Gemini, Cursor, IA local...),
   a revisão é obrigatória e SEM PERGUNTAR: rode agora o subagente `revisor` do kit, como código de um colega
   (intervalo `<passagem anterior>..HEAD` do resumo; ele segue o `CLAUDE.md` do projeto), e traga os achados graves e médios
   no resumo; só sem o `revisor` abra os arquivos apontados. Não termine o resumo com "quer que eu revise?".
   Uma revisão só por turno: se a passagem tiver a linha `REVISAR: <intervalo>`, a do passo 2b é a revisão deste turno e
   substitui esta.
   `REVISAR (Claude)` na passagem (tarefa da IA local fechada só com testes dela): ela e a do passo 2b (se houver `REVISAR:`) são uma revisão só, do intervalo.
2b. Se a última passagem tiver a linha `REVISAR: <intervalo>` (turno com mudança significativa, de qualquer IA ou do próprio
   Claude): rode o `/revisar <intervalo>` você mesmo, agora, antes do resumo; este chat não fez a mudança, então a revisão
   é de contexto limpo. Inclua os achados graves e médios no resumo. Chamado daqui, o `/revisar` só lista os achados: não
   faça a pergunta "quais corrigir" do passo 4 dele; o resumo termina com os achados e a decisão fica comigo.
3. Me dê um resumo em até 8 linhas: quem trabalhou e o que fez, se o turno terminou certo (árvore limpa, passagem,
   testes) ou o que faltou, achados da revisão cruzada (graves e médios), dúvidas abertas e o próximo lote (`/etapa <IDs>`;
   o resumo mostra o comando de cada tarefa).

Não resolva nada ainda; espere minha confirmação.
