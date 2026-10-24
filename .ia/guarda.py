"""Trava de segurança do kit: hook PreToolUse do Claude Code que nega ou pede confirmação antes de ações arriscadas.

Uso: python .ia/guarda.py --hook   (lê o JSON do hook na entrada; instalado por .ia/contexto.py --instalar)

Nega: push forçado, rm -rf, Remove-Item -Recurse -Force, git reset --hard e git clean -f (apagam trabalho ou dados).
Pergunta: editar .env, chaves (.pem, .key, id_rsa), secrets/ e CLAUDE.local.md; apagar recursivo sem -f; apagar no E:.
Permite o resto (sem saída). Nunca falha: erro ou entrada estranha vira "permite" e código 0.
Ideia do ai-agent-handoff (MIT); código próprio, sem dependência. É um cinto de segurança, não um sandbox.
"""
import json
import re
import sys
from pathlib import PurePath

# Um comando simples: sem ; & | nem quebra de linha. O "git" pode ter opções antes do subcomando (git -C pasta push).
# Tudo é limitado (400 caracteres): entrada enorme não pode estourar o tempo do hook (10 s), que deixaria o comando passar
CMD = r"[^;&|\n]{0,400}"
LINHA = r"[^\n]{0,400}"
NEGA = [
    ("push forçado reescreve o histórico do remoto",
     re.compile(rf"\bgit\b{CMD}\bpush\b{CMD}\s(--force(-with-lease)?\b|-\w*f\w*\b|\+\S)")),
    ("rm -rf apaga sem volta",
     re.compile(rf"(?<![\w-])rm\b(?={CMD}\s(-\w*r\w*|--recursive)\b)(?={CMD}\s(-\w*f\w*|--force)\b)", re.I)),
    ("Remove-Item -Recurse -Force apaga sem volta",
     re.compile(rf"(?<![\w-])(Remove-Item|rm|del|ri)\b(?={LINHA}\s-Recurse\b)(?={LINHA}\s-Force\b)", re.I)),
    ("git reset --hard descarta mudanças não commitadas", re.compile(rf"\bgit\b{CMD}\breset\b{CMD}\s--hard\b")),
    ("git clean -f apaga arquivos não versionados",
     re.compile(rf"\bgit\b{CMD}\bclean\b{CMD}\s(-\w*f|--force\b)")),
]
PERGUNTA_COMANDO = [
    ("apagar recursivo",
     re.compile(rf"(?<![\w-])rm\b{CMD}\s(-\w*r|--recursive\b)|\b(rmdir|rd)\s+/s\b|\bRemove-Item\b{LINHA}\s-Recurse\b", re.I)),
    ("apagar no E: (dados do dono)",
     re.compile(rf"\b(rm|del|erase|rmdir|rd|Remove-Item|ri|Move-Item|mv)\b{LINHA}\b[Ee]:[\\/]")),
]
# Comando que executa o texto que recebe: com ele o texto entre aspas conta.
# Opções (` -c `, `node -e`): testadas no comando inteiro, como na versão antiga, para valer com qualquer programa
# (sh, ash, flock, runuser, powershell com opções antes do -c...) e mesmo dentro de aspas (ssh host "bash -c ...").
# Palavras (eval, iex, powershell "..."): testadas já sem o texto entre aspas, para citar "eval" numa mensagem de commit
# não ligar a checagem. Heredoc não recebe tratamento: o corpo é sempre checado.
EXECUTA_OPCAO = re.compile(r"\s-c\s|[\s\"']-(Command|EncodedCommand)\b|(?<![\w.-])(ba|z|da|k)?sh(\.exe)?\b[^\n]{0,100}\s-\w*c\s|(?<![\w.-])(node|perl|ruby|php)(\.exe)?\b[^\n]{0,100}\s-e\s")
EXECUTA_TEXTO = re.compile(r"(\bcmd(\.exe)?\s+/[ck]\b|(?<![\w.-])(powershell|pwsh)(\.exe)?\s+(-\w+\s+){0,5}['\"]"
                           r"|\biex\b|\bInvoke-Expression\b|\beval\b)", re.I)
ARQUIVOS_SENSIVEIS =re.compile(r"(^|/)(\.env[^/]*|id_rsa[^/]*|id_ed25519[^/]*|[^/]+\.(pem|key|pfx|p12)|CLAUDE\.local\.md)$"
                                r"|(^|/)secrets?/", re.I)


def decidir(entrada: dict) -> tuple[str, str]:
    """("deny" | "ask" | "", motivo) para o tool_input do hook."""
    dados = entrada.get("tool_input") or {}
    comando = str(dados.get("command") or "")
    # Texto entre aspas é argumento (mensagem de commit, --cuidado da passagem) que pode citar "rm -rf" sem rodá-lo;
    # só conta quando o comando executa o texto (bash -c, powershell -Command, iex, eval)
    sem_aspas = re.sub(r"\"[^\"]*\"|'[^']*'", "''", comando)
    if not (EXECUTA_OPCAO.search(comando) or EXECUTA_TEXTO.search(sem_aspas)):
        comando = sem_aspas
    if comando:
        for motivo, padrao in NEGA:
            if padrao.search(comando):
                return "deny", f"Bloqueado pela trava do kit: {motivo}. Se precisar mesmo, peça ao dono para rodar à mão."
        for motivo, padrao in PERGUNTA_COMANDO:
            if padrao.search(comando):
                return "ask", f"Trava do kit: {motivo}; confirme antes."
    caminho = str(dados.get("file_path") or dados.get("notebook_path") or "")
    if caminho and ARQUIVOS_SENSIVEIS.search(PurePath(caminho.replace("\\", "/")).as_posix()):
        return "ask", "Trava do kit: arquivo sensível (segredo, chave ou dado local do dono); confirme antes."
    return "", ""


def hook() -> int:
    try:
        # lstrip: o PowerShell pode mandar a entrada com BOM, e o json.loads falharia (e a trava "permitiria" calada)
        decisao, motivo = decidir(json.loads(sys.stdin.read().lstrip("﻿") or "{}"))
    except Exception:  # noqa: BLE001 (o hook nunca pode atrapalhar a conversa)
        return 0
    if decisao:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": decisao,
                                                 "permissionDecisionReason": motivo}}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    for fluxo in (sys.stdin, sys.stdout):
        try:
            fluxo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    sys.exit(hook() if "--hook" in sys.argv else (print(__doc__) or 2))
