"""
TCP NDJSON server + dispatcher JSON-RPC 2.0.

# Threading

LiveAPI **só pode ser tocada no main thread do Live**. Por isso:

- Socket TCP roda em thread daemon (`_serve` aceita; cada conexão em thread).
- Cada request lida do socket vai para `_call_queue` (FIFO multi-producer).
- Um `schedule_message(50, _drain_queue)` registrado pelo ControlSurface
  acorda o main thread do Live a cada ~50ms para drenar a fila e despachar
  os handlers (que tocam LiveAPI em segurança).
- A thread do socket bloqueia em `result_q.get(timeout=...)` esperando a
  resposta processada pelo main thread.

**Modo headless (testes/CLI)**: se nenhum ControlSurface é fornecido, o
`BridgeServer` despacha sincronamente no próprio thread. Útil para o smoke
test em mock e para qa-integration.

# Framing

NDJSON: cada mensagem é uma linha JSON terminada por `\n`. Implementação
segue jsonrpc.md §Transport.

# Erros

Mapeamento das exceções para códigos do contrato:
- `RpcError`           → usa código próprio
- `json.JSONDecodeError` → -32700 Parse error
- `TypeError` ao construir dataclass de input → -32602 Invalid params
- `KeyError` no REGISTRY → -32601 Method not found
- Qualquer outra exception → -32001 Live API call failed (com classname/str)
"""
import json
import queue
import socket
import threading
import time
from typing import Any, Optional

from .errors import (
    INTERNAL_ERROR,
    INVALID_PARAMS,
    INVALID_REQUEST,
    LIVE_API_CALL_FAILED,
    METHOD_NOT_FOUND,
    PARSE_ERROR,
    RpcError,
)
from .log import StructuredLogger

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 9876


