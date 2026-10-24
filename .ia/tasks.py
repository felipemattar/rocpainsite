"""Padroniza o TASKS.md no formato do kit (simula por padrão).

Uso:
  python .ia/tasks.py padronizar                      # simulação: mostra o que mudaria, não grava nada
  python .ia/tasks.py padronizar --aplicar            # grava o TASKS.md e o docs/TASKS-arquivo.md
  python .ia/tasks.py padronizar --quem "2.2=Claude (Sonnet 5.5)" [--quem ...]   # decide as ambíguas
  python .ia/tasks.py arquivar [--aplicar]            # só move os blocos (##) 100% [x] para docs/TASKS-arquivo.md; simula por padrão
  python .ia/tasks.py comando [IDs ou bloco...]       # qual comando executa cada tarefa, pela coluna "Quem" (o /etapa usa)
  [--caminho <projeto>]                               # outro projeto (padrão: o deste .ia/)

O que faz:
- Só nas linhas ABERTAS ([ ], [~], [?], [!]): coluna "Quem" com os valores do padrão (Claude (Haiku 5.5),
  Claude (Sonnet 5.5), Claude (Opus 5.5), Local ou —, com " + dono" opcional), Estimativa/Real em "<n> h" com vírgula.
  As [x] ficam como estão (histórico). Valor que não dá para decidir sozinho vai para "ambíguas" e não muda.
- Legenda: troca as linhas-padrão do kit (Status, Coluna "Quem", Modelo do Claude, Como continuar...) pela atual;
  linhas próprias do projeto ficam.
- Blocos (## ...) com todas as tarefas [x] e seções da v1 do kit vão para docs/TASKS-arquivo.md (nada é apagado).
  `arquivar` faz só isso, sem mexer em colunas nem legenda. Tarefa arquivada continua valendo como feita: um
  "depende de X.Y" que aponta para ela é considerado cumprido (ID que não está no TASKS.md é ignorado).
"""
import argparse
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

sys.dont_write_bytecode = True  # importa outro script de .ia/: sem __pycache__ no projeto

RAIZ = Path(__file__).resolve().parent.parent
ABERTOS = ("[ ]", "[~]", "[?]", "[!]")
STATUS_OK = ABERTOS + ("[x]",)
# outra IA (só quando o dono a escolhe): genérico "Outra IA" ou o nome dela, com ou sem o modelo
QUEM_OK = re.compile(r"^(Claude \((Haiku|Sonnet|Opus) [\d.]+\)|Local|—|Outra IA|(OpenCode|Codex|Gemini|Cursor)( \([^)]+\))?)( \+ dono)?$")
VERSAO = "5.5"  # versão usada ao completar "Claude" sem modelo; valores com outra versão são aceitos como estão
HORAS_OK = re.compile(r"^(\d+(,\d+)? h|—)$")
LEGENDA = """Status: [x] feito · [~] em andamento · [ ] pendente · [?] aguardando decisão · [!] travou (ver `DUVIDAS.md`). Horas: `0,5 h`.
**Quem** (aberta): `Claude (Haiku 5.5)`, `Claude (Sonnet 5.5)`, `Claude (Opus 5.5)`, `Local` (IA local), `—` (= Claude Sonnet),
`Outra IA` ou o nome dela (`OpenCode`, `Codex`...); ` + dono` = precisa do teste do dono. Feita: quem fez (`Local (<modelo>)`...).
Processo: `AGENTS.md`; no Claude Code, `/inicio` e o `/etapa` (ele lê a coluna "Quem"). Ao sair, passagem em `PASSAGEM.md`."""
# Linhas de legendas antigas do kit (trocadas pela LEGENDA); o resto do cabeçalho é do projeto e fica
LEGENDA_ANTIGA = re.compile(
    r"^(Status: \[x\] feito|Como continuar:|Ao sair, cada IA|Modelo do Claude:|Para executar, o Claude chama|"
    r"\*\*Coluna \"Quem\":?\*\*|\"Local\" \(IA local|`Local` \(IA local|aparelho/ambiente do dono|Para passar uma tarefa à outra IA|ou o nome dela se quiser uma específica|Tarefa feita: quem fez|"
    r"\*\*Quem\*\* \(aberta\)|`Outra IA` ou o nome dela|Processo: `AGENTS.md`|"
    r"Estimativas em horas de trabalho efetivo)")
