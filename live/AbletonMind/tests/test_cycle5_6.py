"""
Cycle 5 + Cycle 6 tests (TD-018).

Covers:
  Cycle 5:
    - browser.load_item (walk path + error paths)
    - device.get_parameters / device.set_parameter
    - ListenerManager (setup/teardown/callbacks)
  Cycle 6:
    - BridgeServer.broadcast() — tracks live clients + writes NDJSON
"""
import json
import socket
import threading
import time
import unittest

from ..bridge import BridgeServer
from ..errors import RpcError
from ..handlers.browser import BrowserLoadItemHandler
from ..handlers.device import (
    DeviceGetParametersHandler,
    DeviceSetParameterHandler,
)
from ..listeners import ListenerManager
from ..schemas import (
    BrowserLoadItemInput,
    DeviceGetParametersInput,
    DeviceSetParameterInput,
)

from ._fakes.live_api import (
    FakeApplication,
    FakeBrowserItem,
    FakeCtrl,
    FakeDeviceParameter,
    FakeSong,
    FakeTrack,
)


# ---------- helpers ----------------------------------------------------------


class FakeDevice:
    def __init__(self, name="EQ Eight", class_name="Eq8", params=None):
        self.name = name
        self.class_name = class_name
        self.parameters = params or []


def _seed_track_with_device(song, dev=None):
    track = FakeTrack(name="Bass", is_audio=True)
    if not hasattr(track, "devices"):
        track.devices = []
    dev = dev or FakeDevice(
        params=[
            FakeDeviceParameter(value=0, mn=-24, mx=24),  # Output Gain
            FakeDeviceParameter(value=100, mn=30, mx=22000),  # Frequency
        ]
    )
    # Names on FakeDeviceParameter don't exist by default; set them.
    for i, p in enumerate(dev.parameters):
        p.name = ["Output Gain", "Frequency"][i] if i < 2 else f"P{i}"
        p.is_quantized = False
        p.value_items = []
        p.automation_state = 0
    track.devices.append(dev)
    song.tracks.append(track)
    return track, dev


# ============================================================================
# Cycle 5 — browser.load_item
# ============================================================================


class TestBrowserLoadItem(unittest.TestCase):
    def test_walks_path_and_loads(self):
        song = FakeSong()
        app = FakeApplication()
        # Add Wavetable as a child of instruments, and Pads inside Wavetable.
        wt = FakeBrowserItem("Wavetable", is_folder=True, is_loadable=False)
        pads = FakeBrowserItem("Pads", is_folder=True, is_loadable=False)
        air_pad = FakeBrowserItem("Air Pad", is_folder=False, is_loadable=True)
        pads.children = [air_pad]
        wt.children = [pads]
        app.browser.instruments.children = [wt]

        # Browser needs a load_item method
        loaded = []
        app.browser.load_item = lambda item: loaded.append(item.name)

        ctrl = FakeCtrl(song, application=app)
        h = BrowserLoadItemHandler(ctrl)
        r = h.execute(BrowserLoadItemInput(path=["instruments", "Wavetable", "Pads", "Air Pad"]))
        self.assertTrue(r["loaded"])
        self.assertTrue(r["changed"])
        self.assertFalse(r["existing"])
        self.assertEqual(r["name"], "Air Pad")
        self.assertEqual(loaded, ["Air Pad"])

    def test_skips_load_when_item_already_present_on_armed_track(self):
        song = FakeSong()
        track = FakeTrack(name="Synth", is_midi=True)
        track.arm = True
        track.devices = [type("Device", (), {"name": "Air Pad"})()]
        song.tracks.append(track)

        app = FakeApplication()
        wt = FakeBrowserItem("Wavetable", is_folder=True, is_loadable=False)
        pads = FakeBrowserItem("Pads", is_folder=True, is_loadable=False)
        air_pad = FakeBrowserItem("Air Pad", is_folder=False, is_loadable=True)
        pads.children = [air_pad]
        wt.children = [pads]
        app.browser.instruments.children = [wt]

        loaded = []
        app.browser.load_item = lambda item: loaded.append(item.name)

        ctrl = FakeCtrl(song, application=app)
        h = BrowserLoadItemHandler(ctrl)
        r = h.execute(BrowserLoadItemInput(path=["instruments", "Wavetable", "Pads", "Air Pad"]))

        self.assertTrue(r["loaded"])
        self.assertFalse(r["changed"])
        self.assertTrue(r["existing"])
        self.assertEqual(r["name"], "Air Pad")
        self.assertEqual(loaded, [])

    def test_empty_path(self):
        ctrl = FakeCtrl(FakeSong(), application=FakeApplication())
        h = BrowserLoadItemHandler(ctrl)
        with self.assertRaises(RpcError):
            h.execute(BrowserLoadItemInput(path=[]))

    def test_unknown_root(self):
        ctrl = FakeCtrl(FakeSong(), application=FakeApplication())
        h = BrowserLoadItemHandler(ctrl)
        with self.assertRaises(RpcError) as exc:
            h.execute(BrowserLoadItemInput(path=["bogus_root"]))
        self.assertEqual(exc.exception.code, -32002)

    def test_path_not_found_in_children(self):
        app = FakeApplication()
        app.browser.instruments.children = [FakeBrowserItem("Wavetable")]
        ctrl = FakeCtrl(FakeSong(), application=app)
        h = BrowserLoadItemHandler(ctrl)
        with self.assertRaises(RpcError) as exc:
            h.execute(BrowserLoadItemInput(path=["instruments", "Operator"]))
        self.assertEqual(exc.exception.code, -32002)
        self.assertEqual(exc.exception.data["missing"], "Operator")
        self.assertIn("Wavetable", exc.exception.data["available"])

    def test_loading_folder_rejected(self):
        app = FakeApplication()
        wt = FakeBrowserItem("Wavetable", is_folder=True, is_loadable=False)
        app.browser.instruments.children = [wt]
        ctrl = FakeCtrl(FakeSong(), application=app)
        h = BrowserLoadItemHandler(ctrl)
        with self.assertRaises(RpcError) as exc:
            h.execute(BrowserLoadItemInput(path=["instruments", "Wavetable"]))
        self.assertEqual(exc.exception.code, -32005)


