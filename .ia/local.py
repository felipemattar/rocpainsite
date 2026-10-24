"""IA local (opcional): diz se ela pode receber tarefas agora.

Uso: python .ia/local.py status
Usado pelo Claude no /planejar (escolha do executor) e pelo ia-rodar.ps1 antes de rodar uma tarefa.
Configuração opcional em .ia/config.json:
    "ia_local": {"usar": "auto", "modelo": "llama-local/qwen3-coder", "url": "http://127.0.0.1:8080"}
"usar": "nunca" desliga a IA local neste projeto. Sem o bloco, vale "auto". A URL do servidor vem, nesta ordem, de "url" no config,
do `baseURL` do provedor do `modelo` no opencode.json global do OpenCode (a porta que você já configurou lá) ou de http://127.0.0.1:8080.

Saída de uma linha. Código de saída: 0 = VIÁVEL; 1 = instalada, mas o servidor está fora do ar;
2 = não disponível neste projeto/máquina (desligada, sem OpenCode ou sem as peças do kit).
"""
import json
import os
import shutil
import sys
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PADRAO = {"usar": "auto", "modelo": "llama-local/qwen3-coder"}
URL_PADRAO = "http://127.0.0.1:8080"


def utf8() -> None:
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass


def url_do_opencode(modelo: str) -> str | None:
    """baseURL (sem /v1) do provedor do modelo, lido do opencode.json global do OpenCode."""
    pasta = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    arq = Path(pasta) / "opencode" / "opencode.json"
    try:
        dados = json.loads(arq.read_text(encoding="utf-8-sig"))
        base = dados["provider"][modelo.split("/")[0]]["options"]["baseURL"]
    except (OSError, ValueError, KeyError, TypeError):
        return None
    return str(base).rstrip("/").removesuffix("/v1")


def config() -> dict:
    arq = RAIZ / ".ia" / "config.json"
    dados = json.loads(arq.read_text(encoding="utf-8-sig")) if arq.exists() else {}
    cfg = {**PADRAO, **(dados.get("ia_local") or {})}
    cfg["url"] = cfg.get("url") or url_do_opencode(cfg["modelo"]) or URL_PADRAO
    return cfg


def opencode() -> str | None:
    achado = shutil.which("opencode")
    if achado:
        return achado
    desktop = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "@opencodedesktop" / "resources" / "opencode-cli.exe"
    return str(desktop) if os.environ.get("LOCALAPPDATA") and desktop.exists() else None


def servidor_no_ar(url: str) -> bool:
    """llama-server responde em /health; outros servidores compatíveis com OpenAI, em /v1/models."""
    abrir = urllib.request.build_opener(urllib.request.ProxyHandler({})).open  # localhost: nunca pelo proxy
    for caminho in ("/health", "/v1/models"):
        try:
            with abrir(url.rstrip("/") + caminho, timeout=2) as r:
                if r.status == 200:
                    return True
        except Exception:
            continue
    return False


def status() -> int:
    try:
        cfg = config()
    except (OSError, ValueError, TypeError, AttributeError) as e:
        # sem isto o erro saía com código 1, lido como "servidor fora do ar" pelo ia-rodar.ps1
        print(f"IA local: NÃO DISPONÍVEL — .ia/config.json inválido ({e}); corrija o arquivo.")
        return 2
    if str(cfg["usar"]).lower() == "nunca":
        print('IA local: NÃO DISPONÍVEL — desligada neste projeto ("ia_local": {"usar": "nunca"} no .ia/config.json).')
        return 2
    faltam = [a for a in ("fechar.py", "aceite.py") if not (RAIZ / ".ia" / a).exists()]
    if faltam:
        print(f"IA local: NÃO DISPONÍVEL — faltam peças do kit em .ia/ ({', '.join(faltam)}); rode o atualizar-projetos.ps1.")
        return 2
    if not opencode():
        print("IA local: NÃO DISPONÍVEL — OpenCode CLI não encontrado nesta máquina.")
        return 2
    if not servidor_no_ar(cfg["url"]):
        print(f"IA local: FORA DO AR — nada responde em {cfg['url']} (ligue o llama-server para usá-la).")
        return 1
    print(f"IA local: VIÁVEL — {cfg['modelo']} em {cfg['url']}. Regras de uso em .ia/delegacao.md.")
    return 0


def main() -> int:
    utf8()
    if sys.argv[1:] != ["status"]:
        print(__doc__.strip())
        return 2
    return status()


if __name__ == "__main__":
    sys.exit(main())