# Seções da v1 do kit (delegação via Aider/Continue): vão para o arquivo
V1 = re.compile(r"^(#+)\s*(Fluxo com a IA local|Qual modelo usar|Ciclo de uma tarefa|Regras para o prompt|Cartões)\b")
TABELA_SEP = re.compile(r"^\s*\|[\s:\-|]+\|\s*$")
ARQUIVO = Path("docs") / "TASKS-arquivo.md"
PONTEIRO = "Blocos concluídos e seções antigas: ver `docs/TASKS-arquivo.md`."


def utf8() -> None:
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def celulas(linha: str) -> list[str]:
    """Separa só nos | sem barra antes (como o GitHub e o checar.py)."""
    return [c.strip() for c in re.split(r"(?<!\\)\|", linha.strip().strip("|"))]


def montar(c: list[str]) -> str:
    return "| " + " | ".join(c) + " |"


def horas(valor: str) -> str | None:
    """'~30 min' -> '0,5 h'; '~0.5 h' -> '0,5 h'; 'Medium, ~2 h' -> '2 h'; 'not needed' -> '—'. None = não reconheceu."""
    v = re.sub(r"\*\*", "", valor).strip()
    if not v or HORAS_OK.match(v):
        return v
    if v.lower() in ("not needed", "n/a", "-", "não se aplica"):
        return "—"
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(h|min)\b", v)
    if not m:
        return None
    n = float(m.group(1).replace(",", "."))
    if m.group(2) == "min":
        n = n / 60
    n = round(n, 1)
    texto = f"{n:g}".replace(".", ",")
    return f"{texto} h"


def quem(valor: str, estimativa: str, secao: str = "") -> tuple[str | None, str]:
    """Valor padrão para uma linha aberta. Devolve (novo ou None se ambíguo, motivo/sugestão)."""
    bruto = valor.strip()
    if QUEM_OK.match(bruto):
        return bruto, ""
    q = re.sub(r"\*\*", "", bruto).strip()
    dono = bool(re.search(r"\+\s*(dono|você|voce)\b", q, re.I))
    nucleo = re.sub(r"\s*\+\s*(dono|você|voce)\b", "", q, flags=re.I).strip()
    sufixo = " + dono" if dono else ""
    if nucleo.lower() == "dono":
        return None, "tarefa só do dono (sem IA): sugestão `— + dono`, ou deixe-a fora da tabela"
    if "→" in nucleo or ("local" in nucleo.lower() and "claude" in nucleo.lower()):
        return None, "mistura Local e Claude: escolha um (sugestão: `Claude (Sonnet 5.5)`" + sufixo + ")"
    if re.match(r"^(outra ia|nuvem)$", nucleo, re.I):  # "Nuvem" era o nome antigo do executor de nuvem
        return "Outra IA" + sufixo, ""
    m = re.match(r"^(opencode|codex|gemini|cursor)\b(.*)$", nucleo, re.I)
    if m:
        nome = {"opencode": "OpenCode", "codex": "Codex", "gemini": "Gemini", "cursor": "Cursor"}[m.group(1).lower()]
        resto = m.group(2).strip()
        return (nome + (f" {resto}" if re.match(r"^\([^)]+\)$", resto) else "") + sufixo,
                "" if not resto or re.match(r"^\([^)]+\)$", resto) else f"tirado {resto!r}")
    if "**local**" in bruto.lower():
        return None, "\"Local\" em negrito vem da v1 do kit (Aider): sugestão `—`" + sufixo + " (ou `Local`, se for para a IA local de hoje)"
    if nucleo in ("", "—", "-") or nucleo.lower() == "qualquer ia":
        return "—" + sufixo, ""
    if re.match(r"^local\b", nucleo, re.I):
        return "Local" + sufixo, ""
    if re.match(r"^claude\b", nucleo, re.I):
        versao = re.search(r"\d+(\.\d+)?", nucleo)
        v = versao.group(0) if versao else VERSAO
        for modelo in ("Haiku", "Opus", "Sonnet"):
            if modelo.lower() in nucleo.lower():
                return f"Claude ({modelo} {v}){sufixo}", ""
        if re.match(r"^\s*(\*\*)?hard\b", estimativa, re.I):
            return f"Claude (Opus {v}){sufixo}", "sugestão pela estimativa \"Hard\""
        if re.search(r"difícil|dificil|\bhard\b|🔴", secao, re.I):
            return f"Claude (Opus {v}){sufixo}", f"sugestão pela seção {secao.strip()[:40]!r}"
        return f"Claude (Sonnet {v}){sufixo}", ""
    return None, "valor desconhecido"


