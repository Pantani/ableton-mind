"""
Consolidated coverage for Cycle 3 + Cycle 4 handlers (TD-009).

Covers:
  Cycle 3 (TD-009 carry-over):
    - track.upsert, track.set_name, track.set_volume
    - clip.add_notes, clip.fire, clip.stop, clip.set_name
    - session.get_info, browser.get_categories
  Cycle 4:
    - track.get_info, scene.fire, clip.set_loop
"""
import sys
import unittest

from ..errors import RpcError
from ..handlers import REGISTRY
from ..handlers.browser import BrowserGetCategoriesHandler
from ..handlers.clip import (
    ClipAddNotesHandler,
    ClipFireHandler,
    ClipSetLoopHandler,
    ClipSetNameHandler,
    ClipStopHandler,
    CreateMidiClipHandler,
)
from ..handlers.scene import SceneFireHandler
from ..handlers.session import SessionGetInfoHandler
from ..handlers.track import (
    TrackGetInfoHandler,
    TrackSetNameHandler,
    TrackSetVolumeHandler,
    TrackUpsertHandler,
    _volume_to_db,
)
from ..schemas import (
    BrowserGetCategoriesInput,
    ClipAddNotesInput,
    ClipFireInput,
    ClipSetLoopInput,
    ClipSetNameInput,
    ClipStopInput,
    CreateMidiClipInput,
    SceneFireInput,
    SessionGetInfoInput,
    TrackGetInfoInput,
    TrackSetNameInput,
    TrackSetVolumeInput,
    TrackUpsertInput,
)

from ._fakes.live_api import FakeApplication, FakeCtrl, FakeScene, FakeSong, FakeTrack


# ---------- helpers ----------------------------------------------------------


def _seed_song():
    song = FakeSong()
    song.tracks.append(FakeTrack(name="Drums", is_midi=True))
    song.tracks.append(FakeTrack(name="Bass", is_audio=True))
    return song


def _seed_clip(song, track_index, slot_index, length=4.0, name=""):
    """Create a clip in a slot. Return the FakeClip."""
    track = song.tracks[track_index]
    slot = track.clip_slots[slot_index]
    CreateMidiClipHandler(FakeCtrl(song)).execute(
        CreateMidiClipInput(
            track_index=track_index, clip_slot_index=slot_index, length_beats=length, name=name
        )
    )
    return slot.clip


# ============================================================================
# Cycle 3 — Track
# ============================================================================


class TestTrackUpsert(unittest.TestCase):
    def test_creates_when_name_absent(self):
        song = _seed_song()
        h = TrackUpsertHandler(FakeCtrl(song))
        r = h.execute(TrackUpsertInput(name="Pad", type="midi"))
        self.assertTrue(r["changed"])
        self.assertEqual(r["track"]["name"], "Pad")
        self.assertTrue(r["track"]["is_midi"])
        self.assertEqual(len(song.tracks), 3)

    def test_idempotent_when_name_present(self):
        song = _seed_song()
        h = TrackUpsertHandler(FakeCtrl(song))
        r = h.execute(TrackUpsertInput(name="Drums", type="midi"))
        self.assertFalse(r["changed"])
        self.assertEqual(r["track"]["index"], 0)
        self.assertEqual(len(song.tracks), 2)

    def test_rejects_empty_name(self):
        song = _seed_song()
        h = TrackUpsertHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(TrackUpsertInput(name="", type="midi"))

    def test_rejects_bad_type(self):
        song = _seed_song()
        h = TrackUpsertHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(TrackUpsertInput(name="X", type="group"))


class TestTrackSetName(unittest.TestCase):
    def test_renames(self):
        song = _seed_song()
        h = TrackSetNameHandler(FakeCtrl(song))
        r = h.execute(TrackSetNameInput(index=0, name="Kick"))
        self.assertTrue(r["changed"])
        self.assertEqual(r["before"], "Drums")
        self.assertEqual(r["after"], "Kick")

    def test_idempotent(self):
        song = _seed_song()
        h = TrackSetNameHandler(FakeCtrl(song))
        r = h.execute(TrackSetNameInput(index=0, name="Drums"))
        self.assertFalse(r["changed"])

    def test_out_of_range(self):
        song = _seed_song()
        h = TrackSetNameHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(TrackSetNameInput(index=99, name="X"))


