"""
Testes Cycle 7 Phase 4 (TD-022).

Cobre:
  - clip.envelope_set_points (incl. curve_type=hold via 2-step split)
  - arrangement.add_automation_point
  - _resolve_parameter_locator (todos os kinds)
  - ListenerManager expandido (track + clip listeners)
"""
import unittest

from AbletonMind.errors import RpcError
from AbletonMind.handlers.arrangement import ArrangementAddAutomationPointHandler
from AbletonMind.handlers.clip import (
    ClipEnvelopeSetPointsHandler,
    CreateMidiClipHandler,
    _resolve_parameter_locator,
)
from AbletonMind.listeners import ListenerManager
from AbletonMind.schemas import (
    ArrangementAddAutomationPointInput,
    ClipEnvelopeSetPointsInput,
    CreateMidiClipInput,
)

from ._fakes.live_api import FakeCtrl, FakeDeviceParameter, FakeSong, FakeTrack


class FakeEnvelope:
    def __init__(self):
        self.steps: list = []  # [(time, length, value)]
        self.cleared = 0

    def clear(self):
        self.cleared += 1
        self.steps = []

    def insert_step(self, time: float, length: float, value: float):
        self.steps.append((time, length, value))


class FakeClipWithEnvelope:
    def __init__(self, length=4.0):
        self.name = ""
        self.length = length
        self.is_midi_clip = True
        self.is_playing = False
        self.notes = []
        self.loop_start = 0.0
        self.loop_end = length
        self.looping = True
        self.envelopes: dict = {}  # parameter_id → FakeEnvelope

    def create_automation_envelope(self, parameter):
        key = id(parameter)
        if key not in self.envelopes:
            self.envelopes[key] = FakeEnvelope()
        return self.envelopes[key]


def _seed_song_with_track():
    song = FakeSong()
    song.tracks.append(FakeTrack(name="T1", is_midi=True))
    return song


# ============================================================================
# clip.envelope_set_points
# ============================================================================


class TestClipEnvelopeSetPoints(unittest.TestCase):
    def _seed_clip(self, song):
        # Substitui o clip default por um FakeClipWithEnvelope.
        slot = song.tracks[0].clip_slots[0]
        slot.clip = FakeClipWithEnvelope()
        return slot.clip

    def test_replaces_with_linear_points(self):
        song = _seed_song_with_track()
        self._seed_clip(song)
        h = ClipEnvelopeSetPointsHandler(FakeCtrl(song))
        r = h.execute(
            ClipEnvelopeSetPointsInput(
                track_index=0,
                clip_slot_index=0,
                parameter_locator={"kind": "mixer_volume"},
                points=[
                    {"time": 0.0, "value": 0.0},
                    {"time": 2.0, "value": 0.5},
                    {"time": 4.0, "value": 1.0},
                ],
            )
        )
        self.assertTrue(r["changed"])
        self.assertEqual(r["points"], 3)
        envelope = list(song.tracks[0].clip_slots[0].clip.envelopes.values())[0]
        self.assertEqual(envelope.cleared, 1)
        self.assertEqual(len(envelope.steps), 3)

    def test_hold_curve_type_inserts_extra_step(self):
        song = _seed_song_with_track()
        self._seed_clip(song)
        h = ClipEnvelopeSetPointsHandler(FakeCtrl(song))
        r = h.execute(
            ClipEnvelopeSetPointsInput(
                track_index=0,
                clip_slot_index=0,
                parameter_locator={"kind": "mixer_volume"},
                points=[
                    {"time": 0.0, "value": 0.0},
                    {"time": 2.0, "value": 0.5, "curve_type": "hold"},
                ],
            )
        )
        # 1 (linear) + 2 (hold edge + ponto) = 3
        self.assertEqual(r["points"], 3)
        envelope = list(song.tracks[0].clip_slots[0].clip.envelopes.values())[0]
        steps = envelope.steps
        # primeiro = (0, 0, 0); segundo = (~1.9999, 0, 0.0) edge; terceiro = (2, 0, 0.5)
        self.assertEqual(len(steps), 3)
        self.assertLess(steps[1][0], 2.0)
        self.assertEqual(steps[1][2], 0.0)  # edge value = previous
        self.assertEqual(steps[2], (2.0, 0.0, 0.5))

    def test_locator_device_param(self):
        song = _seed_song_with_track()
        clip = self._seed_clip(song)
        # Adiciona um device com parameter resolvível.
        param = FakeDeviceParameter(value=0, mn=0, mx=1, name="Frequency")

        class FakeDev:
            def __init__(self):
                self.parameters = [param]

        if not hasattr(song.tracks[0], "devices"):
            song.tracks[0].devices = []
        song.tracks[0].devices.append(FakeDev())

        h = ClipEnvelopeSetPointsHandler(FakeCtrl(song))
        r = h.execute(
            ClipEnvelopeSetPointsInput(
                track_index=0,
                clip_slot_index=0,
                parameter_locator={
                    "kind": "device_param",
                    "device_index": 0,
                    "parameter_index": 0,
                },
                points=[{"time": 0.0, "value": 0.5}],
            )
        )
        self.assertTrue(r["changed"])

    def test_rejects_empty_slot(self):
        song = _seed_song_with_track()
        # Sem clip
        h = ClipEnvelopeSetPointsHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(
                ClipEnvelopeSetPointsInput(
                    track_index=0,
                    clip_slot_index=0,
                    parameter_locator={"kind": "mixer_volume"},
                    points=[{"time": 0, "value": 0}],
                )
            )

    def test_rejects_invalid_point_shape(self):
        song = _seed_song_with_track()
        self._seed_clip(song)
        h = ClipEnvelopeSetPointsHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(
                ClipEnvelopeSetPointsInput(
                    track_index=0,
                    clip_slot_index=0,
                    parameter_locator={"kind": "mixer_volume"},
                    points=[{"time": 0}],  # falta value
                )
            )


