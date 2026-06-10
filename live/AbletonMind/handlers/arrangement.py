"""
Arrangement-domain handlers (Phase 4 start).

`arrangement.add_automation_point` — appends a point to an automation envelope
on the arrangement view. NOT idempotent (duplicate calls add multiple points).

LiveAPI:
  - `track.automation_envelopes` is a list of existing envelopes.
  - `track.create_or_get_automation_envelope(parameter)` creates if missing.
  - `envelope.insert_step(time, length, value)` inserts a point.

`parameter_locator` resolution is done here via the shared helper
(`_resolve_locator`). The same helper is used by `clip.envelope_set_points`.
"""
from ..errors import (
    INVALID_PARAMS,
    KNOWLEDGE_LOOKUP_FAILED,
    LIVE_NOT_RUNNING,
    OBJECT_NOT_FOUND,
    RpcError,
)
from ..schemas import ArrangementAddAutomationPointInput
from ..transactions import undo_step
from ._base import Handler, register
from .clip import _resolve_parameter_locator  # shared


@register("arrangement.add_automation_point")
class ArrangementAddAutomationPointHandler(Handler):
    INPUT = ArrangementAddAutomationPointInput

    def execute(self, params: ArrangementAddAutomationPointInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        tracks = list(song.tracks)
        if params.track_index < 0 or params.track_index >= len(tracks):
            raise RpcError(
                OBJECT_NOT_FOUND,
                "track not found",
                {"num_tracks": len(tracks), "got": params.track_index},
            )
        track = tracks[params.track_index]

        try:
            parameter = _resolve_parameter_locator(track, params.parameter_locator)
        except RpcError:
            raise
        except Exception as exc:
            raise RpcError(
                KNOWLEDGE_LOOKUP_FAILED,
                "failed to resolve parameter_locator",
                {"reason": str(exc), "locator": params.parameter_locator},
            ) from exc

        # Live: use create_or_get_automation_envelope
        getter = getattr(track, "create_or_get_automation_envelope", None)
        if getter is None:
            raise RpcError(
                INVALID_PARAMS,
                "track has no create_or_get_automation_envelope (Live version too old?)",
                {"track_index": params.track_index},
            )
        envelope = getter(parameter)

        with undo_step("arrangement.add_automation_point", song):
            # length=0 = single point. Live accepts this.
            envelope.insert_step(float(params.time), 0.0, float(params.value))

        return {
            "added": True,
            "track_index": params.track_index,
            "time": float(params.time),
            "value": float(params.value),
            "curve_type": params.curve_type,
        }