# ============================================================================
# Cycle 5 — device.get_parameters / device.set_parameter
# ============================================================================


class TestDeviceParameters(unittest.TestCase):
    def test_get_parameters_lists_snapshot(self):
        song = FakeSong()
        _seed_track_with_device(song)
        h = DeviceGetParametersHandler(FakeCtrl(song))
        r = h.execute(DeviceGetParametersInput(track_index=0, device_index=0))
        self.assertEqual(r["device_name"], "EQ Eight")
        self.assertEqual(r["total"], 2)
        self.assertEqual(r["parameters"][0]["name"], "Output Gain")
        self.assertEqual(r["parameters"][0]["min"], -24)

    def test_get_parameters_missing_track(self):
        song = FakeSong()
        h = DeviceGetParametersHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(DeviceGetParametersInput(track_index=0, device_index=0))

    def test_set_parameter_in_range_mutates(self):
        song = FakeSong()
        _seed_track_with_device(song)
        h = DeviceSetParameterHandler(FakeCtrl(song))
        r = h.execute(
            DeviceSetParameterInput(
                track_index=0, device_index=0, parameter_index=0, value=3.0
            )
        )
        self.assertTrue(r["changed"])
        self.assertEqual(r["after"], 3.0)
        self.assertEqual(r["before"], 0)

    def test_set_parameter_idempotent(self):
        song = FakeSong()
        _, dev = _seed_track_with_device(song)
        dev.parameters[0].value = 3.0
        h = DeviceSetParameterHandler(FakeCtrl(song))
        r = h.execute(
            DeviceSetParameterInput(
                track_index=0, device_index=0, parameter_index=0, value=3.00001
            )
        )
        self.assertFalse(r["changed"])

    def test_set_parameter_out_of_range(self):
        song = FakeSong()
        _seed_track_with_device(song)
        h = DeviceSetParameterHandler(FakeCtrl(song))
        with self.assertRaises(RpcError) as exc:
            h.execute(
                DeviceSetParameterInput(
                    track_index=0, device_index=0, parameter_index=0, value=999.0
                )
            )
        self.assertEqual(exc.exception.code, -32004)


# ============================================================================
# Cycle 5 — ListenerManager
# ============================================================================


