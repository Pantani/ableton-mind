"""
TCP NDJSON server + JSON-RPC 2.0 dispatcher.

# Threading

LiveAPI **can only be touched on Live's main thread**. Therefore:

- TCP socket runs on a daemon thread (`_serve` accepts; each connection in a thread).
- Each request read from the socket goes into `_call_queue` (FIFO multi-producer).
- A `schedule_message(50, _drain_queue)` registered by the ControlSurface
  wakes Live's main thread every ~50ms to drain the queue and dispatch
  handlers (which touch LiveAPI safely).
- The socket thread blocks on `result_q.get(timeout=...)` waiting for the
  response processed by the main thread.

**Headless mode (tests/CLI)**: if no ControlSurface is provided, `BridgeServer`
dispatches synchronously on its own thread. Useful for the smoke test in mocks
and for qa-integration.

# Framing

NDJSON: each message is a JSON line terminated by `\n`. Implementation
follows jsonrpc.md §Transport.

# Errors

Exception → contract-code mapping:
- `RpcError`           → uses its own code
- `json.JSONDecodeError` → -32700 Parse error
- `TypeError` constructing input dataclass → -32602 Invalid params
- `KeyError` in REGISTRY → -32601 Method not found
- Any other exception → -32001 Live API call failed (with classname/str)
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
                   May be None in headless mode.
        headless — when True, dispatches on the socket's own thread. Useful for
                   tests and smoke outside Live.
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

        # Live clients for broadcast (TD-014). Lock for multi-thread access.
        self._clients: list = []
        self._clients_lock = threading.Lock()

        # Import handlers (populates REGISTRY)
        from . import handlers  # noqa: F401

    # ------------------------------------------------------------------ lifecycle

    def start(self) -> None:
        if self._server_thread and self._server_thread.is_alive():
            return  # idempotent
        self._stop.clear()
        self._server_thread = threading.Thread(
            target=self._serve, name="AbletonMindBridge", daemon=True
        )
        self._server_thread.start()
        if not self.headless and self.ctrl is not None and hasattr(self.ctrl, "schedule_message"):
            # Start the drain loop on Live's main thread
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
                        # notification (no id) — no response
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
        """Sends a JSON-RPC notification (no `id`) to all connected clients.
        Sockets that fail are removed from the list.

        Returns the number of clients that received successfully.
        Thread-safe: may be called from the main thread (listener callbacks).
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
        # Notifications: no id — we don't respond (but still enqueue)
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
        """Runs on Live's main thread. Drains the current queue and re-schedules."""
        if self._stop.is_set():
            return
        while True:
            try:
                request, result_q = self._call_queue.get_nowait()
            except queue.Empty:
                break
            try:
                response = self._dispatch(request)
            except Exception as exc:  # safety net — never let _drain die
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
        # Re-schedule
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

        # Execute
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
