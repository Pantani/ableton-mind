import unittest

from live.AbletonMind.handlers.system import (
    BRIDGE_NAME,
    BRIDGE_VERSION,
    PROTOCOL_VERSION,
    HelloHandler,
    PingHandler,
)
from live.AbletonMind.schemas import HelloInput, PingInput
from live.AbletonMind.tests._fakes.live_api import FakeCtrl


class TestSystemHandlers(unittest.TestCase):
    def setUp(self):
        self.ctrl = FakeCtrl()

    def test_hello_returns_versions(self):
        h = HelloHandler(self.ctrl)
        result = h.execute(HelloInput(client="ableton-mind/ts", version="0.0.1"))
        self.assertEqual(result["bridge"], BRIDGE_NAME)
        self.assertEqual(result["version"], BRIDGE_VERSION)
        self.assertEqual(result["protocol_version"], PROTOCOL_VERSION)
        self.assertIn("live_version", result)
        self.assertIn("python_version", result)

    def test_ping_returns_pong_and_ts(self):
        h = PingHandler(self.ctrl)
        result = h.execute(PingInput())
        self.assertTrue(result["pong"])
        self.assertIsInstance(result["ts"], int)
        self.assertGreater(result["ts"], 0)


if __name__ == "__main__":
    unittest.main()
