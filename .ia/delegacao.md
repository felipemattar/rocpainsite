# Quem faz cada tarefa (o Claude decide no `/planejar`; atualizado pelo kit)

Dois executores, por enquanto: **Claude** (modelos: seção 0) e
**IA local** (opcional: OpenCode + Qwen3-Coder via llama-server). Outra IA de nuvem não entra na coluna "Quem"; o `/planejar` só a sugere no cartão com `(poderia ser: Outra IA)` (tarefa média, bem especificada e com aceite; a melhor candidata é a que exige ler muitos arquivos, como levantamento, inventário ou auditoria, onde o Claude mais gasta tokens), e o dono decide se passa o turno. O servidor da local NÃO é verificado ao planejar; quem confere é o `ia-rodar.ps1`, na hora de executar a tarefa.

## 0. Modelos do Claude (regra única do kit; os outros arquivos apontam para cá)
- **Sonnet 5.5** (`/etapa-sonnet`): o padrão; na dúvida, ele.
- **Haiku 5.5** (`/etapa-haiku`): só tarefa simples e mecânica COM teste (tradução, boilerplate, renomeação, porte simples).
  Medido em 2026-10-21: sozinho no `/etapa-haiku`, 3 tarefas mecânicas (tradução, bug simples, gerador) com 18/18
  testes escondidos, um commit por tarefa e passagem OK. Tarefa que pede julgamento continua no Sonnet.
- **Opus 5.5** (`/etapa-opus`): arquitetura, algoritmo ou protocolo difícil, depuração difícil e a revisão final do bloco;
  esforço `low` por padrão; `medium` em arquitetura, algoritmo ou protocolo difícil e em depuração sem causa clara;
  `high` só com aviso e confirmação do dono (ver "Esforço no cartão" abaixo).
- **Esforço fixo no cabeçalho** (`effort:`, para não herdar o da sessão): `low` no `/inicio`, `/passar`, `/revisar`,
  `/etapa-haiku`, `conferente` e `executor-haiku`; `medium` no `/etapa-sonnet`, `/etapa-coordenar`, `/planejar`, `revisor`
  e `executor-sonnet`. Sem `effort:`: o `/etapa` (só escolhe o comando) e o `/etapa-opus` (esforço pelo cartão).
- **Buscas amplas no Haiku:** varrer muitos arquivos para localizar algo (no `/planejar` ou numa investigação) vai para o
  subagente Explore (Haiku, só lê); o Opus ou o Sonnet usam só a conclusão dele.
- **Investigar e executar separados:** tarefa que pede descobrir a causa E mexer com cuidado (vários arquivos, invariantes)
  vira duas: `X.Ya` no Opus investiga e escreve no `TASKS.md`/`docs/` o cartão preciso da correção; `X.Yb` no Sonnet
  implementa a partir dele. O Opus não implementa e o Sonnet não adivinha a causa.
- **Roteiro de bug difícil (Opus):** (1) reproduzir com um comando ou teste que falha; (2) listar 2–3 hipóteses; (3) medir
  antes de mexer (log, print, bisect, teste mínimo) até sobrar uma; (4) escrever no cartão a causa provada, o teste que a
  mostra e onde corrigir. Sem reproduzir, não conserte: registre em `DUVIDAS.md` o que foi tentado.
- **Modo coordenador** (`/etapa <IDs> --coordenar`, chefe Opus + subagentes executores): só para ganhar tempo em lote
  com 3+ tarefas independentes (sem dependência e sem arquivo em comum). Não economiza: na bateria de 2026-10-21 deu a mesma
  qualidade, ~3× mais rápido e 2–3× mais tokens que o `/etapa` comum. Sugira-o no plano só nesse caso.
