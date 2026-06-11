"""
`session.get_info` handler — read-only top-level snapshot.

Equivalent of ahujasid/ableton-mcp's `get_session_info`. LLM uses it to
orient itself before mutating (LOM exploration).
"""
from ..errors import LIVE_NOT_RUNNING, RpcError
from ..schemas import SessionGetInfoInput, SessionLinkStatusInput
from ._base import Handler, register

_MISSING = object()

_LINK_STATUS_FIELDS = (
    ("enabled", ["link_enabled", "ableton_link_enabled", "is_link_enabled"]),
    ("num_peers", ["link_num_peers", "num_link_peers", "link_peer_count", "link_peers"]),
    ("is_connected", ["link_connected", "is_link_connected", "link_has_peers"]),
    (
        "start_stop_sync",
        ["link_start_stop_sync_enabled", "ableton_link_start_stop_sync_enabled"],
    ),
    (
        "tempo_sync",
        ["link_tempo_sync_enabled", "ableton_link_tempo_sync_enabled", "link_sync_enabled"],
    ),
    ("quantum", ["link_quantum", "ableton_link_quantum"]),
)


def _safe_get(obj, name: str, default=_MISSING):
    if obj is None:
        return default
    try:
        return getattr(obj, name)
    except Exception:
        return default


def _safe_call(fn, default=_MISSING):
    try:
        return fn()
    except Exception:
        return default


def _ctrl_application(ctrl):
    app = _safe_get(ctrl, "application", _MISSING)
    if callable(app):
        app = _safe_call(app, _MISSING)
    return None if app is _MISSING else app


def _optional_bool(value):
    if value is _MISSING or value is None:
        return None
    try:
        return bool(value)
    except Exception:
        return None


def _optional_int(value):
    if value is _MISSING or value is None:
        return None
    try:
        return int(value)
    except Exception:
        return None


def _optional_float(value):
    if value is _MISSING or value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _read_first(sources: list, names: list) -> tuple:
    missing = []
    for source_name, obj in sources:
        if obj is None:
            missing.extend([f"{source_name}.{name}" for name in names])
            continue
        for name in names:
            value = _safe_get(obj, name, _MISSING)
            if value is not _MISSING and value is not None and value != "":
                return source_name, value, missing
            missing.append(f"{source_name}.{name}")
    return "", _MISSING, missing


def _read_link_status_values(sources):
    values = {}
    unsupported = []
    sources_used = set()
    for key, names in _LINK_STATUS_FIELDS:
        source, value, missing = _read_first(sources, names)
        values[key] = value
        unsupported.extend(missing)
        if source:
            sources_used.add(source)
    return values, unsupported, sources_used


def _has_link_status(values):
    return any(
        value is not _MISSING and value is not None
        for value in (
            values["enabled"],
            values["num_peers"],
            values["is_connected"],
            values["start_stop_sync"],
            values["tempo_sync"],
            values["quantum"],
        )
    )


def _link_status_source_name(sources_used):
    if not sources_used:
        return "none"
    if len(sources_used) == 1:
        return list(sources_used)[0]
    return "mixed"


@register("session.get_info")
class SessionGetInfoHandler(Handler):
    INPUT = SessionGetInfoInput

    def execute(self, params: SessionGetInfoInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")

        tracks = list(getattr(song, "tracks", []))
        returns = list(getattr(song, "return_tracks", []))
        master = getattr(song, "master_track", None)

        sig = getattr(song, "signature_numerator", 4), getattr(song, "signature_denominator", 4)
        try:
            sig_num = int(sig[0])
        except Exception:
            sig_num = 4
        try:
            sig_den = int(sig[1])
        except Exception:
            sig_den = 4

        return {
            "name": str(getattr(song, "name", "Untitled")),
            "num_tracks": len(tracks),
            "num_return_tracks": len(returns),
            "has_master": master is not None,
            "tempo": float(getattr(song, "tempo", 120.0)),
            "time_signature": {"numerator": sig_num, "denominator": sig_den},
            "is_playing": bool(getattr(song, "is_playing", False)),
            "song_time": float(getattr(song, "current_song_time", 0.0)),
            "song_length": float(getattr(song, "song_length", 0.0)),
            "root_note": int(getattr(song, "root_note", 0)),
            "scale_name": str(getattr(song, "scale_name", "")),
        }


@register("session.link_status")
class SessionLinkStatusHandler(Handler):
    INPUT = SessionLinkStatusInput

    def execute(self, params: SessionLinkStatusInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")

        sources = [("song", song), ("application", _ctrl_application(self.ctrl))]
        values, unsupported, sources_used = _read_link_status_values(sources)

        parsed_num_peers = _optional_int(values["num_peers"])
        parsed_is_connected = _optional_bool(values["is_connected"])
        if parsed_is_connected is None and parsed_num_peers is not None:
            parsed_is_connected = parsed_num_peers > 0

        available = _has_link_status(values)

        return {
            "available": bool(available),
            "read_only": True,
            "source": _link_status_source_name(sources_used),
            "enabled": _optional_bool(values["enabled"]),
            "is_connected": parsed_is_connected,
            "num_peers": parsed_num_peers,
            "start_stop_sync_enabled": _optional_bool(values["start_stop_sync"]),
            "tempo_sync_enabled": _optional_bool(values["tempo_sync"]),
            "quantum": _optional_float(values["quantum"]),
            "reason": None if available else "Live song/application does not expose Ableton Link status attributes",
            "unsupported_attributes": sorted(set(unsupported)),
        }
