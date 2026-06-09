"""
CLI entry: `python -m AbletonMind --headless --port <p>`.

Roda o `BridgeServer` em modo headless (sem ControlSurface / sem Live), útil para:
  - Smoke tests TS que precisam de socket real (`tests/wire-smoke.test.ts`).
  - Validação local manual de framing NDJSON e error codes.

NÃO use isto dentro do Live — o Live carrega via Control Surface direto na
classe `AbletonMind` em `__init__.py`.

Usage:
  python -m AbletonMind                       # porta 9876
  python -m AbletonMind --port 9999           # porta custom
  python -m AbletonMind --host 0.0.0.0
"""
import argparse
import signal
import sys
import time

from .bridge import BridgeServer


def main() -> int:
    parser = argparse.ArgumentParser(prog="AbletonMind", description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9876)
    parser.add_argument(
        "--headless",
        action="store_true",
        default=True,
        help="Modo headless (default).",
    )
    args = parser.parse_args()

    server = BridgeServer(host=args.host, port=args.port, headless=True)
    server.start()
    sys.stderr.write(
        f"AbletonMind bridge headless started on {args.host}:{args.port}\n",
    )
    sys.stderr.flush()

    stop = {"flag": False}

    def _shutdown(_signum, _frame):
        stop["flag"] = True

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    try:
        while not stop["flag"]:
            time.sleep(0.1)
    finally:
        server.stop()
        sys.stderr.write("AbletonMind bridge stopped\n")
        sys.stderr.flush()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
