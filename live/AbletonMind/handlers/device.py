"""
device.* handlers (Cycle 5).

`device.get_parameters` — read-only. Lists every device param, with
`name`, `value`, `min`, `max`, `is_quantized`, `value_items` (enum).

`device.set_parameter` — set by index. name→index resolution happens on
the TS side via knowledge (`src/knowledge/devices/<id>.json`). The bridge
doesn't need the knowledge.

`device.inspect_patcher` / `device.inspect_plugin` — Phase 8 read-only
discovery helpers. These only read public-ish attributes when Live exposes
them and degrade to `available=false` when unsupported by the runtime.
"""
from ..errors import (
    LIVE_NOT_RUNNING,
    OBJECT_NOT_FOUND,
    OUT_OF_RANGE,
    RpcError,
)
from ..schemas import (
    DeviceGetParametersInput,
    DeviceInspectPatcherInput,
    DeviceInspectPluginInput,
    DeviceSetParameterInput,
)
from ..transactions import undo_step
from ._base import Handler, register

_MISSING = object()


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


def _safe_get(obj, name: str, default=_MISSING):
    if obj is None:
        return default
    try:
        return getattr(obj, name)
    except Exception:
        return default


def _safe_sequence(value) -> list:
    if value is _MISSING or value is None:
        return []
    try:
        return list(value)
    except Exception:
        return []


def _safe_str(value, default: str = "") -> str:
    if value is _MISSING or value is None:
        return default
    try:
        return str(value)
    except Exception:
        return default


def _safe_optional_str(value):
    text = _safe_str(value, "")
    return text if text != "" else None


def _safe_float(value, default: float = 0.0) -> float:
    if value is _MISSING or value is None:
        return default
    try:
        return float(value)
    except Exception:
        return default


def _safe_optional_float(value):
    if value is _MISSING or value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _safe_optional_int(value):
    if value is _MISSING or value is None:
        return None
    try:
        return int(value)
    except Exception:
        return None


def _safe_optional_bool(value):
    if value is _MISSING or value is None:
        return None
    try:
        return bool(value)
    except Exception:
        return None


def _json_scalar(value):
    if value is _MISSING:
        return None
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return _safe_str(value, None)


def _read_first(obj, names: list) -> tuple:
    missing = []
    for name in names:
        value = _safe_get(obj, name, _MISSING)
        if value is not _MISSING and value is not None and value != "":
            return name, value, missing
        missing.append(name)
    return "", _MISSING, missing


def _snapshot_param(p, index: int) -> dict:
    items = _safe_sequence(_safe_get(p, "value_items", []))
    return {
        "index": index,
        "name": _safe_str(_safe_get(p, "name", "")),
        "value": _safe_float(_safe_get(p, "value", 0.0), 0.0),
        "min": _safe_float(_safe_get(p, "min", 0.0), 0.0),
        "max": _safe_float(_safe_get(p, "max", 1.0), 1.0),
        "is_quantized": bool(_safe_optional_bool(_safe_get(p, "is_quantized", False))),
        "value_items": [str(x) for x in items],
        "automation_state": int(_safe_optional_int(_safe_get(p, "automation_state", 0)) or 0),
    }


def _parameter_snapshot(device) -> list:
    return [_snapshot_param(p, i) for i, p in enumerate(_safe_sequence(_safe_get(device, "parameters", [])))]


def _device_summary(device, track_index: int, device_index: int) -> dict:
    chains = _safe_sequence(_safe_get(device, "chains", []))
    return {
        "track_index": track_index,
        "device_index": device_index,
        "name": _safe_str(_safe_get(device, "name", "")),
        "class_name": _safe_str(_safe_get(device, "class_name", "")),
        "class_display_name": _safe_str(_safe_get(device, "class_display_name", "")),
        "type": _json_scalar(_safe_get(device, "type", None)),
        "is_active": _safe_optional_bool(_safe_get(device, "is_active", None)),
        "is_enabled": _safe_optional_bool(_safe_get(device, "is_enabled", None)),
        "can_have_chains": _safe_optional_bool(_safe_get(device, "can_have_chains", None)),
        "chain_count": len(chains),
    }


def _device_and_patcher_attr(device, patcher, device_names: list, patcher_names: list) -> tuple:
    name, value, missing = _read_first(device, device_names)
    if value is not _MISSING:
        return name, value, missing
    if patcher is not _MISSING and patcher is not None:
        p_name, p_value, p_missing = _read_first(patcher, patcher_names)
        missing.extend([f"patcher.{x}" for x in p_missing])
        if p_value is not _MISSING:
            return f"patcher.{p_name}", p_value, missing
    return "", _MISSING, missing


def _infer_plugin_format(raw_format, class_text: str):
    fmt_text = _safe_str(raw_format, "").lower()
    text = f"{fmt_text} {class_text}".lower()
    if "vst3" in text:
        return "vst3"
    if "vst" in text:
        return "vst"
    if "auplugindevice" in text or "audio unit" in text or "audiounit" in text:
        return "au"
    if "plugin" in text:
        return "unknown"
    return None


