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
        browser = _browser(self.ctrl)

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


def _application(ctrl):
    """Returns the Live Application object from ControlSurface or global Live API."""
    app = getattr(ctrl, "application", None)
    if callable(app):
        app = app()
    if app is None:
        app = getattr(ctrl, "_application", None)
    if app is not None:
        return app

    try:  # pragma: no cover - real Live only
        import Live  # type: ignore

        return Live.Application.get_application()
    except Exception:
        return None


def _browser(ctrl):
    """Returns `application.browser` or None."""
    app = _application(ctrl)
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


def _selected_or_armed_track(song):
    """Best-effort approximation of the track Live will target for Browser load."""
    if song is None:
        return None
    view = getattr(song, "view", None)
    selected = getattr(view, "selected_track", None) if view is not None else None
    if selected is not None:
        return selected
    for track in list(getattr(song, "tracks", []) or []):
        if bool(getattr(track, "arm", False)):
            return track
    return None


def _same_path(value, path) -> bool:
    if isinstance(value, (list, tuple)):
        return [str(x).lower() for x in value] == [str(x).lower() for x in path]
    if isinstance(value, str):
        normalized = value.lower()
        joined = "/".join(str(x) for x in path).lower()
        return normalized == joined or normalized.endswith(f"/{joined}")
    return False


def _loaded_object_matches(obj, item_name: str, path) -> bool:
    needle = item_name.lower()
    for attr in ("name", "class_display_name", "class_name", "preset_name"):
        value = getattr(obj, attr, None)
        if value is not None and str(value).lower() == needle:
            return True
    for attr in ("browser_path", "path"):
        if _same_path(getattr(obj, attr, None), path):
            return True
    return False


def _item_present_on_track(track, item, path) -> bool:
    if track is None:
        return False
    item_name = str(getattr(item, "name", path[-1] if path else ""))
    for device in list(getattr(track, "devices", []) or []):
        if _loaded_object_matches(device, item_name, path):
            return True
    for slot in list(getattr(track, "clip_slots", []) or []):
        clip = getattr(slot, "clip", None)
        if clip is not None and _loaded_object_matches(clip, item_name, path):
            return True
    return False


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
        target_track = _selected_or_armed_track(self.song)
        if _item_present_on_track(target_track, item, params.path):
            return {
                "loaded": True,
                "changed": False,
                "existing": True,
                "name": str(getattr(item, "name", "")),
                "path": params.path,
            }
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
            "changed": True,
            "existing": False,
            "name": str(getattr(item, "name", "")),
            "path": params.path,
        }
