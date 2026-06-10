"""
Phase 5 handlers — session snapshot, session diff, render preview (stub).

`session.snapshot` is the base of the "full" verify loop: LLM takes a snapshot
before the mutation, then calls `session.diff` with the previous snapshot to
discover what actually changed in Live.

`render.preview` in Phase 5 returns only a snapshot (mode "snapshot"). Mode
"bounce" is deferred to Cycle 10 — it requires freeze + export, which touch
disk and take seconds.
"""
import time as _time

from ..errors import INVALID_PARAMS, LIVE_NOT_RUNNING, RpcError
from ..schemas import RenderPreviewInput, SessionDiffInput, SessionSnapshotInput
from ._base import Handler, register


def _ts_ms() -> int:
    return int(_time.time() * 1000)


def _snapshot_track(track, ti: int, include_clips: bool, include_devices: bool) -> dict:
    mixer = getattr(track, "mixer_device", None)
    vol = getattr(mixer, "volume", None) if mixer is not None else None
    pan = getattr(mixer, "panning", None) if mixer is not None else None
    out = {
        "index": ti,
        "name": str(getattr(track, "name", "")),
        "color_index": int(getattr(track, "color_index", 0) or 0),
        "is_midi": bool(getattr(track, "has_midi_input", False)),
        "is_audio": bool(getattr(track, "has_audio_input", False)),
        "mute": bool(getattr(track, "mute", False)),
        "solo": bool(getattr(track, "solo", False)),
        "arm": bool(getattr(track, "arm", False)),
        "volume": float(getattr(vol, "value", 0.0)) if vol is not None else 0.0,
        "panning": float(getattr(pan, "value", 0.0)) if pan is not None else 0.0,
    }
    if include_clips:
        clips: list = []
        for si, slot in enumerate(getattr(track, "clip_slots", []) or []):
            if not bool(getattr(slot, "has_clip", False)):
                continue
            clip = getattr(slot, "clip", None)
            if clip is None:
                continue
            clips.append(
                {
                    "slot": si,
                    "name": str(getattr(clip, "name", "")),
                    "length": float(getattr(clip, "length", 0.0)),
                    "is_playing": bool(getattr(clip, "is_playing", False)),
                }
            )
        out["clips"] = clips
    if include_devices:
        out["devices"] = [
            {"index": di, "name": str(getattr(d, "name", "")), "class_name": str(getattr(d, "class_name", ""))}
            for di, d in enumerate(getattr(track, "devices", []) or [])
        ]
    return out


@register("session.snapshot")
class SessionSnapshotHandler(Handler):
    INPUT = SessionSnapshotInput

    def execute(self, params: SessionSnapshotInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        tracks = [
            _snapshot_track(t, i, params.include_clips, params.include_devices)
            for i, t in enumerate(list(song.tracks))
        ]
        return {
            "ts": _ts_ms(),
            "tempo": float(getattr(song, "tempo", 120.0)),
            "is_playing": bool(getattr(song, "is_playing", False)),
            "song_time": float(getattr(song, "current_song_time", 0.0)),
            "signature_numerator": int(getattr(song, "signature_numerator", 4)),
            "signature_denominator": int(getattr(song, "signature_denominator", 4)),
            "tracks": tracks,
            "total_tracks": len(tracks),
        }


def _diff_dicts(prev: dict, curr: dict, path: str = "") -> list:
    """Simple recursive diff — only primitives + dicts + lists.
    Each change: { path, before, after, kind: "added" | "removed" | "changed" }."""
    changes: list = []
    if not isinstance(prev, dict) or not isinstance(curr, dict):
        if prev != curr:
            changes.append({"path": path, "before": prev, "after": curr, "kind": "changed"})
        return changes
    all_keys = set(prev.keys()) | set(curr.keys())
    for k in all_keys:
        p = path + "." + k if path else k
        if k not in prev:
            changes.append({"path": p, "before": None, "after": curr[k], "kind": "added"})
        elif k not in curr:
            changes.append({"path": p, "before": prev[k], "after": None, "kind": "removed"})
        else:
            v_prev, v_curr = prev[k], curr[k]
            if isinstance(v_prev, dict) and isinstance(v_curr, dict):
                changes.extend(_diff_dicts(v_prev, v_curr, p))
            elif v_prev != v_curr:
                changes.append({"path": p, "before": v_prev, "after": v_curr, "kind": "changed"})
    return changes


@register("session.diff")
class SessionDiffHandler(Handler):
    INPUT = SessionDiffInput

    def execute(self, params: SessionDiffInput) -> dict:
        if not isinstance(params.previous, dict):
            raise RpcError(INVALID_PARAMS, "previous must be a snapshot dict", {})
        current = SessionSnapshotHandler(self.ctrl).execute(
            SessionSnapshotInput(include_clips=True, include_devices=True)
        )
        # path ignores `ts` which always changes
        prev_no_ts = {k: v for k, v in params.previous.items() if k != "ts"}
        curr_no_ts = {k: v for k, v in current.items() if k != "ts"}
        changes = _diff_dicts(prev_no_ts, curr_no_ts)
        return {
            "from_ts": int(params.previous.get("ts", 0)),
            "to_ts": int(current.get("ts", _ts_ms())),
            "changes": changes,
            "count": len(changes),
        }


@register("render.preview")
class RenderPreviewHandler(Handler):
    """Phase 5 stub. `mode: snapshot` returns enriched session.snapshot.
    `mode: bounce` raises NOT_IMPLEMENTED until Cycle 10."""

    INPUT = RenderPreviewInput

    def execute(self, params: RenderPreviewInput) -> dict:
        if params.mode == "snapshot":
            snap = SessionSnapshotHandler(self.ctrl).execute(
                SessionSnapshotInput(include_clips=True, include_devices=True)
            )
            return {"mode": "snapshot", "snapshot": snap, "bars": params.bars}
        if params.mode == "bounce":
            raise RpcError(
                INVALID_PARAMS,
                "bounce mode not implemented yet (planned for Cycle 10)",
                {"mode": params.mode},
            )
        raise RpcError(
            INVALID_PARAMS,
            "unknown render mode",
            {"valid": ["snapshot", "bounce"], "got": params.mode},
        )
