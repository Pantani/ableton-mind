import unittest

from live.AbletonMind.errors import LIVE_NOT_RUNNING, OUT_OF_RANGE, RpcError
from live.AbletonMind.handlers.transport import (
    PlayHandler,
    SetTempoHandler,
    StopHandler,
)
from live.AbletonMind.schemas import PlayInput, SetTempoInput, StopInput
from live.AbletonMind.tests._fakes.live_api import FakeCtrl, FakeSong


class TestPlay(unittest.TestCase):
    def test_play_when_stopped_changes(self):
        ctrl = FakeCtrl()
        r = PlayHandler(ctrl).execute(PlayInput())
        self.assertTrue(r["changed"])
        self.assertTrue(r["is_playing"])

    def test_play_when_playing_is_idempotent(self):
        song = FakeSong()
        song.is_playing = True
        ctrl = FakeCtrl(song=song)
        r = PlayHandler(ctrl).execute(PlayInput())
        self.assertFalse(r["changed"])
        self.assertTrue(r["is_playing"])

    def test_play_from_beginning_resets_time(self):
        song = FakeSong()
        song.is_playing = True
        song.current_song_time = 32.0
        ctrl = FakeCtrl(song=song)
        r = PlayHandler(ctrl).execute(PlayInput(from_beginning=True))
        self.assertTrue(r["changed"])
        self.assertEqual(r["current_song_time"], 0.0)


class TestStop(unittest.TestCase):
    def test_stop_when_playing_changes(self):
        song = FakeSong()
        song.is_playing = True
        ctrl = FakeCtrl(song=song)
        r = StopHandler(ctrl).execute(StopInput())
        self.assertTrue(r["changed"])
        self.assertFalse(r["is_playing"])

    def test_stop_when_stopped_is_idempotent(self):
        ctrl = FakeCtrl()
        r = StopHandler(ctrl).execute(StopInput())
        self.assertFalse(r["changed"])
        self.assertFalse(r["is_playing"])


class TestSetTempo(unittest.TestCase):
    def test_set_tempo_changes(self):
        ctrl = FakeCtrl()
        r = SetTempoHandler(ctrl).execute(SetTempoInput(bpm=128.0))
        self.assertTrue(r["changed"])
        self.assertEqual(r["before"], 120.0)
        self.assertEqual(r["after"], 128.0)

    def test_set_tempo_same_value_is_idempotent(self):
        ctrl = FakeCtrl()
        r = SetTempoHandler(ctrl).execute(SetTempoInput(bpm=120.0))
        self.assertFalse(r["changed"])
        self.assertEqual(r["before"], 120.0)
        self.assertEqual(r["after"], 120.0)

    def test_set_tempo_out_of_range_low(self):
        ctrl = FakeCtrl()
        with self.assertRaises(RpcError) as cm:
            SetTempoHandler(ctrl).execute(SetTempoInput(bpm=10.0))
        self.assertEqual(cm.exception.code, OUT_OF_RANGE)
        self.assertEqual(cm.exception.data["min"], 20.0)
        self.assertEqual(cm.exception.data["max"], 999.0)
        self.assertEqual(cm.exception.data["got"], 10.0)

    def test_set_tempo_out_of_range_high(self):
        ctrl = FakeCtrl()
        with self.assertRaises(RpcError) as cm:
            SetTempoHandler(ctrl).execute(SetTempoInput(bpm=1500.0))
        self.assertEqual(cm.exception.code, OUT_OF_RANGE)

    def test_live_not_running_raises(self):
        class NoSongCtrl:
            def song(self):
                return None

        with self.assertRaises(RpcError) as cm:
            SetTempoHandler(NoSongCtrl()).execute(SetTempoInput(bpm=120.0))
        self.assertEqual(cm.exception.code, LIVE_NOT_RUNNING)


if __name__ == "__main__":
    unittest.main()
