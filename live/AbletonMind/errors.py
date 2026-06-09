"""
Códigos de erro JSON-RPC do ableton-mind.

Fonte: _workspace/contracts/jsonrpc.md (faixa custom -32000..-32099).

`RpcError` é a exceção interna que os handlers levantam. O dispatcher do bridge
captura e serializa no envelope JSON-RPC 2.0.
"""
from typing import Any, Optional


# Reservados JSON-RPC (padrão da spec)
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603

# Custom ableton-mind
LIVE_NOT_RUNNING = -32000
LIVE_API_CALL_FAILED = -32001
OBJECT_NOT_FOUND = -32002
TYPE_MISMATCH = -32003
OUT_OF_RANGE = -32004
INVALID_STATE = -32005
TRANSACTION_ERROR = -32006
LISTENER_ERROR = -32007
KNOWLEDGE_LOOKUP_FAILED = -32008


class RpcError(Exception):
    """Erro estruturado convertido em envelope JSON-RPC pelo bridge."""

    def __init__(self, code: int, message: str, data: Optional[Any] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data

    def to_dict(self) -> dict:
        out = {"code": self.code, "message": self.message}
        if self.data is not None:
            out["data"] = self.data
        return out
