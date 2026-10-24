"""Tamanho da conversa: avisa antes do auto compact e instala os hooks do kit no .claude/settings.json.

Uso:
  python .ia/contexto.py --hook       # chamado pelos hooks UserPromptSubmit e PreCompact (lê o JSON do hook na entrada)
  python .ia/contexto.py --instalar   # junta os hooks do kit ao .claude/settings.json (mantém o que já existe)
  python .ia/contexto.py --remover    # tira só os hooks do kit (apaga o arquivo se ficar vazio)

Limites no .ia/config.json: "contexto_janela" (tokens; padrão 1000000), "contexto_aviso" (% para avisar; padrão 60) e
"contexto_parar" (% para só fechar e passar o turno; padrão 80). O hook nunca falha: qualquer erro vira silêncio.
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SETTINGS = RAIZ / ".claude" / "settings.json"
MARCA_COMPACTOU = RAIZ / ".git" / "ia-compactou"  # dentro de .git: nunca vai para um commit
AVISO_COMPACTOU = ("A conversa foi compactada (contexto cheio). Antes de continuar: escreva a passagem (/passar) e "
                   "sugira ao dono abrir um chat novo (o resumo chega sozinho pelo hook de início de sessão).")
PADRAO = {"contexto_janela": 1_000_000, "contexto_aviso": 60, "contexto_parar": 80}
FIM_TRANSCRIPT = 2 * 1024 * 1024  # bytes do fim do transcript lidos pelo hook (sobram várias respostas recentes)
# Caminho absoluto: o hook roda na pasta atual da sessão, que pode ser uma subpasta do projeto. O Claude Code troca
# ${CLAUDE_PROJECT_DIR} pela raiz do projeto (e no Git Bash, que roda os hooks no Windows, ela também é variável de
# ambiente); entre aspas por causa de espaços no caminho.
RAIZ_HOOK = '"${CLAUDE_PROJECT_DIR}"/.ia/'
HOOKS_DO_KIT = {
    "SessionStart": {"matcher": "startup|clear", "hooks": [
        {"type": "command", "command": f"python {RAIZ_HOOK}passagem.py --resumo --hook", "timeout": 120}]},
    "UserPromptSubmit": {"hooks": [{"type": "command", "command": f"python {RAIZ_HOOK}contexto.py --hook", "timeout": 30}]},
    "PreCompact": {"matcher": "auto", "hooks": [
        {"type": "command", "command": f"python {RAIZ_HOOK}contexto.py --hook", "timeout": 30}]},
    # Trava de segurança (.ia/guarda.py): nega ou pede confirmação antes de comando ou edição arriscada
    "PreToolUse": {"matcher": "Bash|PowerShell|Edit|Write|MultiEdit|NotebookEdit", "hooks": [
        {"type": "command", "command": f"python {RAIZ_HOOK}guarda.py --hook", "timeout": 10}]},
}


def limites() -> dict:
    try:
        cfg = json.loads((RAIZ / ".ia" / "config.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        cfg = {}
    return {k: cfg.get(k, v) for k, v in PADRAO.items()}


def contexto_atual(transcript: str) -> int:
    """Tokens de entrada da última resposta da conversa principal (subagentes não contam).

    Lê só o fim do arquivo (FIM_TRANSCRIPT bytes): a conversa longa tem milhões de linhas e o hook roda a cada mensagem.
    """
    ultimo = 0
    with open(transcript, "rb") as f:
        f.seek(0, 2)
        tamanho = f.tell()
        f.seek(max(0, tamanho - FIM_TRANSCRIPT))
        bruto = f.read()
    if tamanho > FIM_TRANSCRIPT:
        bruto = bruto.split(b"\n", 1)[-1]  # a 1ª linha lida pode estar cortada no meio
    for linha in bruto.decode("utf-8", errors="replace").splitlines():
        try:
            o = json.loads(linha)
        except ValueError:
            continue
        msg = o.get("message") if isinstance(o, dict) else None
        if not isinstance(msg, dict) or o.get("isSidechain") or not msg.get("usage"):
            continue
        u = msg["usage"]
        total = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
        if total:
            ultimo = total
    return ultimo


def hook() -> int:
    try:
        dados = json.loads(sys.stdin.read() or "{}")
        evento = dados.get("hook_event_name", "")
        if evento == "PreCompact":
            # A saída do PreCompact pode não chegar ao modelo: deixa uma marca, e o próximo UserPromptSubmit avisa
            if MARCA_COMPACTOU.parent.is_dir():
                MARCA_COMPACTOU.write_text("1", encoding="utf-8")
            print(AVISO_COMPACTOU)
            return 0
        if MARCA_COMPACTOU.exists():
            MARCA_COMPACTOU.unlink()
            print(AVISO_COMPACTOU)
            return 0
        lim = limites()
        usados = contexto_atual(dados.get("transcript_path", ""))
        pct = 100 * usados / max(int(lim["contexto_janela"]), usados, 1)
        n = f"{usados:,}".replace(",", ".")
        if pct >= lim["contexto_parar"]:
            print(f"CONTEXTO EM {pct:.0f}% ({n} tokens): não comece tarefa nova. Termine só o passo atual, "
                  "commite, rode /passar e peça ao dono para abrir um chat novo.")
        elif pct >= lim["contexto_aviso"]:
            print(f"Contexto em {pct:.0f}% ({n} tokens): ao terminar a tarefa atual, rode /passar e sugira ao dono "
                  "abrir um chat novo antes do auto compact.")
    except Exception:  # o hook nunca pode atrapalhar a conversa
        pass
    return 0


def ler_settings() -> dict | None:
    """{} se o arquivo não existe; None se existe mas não dá para entender com segurança (aí ninguém mexe nele)."""
    if not SETTINGS.exists():
        return {}
    try:
        d = json.loads(SETTINGS.read_text(encoding="utf-8-sig"))  # -sig: arquivo gravado pelo PowerShell vem com BOM
    except (OSError, ValueError):
        return None
    if not isinstance(d, dict) or not isinstance(d.get("hooks", {}), dict):
        return None
    if any(not isinstance(v, list) for v in d.get("hooks", {}).values()):
        return None
    return d


def gravar_settings(d: dict) -> None:
    SETTINGS.parent.mkdir(exist_ok=True)
    SETTINGS.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


# Trechos que identificam um hook do kit em qualquer versão (com caminho relativo, como até a 4.13, ou absoluto)
TRECHOS_DO_KIT = (".ia/passagem.py --resumo --hook", ".ia/contexto.py --hook", ".ia/guarda.py --hook")


def do_kit(entrada) -> bool:
    """Só os hooks do kit (qualquer versão): um hook do dono em .ia/ (ex.: python .ia/meu_hook.py) não é tocado."""
    return isinstance(entrada, dict) and isinstance(entrada.get("hooks"), list) and any(
        isinstance(h, dict) and any(t in str(h.get("command", "")).replace("\\", "/") for t in TRECHOS_DO_KIT)
        for h in entrada["hooks"])


def instalar() -> int:
    existia = SETTINGS.exists()
    d = ler_settings()
    if d is None:
        print("!! .claude/settings.json não pôde ser lido com segurança (JSON inválido ou formato inesperado): não foi "
              "alterado. Junte os hooks à mão (ver HOOKS_DO_KIT em .ia/contexto.py).")
        return 1
    hooks = d.setdefault("hooks", {})
    novos = []
    for evento, entrada in HOOKS_DO_KIT.items():
        lista = [e for e in hooks.get(evento, []) if not do_kit(e)]  # troca a versão antiga do kit pela atual
        hooks[evento] = lista + [entrada]
        novos.append(evento)
    gravar_settings(d)
    print(f"Hooks do kit em .claude/settings.json: {', '.join(novos)}" + (" (outras configurações mantidas)" if existia else ""))
    return 0


def remover() -> int:
    if not SETTINGS.exists():
        return 0
    d = ler_settings()
    if d is None:
        print("!! .claude/settings.json não pôde ser lido com segurança: não foi alterado. Tire à mão os hooks do kit "
              "(comandos python .ia/passagem.py --resumo --hook e python .ia/contexto.py --hook), se houver.")
        return 0
    antes = json.dumps(d, sort_keys=True)
    hooks = d.get("hooks", {})
    for evento in list(hooks):
        hooks[evento] = [e for e in hooks[evento] if not do_kit(e)]
        if not hooks[evento]:
            del hooks[evento]
    if not hooks:
        d.pop("hooks", None)
    if json.dumps(d, sort_keys=True) == antes:
        return 0  # nada do kit ali: não regrava (preserva BOM e formatação do dono)
    if d:
        gravar_settings(d)
        print("Hooks do kit retirados de .claude/settings.json (outras configurações mantidas)")
    else:
        SETTINGS.unlink()
        print("Removido .claude/settings.json (só tinha os hooks do kit)")
    return 0


def main() -> int:
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    if "--hook" in sys.argv:
        return hook()
    if "--instalar" in sys.argv:
        return instalar()
    if "--remover" in sys.argv:
        return remover()
    print(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main())