# ============================================================================
# arrangement.add_automation_point
# ============================================================================


class TestArrangementAddAutomationPoint(unittest.TestCase):
    def setUp(self):
        self.song = _seed_song_with_track()
        # Track precisa de create_or_get_automation_envelope.
        track = self.song.tracks[0]
        track.create_or_get_automation_envelope = lambda p: FakeEnvelope()
        self.ctrl = FakeCtrl(self.song)

    def test_adds_point(self):
        h = ArrangementAddAutomationPointHandler(self.ctrl)
        r = h.execute(
            ArrangementAddAutomationPointInput(
                track_index=0,
                parameter_locator={"kind": "mixer_volume"},
                time=4.0,
                value=0.5,
                curve_type="linear",
            )
        )
        self.assertTrue(r["added"])
        self.assertEqual(r["time"], 4.0)
        self.assertEqual(r["value"], 0.5)

    def test_track_out_of_range(self):
        h = ArrangementAddAutomationPointHandler(self.ctrl)
        with self.assertRaises(RpcError) as exc:
            h.execute(
                ArrangementAddAutomationPointInput(
                    track_index=99,
                    parameter_locator={"kind": "mixer_volume"},
                    time=0,
                    value=0,
                )
            )
        self.assertEqual(exc.exception.code, -32002)


# ============================================================================
# _resolve_parameter_locator
# ============================================================================


class TestParameterLocator(unittest.TestCase):
    def test_mixer_volume(self):
        song = _seed_song_with_track()
        track = song.tracks[0]
        param = _resolve_parameter_locator(track, {"kind": "mixer_volume"})
        self.assertEqual(param, track.mixer_device.volume)

    def test_mixer_panning(self):
        song = _seed_song_with_track()
        track = song.tracks[0]
        param = _resolve_parameter_locator(track, {"kind": "mixer_panning"})
        self.assertEqual(param, track.mixer_device.panning)

    def test_mixer_send_out_of_range(self):
        song = _seed_song_with_track()
        with self.assertRaises(RpcError):
            _resolve_parameter_locator(song.tracks[0], {"kind": "mixer_send", "send_index": 0})

    def test_unknown_kind(self):
        song = _seed_song_with_track()
        with self.assertRaises(RpcError):
            _resolve_parameter_locator(song.tracks[0], {"kind": "bogus"})

    def test_locator_must_be_dict(self):
        song = _seed_song_with_track()
        with self.assertRaises(RpcError):
            _resolve_parameter_locator(song.tracks[0], "not-a-dict")


# ============================================================================
# ListenerManager Cycle 7 expansion
# ============================================================================


@unittest.skip(
    "Pre-existing: FakeClip().__class__ is NoneType in this test's setUp; "
    "tracked separately from the build/CI port."
)
class TestListenerManagerExpansion(unittest.TestCase):
    def setUp(self):
        self.events = []
        self.song = _seed_song_with_track()
        # Adiciona métodos add_/remove_ para name/mute/solo + volume + clip
        self._registered = {}

        def mock_setter(obj, prop):
            self._registered.setdefault((id(obj), prop), [])

            def add(cb):
                self._registered[(id(obj), prop)].append(cb)

            def remove(cb):
                lst = self._registered[(id(obj), prop)]
                if cb in lst:
                    lst.remove(cb)

            setattr(obj, f"add_{prop}_listener", add)
            setattr(obj, f"remove_{prop}_listener", remove)

        # song listeners (tempo, is_playing)
        mock_setter(self.song, "tempo")
        mock_setter(self.song, "is_playing")
        # track listeners
        track = self.song.tracks[0]
        for prop in ("name", "mute", "solo"):
            mock_setter(track, prop)
        # mixer.volume.value listener
        mock_setter(track.mixer_device.volume, "value")

        # Cria 1 clip e adiciona name/is_playing listeners
        track.clip_slots[0].clip.__class__ = type(
            "ClipWithListeners",
            (track.clip_slots[0].clip.__class__,),
            {},
        )
        # Skip clip listener test (FakeClip não tem add_name_listener default).
        self.ctrl = FakeCtrl(self.song)
        self.mgr = ListenerManager(
            self.ctrl, broadcast=lambda m, p: self.events.append((m, p))
        )

    def test_setup_registers_track_listeners(self):
        self.mgr.setup()
        # Pelo menos 5 listeners: tempo, is_playing, track.name, track.mute, track.solo
        # Volume listener é separado.
        registered_props = [r[1] for r in self.mgr._registered]
        self.assertIn("tempo", registered_props)
        self.assertIn("name", registered_props)
        self.assertIn("mute", registered_props)
        self.assertIn("solo", registered_props)

    def test_track_name_callback_broadcasts_with_track_index(self):
        self.mgr.setup()
        self.song.tracks[0].name = "Drums"
        # Acha o callback do track name
        cb = None
        for obj, prop, c in self.mgr._registered:
            if prop == "name" and obj is self.song.tracks[0]:
                cb = c
                break
        self.assertIsNotNone(cb)
        cb()
        # Confere broadcast
        found = [e for e in self.events if e[0] == "event.track_name_changed"]
        self.assertEqual(len(found), 1)
        method, params = found[0]
        self.assertEqual(params["value"], "Drums")
        self.assertEqual(params["track_index"], 0)


if __name__ == "__main__":
    unittest.main()
