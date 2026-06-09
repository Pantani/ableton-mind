"""
Dataclasses I/O para os métodos JSON-RPC da Phase 0.

Fonte da verdade: _workspace/contracts/phase0-methods.md
Drift entre este arquivo e o contrato é checado pelo qa-integration.

Cada Input é construído via `INPUT(**params)` no dispatcher. Campos opcionais
têm default; campos obrigatórios disparam TypeError, que o bridge converte em
JSON-RPC -32602 (Invalid params).
"""
from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# system.hello
# ---------------------------------------------------------------------------
@dataclass
class HelloInput:
    client: str = ""
    version: str = ""


# ---------------------------------------------------------------------------
# system.ping
# ---------------------------------------------------------------------------
@dataclass
class PingInput:
    pass


# ---------------------------------------------------------------------------
# transport.play
# ---------------------------------------------------------------------------
@dataclass
class PlayInput:
    from_beginning: bool = False


# ---------------------------------------------------------------------------
# transport.stop
# ---------------------------------------------------------------------------
@dataclass
class StopInput:
    pass


# ---------------------------------------------------------------------------
# transport.set_tempo
# ---------------------------------------------------------------------------
@dataclass
class SetTempoInput:
    bpm: float = 0.0


# ---------------------------------------------------------------------------
# track.list
# ---------------------------------------------------------------------------
@dataclass
class TrackListInput:
    include_master: bool = True
    include_returns: bool = True


# ---------------------------------------------------------------------------
# track.create
# ---------------------------------------------------------------------------
@dataclass
class TrackCreateInput:
    type: str = "midi"  # "midi" | "audio"
    index: Optional[int] = None  # None → append no fim
    name: Optional[str] = None


# ---------------------------------------------------------------------------
# track.upsert (idempotente: cria só se nome ainda não existe)
# ---------------------------------------------------------------------------
@dataclass
class TrackUpsertInput:
    name: str = ""
    type: str = "midi"  # "midi" | "audio"
    index: Optional[int] = None


# ---------------------------------------------------------------------------
# track.set_name
# ---------------------------------------------------------------------------
@dataclass
class TrackSetNameInput:
    index: int = -1
    name: str = ""


# ---------------------------------------------------------------------------
# track.set_volume
# ---------------------------------------------------------------------------
@dataclass
class TrackSetVolumeInput:
    index: int = -1
    volume: float = 0.0  # 0..1 normalized (ADR-0004)


# ---------------------------------------------------------------------------
# track.get_info — detail read-only
# ---------------------------------------------------------------------------
@dataclass
class TrackGetInfoInput:
    index: int = -1


# ---------------------------------------------------------------------------
# scene.fire
# ---------------------------------------------------------------------------
@dataclass
class SceneFireInput:
    index: int = -1


# ---------------------------------------------------------------------------
# clip.set_loop
# ---------------------------------------------------------------------------
@dataclass
class ClipSetLoopInput:
    track_index: int = -1
    clip_slot_index: int = -1
    loop_start: Optional[float] = None
    loop_end: Optional[float] = None
    looping: Optional[bool] = None


# ---------------------------------------------------------------------------
# clip.create_midi
# ---------------------------------------------------------------------------
@dataclass
class CreateMidiClipInput:
    track_index: int = -1
    clip_slot_index: int = -1
    length_beats: float = 4.0
    name: Optional[str] = None


# ---------------------------------------------------------------------------
# clip.add_notes (ADR-0003)
# ---------------------------------------------------------------------------
@dataclass
class NoteSpec:
    pitch: int = 60
    start: float = 0.0
    duration: float = 0.25
    velocity: int = 100
    mute: bool = False


@dataclass
class ClipAddNotesInput:
    track_index: int = -1
    clip_slot_index: int = -1
    notes: list = field(default_factory=list)  # list[dict] no wire; convertemos no handler


# ---------------------------------------------------------------------------
# clip.fire / clip.stop / clip.set_name
# ---------------------------------------------------------------------------
@dataclass
class ClipFireInput:
    track_index: int = -1
    clip_slot_index: int = -1


@dataclass
class ClipStopInput:
    track_index: int = -1
    clip_slot_index: int = -1


@dataclass
class ClipSetNameInput:
    track_index: int = -1
    clip_slot_index: int = -1
    name: str = ""


# ---------------------------------------------------------------------------
# session.get_info — read-only top-level snapshot
# ---------------------------------------------------------------------------
@dataclass
class SessionGetInfoInput:
    pass


# ---------------------------------------------------------------------------
# browser.get_categories — read-only
# ---------------------------------------------------------------------------
@dataclass
class BrowserGetCategoriesInput:
    pass


# ---------------------------------------------------------------------------
# browser.load_item — carrega item no track selecionado/armado
# ---------------------------------------------------------------------------
@dataclass
class BrowserLoadItemInput:
    path: list = field(default_factory=list)  # ex: ["instruments", "Wavetable", "Pads", "Air Pad"]


# ---------------------------------------------------------------------------
# device.get_parameters — list params do device em (track, device_index)
# ---------------------------------------------------------------------------
@dataclass
class DeviceGetParametersInput:
    track_index: int = -1
    device_index: int = -1


# ---------------------------------------------------------------------------
# device.set_parameter — set por index. Resolução por name é responsabilidade do TS.
# ---------------------------------------------------------------------------
@dataclass
class DeviceSetParameterInput:
    track_index: int = -1
    device_index: int = -1
    parameter_index: int = -1
    value: float = 0.0


# ---------------------------------------------------------------------------
# clip.envelope_set_points (Phase 4 — ADR-0006)
# ---------------------------------------------------------------------------
# parameter_locator: dict resolvido pelo TS para "mixer.volume", "device.0.<index>", etc.
# Format: { kind: "mixer_volume" | "mixer_panning" | "mixer_send" | "device_param",
#          device_index?: int, parameter_index?: int, send_index?: int }
@dataclass
class ClipEnvelopeSetPointsInput:
    track_index: int = -1
    clip_slot_index: int = -1
    parameter_locator: dict = field(default_factory=dict)
    points: list = field(default_factory=list)  # [{time, value, curve_type?}]


# ---------------------------------------------------------------------------
# arrangement.add_automation_point (Phase 4)
# ---------------------------------------------------------------------------
@dataclass
class ArrangementAddAutomationPointInput:
    track_index: int = -1
    parameter_locator: dict = field(default_factory=dict)
    time: float = 0.0
    value: float = 0.0
    curve_type: str = "linear"


# ---------------------------------------------------------------------------
# session.snapshot / session.diff / render.preview (Phase 5)
# ---------------------------------------------------------------------------
@dataclass
class SessionSnapshotInput:
    include_clips: bool = True
    include_devices: bool = True


@dataclass
class SessionDiffInput:
    previous: dict = field(default_factory=dict)


@dataclass
class RenderPreviewInput:
    mode: str = "snapshot"  # "snapshot" | "bounce" (Cycle 10)
    bars: int = 8


# ---------------------------------------------------------------------------
# push.* (Phase 6 — ADR-0008)
# ---------------------------------------------------------------------------
@dataclass
class PushSetPadColorInput:
    pad: int = -1   # 0..63
    color: int = 0  # 0..127


@dataclass
class PushSetButtonLedInput:
    button: str = ""
    color: int = 0
    mode: str = "solid"  # solid | blink | pulse


@dataclass
class PushSetModeInput:
    mode: str = "note"  # note | session | drum | step
