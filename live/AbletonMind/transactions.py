"""
Wrapper `with undo_step("name", song): ...` for atomic mutation.

Live API exposes `Song.begin_undo_step()` / `Song.end_undo_step()`. Any
sequence of mutations inside the block becomes a single undo in Live's history.

`name` is not yet exposed to the LiveAPI (the API doesn't accept a label on
the undo step), but we keep it for future structured logs.
"""
from contextlib import contextmanager

from .errors import TRANSACTION_ERROR, RpcError


@contextmanager
def undo_step(name: str, song):
    """Opens/closes an undo step. If opening fails, propagates; if the body
    fails, still closes the step so the session isn't left "open" in Live."""
    try:
        song.begin_undo_step()
    except Exception as exc:  # pragma: no cover - real LiveAPI only
        raise RpcError(
            TRANSACTION_ERROR,
            "failed to begin undo step",
            {"step": name, "reason": str(exc)},
        ) from exc

    try:
        yield
    finally:
        try:
            song.end_undo_step()
        except Exception:  # pragma: no cover
            # Don't mask the body error; only re-raise if nothing is alive.
            pass
