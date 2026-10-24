"""Confere e escreve a troca de turno entre IAs (modo passagem).

Uso:
  python .ia/passagem.py --conferir   # ao SAIR: tudo commitado, passagem escrita, nada [~], testes ok
  python .ia/passagem.py --resumo     # ao CHEGAR: última passagem + o que mudou desde a anterior + testes
  python .ia/passagem.py --escrever --ferramenta "OpenCode (modelo)" --feito "1.1, 1.2" \
        --parou "nada em andamento" --cuidado "..." --proximo "1.3" [--commitar] [--revisar] [--tentado "..."]
      # insere a entrada pronta no TOPO do PASSAGEM.md, sempre em UTF-8, com data/hora de agora
      # (use isto em vez de editar o arquivo com >>, Out-File ou echo: eles gravam em UTF-16)
      # --revisar: turno com mudança significativa; grava "REVISAR: <passagem anterior>..<HEAD de agora>" e o /inicio
      #            seguinte roda o /revisar nesse intervalo (ou --revisar "<texto>" para outro alvo, ex. vários projetos)
  python .ia/passagem.py --pacote     # grava CONTEXT-PACK.md (não versionado) para colar num chat da web, outra conta
                                      # ou IA sem acesso ao repositório

Vale para qualquer IA (Claude, OpenCode...). A saída é curta de propósito (poucos tokens).
"""
import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PASSAGEM = "PASSAGEM.md"
MARCADOR = "<!-- entradas abaixo, a mais nova primeiro -->"
KIT_COMMIT = "Configura fluxo de trabalho com duas IAs"
# Arquivos do kit: uma IA só deve mexer neles se o dono pedir (AGENTS.md); o conferir e o resumo avisam
CONTROLE = (".ia/", "AGENTS.md", ".claude/", ".opencode/")
MANTER = 10  # entradas que ficam no PASSAGEM.md; as mais antigas vão para ARQUIVO_PASSAGEM
ARQUIVO_PASSAGEM = "docs/PASSAGEM-arquivo.md"
CABECALHO_ENTRADA = re.compile(r"(?m)^## (\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?")


