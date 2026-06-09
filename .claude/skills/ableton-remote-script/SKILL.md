---
name: ableton-remote-script
description: Padrões para o Remote Script Python (bridge) do ableton-mind. Como subclasse ControlSurface, registrar handlers, expor LiveAPI thread-safe, criar listeners idempotentes, transações undo, testes offline com LiveAPI mockada. Usar quando estiver implementando ou revisando código em live/AbletonMind/.
---

# Ableton Remote Script — Padrões Python bridge

Skill consumido pelo `python-bridge-engineer`. Define como o Remote Script roda dentro do Live.

## Stack

- Python 3.7+ (compat Live 11) ou 3.11 com flag (`LIVE12_ONLY`).
- Stdlib only no caminho crítico. Nada de pip dentro do Live.
- LiveAPI (`Live`, `_Framework.ControlSurface`).
- Test: `unittest`, com fakes em `live/tests/_fakes/live_api.py`.

## Layout

```
live/AbletonMind/
├─ __init__.py             # entrypoint: class AbletonMind(ControlSurface)
├─ bridge.py               # servidor TCP, dispatch JSON-RPC
├─ handlers/
│  ├─ _base.py             # registry, Handler base
│  ├─ transport.py
│  ├─ track.py
│  ├─ clip.py
│  ├─ scene.py
│  ├─ device.py
│  ├─ rack.py
│  ├─ automation.py
│  ├─ browser.py
│  └─ view.py
├─ listeners.py            # subscription registry
├─ transactions.py         # undo_step context manager
├─ liveapi.py              # helpers thread-safe + snapshot
├─ schemas.py              # dataclasses I/O (espelha _workspace/contracts/)
└─ logging.py              # structured logger
```

## Entrypoint

```python
# live/AbletonMind/__init__.py
from _Framework.ControlSurface import ControlSurface
from .bridge import BridgeServer
from .listeners import ListenerRegistry

def create_instance(c_instance):
    return AbletonMind(c_instance)

class AbletonMind(ControlSurface):
    def __init__(self, c_instance):
        super().__init__(c_instance)
        with self.component_guard():
            self.listeners = ListenerRegistry(self)
            self.bridge = BridgeServer(self, port=9876)
            self.bridge.start()
            self.log_message("AbletonMind started on 127.0.0.1:9876")

    def disconnect(self):
        self.bridge.stop()
        self.listeners.unsubscribe_all()
        super().disconnect()
```

O Live carrega `create_instance(c_instance)` automaticamente quando o usuário seleciona "AbletonMind" como Control Surface em Preferences.

## Servidor TCP — thread separada + fila

LiveAPI **só pode ser tocada no thread principal**. O servidor TCP roda em outro thread; toda chamada precisa entrar via fila.

```python
# live/AbletonMind/bridge.py
import socket
import threading
import json
import queue

class BridgeServer:
    def __init__(self, ctrl, port=9876):
        self.ctrl = ctrl
        self.port = port
        self._stop = threading.Event()
        self._call_queue = queue.Queue()
        # poll para drenar fila no thread principal do Live
        self.ctrl.schedule_message(0, self._drain_queue)

    def start(self):
        self._server_thread = threading.Thread(target=self._serve, daemon=True)
        self._server_thread.start()

    def stop(self):
        self._stop.set()

    def _serve(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("127.0.0.1", self.port))
        sock.listen(5)
        sock.settimeout(0.5)
        while not self._stop.is_set():
            try:
                client, _ = sock.accept()
                threading.Thread(target=self._handle_client, args=(client,), daemon=True).start()
            except socket.timeout:
                continue
        sock.close()

    def _handle_client(self, client):
        buffer = b""
        while not self._stop.is_set():
            chunk = client.recv(4096)
            if not chunk:
                break
            buffer += chunk
            while b"\n" in buffer:
                line, buffer = buffer.split(b"\n", 1)
                if not line.strip():
                    continue
                request = json.loads(line.decode("utf-8"))
                # Enfileira para o thread principal do Live
                result_q = queue.Queue(maxsize=1)
                self._call_queue.put((request, result_q))
                response = result_q.get(timeout=10)
                client.sendall((json.dumps(response) + "\n").encode("utf-8"))
        client.close()

    def _drain_queue(self):
        # roda no thread principal do Live
        while True:
            try:
                request, result_q = self._call_queue.get_nowait()
            except queue.Empty:
                break
            response = self._dispatch(request)
            result_q.put(response)
        self.ctrl.schedule_message(50, self._drain_queue)  # re-agenda

    def _dispatch(self, request):
        from .handlers._base import REGISTRY
        method = request.get("method")
        id_ = request.get("id")
        params = request.get("params") or {}
        try:
            handler_cls = REGISTRY[method]
            handler = handler_cls(self.ctrl)
            parsed = handler.INPUT(**params)
            result = handler.execute(parsed)
            return {"jsonrpc": "2.0", "id": id_, "result": result}
        except KeyError:
            return self._error(id_, -32601, f"method not found: {method}")
        except Exception as e:
            return self._error(id_, -32603, str(e))

    def _error(self, id_, code, msg, data=None):
        return {"jsonrpc": "2.0", "id": id_, "error": {"code": code, "message": msg, "data": data}}
```

