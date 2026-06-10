"""
Cycle 24 Phase 8 tests.

Covers read-only long-tail discovery:
  - device.inspect_patcher
  - device.inspect_plugin
  - session.link_status
"""
import unittest

from ..handlers._base import REGISTRY
from ..handlers.device import DeviceInspectPatcherHandler, DeviceInspectPluginHandler
from ..handlers.session import SessionLinkStatusHandler
from ..schemas import (
    DeviceInspectPatcherInput,
    DeviceInspectPluginInput,
    SessionLinkStatusInput,
)

from ._fakes.live_api import FakeCtrl, FakeDeviceParameter, FakeSong, FakeTrack


class FakeDevice:
    def __init__(self, name="Device", class_name="Device", params=None):
        self.name = name
        self.class_name = class_name
        self.class_display_name = name
        self.parameters = list(params or [])


def _seed_device(device):
    song = FakeSong()
    track = FakeTrack(name="Discovery", is_audio=True)
    track.devices = [device]
    song.tracks.append(track)
    return song


class TestDeviceInspectPatcher(unittest.TestCase):
    def test_supported_max_shape_returns_patcher_metadata(self):
        device = FakeDevice(
            name="Granular Echo",
            class_name="MxDeviceAudioEffect",
            params=[FakeDeviceParameter(value=0.25, name="Dry/Wet")],
        )
        device.patcher_name = "granular_echo.amxd"
        device.patcher_path = "/Users/me/Max Audio Effect/granular_echo.amxd"
        device.max_device_id = "amxd-123"
        device.is_frozen = False

        h = DeviceInspectPatcherHandler(FakeCtrl(_seed_device(device)))
        result = h.execute(DeviceInspectPatcherInput(track_index=0, device_index=0))

        self.assertTrue(result["available"])
        self.assertTrue(result["is_max_for_live"])
        self.assertTrue(result["read_only"])
        self.assertEqual(result["device"]["class_name"], "MxDeviceAudioEffect")
        self.assertEqual(result["patcher"]["name"], "granular_echo.amxd")
        self.assertEqual(result["patcher"]["path"], "/Users/me/Max Audio Effect/granular_echo.amxd")
        self.assertEqual(result["patcher"]["identifier"], "amxd-123")
        self.assertEqual(result["total_parameters"], 1)
        self.assertEqual(result["parameters"][0]["name"], "Dry/Wet")

    def test_unsupported_native_device_returns_unavailable(self):
        device = FakeDevice(
            name="EQ Eight",
            class_name="Eq8",
            params=[FakeDeviceParameter(value=0.0, name="Output Gain")],
        )

        h = DeviceInspectPatcherHandler(FakeCtrl(_seed_device(device)))
        result = h.execute(DeviceInspectPatcherInput(track_index=0, device_index=0))

        self.assertFalse(result["available"])
        self.assertFalse(result["is_max_for_live"])
        self.assertIsNone(result["patcher"])
        self.assertIn("does not expose", result["reason"])
        self.assertEqual(result["total_parameters"], 1)


class TestDeviceInspectPlugin(unittest.TestCase):
    def test_supported_plugin_shape_returns_metadata_and_parameters(self):
        device = FakeDevice(
            name="Diva",
            class_name="PluginDevice",
            params=[
                FakeDeviceParameter(value=0.5, name="Cutoff"),
                FakeDeviceParameter(value=0.2, name="Resonance"),
            ],
        )
        device.plugin_format = "VST3"
        device.plugin_name = "Diva"
        device.plugin_vendor = "u-he"
        device.plugin_version = "1.4.8"
        device.plugin_identifier = "com.u-he.diva.vst3"
        device.plugin_path = "/Library/Audio/Plug-Ins/VST3/Diva.vst3"

        h = DeviceInspectPluginHandler(FakeCtrl(_seed_device(device)))
        result = h.execute(DeviceInspectPluginInput(track_index=0, device_index=0))

        self.assertTrue(result["available"])
        self.assertTrue(result["is_plugin"])
        self.assertTrue(result["read_only"])
        self.assertEqual(result["plugin"]["format"], "vst3")
        self.assertEqual(result["plugin"]["name"], "Diva")
        self.assertEqual(result["plugin"]["vendor"], "u-he")
        self.assertEqual(result["plugin"]["identifier"], "com.u-he.diva.vst3")
        self.assertEqual(result["total_parameters"], 2)
        self.assertEqual(result["parameters"][1]["name"], "Resonance")

    def test_unsupported_native_device_returns_unavailable(self):
        device = FakeDevice(
            name="Wavetable",
            class_name="InstrumentVector",
            params=[FakeDeviceParameter(value=1.0, name="Osc 1 Gain")],
        )

        h = DeviceInspectPluginHandler(FakeCtrl(_seed_device(device)))
        result = h.execute(DeviceInspectPluginInput(track_index=0, device_index=0))

        self.assertFalse(result["available"])
        self.assertFalse(result["is_plugin"])
        self.assertIsNone(result["plugin"])
        self.assertIn("does not expose", result["reason"])
        self.assertEqual(result["total_parameters"], 1)

    def test_renamed_native_device_with_plugin_terms_stays_unavailable(self):
        device = FakeDevice(
            name="VST Audio Unit PluginDevice",
            class_name="AudioEffectGroupDevice",
            params=[FakeDeviceParameter(value=0.5, name="Chain Activator")],
        )
        device.class_display_name = "Audio Effect Rack"

        h = DeviceInspectPluginHandler(FakeCtrl(_seed_device(device)))
        result = h.execute(DeviceInspectPluginInput(track_index=0, device_index=0))

        self.assertFalse(result["available"])
        self.assertFalse(result["is_plugin"])
        self.assertIsNone(result["plugin"])
        self.assertEqual(result["device"]["name"], "VST Audio Unit PluginDevice")


class TestSessionLinkStatus(unittest.TestCase):
    def test_supported_link_shape_returns_status(self):
        song = FakeSong()
        song.link_enabled = True
        song.link_num_peers = 2
        song.link_start_stop_sync_enabled = True
        song.link_quantum = 4.0

        h = SessionLinkStatusHandler(FakeCtrl(song))
        result = h.execute(SessionLinkStatusInput())

        self.assertTrue(result["available"])
        self.assertTrue(result["enabled"])
        self.assertTrue(result["is_connected"])
        self.assertEqual(result["num_peers"], 2)
        self.assertTrue(result["start_stop_sync_enabled"])
        self.assertEqual(result["quantum"], 4.0)
        self.assertEqual(result["source"], "song")

    def test_unsupported_shape_returns_unavailable(self):
        h = SessionLinkStatusHandler(FakeCtrl(FakeSong()))
        result = h.execute(SessionLinkStatusInput())

        self.assertFalse(result["available"])
        self.assertIsNone(result["enabled"])
        self.assertIsNone(result["is_connected"])
        self.assertIsNone(result["num_peers"])
        self.assertIn("does not expose", result["reason"])

    def test_cycle24_methods_registered(self):
        self.assertIn("device.inspect_patcher", REGISTRY)
        self.assertIn("device.inspect_plugin", REGISTRY)
        self.assertIn("session.link_status", REGISTRY)


if __name__ == "__main__":
    unittest.main()
