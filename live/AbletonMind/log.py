"""
Logger estruturado. Em produção (dentro do Live) chamamos
`ControlSurface.log_message` com JSON. Fora do Live (testes), caímos no stderr
mas mantemos o mesmo schema para parsing externo.
"""
import json
import sys
import time
from typing import Any, Optional


class StructuredLogger:
    """Wrapper fino sobre `ControlSurface.log_message`.

    Sempre serializa para JSON de uma linha; o Log.txt do Live é grep-friendly.
    """

    def __init__(self, sink=None, component: str = "ableton-mind"):
        # `sink` é o ControlSurface (tem `.log_message(str)`). Pode ser None em testes.
        self._sink = sink
        self._component = component

    def _emit(self, level: str, event: str, fields: Optional[dict] = None) -> None:
        payload = {
            "ts": int(time.time() * 1000),
            "level": level,
            "component": self._component,
            "event": event,
        }
        if fields:
            payload.update(fields)
        line = json.dumps(payload, ensure_ascii=False, default=str)
        if self._sink is not None and hasattr(self._sink, "log_message"):
            try:
                self._sink.log_message(line)
                return
            except Exception:
                pass
        # Fallback fora do Live
        print(line, file=sys.stderr)

    def info(self, event: str, **fields: Any) -> None:
        self._emit("info", event, fields)

    def warn(self, event: str, **fields: Any) -> None:
        self._emit("warn", event, fields)

    def error(self, event: str, **fields: Any) -> None:
        self._emit("error", event, fields)
