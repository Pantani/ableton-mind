"""
Handler `browser.get_categories` — lista as categorias raiz do Live Browser.

Live 12 expõe `Application.browser` com nodes: `audio_effects`,
`midi_effects`, `instruments`, `drums`, `samples`, `sounds`, `current_project`,
`user_library`, `packs`, `plugins`. Cada um é um BrowserItem.

Phase 1: só lista os nomes + se é folder (todos são). Phase 2 adiciona
walk recursivo + filter por tag.
"""
from ..errors import (
    INVALID_PARAMS,
    INVALID_STATE,
    LIVE_NOT_RUNNING,
    OBJECT_NOT_FOUND,
    RpcError,
)
from ..schemas import BrowserGetCategoriesInput, BrowserLoadItemInput
from ._base import Handler, register


# Lista canônica das categorias raiz. Algumas builds do Live não expõem todas
# (ex: `drums` pode estar dentro de `instruments` em versões antigas). Filtramos
# por `hasattr`.
ROOT_CATEGORIES = [
    "audio_effects",
    "midi_effects",
    "instruments",
    "drums",
    "samples",
    "sounds",
    "current_project",
    "user_library",
    "packs",
    "plugins",
]


@register("browser.get_categories")
class BrowserGetCategoriesHandler(Handler):
    INPUT = BrowserGetCategoriesInput

    def execute(self, params: BrowserGetCategoriesInput) -> dict:
        # Live browser não vem via Song; vem via Application. Em runtime real,
        # `self.ctrl.application` ou similar. Phase 1: confiamos no
        # `getattr(self.ctrl, "application", None)` ou fallback se headless.
        app = getattr(self.ctrl, "application", None) or getattr(self.ctrl, "_application", None)
        browser = getattr(app, "browser", None) if app is not None else None

        if browser is None:
            # Em testes / headless: retorna lista vazia mas não erra.
            return {"categories": [], "available": False, "reason": "browser unavailable (headless/no app)"}

        out: list = []
        for name in ROOT_CATEGORIES:
            node = getattr(browser, name, None)
            if node is None:
                continue
            out.append(
                {
                    "key": name,
                    "name": str(getattr(node, "name", name)),
                    "is_folder": bool(getattr(node, "is_folder", True)),
                    "is_loadable": bool(getattr(node, "is_loadable", False)),
                }
            )

        return {"categories": out, "available": True}


def _browser(ctrl):
    """Devolve `application.browser` ou None."""
    app = getattr(ctrl, "application", None) or getattr(ctrl, "_application", None)
    return getattr(app, "browser", None) if app is not None else None


def _walk_path(browser, path):
    """Walk recursivo: começa em browser.<root>, desce por children buscando
    por `name`. Retorna o BrowserItem final ou levanta RpcError com contexto."""
    if not path:
        raise RpcError(INVALID_PARAMS, "path must be non-empty", {"got": path})
    root_key = path[0]
    node = getattr(browser, root_key, None)
    if node is None:
        raise RpcError(
            OBJECT_NOT_FOUND,
            "root category not found",
            {"got": root_key, "valid": list(ROOT_CATEGORIES)},
        )
    for i, name in enumerate(path[1:], start=1):
        children = list(getattr(node, "children", []) or [])
        nxt = None
        for c in children:
            if str(getattr(c, "name", "")) == name:
                nxt = c
                break
        if nxt is None:
            raise RpcError(
                OBJECT_NOT_FOUND,
                "browser item not found at path",
                {"path": path, "missing_at": i, "missing": name, "available": [str(getattr(c, "name", "")) for c in children]},
            )
        node = nxt
    return node


@register("browser.load_item")
class BrowserLoadItemHandler(Handler):
    """Carrega um BrowserItem na track selecionada/armada.

    LiveAPI: `application.browser.load_item(item)`. Live escolhe a track
    destino sozinho (geralmente a armada ou a última clicada).
    """

    INPUT = BrowserLoadItemInput

    def execute(self, params: BrowserLoadItemInput) -> dict:
        browser = _browser(self.ctrl)
        if browser is None:
            raise RpcError(
                LIVE_NOT_RUNNING,
                "browser unavailable",
                {"hint": "headless mode (no Application)"},
            )
        if not isinstance(params.path, list) or len(params.path) == 0:
            raise RpcError(INVALID_PARAMS, "path must be non-empty list of strings", {"got": params.path})
        item = _walk_path(browser, [str(x) for x in params.path])
        if not bool(getattr(item, "is_loadable", False)):
            raise RpcError(
                INVALID_STATE,
                "browser item is not loadable (folder?)",
                {"path": params.path, "is_folder": bool(getattr(item, "is_folder", True))},
            )
        try:
            browser.load_item(item)
        except Exception as exc:
            raise RpcError(
                -32001,
                "load_item raised",
                {"path": params.path, "reason": str(exc)},
            ) from exc
        return {
            "loaded": True,
            "name": str(getattr(item, "name", "")),
            "path": params.path,
        }
