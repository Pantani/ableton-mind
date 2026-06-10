"""
Global handler registry + base class.

Handlers register via the `@register("domain.verb")` decorator. The bridge
dispatcher uses this dictionary for routing.

The `Handler` class has only two responsibilities:
- expose `self.song` (convenience accessor, re-resolved per call)
- declare `INPUT` (dataclass that parses `params`)

`execute(params)` must return a dict ready to become a JSON-RPC `result`.
To signal a structured error, raise `RpcError`.
"""
from typing import Dict, Type

REGISTRY: Dict[str, Type["Handler"]] = {}


def register(method: str):
    """Decorator to register a handler for a JSON-RPC method."""

    def deco(cls):
        if method in REGISTRY:
            # Idempotent on module reloads (Live reloads the script occasionally).
            REGISTRY[method] = cls
        else:
            REGISTRY[method] = cls
        cls.METHOD = method
        return cls

    return deco


class Handler:
    """Base. Subclasses define `INPUT` (dataclass) and `execute(params)`."""

    INPUT = None  # type: ignore
    METHOD: str = ""

    def __init__(self, ctrl):
        # `ctrl` is the ControlSurface (or a stub in tests). Must expose
        # `.song()` returning an object compatible with `Live.Song.Song`.
        self.ctrl = ctrl

    @property
    def song(self):
        return self.ctrl.song()

    def execute(self, params) -> dict:  # pragma: no cover - abstract
        raise NotImplementedError
