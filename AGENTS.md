<!-- criado pelo fluxo-duas-ias: instruções para qualquer IA continuar este projeto -->
# Instruções para IAs neste projeto

Várias IAs trabalham aqui em sequência (Claude Code, a IA local pelo `ia-rodar.ps1` e outra IA quando o dono passar o turno:
Codex, Gemini CLI, OpenCode, Cursor...). Quem chega continua de onde o anterior parou e, ao sair, deixa a passagem.
Os comandos do Claude Code (`/inicio`, `/etapa`, `/etapa-*`, `/planejar`, `/passar`) são dele; para você, o processo é este arquivo.

## Pronto quando
- Testes passando (`python .ia/checar.py` sem FALHOU), aceite da tarefa incluído.
- Um commit pequeno por tarefa, com mensagem clara.
- `TASKS.md`: `[x]`, coluna "Real" e quem fez na coluna "Quem".
- "Estado atual" do `CLAUDE.md` atualizado se o que funciona mudou.
- Ao sair: passagem escrita e `python .ia/passagem.py --conferir` dando "Passagem OK".

## Ao começar
1. `python .ia/passagem.py --resumo`: última passagem, o que mudou no turno anterior, árvore, dúvidas abertas, próximas
   tarefas e checagem. Mudança não commitada que você não entende: pare e pergunte.
2. Leia as convenções e regras do `CLAUDE.md` (idioma, estrutura, como testar). Plano do bloco (logo abaixo do título no
   `TASKS.md`, escrito pelo `/planejar`): siga-o. Se existirem, `docs/GLOSSARY.md` (termos do projeto) e `docs/decisions/`
   (motivo de decisões): leia o que tocar na tarefa; termo novo ou decisão importante, registre lá (modelos em `.ia/modelos/`).
3. Escolha a tarefa no `TASKS.md`:
   - **Comece pelas declaradas para você:** IDs que o dono pediu, ou `Outra IA` / o seu nome na coluna "Quem" (a IA local
     rodando pelo `ia-rodar.ps1` é a indicada da tarefa que recebeu). Depois, as que têm `(poderia ser: Outra IA)` no cartão
     (sugestão do `/planejar`; o dono passou o turno para você, então pode fazê-las).
   - Sem nenhuma, a próxima `[ ]` com dependências `[x]`, na ordem; pule as `[?]` e as "+ dono" (aparelho do dono).
     Dependência fica no cartão: "depende de X.Y".
   - **Não declarada para você** (`Claude (…)`, `Local`, `—` ou outra IA): pergunte ao dono antes, dizendo qual é
     (`Local` pode ser por privacidade do código).
   - **"+ dono"**: faça até onde der sem o aparelho, deixe `[~]` e diga na passagem o que o dono deve testar.

## Ao trabalhar
- **Uma tarefa por vez, um commit por tarefa.** Marque `[~]` e seu nome/modelo na coluna "Quem" (ex.: `Codex (gpt-5)`);
  ao terminar, `[x]` e a coluna "Real", `python .ia/checar.py` e o commit. O hook roda a mesma checagem: não use `--no-verify`.
- `TASKS.md`: mesmo formato e colunas (o `checar.py` reprova linha com colunas a mais/menos), valores da legenda, horas
  `0,5 h`, cada ID uma vez, linha curta (detalhes em `docs/`).
- Convenções do `CLAUDE.md`; nenhuma dependência nova sem registrar lá. Com `unittest discover -s tests -t .`, `tests/`
  precisa de `__init__.py`. Testes: com `unittest` no comando de teste (`.ia/config.json`), classes `unittest.TestCase`;
  com `pytest`, o estilo do projeto (funções `test_*` valem).
- **Não edite `.ia/`, `AGENTS.md` nem `.claude/`/`.opencode/`** sem o dono pedir (são do kit); achou um problema neles,
  registre em `DUVIDAS.md`.
- Arquivos em UTF-8: nunca grave com `>`, `>>`, `Out-File` ou `echo >` do PowerShell (gravam UTF-16). Script auxiliar em
  `tools/`; configuração local (`.env`, caches, logs) no `.gitignore`.
- "Estado atual" do `CLAUDE.md` com no máximo ~10 linhas; histórico em `docs/`.
- Travou: entrada em `DUVIDAS.md` ("Abertas"), marque `[!]` e siga para a próxima que não dependa dela.
- Turno anterior de outra IA: revise o diff dela como de um colega; bug ou desvio, corrija num commit separado e diga na passagem.
- Sua ferramenta abriu branch ou worktree próprio (ex.: OpenCode, Cursor)? Ao terminar, integre no branch principal do projeto
  (`git merge --ff-only <seu-branch>` lá; se falhar porque o principal andou, não force) ou escreva o nome do branch em `--cuidado`: quem chega pela pasta principal só vê
  passagem, dúvidas e tarefas que estão no branch dele.

## Ao sair (obrigatório)
1. Escreva a passagem com o comando (insere no topo, em UTF-8, e faz o commit):

       python .ia/passagem.py --escrever --commitar --ferramenta "<ferramenta e modelo>" --feito "<IDs>" --parou "<ponto exato, ou nada em andamento>" --cuidado "<decisões, arquivos fora do pedido, testes que falham>" --proximo "<próxima tarefa>"

   Tentou algo que não funcionou? Acrescente `--tentado "<o quê e por que falhou>"`: a próxima IA não repete o caminho.
   O branch atual entra sozinho na passagem.
   Fez mais de uma tarefa, ou mexeu em regra, configuração ou arquivo do kit? Acrescente `--revisar`: a passagem registra o
   intervalo do turno e o Claude revisa no `/inicio` seguinte, mesmo que ninguém lembre de pedir.
   (O `REVISAR (Claude)` da tarefa fechada só com testes da IA local é outro gatilho, do `/passar`; se a passagem tiver os
   dois, o Claude faz uma revisão só, do intervalo.)

2. `python .ia/passagem.py --conferir` até dar "Passagem OK" (tudo commitado, passagem por último, nada `[~]` sem
   "+ dono", testes ok). Nunca saia com ele reprovando.
3. Nada de dado sensível na passagem (senha, token, chave, dado pessoal, caminho privado): ela vai para o git e para o
   pacote de contexto (`passagem.py --pacote`) que o dono cola em chats.

## Se o modelo ou o provedor falhar
Limite (429, 413), timeout ou ferramenta fora do ar: não insista em loop. Desfaça ou commite como "WIP", marque `[!]` (com
`DUVIDAS.md`) ou volte para `[ ]` (nunca `[~]`), escreva a passagem dizendo onde parou e pare.

## Se você é a IA local (`ia-rodar.ps1`)
Faça só a tarefa do cartão. Se existir `tests/test_aceite_<ID>.py`, faça-o passar sem alterá-lo nem apagá-lo. O
`.ia/fechar.py` commita, marca o `TASKS.md` e escreve a passagem se você esquecer.

Privacidade: serviços online podem guardar o código para treino; em projeto sensível, confira a política do provedor.