def secoes(linhas: list[str]) -> list[tuple[int, int]]:
    """Intervalos [ini, fim) de cada seção com título # ou ## (o ### fica dentro da seção de cima)."""
    inicios = [i for i, l in enumerate(linhas) if re.match(r"^#{1,2} ", l)]
    return [(a, b) for a, b in zip(inicios, inicios[1:] + [len(linhas)])]


def tarefas_da_secao(linhas: list[str], ini: int, fim: int) -> list[str]:
    status = []
    i = ini
    while i < fim:
        if linhas[i].lstrip().startswith("|") and i + 1 < fim and TABELA_SEP.match(linhas[i + 1]):
            cab = [c.lower() for c in celulas(linhas[i])]
            col = next((k for k, c in enumerate(cab) if c.startswith("status")), None)
            i += 2
            while i < fim and linhas[i].lstrip().startswith("|"):
                c = celulas(linhas[i])
                if col is not None and c and c[0] and col < len(c):
                    status.append(c[col])
                i += 1
        else:
            i += 1
    return status


def tem_aberta(trecho: list[str]) -> bool:
    """Alguma tarefa aberta ([ ], [~], [?], [!]) na tabela ou em item de lista "- [ ]" do trecho?"""
    return (any(s in ABERTOS for s in tarefas_da_secao(trecho, 0, len(trecho)))
            or any(re.match(r"^\s*[-*] \[[ ~?!]\]", l) for l in trecho))