def utf8_no_terminal() -> None:
    """O console do Windows usa cp1252: um '—' ou 'ã' na passagem derrubava o script ao imprimir."""
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def git(*args: str) -> str:
    r = subprocess.run(["git", *args], cwd=RAIZ, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return r.stdout.strip()


def ler_passagem() -> tuple[str, list[str]]:
    """Lê o PASSAGEM.md de forma tolerante. Devolve (texto, problemas de codificação).

    UTF-16 (BOM ou bytes NUL, típico de `>>`/Out-File no PowerShell) e bytes inválidos são decodificados
    mesmo assim, para o resumo não travar, e apontados como problema para o conferir/checar.
    """
    arq = RAIZ / PASSAGEM
    if not arq.exists():
        return "", []
    bruto = arq.read_bytes()
    problemas = []
    if bruto.startswith((b"\xff\xfe", b"\xfe\xff")) or b"\x00" in bruto:
        problemas.append(f"{PASSAGEM} está em UTF-16 (ou tem bytes NUL), não UTF-8: "
                         "rode `python .ia/passagem.py --escrever ...` (recodifica) e nunca use >> ou Out-File nele")
        texto = bruto.decode("utf-16", errors="replace") if bruto[:2] in (b"\xff\xfe", b"\xfe\xff") \
            else bruto.replace(b"\x00", b"").decode("utf-8", errors="replace")
        return texto.lstrip("﻿"), problemas
    try:
        texto = bruto.decode("utf-8")
    except UnicodeDecodeError:
        problemas.append(f"{PASSAGEM} não é UTF-8 válido (provável cp1252): recodifique para UTF-8")
        texto = bruto.decode("cp1252", errors="replace")
    return texto.lstrip("﻿"), problemas


def entradas(texto: str) -> list[str]:
    depois = texto.split(MARCADOR, 1)[-1]
    blocos = re.split(r"(?m)^(?=## )", depois)
    return [b.strip() for b in blocos if b.strip().startswith("## ")]


def problemas_de_ordem(texto: str) -> list[str]:
    """As entradas devem estar da mais nova (topo) para a mais antiga: datas em ordem decrescente."""
    datas = []
    for e in entradas(texto):
        m = CABECALHO_ENTRADA.match(e)
        if m:
            datas.append((f"{m.group(1)} {m.group(2) or '00:00'}", e.splitlines()[0][:60]))
    for (a, _), (b, titulo) in zip(datas, datas[1:]):
        if b > a:
            return [f"entradas fora de ordem em {PASSAGEM}: a mais nova deve ficar no TOPO (veja \"{titulo}\"); "
                    "use `python .ia/passagem.py --escrever` para inserir"]
    return []


def problemas_de_codificacao() -> list[str]:
    return ler_passagem()[1]


def commits_da_passagem() -> list[str]:
    """Hashes dos commits que mexeram no PASSAGEM.md, do mais novo para o mais antigo."""
    return git("log", "--format=%H", "--", PASSAGEM).splitlines()


def intervalo_do_turno() -> str:
    """Da passagem anterior até o HEAD de agora, com hashes fixos (um HEAD solto mudaria nas sessões seguintes)."""
    fim = git("rev-parse", "--short", "HEAD")
    passagens = commits_da_passagem()
    base = passagens[0] if passagens else (git("rev-list", "--max-parents=0", "HEAD").splitlines() or [""])[-1]
    return f"{base[:7]}..{fim}"


def ultima_entrada() -> str:
    e = entradas(ler_passagem()[0])
    return e[0] if e else ""


def tarefas_em_andamento(com_dono: bool = False) -> list[str]:
    """IDs das linhas [~] do TASKS.md. Com com_dono=True, só as "+ dono" (esperam teste do dono e podem
    ficar em andamento entre turnos); com False, só as outras (que uma IA esqueceu de fechar)."""
    arq = RAIZ / "TASKS.md"
    if not arq.exists():
        return []
    linhas = arq.read_text(encoding="utf-8-sig", errors="replace").splitlines()
    # Pela coluna Status (a última): um cartão que cita o marcador no texto não conta
    return [l.split("|")[1].strip() for l in linhas
            if l.startswith("|") and re.search(r"\|\s*\[~\]\s*\|\s*$", l) and l.count("|") > 2
            and ("+ dono" in l) == com_dono]


def duvidas_abertas() -> list[str]:
    """Títulos (### ...) da seção "## Abertas" do DUVIDAS.md, sem o modelo comentado."""
    arq = RAIZ / "DUVIDAS.md"
    if not arq.exists():
        return []
    texto = re.sub(r"(?s)<!--.*?-->", "", arq.read_text(encoding="utf-8-sig", errors="replace"))
    m = re.search(r"(?ms)^## Abertas\s*$(.*?)(?=^## |\Z)", texto)
    titulos = [l[4:].strip() for l in (m.group(1).splitlines() if m else []) if l.startswith("### ")]
    return [t for t in titulos if not re.fullmatch(r"\[.*\]", t)]  # "[Título curto do problema]" é o exemplo do modelo


def comando(quem: str) -> str:
    """Comando que executa a tarefa, pela coluna "Quem" (mesma regra da seção do fluxo no CLAUDE.md)."""
    q = quem.lower()
    if re.match(r"^(outra ia|opencode|codex|gemini|cursor)\b", q):
        return "outra IA"
    if re.match(r"^local\b", q) and "claude" not in q:
        return "ia-rodar.ps1 -Tarefa"
    if "local" in q and "claude" in q:
        return "perguntar (Local + Claude)"
    return "/etapa-haiku" if "haiku" in q else "/etapa-opus" if "opus" in q else "/etapa-sonnet"


def proximas_tarefas(limite: int = 3) -> list[str]:
    """Linhas [!] e [~] e as primeiras [ ] do TASKS.md, com o comando de cada uma."""
    arq = RAIZ / "TASKS.md"
    if not arq.exists():
        return []
    linhas = arq.read_text(encoding="utf-8-sig", errors="replace").splitlines()
    achadas = []
    for i, l in enumerate(linhas):
        if not (l.lstrip().startswith("|") and i + 1 < len(linhas) and re.match(r"^\s*\|[\s:\-|]+\|\s*$", linhas[i + 1])):
            continue
        cab = [c.strip().lower() for c in re.split(r"(?<!\\)\|", l.strip().strip("|"))]
        idx = {n: next((k for k, c in enumerate(cab) if c.startswith(n)), None) for n in ("quem", "status")}
        if None in idx.values():
            continue
        for linha in linhas[i + 2:]:
            if not linha.lstrip().startswith("|"):
                break
            c = [x.strip() for x in re.split(r"(?<!\\)\|", linha.strip().strip("|"))]
            if c and c[0] and max(idx.values()) < len(c) and c[idx["status"]] in ("[!]", "[~]", "[ ]"):
                achadas.append((c[idx["status"]], c[0], c[idx["quem"]], re.sub(r"[*`]", "", c[1] if len(c) > 1 else "")))
    abertas = [a for a in achadas if a[0] in ("[!]", "[~]")] + [a for a in achadas if a[0] == "[ ]"][:limite]
    return [f"{st} {ident} ({quem or '—'}) → {comando(quem)} {ident}: {texto[:70]}" for st, ident, quem, texto in abertas]


def kit_mexido_no_turno() -> list[str]:
    """Arquivos do kit mudados no turno (da passagem anterior até agora), fora dos commits do ia-fluxo.ps1."""
    passagens = commits_da_passagem()
    if len(passagens) < 2:
        return []
    arquivos = git("log", "--format=", "--name-only", "--invert-grep", "-F", f"--grep={KIT_COMMIT}",
                   f"{passagens[1]}..HEAD").splitlines()
    # status cru: git() corta o espaço inicial (" M x" vira "M x") e o índice 3 comeria a 1ª letra do caminho
    cru = subprocess.run(["git", "status", "--porcelain"], cwd=RAIZ, capture_output=True,
                         text=True, encoding="utf-8", errors="replace").stdout
    arquivos += [l[3:].strip('"') for l in cru.splitlines() if l.strip()]
    return sorted({a for a in arquivos if a.startswith(CONTROLE)})


def checar() -> tuple[bool, str]:
    r = subprocess.run([sys.executable, str(RAIZ / ".ia" / "checar.py")], cwd=RAIZ,
                       capture_output=True, text=True, encoding="utf-8", errors="replace",
                       env={**os.environ, "PYTHONIOENCODING": "utf-8"})
    return r.returncode == 0, r.stdout.strip()


def mudancas_so_de_quebra_de_linha(pendente: str) -> bool:
    """True se TODOS os arquivos modificados só diferem por CRLF/LF (e nada novo/apagado)."""
    # git() corta o espaço inicial do status (" M x" vira "M x") e o índice 3 do caminho sairia errado: relê o status cru
    cru = subprocess.run(["git", "status", "--porcelain"], cwd=RAIZ, capture_output=True,
                         text=True, encoding="utf-8", errors="replace").stdout
    linhas = cru.splitlines()
    if not linhas or any(not l.startswith((" M", "M ", "MM")) for l in linhas):
        return False
    return all(subprocess.run(["git", "diff", "--ignore-cr-at-eol", "--quiet", "--", l[3:].strip()],
                              cwd=RAIZ).returncode == 0 for l in linhas)


def conferir() -> int:
    problemas = []
    pendente = git("status", "--porcelain")
    if pendente:
        if mudancas_so_de_quebra_de_linha(pendente):
            problemas.append("mudanças só de quebra de linha (CRLF/LF), sem alteração de conteúdo:\n"
                             + "\n".join("    " + l for l in pendente.splitlines()[:10])
                             + "\n    -> descarte com `git checkout -- <arquivo>` ou normalize o projeto de uma vez "
                               "(`git add --renormalize .` com `* text=auto` no .gitattributes)")
        else:
            problemas.append("mudanças não commitadas (arquivos novos soltos? scripts vão em tools/, config local no .gitignore):\n"
                             + "\n".join("    " + l for l in pendente.splitlines()[:10]))
    texto, cod = ler_passagem()
    problemas += cod
    if not cod:
        problemas += problemas_de_ordem(texto)
    passagens = commits_da_passagem()
    if not passagens:
        problemas.append(f"nenhuma passagem commitada em {PASSAGEM}")
    else:
        # Commits de instalação/atualização do kit (ia-fluxo.ps1) não são trabalho de nenhuma IA
        depois = "\n".join(l for l in git("log", "--oneline", f"{passagens[0]}..HEAD").splitlines()
                           if KIT_COMMIT not in l)
        if depois:
            problemas.append("há commits DEPOIS da última passagem (escreva a passagem do que fez):\n"
                             + "\n".join("    " + l for l in depois.splitlines()[:10]))
    andamento = tarefas_em_andamento()
    if andamento:
        problemas.append(f"tarefas ainda [~] no TASKS.md: {', '.join(andamento)} (marque [x], [!] ou volte para [ ])")
    ok, saida = checar()
    if not ok:
        problemas.append("checagem falhou:\n" + saida)
    com_dono = tarefas_em_andamento(com_dono=True)
    if com_dono:
        print(f"Aviso: em andamento esperando o dono: {', '.join(com_dono)} (ok, se a passagem disser onde parou)")
    kit = kit_mexido_no_turno()
    if kit:
        print("ATENÇÃO: o turno mexeu em arquivos do kit (só com pedido do dono; diga na passagem por quê): "
              + ", ".join(kit[:10]))
    if aviso_de_branch():
        print(aviso_de_branch())
    if problemas:
        print("PASSAGEM INCOMPLETA:")
        for p in problemas:
            print(" - " + p)
        return 1
    print("Passagem OK: tudo commitado, passagem escrita, nada em andamento, checagem ok.")
    return 0


def branch_atual() -> str:
    """Nome do branch atual ("" sem commits ou com HEAD solto)."""
    nome = git("rev-parse", "--abbrev-ref", "HEAD")
    return "" if nome in ("", "HEAD") else nome


def aviso_de_branch() -> str:
    """Aviso quando o branch atual não é o da última passagem (linha "- Branch:"); "" se bate ou não há registro."""
    m = re.search(r"(?m)^- Branch: (\S+)", ultima_entrada())
    atual = branch_atual()
    if m and atual and m.group(1) != atual:
        return (f"ATENÇÃO: branch atual '{atual}' diferente do da última passagem ('{m.group(1)}'): confira se está "
                "no lugar certo antes de continuar (git switch)")
    return ""


def avisos_de_outras_branches() -> list[str]:
    """Outra IA que trabalhou em branch ou worktree próprio deixa passagem, dúvidas e tarefas fora do branch atual:
    um aviso por branch local com commits que o atual não tem (até 5, o mais recente primeiro: o da outra IA costuma ser o
    último a receber commit), dizendo o que ela traz de PASSAGEM/DUVIDAS/TASKS."""
    atual = branch_atual()
    nomes = [n.strip() for n in git("branch", "--no-merged", "HEAD", "--sort=-committerdate", "--format=%(refname:short)").splitlines()
             if n.strip() and n.strip() != atual]
    pastas = {}  # worktree fora da pasta do projeto: branch -> pasta
    ramo, pasta = "", ""
    for linha in git("worktree", "list", "--porcelain").splitlines() + [""]:
        if linha.startswith("worktree "):
            pasta = linha[9:]
        elif linha.startswith("branch "):
            ramo = linha[7:].removeprefix("refs/heads/")
        elif not linha and pasta:
            if ramo and Path(pasta).resolve() != RAIZ:
                pastas[ramo] = pasta
            ramo, pasta = "", ""
    avisos = []
    for nome in nomes[:5]:
        n = git("rev-list", "--count", f"HEAD..{nome}")
        traz = [a for a in git("diff", "--name-only", f"HEAD...{nome}", "--", "PASSAGEM.md", "DUVIDAS.md", "TASKS.md").splitlines()
                if a.strip()]
        onde = f" (worktree em {pastas[nome]})" if nome in pastas else ""
        avisos.append(f"ATENÇÃO: o branch '{nome}'{onde} tem {n} commit(s) que este não tem"
                      + (f" e traz mudanças em {', '.join(traz)} que você não está vendo" if traz else "")
                      + f". Para integrar (se for o caso): git merge --ff-only {nome}; se falhar, o branch divergiu: "
                      "não force, avise o dono")
    if len(nomes) > 5:
        avisos.append(f"(e mais {len(nomes) - 5} branch(es) com commits que este não tem: git branch --no-merged HEAD)")
    return avisos


def resumo(com_testes: bool = True) -> int:
    """com_testes=False (hook SessionStart): não roda a suíte, que pode passar do tempo limite do hook."""
    texto, cod = ler_passagem()
    for c in cod:
        print("ATENÇÃO: " + c)
    print("== Última passagem ==")
    e = entradas(texto)
    print(e[0] if e else "(nenhuma)")
    if aviso_de_branch():
        print(aviso_de_branch())
    for aviso in avisos_de_outras_branches():
        print(aviso)
    passagens = commits_da_passagem()
    # O turno da última IA vai da passagem anterior até a última
    base = passagens[1] if len(passagens) > 1 else ""
    # Sem passagem anterior: os últimos 10 (HEAD~10 não existe em repositório com menos de 11 commits)
    alcance = [f"{base}..HEAD"] if base else ["-10", "HEAD"]
    # Atualizações do kit (ia-fluxo.ps1) não são trabalho de IA: saem da lista e da estatística, para economizar contexto.
    # Arquivos mexidos por um commit que não é do kit aparecem mesmo que sejam do kit (ex.: uma IA editou .ia/).
    todos = git("log", "--oneline", *alcance).splitlines()
    do_kit = [l for l in todos if KIT_COMMIT in l]
    print(f"\n== Commits desde a passagem anterior ({base[:7] + '..HEAD' if base else 'últimos 10'}) ==")
    print("\n".join(l for l in todos if KIT_COMMIT not in l) or "(nenhum)")
    if do_kit:
        print(f"(+ {len(do_kit)} atualização(ões) do kit, omitidas)")
    print("\n== Arquivos mudados ==")
    if base:
        arquivos = sorted({a for a in git("log", "--format=", "--name-only", "--invert-grep", "-F", f"--grep={KIT_COMMIT}",
                                         *alcance).splitlines() if a.strip()})
        # --ignore-cr-at-eol: diferença só de CRLF/LF não conta como mudança
        stat = git("diff", "--ignore-cr-at-eol", "--stat", "--stat-width=100", base, "HEAD", "--", *arquivos).splitlines() \
            if arquivos else []
        print("\n".join(stat[:-1][:25] + stat[-1:]) or "(nenhum fora das atualizações do kit)")
    else:
        print("(sem passagem anterior)")
    kit = kit_mexido_no_turno()
    if kit:
        print("ATENÇÃO: arquivos do kit mexidos no turno (revise; só com pedido do dono): " + ", ".join(kit[:10]))
    pendente = git("status", "--porcelain")
    print("\n== Árvore ==")
    if not pendente:
        print("limpa")
    elif mudancas_so_de_quebra_de_linha(pendente):
        print("só diferenças de quebra de linha (CRLF/LF):\n" + pendente)
    else:
        print("MUDANÇAS NÃO COMMITADAS:\n" + pendente)
    andamento = tarefas_em_andamento()
    if andamento:
        print(f"Tarefas ainda [~] (esquecidas?): {', '.join(andamento)}")
    com_dono = tarefas_em_andamento(com_dono=True)
    if com_dono:
        print(f"Em andamento esperando o dono: {', '.join(com_dono)}")
    duvidas = duvidas_abertas()
    print("\n== Dúvidas abertas (DUVIDAS.md) ==\n" + ("\n".join("- " + d for d in duvidas) if duvidas else "(nenhuma)"))
    tarefas = proximas_tarefas()
    print("\n== Próximas tarefas (TASKS.md) ==\n" + ("\n".join(tarefas) if tarefas else "(nenhuma pendente)"))
    if not com_testes:
        print("\n== Checagem == não rodada no início de sessão: rode python .ia/checar.py")
        return 0 if not pendente and not cod else 1
    ok, saida = checar()
    if ok:
        # tudo passou: uma linha só (os "(pulado)" não ajudam ninguém); avisos aparecem
        avisos = [l.strip() for l in saida.splitlines() if "aviso" in l]
        print("\n== Checagem == OK" + ("".join("\n" + a for a in avisos)))
    else:
        print("\n== Checagem ==\n" + saida)
    return 0 if ok and not pendente and not cod else 1


PACOTE = "CONTEXT-PACK.md"


def secao_md(texto: str, titulo: str) -> str:
    """Corpo da seção "## <titulo>" (até a próxima "## ")."""
    m = re.search(rf"(?ms)^## {re.escape(titulo)}\s*$(.*?)(?=^## |\Z)", texto)
    return m.group(1).strip() if m else ""


def tarefas_abertas_com_cartao() -> list[str]:
    """Linhas das tabelas do TASKS.md com status aberto ([ ], [~], [?], [!]), inteiras (o cartão está nelas)."""
    arq = RAIZ / "TASKS.md"
    if not arq.exists():
        return []
    return [l.strip() for l in arq.read_text(encoding="utf-8-sig", errors="replace").splitlines()
            if l.lstrip().startswith("|") and re.search(r"\|\s*\[[ ~?!]\]\s*\|\s*$", l)]


SEGREDOS = [  # (nome, padrão) procurados no pacote antes de gravar; o pacote é colado em chats da web
    ("token do GitHub", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{20,}")),
    ("chave de API (sk-...)", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}")),
    ("chave da AWS", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("chave privada", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("senha ou token com valor", re.compile(r"(?i)\b(password|passwd|senha|token|api[_-]?key|secret)\s*[:=]\s*[\"']?[^\s\"'`,;]{6,}")),
]


def segredos_em(partes: list[str]) -> list[str]:
    """Uma linha por segredo achado: seção do pacote e tipo (sem mostrar o valor)."""
    achados = []
    for parte in partes:
        secao = parte.splitlines()[0].lstrip("# ") if parte else "?"
        achados += [f"{secao}: {nome}" for nome, padrao in SEGREDOS if padrao.search(parte)]
    return achados


def pacote(forcar: bool = False) -> int:
    """CONTEXT-PACK.md: tudo o que outra IA sem o repositório precisa para continuar, num arquivo só.

    Não lê o CLAUDE.local.md (dados da pessoa). Fica fora do git pelo .git/info/exclude (não mexe no .gitignore).
    Achou algo com cara de segredo: não grava (sai com 1), a não ser com forcar=True (--forcar).
    """
    claude = (RAIZ / "CLAUDE.md").read_text(encoding="utf-8-sig", errors="replace") if (RAIZ / "CLAUDE.md").exists() else ""
    agents = (RAIZ / "AGENTS.md").read_text(encoding="utf-8-sig", errors="replace") if (RAIZ / "AGENTS.md").exists() else ""
    commits = [l for l in git("log", "--oneline", "-15").splitlines() if KIT_COMMIT not in l]
    duvidas = duvidas_abertas()
    def rebaixar(t: str) -> str:  # títulos embutidos ficam abaixo das seções do pacote
        return re.sub(r"(?m)^(#+) ", r"##\1 ", t)
    partes = [
        f"# Pacote de contexto — {RAIZ.name}",
        f"Gerado em {datetime.now():%Y-%m-%d %H:%M} no commit {git('rev-parse', '--short', 'HEAD') or '?'}. "
        "Quem recebe este arquivo não tem o repositório: responda com o que fazer (trechos de código, passos), e o dono "
        "aplica. Ao terminar, diga o que deve entrar na passagem (feito, parou, cuidado, próximo).",
        "## O que é\n\n" + (secao_md(claude, "O que é") or "(sem a seção no CLAUDE.md)"),
        "## Estado atual\n\n" + (secao_md(claude, "Estado atual") or "(sem a seção no CLAUDE.md)"),
        "## Última passagem\n\n" + (rebaixar(ultima_entrada()) or "(nenhuma)"),
        "## Tarefas abertas (TASKS.md)\n\n" + ("\n".join(tarefas_abertas_com_cartao()) or "(nenhuma)"),
        "## Dúvidas abertas\n\n" + ("\n".join("- " + d for d in duvidas) or "(nenhuma)"),
        "## Últimos commits\n\n" + ("\n".join(commits) or "(nenhum)"),
        "## Processo (AGENTS.md)\n\n" + (rebaixar(agents.strip()) or "(sem AGENTS.md)"),
    ]
    achados = segredos_em(partes)
    if achados and not forcar:
        print(f"SEGREDO? {PACOTE} NÃO foi gravado: o texto tem algo com cara de segredo:")
        for a in achados:
            print("  - " + a)
        print("Tire o valor do arquivo de origem (ou, se for falso alarme, rode de novo com --forcar).")
        return 1
    texto = "\n\n".join(partes) + "\n"
    (RAIZ / PACOTE).write_text(texto, encoding="utf-8")
    exclude = Path(git("rev-parse", "--git-path", "info/exclude") or ".git/info/exclude")
    exclude = exclude if exclude.is_absolute() else RAIZ / exclude
    atual = exclude.read_text(encoding="utf-8", errors="replace") if exclude.exists() else ""
    if PACOTE not in atual.splitlines():
        exclude.parent.mkdir(parents=True, exist_ok=True)
        exclude.write_text(atual + ("" if not atual or atual.endswith("\n") else "\n") + PACOTE + "\n", encoding="utf-8")
    tokens = f"{len(texto) // 4:,}".replace(",", ".")  # estimativa: ~4 caracteres por token
    print(f"{PACOTE} gravado ({len(partes)} seções, ~{tokens} tokens, fora do git). Cole ou anexe no chat da outra IA.")
    print("ATENÇÃO: confira o arquivo antes de colar num chat da web: nada de senha, token, chave ou dado pessoal.")
    return 0


def arquivar_antigas(texto: str, quebra: str) -> tuple[str, int]:
    """Deixa no PASSAGEM.md só as MANTER entradas mais novas; as outras vão para o topo do arquivo (nada é apagado).

    Toda IA abre o PASSAGEM.md ao sair (e às vezes ao chegar): um diário de dezenas de entradas gasta contexto à toa.
    """
    antes, depois = texto.split(MARCADOR, 1)
    blocos = [b for b in re.split(r"(?m)^(?=## )", depois) if b.startswith("## ")]
    if len(blocos) <= MANTER:
        return texto, 0
    manter, mover = blocos[:MANTER], blocos[MANTER:]
    destino = RAIZ / ARQUIVO_PASSAGEM
    if destino.exists():
        atual = destino.read_bytes().decode("utf-8-sig", errors="replace").replace("\r\n", "\n")
    else:
        atual = ("# Arquivo da passagem\n\nEntradas antigas do `PASSAGEM.md`, a mais nova primeiro (movidas pelo "
                 "`passagem.py --escrever`).\n\n" + MARCADOR + "\n")
    if MARCADOR not in atual:
        atual = atual.rstrip("\n") + "\n\n" + MARCADOR + "\n"
    a_antes, a_depois = atual.split(MARCADOR, 1)
    corpo = "".join(b.rstrip("\n") + "\n\n" for b in mover) + a_depois.lstrip("\n")
    destino.parent.mkdir(exist_ok=True)
    destino.write_text((a_antes + MARCADOR + "\n\n" + corpo.rstrip("\n") + "\n").replace("\n", quebra),
                       encoding="utf-8", newline="")
    novo = antes + MARCADOR + "\n\n" + "".join(b.rstrip("\n") + "\n\n" for b in manter).rstrip("\n") + "\n"
    return novo, len(mover)


def escrever(args: argparse.Namespace) -> int:
    """Insere uma entrada no topo do PASSAGEM.md (UTF-8, mesma quebra de linha do arquivo)."""
    faltam = [n for n in ("ferramenta", "feito", "parou", "cuidado", "proximo") if not getattr(args, n)]
    if faltam:
        print("Faltam: " + ", ".join("--" + n for n in faltam))
        return 2
    texto, cod = ler_passagem()
    if not texto.strip():
        texto = ("# Passagem entre IAs\n\nDiário de quem trabalhou no projeto. Cada IA acrescenta uma entrada "
                 "**no topo** ao sair e lê a última ao entrar. Formato no `AGENTS.md`.\n\n" + MARCADOR + "\n")
    quebra = "\r\n" if "\r\n" in texto else "\n"
    texto = texto.replace("\r\n", "\n")
    if MARCADOR not in texto:
        texto = texto.rstrip("\n") + "\n\n" + MARCADOR + "\n"

    def campo(valor: str) -> str:
        return valor.strip().replace("\n", "\n  ")

    entrada = (f"## {datetime.now():%Y-%m-%d %H:%M} — {args.ferramenta.strip()}\n"
               f"- Feito: {campo(args.feito)}\n- Parou em: {campo(args.parou)}\n"
               f"- Cuidado: {campo(args.cuidado)}\n- Próximo: {campo(args.proximo)}\n")
    if args.tentado:
        entrada += f"- Já tentado: {campo(args.tentado)}\n"
    if branch_atual():
        entrada += f"- Branch: {branch_atual()}\n"
    if args.revisar:
        alvo = intervalo_do_turno() if args.revisar == "auto" else args.revisar
        entrada += f"- REVISAR: {campo(alvo)}\n"
    antes, depois = texto.split(MARCADOR, 1)
    novo = antes + MARCADOR + "\n\n" + entrada + ("\n" + depois.lstrip("\n") if depois.strip() else "")
    novo, movidas = arquivar_antigas(novo, quebra)
    (RAIZ / PASSAGEM).write_text(novo.replace("\n", quebra), encoding="utf-8", newline="")
    print(f"Passagem escrita no topo de {PASSAGEM} (UTF-8" + (", recodificado de UTF-16/cp1252" if cod else "") + ")."
          + (f" {movidas} entrada(s) antiga(s) movida(s) para {ARQUIVO_PASSAGEM}." if movidas else ""))
    if args.commitar:
        git("add", PASSAGEM)
        if movidas:
            git("add", ARQUIVO_PASSAGEM)
        r = subprocess.run(["git", "commit", "-m", f"Handoff: {args.feito.strip()[:60]}"], cwd=RAIZ,
                           capture_output=True, text=True, encoding="utf-8", errors="replace")
        print((r.stdout + r.stderr).strip()[-600:])
        return r.returncode
    print("Falta o commit: git add PASSAGEM.md && git commit -m \"Handoff: <IDs>\" (ou repita com --commitar).")
    return 0


CAMPOS = {"feito": "Feito", "parou": "Parou em", "cuidado": "Cuidado", "proximo": "Próximo", "revisar": "REVISAR"}


def campos_da_entrada(entrada: str) -> dict | None:
    """A entrada da passagem em campos (título, ferramenta e as linhas "- Campo: ..."); campo ausente = ""."""
    if not entrada:
        return None
    titulo = entrada.splitlines()[0][3:].strip()
    d = {"titulo": titulo, "ferramenta": titulo.split(" — ", 1)[1].strip() if " — " in titulo else ""}
    for chave, rotulo in CAMPOS.items():
        m = re.search(rf"(?m)^- {re.escape(rotulo)}:\s*(.*)$", entrada)
        d[chave] = m.group(1).strip() if m else ""
    return d


def resumo_json() -> int:
    """O estado do projeto em JSON, para a interface gráfica do kit: só lê (sem testes, sem escrever) e sai com 0."""
    ultimo = git("log", "-1", "--format=%h%x00%cI%x00%s")
    partes = ultimo.split(chr(0)) if ultimo else []
    dados = {
        "passagem": campos_da_entrada(ultima_entrada()),
        "ultimo_commit": dict(zip(("hash", "iso", "assunto"), partes)) if len(partes) == 3 else None,
        "arvore_limpa": git("status", "--porcelain") == "",
        "branch": branch_atual(),
        "duvidas_abertas": len(duvidas_abertas()),
        "em_andamento": tarefas_em_andamento(False) + tarefas_em_andamento(True),
    }
    print(json.dumps(dados, ensure_ascii=False))
    return 0


def main() -> int:
    global RAIZ
    utf8_no_terminal()
    p = argparse.ArgumentParser(description="Troca de turno entre IAs", add_help=True)
    p.add_argument("--conferir", action="store_true")
    p.add_argument("--resumo", action="store_true")
    p.add_argument("--hook", action="store_true", help="com --resumo: hook SessionStart do Claude Code (sai sempre com 0)")
    p.add_argument("--escrever", action="store_true")
    p.add_argument("--commitar", action="store_true")
    for n in ("ferramenta", "feito", "parou", "cuidado", "proximo"):
        p.add_argument("--" + n)
    p.add_argument("--revisar", nargs="?", const="auto", help="grava a linha REVISAR: (sem valor = o intervalo do turno)")
    p.add_argument("--forcar", action="store_true", help="com --pacote: grava mesmo se achar algo com cara de segredo")
    p.add_argument("--tentado", help="o que já foi tentado e não funcionou (para a próxima IA não repetir)")
    p.add_argument("--pacote", action="store_true", help=f"grava {PACOTE} para uma IA sem acesso ao repositório")
    p.add_argument("--json", action="store_true", help="com --resumo: o estado em JSON, só lendo (interface gráfica do kit)")
    p.add_argument("--caminho", type=Path, help="pasta do projeto (padrão: a pasta acima de .ia/)")
    args = p.parse_args()
    if args.caminho:
        RAIZ = args.caminho.resolve()
    if args.pacote:
        return pacote(args.forcar)
    if args.conferir:
        return conferir()
    if args.resumo:
        if args.json:
            return resumo_json()
        if args.hook:
            # A saída do hook SessionStart entra no contexto da sessão; código != 0 a esconderia
            print("(Resumo automático do início de sessão: o /inicio usa este texto em vez de rodar o --resumo de novo.)\n")
            resumo(com_testes=False)
            return 0
        return resumo()
    if args.escrever:
        return escrever(args)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main())
