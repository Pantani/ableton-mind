"""
Handlers de sistema: handshake e health check.

`system.hello` é a primeira mensagem que o cliente envia; o bridge não impõe
ordem na Phase 0 (qualquer método responde), mas o cliente TS faz o hello
sempre primeiro para descobrir versões.
"""
import sys
import time

from ..schemas import HelloInput, PingInput
from ._base import Handler, register

PROTOCOL_VERSION = "0.1"
BRIDGE_NAME = "ableton-mind/python"
BRIDGE_VERSION = "0.0.1"


def _live_version() -> str:
    """Best effort: tenta `Live.Application.get_application().get_major_minor_patch_version()`.
    Em testes (sem `Live`), devolve "0.0.0"."""
    try:  # pragma: no cover - somente Live real
        import Live  # type: ignore

        app = Live.Application.get_application()
        major, minor, patch = app.get_major_minor_patch_version()
        return f"{major}.{minor}.{patch}"
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
