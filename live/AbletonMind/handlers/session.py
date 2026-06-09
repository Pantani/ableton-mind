"""
Handler `session.get_info` — snapshot top-level read-only.

Equivalente do `get_session_info` do ahujasid/ableton-mcp. LLM usa para se
orientar antes de mutar (LOM exploration).
"""
from ..errors import LIVE_NOT_RUNNING, RpcError
from ..schemas import SessionGetInfoInput
from ._base import Handler, register


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