class BridgeServer:
    def __init__(
        self,
        ctrl=None,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        *,
        headless: bool = False,
        logger: Optional[StructuredLogger] = None,
    ):
        """
        ctrl     — ControlSurface (`self.ctrl.song()`, `self.ctrl.schedule_message(...)`).
                   Em modo headless pode ser None.
        headless — quando True, dispatcha no próprio thread do socket. Útil para
                   testes e smoke fora do Live.
        """
        self.ctrl = ctrl
        self.host = host
        self.port = port
        self.headless = headless or ctrl is None
        self.log = logger or StructuredLogger(sink=ctrl)

        self._stop = threading.Event()
        self._call_queue: "queue.Queue[tuple[dict, queue.Queue]]" = queue.Queue()
        self._server_thread: Optional[threading.Thread] = None
        self._sock: Optional[socket.socket] = None
        self._drain_scheduled = False

        # Clients vivos para broadcast (TD-014). Lock para acesso multi-thread.
        self._clients: list = []
        self._clients_lock = threading.Lock()

        # Import dos handlers (popula REGISTRY)
        from . import handlers  # noqa: F401

    # ------------------------------------------------------------------ lifecycle

    def start(self) -> None:
        if self._server_thread and self._server_thread.is_alive():
            return  # idempotente
        self._stop.clear()
        self._server_thread = threading.Thread(
            target=self._serve, name="AbletonMindBridge", daemon=True
        )
        self._server_thread.start()
        if not self.headless and self.ctrl is not None and hasattr(self.ctrl, "schedule_message"):
            # Inicia o loop de drenagem no main thread do Live
            self._drain_scheduled = True
            self.ctrl.schedule_message(0, self._drain_queue)
        self.log.info("bridge_started", host=self.host, port=self.port, headless=self.headless)

    def stop(self) -> None:
        self._stop.set()
        if self._sock is not None:
            try:
                self._sock.close()
            except Exception:
                pass
        self.log.info("bridge_stopped")

    # ------------------------------------------------------------------ socket

    def _serve(self) -> None:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((self.host, self.port))
            sock.listen(5)
            sock.settimeout(0.5)
            self._sock = sock
        except Exception as exc:
            self.log.error("bind_failed", host=self.host, port=self.port, reason=str(exc))
            return

        while not self._stop.is_set():
            try:
                client, addr = sock.accept()
            except socket.timeout:
                continue
            except OSError:
                break
            self.log.info("client_connected", peer=f"{addr[0]}:{addr[1]}")
            threading.Thread(
                target=self._handle_client, args=(client,), daemon=True
            ).start()

        try:
            sock.close()
        except Exception:
            pass

    def _handle_client(self, client: socket.socket) -> None:
        client.settimeout(1.0)
        buffer = b""
        with self._clients_lock:
            self._clients.append(client)
        try:
            while not self._stop.is_set():
                try:
                    chunk = client.recv(4096)
                except socket.timeout:
                    continue
                if not chunk:
                    break
                buffer += chunk
                while b"\n" in buffer:
                    line, buffer = buffer.split(b"\n", 1)
                    if not line.strip():
                        continue
                    response = self._process_line(line)
                    if response is None:
                        # notification (no id) — não responde
                        continue
                    try:
                        client.sendall((json.dumps(response) + "\n").encode("utf-8"))
                    except OSError:
                        return
        finally:
            with self._clients_lock:
                try:
                    self._clients.remove(client)
                except ValueError:
                    pass
            try:
                client.close()
            except Exception:
                pass

    # ------------------------------------------------------------------ broadcast

    def broadcast(self, method: str, params: Optional[dict] = None) -> int:
        """Envia JSON-RPC notification (sem `id`) para todos os clientes
        conectados. Sockets que falham são removidos da lista.

        Retorna número de clientes que receberam com sucesso.
        Thread-safe: pode ser chamado do main thread (listeners callbacks).
        """
        notification = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            notification["params"] = params
        payload = (json.dumps(notification) + "\n").encode("utf-8")

        delivered = 0
        dead: list = []
        with self._clients_lock:
            snapshot = list(self._clients)
        for c in snapshot:
            try:
                c.sendall(payload)
                delivered += 1
            except OSError:
                dead.append(c)
        if dead:
            with self._clients_lock:
                for c in dead:
                    try:
                        self._clients.remove(c)
                    except ValueError:
                        pass
                    try:
                        c.close()
                    except Exception:
                        pass
        return delivered

    def _process_line(self, line: bytes) -> Optional[dict]:
        # Parse JSON
        try:
            request = json.loads(line.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            return _error_envelope(None, PARSE_ERROR, "parse error", {"reason": str(exc)})

        if not isinstance(request, dict):
            return _error_envelope(None, INVALID_REQUEST, "request must be an object")

        id_ = request.get("id")
        # Notifications: sem id — não respondemos (mas ainda enfileiramos)
        is_notification = "id" not in request

        if self.headless:
            response = self._dispatch(request)
        else:
            result_q: "queue.Queue[dict]" = queue.Queue(maxsize=1)
            self._call_queue.put((request, result_q))
            try:
                response = result_q.get(timeout=10.0)
            except queue.Empty:
                response = _error_envelope(
                    id_, INTERNAL_ERROR, "handler timeout", {"timeout_s": 10}
                )

        if is_notification:
            return None
        return response

    # ------------------------------------------------------------------ main-thread drain

    def _drain_queue(self) -> None:
        """Roda no main thread do Live. Drena toda a fila atual e re-agenda."""
        if self._stop.is_set():
            return
        while True:
            try:
                request, result_q = self._call_queue.get_nowait()
            except queue.Empty:
                break
            try:
                response = self._dispatch(request)
            except Exception as exc:  # safety net — nunca deixa _drain morrer
                response = _error_envelope(
                    request.get("id"),
                    INTERNAL_ERROR,
                    "dispatcher crashed",
                    {"reason": str(exc)},
                )
            try:
                result_q.put_nowait(response)
            except queue.Full:
                pass
        # Re-agenda
        if not self._stop.is_set() and self.ctrl is not None and hasattr(
            self.ctrl, "schedule_message"
        ):
            self.ctrl.schedule_message(50, self._drain_queue)

    # ------------------------------------------------------------------ dispatch

    def _dispatch(self, request: dict) -> dict:
        from .handlers._base import REGISTRY

        id_ = request.get("id")
        method = request.get("method")
        params = request.get("params") or {}

        if not isinstance(method, str) or not method:
            return _error_envelope(id_, INVALID_REQUEST, "missing method")

        handler_cls = REGISTRY.get(method)
        if handler_cls is None:
            return _error_envelope(
                id_, METHOD_NOT_FOUND, "method not found", {"method": method}
            )

        # Parse params via dataclass
        input_cls = getattr(handler_cls, "INPUT", None)
        try:
            parsed = input_cls(**params) if input_cls is not None else params
        except TypeError as exc:
            return _error_envelope(
                id_, INVALID_PARAMS, "invalid params", {"method": method, "reason": str(exc)}
            )

        # Executa
        t0 = time.time()
        try:
            handler = handler_cls(self.ctrl)
            result = handler.execute(parsed)
        except RpcError as exc:
            self.log.warn(
                "handler_rpc_error",
                method=method,
                code=exc.code,
                msg=exc.message,
                data=exc.data,
            )
            return _error_envelope(id_, exc.code, exc.message, exc.data)
        except Exception as exc:
            self.log.error(
                "handler_crashed",
                method=method,
                exc_type=type(exc).__name__,
                reason=str(exc),
            )
            return _error_envelope(
                id_,
                LIVE_API_CALL_FAILED,
                "live api call failed",
                {"method": method, "exception": type(exc).__name__, "reason": str(exc)},
            )

        dt_ms = int((time.time() - t0) * 1000)
        self.log.info("handler_ok", method=method, dt_ms=dt_ms)
        return {"jsonrpc": "2.0", "id": id_, "result": result}


# ---------------------------------------------------------------------- helpers


def _error_envelope(id_: Any, code: int, message: str, data: Optional[Any] = None) -> dict:
    err: dict = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": id_, "error": err}
