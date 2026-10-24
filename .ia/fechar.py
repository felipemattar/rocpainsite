"""Fecha o turno de uma IA numa tarefa: confere, commita, marca o TASKS.md e escreve a passagem.

Uso: python .ia/fechar.py <ID> --ferramenta "Local (<modelo>)" [--real "0,3 h"] [--devolver] [--so-diagnosticar]

Rede de segurança para IA que esquece o processo do AGENTS.md. Diagnostica o que faltou, corrige só o que é
mecânico (commit, linha do TASKS.md, passagem) e, se a checagem reprovar, não commita: com --devolver marca a
tarefa [!] e deixa a passagem para a outra IA (normalmente o Claude) continuar. Última linha da saída:
`FALTOU: <itens>` (ou `FALTOU: nada`), usada para medir o que cada IA fecha sozinha.
"""
import argparse
import re
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True  # importa outro script de .ia/: sem __pycache__ no projeto

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
TASKS = RAIZ / "TASKS.md"
REAL_OK = re.compile(r"^[~≈]?\s*\d+([.,]\d+)?\s*(h|min)\b", re.I)
SUJO_IGNORADO = ("__pycache__", ".pytest_cache", ".pyc")


REVISAR = ("REVISAR (Claude): fechada só com testes escritos pela IA local; "
           "conferir o comportamento e os casos de borda.")


def tem_aceite(tarefa: str) -> bool:
    """Há teste de aceite visível (tests/test_aceite_<ID>.py) para a tarefa?"""
    return (RAIZ / "tests" / f"test_aceite_{tarefa.replace('.', '_')}.py").exists()


def utf8() -> None:
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(list(args), cwd=RAIZ, capture_output=True, text=True, encoding="utf-8", errors="replace")


def sujo() -> list[str]:
    saida = run("git", "status", "--porcelain", "-uall").stdout.splitlines()
    return [l for l in saida if l.strip() and not any(i in l for i in SUJO_IGNORADO)]


def ler_tasks() -> tuple[str, str]:
    texto = TASKS.read_bytes().decode("utf-8-sig")
    return texto, ("\r\n" if "\r\n" in texto else "\n")


def achar_linha(linhas: list[str], tarefa: str) -> int:
    for i, l in enumerate(linhas):
        if re.match(rf"^\|\s*{re.escape(tarefa)}\s*\|", l):
            return i
    return -1


def celulas(linha: str) -> list[str]:
    """Células sem espaços nas pontas; "\\|" dentro do cartão não separa (mesma regra do checar.py)."""
    from checar import celulas as separar
    return [c.strip() for c in separar(linha)]


def montar(c: list[str]) -> str:
    return "| " + " | ".join(c) + " |"


def titulo(c: list[str]) -> str:
    t = re.sub(r"[`*]", "", c[1])
    return (t.split(":")[0] if ":" in t[:70] else t)[:60].strip()


def proxima_pendente(linhas: list[str], depois_de: int) -> str:
    for l in linhas[depois_de + 1:]:
        if re.match(r"^\|\s*[\w.]+\s*\|", l) and l.rstrip().endswith("[ ] |"):
            return celulas(l)[0]
    return "nenhuma tarefa pendente"


def diagnosticar(tarefa: str) -> tuple[list[str], str]:
    faltou = []
    texto, _ = ler_tasks()
    linhas = texto.split("\n")
    i = achar_linha(linhas, tarefa)
    if i < 0:
        return ["tarefa_inexistente"], ""
    c = celulas(linhas[i])
    if c[-1] != "[x]":
        faltou.append("tasks_nao_marcada")
    if c[-1] == "[x]" and not REAL_OK.match(c[4] if len(c) > 4 else ""):
        faltou.append("coluna_real")
    # "Local" e "—" são o que o /planejar escreve: ainda não dizem quem fez
    if not re.match(r"^(OpenCode|Claude|Codex|Cursor|Aider|Gemini|Local \()", c[2]):
        faltou.append("coluna_quem")
    if sujo():
        faltou.append("commit")
    topo = ""
    try:
        import passagem
        topo = passagem.ultima_entrada()
    except Exception:  # noqa: BLE001
        pass
    if tarefa not in topo:
        faltou.append("passagem")
    return faltou, texto