def padronizar(raiz: Path, decisoes: dict[str, str], aplicar: bool, so_arquivar: bool = False) -> int:
    arq = raiz / "TASKS.md"
    if not arq.exists():
        print(f"Sem TASKS.md em {raiz}.")
        return 2
    texto = arq.read_bytes().decode("utf-8-sig")
    quebra = "\r\n" if "\r\n" in texto else "\n"
    linhas = texto.replace("\r\n", "\n").split("\n")
    if not tarefas_da_secao(linhas, 0, len(linhas)):
        # TASKS.md que só aponta para a lista própria do projeto (ex.: BancodeSom): o formato é dela
        print(f"{arq}: sem tabela de tarefas (lista própria do projeto); nada a padronizar.")
        return 0
    mudancas, ambiguas, revisar = [], [], []
    original = list(linhas)

    # 1. Linhas abertas das tabelas
    i = 0
    secao = ""
    while i < len(linhas):
        if re.match(r"^#{1,3} ", linhas[i]):
            secao = linhas[i]
        if linhas[i].lstrip().startswith("|") and i + 1 < len(linhas) and TABELA_SEP.match(linhas[i + 1]):
            cab = [c.lower() for c in celulas(linhas[i])]
            idx = {nome: next((k for k, c in enumerate(cab) if c.startswith(nome)), None)
                   for nome in ("quem", "estimativa", "real", "status")}
            i += 2
            while i < len(linhas) and linhas[i].lstrip().startswith("|"):
                c = celulas(linhas[i])
                ident = c[0] if c else ""
                st = c[idx["status"]] if idx["status"] is not None and idx["status"] < len(c) else ""
                if ident and st and st not in STATUS_OK:
                    ambiguas.append(f"{ident}: status {st!r} fora do padrão ({', '.join(STATUS_OK)})")
                if ident and st in ABERTOS and idx["quem"] is not None and idx["quem"] < len(c):
                    novo = list(c)
                    est = c[idx["estimativa"]] if idx["estimativa"] is not None and idx["estimativa"] < len(c) else ""
                    if ident in decisoes:
                        novo[idx["quem"]] = decisoes[ident]
                        if not QUEM_OK.match(decisoes[ident]):
                            ambiguas.append(f"{ident}: decisão {decisoes[ident]!r} não é um valor do padrão")
                    else:
                        q, motivo = quem(c[idx["quem"]], est, secao)
                        if q is None:
                            ambiguas.append(f"{ident}: Quem {c[idx['quem']]!r} — {motivo}")
                        else:
                            novo[idx["quem"]] = q
                            if motivo:
                                revisar.append(f"{ident}: {q} ({motivo})")
                    for nome in ("estimativa", "real"):
                        k = idx[nome]
                        if k is not None and k < len(c):
                            h = horas(c[k])
                            if h is None:
                                ambiguas.append(f"{ident}: {nome} {c[k]!r} não reconhecida (use \"<n> h\")")
                            else:
                                novo[k] = h
                    if novo != c:
                        mudancas.append(f"{ident}: " + "; ".join(f"{a!r} → {b!r}" for a, b in zip(c, novo) if a != b))
                        linhas[i] = montar(novo)
                i += 1
        else:
            i += 1

    # 2. Título e legenda (cabeçalho = antes do primeiro ##)
    primeiro = next((k for k, l in enumerate(linhas) if l.startswith("## ")), len(linhas))
    if linhas and linhas[0].startswith("# ") and not linhas[0].startswith("# Tarefas"):
        mudancas.append(f"título: {linhas[0]!r} → '# Tarefas — {raiz.name}'")
        linhas[0] = f"# Tarefas — {raiz.name}"
    cabecalho = linhas[1:primeiro]
    if "\n".join(cabecalho).find(LEGENDA) < 0:
        velhas = [k for k, l in enumerate(cabecalho) if LEGENDA_ANTIGA.match(l)]
        pos = velhas[0] if velhas else 0
        novo_cab = [l for k, l in enumerate(cabecalho) if k not in velhas]
        novo_cab[pos:pos] = (["", LEGENDA, ""] if not velhas else [LEGENDA])
        novo_cab = re.sub(r"\n{3,}", "\n\n", "\n".join(novo_cab)).strip("\n").split("\n")
        novo_cab = [""] + novo_cab + [""]  # uma linha em branco depois do título e antes do primeiro ##
        linhas[1:primeiro] = novo_cab
        mudancas.append(f"legenda: {len(velhas)} linha(s) antigas do kit trocadas pela atual")
        primeiro = next((k for k, l in enumerate(linhas) if l.startswith("## ")), len(linhas))
    for l in linhas[1:primeiro]:
        if l.strip() and l not in LEGENDA and re.search(r"/etapa\b|\bNuvem\b|\bv1\b|Aider|OpenCode", l):
            revisar.append(f"cabeçalho, revise à mão: {l.strip()[:110]}")

    if so_arquivar:  # `arquivar`: descarta o que os passos 1 e 2 mudaram; fica só o passo 3
        linhas, mudancas, ambiguas, revisar = list(original), [], [], []

    # 3. Blocos concluídos e seções da v1 -> arquivo
    arquivar = []
    for ini, fim in secoes(linhas):
        titulo = linhas[ini]
        st = tarefas_da_secao(linhas, ini, fim)
        # seção sem tabela, só com lista "- [x] ..." (ex.: "## Feito") também é bloco concluído
        itens = [l for l in linhas[ini + 1:fim] if re.match(r"^\s*[-*] \[.\]", l)]
        so_feitos = not st and itens and all(re.match(r"^\s*[-*] \[x\]", l, re.I) for l in itens)
        if V1.match(titulo) or (titulo.startswith("## ") and ((st and all(s == "[x]" for s in st)) or so_feitos)):
            arquivar.append((ini, fim))
    # seção de nível # da v1 leva junto as ## de dentro; evita intervalos repetidos
    final = []
    for ini, fim in arquivar:
        if final and ini < final[-1][1]:
            continue
        if linhas[ini].startswith("# "):
            # vai até o próximo "# " ou até o primeiro "## " que não é da v1 (bloco de tarefas reais: avaliado sozinho)
            fim = next((k for k in range(ini + 1, len(linhas))
                        if linhas[k].startswith("# ") or (linhas[k].startswith("## ") and not V1.match(linhas[k]))), len(linhas))
        if tem_aberta(linhas[ini:fim]):  # nunca esconde tarefa aberta, nem em seção da v1 nem em item "- [ ]" fora da tabela
            revisar.append(f"não arquivada: {linhas[ini].strip()[:70]} (tem tarefa aberta)")
            continue
        final.append((ini, fim))
    movidas = []
    for ini, fim in reversed(final):
        bloco = linhas[ini:fim]
        if ini > 0 and linhas[ini - 1].strip() == "---":  # separador antes da seção vai junto
            ini -= 1
        movidas.insert(0, bloco)
        del linhas[ini:fim]
    for bloco in movidas:
        n = len(tarefas_da_secao(bloco, 0, len(bloco))) or len([l for l in bloco if re.match(r"^\s*[-*] \[x\]", l, re.I)])
        mudancas.append(f"arquivar: {bloco[0].strip()[:80]} ({n} item(ns) feitos)")
    if movidas and PONTEIRO not in linhas:
        while linhas and (not linhas[-1].strip() or linhas[-1].strip() == "---"):  # separador que sobrou no fim
            linhas.pop()
        linhas += ["", PONTEIRO, ""]

    # Relatório
    print(("APLICANDO" if aplicar else "SIMULAÇÃO (nada foi gravado)") + f" — {arq}")
    print(f"\nMudanças ({len(mudancas)}):" if mudancas else "\nMudanças: nenhuma")
    for m in mudancas:
        print("  " + m)
    if revisar:
        print(f"\nConferir ({len(revisar)}):")
        for m in revisar:
            print("  " + m)
    if ambiguas:
        print(f"\nAmbíguas — decidir ({len(ambiguas)}), não mudam sem --quem \"ID=valor\":")
        for m in ambiguas:
            print("  " + m)
    if not aplicar or not mudancas:
        return 0

    sujo = subprocess.run(["git", "status", "--porcelain", "--", "TASKS.md", str(ARQUIVO)], cwd=raiz,
                          capture_output=True, text=True).stdout.strip()
    if sujo:
        print("\nRecusado: TASKS.md ou docs/TASKS-arquivo.md têm mudança não commitada; commite antes.")
        return 1
    arq.write_bytes("\n".join(linhas).replace("\n", quebra).encode("utf-8"))
    if movidas:
        destino = raiz / ARQUIVO
        destino.parent.mkdir(exist_ok=True)
        if destino.exists() and destino.stat().st_size:
            quebra_destino = chr(13) + "\n" if (chr(13) + "\n").encode() in destino.read_bytes() else "\n"
        else:
            quebra_destino = quebra
        antigo = destino.read_bytes().decode("utf-8-sig").replace(chr(13) + "\n", "\n") if destino.exists() else (
            f"# Arquivo de tarefas — {raiz.name}\n\nBlocos concluídos e seções antigas tirados do `TASKS.md`"
            " (nada foi apagado; IDs continuam valendo).\n")
        partes = [antigo.rstrip("\n"), "", f"## Arquivado em {date.today().isoformat()}", ""]
        for bloco in movidas:
            partes += [("#" + l if re.match(r"^#{1,5} ", l) else l) for l in bloco] + [""]
        destino.write_bytes("\n".join(partes).replace("\n", quebra_destino).encode("utf-8"))
    print(f"\nGravado. Revise com `git diff` e faça o commit.")
    return 0


