"""
CLI entry: `python -m AbletonMind --headless --port <p>`.

Runs `BridgeServer` in headless mode (no ControlSurface / no Live), useful for:
  - TS smoke tests that need a real socket (`tests/wire-smoke.test.ts`).
  - Local manual validation of NDJSON framing and error codes.

DO NOT use this inside Live — Live loads it via Control Surface directly into
the `AbletonMind` class in `__init__.py`.

Usage:
  python -m AbletonMind                       # port 9876
  python -m AbletonMind --port 9999           # custom port
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
        help="Headless mode (default).",
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
