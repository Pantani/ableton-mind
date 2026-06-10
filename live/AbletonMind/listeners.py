"""
LiveAPI listeners → JSON-RPC notifications.

Per ADR-0005:
- Notification method: `event.<domain>_<property>_changed`
- Params: `{ value, previous?, ts, ... }`

Phase 2 (Cycle 5) delivers 2 listeners:
- `event.transport_tempo_changed`
- `event.transport_is_playing_changed`

LiveAPI uses `add_<prop>_listener(callback)` / `remove_<prop>_listener`.
Callbacks execute on the main thread (Live constraint). From here we call
`bridge.broadcast(method, params)` — the bridge serializes to NDJSON and
writes to every connected client (no `id` in the envelope, per the JSON-RPC
spec for notifications).

Idempotency: listeners auto-deregister in `teardown()` when Live unloads
the Control Surface (or on script reload).
"""
from typing import Callable, List, Tuple

try:
    import time
except ImportError:  # pragma: no cover
    time = None  # type: ignore


def _ts_ms() -> int:
    """Unix epoch milliseconds. `time` is always available in Python 3+, but
    the try/except above covers exotic environments (oddball Live runtimes)."""
    if time is None:  # pragma: no cover
        return 0
    return int(time.time() * 1000)


class ListenerManager:
    """Registers/removes song listeners. Keeps references for teardown."""

    def __init__(self, ctrl, broadcast: Callable[[str, dict], None]):
        # `ctrl`: ControlSurface; `broadcast(method, params)`: callable that
        # serializes a JSON-RPC notification to every client.
        self.ctrl = ctrl
        self.broadcast = broadcast
        # each entry: (song, prop, callback) — so we can remove later.
        self._registered: List[Tuple[object, str, Callable]] = []
        # cache of last value to include `previous` in the payload.
        self._last_tempo: float = 0.0
        self._last_is_playing: bool = False

    # ---------- public API ------------------------------------------------

    def setup(self) -> None:
        """Wires every listener. Idempotent — calling 2x doesn't duplicate.

        Phase 2 (Cycle 5): tempo + is_playing.
        Phase 2 (Cycle 7): + track listeners (name/mute/solo/volume) and
        clip listeners (name/is_playing) for every object that exists at
        setup time. Re-registers on setup() — if the user creates new
        tracks/clips later, setup() must be called again.
        """
        song = self.ctrl.song()
        if song is None:
            return
        self._teardown_inner()  # ensure cleanup before re-registering
        self._last_tempo = float(getattr(song, "tempo", 0.0))
        self._last_is_playing = bool(getattr(song, "is_playing", False))
        self._add(song, "tempo", self._on_tempo)
        self._add(song, "is_playing", self._on_is_playing)

        # Track listeners — one callback per (track, prop).
        for ti, track in enumerate(list(getattr(song, "tracks", []))):
            for prop, default_prop_value in (
                ("name", ""),
                ("mute", False),
                ("solo", False),
            ):
                self._add_obj_listener(track, prop, "track", ti, default_prop_value)
            # volume lives in mixer_device.volume.value — listener on the DeviceParameter.
            mixer = getattr(track, "mixer_device", None)
            vol = getattr(mixer, "volume", None) if mixer is not None else None
            if vol is not None:
                self._add_obj_listener(vol, "value", "track_volume", ti, 0.0)

            # Clip listeners — per slot that has a clip.
            for si, slot in enumerate(list(getattr(track, "clip_slots", []) or [])):
                clip = getattr(slot, "clip", None)
                if clip is None:
                    continue
                for prop, default_prop_value in (("name", ""), ("is_playing", False)):
                    self._add_clip_listener(clip, prop, ti, si, default_prop_value)

    def teardown(self) -> None:
        """Removes every listener. Called from the ControlSurface's
        `disconnect()` (Live unloads or the user switches slot)."""
        self._teardown_inner()

    # ---------- internals --------------------------------------------------

    def _add(self, song, prop: str, cb: Callable) -> None:
        method = f"add_{prop}_listener"
        fn = getattr(song, method, None)
        if fn is None:
            # Nonexistent property (old Live version? FakeSong without support?).
            # Log and move on — Phase 0/1 doesn't die over a missing listener.
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
                except Exception:  # pragma: no cover - Live may have already cleaned up
                    pass
        self._registered = []

    # ---------- multi-object listeners (Cycle 7) ---------------------------

    def _add_obj_listener(self, obj, prop: str, kind: str, index: int, last_default) -> None:
        """Registers a listener on `obj` for `prop`. `kind` + `index` become part
        of the notification method. Captures last value for `previous`."""
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
