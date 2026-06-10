"""
ableton-mind JSON-RPC error codes.

Source: _workspace/contracts/jsonrpc.md (custom range -32000..-32099).

`RpcError` is the internal exception handlers raise. The bridge dispatcher
catches it and serializes it into the JSON-RPC 2.0 envelope.
"""
from typing import Any, Optional


# JSON-RPC reserved (spec standard)
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
    """Structured error converted into a JSON-RPC envelope by the bridge."""

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
