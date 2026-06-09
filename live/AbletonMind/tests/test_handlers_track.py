"""
Tests for track.list (new shape per ADR-0002) and track.create.
"""
import unittest

from live.AbletonMind.handlers.track import TrackCreateHandler, TrackListHandler
from live.AbletonMind.schemas import TrackCreateInput, TrackListInput
from live.AbletonMind.tests._fakes.live_api import (
    FakeCtrl,
    FakeReturnTrack,
    FakeSong,
    FakeTrack,
)


def _populated_song() -> FakeSong:
    song = FakeSong()
    song.tracks = [
        FakeTrack(name="Drums", is_midi=True),
        FakeTrack(name="Bass", is_midi=True),
        FakeTrack(name="Vocals", is_audio=True),
    ]
    song.return_tracks = [FakeReturnTrack(name="Reverb"), FakeReturnTrack(name="Delay")]
    return song


class TestTrackList(unittest.TestCase):
    def test_returns_separate_collections(self):
        ctrl = FakeCtrl(song=_populated_song())
        r = TrackListHandler(ctrl).execute(TrackListInput())
        # 3 regular + 2 return + 1 master = 6
        self.assertEqual(r["total"], 6)
        self.assertEqual(len(r["tracks"]), 3)
        self.assertEqual(len(r["return_tracks"]), 2)
        self.assertIsNotNone(r["master_track"])

    def test_regular_tracks_indexed_from_zero(self):
        ctrl = FakeCtrl(song=_populated_song())
        r = TrackListHandler(ctrl).execute(TrackListInput())
        indices = [t["index"] for t in r["tracks"]]
        self.assertEqual(indices, [0, 1, 2])

    def test_regular_track_flags(self):
        ctrl = FakeCtrl(song=_populated_song())
        r = TrackListHandler(ctrl).execute(TrackListInput())
        drums = r["tracks"][0]
        self.assertEqual(drums["name"], "Drums")
        self.assertTrue(drums["is_midi"])
        self.assertFalse(drums["is_audio"])
        self.assertNotIn("is_return", drums)
        self.assertNotIn("is_master", drums)
        vocals = r["tracks"][2]
        self.assertTrue(vocals["is_audio"])
        self.assertFalse(vocals["is_midi"])

    def test_return_tracks_indexed_from_zero(self):
        ctrl = FakeCtrl(song=_populated_song())
        r = TrackListHandler(ctrl).execute(TrackListInput())
        indices = [t["index"] for t in r["return_tracks"]]
        self.assertEqual(indices, [0, 1])
        names = [t["name"] for t in r["return_tracks"]]
        self.assertEqual(names, ["Reverb", "Delay"])

    def test_master_present(self):
        ctrl = FakeCtrl(song=_populated_song())
        r = TrackListHandler(ctrl).execute(TrackListInput())
        self.assertEqual(r["master_track"]["name"], "Master")

    def test_exclude_master_and_returns(self):
        ctrl = FakeCtrl(song=_populated_song())
        r = TrackListHandler(ctrl).execute(
            TrackListInput(include_master=False, include_returns=False)
        )
        self.assertEqual(r["total"], 3)
        self.assertEqual(r["return_tracks"], [])
        self.assertIsNone(r["master_track"])


class TestTrackCreate(unittest.TestCase):
    def test_creates_midi_track_at_end_by_default(self):
        song = _populated_song()
        ctrl = FakeCtrl(song=song)
        r = TrackCreateHandler(ctrl).execute(TrackCreateInput(type="midi"))
        self.assertTrue(r["changed"])
        self.assertEqual(r["track"]["index"], 3)
        self.assertTrue(r["track"]["is_midi"])
        self.assertFalse(r["track"]["is_audio"])
        self.assertEqual(len(song.tracks), 4)

    def test_creates_audio_track_at_specific_index(self):
        song = _populated_song()
        ctrl = FakeCtrl(song=song)
        r = TrackCreateHandler(ctrl).execute(TrackCreateInput(type="audio", index=1))
        self.assertTrue(r["changed"])
        self.assertEqual(r["track"]["index"], 1)
        self.assertTrue(r["track"]["is_audio"])
        # Track previously at index 1 (Bass) is now at index 2.
        self.assertEqual(song.tracks[2].name, "Bass")

    def test_named_track(self):
        song = _populated_song()
        ctrl = FakeCtrl(song=song)
        r = TrackCreateHandler(ctrl).execute(
            TrackCreateInput(type="midi", name="Lead")
        )
        self.assertEqual(r["track"]["name"], "Lead")

    def test_index_out_of_range_rejected(self):
        song = _populated_song()
        ctrl = FakeCtrl(song=song)
        with self.assertRaises(Exception) as exc:
            TrackCreateHandler(ctrl).execute(TrackCreateInput(type="midi", index=99))
        from live.AbletonMind.errors import OUT_OF_RANGE
        self.assertEqual(exc.exception.code, OUT_OF_RANGE)

    def test_invalid_type_rejected(self):
        song = _populated_song()
        ctrl = FakeCtrl(song=song)
        with self.assertRaises(Exception) as exc:
            TrackCreateHandler(ctrl).execute(TrackCreateInput(type="group"))
        from live.AbletonMind.errors import OBJECT_NOT_FOUND
        self.assertEqual(exc.exception.code, OBJECT_NOT_FOUND)

    def test_wraps_in_undo_step(self):
        song = _populated_song()
        ctrl = FakeCtrl(song=song)
        TrackCreateHandler(ctrl).execute(TrackCreateInput(type="midi"))
        self.assertEqual(song.undo_steps, ["begin", "end"])


if __name__ == "__main__":
    unittest.main()