class TestTrackSetVolume(unittest.TestCase):
    def test_changes_volume_and_returns_db(self):
        song = _seed_song()
        h = TrackSetVolumeHandler(FakeCtrl(song))
        r = h.execute(TrackSetVolumeInput(index=0, volume=0.5))
        self.assertTrue(r["changed"])
        self.assertAlmostEqual(r["after"], 0.5, places=4)
        # 0.5 ≈ -16 dB segundo tabela ADR-0004
        self.assertAlmostEqual(r["after_db"], -16.0, places=1)

    def test_idempotent_within_tolerance(self):
        song = _seed_song()
        song.tracks[0].mixer_device.volume.value = 0.5
        h = TrackSetVolumeHandler(FakeCtrl(song))
        r = h.execute(TrackSetVolumeInput(index=0, volume=0.50001))
        self.assertFalse(r["changed"])

    def test_out_of_range(self):
        song = _seed_song()
        h = TrackSetVolumeHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(TrackSetVolumeInput(index=0, volume=1.5))

    def test_volume_to_db_curve(self):
        # Anchor points from the ADR-0004 table
        self.assertEqual(_volume_to_db(0.0), float("-inf"))
        self.assertAlmostEqual(_volume_to_db(0.85), 0.0, places=2)
        self.assertAlmostEqual(_volume_to_db(1.0), 6.0, places=2)


# ============================================================================
# Cycle 3 — Clip mutators
# ============================================================================


class TestClipAddNotes(unittest.TestCase):
    def test_appends_notes(self):
        song = _seed_song()
        _seed_clip(song, 0, 0, length=4.0)
        h = ClipAddNotesHandler(FakeCtrl(song))
        r = h.execute(
            ClipAddNotesInput(
                track_index=0,
                clip_slot_index=0,
                notes=[
                    {"pitch": 60, "start": 0.0, "duration": 0.5, "velocity": 100},
                    {"pitch": 64, "start": 0.5, "duration": 0.5},
                ],
            )
        )
        self.assertTrue(r["changed"])
        self.assertEqual(r["added"], 2)
        clip = song.tracks[0].clip_slots[0].clip
        self.assertEqual(len(clip.notes), 2)
        self.assertEqual(clip.notes[0]["pitch"], 60)

    def test_rejects_empty_notes(self):
        song = _seed_song()
        _seed_clip(song, 0, 0)
        h = ClipAddNotesHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(ClipAddNotesInput(track_index=0, clip_slot_index=0, notes=[]))

    def test_rejects_pitch_oor(self):
        song = _seed_song()
        _seed_clip(song, 0, 0)
        h = ClipAddNotesHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(
                ClipAddNotesInput(
                    track_index=0,
                    clip_slot_index=0,
                    notes=[{"pitch": 200, "start": 0, "duration": 1}],
                )
            )

    def test_rejects_empty_slot(self):
        song = _seed_song()
        h = ClipAddNotesHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(
                ClipAddNotesInput(
                    track_index=0,
                    clip_slot_index=0,
                    notes=[{"pitch": 60, "start": 0, "duration": 1}],
                )
            )


class TestClipFireStop(unittest.TestCase):
    def test_fire_then_stop(self):
        song = _seed_song()
        _seed_clip(song, 0, 0)
        ctrl = FakeCtrl(song)

        r = ClipFireHandler(ctrl).execute(ClipFireInput(track_index=0, clip_slot_index=0))
        self.assertTrue(r["changed"])
        self.assertTrue(r["is_playing"])

        # Idempotent: firing again -> changed=False.
        r = ClipFireHandler(ctrl).execute(ClipFireInput(track_index=0, clip_slot_index=0))
        self.assertFalse(r["changed"])

        r = ClipStopHandler(ctrl).execute(ClipStopInput(track_index=0, clip_slot_index=0))
        self.assertTrue(r["changed"])
        self.assertFalse(r["is_playing"])

        r = ClipStopHandler(ctrl).execute(ClipStopInput(track_index=0, clip_slot_index=0))
        self.assertFalse(r["changed"])


