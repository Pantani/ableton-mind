"""
Handlers de transporte: play, stop, set_tempo.

Todos idempotentes. Lemos o estado antes de mutar; se já está no alvo,
retornamos `changed: false` e não tocamos no Live (evita undo step inútil e
restart de loops).
"""
from ..errors import LIVE_NOT_RUNNING, OUT_OF_RANGE, RpcError
from ..schemas import PlayInput, SetTempoInput, StopInput
from ._base import Handler, register

# Faixa de tempo aceita pelo Live (docs Cycling74 / Live 12).
TEMPO_MIN = 20.0
TEMPO_MAX = 999.0


def _require_song(handler) -> object:
    """Garante que `ctrl.song()` retorna algo (Live aberto)."""
    song = handler.song
    if song is None:
        raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
    return song


@register("transport.play")
class PlayHandler(Handler):
    INPUT = PlayInput

    def execute(self, params: PlayInput) -> dict:
        song = _require_song(self)
        was_playing = bool(song.is_playing)

        if params.from_beginning:
            # `start_playing` recomeça do começo da song (current_song_time = 0).
            # Mesmo se `is_playing` for True, "from_beginning" muda o estado:
            # consideramos `changed` = True a menos que já esteja em t=0 tocando.
            if was_playing and float(song.current_song_time) == 0.0:
                changed = False
            else:
                song.current_song_time = 0.0
                song.start_playing()
                changed = True
        else:
            if was_playing:
                changed = False
            else:
                song.start_playing()
                changed = True

        return {
            "changed": changed,
            "is_playing": bool(song.is_playing),
            "current_song_time": float(song.current_song_time),
        }


@register("transport.stop")
class StopHandler(Handler):
    INPUT = StopInput

    def execute(self, params: StopInput) -> dict:
        song = _require_song(self)
        was_playing = bool(song.is_playing)
        if was_playing:
            song.stop_playing()
            changed = True
        else:
            changed = False
        return {
            "changed": changed,
            "is_playing": bool(song.is_playing),
            "current_song_time": float(song.current_song_time),
        }


@register("transport.set_tempo")
class SetTempoHandler(Handler):
    INPUT = SetTempoInput

    def execute(self, params: SetTempoInput) -> dict:
        song = _require_song(self)
        bpm = float(params.bpm)
        if bpm < TEMPO_MIN or bpm > TEMPO_MAX:
            raise RpcError(
                OUT_OF_RANGE,
                "bpm out of range",
                {"min": TEMPO_MIN, "max": TEMPO_MAX, "got": bpm},
            )
        before = float(song.tempo)
        # Comparamos com tolerância de 0.001 para evitar set redundante por float.
        if abs(before - bpm) < 1e-3:
            return {"changed": False, "before": before, "after": before}
        song.tempo = bpm
        after = float(song.tempo)
        return {"changed": True, "before": before, "after": after}
