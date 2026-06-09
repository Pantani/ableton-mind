"""
Wrapper `with undo_step("name", song): ...` para mutação atômica.

Live API expõe `Song.begin_undo_step()` / `Song.end_undo_step()`. Qualquer
sequência de mutações dentro do bloco vira um único undo no histórico do Live.

O `name` ainda não é exposto à LiveAPI (a API não aceita rótulo no undo step),
mas guardamos para futuros logs estruturados.
"""
from contextlib import contextmanager

from .errors import TRANSACTION_ERROR, RpcError


@contextmanager
def undo_step(name: str, song):
    """Abre/fecha um undo step. Se a abertura falhar, propaga; se o corpo
    falhar, ainda fecha o step para não deixar a sessão "open" no Live."""
    try:
        song.begin_undo_step()
    except Exception as exc:  # pragma: no cover - somente real LiveAPI
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
            # Não mascara o erro do corpo; só loga via re-raise se nada estiver vivo.
            pass