class TestClipSetName(unittest.TestCase):
    def test_rename(self):
        song = _seed_song()
        _seed_clip(song, 0, 0, name="Verse")
        h = ClipSetNameHandler(FakeCtrl(song))
        r = h.execute(ClipSetNameInput(track_index=0, clip_slot_index=0, name="Chorus"))
        self.assertTrue(r["changed"])
        self.assertEqual(r["before"], "Verse")
        self.assertEqual(r["after"], "Chorus")

    def test_idempotent(self):
        song = _seed_song()
        _seed_clip(song, 0, 0, name="Verse")
        h = ClipSetNameHandler(FakeCtrl(song))
        r = h.execute(ClipSetNameInput(track_index=0, clip_slot_index=0, name="Verse"))
        self.assertFalse(r["changed"])


# ============================================================================
# Cycle 3 — Session + Browser
# ============================================================================


class TestSessionGetInfo(unittest.TestCase):
    def test_snapshot_basic(self):
        song = _seed_song()
        song.tempo = 140
        song.is_playing = True
        h = SessionGetInfoHandler(FakeCtrl(song))
        r = h.execute(SessionGetInfoInput())
        self.assertEqual(r["num_tracks"], 2)
        self.assertEqual(r["num_return_tracks"], 0)
        self.assertTrue(r["has_master"])
        self.assertEqual(r["tempo"], 140)
        self.assertTrue(r["is_playing"])
        self.assertEqual(r["time_signature"], {"numerator": 4, "denominator": 4})


class TestBrowserGetCategories(unittest.TestCase):
    def test_unavailable_when_no_application(self):
        song = _seed_song()
        ctrl = FakeCtrl(song)  # no application
        h = BrowserGetCategoriesHandler(ctrl)
        r = h.execute(BrowserGetCategoriesInput())
        self.assertFalse(r["available"])
        self.assertEqual(r["categories"], [])

    def test_lists_categories_when_app_present(self):
        song = _seed_song()
        ctrl = FakeCtrl(song, application=FakeApplication())
        h = BrowserGetCategoriesHandler(ctrl)
        r = h.execute(BrowserGetCategoriesInput())
        self.assertTrue(r["available"])
        keys = {c["key"] for c in r["categories"]}
        self.assertIn("instruments", keys)
        self.assertIn("audio_effects", keys)

    def test_lists_categories_when_application_is_method(self):
        class MethodApplicationCtrl:
            def __init__(self, song, application):
                self._song = song
                self._application = application

            def song(self):
                return self._song

            def application(self):
                return self._application

        song = _seed_song()
        ctrl = MethodApplicationCtrl(song, FakeApplication())
        h = BrowserGetCategoriesHandler(ctrl)
        r = h.execute(BrowserGetCategoriesInput())
        self.assertTrue(r["available"])
        keys = {c["key"] for c in r["categories"]}
        self.assertIn("instruments", keys)
        self.assertIn("audio_effects", keys)

    def test_lists_categories_from_live_application_fallback(self):
        class FakeLiveApplication:
            @staticmethod
            def get_application():
                return FakeApplication()

        class FakeLive:
            Application = FakeLiveApplication

        previous = sys.modules.get("Live")
        sys.modules["Live"] = FakeLive
        try:
            song = _seed_song()
            ctrl = FakeCtrl(song)
            h = BrowserGetCategoriesHandler(ctrl)
            r = h.execute(BrowserGetCategoriesInput())
        finally:
            if previous is None:
                del sys.modules["Live"]
            else:
                sys.modules["Live"] = previous

        self.assertTrue(r["available"])
        keys = {c["key"] for c in r["categories"]}
        self.assertIn("instruments", keys)
        self.assertIn("audio_effects", keys)


# ============================================================================
# Cycle 4
# ============================================================================