**Pontos críticos:**
1. `schedule_message(ms, fn)` é como você cai no thread principal do Live. Nunca chame LiveAPI direto do `_handle_client`.
2. `daemon=True` para que threads morram quando o Live fechar.
3. Sempre `SO_REUSEADDR` para evitar "port in use" depois de reload.

## Registry de handlers

```python
# live/AbletonMind/handlers/_base.py
REGISTRY = {}

def register(method):
    def deco(cls):
        REGISTRY[method] = cls
        return cls
    return deco

class Handler:
    INPUT = None  # dataclass

    def __init__(self, ctrl):
        self.ctrl = ctrl

    def execute(self, params):
        raise NotImplementedError

    @property
    def song(self):
        return self.ctrl.song()
```

## Handler exemplo

```python
# live/AbletonMind/handlers/transport.py
from ._base import Handler, register
from ..schemas import SetTempoInput

@register("transport.set_tempo")
class SetTempoHandler(Handler):
    INPUT = SetTempoInput

    def execute(self, params: SetTempoInput) -> dict:
        self.song.tempo = float(params.bpm)
        return {"tempo": float(self.song.tempo)}
```

## Schemas (dataclasses)

```python
# live/AbletonMind/schemas.py
from dataclasses import dataclass
from typing import Optional

@dataclass
class SetTempoInput:
    bpm: float

@dataclass
class CreateMidiTrackInput:
    index: Optional[int] = None
    name: Optional[str] = None
    color_index: Optional[int] = None
```

`_workspace/contracts/transport.ts` define a verdade; este arquivo espelha. CI tem check de drift (qa-integration roda).

## Transações undo

```python
# live/AbletonMind/transactions.py
from contextlib import contextmanager

@contextmanager
def undo_step(name: str, song):
    song.begin_undo_step()
    try:
        yield
    finally:
        song.end_undo_step()
```

Uso:
```python
with undo_step("create_midi_track", self.song):
    self.song.create_midi_track(idx)
    self.song.tracks[idx].name = name
```

## Listeners idempotentes

```python
# live/AbletonMind/listeners.py
class ListenerRegistry:
    def __init__(self, ctrl):
        self.ctrl = ctrl
        self._active = {}  # (obj_id, prop) -> (obj, listener_fn)

    def subscribe(self, obj, prop, on_change):
        key = (id(obj), prop)
        if key in self._active:
            return  # idempotente
        listener = lambda: on_change(getattr(obj, prop))
        add = getattr(obj, f"add_{prop}_listener")
        add(listener)
        self._active[key] = (obj, prop, listener)

    def unsubscribe(self, obj, prop):
        key = (id(obj), prop)
        entry = self._active.pop(key, None)
        if not entry:
            return
        _, _, listener = entry
        rem = getattr(obj, f"remove_{prop}_listener")
        rem(listener)

    def unsubscribe_all(self):
        for (obj, prop, listener) in list(self._active.values()):
            try:
                getattr(obj, f"remove_{prop}_listener")(listener)
            except Exception:
                pass
        self._active.clear()
```

Sempre `unsubscribe_all` no `disconnect()` do ControlSurface, ou Live trava ao trocar set.

## Validação `liveobj_valid`

Referências (`Live.Track.Track`, `Live.Device.Device`) ficam inválidas se o objeto for removido. Sempre cheque antes de tocar:

```python
import Live
if Live.Application.get_application().get_document().is_valid:
    track = self.song.tracks[idx]
    if not hasattr(track, "_live_ptr") or track._live_ptr.is_valid:  # API varia
        track.name = "X"
```

Mais seguro: re-acesse via `song.tracks[idx]` no momento do uso, em vez de cachear referência entre handlers.

## Testes offline

```python
# live/tests/_fakes/live_api.py
class FakeSong:
    def __init__(self):
        self.tempo = 120.0
        self.tracks = []
    def create_midi_track(self, idx):
        self.tracks.insert(idx, FakeTrack(f"MIDI {idx}", True))
    def begin_undo_step(self): pass
    def end_undo_step(self): pass

class FakeTrack:
    def __init__(self, name, is_midi):
        self.name = name
        self.has_midi_input = is_midi
        self.color_index = 0
```

```python
# live/tests/test_transport.py
import unittest
from live.AbletonMind.handlers.transport import SetTempoHandler
from live.AbletonMind.schemas import SetTempoInput
from live.tests._fakes.live_api import FakeSong

class FakeCtrl:
    def __init__(self, song): self._song = song
    def song(self): return self._song

class TestSetTempo(unittest.TestCase):
    def test_sets_tempo(self):
        song = FakeSong()
        h = SetTempoHandler(FakeCtrl(song))
        result = h.execute(SetTempoInput(bpm=128))
        self.assertEqual(result["tempo"], 128.0)
        self.assertEqual(song.tempo, 128.0)
```

## Antipatterns

| ❌ NÃO | ✅ SIM |
|---|---|
| Toca LiveAPI no thread do socket | Enfileira via `_call_queue` → roda no `_drain_queue` |
| `print()` para debug | `self.log_message(json.dumps({...}))` |
| `time.sleep` em loops longos | `schedule_message(ms, fn)` |
| Cacheia `track` entre handlers | Re-acessa `song.tracks[idx]` no uso |
| `add_listener` sem registry | Sempre via `ListenerRegistry` |
| Crashes não tratados → derruba bridge | Try/except no `_dispatch`, retorna erro estruturado |
