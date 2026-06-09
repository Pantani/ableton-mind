"""
AbletonMind — Remote Script (Phase 0 Spike).

O Live carrega este pacote como Control Surface quando o usuário seleciona
"AbletonMind" em Preferences → Link/Tempo/MIDI → Control Surface.

Entrypoint exigido pelo Live: função `create_instance(c_instance)`.

Em modo headless (importado fora do Live para testes), `_Framework` não está
disponível. Por isso, fazemos import condicional: se `_Framework` falhar,
ainda expomos `BridgeServer` / `schemas` / `handlers` para os testes.
"""
import os

from .bridge import BridgeServer, DEFAULT_HOST, DEFAULT_PORT

__all__ = ["BridgeServer", "create_instance", "AbletonMind"]

try:  # pragma: no cover - importável só dentro do Live
    from _Framework.ControlSurface import ControlSurface

    from .listeners import ListenerManager

    class AbletonMind(ControlSurface):
        """ControlSurface root. Sobe o `BridgeServer` num thread daemon e
        instala listeners LiveAPI que viram MCP notifications (Phase 2)."""

        def __init__(self, c_instance):
            super().__init__(c_instance)
            with self.component_guard():
                host = os.environ.get("ABLETON_MIND_HOST", DEFAULT_HOST)
                port = int(os.environ.get("ABLETON_MIND_PORT", str(DEFAULT_PORT)))
                self.bridge = BridgeServer(self, host=host, port=port)
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

except Exception:  # pragma: no cover - fora do Live
    AbletonMind = None  # type: ignore

    def create_instance(c_instance):  # pragma: no cover
        raise RuntimeError("AbletonMind requires Ableton Live runtime (_Framework missing)")
