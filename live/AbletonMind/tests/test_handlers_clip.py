import unittest

from ..errors import (
    INVALID_STATE,
    OBJECT_NOT_FOUND,
    OUT_OF_RANGE,
    TYPE_MISMATCH,
    RpcError,
)
from ..handlers.clip import CreateMidiClipHandler
from ..schemas import CreateMidiClipInput
from ._fakes.live_api import FakeCtrl, FakeSong, FakeTrack


def _song_with_midi_and_audio() -> FakeSong:
    song = FakeSong()
    song.tracks = [
        FakeTrack(name="Drums", is_midi=True, num_slots=8),
        FakeTrack(name="Vocals", is_audio=True, num_slots=8),
    ]
    return song


class TestCreateMidiClip(unittest.TestCase):
    def test_creates_clip_with_name_and_length(self):
        song = _song_with_midi_and_audio()
        ctrl = FakeCtrl(song=song)
        r = CreateMidiClipHandler(ctrl).execute(
            CreateMidiClipInput(
                track_index=0, clip_slot_index=2, length_beats=8.0, name="loop"
            )
        )
        self.assertTrue(r["changed"])
        self.assertEqual(r["clip"]["track_index"], 0)
        self.assertEqual(r["clip"]["clip_slot_index"], 2)
        self.assertEqual(r["clip"]["name"], "loop")
        self.assertEqual(r["clip"]["length_beats"], 8.0)

        slot = song.tracks[0].clip_slots[2]
        self.assertIsNotNone(slot.clip)
        self.assertEqual(slot.clip.name, "loop")

    def test_wraps_in_undo_step(self):
        song = _song_with_midi_and_audio()
        ctrl = FakeCtrl(song=song)
        CreateMidiClipHandler(ctrl).execute(
            CreateMidiClipInput(track_index=0, clip_slot_index=0, length_beats=4.0)
        )
        self.assertEqual(song.undo_steps, ["begin", "end"])
        self.assertEqual(song._undo_depth, 0)

    def test_track_not_found(self):
        song = _song_with_midi_and_audio()
        ctrl = FakeCtrl(song=song)
        with self.assertRaises(RpcError) as cm:
            CreateMidiClipHandler(ctrl).execute(
                CreateMidiClipInput(track_index=99, clip_slot_index=0, length_beats=4.0)
            )
        self.assertEqual(cm.exception.code, OBJECT_NOT_FOUND)
        self.assertEqual(cm.exception.data["num_tracks"], 2)
        self.assertEqual(cm.exception.data["got"], 99)

    def test_audio_track_rejected(self):
        song = _song_with_midi_and_audio()
        ctrl = FakeCtrl(song=song)
        with self.assertRaises(RpcError) as cm:
            CreateMidiClipHandler(ctrl).execute(
                CreateMidiClipInput(track_index=1, clip_slot_index=0, length_beats=4.0)
            )
        self.assertEqual(cm.exception.code, TYPE_MISMATCH)
        self.assertEqual(cm.exception.data["expected"], "midi")
        self.assertEqual(cm.exception.data["actual"], "audio")

    def test_clip_slot_out_of_range(self):
        song = _song_with_midi_and_audio()
        ctrl = FakeCtrl(song=song)
        with self.assertRaises(RpcError) as cm:
            CreateMidiClipHandler(ctrl).execute(
                CreateMidiClipInput(track_index=0, clip_slot_index=99, length_beats=4.0)
            )
        self.assertEqual(cm.exception.code, OUT_OF_RANGE)
        self.assertEqual(cm.exception.data["max"], 7)
        self.assertEqual(cm.exception.data["got"], 99)

    def test_zero_length_rejected(self):
        song = _song_with_midi_and_audio()
        ctrl = FakeCtrl(song=song)
        with self.assertRaises(RpcError) as cm:
            CreateMidiClipHandler(ctrl).execute(
                CreateMidiClipInput(track_index=0, clip_slot_index=0, length_beats=0.0)
            )
        self.assertEqual(cm.exception.code, OUT_OF_RANGE)

    def test_slot_already_has_clip(self):
        song = _song_with_midi_and_audio()
        song.tracks[0].clip_slots[3].create_clip(2.0)  # pre-populate
        ctrl = FakeCtrl(song=song)
        with self.assertRaises(RpcError) as cm:
            CreateMidiClipHandler(ctrl).execute(
                CreateMidiClipInput(track_index=0, clip_slot_index=3, length_beats=4.0)
            )
        self.assertEqual(cm.exception.code, INVALID_STATE)
        # Should not have opened an undo step
        self.assertEqual(song.undo_steps, [])


if __name__ == "__main__":
    unittest.main()