def main() -> int:
    utf8()
    p = argparse.ArgumentParser()
    p.add_argument("tarefa")
    p.add_argument("--ferramenta", required=True)
    p.add_argument("--real", default="0,3 h")
    p.add_argument("--devolver", action="store_true")
    p.add_argument("--so-diagnosticar", action="store_true")
    args = p.parse_args()

    faltou, texto = diagnosticar(args.tarefa)
    if "tarefa_inexistente" in faltou:
        print(f"Tarefa {args.tarefa} não encontrada no TASKS.md.")
        print("FALTOU: tarefa_inexistente")
        return 2
    print("Diagnóstico antes do fechamento: " + (", ".join(faltou) if faltou else "nada faltou"))
    if args.so_diagnosticar:
        print("FALTOU: " + (",".join(faltou) if faltou else "nada"))
        return 0

    chk = run(sys.executable, str(RAIZ / ".ia" / "checar.py"))
    saida = (chk.stdout + chk.stderr).strip()
    quebra = "\r\n" if "\r\n" in texto else "\n"
    # normaliza antes de separar: com CRLF, split("\n") deixa o \r no fim de cada linha e o replace final o dobraria (\r\r\n)
    linhas = texto.replace("\r\n", "\n").split("\n")
    i = achar_linha(linhas, args.tarefa)
    c = celulas(linhas[i])

    # Entrega: arquivos .py com caminho citados no cartão (entre crases) precisam existir; senão a IA não fez a tarefa.
    # Teste próprio (tests/test_<modulo>.py) é dispensado quando o aceite visível da tarefa existe; o código alvo não.
    aceite = tem_aceite(args.tarefa)
    ausentes = [a for a in re.findall(r"`([\w.\\/-]+\.py)`", c[1])
                if "/" in a and not (RAIZ / a).exists() and not (aceite and re.match(r"^tests/test_(?!aceite_)", a))]
    if ausentes:
        faltou.append("entrega_ausente")
        saida = ("Entrega ausente (arquivos do cartão que não existem): " + ", ".join(ausentes)
                 + ("\n" + saida if chk.returncode != 0 else ""))
        args.devolver = True

    if chk.returncode != 0 or ausentes:
        print("Checagem REPROVADA; nada foi commitado.\n" + "\n".join(saida.splitlines()[-12:]))
        if args.devolver:
            c[2], c[-1] = args.ferramenta, "[!]"
            linhas[i] = montar(c)
            TASKS.write_bytes("\n".join(linhas).replace("\n", quebra).encode("utf-8"))
            run("git", "add", "TASKS.md")
            run("git", "commit", "-q", "--no-verify", "-m", f"Task {args.tarefa}: blocked, handed back")
            # sem --commitar: o hook rodaria a checagem que acabou de reprovar e recusaria o commit da passagem
            run(sys.executable, str(RAIZ / ".ia" / "passagem.py"), "--escrever", "--ferramenta", args.ferramenta,
                "--feito", f"{args.tarefa} (não concluída)", "--parou", f"tarefa {args.tarefa} reprovada na checagem",
                "--cuidado", "A checagem (checar.py) reprovou: " + " | ".join(saida.splitlines()[:4])[:400],
                "--proximo", f"corrigir a {args.tarefa} (marcada [!])")
            run("git", "add", "PASSAGEM.md")
            run("git", "commit", "-q", "--no-verify", "-m", f"Handoff: {args.tarefa} (blocked)")
        print("FALTOU: " + ",".join(dict.fromkeys(faltou + ([] if ausentes else ["checagem_reprovada"]))))
        return 1

    c[2] = args.ferramenta
    if not REAL_OK.match(c[4] if len(c) > 4 else ""):
        c[4] = args.real
    c[-1] = "[x]"
    linhas[i] = montar(c)
    proxima = proxima_pendente(linhas, i)
    TASKS.write_bytes("\n".join(linhas).replace("\n", quebra).encode("utf-8"))

    run("git", "add", "-A")
    r = run("git", "commit", "-q", "-m", f"Task {args.tarefa}: {titulo(c)} (closed by fechar.py)")
    print((r.stdout + r.stderr).strip()[-300:] or "Commit da tarefa feito.")
    nota = ("Fechamento feito por .ia/fechar.py. Faltava: " + (", ".join(faltou) if faltou else "nada") + ".")
    if not aceite:
        nota += " " + REVISAR
    # A IA pode já ter escrito a passagem (a IA local costuma escrevê-la até duas vezes): só acrescenta outra se faltava
    # ou se é preciso registrar o REVISAR (tarefa sem teste de aceite).
    if "passagem" in faltou or not aceite:
        r = run(sys.executable, str(RAIZ / ".ia" / "passagem.py"), "--escrever", "--commitar", "--ferramenta", args.ferramenta,
                "--feito", args.tarefa, "--parou", "nada em andamento", "--cuidado", nota, "--proximo", proxima)
        print((r.stdout + r.stderr).strip()[-300:])
    else:
        print("Passagem da tarefa já escrita pela IA; não duplicada.")
    conf = run(sys.executable, str(RAIZ / ".ia" / "passagem.py"), "--conferir")
    ok = conf.returncode == 0
    print("Passagem OK" if ok else "Conferência da passagem falhou:\n" + (conf.stdout + conf.stderr).strip()[-500:])
    print("FALTOU: " + (",".join(faltou) if faltou else "nada"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
