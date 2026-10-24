---
description: Fecha o turno do Claude e prepara a passagem para outra IA continuar
argument-hint: [o que a próxima IA deve fazer, opcional]
model: claude-sonnet-5-5
effort: low
---
Próximo passo pedido: $ARGUMENTS

Feche o seu turno para que outra IA (OpenCode, Codex, Gemini CLI ou outra) continue, gastando o mínimo de tokens:

1. Se há trabalho pronto não commitado, rode `python .ia/checar.py` e faça commit (um por tarefa).
   O que ficou pela metade: desfaça ou commit marcado "WIP", e anote em "Parou em".
2. No `TASKS.md`, nenhuma tarefa sua fica `[~]` (só a "+ dono" que espera o teste do dono, dizendo na passagem o que testar): marque `[x]` (com "Real" e "Claude (<modelo>)" em "Quem"),
   `[!]` (com entrada em `DUVIDAS.md`) ou volte para `[ ]`.
3. Escreva a passagem com `python .ia/passagem.py --escrever --commitar --ferramenta "Claude (<modelo>)"
   --feito "<IDs>" --parou "..." --cuidado "..." --proximo "..."` (insere no topo, em UTF-8, e faz o commit;
   nunca edite o `PASSAGEM.md` com `>>`/`Out-File`). Em "Próximo", seja concreto: IDs das tarefas, na ordem, e
   qualquer cuidado (ex.: comando extra antes do commit). Use o que foi pedido acima, se houver. Caminho que não deu
   certo: `--tentado "<o quê e por quê>"` (a próxima IA não repete). Nada de dado sensível
   na passagem (senha, token, chave, conteúdo do `CLAUDE.local.md`, caminho privado): ela vai para o git e para o `--pacote`.
   Turno com mudança significativa (regras do `CLAUDE.md`, `.ia/`, scripts de instalação, vários arquivos ou vários
   projetos): acrescente `--revisar` ao comando; ele grava `REVISAR: <intervalo git>` na passagem e o `/inicio` seguinte
   roda o `/revisar` sozinho (contexto limpo, em outro chat). Vários projetos: `--revisar "<projeto>:<a>..<b>; ..."`.
4. Rode `python .ia/passagem.py --conferir` e corrija até dar "Passagem OK".
5. Responda em até 5 linhas: o que você fez, e o texto pronto para colar na outra IA, assim:
   `/continuar <IDs ou instrução>` (no OpenCode) — ou, em outra ferramenta:
   "Siga o AGENTS.md: faça <IDs> e deixe a passagem ao sair."
