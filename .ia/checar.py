"""Checagens do projeto: testes, traduções (i18n), tabelas do TASKS.md, cabeçalho dos comandos/agentes do Claude Code
e codificação do PASSAGEM.md.

Uso: python .ia/checar.py
Usado pelo hook de pre-commit (vale para qualquer IA que faça commit). Sai com código 1 se algo falhar.
A saída é curta de propósito (economiza tokens quando o Claude lê o resultado).
"""
import ast
import json
import os
import re
import signal
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # importa outro script de .ia/: sem __pycache__ no projeto

RAIZ = Path(__file__).resolve().parent.parent
MAX_LINHAS = 30
TIMEOUT_TESTES = 120  # segundos; teste que passa disso é interrompido (loop infinito não trava a IA nem o commit)
LINHA_LONGA = 500  # caracteres: linha de tabela do TASKS.md acima disso vira aviso (detalhes vão para docs/)
TASKS_MAX_IDS = 80  # tarefas no TASKS.md; acima disso (ou de TASKS_MAX_KB) vira aviso para arquivar os blocos feitos
TASKS_MAX_KB = 40
CLAUDE_MD_TETO = 60  # linhas: o CLAUDE.md é lido em toda sessão; acima disso vira aviso (detalhes vão para docs/)
# Padrão do TASKS.md (o mesmo do .ia/tasks.py): abertos primeiro, depois [x]
STATUS_OK = ("[ ]", "[~]", "[?]", "[!]", "[x]")
# outra IA (só quando o dono a escolhe): genérico "Outra IA" ou o nome dela, com ou sem o modelo
QUEM_OK = re.compile(r"^(Claude \((Haiku|Sonnet|Opus) [\d.]+\)|Local|—|Outra IA|(OpenCode|Codex|Gemini|Cursor)( \([^)]+\))?)( \+ dono)?$")


def pasta_principal() -> Path | None:
    """Pasta do worktree principal quando esta é outro worktree do mesmo repositório (None se for a principal)."""
    try:
        r = subprocess.run(["git", "rev-parse", "--git-common-dir"], cwd=RAIZ, capture_output=True, text=True,
                           encoding="utf-8", errors="replace")
    except OSError:  # git fora do PATH: sem fallback, mas o hook não cai
        return None
    comum = r.stdout.strip()
    if r.returncode != 0 or not comum:
        return None
    pasta = (RAIZ / comum).resolve().parent
    return None if pasta == RAIZ.resolve() else pasta


def arquivo_config() -> tuple[Path | None, Path | None]:
    """(.ia/config.json a usar, pasta principal se ele veio de lá). O arquivo não vai para o git, então um worktree novo
    (OpenCode, Cursor...) não o tem: cai para o do worktree principal."""
    local = RAIZ / ".ia" / "config.json"
    if local.exists():
        return local, None
    principal = pasta_principal()
    if principal and (principal / ".ia" / "config.json").exists():
        return principal / ".ia" / "config.json", principal
    return None, None


def config() -> dict:
    arq, principal = arquivo_config()
    cfg = json.loads(arq.read_text(encoding="utf-8-sig")) if arq else {}
    teste = cfg.get("teste", "")
    if principal and teste:
        # executável relativo do comando (ex.: .venv\Scripts\python.exe) só existe na pasta principal: aponta para lá
        m = re.match(r'^"?([^\s"]+)"?(.*)$', teste, re.S)
        if m and not Path(m.group(1)).is_absolute() and not existe_exe(RAIZ, m.group(1)) and existe_exe(principal, m.group(1)):
            cfg["teste"] = f'"{principal / m.group(1)}"{m.group(2)}'
    return cfg


def existe_exe(base: Path, token: str) -> bool:
    """O executável existe em base? O cmd completa a extensão (PATHEXT): `.venv/Scripts/python` vale como `python.exe`."""
    return any((base / (token + ext)).exists() for ext in ("", ".exe", ".cmd", ".bat", ".com"))


