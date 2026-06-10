"""
Imports every handler module so their `@register(...)` decorators run.

Order is irrelevant (the registry is global), but we need to import at least
once to populate `REGISTRY`. `bridge.py` does `from .handlers import *`.
"""
from ._base import REGISTRY  # noqa: F401  re-export for tests/back-compat
from . import system  # noqa: F401
from . import transport  # noqa: F401
from . import track  # noqa: F401
from . import clip  # noqa: F401
from . import scene  # noqa: F401
from . import session  # noqa: F401
from . import browser  # noqa: F401
from . import device  # noqa: F401
from . import arrangement  # noqa: F401
from . import session_phase5  # noqa: F401
from . import push  # noqa: F401
