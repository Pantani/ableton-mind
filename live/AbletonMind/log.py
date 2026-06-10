"""
Structured logger. In production (inside Live) we call
`ControlSurface.log_message` with JSON. Outside Live (tests) we fall back to
stderr but keep the same schema for external parsing.
"""
import json
import sys
import time
from typing import Any, Optional


class StructuredLogger:
    """Thin wrapper over `ControlSurface.log_message`.

    Always serializes to a single JSON line; Live's Log.txt is grep-friendly.
    """

    def __init__(self, sink=None, component: str = "ableton-mind"):
        # `sink` is the ControlSurface (has `.log_message(str)`). May be None in tests.
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
        # Fallback outside Live
        print(line, file=sys.stderr)

    def info(self, event: str, **fields: Any) -> None:
        self._emit("info", event, fields)

    def warn(self, event: str, **fields: Any) -> None:
        self._emit("warn", event, fields)

    def error(self, event: str, **fields: Any) -> None:
        self._emit("error", event, fields)
