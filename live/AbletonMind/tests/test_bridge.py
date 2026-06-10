"""
BridgeServer end-to-end tests in headless mode.

Spins up a TCP server on an ephemeral port (port 0 → kernel picks), connects
a synthetic client, sends NDJSON and validates the JSON-RPC envelopes.

Covers:
- handshake (system.hello)
- ping
- invalid method → -32601
- malformed params → -32602
- invalid JSON → -32700
- idempotent transport.set_tempo flow
- track.list against a populated song
- clip.create_midi with idempotency (second attempt on the same slot)
"""
import json
import socket
import threading
import time
import unittest

from live.AbletonMind.bridge import BridgeServer
from live.AbletonMind.tests._fakes.live_api import (
    FakeCtrl,
    FakeReturnTrack,
    FakeSong,
    FakeTrack,
)


def _free_port() -> int:
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


class BridgeFixture:
    def __init__(self, song: FakeSong = None):
        self.ctrl = FakeCtrl(song=song)
        self.port = _free_port()
        self.server = BridgeServer(
            ctrl=self.ctrl, host="127.0.0.1", port=self.port, headless=True
        )

    def start(self) -> None:
        self.server.start()
        # Wait until the socket accepts connections.
        deadline = time.time() + 2.0
        while time.time() < deadline:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(0.2)
                s.connect(("127.0.0.1", self.port))
                s.close()
                return
            except OSError:
                time.sleep(0.02)
        raise RuntimeError("bridge did not come up in time")

    def stop(self) -> None:
        self.server.stop()
        # Small wait to release the port.
        time.sleep(0.05)


def _rpc(sock: socket.socket, method: str, params: dict, id_: int = 1, raw: str = None) -> dict:
    if raw is not None:
        msg = raw
    else:
        msg = json.dumps({"jsonrpc": "2.0", "id": id_, "method": method, "params": params})
    sock.sendall((msg + "\n").encode("utf-8"))
    buf = b""
    sock.settimeout(2.0)
    while b"\n" not in buf:
        chunk = sock.recv(4096)
        if not chunk:
            break
        buf += chunk
    line, _, _ = buf.partition(b"\n")
    return json.loads(line.decode("utf-8"))


class TestBridgeEndToEnd(unittest.TestCase):
    def setUp(self):
        song = FakeSong()
        song.tracks = [
            FakeTrack(name="Drums", is_midi=True),
            FakeTrack(name="Vocals", is_audio=True),
        ]
        song.return_tracks = [FakeReturnTrack(name="Reverb")]
        self.fx = BridgeFixture(song=song)
        self.fx.start()
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.connect(("127.0.0.1", self.fx.port))

    def tearDown(self):
        try:
            self.sock.close()
        finally:
            self.fx.stop()

    # ---------- handshake / utility

    def test_system_hello_returns_versions(self):
        resp = _rpc(self.sock, "system.hello", {"client": "test", "version": "0.0.0"})
        self.assertEqual(resp["jsonrpc"], "2.0")
        self.assertEqual(resp["id"], 1)
        self.assertEqual(resp["result"]["bridge"], "ableton-mind/python")
        self.assertEqual(resp["result"]["protocol_version"], "0.1")

    def test_system_ping(self):
        resp = _rpc(self.sock, "system.ping", {})
        self.assertTrue(resp["result"]["pong"])

    # ---------- error envelopes

    def test_method_not_found(self):
        resp = _rpc(self.sock, "does.not.exist", {})
        self.assertIn("error", resp)
        self.assertEqual(resp["error"]["code"], -32601)
        self.assertEqual(resp["error"]["data"]["method"], "does.not.exist")

    def test_invalid_params(self):
        # set_tempo only accepts {bpm}; "foo" is unknown
        resp = _rpc(self.sock, "transport.set_tempo", {"foo": 1})
        self.assertEqual(resp["error"]["code"], -32602)

    def test_parse_error(self):
        resp = _rpc(self.sock, "", {}, raw="{not json")
        self.assertEqual(resp["error"]["code"], -32700)

    # ---------- transport

    def test_set_tempo_idempotent_via_socket(self):
        r1 = _rpc(self.sock, "transport.set_tempo", {"bpm": 128.0}, id_=10)
        self.assertTrue(r1["result"]["changed"])
        r2 = _rpc(self.sock, "transport.set_tempo", {"bpm": 128.0}, id_=11)
        self.assertFalse(r2["result"]["changed"])
        self.assertEqual(r2["result"]["after"], 128.0)

    def test_set_tempo_out_of_range_envelope(self):
        resp = _rpc(self.sock, "transport.set_tempo", {"bpm": 1500})
        self.assertEqual(resp["error"]["code"], -32004)
        self.assertEqual(resp["error"]["data"]["min"], 20.0)

    def test_play_then_stop(self):
        r1 = _rpc(self.sock, "transport.play", {}, id_=20)
        self.assertTrue(r1["result"]["changed"])
        self.assertTrue(r1["result"]["is_playing"])
        r2 = _rpc(self.sock, "transport.stop", {}, id_=21)
        self.assertTrue(r2["result"]["changed"])
        self.assertFalse(r2["result"]["is_playing"])

    # ---------- track / clip

    def test_track_list_over_socket(self):
        resp = _rpc(self.sock, "track.list", {})
        self.assertEqual(resp["result"]["total"], 4)  # 2 regulars + 1 return + 1 master

    def test_create_midi_clip_and_then_reject_duplicate(self):
        r1 = _rpc(
            self.sock,
            "clip.create_midi",
            {"track_index": 0, "clip_slot_index": 0, "length_beats": 4.0, "name": "x"},
            id_=30,
        )
        self.assertTrue(r1["result"]["changed"])
        # second time on the same slot must fail with INVALID_STATE
        r2 = _rpc(
            self.sock,
            "clip.create_midi",
            {"track_index": 0, "clip_slot_index": 0, "length_beats": 4.0, "name": "y"},
            id_=31,
        )
        self.assertEqual(r2["error"]["code"], -32005)
        self.assertEqual(r2["error"]["data"]["existing_clip_name"], "x")


if __name__ == "__main__":
    unittest.main()