- **Esforço no cartão:** tarefa de Opus que precisa de mais que `low` leva no cartão `Esforço: medium` (ou `high`) e o
  motivo em uma frase. Haiku e Sonnet não levam marca. **`high` nunca vale sozinho:** o `/planejar` explica ao dono por
  que a tarefa parece exigir e escreve `Esforço: high (confirmado pelo dono)` só depois do "ok"; sem a marca, o
  `/etapa-opus` para e pergunta, e com ela ainda pede um "sim" do dono no chat antes de começar (a marca é escrita por
  uma IA). Antes, tente dividir a tarefa. O `effort:` do cabeçalho vale para o comando inteiro: se o esforço do cartão
  for diferente do atual (`/effort`), o `/etapa-opus` avisa o dono para ajustá-lo antes de seguir.
- **Teto:** nunca modelo acima do Opus 5.5. Só três níveis de esforço: `low`, `medium` e `high` (este só como descrito
  acima); `xhigh` e `max`, nunca.
- Conta sem esses modelos: use o melhor disponível e ajuste só esta seção (e o `model:` dos `/etapa-*`).

## 1. Primeiro filtro: o que fica sempre com o Claude
Decisão de arquitetura, mudança em vários módulos, depuração sem causa clara, protocolo desconhecido e a revisão final do bloco
(Opus; seção 0).

## 2. Claude ou local?
O Claude é o padrão (modelo pela seção 0). A IA local acertou 4/5 na bateria, levou 3 a
12 min por tarefa e quase nunca fecha o processo (precisa do `ia-rodar.ps1` + `fechar.py`). Use a **local** só quando houver
um motivo E o tipo de tarefa couber nela:

**Motivos (pelo menos um):**
- Código sensível ou privado, que não deve sair da máquina.
- Cota do Claude acabando, ou máquina sem internet.
- Lote grande e mecânico (tradução, muitos arquivos parecidos), para poupar a cota do Claude.

**Tipos que a local resolve (medido na bateria de IA local, 8 GB de VRAM):**

| Tipo de tarefa | Local? | Evidência |
|---|---|---|
| Parser binário com formato fechado | Sim (I-Compact) | 3/3 no agente, 3/3 na geração direta |
| Gerar arquivo/áudio simples | Sim (I-Compact) | 3/3, 3 a 10 min |
| Catálogo, E/S, SQLite simples | Sim (I-Compact) | 4/4 no agente |
| Bug com sintoma claro e reproduzível | Sim (I-Compact) | 4/4, 3 a 4 min |
| Tradução ou tarefa grande e mecânica | Sim (I-Compact; Next se for muito grande) | 12/12 na geração direta |
| Parser de chunks/containers | Sim, com aceite visível | 3/3 no agente; 7/12 na geração direta |
| Algoritmo médio com convenção sutil (sinal, sentido) | Só Next e com cartão sem ambiguidade | I-Compact 1/12; Next 3/3 |
| Calendário/timecode, muitos casos de borda | **Não** (Claude) | 0 acertos em todos os modelos locais |

Sem motivo, ou com tipo fora da tabela: **Claude**. Planeje a local só se o projeto não a desligou (`"usar": "nunca"`). Se na
execução o servidor estiver fora do ar, o `ia-rodar.ps1` avisa e pergunta; sem servidor, a tarefa volta para o Claude (troque a coluna "Quem" e rode `/etapa <ID>`).

## 3. Regras de custo e segurança da delegação local
- Só vale delegar se o código esperado for ≥ 3× o tamanho de cartão + teste, ou se o teste de aceite já existir.
- Toda tarefa testável leva `tests/test_aceite_<ID>.py` (`python .ia/aceite.py esqueleto <ID>`); o cartão local sempre. O da
  tarefa local é validado depois da entrega com `python .ia/aceite.py validar <ID> --mutante "nome|trecho|troca"` (2 a 4 mutantes).
- Roda uma tarefa por vez: `ia-rodar.ps1 -Caminho <projeto> -Tarefa <ID>` (o `fechar.py` commita, marca e escreve a passagem).
- Tarefa fechada só com testes da IA local recebe `REVISAR (Claude)` na passagem: o `/inicio` revisa.
- Perfil padrão I-Compact (rápido, 32k); Next (48k, ~1,6× mais lento) para tarefa grande ou de algoritmo.
- Confirme com 3 a 5 tarefas do SEU projeto antes de generalizar (a bateria usou uma biblioteca Python pequena).