class TestListenerManager(unittest.TestCase):
    def setUp(self):
        self.song = FakeSong()
        # FakeSong needs add_/remove_<prop>_listener; we mock them inline.
        self._listeners = {"tempo": [], "is_playing": []}

        def make_add(prop):
            return lambda cb: self._listeners[prop].append(cb)

        def make_remove(prop):
            return lambda cb: self._listeners[prop].remove(cb) if cb in self._listeners[prop] else None

        for prop in ("tempo", "is_playing"):
            setattr(self.song, f"add_{prop}_listener", make_add(prop))
            setattr(self.song, f"remove_{prop}_listener", make_remove(prop))

        self.events: list = []
        self.ctrl = FakeCtrl(self.song)
        self.mgr = ListenerManager(self.ctrl, broadcast=lambda m, p: self.events.append((m, p)))

    def test_setup_registers_listeners(self):
        self.mgr.setup()
        self.assertEqual(len(self._listeners["tempo"]), 1)
        self.assertEqual(len(self._listeners["is_playing"]), 1)

    def test_tempo_callback_fires_broadcast(self):
        self.mgr.setup()
        self.song.tempo = 140.0
        # Invoke callback directly.
        cb = self._listeners["tempo"][0]
        cb()
        self.assertEqual(len(self.events), 1)
        method, params = self.events[0]
        self.assertEqual(method, "event.transport_tempo_changed")
        self.assertEqual(params["value"], 140.0)
        self.assertEqual(params["previous"], 120.0)  # FakeSong default
        self.assertIn("ts", params)

    def test_is_playing_callback_fires_broadcast(self):
        self.mgr.setup()
        self.song.is_playing = True
        cb = self._listeners["is_playing"][0]
        cb()
        self.assertEqual(len(self.events), 1)
        method, params = self.events[0]
        self.assertEqual(method, "event.transport_is_playing_changed")
        self.assertTrue(params["value"])
        self.assertFalse(params["previous"])

    def test_teardown_removes_listeners(self):
        self.mgr.setup()
        self.mgr.teardown()
        self.assertEqual(len(self._listeners["tempo"]), 0)
        self.assertEqual(len(self._listeners["is_playing"]), 0)

    def test_setup_idempotent(self):
        self.mgr.setup()
        self.mgr.setup()  # 2x shouldn't duplicate
        self.assertEqual(len(self._listeners["tempo"]), 1)


# ============================================================================
# Cycle 6 — BridgeServer.broadcast()
# ============================================================================


class TestBridgeBroadcast(unittest.TestCase):
    def setUp(self):
        # Headless server on ephemeral port.
        self.bridge = BridgeServer(host="127.0.0.1", port=0, headless=True)
        # Port 0 = OS picks; but bridge.py uses fixed bind(host,port). For
        # broadcast we do NOT need a real network — we just register sockets
        # directly into _clients.

    def test_broadcast_writes_to_all_clients(self):
        # Create two socket pairs (client/server pair via socketpair).
        a1, b1 = socket.socketpair()
        a2, b2 = socket.socketpair()
        # Register "a" as clients (bridge side); "b" simulates the reader
        # client.
        with self.bridge._clients_lock:
            self.bridge._clients.extend([a1, a2])

        n = self.bridge.broadcast("event.test", {"value": 42})
        self.assertEqual(n, 2)

        # Read from the consumer side.
        line1 = b1.recv(4096).decode("utf-8").strip()
        line2 = b2.recv(4096).decode("utf-8").strip()
        msg1 = json.loads(line1)
        msg2 = json.loads(line2)
        self.assertEqual(msg1["method"], "event.test")
        self.assertEqual(msg1["params"]["value"], 42)
        self.assertNotIn("id", msg1)
        self.assertEqual(msg2["method"], "event.test")

        for s in (a1, a2, b1, b2):
            s.close()

    def test_broadcast_removes_dead_clients(self):
        a, b = socket.socketpair()
        with self.bridge._clients_lock:
            self.bridge._clients.append(a)
        b.close()  # kill the consumer → write to `a` will fail once OS notices
        # May take 1-2 sends; try twice.
        self.bridge.broadcast("event.dummy", {})
        time.sleep(0.05)
        # Second call — now `a` should be dead and removed.
        delivered = self.bridge.broadcast("event.dummy", {})
        self.assertEqual(delivered, 0)
        with self.bridge._clients_lock:
            self.assertEqual(self.bridge._clients, [])
        a.close()


if __name__ == "__main__":
    unittest.main()