class TestTrackGetInfo(unittest.TestCase):
    def test_detail_snapshot(self):
        song = _seed_song()
        _seed_clip(song, 0, 0)
        h = TrackGetInfoHandler(FakeCtrl(song))
        r = h.execute(TrackGetInfoInput(index=0))
        self.assertEqual(r["index"], 0)
        self.assertEqual(r["name"], "Drums")
        self.assertTrue(r["is_midi"])
        self.assertEqual(r["num_clip_slots"], 8)
        self.assertEqual(r["num_clips"], 1)  # we created 1 clip in slot 0
        # Default volume on FakeMixerDevice is 0.85 (= 0 dB).
        self.assertAlmostEqual(r["volume"], 0.85, places=2)
        self.assertAlmostEqual(r["volume_db"], 0.0, places=2)


class TestSceneFire(unittest.TestCase):
    def test_fires_scene(self):
        song = _seed_song()
        song.scenes.append(FakeScene(name="Intro"))
        song.scenes.append(FakeScene(name="Drop"))
        h = SceneFireHandler(FakeCtrl(song))
        r = h.execute(SceneFireInput(index=1))
        self.assertTrue(r["changed"])
        self.assertEqual(r["index"], 1)
        self.assertEqual(r["name"], "Drop")
        self.assertEqual(song.scenes[1].fire_calls, 1)

    def test_out_of_range(self):
        song = _seed_song()
        h = SceneFireHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(SceneFireInput(index=0))


class TestClipSetLoop(unittest.TestCase):
    def test_sets_loop_fields(self):
        song = _seed_song()
        _seed_clip(song, 0, 0, length=4.0)
        h = ClipSetLoopHandler(FakeCtrl(song))
        r = h.execute(
            ClipSetLoopInput(
                track_index=0, clip_slot_index=0, loop_start=1.0, loop_end=3.0, looping=True
            )
        )
        self.assertTrue(r["changed"])
        self.assertEqual(r["after"]["loop_start"], 1.0)
        self.assertEqual(r["after"]["loop_end"], 3.0)
        self.assertTrue(r["after"]["looping"])

    def test_idempotent_unchanged(self):
        song = _seed_song()
        _seed_clip(song, 0, 0, length=4.0)
        # FakeClip default loop_start=0, loop_end=length=4, looping=True
        h = ClipSetLoopHandler(FakeCtrl(song))
        r = h.execute(ClipSetLoopInput(track_index=0, clip_slot_index=0, looping=True))
        self.assertFalse(r["changed"])

    def test_rejects_end_before_start(self):
        song = _seed_song()
        _seed_clip(song, 0, 0, length=4.0)
        h = ClipSetLoopHandler(FakeCtrl(song))
        with self.assertRaises(RpcError):
            h.execute(
                ClipSetLoopInput(track_index=0, clip_slot_index=0, loop_start=2.0, loop_end=1.0)
            )

    def test_partial_update_preserves_others(self):
        song = _seed_song()
        _seed_clip(song, 0, 0, length=4.0)
        h = ClipSetLoopHandler(FakeCtrl(song))
        r = h.execute(ClipSetLoopInput(track_index=0, clip_slot_index=0, loop_end=2.0))
        self.assertTrue(r["changed"])
        self.assertEqual(r["after"]["loop_start"], 0.0)
        self.assertEqual(r["after"]["loop_end"], 2.0)
        self.assertTrue(r["after"]["looping"])  # preserved


# ============================================================================
# Smoke registry — all 19 expected methods registered
# ============================================================================


class TestRegistry(unittest.TestCase):
    def test_all_methods_registered(self):
        expected = {
            "system.hello",
            "system.ping",
            "transport.play",
            "transport.stop",
            "transport.set_tempo",
            "track.list",
            "track.create",
            "track.upsert",
            "track.set_name",
            "track.set_volume",
            "track.get_info",
            "clip.create_midi",
            "clip.add_notes",
            "clip.fire",
            "clip.stop",
            "clip.set_name",
            "clip.set_loop",
            "scene.fire",
            "session.get_info",
            "browser.get_categories",
        }
        actual = set(REGISTRY.keys())
        missing = expected - actual
        self.assertFalse(missing, f"methods missing from REGISTRY: {missing}")


if __name__ == "__main__":
    unittest.main()