def ler_tarefas(raiz: Path) -> list[tuple[str, str, str]]:
    """(ID, Quem, Status) de cada linha de tarefa do TASKS.md, na ordem do arquivo."""
    arq = raiz / "TASKS.md"
    linhas = arq.read_bytes().decode("utf-8-sig").splitlines() if arq.exists() else []
    tarefas, i = [], 0
    while i < len(linhas):
        if linhas[i].lstrip().startswith("|") and i + 1 < len(linhas) and TABELA_SEP.match(linhas[i + 1]):
            cab = [c.lower() for c in celulas(linhas[i])]
            iq = next((k for k, c in enumerate(cab) if c.startswith("quem")), None)
            ist = next((k for k, c in enumerate(cab) if c.startswith("status")), None)
            i += 2
            while i < len(linhas) and linhas[i].lstrip().startswith("|"):
                c = celulas(linhas[i])
                if iq is not None and ist is not None and c and c[0] and max(iq, ist) < len(c):
                    tarefas.append((c[0], c[iq], c[ist]))
                i += 1
        else:
            i += 1
    return tarefas


DEPENDE = re.compile(r"depende de\s+(\d+(?:\.\d+)+(?:\s*(?:,|\be\b)\s*\d+(?:\.\d+)+)*)", re.I)


