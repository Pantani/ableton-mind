"""
Handler `scene.fire` — dispara uma cena.

LiveAPI: `Scene.fire()` ou `Song.scenes[i].fire()`. NÃO idempotente
estritamente, mas a operação é "trigger" — chamadas duplicadas só re-disparam.
"""
from ..errors import LIVE_NOT_RUNNING, OBJECT_NOT_FOUND, RpcError
from ..schemas import SceneFireInput
from ._base import Handler, register


@register("scene.fire")
class SceneFireHandler(Handler):
    INPUT = SceneFireInput

    def execute(self, params: SceneFireInput) -> dict:
        song = self.song
        if song is None:
            raise RpcError(LIVE_NOT_RUNNING, "Live song is not available")
        scenes = list(getattr(song, "scenes", []) or [])
        n = len(scenes)
        if params.index < 0 or params.index >= n:
            raise RpcError(
                OBJECT_NOT_FOUND,
                "scene not found",
                {"num_scenes": n, "got": params.index},
            )
        scene = scenes[params.index]
        scene.fire()
        return {
            "changed": True,
            "index": params.index,
            "name": str(getattr(scene, "name", "")),
        }