def matar_arvore(p: subprocess.Popen) -> None:
    """Encerra o processo e os filhos (com shell=True, matar só o shell deixa o teste rodando)."""
    if sys.platform == "win32":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], capture_output=True)
    else:
        try:
            os.killpg(p.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def rodar_testes(cmd: str, limite: int = TIMEOUT_TESTES) -> tuple[bool, str]:
    if not cmd:
        if arquivo_config()[0] is None and pasta_principal() is not None:  # worktree secundário sem config em lugar nenhum
            return True, ("testes: NÃO rodaram | aviso: sem .ia/config.json (não vai para o git; copie o da pasta principal "
                          "do projeto para .ia/ aqui)")
        return True, "testes: nenhum comando configurado em .ia/config.json (pulado)"
    p = subprocess.Popen(cmd, shell=True, cwd=RAIZ, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                         text=True, encoding="utf-8", errors="replace",
                         start_new_session=(sys.platform != "win32"))
    try:
        texto, _ = p.communicate(timeout=limite)
    except subprocess.TimeoutExpired:
        matar_arvore(p)
        texto, _ = p.communicate()
        saida = texto.strip().splitlines()
        return False, (f"testes: TRAVOU (mais de {limite} s; processo encerrado). Provável loop infinito num teste "
                       f"ou no código testado. Limite em .ia/config.json (teste_timeout).\n"
                       + "\n".join(saida[-MAX_LINHAS:]))
    saida = texto.strip().splitlines()
    if p.returncode == 0:
        return True, "testes: OK"
    if p.returncode == 5 and "pytest" in cmd:
        # pytest sai com 5 quando não coletou nenhum teste: projeto novo, ainda sem testes
        return True, "testes: nenhum teste ainda (pulado)"
    return False, "testes: FALHOU\n" + "\n".join(saida[-MAX_LINHAS:])


def validar_unittest(cmd: str) -> tuple[bool, str]:
    """Com `unittest`, função `test_*` solta (estilo pytest) nunca roda e a suíte dá verde em falso."""
    if "unittest" not in cmd:
        return True, "unittest: n/a (pulado)"
    m = re.search(r"-s\s+(\S+)", cmd)
    pasta = RAIZ / (m.group(1) if m else ".")
    if re.search(r"\s-t\s", cmd) and pasta != RAIZ and pasta.is_dir() and not (pasta / "__init__.py").exists():
        return False, (f"unittest: FALHOU — o comando usa `-t` e a pasta {pasta.relative_to(RAIZ).as_posix()}/ não tem __init__.py "
                       "(o discover dá \"Start directory is not importable\"). Crie o arquivo vazio "
                       f"{pasta.relative_to(RAIZ).as_posix()}/__init__.py (e o da pasta do código, se for pacote).")
    soltos = []
    for arq in sorted(pasta.rglob("test*.py")):
        if any(p.startswith(".") or p in ("venv", "node_modules", "__pycache__") for p in arq.relative_to(RAIZ).parts):
            continue
        try:
            arvore = ast.parse(arq.read_text(encoding="utf-8-sig"))
        except (SyntaxError, UnicodeDecodeError):
            continue
        funcoes = [n.name for n in arvore.body if isinstance(n, ast.FunctionDef) and n.name.startswith("test")]
        tem_classe = any(isinstance(n, ast.ClassDef) and any("TestCase" in ast.unparse(b) for b in n.bases)
                         for n in arvore.body)
        if funcoes and not tem_classe:
            soltos.append(f"{arq.relative_to(RAIZ).as_posix()} ({len(funcoes)} funções test_*)")
    if soltos:
        return False, ("unittest: FALHOU — estes arquivos têm funções test_* fora de classe TestCase e NÃO são executados:\n"
                       + "\n".join("  " + s for s in soltos)
                       + "\n  Use classes `unittest.TestCase` (ou mude o comando de teste para pytest).")
    return True, "unittest: testes em classes TestCase OK"


def chaves(dados: dict, prefixo: str = "") -> set[str]:
    resultado = set()
    for k, v in dados.items():
        nome = f"{prefixo}{k}"
        resultado |= chaves(v, nome + ".") if isinstance(v, dict) else {nome}
    return resultado


def checar_i18n(pastas: list[str]) -> tuple[bool, str]:
    """Cada pasta de tradução é comparada só com ela mesma (en.json de pastas diferentes não se escondem)."""
    grupos = {p: sorted((RAIZ / p).glob("*.json")) for p in pastas}
    grupos = {p: a for p, a in grupos.items() if len(a) >= 2}
    if not grupos:
        return True, "i18n: sem arquivos de tradução (pulado)"
    faltas, total, idiomas = [], 0, set()
    for pasta, arquivos in grupos.items():
        por_idioma = {}
        for a in arquivos:
            try:
                dados = json.loads(a.read_text(encoding="utf-8-sig"))
            except json.JSONDecodeError as e:
                return False, f"i18n: JSON inválido em {pasta}/{a.name}: {e}"
            if not isinstance(dados, dict):
                return False, f"i18n: FALHOU ({pasta}/{a.name} não é um objeto JSON)"
            por_idioma[a.stem] = chaves(dados)
        todas = set().union(*por_idioma.values())
        total += len(todas)
        idiomas |= set(por_idioma)
        faltas += [f"  {pasta}/{idioma}: falta {', '.join(sorted(todas - ks)[:15])}"
                   for idioma, ks in por_idioma.items() if todas - ks]
    if faltas:
        return False, "i18n: FALHOU (chaves ausentes)\n" + "\n".join(faltas)
    return True, f"i18n: OK ({total} chaves em {len(idiomas)} idiomas)"


def celulas(linha: str) -> list[str]:
    """Células de uma linha de tabela markdown (separa só nos | sem barra antes, como o GitHub)."""
    return re.split(r"(?<!\\)\|", linha.strip().strip("|"))


def validar_tasks(arq: Path, ids_unicos: bool = False) -> tuple[bool, str]:
    """Tabelas do TASKS.md: mesmo número de colunas em todas as linhas de cada tabela.

    Coluna a mais/menos numa linha = erro (acontece ao editar à mão ou por IA). ID repetido é só AVISO por
    padrão, porque há projetos que repetem tarefas de propósito (ex.: uma seção "Próxima tarefa"); com
    "tasks_ids_unicos": true no .ia/config.json vira erro. Linhas muito longas também só geram aviso.
    TASKS.md sem tabelas (lista própria) passa.
    """
    if not arq.exists():
        return True, "tasks: sem TASKS.md (pulado)"
    linhas = arq.read_text(encoding="utf-8-sig", errors="replace").splitlines()
    problemas, repetidos, vistos, longas, tabelas, fora = [], [], {}, [], 0, []
    i = 0
    while i < len(linhas):
        e_tabela = (linhas[i].lstrip().startswith("|") and i + 1 < len(linhas)
                    and re.match(r"^\s*\|[\s:\-|]+\|\s*$", linhas[i + 1]))
        if not e_tabela:
            i += 1
            continue
        cab = [c.strip().lower() for c in celulas(linhas[i])]
        col_quem = next((k for k, c in enumerate(cab) if c.startswith("quem")), None)
        col_status = next((k for k, c in enumerate(cab) if c.startswith("status")), None)
        colunas, j = len(cab), i + 2
        tabelas += 1
        while j < len(linhas) and linhas[j].lstrip().startswith("|"):
            cel = celulas(linhas[j])
            ident = cel[0].strip()
            # valores fora do padrão (o /etapa escolhe o comando pela coluna "Quem"): só aviso
            st = cel[col_status].strip() if col_status is not None and col_status < len(cel) else ""
            if ident and st and st not in STATUS_OK:
                fora.append(ident)
            elif ident and st in STATUS_OK[:4] and col_quem is not None and col_quem < len(cel) \
                    and not QUEM_OK.match(cel[col_quem].strip()):
                fora.append(ident)
            if len(cel) != colunas:
                problemas.append(f"linha {j + 1} ({ident or '?'}): {len(cel)} colunas, a tabela tem {colunas}")
            if ident and len(ident) <= 12 and " " not in ident:
                if ident in vistos:
                    (problemas if ids_unicos else repetidos).append(
                        f"{ident} (linhas {vistos[ident]} e {j + 1})")
                else:
                    vistos[ident] = j + 1
            if len(linhas[j]) > LINHA_LONGA:
                longas.append(ident or str(j + 1))
            j += 1
        i = j
    aviso = ""
    if repetidos:
        aviso += f" | aviso: IDs repetidos: {', '.join(repetidos[:6])}"
    if longas:
        aviso += f" | aviso: linhas longas (>{LINHA_LONGA} caracteres; detalhes vão para docs/): {', '.join(longas[:8])}"
    kb = arq.stat().st_size / 1024
    if len(vistos) > TASKS_MAX_IDS or kb > TASKS_MAX_KB:
        aviso += (f" | aviso: TASKS.md grande ({len(vistos)} tarefas, {kb:.0f} KB; limite {TASKS_MAX_IDS} ou {TASKS_MAX_KB} KB):"
                  " veja python .ia/tasks.py arquivar")
    if fora:
        aviso += (f" | aviso: Quem/Status fora do padrão em {', '.join(fora[:8])}"
                  + (f" e mais {len(fora) - 8}" if len(fora) > 8 else "") + " (veja: python .ia/tasks.py padronizar)")
    if problemas:
        return False, "tasks: FALHOU (tabelas do TASKS.md)\n" + "\n".join("  " + x for x in problemas[:12]) + aviso
    return True, (f"tasks: OK ({tabelas} tabelas, {len(vistos)} IDs)" if tabelas else "tasks: sem tabelas (pulado)") + aviso


CHAVE_YAML = re.compile(r"^([A-Za-z_][\w-]*):(?:\s(.*))?$")


def problemas_cabecalho(texto: str) -> list[tuple[int, str]]:
    """Erros do cabeçalho YAML (frontmatter) de um comando ou agente: (linha, motivo).

    Sem dependência (nada de PyYAML). Pega o que faz o Claude Code descartar o arquivo sem aviso: cabeçalho sem o
    "---" de fechamento, linha que não é "chave: valor" e valor sem aspas com ": " (ex.: "description: A: b").
    Arquivo sem cabeçalho (não começa com "---") passa: o cabeçalho é opcional.
    """
    linhas = texto.lstrip("﻿").splitlines()
    if not linhas or linhas[0].strip() != "---":
        return []
    problemas = []
    for n, linha in enumerate(linhas[1:], start=2):
        if linha.strip() == "---":
            return problemas
        if not linha.strip() or linha.lstrip().startswith("#") or linha[0] in " \t-":
            continue  # vazia, comentário, continuação ou item de lista
        m = CHAVE_YAML.match(linha)
        if not m:
            problemas.append((n, 'linha não é "chave: valor"'))
            continue
        valor = (m.group(2) or "").strip()
        if valor and valor[0] not in "\"'[{|>&*!" and ": " in valor.split(" #")[0]:
            problemas.append((n, 'valor com ": " sem aspas (ponha o valor entre aspas)'))
    return [(1, 'cabeçalho sem o "---" de fechamento')]  # sem fechamento, o resto do arquivo não é YAML


def validar_cabecalhos(raiz: Path = RAIZ) -> tuple[bool, str]:
    """Cabeçalho dos .md em .claude/commands/ e .claude/agents/; FALTA com arquivo:linha."""
    arquivos = [a for pasta in (".claude/commands", ".claude/agents") for a in sorted((raiz / pasta).glob("*.md"))]
    if not arquivos:
        return True, "cabeçalhos: sem comandos/agentes (pulado)"
    erros = [f"FALTA {a.relative_to(raiz).as_posix()}:{n}: {motivo}"
             for a in arquivos for n, motivo in problemas_cabecalho(a.read_text(encoding="utf-8", errors="replace"))]
    if erros:
        return False, ("cabeçalhos: FALHOU (o Claude Code descarta o arquivo sem aviso)\n"
                       + "\n".join("  " + e for e in erros[:12]))
    return True, f"cabeçalhos: OK ({len(arquivos)} arquivos)"


def validar_claude_md(teto: int) -> tuple[bool, str]:
    """Só aviso: CLAUDE.md longo gasta contexto em toda sessão. Meta 20-40 linhas; o teto vem do config.json."""
    arquivo = RAIZ / "CLAUDE.md"
    if not arquivo.exists():
        return True, "claude.md: não existe (pulado)"
    n = len(arquivo.read_text(encoding="utf-8", errors="replace").splitlines())
    if n > teto:
        return True, f"claude.md: {n} linhas | aviso: acima do teto de {teto} (mova detalhes para docs/)"
    return True, f"claude.md: {n} linhas OK"


def validar_passagem_arquivo() -> tuple[bool, str]:
    try:
        import passagem
    except ImportError:
        return True, "passagem: passagem.py ausente (pulado)"
    problemas = passagem.problemas_de_codificacao()
    if problemas:
        return False, "passagem: FALHOU\n" + "\n".join("  " + x for x in problemas)
    return True, "passagem: UTF-8 OK"


def main() -> int:
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    cfg = config()
    resultados = [
        rodar_testes(cfg.get("teste", ""), int(cfg.get("teste_timeout", TIMEOUT_TESTES))),
        validar_unittest(cfg.get("teste", "")),
        checar_i18n(cfg.get("pastas_traducao", ["locales", "src/locales"])),
    ]
    if cfg.get("validar_tasks", True):
        resultados.append(validar_tasks(RAIZ / "TASKS.md", bool(cfg.get("tasks_ids_unicos", False))))
    resultados.append(validar_cabecalhos())
    resultados.append(validar_claude_md(int(cfg.get("claude_md_teto", CLAUDE_MD_TETO))))
    resultados.append(validar_passagem_arquivo())
    for _, msg in resultados:
        print(msg)
    if not resultados[0][0] and arquivo_config()[1]:
        print("dica: o .ia/config.json veio da pasta principal (este é outro worktree); a falha dos testes pode ser do "
              "ambiente (venv, node_modules), não do código")
    return 0 if all(ok for ok, _ in resultados) else 1


if __name__ == "__main__":
    sys.exit(main())
