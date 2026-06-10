"""
`browser.get_categories` handler — lists the Live Browser root categories.

Live 12 exposes `Application.browser` with nodes: `audio_effects`,
`midi_effects`, `instruments`, `drums`, `samples`, `sounds`, `current_project`,
`user_library`, `packs`, `plugins`. Each is a BrowserItem.

Phase 1: lists only the names + whether it's a folder (all are). Phase 2
adds recursive walk + filter by tag.
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


# Canonical list of root categories. Some Live builds don't expose them all
# (e.g. `drums` may live inside `instruments` in older versions). We filter
# via `hasattr`.
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
        # The Live browser doesn't come via Song; it comes via Application. In
        # real runtime, `self.ctrl.application` or similar. Phase 1: rely on
        # `getattr(self.ctrl, "application", None)` or fallback if headless.
        app = getattr(self.ctrl, "application", None) or getattr(self.ctrl, "_application", None)
        browser = getattr(app, "browser", None) if app is not None else None

        if browser is None:
            # In tests / headless: return empty list but don't error.
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
    """Returns `application.browser` or None."""
    app = getattr(ctrl, "application", None) or getattr(ctrl, "_application", None)
    return getattr(app, "browser", None) if app is not None else None


def _walk_path(browser, path):
    """Recursive walk: starts at browser.<root>, descends through children
    matching by `name`. Returns the final BrowserItem or raises RpcError with context."""
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
    """Loads a BrowserItem onto the selected/armed track.

    LiveAPI: `application.browser.load_item(item)`. Live picks the target
    track itself (usually the armed one or the last clicked).
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
