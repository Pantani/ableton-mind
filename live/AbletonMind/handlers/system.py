"""
System handlers: handshake and health check.

`system.hello` is the first message the client sends; the bridge doesn't
enforce ordering in Phase 0 (any method responds), but the TS client always
does the hello first to discover versions.
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
    """Reads `version` from the repo's `package.json` (TD-046).

    Path: `<this>/handlers/system.py` → `<this>/../../package.json` = repo root.
    In a DXT-installed runtime, package.json may not be bundled; in that case
    we return "0.0.0+unknown" to signal the stub is active (vs "0.0.0" which
    would indicate that the Live API failed).
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


# Cache at module load — package.json doesn't change at runtime.
BRIDGE_VERSION = _read_pkg_version()


def _live_version() -> str:
    """TD-047: tries multiple Live API paths.

    Live 11+ documents `Application.get_major_version()`, `get_minor_version()`,
    `get_bugfix_version()`. Some builds expose `get_major_minor_patch_version()`
    as a tuple. We try both.

    In tests (no `Live` module), returns "0.0.0".
    """
    try:  # pragma: no cover - real Live only
        import Live  # type: ignore

        app = Live.Application.get_application()

        # Path 1: 3 separate getters (official Live 11+).
        try:
            major = int(app.get_major_version())
            minor = int(app.get_minor_version())
            bugfix = int(app.get_bugfix_version())
            return f"{major}.{minor}.{bugfix}"
        except Exception:
            pass

        # Path 2: tuple (some builds).
        try:
            t = app.get_major_minor_patch_version()
            if isinstance(t, (list, tuple)) and len(t) >= 3:
                return f"{int(t[0])}.{int(t[1])}.{int(t[2])}"
        except Exception:
            pass

        # Path 3: get_version_string() (rare).
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
