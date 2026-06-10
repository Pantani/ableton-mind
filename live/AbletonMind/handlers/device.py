"""
device.* handlers (Cycle 5).

`device.get_parameters` — read-only. Lists every device param, with
`name`, `value`, `min`, `max`, `is_quantized`, `value_items` (enum).

`device.set_parameter` — set by index. name→index resolution happens on
the TS side via knowledge (`src/knowledge/devices/<id>.json`). The bridge
doesn't need the knowledge.
"""
from ..errors import (
    LIVE_NOT_RUNNING,
    OBJECT_NOT_FOUND,
    OUT_OF_RANGE,
    RpcError,
)
from ..schemas import DeviceGetParametersInput, DeviceSetParameterInput
from ..transactions import undo_step
from ._base import Handler, register


def _resolve_device(song, track_index: int, device_index: int):
    tracks = list(song.tracks)
    n = len(tracks)
    if track_index < 0 or track_index >= n:
        raise RpcError(
            OBJECT_NOT_FOUND,
            "track not found",
            {"num_tracks": n, "got": track_index},
        )
    track = tracks[track_index]
    devices = list(getattr(track, "devices", []) or [])
    nd = len(devices)
    if device_index < 0 or device_index >= nd:
        raise RpcError(
            OBJECT_NOT_FOUND,
            "device not found",
            {"track_index": track_index, "num_devices": nd, "got": device_index},
        )
    return track, devices[device_index]


def _snapshot_param(p, index: int) -> dict:
    items = list(getattr(p, "value_items", []) or [])
    return {
        "index": index,
        "name": str(getattr(p, "name", "")),
        "value": float(getattr(p, "value", 0.0)),
        "min": float(getattr(p, "min", 0.0)),
        "max": float(getattr(p, "max", 1.0)),
        "is_quantized": bool(getattr(p, "is_quantized", False)),
        "value_items": [str(x) for x in items],
        "automation_state": int(getattr(p, "automation_state", 0)),
    }


@register("device.get_parameters")
class DeviceGetParametersHandler(Handler):
    INPUT = DeviceGetParametersInput

    def execute(self, params: DeviceGetParametersInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        _, device = _resolve_device(song, params.track_index, params.device_index)
        plist = list(getattr(device, "parameters", []) or [])
        snapshot = [_snapshot_param(p, i) for i, p in enumerate(plist)]
        return {
            "device_name": str(getattr(device, "name", "")),
            "class_name": str(getattr(device, "class_name", "")),
            "parameters": snapshot,
            "total": len(snapshot),
        }


@register("device.set_parameter")
class DeviceSetParameterHandler(Handler):
    """Set by index. Idempotent within 1e-4 (for floats) or exact equality
    (for is_quantized=True)."""

    INPUT = DeviceSetParameterInput

    def execute(self, params: DeviceSetParameterInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        _, device = _resolve_device(song, params.track_index, params.device_index)
        plist = list(getattr(device, "parameters", []) or [])
        np = len(plist)
        if params.parameter_index < 0 or params.parameter_index >= np:
            raise RpcError(
                OBJECT_NOT_FOUND,
                "parameter not found",
                {"device_name": str(getattr(device, "name", "")), "num_parameters": np, "got": params.parameter_index},
            )
        p = plist[params.parameter_index]
        pmin = float(getattr(p, "min", 0.0))
        pmax = float(getattr(p, "max", 1.0))
        if params.value < pmin or params.value > pmax:
            raise RpcError(
                OUT_OF_RANGE,
                "value out of range",
                {"min": pmin, "max": pmax, "got": params.value, "param_name": str(getattr(p, "name", ""))},
            )
        before = float(p.value)
        is_quantized = bool(getattr(p, "is_quantized", False))
        if is_quantized:
            same = int(round(before)) == int(round(params.value))
        else:
            same = abs(before - params.value) < 1e-4
        if same:
            return {
                "changed": False,
                "name": str(getattr(p, "name", "")),
                "before": before,
                "after": before,
            }
        with undo_step("device.set_parameter", song):
            p.value = float(params.value)
        after = float(p.value)
        return {
            "changed": True,
            "name": str(getattr(p, "name", "")),
            "before": before,
            "after": after,
        }
