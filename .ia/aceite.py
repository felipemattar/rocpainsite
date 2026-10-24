"""Teste de aceite de uma tarefa delegada: cria o esqueleto e confere se o teste discrimina.

Uso:
  python .ia/aceite.py esqueleto <ID>
      Cria tests/test_aceite_<ID>.py a partir do cartao do TASKS.md (uma regra por frase do cartao, com TODO).
      O Claude preenche os casos. Nao sobrescreve um arquivo que ja existe.
  python .ia/aceite.py validar <ID> [--referencia <arquivo>] [--aceite <test_aceite.py>] [--mutante "nome|trecho|troca" ...]
      Copia o projeto para uma pasta temporaria e confere, nesta ordem:
        1. na situacao de partida o aceite REPROVA (nao passa vazio): sem o arquivo alvo, se ele ainda nao existe; ou com o
           alvo atual (com o defeito), se a tarefa corrige um arquivo que ja existe;
        2. com a entrega o aceite PASSA;
        3. cada mutante (a entrega com `trecho` trocado por `troca`) REPROVA.
      Entrega = --referencia, se dada (solucao escrita pelo Claude, para algoritmo sutil); sem --referencia, o arquivo alvo
      que a IA local entregou no projeto (nao custa ao Claude escrever a solucao). Cada execucao do aceite tem limite de tempo.
      Sai com codigo 1 se algo falhar. Use antes de entregar o cartao a uma IA local: aceite fraco ou cartao ambiguo aparece aqui.
  Medido na bateria de IA local: o teste visivel no cartao cortou a tarefa 2.3 de ~12 para 3 a 8 min; um cartao ambiguo (sentido do
  deslocamento, na 2.6) fez a IA falhar com um aceite correto, e a validacao com referencia teria mostrado isso antes.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True  # importa outro script de .ia/: sem __pycache__ no projeto

TIMEOUT = 60  # segundos por execucao do aceite: mutante/entrega com loop infinito nao trava o validar
RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from checar import celulas  # noqa: E402 (mesma pasta .ia/; "\|" dentro do cartao nao separa)
IGNORAR = shutil.ignore_patterns(".git", "__pycache__", ".pytest_cache", "execucoes", "node_modules", ".venv")


def utf8() -> None:
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def cartao(tarefa: str) -> str:
    texto = (RAIZ / "TASKS.md").read_bytes().decode("utf-8-sig")
    for linha in texto.splitlines():
        if re.match(rf"^\|\s*{re.escape(tarefa)}\s*\|", linha):
            c = celulas(linha)
            return c[1].strip() if len(c) > 1 else ""
    sys.exit(f"Tarefa {tarefa} nao encontrada no TASKS.md.")


def alvo(texto: str) -> str | None:
    """Arquivo que a tarefa cria ou corrige: primeiro caminho .py/.json do cartao fora de tests/ (prefere o que ainda nao existe)."""
    caminhos = [c for c in re.findall(r"`([\w./\\-]+\.(?:py|json))`", texto) if "/" in c and not c.startswith("tests/")]
    novos = [c for c in caminhos if not (RAIZ / c).exists()]
    return (novos or caminhos or [None])[0]


def esqueleto(tarefa: str) -> int:
    id_ = tarefa.replace(".", "_")
    destino = RAIZ / "tests" / f"test_aceite_{id_}.py"
    if destino.exists():
        print(f"{destino.relative_to(RAIZ)} ja existe; nada feito.")
        return 1
    texto = cartao(tarefa)
    a = alvo(texto)
    regras = [s.strip() for s in re.split(r"(?<=[.;])\s+", re.sub(r"`", "", texto)) if len(s.strip()) > 8 and not s.strip().startswith("Testes em")]
    modulo = a[:-3].replace("/", ".") if a and a.endswith(".py") else None
    linhas = [f'"""Aceite da tarefa {tarefa} (escrito pelo Claude; quem executa a tarefa NAO deve alterar nem apagar).', "",
              f"Cartao: {texto}", "",
              "Enquanto a tarefa estiver [ ] no TASKS.md o aceite e pulado (o commit do molde passa no hook);",
              "a partir de [~] ele roda. O `aceite.py validar` forca a execucao (ACEITE_FORCAR=1).",
              '"""', "import os", "import re", "import unittest", "from pathlib import Path", "",
              f'TAREFA = "{tarefa}"', "",
              "",
              "def pendente() -> bool:",
              '    if os.environ.get("ACEITE_FORCAR"):',
              "        return False",
              '    tasks = Path(__file__).resolve().parents[1] / "TASKS.md"',
              '    texto = tasks.read_text(encoding="utf-8-sig") if tasks.exists() else ""',
              r'    linha = re.search(rf"^\|\s*{re.escape(TAREFA)}\s*\|.*$", texto, re.M)',
              '    return bool(linha) and linha.group(0).rstrip().endswith("[ ] |")',
              "", ""]
    linhas += ['@unittest.skipIf(pendente(), f"tarefa {TAREFA} ainda pendente")', "class Aceite(unittest.TestCase):"]
    linhas += ["    @classmethod", "    def setUpClass(cls):",
               "        # Importe AQUI (nao no topo): o arquivo alvo so existe depois da entrega."]
    linhas += [f"        # TODO, por exemplo: from {modulo} import funcao; cls.funcao = staticmethod(funcao)" if modulo
               else "        # TODO: importe o que o cartao pede e guarde em cls"]
    linhas += ["        pass", ""]
    for i, regra in enumerate(regras, 1):
        linhas += [f"    # Regra {i}: {regra}"]
    linhas += ["    def test_todo(self):", '        self.fail("TODO: um teste por regra do cartao (casos normais, de borda e de erro)")', "",
               "", 'if __name__ == "__main__":', "    unittest.main()", ""]
    destino.parent.mkdir(exist_ok=True)
    destino.write_text("\n".join(linhas), encoding="utf-8", newline="\n")
    print(f"Esqueleto criado em {destino.relative_to(RAIZ)} com {len(regras)} regras do cartao. Preencha os casos e rode `validar`.")
    return 0


