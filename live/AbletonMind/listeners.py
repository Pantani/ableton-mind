"""
Listeners LiveAPI → JSON-RPC notifications.

Conforme ADR-0005:
- Notification method: `event.<domain>_<property>_changed`
- Params: `{ value, previous?, ts, ... }`

Phase 2 (Cycle 5) entrega 2 listeners:
- `event.transport_tempo_changed`
- `event.transport_is_playing_changed`

LiveAPI usa `add_<prop>_listener(callback)` / `remove_<prop>_listener`.
Callbacks executam no main thread (Live constraint). Daqui chamamos
`bridge.broadcast(method, params)` — bridge serializa em NDJSON e escreve
para todos os clientes conectados (sem `id` no envelope, per JSON-RPC spec
para notifications).

Idempotência: listeners auto-deregisteram em `teardown()` quando o Live
descarrega o Control Surface (ou em reload do script).
"""
from typing import Callable, List, Tuple

try:
    import time
except ImportError:  # pragma: no cover
    time = None  # type: ignore


def _ts_ms() -> int:
    """Unix epoch milliseconds. `time` é sempre disponível em Python 3+, mas
    o try/except acima cobre ambiente exótico (Live runtime estranho)."""
    if time is None:  # pragma: no cover
        return 0
    return int(time.time() * 1000)


class ListenerManager:
    """Registra/remove listeners do song. Mantém referências para teardown."""

    def __init__(self, ctrl, broadcast: Callable[[str, dict], None]):
        # `ctrl`: ControlSurface; `broadcast(method, params)`: callable que
        # serializa JSON-RPC notification para todos os clientes.
        self.ctrl = ctrl
        self.broadcast = broadcast
        # cada entrada: (song, prop, callback) — para conseguirmos remover.
        self._registered: List[Tuple[object, str, Callable]] = []
        # cache do último valor para incluir `previous` no payload.
        self._last_tempo: float = 0.0
        self._last_is_playing: bool = False

    # ---------- public API ------------------------------------------------

    def setup(self) -> None:
        """Liga todos os listeners. Idempotente — chamar 2x não duplica.

        Phase 2 (Cycle 5): tempo + is_playing.
        Phase 2 (Cycle 7): + track listeners (name/mute/solo/volume) e
        clip listeners (name/is_playing) para todos os objetos existentes
        no momento do setup. Re-registra em setup() — se o usuário criar
        novas tracks/clips depois, precisa chamar setup() de novo.
        """
        song = self.ctrl.song()
        if song is None:
            return
        self._teardown_inner()  # garante limpeza antes de re-registrar
        self._last_tempo = float(getattr(song, "tempo", 0.0))
        self._last_is_playing = bool(getattr(song, "is_playing", False))
        self._add(song, "tempo", self._on_tempo)
        self._add(song, "is_playing", self._on_is_playing)

        # Track listeners — uma callback por (track, prop).
        for ti, track in enumerate(list(getattr(song, "tracks", []))):
            for prop, default_prop_value in (
                ("name", ""),
                ("mute", False),
                ("solo", False),
            ):
                self._add_obj_listener(track, prop, "track", ti, default_prop_value)
            # volume vive em mixer_device.volume.value — listener no DeviceParameter.
            mixer = getattr(track, "mixer_device", None)
            vol = getattr(mixer, "volume", None) if mixer is not None else None
            if vol is not None:
                self._add_obj_listener(vol, "value", "track_volume", ti, 0.0)

            # Clip listeners — por slot que tenha clip.
            for si, slot in enumerate(list(getattr(track, "clip_slots", []) or [])):
                clip = getattr(slot, "clip", None)
                if clip is None:
                    continue
                for prop, default_prop_value in (("name", ""), ("is_playing", False)):
                    self._add_clip_listener(clip, prop, ti, si, default_prop_value)

    def teardown(self) -> None:
        """Remove todos os listeners. Chamado no `disconnect()` do
        ControlSurface (Live descarrega ou usuário troca slot)."""
        self._teardown_inner()

    # ---------- internals --------------------------------------------------

    def _add(self, song, prop: str, cb: Callable) -> None:
        method = f"add_{prop}_listener"
        fn = getattr(song, method, None)
        if fn is None:
            # Property inexistente (versão antiga do Live? FakeSong sem suporte?).
            # Log e segue — Phase 0/1 não morre por listener faltar.
            log = getattr(self.ctrl, "log_message", None)
            if log is not None:
                log(f"[listeners] {method} not available on song")
            return
        fn(cb)
        self._registered.append((song, prop, cb))

    def _teardown_inner(self) -> None:
        for obj, prop, cb in self._registered:
            remove = getattr(obj, f"remove_{prop}_listener", None)
            if remove is not None:
                try:
                    remove(cb)
                except Exception:  # pragma: no cover - Live pode já ter limpo
                    pass
        self._registered = []

    # ---------- multi-object listeners (Cycle 7) ---------------------------

    def _add_obj_listener(self, obj, prop: str, kind: str, index: int, last_default) -> None:
        """Registra listener em `obj` para `prop`. `kind` + `index` viram parte
        do método de notification. Captura último valor para `previous`."""
        method = f"add_{prop}_listener"
        fn = getattr(obj, method, None)
        if fn is None:
            return
        last = {"value": getattr(obj, prop, last_default)}

        def callback() -> None:
            value = self._extract(obj, prop, last_default)
            previous = last["value"]
            last["value"] = value
            if kind == "track":
                self.broadcast(
                    f"event.track_{prop}_changed",
                    {"value": value, "previous": previous, "ts": _ts_ms(), "track_index": index},
                )
            elif kind == "track_volume":
                self.broadcast(
                    "event.track_volume_changed",
                    {"value": value, "previous": previous, "ts": _ts_ms(), "track_index": index},
                )

        fn(callback)
        self._registered.append((obj, prop, callback))

    def _add_clip_listener(self, clip, prop: str, track_index: int, slot_index: int, last_default) -> None:
        method = f"add_{prop}_listener"
        fn = getattr(clip, method, None)
        if fn is None:
            return
        last = {"value": getattr(clip, prop, last_default)}

        def callback() -> None:
            value = self._extract(clip, prop, last_default)
            previous = last["value"]
            last["value"] = value
            self.broadcast(
                f"event.clip_{prop}_changed",
                {
                    "value": value,
                    "previous": previous,
                    "ts": _ts_ms(),
                    "track_index": track_index,
                    "clip_slot_index": slot_index,
                },
            )

        fn(callback)
        self._registered.append((clip, prop, callback))

    @staticmethod
    def _extract(obj, prop: str, default):
        try:
            return getattr(obj, prop, default)
        except Exception:
            return default

    # ---------- callbacks --------------------------------------------------

    def _on_tempo(self) -> None:
        song = self.ctrl.song()
        if song is None:
            return
        value = float(getattr(song, "tempo", 0.0))
        previous = self._last_tempo
        self._last_tempo = value
        self.broadcast(
            "event.transport_tempo_changed",
            {"value": value, "previous": previous, "ts": _ts_ms()},
        )

    def _on_is_playing(self) -> None:
        song = self.ctrl.song()
        if song is None:
            return
        value = bool(getattr(song, "is_playing", False))
        previous = self._last_is_playing
        self._last_is_playing = value
        self.broadcast(
            "event.transport_is_playing_changed",
            {"value": value, "previous": previous, "ts": _ts_ms()},
        )
