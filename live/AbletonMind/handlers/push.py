"""
Handlers Push 2/3 (Phase 6 start — ADR-0008).

Ableton Push usa Sysex MIDI para LEDs/pads. Frame: F0 00 21 1D 01 01 <cmd> <args> F7.

Bridge envia via `ctrl._send_midi(bytes)`. Em headless / sem Push, devolve
`-32000` com `detected: false`.

Buttons canônicos (subset Cycle 10):
  Play, Record, Stop, Tap Tempo, Metronome, Undo, Mute, Solo, Master,
  Note, Session, Browse, Add Track, Add Device, Setup, Shift, Select.
"""
from ..errors import LIVE_NOT_RUNNING, OBJECT_NOT_FOUND, OUT_OF_RANGE, RpcError
from ..schemas import PushSetButtonLedInput, PushSetModeInput, PushSetPadColorInput
from ._base import Handler, register

# Sysex prefix (Ableton vendor 00 21 1D, Push device family 01 01).
_SYSEX_PREFIX = bytes([0xF0, 0x00, 0x21, 0x1D, 0x01, 0x01])
_SYSEX_END = bytes([0xF7])

# Commands (Push 2/3 — referência docs Ableton Push API).
_CMD_SET_PAD_COLOR = 0x04
_CMD_SET_BUTTON_LED = 0x05
_CMD_SET_MODE = 0x0A

_PUSH_MODES = {"note": 0, "session": 1, "drum": 2, "step": 3}

# Modes para botões.
_BUTTON_MODES = {"solid": 0, "blink": 1, "pulse": 2}

# Map button name → MIDI CC number (canônico Push 2/3 — subset).
_BUTTON_CCS = {
    "Play": 85,
    "Record": 86,
    "Stop": 29,
    "Tap Tempo": 3,
    "Metronome": 9,
    "Undo": 119,
    "Mute": 60,
    "Solo": 61,
    "Master": 28,
    "Note": 50,
    "Session": 51,
    "Browse": 111,
    "Add Track": 53,
    "Add Device": 52,
    "Setup": 30,
    "Shift": 49,
    "Select": 48,
}


def _has_push(ctrl) -> bool:
    """Detecção heurística: ctrl.application().control_surfaces tem alguma com
    name contendo 'Push'? Em headless retorna False."""
    app = getattr(ctrl, "application", None) or getattr(ctrl, "_application", None)
    if app is None:
        return False
    surfaces = list(getattr(app, "control_surfaces", []) or [])
    for s in surfaces:
        if "push" in str(getattr(s, "name", "")).lower():
            return True
    return False


def _send_sysex(ctrl, payload: bytes) -> None:
    sender = getattr(ctrl, "_send_midi", None) or getattr(ctrl, "send_midi", None)
    if sender is None:
        raise RpcError(
            LIVE_NOT_RUNNING,
            "no midi sender on ctrl",
            {"hint": "headless mode"},
        )
    msg = _SYSEX_PREFIX + payload + _SYSEX_END
    sender(tuple(msg))


@register("push.set_pad_color")
class PushSetPadColorHandler(Handler):
    INPUT = PushSetPadColorInput

    def execute(self, params: PushSetPadColorInput) -> dict:
        if not _has_push(self.ctrl):
            raise RpcError(
                LIVE_NOT_RUNNING,
                "Push not detected",
                {"detected": False, "hint": "Connect Push 2 or 3 + activate Control Surface."},
            )
        if params.pad < 0 or params.pad > 63:
            raise RpcError(
                OUT_OF_RANGE,
                "pad out of range",
                {"min": 0, "max": 63, "got": params.pad},
            )
        if params.color < 0 or params.color > 127:
            raise RpcError(
                OUT_OF_RANGE,
                "color out of range",
                {"min": 0, "max": 127, "got": params.color},
            )
        # Sysex: cmd, pad, color
        _send_sysex(self.ctrl, bytes([_CMD_SET_PAD_COLOR, params.pad, params.color]))
        return {"pad": params.pad, "color": params.color, "sent": True}


@register("push.set_button_led")
class PushSetButtonLedHandler(Handler):
    INPUT = PushSetButtonLedInput

    def execute(self, params: PushSetButtonLedInput) -> dict:
        if not _has_push(self.ctrl):
            raise RpcError(
                LIVE_NOT_RUNNING,
                "Push not detected",
                {"detected": False},
            )
        if params.button not in _BUTTON_CCS:
            raise RpcError(
                OBJECT_NOT_FOUND,
                "unknown button",
                {"valid": sorted(_BUTTON_CCS.keys()), "got": params.button},
            )
        if params.color < 0 or params.color > 127:
            raise RpcError(
                OUT_OF_RANGE,
                "color out of range",
                {"min": 0, "max": 127, "got": params.color},
            )
        mode = _BUTTON_MODES.get(params.mode)
        if mode is None:
            raise RpcError(
                OBJECT_NOT_FOUND,
                "unknown mode",
                {"valid": sorted(_BUTTON_MODES.keys()), "got": params.mode},
            )
        cc = _BUTTON_CCS[params.button]
        _send_sysex(self.ctrl, bytes([_CMD_SET_BUTTON_LED, cc, params.color, mode]))
        return {
            "button": params.button,
            "color": params.color,
            "mode": params.mode,
            "sent": True,
        }


@register("push.set_mode")
class PushSetModeHandler(Handler):
    INPUT = PushSetModeInput

    def execute(self, params: PushSetModeInput) -> dict:
        if not _has_push(self.ctrl):
            raise RpcError(LIVE_NOT_RUNNING, "Push not detected", {"detected": False})
        mode_byte = _PUSH_MODES.get(params.mode)
        if mode_byte is None:
            raise RpcError(
                OBJECT_NOT_FOUND,
                "unknown push mode",
                {"valid": sorted(_PUSH_MODES.keys()), "got": params.mode},
            )
        _send_sysex(self.ctrl, bytes([_CMD_SET_MODE, mode_byte]))
        return {"mode": params.mode, "sent": True}