@register("device.get_parameters")
class DeviceGetParametersHandler(Handler):
    INPUT = DeviceGetParametersInput

    def execute(self, params: DeviceGetParametersInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        _, device = _resolve_device(song, params.track_index, params.device_index)
        snapshot = _parameter_snapshot(device)
        return {
            "device_name": _safe_str(_safe_get(device, "name", "")),
            "class_name": _safe_str(_safe_get(device, "class_name", "")),
            "parameters": snapshot,
            "total": len(snapshot),
        }


@register("device.inspect_patcher")
class DeviceInspectPatcherHandler(Handler):
    INPUT = DeviceInspectPatcherInput

    def execute(self, params: DeviceInspectPatcherInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        _, device = _resolve_device(song, params.track_index, params.device_index)

        summary = _device_summary(device, params.track_index, params.device_index)
        parameters = _parameter_snapshot(device)
        patcher = _safe_get(device, "patcher", _MISSING)
        unsupported = []

        _, patcher_name, missing = _device_and_patcher_attr(
            device,
            patcher,
            ["patcher_name", "max_patcher_name", "amxd_name", "patcher_filename"],
            ["name", "filename"],
        )
        unsupported.extend(missing)
        _, patcher_path, missing = _device_and_patcher_attr(
            device,
            patcher,
            ["patcher_path", "max_patcher_path", "amxd_path", "file_path"],
            ["path", "file_path"],
        )
        unsupported.extend(missing)
        _, identifier, missing = _device_and_patcher_attr(
            device,
            patcher,
            ["max_device_id", "patcher_id", "amxd_id"],
            ["id", "identifier"],
        )
        unsupported.extend(missing)
        _, frozen, missing = _device_and_patcher_attr(
            device,
            patcher,
            ["is_frozen", "patcher_is_frozen"],
            ["is_frozen"],
        )
        unsupported.extend(missing)

        class_text = " ".join(
            [
                summary["name"],
                summary["class_name"],
                summary["class_display_name"],
                _safe_str(summary["type"], ""),
            ]
        ).lower()
        exposes_patcher = patcher is not _MISSING and patcher is not None
        has_patcher_metadata = any(
            value is not _MISSING and value is not None and value != ""
            for value in (patcher_name, patcher_path, identifier, frozen)
        )
        is_max_for_live = (
            "mxdevice" in class_text
            or "max for live" in class_text
            or "maxforlive" in class_text
            or exposes_patcher
            or has_patcher_metadata
        )
        available = bool(is_max_for_live)

        return {
            "available": available,
            "read_only": True,
            "is_max_for_live": available,
            "reason": None if available else "device does not expose Max for Live patcher metadata",
            "device": summary,
            "patcher": {
                "name": _safe_optional_str(patcher_name),
                "path": _safe_optional_str(patcher_path),
                "identifier": _safe_optional_str(identifier),
                "is_frozen": _safe_optional_bool(frozen),
                "can_have_chains": summary["can_have_chains"],
                "chain_count": summary["chain_count"],
            }
            if available
            else None,
            "parameters": parameters,
            "total_parameters": len(parameters),
            "unsupported_attributes": sorted(set(unsupported)),
        }


@register("device.inspect_plugin")
class DeviceInspectPluginHandler(Handler):
    INPUT = DeviceInspectPluginInput

    def execute(self, params: DeviceInspectPluginInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        _, device = _resolve_device(song, params.track_index, params.device_index)

        summary = _device_summary(device, params.track_index, params.device_index)
        parameters = _parameter_snapshot(device)
        unsupported = []

        _, raw_format, missing = _read_first(device, ["plugin_format", "plug_in_format"])
        unsupported.extend(missing)
        _, plugin_name, missing = _read_first(device, ["plugin_name", "plug_in_name"])
        unsupported.extend(missing)
        _, vendor, missing = _read_first(device, ["plugin_vendor", "plug_in_vendor", "vendor"])
        unsupported.extend(missing)
        _, version, missing = _read_first(device, ["plugin_version", "plug_in_version"])
        unsupported.extend(missing)
        _, identifier, missing = _read_first(
            device,
            ["plugin_identifier", "plugin_unique_id", "plugin_id", "plug_in_identifier"],
        )
        unsupported.extend(missing)
        _, path, missing = _read_first(device, ["plugin_path", "plug_in_path", "file_path"])
        unsupported.extend(missing)
        _, preset_name, missing = _read_first(device, ["preset_name", "selected_preset_name"])
        unsupported.extend(missing)
        _, preset_index, missing = _read_first(device, ["preset_index", "selected_preset_index"])
        unsupported.extend(missing)

        class_text = " ".join(
            [
                summary["name"],
                summary["class_name"],
                summary["class_display_name"],
                _safe_str(summary["type"], ""),
            ]
        ).lower()
        plugin_format = _infer_plugin_format(raw_format, class_text)
        has_plugin_metadata = any(
            value is not _MISSING and value is not None and value != ""
            for value in (
                raw_format,
                plugin_name,
                vendor,
                version,
                identifier,
                path,
                preset_name,
                preset_index,
            )
        )
        is_plugin = (
            has_plugin_metadata
            or "plugindevice" in class_text
            or "vst" in class_text
            or "auplugindevice" in class_text
            or "audio unit" in class_text
            or "audiounit" in class_text
        )

        return {
            "available": bool(is_plugin),
            "read_only": True,
            "is_plugin": bool(is_plugin),
            "reason": None if is_plugin else "device does not expose plug-in metadata",
            "device": summary,
            "plugin": {
                "name": _safe_optional_str(plugin_name) or summary["name"],
                "format": plugin_format,
                "vendor": _safe_optional_str(vendor),
                "version": _safe_optional_str(version),
                "identifier": _safe_optional_str(identifier),
                "path": _safe_optional_str(path),
                "preset_name": _safe_optional_str(preset_name),
                "preset_index": _safe_optional_int(preset_index),
            }
            if is_plugin
            else None,
            "parameters": parameters,
            "total_parameters": len(parameters),
            "unsupported_attributes": sorted(set(unsupported)),
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