def dependencias(raiz: Path) -> dict[str, list[str]]:
    """{ID: IDs que o cartão diz "depende de X.Y" (ou "X.Y e X.Z", "X.Y, X.Z")}; escrito pelo /planejar."""
    arq = raiz / "TASKS.md"
    deps = {}
    for linha in (arq.read_bytes().decode("utf-8-sig").splitlines() if arq.exists() else []):
        c = celulas(linha) if linha.lstrip().startswith("|") else []
        if len(c) > 1 and c[0]:
            ids = [x for m in DEPENDE.finditer(c[1]) for x in re.findall(r"\d+(?:\.\d+)+", m.group(1))]
            if ids:
                deps[c[0]] = ids
    return deps


def despachar(raiz: Path, ids: list[str], limite: int = 5, como_json: bool = False) -> int:
    """Uma linha por grupo: o comando que executa as tarefas, pela coluna "Quem" (usado pelo /etapa).

    Sem IDs: as [~] interrompidas e depois as pendentes [ ] cujas dependências ("depende de X.Y" no cartão; ID que não
    existe é ignorado) estão [x], até `limite`, sem "+ dono" (a [~] "+ dono" espera o teste do dono). Com bloco ("2"):
    as abertas 2.x, na ordem do arquivo. Tarefas seguidas do mesmo comando /etapa-* vão juntas; ia-rodar.ps1 é
    uma tarefa por vez. A regra é a mesma do --resumo (passagem.comando).
    """
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import passagem  # noqa: E402 (mesma pasta .ia/)
    tarefas = ler_tarefas(raiz)
    if not tarefas and (raiz / "TASKS.md").exists():
        print("[]" if como_json else "TASKS.md sem tabela de tarefas: siga a lista própria do TASKS.md")
        return 0
    if ids:
        existentes = {t[0] for t in tarefas}
        pedidas, faltam, blocos_feitos = set(), [], []
        for x in ids:
            # bloco ("2"): as tarefas abertas "2.x" dele, menos a [~] "+ dono" (espera o teste do dono)
            bloco = {t[0] for t in tarefas if t[0].startswith(x + ".") and t[2] != "[x]"
                     and not (t[2] == "[~]" and "+ dono" in t[1])}
            if x in existentes:
                pedidas.add(x)
            elif bloco:
                pedidas |= bloco
            elif any(t[0].startswith(x + ".") for t in tarefas):
                blocos_feitos.append(x)
            else:
                faltam.append(x)
        escolhidas = [t for t in tarefas if t[0] in pedidas]
    else:
        faltam, blocos_feitos = [], []
        status = {t[0]: t[2] for t in tarefas}
        deps = dependencias(raiz)

        def liberada(ident: str) -> bool:
            return all(status[d] == "[x]" for d in deps.get(ident, []) if d in status)

        livres = [t for t in tarefas if "+ dono" not in t[1]]
        escolhidas = ([t for t in livres if t[2] == "[~]"]
                      + [t for t in livres if t[2] == "[ ]" and liberada(t[0])])[:limite]
    kit = (raiz / ".ia" / "kit.txt").read_text(encoding="utf-8").strip() if (raiz / ".ia" / "kit.txt").exists() else ""
    rodar = str(Path(kit) / "ia-rodar.ps1") if kit else "<pasta do kit>\\ia-rodar.ps1"
    saida = []
    for ident, quem_, st in escolhidas:
        if st == "[x]":
            saida.append(("já feita", ident))
            continue
        if st == "[?]":
            saida.append(("aguardando decisão do dono", ident))
            continue
        cmd = passagem.comando(quem_)
        if cmd.startswith("ia-rodar"):
            saida.append((f'powershell -ExecutionPolicy Bypass -File "{rodar}" -Caminho "{raiz}" -Tarefa {ident}', ""))
        elif saida and saida[-1][0] == cmd and cmd.startswith("/etapa-"):
            saida[-1] = (cmd, saida[-1][1] + " " + ident)
        else:
            saida.append((cmd, ident))
    for x in blocos_feitos:
        saida.append(("bloco sem tarefa aberta (feito ou esperando o dono)", x))
    for x in faltam:
        saida.append(("não encontrada no TASKS.md", x))
    if como_json:
        print(json.dumps([item_json(cmd, alvo) for cmd, alvo in saida], ensure_ascii=False))
        return 0
    if not saida:
        print("nada a fazer (nenhuma tarefa [~] ou [ ] sem \"+ dono\")")
    for cmd, alvo in saida:
        print(texto_do_grupo(cmd, alvo))
    return 0


