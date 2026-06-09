"""
Handlers do domínio Track.

`track.list` — read-only, devolve coleções separadas (regular, return, master).
  Shape canônico definido em ADR-0002 (`_workspace/decisions/0002-track-list-shape.md`),
  supersede o shape provisório de Phase 0.

`track.create` — cria audio ou MIDI track em `index` (ou no fim se omitido).
  Não é idempotente (sempre cria). Phase 1+ pode adicionar `track.upsert`.
"""
from typing import Optional

from ..errors import LIVE_NOT_RUNNING, OBJECT_NOT_FOUND, OUT_OF_RANGE, RpcError
from ..schemas import (
    TrackCreateInput,
    TrackGetInfoInput,
    TrackListInput,
    TrackSetNameInput,
    TrackSetVolumeInput,
    TrackUpsertInput,
)
from ..transactions import undo_step
from ._base import Handler, register


def _is_midi(track) -> bool:
    """Live expõe `has_midi_input` em tracks regulares."""
    return bool(getattr(track, "has_midi_input", False))


def _is_audio(track) -> bool:
    return bool(getattr(track, "has_audio_input", False))


def _snapshot_regular(track, index: int) -> dict:
    return {
        "index": index,
        "name": str(getattr(track, "name", "")),
        "color_index": int(getattr(track, "color_index", 0) or 0),
        "is_midi": _is_midi(track),
        "is_audio": _is_audio(track),
        "is_grouped": bool(getattr(track, "is_grouped", False)),
        "is_foldable": bool(getattr(track, "is_foldable", False)),
        "mute": bool(getattr(track, "mute", False)),
        "solo": bool(getattr(track, "solo", False)),
        "arm": bool(getattr(track, "arm", False)),
    }


def _snapshot_return(track, index: int) -> dict:
    return {
        "index": index,
        "name": str(getattr(track, "name", "")),
        "color_index": int(getattr(track, "color_index", 0) or 0),
        "mute": bool(getattr(track, "mute", False)),
        "solo": bool(getattr(track, "solo", False)),
    }


def _snapshot_master(track) -> dict:
    return {
        "name": str(getattr(track, "name", "Master")),
        "color_index": int(getattr(track, "color_index", 0) or 0),
    }


