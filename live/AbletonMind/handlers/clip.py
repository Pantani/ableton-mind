"""
Handler `clip.create_midi` — cria MIDI clip vazio num slot da Session view.

Transacional: envolve `Song.begin_undo_step()` / `end_undo_step()`. Idempotente:
se o slot já tem um clip, retorna -32005 com o nome do clip existente (Phase 0
não sobrescreve).

Read-before-write:
1. Confere que `track_index` cai em `song.tracks` (não em return/master).
2. Confere que a track é MIDI.
3. Confere que `clip_slot_index` é válido.
4. Confere que o slot está vazio.
"""
from ..errors import (
    INVALID_PARAMS,
    INVALID_STATE,
    KNOWLEDGE_LOOKUP_FAILED,
    LIVE_NOT_RUNNING,
    OBJECT_NOT_FOUND,
    OUT_OF_RANGE,
    TYPE_MISMATCH,
    RpcError,
)
from ..schemas import (
    ClipAddNotesInput,
    ClipEnvelopeSetPointsInput,
    ClipFireInput,
    ClipSetLoopInput,
    ClipSetNameInput,
    ClipStopInput,
    CreateMidiClipInput,
    NoteSpec,
)
from ..transactions import undo_step
from ._base import Handler, register


def _resolve_slot(song, track_index: int, clip_slot_index: int):
    """Valida indexes e devolve (track, slot). Levanta RpcError em qualquer falha.
    Compartilhado entre add_notes/fire/stop/set_name."""
    tracks = list(song.tracks)
    n = len(tracks)
    if track_index < 0 or track_index >= n:
        raise RpcError(
            OBJECT_NOT_FOUND,
            "track not found",
            {"num_tracks": n, "got": track_index},
        )
    track = tracks[track_index]
    slots = list(getattr(track, "clip_slots", []))
    ns = len(slots)
    if clip_slot_index < 0 or clip_slot_index >= ns:
        raise RpcError(
            OUT_OF_RANGE,
            "clip_slot_index out of range",
            {"min": 0, "max": max(0, ns - 1), "got": clip_slot_index},
        )
    return track, slots[clip_slot_index]


def _require_clip(slot, track_index: int, clip_slot_index: int):
    if not bool(getattr(slot, "has_clip", False)):
        raise RpcError(
            OBJECT_NOT_FOUND,
            "clip slot is empty",
            {"track_index": track_index, "clip_slot_index": clip_slot_index},
        )
    clip = getattr(slot, "clip", None)
    if clip is None:
        raise RpcError(
            -32001,
            "clip slot has_clip=True but clip is None",
            {"track_index": track_index, "clip_slot_index": clip_slot_index},
        )
    return clip


def _build_note(index: int, raw: dict) -> NoteSpec:
    try:
        return NoteSpec(
            pitch=int(raw.get("pitch", 60)),
            start=float(raw.get("start", 0.0)),
            duration=float(raw.get("duration", 0.25)),
            velocity=int(raw.get("velocity", 100)),
            mute=bool(raw.get("mute", False)),
        )
    except (TypeError, ValueError) as exc:
        raise RpcError(
            INVALID_PARAMS,
            "note has invalid field",
            {"index": index, "reason": str(exc)},
        ) from exc


def _validate_note(index: int, note: NoteSpec) -> None:
    if note.pitch < 0 or note.pitch > 127:
        raise RpcError(OUT_OF_RANGE, "pitch out of range", {"index": index, "min": 0, "max": 127, "got": note.pitch})
    if note.velocity < 0 or note.velocity > 127:
        raise RpcError(OUT_OF_RANGE, "velocity out of range", {"index": index, "min": 0, "max": 127, "got": note.velocity})
    if note.duration <= 0:
        raise RpcError(OUT_OF_RANGE, "duration must be > 0", {"index": index, "got": note.duration})
    if note.start < 0:
        raise RpcError(OUT_OF_RANGE, "start must be >= 0", {"index": index, "got": note.start})