def texto_do_grupo(cmd: str, alvo: str) -> str:
    return f"{cmd} {alvo}".rstrip() if cmd.startswith(("/", "powershell")) else f"{cmd}: {alvo}"


def item_json(cmd: str, alvo: str) -> dict:
    """Um grupo do despachar para a interface gráfica: comando ("/etapa-x", "ia-rodar" ou o aviso), IDs e a linha de texto."""
    if cmd.startswith("powershell"):
        ids = re.findall(r"-Tarefa (\S+)", cmd)
        return {"comando": "ia-rodar", "ids": ids, "texto": texto_do_grupo(cmd, alvo)}
    return {"comando": cmd, "ids": alvo.split(), "texto": texto_do_grupo(cmd, alvo)}


def listar(raiz: Path) -> list[dict]:
    """Cada linha de tarefa do TASKS.md, com a seção (título ## acima da tabela); coluna ausente = ""."""
    arq = raiz / "TASKS.md"
    linhas = arq.read_bytes().decode("utf-8-sig").splitlines() if arq.exists() else []
    nomes = {"#": "id", "tarefa": "tarefa", "quem": "quem", "estimativa": "estimativa", "real": "real", "status": "status"}
    itens, secao, i = [], "", 0
    while i < len(linhas):
        if linhas[i].startswith("## "):
            secao = linhas[i][3:].strip()
        if linhas[i].lstrip().startswith("|") and i + 1 < len(linhas) and TABELA_SEP.match(linhas[i + 1]):
            cab = [next((v for k, v in nomes.items() if c.lower().startswith(k)), "") for c in celulas(linhas[i])]
            i += 2
            while i < len(linhas) and linhas[i].lstrip().startswith("|"):
                c = celulas(linhas[i])
                item = {v: "" for v in nomes.values()}
                for k, valor in zip(cab, c):
                    if k:
                        item[k] = valor
                if item["id"]:
                    itens.append({**item, "secao": secao})
                i += 1
        else:
            i += 1
    return itens


def main() -> int:
    utf8()
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    pad = sub.add_parser("padronizar")
    pad.add_argument("--aplicar", action="store_true")
    pad.add_argument("--quem", action="append", default=[], help='"ID=valor", ex. "2.2=Claude (Sonnet 5.5)"')
    pad.add_argument("--caminho", type=Path, default=RAIZ)
    arq = sub.add_parser("arquivar", help="move os blocos 100%% [x] para docs/TASKS-arquivo.md (simula por padrão)")
    arq.add_argument("--aplicar", action="store_true")
    arq.add_argument("--caminho", type=Path, default=RAIZ)
    com = sub.add_parser("comando", help="qual comando executa cada tarefa (usado pelo /etapa)")
    com.add_argument("ids", nargs="*")
    com.add_argument("--caminho", type=Path, default=RAIZ)
    com.add_argument("--json", action="store_true", help="uma lista JSON (para a interface gráfica do kit)")
    lis = sub.add_parser("listar", help="as tarefas do TASKS.md em JSON (para a interface gráfica do kit)")
    lis.add_argument("--json", action="store_true", help="aceito por simetria; a saída é sempre JSON")
    lis.add_argument("--caminho", type=Path, default=RAIZ)
    a = p.parse_args()
    if a.cmd == "listar":
        print(json.dumps(listar(a.caminho.resolve()), ensure_ascii=False))
        return 0
    if a.cmd == "comando":
        return despachar(a.caminho.resolve(), [x.strip(",") for x in a.ids if x.strip(",")], como_json=a.json)
    if a.cmd == "arquivar":
        return padronizar(a.caminho.resolve(), {}, a.aplicar, so_arquivar=True)
    decisoes = {}
    for d in a.quem:
        ident, _, valor = d.partition("=")
        decisoes[ident.strip()] = valor.strip()
    return padronizar(a.caminho.resolve(), decisoes, a.aplicar)


if __name__ == "__main__":
    sys.exit(main())
