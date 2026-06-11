"""
AbletonMind — Remote Script (Phase 0 Spike).

Live loads this package as a Control Surface when the user selects
"AbletonMind" in Preferences → Link/Tempo/MIDI → Control Surface.

Entrypoint required by Live: `create_instance(c_instance)` function.

In headless mode (imported outside Live for tests), `_Framework` is not
available. We therefore do a conditional import: if `_Framework` fails, we
still expose `BridgeServer` / `schemas` / `handlers` for the tests.
"""
import os

from .bridge import BridgeServer, DEFAULT_HOST, DEFAULT_PORT

__all__ = ["BridgeServer", "create_instance", "AbletonMind"]

try:  # pragma: no cover - importable only inside Live
    from _Framework.ControlSurface import ControlSurface

    from .listeners import ListenerManager

    class AbletonMind(ControlSurface):
        """Root ControlSurface. Spins up `BridgeServer` on a daemon thread and
        installs LiveAPI listeners that become MCP notifications (Phase 2)."""

        def __init__(self, c_instance):
            super().__init__(c_instance)
            with self.component_guard():
                host = os.environ.get("ABLETON_MIND_HOST", DEFAULT_HOST)
                port = int(os.environ.get("ABLETON_MIND_PORT", str(DEFAULT_PORT)))
                allow_remote = os.environ.get("ABLETON_MIND_ALLOW_REMOTE") == "1"
                self.bridge = BridgeServer(
                    self, host=host, port=port, allow_remote=allow_remote
                )
                self.bridge.start()
                self.listeners = ListenerManager(self, self.bridge.broadcast)
                self.listeners.setup()
                self.log_message(
                    "AbletonMind started on {}:{}".format(host, port)
                )

        def disconnect(self):
            try:
                if getattr(self, "listeners", None) is not None:
                    self.listeners.teardown()
            except Exception:
                pass
            try:
                self.bridge.stop()
            finally:
                super().disconnect()

    def create_instance(c_instance):
        return AbletonMind(c_instance)

except Exception:  # pragma: no cover - outside Live
    AbletonMind = None  # type: ignore

    def create_instance(c_instance):  # pragma: no cover
        raise RuntimeError("AbletonMind requires Ableton Live runtime (_Framework missing)")