def _parse_and_validate_notes(raw_notes) -> list:
    """Parse + valida cada nota. Extraído de `ClipAddNotesHandler.execute`
    para manter complexidade ciclomática ≤ 10."""
    if not isinstance(raw_notes, list) or len(raw_notes) == 0:
        raise RpcError(
            INVALID_PARAMS,
            "notes must be a non-empty list",
            {"got_type": type(raw_notes).__name__, "len": len(raw_notes) if isinstance(raw_notes, list) else 0},
        )
    parsed: list = []
    for i, n in enumerate(raw_notes):
        if not isinstance(n, dict):
            raise RpcError(INVALID_PARAMS, "note must be object", {"index": i, "got": str(n)[:80]})
        note = _build_note(i, n)
        _validate_note(i, note)
        parsed.append(note)
    return parsed


@register("clip.create_midi")
class CreateMidiClipHandler(Handler):
    INPUT = CreateMidiClipInput

    def execute(self, params: CreateMidiClipInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")

        tracks = list(song.tracks)
        num_tracks = len(tracks)

        # 1) track index válido?
        if params.track_index < 0 or params.track_index >= num_tracks:
            raise RpcError(
                OBJECT_NOT_FOUND,
                "track not found",
                {"num_tracks": num_tracks, "got": params.track_index},
            )
        track = tracks[params.track_index]

        # 2) é track MIDI?
        if not bool(getattr(track, "has_midi_input", False)):
            actual = "audio" if bool(getattr(track, "has_audio_input", False)) else "unknown"
            raise RpcError(
                TYPE_MISMATCH,
                "track is not MIDI",
                {"expected": "midi", "actual": actual, "track_index": params.track_index},
            )

        # 3) clip slot index válido?
        slots = list(getattr(track, "clip_slots", []))
        num_slots = len(slots)
        if params.clip_slot_index < 0 or params.clip_slot_index >= num_slots:
            raise RpcError(
                OUT_OF_RANGE,
                "clip_slot_index out of range",
                {"min": 0, "max": max(0, num_slots - 1), "got": params.clip_slot_index},
            )
        slot = slots[params.clip_slot_index]

        # 4) length_beats sensata
        if params.length_beats <= 0:
            raise RpcError(
                OUT_OF_RANGE,
                "length_beats must be > 0",
                {"min": 0.0, "got": params.length_beats},
            )

        # 5) slot ocupado? → INVALID_STATE
        if bool(getattr(slot, "has_clip", False)):
            existing = getattr(slot, "clip", None)
            existing_name = str(getattr(existing, "name", "")) if existing is not None else ""
            raise RpcError(
                INVALID_STATE,
                "clip slot already has a clip",
                {
                    "existing_clip_name": existing_name,
                    "track_index": params.track_index,
                    "clip_slot_index": params.clip_slot_index,
                },
            )

        # ---- mutação atômica ----
        with undo_step("clip.create_midi", song):
            # Live API: `ClipSlot.create_clip(length)` — duração em beats.
            slot.create_clip(float(params.length_beats))
            new_clip = getattr(slot, "clip", None)
            if new_clip is None:
                # LiveAPI deveria ter populado o clip; se não, undo step ainda fecha
                # via `finally`. Devolvemos -32001 (Live API call failed).
                raise RpcError(
                    -32001,
                    "Live did not create clip in slot",
                    {"track_index": params.track_index, "clip_slot_index": params.clip_slot_index},
                )
            if params.name:
                new_clip.name = params.name

        final_name = str(getattr(new_clip, "name", "") or "")
        final_len = float(getattr(new_clip, "length", params.length_beats) or params.length_beats)
        return {
            "changed": True,
            "clip": {
                "track_index": params.track_index,
                "clip_slot_index": params.clip_slot_index,
                "name": final_name,
                "length_beats": final_len,
            },
        }


@register("clip.add_notes")
class ClipAddNotesHandler(Handler):
    """Adiciona notas MIDI a um clip existente. Transacional, NÃO idempotente
    (chamar 2x adiciona 2x). Valida cada nota conforme ADR-0003.

    Para idempotência futura, usar `clip.replace_notes` (Phase 4).
    """

    INPUT = ClipAddNotesInput

    def execute(self, params: ClipAddNotesInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        _, slot = _resolve_slot(song, params.track_index, params.clip_slot_index)
        clip = _require_clip(slot, params.track_index, params.clip_slot_index)

        if not bool(getattr(clip, "is_midi_clip", True)):
            raise RpcError(
                TYPE_MISMATCH,
                "clip is not MIDI",
                {"track_index": params.track_index, "clip_slot_index": params.clip_slot_index},
            )

        parsed = _parse_and_validate_notes(params.notes)

        with undo_step("clip.add_notes", song):
            # LiveAPI Phase 1 — usa `add_new_notes` se disponível, senão fallback
            # para `set_notes` (older API). FakeClip nos testes implementa
            # `add_new_notes` com lista interna.
            if hasattr(clip, "add_new_notes"):
                clip.add_new_notes(
                    {
                        "notes": [
                            {
                                "pitch": n.pitch,
                                "start_time": n.start,
                                "duration": n.duration,
                                "velocity": n.velocity,
                                "mute": n.mute,
                            }
                            for n in parsed
                        ]
                    }
                )
            else:
                # legacy fallback
                clip.set_notes(
                    tuple(
                        (n.pitch, n.start, n.duration, n.velocity, n.mute) for n in parsed
                    )
                )

        return {
            "changed": True,
            "added": len(parsed),
            "track_index": params.track_index,
            "clip_slot_index": params.clip_slot_index,
        }


@register("clip.fire")
class ClipFireHandler(Handler):
    """Dispara o clip num slot. Idempotente: se já tocando, retorna changed=False."""

    INPUT = ClipFireInput

    def execute(self, params: ClipFireInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        _, slot = _resolve_slot(song, params.track_index, params.clip_slot_index)
        clip = _require_clip(slot, params.track_index, params.clip_slot_index)
        was_playing = bool(getattr(clip, "is_playing", False))
        if was_playing:
            return {
                "changed": False,
                "is_playing": True,
                "track_index": params.track_index,
                "clip_slot_index": params.clip_slot_index,
            }
        # Live API: `ClipSlot.fire()` ou `Clip.fire()`. Preferimos slot.fire().
        slot.fire()
        return {
            "changed": True,
            "is_playing": bool(getattr(clip, "is_playing", True)),
            "track_index": params.track_index,
            "clip_slot_index": params.clip_slot_index,
        }


@register("clip.stop")
class ClipStopHandler(Handler):
    """Para o clip num slot. Idempotente."""

    INPUT = ClipStopInput

    def execute(self, params: ClipStopInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        _, slot = _resolve_slot(song, params.track_index, params.clip_slot_index)
        clip = _require_clip(slot, params.track_index, params.clip_slot_index)
        was_playing = bool(getattr(clip, "is_playing", False))
        if not was_playing:
            return {
                "changed": False,
                "is_playing": False,
                "track_index": params.track_index,
                "clip_slot_index": params.clip_slot_index,
            }
        slot.stop()
        return {
            "changed": True,
            "is_playing": bool(getattr(clip, "is_playing", False)),
            "track_index": params.track_index,
            "clip_slot_index": params.clip_slot_index,
        }


@register("clip.set_name")
class ClipSetNameHandler(Handler):
    """Renomeia um clip. Idempotente."""

    INPUT = ClipSetNameInput

    def execute(self, params: ClipSetNameInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        _, slot = _resolve_slot(song, params.track_index, params.clip_slot_index)
        clip = _require_clip(slot, params.track_index, params.clip_slot_index)
        before = str(getattr(clip, "name", ""))
        if before == params.name:
            return {"changed": False, "before": before, "after": before}
        with undo_step("clip.set_name", song):
            clip.name = params.name
        after = str(getattr(clip, "name", ""))
        return {"changed": True, "before": before, "after": after}


# ---------------------------------------------------------------------------
# parameter_locator resolution (compartilhado com arrangement.py)
# ---------------------------------------------------------------------------


def _resolve_mixer_simple(track, attr: str, label: str):
    mixer = getattr(track, "mixer_device", None)
    obj = getattr(mixer, attr, None) if mixer is not None else None
    if obj is None:
        raise RpcError(KNOWLEDGE_LOOKUP_FAILED, f"mixer.{label} unavailable", {})
    return obj


def _resolve_mixer_send(track, locator: dict):
    si = int(locator.get("send_index", -1))
    mixer = getattr(track, "mixer_device", None)
    sends = list(getattr(mixer, "sends", []) or [])
    if si < 0 or si >= len(sends):
        raise RpcError(
            KNOWLEDGE_LOOKUP_FAILED,
            "send_index out of range",
            {"num_sends": len(sends), "got": si},
        )
    return sends[si]


def _resolve_device_param(track, locator: dict):
    di = int(locator.get("device_index", -1))
    pi = int(locator.get("parameter_index", -1))
    devices = list(getattr(track, "devices", []) or [])
    if di < 0 or di >= len(devices):
        raise RpcError(
            KNOWLEDGE_LOOKUP_FAILED,
            "device_index out of range",
            {"num_devices": len(devices), "got": di},
        )
    params_ = list(getattr(devices[di], "parameters", []) or [])
    if pi < 0 or pi >= len(params_):
        raise RpcError(
            KNOWLEDGE_LOOKUP_FAILED,
            "parameter_index out of range",
            {"num_parameters": len(params_), "got": pi},
        )
    return params_[pi]


def _validate_envelope_points(points) -> None:
    """Garante que `points` é list[dict] com keys `time`/`value`.
    Extraído de `ClipEnvelopeSetPointsHandler.execute` para manter CC ≤ 10."""
    if not isinstance(points, list):
        raise RpcError(INVALID_PARAMS, "points must be list", {"got": type(points).__name__})
    for i, pt in enumerate(points):
        if not isinstance(pt, dict):
            raise RpcError(INVALID_PARAMS, "point must be object", {"index": i})
        if "time" not in pt or "value" not in pt:
            raise RpcError(INVALID_PARAMS, "point missing time/value", {"index": i})


def _resolve_parameter_locator(track, locator: dict):
    """Devolve o objeto `DeviceParameter` apontado pelo locator.

    Format: { kind: "mixer_volume" | "mixer_panning" | "mixer_send" | "device_param",
              device_index?: int, parameter_index?: int, send_index?: int }

    Levanta RpcError se locator inválido ou objeto não encontrado.
    """
    if not isinstance(locator, dict):
        raise RpcError(INVALID_PARAMS, "parameter_locator must be object", {"got": str(locator)[:80]})
    kind = locator.get("kind")
    if kind == "mixer_volume":
        return _resolve_mixer_simple(track, "volume", "volume")
    if kind == "mixer_panning":
        return _resolve_mixer_simple(track, "panning", "panning")
    if kind == "mixer_send":
        return _resolve_mixer_send(track, locator)
    if kind == "device_param":
        return _resolve_device_param(track, locator)
    raise RpcError(
        INVALID_PARAMS,
        "unsupported locator kind",
        {"valid": ["mixer_volume", "mixer_panning", "mixer_send", "device_param"], "got": kind},
    )


@register("clip.envelope_set_points")
class ClipEnvelopeSetPointsHandler(Handler):
    """Substitui TODOS os pontos de um clip automation envelope.
    Idempotente em sentido fraco: chamadas com a mesma lista = mesmo resultado.

    LiveAPI:
      - `clip.create_automation_envelope(parameter)` → ClipEnvelope
      - `envelope.clear()` apaga pontos
      - `envelope.insert_step(time, length, value)` insere
    """

    INPUT = ClipEnvelopeSetPointsInput

    def execute(self, params: ClipEnvelopeSetPointsInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        track, slot = _resolve_slot(song, params.track_index, params.clip_slot_index)
        clip = _require_clip(slot, params.track_index, params.clip_slot_index)

        parameter = _resolve_parameter_locator(track, params.parameter_locator)

        getter = getattr(clip, "create_automation_envelope", None)
        if getter is None:
            raise RpcError(
                INVALID_PARAMS,
                "clip has no create_automation_envelope (Live version?)",
                {},
            )

        _validate_envelope_points(params.points)

        with undo_step("clip.envelope_set_points", song):
            envelope = getter(parameter)
            clear = getattr(envelope, "clear", None)
            if clear is not None:
                clear()
            inserted = 0
            # TD-023: curve_type real.
            #   - "linear" (default) / "ramp" → 1 step puro.
            #   - "hold" → 2 steps: valor anterior até `time`, depois pula.
            #     Sem ponto anterior (1º point), trata como linear.
            for i, pt in enumerate(params.points):
                t = float(pt["time"])
                v = float(pt["value"])
                ct = str(pt.get("curve_type", "linear")).lower()
                if ct == "hold" and i > 0:
                    prev = params.points[i - 1]
                    prev_value = float(prev["value"])
                    # Insere um step com valor "prev" infinitesimamente antes de `t`
                    # para criar a borda de hold. Live aceita length pequenos.
                    eps = 1e-4
                    envelope.insert_step(max(0.0, t - eps), 0.0, prev_value)
                    inserted += 1
                envelope.insert_step(t, 0.0, v)
                inserted += 1

        return {
            "changed": True,
            "replaced": True,
            "points": inserted,
            "track_index": params.track_index,
            "clip_slot_index": params.clip_slot_index,
        }


@register("clip.set_loop")
class ClipSetLoopHandler(Handler):
    """Configura loop_start/loop_end/looping de um clip. Idempotente em 1e-4.

    Aceita 0..3 dos campos; campos `None` ficam intocados. Antes de mutar
    valida que `loop_start < loop_end`. Encapsula em undo_step se mutou.
    """

    INPUT = ClipSetLoopInput

    def execute(self, params: ClipSetLoopInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        _, slot = _resolve_slot(song, params.track_index, params.clip_slot_index)
        clip = _require_clip(slot, params.track_index, params.clip_slot_index)

        before_start = float(getattr(clip, "loop_start", 0.0))
        before_end = float(getattr(clip, "loop_end", before_start + 1.0))
        before_loop = bool(getattr(clip, "looping", False))

        new_start = before_start if params.loop_start is None else float(params.loop_start)
        new_end = before_end if params.loop_end is None else float(params.loop_end)
        new_loop = before_loop if params.looping is None else bool(params.looping)

        if new_end <= new_start:
            raise RpcError(
                OUT_OF_RANGE,
                "loop_end must be > loop_start",
                {"loop_start": new_start, "loop_end": new_end},
            )

        if (
            abs(new_start - before_start) < 1e-4
            and abs(new_end - before_end) < 1e-4
            and new_loop == before_loop
        ):
            return {
                "changed": False,
                "before": {"loop_start": before_start, "loop_end": before_end, "looping": before_loop},
                "after": {"loop_start": before_start, "loop_end": before_end, "looping": before_loop},
            }

        with undo_step("clip.set_loop", song):
            if abs(new_start - before_start) >= 1e-4:
                clip.loop_start = new_start
            if abs(new_end - before_end) >= 1e-4:
                clip.loop_end = new_end
            if new_loop != before_loop:
                clip.looping = new_loop

        return {
            "changed": True,
            "before": {"loop_start": before_start, "loop_end": before_end, "looping": before_loop},
            "after": {
                "loop_start": float(getattr(clip, "loop_start", new_start)),
                "loop_end": float(getattr(clip, "loop_end", new_end)),
                "looping": bool(getattr(clip, "looping", new_loop)),
            },
        }
