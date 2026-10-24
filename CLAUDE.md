# rocpainsite

## O que é
[Uma ou duas frases: o que o app faz e para quem.]

## Stack
- Linguagem: [ex.: Python 3.12]
- Bibliotecas principais: [...]
- Como rodar: `[comando]`
- Como testar: `[comando]`

## Armadilhas
- [O que uma IA erraria sem aviso.]

## Convenções
- Projeto migrado para o fluxo com duas IAs: MANTER as convenções que o projeto já usava
  (idioma do código, dos nomes, dos comentários e da interface). Não converter nem padronizar.
- [Convenções atuais do projeto, documentadas a partir do código]

## Fluxo de trabalho com duas IAs
- Várias IAs em sequência (Claude Code, IA local, outra IA quando o dono passar o turno); tudo passa por `TASKS.md` (fonte
  da verdade), `PASSAGEM.md` (troca de turno), `DUVIDAS.md` e o git. Processo comum a todas: `AGENTS.md`.
- Claude Code: `/inicio` ao chegar, `/planejar <bloco>` para planejar e escolher quem executa, `/passar` para sair.
- Executar tarefas, mesmo em pedidos curtos ("pode seguir para a X"): `/etapa <IDs>` (sem IDs: as próximas). Ele lê a
  coluna "Quem" e chama `/etapa-haiku`, `/etapa-sonnet` ou `/etapa-opus`; `Local`, `Outra IA` e mistura: pergunta.
  Executores e motivos: `.ia/delegacao.md`.
- Modelos do Claude: regra única na seção 0 do `.ia/delegacao.md`.
- `python .ia/checar.py` roda antes de cada commit (hook); o comando de teste fica em `.ia/config.json` (`teste`).

## Estado atual
<!-- no máximo ~10 linhas; histórico e detalhes em docs/HISTORICO.md -->
- [O que já funciona]
- [O que está em andamento]
- [Próximos passos]

## Decisões (por quê)
- [...]
