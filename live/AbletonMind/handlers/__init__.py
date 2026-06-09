"""
Importa todos os módulos de handler para que seus `@register(...)` rodem.

A ordem é irrelevante (registry é global), mas precisamos importar pelo menos
uma vez para popular `REGISTRY`. O `bridge.py` faz `from .handlers import *`.
"""
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
