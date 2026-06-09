"""
Handlers de sistema: handshake e health check.

`system.hello` é a primeira mensagem que o cliente envia; o bridge não impõe
ordem na Phase 0 (qualquer método responde), mas o cliente TS faz o hello
sempre primeiro para descobrir versões.
"""
import json
import os
import sys
import time

from ..schemas import HelloInput, PingInput
from ._base import Handler, register

PROTOCOL_VERSION = "0.1"
BRIDGE_NAME = "ableton-mind/python"


def _read_pkg_version() -> str:
    """Lê `version` do `package.json` do repo (TD-046).

    Caminho: `<this>/handlers/system.py` → `<this>/../../package.json` = repo root.
    Em runtime instalado via DXT, o package.json pode não estar empacotado;
    nesse caso devolve "0.0.0+unknown" para sinalizar que o stub está ativo
    (vs "0.0.0" que indicaria que Live API falhou).
    """
    try:
        here = os.path.dirname(os.path.abspath(__file__))
        # handlers/system.py → AbletonMind/ → live/ → repo root
        pkg_path = os.path.join(here, "..", "..", "..", "package.json")
        with open(pkg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        v = str(data.get("version", "0.0.0"))
        return v if v else "0.0.0"
    except Exception:
        return "0.0.0+unknown"


# Cache no module load — package.json não muda em runtime.
BRIDGE_VERSION = _read_pkg_version()


def _live_version() -> str:
    """TD-047: tenta múltiplos paths da Live API.

    Live 11+ documenta `Application.get_major_version()`, `get_minor_version()`,
    `get_bugfix_version()`. Algumas builds expõem `get_major_minor_patch_version()`
    como tupla. Tentamos os dois.

    Em testes (sem módulo `Live`), devolve "0.0.0".
    """
    try:  # pragma: no cover - somente Live real
        import Live  # type: ignore

        app = Live.Application.get_application()

        # Path 1: 3 getters separados (oficial Live 11+).
        try:
            major = int(app.get_major_version())
            minor = int(app.get_minor_version())
            bugfix = int(app.get_bugfix_version())
            return f"{major}.{minor}.{bugfix}"
        except Exception:
            pass

        # Path 2: tupla (algumas builds).
        try:
            t = app.get_major_minor_patch_version()
            if isinstance(t, (list, tuple)) and len(t) >= 3:
                return f"{int(t[0])}.{int(t[1])}.{int(t[2])}"
        except Exception:
            pass

        # Path 3: get_version_string() (raro).
        try:
            s = app.get_version_string()
            if isinstance(s, str) and s:
                return s
        except Exception:
            pass

        return "0.0.0"
    except Exception:
        return "0.0.0"


def _python_version() -> str:
    v = sys.version_info
    return f"{v.major}.{v.minor}.{v.micro}"


@register("system.hello")
class HelloHandler(Handler):
    INPUT = HelloInput

    def execute(self, params: HelloInput) -> dict:
        return {
            "bridge": BRIDGE_NAME,
            "version": BRIDGE_VERSION,
            "live_version": _live_version(),
            "python_version": _python_version(),
            "protocol_version": PROTOCOL_VERSION,
        }


@register("system.ping")
class PingHandler(Handler):
    INPUT = PingInput

    def execute(self, params: PingInput) -> dict:
        return {"pong": True, "ts": int(time.time() * 1000)}