def rodar_aceite(pasta: Path, id_: str) -> tuple[bool, str]:
    # ACEITE_FORCAR: no validar o aceite roda mesmo com a tarefa ainda "[ ]" no TASKS.md (ver o esqueleto)
    env = dict(os.environ, PYTHONPATH=str(pasta), PYTHONDONTWRITEBYTECODE="1", ACEITE_FORCAR="1")
    try:
        r = subprocess.run([sys.executable, "-m", "unittest", "discover", "-s", "tests", "-t", ".", "-p", f"test_aceite_{id_}.py"],
                           cwd=pasta, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        return False, f"TRAVOU (mais de {TIMEOUT} s; provavel loop infinito)"
    saida = (r.stdout + r.stderr).strip()
    resumo = " ".join(saida.splitlines()[-2:]) if saida else ""
    return r.returncode == 0, resumo


def validar(tarefa: str, referencia: Path | None, aceite: Path | None, mutantes: list[str]) -> int:
    id_ = tarefa.replace(".", "_")
    a = alvo(cartao(tarefa))
    if not a:
        sys.exit("O cartao nao cita o arquivo alvo entre crases (ex.: `sonda/tone.py`).")
    existente = RAIZ / a
    if referencia:
        ref_texto = referencia.read_text(encoding="utf-8-sig")
    elif existente.exists():
        ref_texto = existente.read_text(encoding="utf-8-sig")
    else:
        sys.exit(f"{a} nao existe no projeto: passe --referencia <arquivo> ou rode depois que a IA entregar.")
    partida = existente.read_text(encoding="utf-8-sig") if referencia and existente.exists() else None
    falhas = 0
    tmp = Path(tempfile.mkdtemp(prefix="aceite-"))
    try:
        proj = tmp / "p"
        shutil.copytree(RAIZ, proj, ignore=IGNORAR)
        (proj / "tests").mkdir(exist_ok=True)
        if aceite:
            shutil.copy(aceite, proj / "tests" / f"test_aceite_{id_}.py")
        if not (proj / "tests" / f"test_aceite_{id_}.py").exists():
            sys.exit(f"tests/test_aceite_{id_}.py nao existe (rode `esqueleto` ou use --aceite).")
        alvo_tmp = proj / a
        alvo_tmp.parent.mkdir(parents=True, exist_ok=True)

        def colocar(texto: str | None) -> None:
            if texto is None:
                alvo_tmp.unlink(missing_ok=True)
            else:
                alvo_tmp.write_text(texto, encoding="utf-8", newline="\n")

        print(f"Tarefa {tarefa}, alvo {a}")
        colocar(partida)
        ok, det = rodar_aceite(proj, id_)
        rotulo = "sem entrega" if partida is None else "codigo atual"
        print(f"  {rotulo:<12}: {'reprova (bom)' if not ok else 'PASSA  <-- o aceite nao detecta o defeito/falta'}  {det}")
        falhas += ok
        colocar(ref_texto)
        ok, det = rodar_aceite(proj, id_)
        print(f"  entrega     : {'PASSA (bom)' if ok else 'FALHA  <-- a entrega nao passa no aceite'}  {det}")
        falhas += not ok
        for m in mutantes:
            nome, _, resto = m.partition("|")
            velho, _, novo = resto.partition("|")
            if not velho or velho not in ref_texto:
                print(f"  mutante {nome}: trecho nao encontrado na referencia  <-- ajuste o mutante")
                falhas += 1
                continue
            colocar(ref_texto.replace(velho, novo, 1))
            ok, det = rodar_aceite(proj, id_)
            print(f"  mutante {nome:<28}: {'morto (bom)' if not ok else 'SOBREVIVEU  <-- aceite nao pega esse defeito'}")
            falhas += ok
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("TUDO OK: o aceite discrimina." if not falhas else f"{falhas} problema(s): corrija o aceite ou o cartao antes de delegar.")
    return 1 if falhas else 0


def main() -> int:
    utf8()
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    e = sub.add_parser("esqueleto")
    e.add_argument("tarefa")
    v = sub.add_parser("validar")
    v.add_argument("tarefa")
    v.add_argument("--referencia", type=Path)
    v.add_argument("--aceite", type=Path)
    v.add_argument("--mutante", action="append", default=[], help='"nome|trecho|troca" (repita a opcao)')
    a = p.parse_args()
    return esqueleto(a.tarefa) if a.cmd == "esqueleto" else validar(a.tarefa, a.referencia, a.aceite, a.mutante)


if __name__ == "__main__":
    sys.exit(main())
