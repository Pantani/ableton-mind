"""
Registry global de handlers + classe base.

Handlers se registram via decorador `@register("domain.verb")`. O dispatcher
do bridge usa este dicionário para roteamento.

A classe `Handler` tem só duas responsabilidades:
- expor `self.song` (acesso conveniente, re-resolvido a cada call)
- declarar `INPUT` (dataclass que parseia `params`)

`execute(params)` deve retornar um dict pronto pra virar `result` JSON-RPC.
Para sinalizar erro estruturado, levanta `RpcError`.
"""
from typing import Dict, Type

REGISTRY: Dict[str, Type["Handler"]] = {}


def register(method: str):
    """Decorador para registrar um handler num método JSON-RPC."""

    def deco(cls):
        if method in REGISTRY:
            # Idempotente em reloads de módulo (Live re-carrega o script às vezes).
            REGISTRY[method] = cls
        else:
            REGISTRY[method] = cls
        cls.METHOD = method
        return cls

    return deco


class Handler:
    """Base. Subclasses definem `INPUT` (dataclass) e `execute(params)`."""

    INPUT = None  # type: ignore
    METHOD: str = ""

    def __init__(self, ctrl):
        # `ctrl` é o ControlSurface (ou um stub nos testes). Precisa expor
        # `.song()` que devolve um objeto compatível com `Live.Song.Song`.
        self.ctrl = ctrl

    @property
    def song(self):
        return self.ctrl.song()

    def execute(self, params) -> dict:  # pragma: no cover - abstrato
        raise NotImplementedError