@register("track.list")
class TrackListHandler(Handler):
    INPUT = TrackListInput

    def execute(self, params: TrackListInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")

        tracks = [_snapshot_regular(t, i) for i, t in enumerate(list(song.tracks))]

        return_tracks: list = []
        if params.include_returns:
            returns = getattr(song, "return_tracks", []) or []
            return_tracks = [_snapshot_return(t, i) for i, t in enumerate(list(returns))]

        master: Optional[dict] = None
        if params.include_master:
            m = getattr(song, "master_track", None)
            if m is not None:
                master = _snapshot_master(m)

        total = len(tracks) + len(return_tracks) + (1 if master is not None else 0)

        return {
            "tracks": tracks,
            "return_tracks": return_tracks,
            "master_track": master,
            "total": total,
        }


@register("track.create")
class TrackCreateHandler(Handler):
    """Cria audio ou MIDI track. Não idempotente.

    `index` é a posição final desejada em `song.tracks`. Se omitido, anexa no
    fim. Live aceita inserir em `len(tracks)` (final), então faixa válida é
    `[0, num_tracks]`.
    """

    INPUT = TrackCreateInput

    def execute(self, params: TrackCreateInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")

        if params.type not in ("midi", "audio"):
            raise RpcError(
                OBJECT_NOT_FOUND,
                "unsupported track type",
                {"expected": ["midi", "audio"], "got": params.type},
            )

        existing = list(song.tracks)
        num = len(existing)
        target = num if params.index is None or params.index < 0 else int(params.index)
        if target > num:
            raise RpcError(
                OUT_OF_RANGE,
                "index out of range",
                {"min": 0, "max": num, "got": target},
            )

        with undo_step("track.create", song):
            if params.type == "midi":
                song.create_midi_track(target)
            else:
                song.create_audio_track(target)

            new_tracks = list(song.tracks)
            if target >= len(new_tracks):
                # Live deveria ter inserido; se não inseriu, undo step ainda fecha.
                raise RpcError(
                    -32001,
                    "Live did not create the track",
                    {"type": params.type, "target_index": target},
                )
            created = new_tracks[target]

            if params.name:
                try:
                    created.name = params.name
                except Exception:
                    # Nome pode falhar (chars inválidos, etc); não bloqueia a criação.
                    pass

        return {
            "changed": True,
            "track": {
                "index": target,
                "name": str(getattr(created, "name", "")),
                "is_midi": _is_midi(created),
                "is_audio": _is_audio(created),
            },
        }


# ---------------------------------------------------------------------------
# Conversão volume → dB (curva piecewise aprox do Live, ver ADR-0004)
# ---------------------------------------------------------------------------
# Tabela calibrada contra Live 12 (volume slider, audio track, sem sends).
_VOL_DB_TABLE = [
    (0.000, float("-inf")),
    (0.100, -64.0),
    (0.200, -42.0),
    (0.300, -30.0),
    (0.400, -22.0),
    (0.500, -16.0),
    (0.600, -10.0),
    (0.700, -4.0),
    (0.800, -1.0),
    (0.850, 0.0),
    (0.900, 2.0),
    (0.950, 4.0),
    (1.000, 6.0),
]


def _volume_to_db(v: float) -> float:
    """Interpolação linear entre os pontos da tabela. Aceita 0..1."""
    v = max(0.0, min(1.0, float(v)))
    if v <= 0.0:
        return float("-inf")
    for i in range(len(_VOL_DB_TABLE) - 1):
        lo_v, lo_db = _VOL_DB_TABLE[i]
        hi_v, hi_db = _VOL_DB_TABLE[i + 1]
        if lo_v <= v <= hi_v:
            if lo_db == float("-inf"):
                return hi_db  # transição entre -inf e -64; aproximação grosseira
            t = (v - lo_v) / (hi_v - lo_v) if hi_v > lo_v else 0.0
            return lo_db + t * (hi_db - lo_db)
    return _VOL_DB_TABLE[-1][1]


def _require_regular_track(song, index: int):
    tracks = list(song.tracks)
    n = len(tracks)
    if index < 0 or index >= n:
        raise RpcError(
            OBJECT_NOT_FOUND,
            "track not found",
            {"num_tracks": n, "got": index},
        )
    return tracks[index]


@register("track.upsert")
class TrackUpsertHandler(Handler):
    """Cria track se o nome ainda não existir. Idempotente.

    Procura por `name` em `song.tracks`. Se achar, retorna `changed: False` e
    o snapshot da existente. Se não, cria e nomeia.
    """

    INPUT = TrackUpsertInput

    def execute(self, params: TrackUpsertInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        if not params.name:
            raise RpcError(
                OBJECT_NOT_FOUND,
                "name is required for upsert",
                {"got": params.name},
            )
        if params.type not in ("midi", "audio"):
            raise RpcError(
                OBJECT_NOT_FOUND,
                "unsupported track type",
                {"expected": ["midi", "audio"], "got": params.type},
            )

        for i, t in enumerate(list(song.tracks)):
            if str(getattr(t, "name", "")) == params.name:
                return {
                    "changed": False,
                    "track": {
                        "index": i,
                        "name": params.name,
                        "is_midi": _is_midi(t),
                        "is_audio": _is_audio(t),
                    },
                }

        existing = list(song.tracks)
        num = len(existing)
        target = num if params.index is None or params.index < 0 else int(params.index)
        if target > num:
            raise RpcError(
                OUT_OF_RANGE,
                "index out of range",
                {"min": 0, "max": num, "got": target},
            )

        with undo_step("track.upsert", song):
            if params.type == "midi":
                song.create_midi_track(target)
            else:
                song.create_audio_track(target)
            created = list(song.tracks)[target]
            try:
                created.name = params.name
            except Exception:
                pass

        return {
            "changed": True,
            "track": {
                "index": target,
                "name": str(getattr(created, "name", params.name)),
                "is_midi": _is_midi(created),
                "is_audio": _is_audio(created),
            },
        }


@register("track.set_name")
class TrackSetNameHandler(Handler):
    INPUT = TrackSetNameInput

    def execute(self, params: TrackSetNameInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        track = _require_regular_track(song, params.index)
        before = str(getattr(track, "name", ""))
        if before == params.name:
            return {"changed": False, "before": before, "after": before}
        with undo_step("track.set_name", song):
            track.name = params.name
        after = str(getattr(track, "name", ""))
        return {"changed": True, "before": before, "after": after}


@register("track.set_volume")
class TrackSetVolumeHandler(Handler):
    """Volume normalized 0..1 conforme ADR-0004. Idempotente em 1e-4."""

    INPUT = TrackSetVolumeInput

    def execute(self, params: TrackSetVolumeInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        track = _require_regular_track(song, params.index)
        v = float(params.volume)
        if v < 0.0 or v > 1.0:
            raise RpcError(
                OUT_OF_RANGE,
                "volume out of range",
                {"min": 0.0, "max": 1.0, "got": v},
            )

        mixer = getattr(track, "mixer_device", None)
        if mixer is None:
            raise RpcError(
                -32001,
                "track has no mixer_device",
                {"index": params.index},
            )
        vol = getattr(mixer, "volume", None)
        if vol is None or not hasattr(vol, "value"):
            raise RpcError(
                -32001,
                "track.mixer_device.volume not available",
                {"index": params.index},
            )

        before = float(vol.value)
        if abs(before - v) < 1e-4:
            return {
                "changed": False,
                "before": before,
                "after": before,
                "before_db": _volume_to_db(before),
                "after_db": _volume_to_db(before),
            }
        with undo_step("track.set_volume", song):
            vol.value = v
        after = float(vol.value)
        return {
            "changed": True,
            "before": before,
            "after": after,
            "before_db": _volume_to_db(before),
            "after_db": _volume_to_db(after),
        }


@register("track.get_info")
class TrackGetInfoHandler(Handler):
    """Read-only detail por track regular."""

    INPUT = TrackGetInfoInput

    def execute(self, params: TrackGetInfoInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        track = _require_regular_track(song, params.index)

        mixer = getattr(track, "mixer_device", None)
        vol_param = getattr(mixer, "volume", None) if mixer is not None else None
        pan_param = getattr(mixer, "panning", None) if mixer is not None else None
        sends = list(getattr(mixer, "sends", []) or []) if mixer is not None else []

        slots = list(getattr(track, "clip_slots", []) or [])
        clips_filled = sum(1 for s in slots if bool(getattr(s, "has_clip", False)))
        devices = list(getattr(track, "devices", []) or [])

        vol_val = float(getattr(vol_param, "value", 0.0)) if vol_param is not None else 0.0
        pan_val = float(getattr(pan_param, "value", 0.0)) if pan_param is not None else 0.0

        return {
            "index": params.index,
            "name": str(getattr(track, "name", "")),
            "color_index": int(getattr(track, "color_index", 0) or 0),
            "is_midi": _is_midi(track),
            "is_audio": _is_audio(track),
            "mute": bool(getattr(track, "mute", False)),
            "solo": bool(getattr(track, "solo", False)),
            "arm": bool(getattr(track, "arm", False)),
            "volume": vol_val,
            "volume_db": _volume_to_db(vol_val),
            "panning": pan_val,
            "num_sends": len(sends),
            "num_clip_slots": len(slots),
            "num_clips": clips_filled,
            "num_devices": len(devices),
        }
