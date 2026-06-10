"""
LiveAPI fakes for offline tests.

Implements the subset used by handlers up to Cycle 3:
- `Song`: tempo, is_playing, current_song_time, tracks, return_tracks,
  master_track, start_playing/stop_playing, begin_undo_step/end_undo_step,
  signature_numerator/denominator, name, song_length, root_note, scale_name.
- `Track`: name, color_index, has_midi_input, has_audio_input, clip_slots,
  is_grouped, is_foldable, mute, solo, arm, mixer_device.
- `MixerDevice`: volume (DeviceParameter), panning, sends.
- `DeviceParameter`: value (read/write).
- `ClipSlot`: has_clip, clip, create_clip(length), fire(), stop().
- `Clip`: name, length, is_midi_clip, is_playing, add_new_notes(spec),
  set_notes(legacy), notes (internal list for asserts).
- `BrowserItem` + `Application` + `FakeCtrl.application` for browser tests.

Everything is instrumented for assertions: `FakeSong.undo_steps` counts
begin/end, `FakeClipSlot.create_clip` records history, `FakeClip.notes` is
a list accumulated by `add_new_notes`/`set_notes`.
"""
from typing import List, Optional


class FakeClip:
    def __init__(self, name: str = "", length: float = 4.0, is_midi: bool = True):
        self.name = name
        self.length = length
        self.is_midi_clip = is_midi
        self.is_playing = False
        self.notes: List[dict] = []  # accumulated for assertions
        self.loop_start: float = 0.0
        self.loop_end: float = float(length)
        self.looping: bool = True

    def add_new_notes(self, spec) -> None:
        """Live 11+ API: spec is `{"notes": [...]}`."""
        if isinstance(spec, dict) and "notes" in spec:
            for n in spec["notes"]:
                self.notes.append(dict(n))
        else:
            raise TypeError("add_new_notes expects {'notes': [...]}")

    def set_notes(self, tup) -> None:
        """Legacy API: tuple of 5-tuples."""
        for n in tup:
            pitch, start, dur, vel, mute = n
            self.notes.append(
                {
                    "pitch": pitch,
                    "start_time": start,
                    "duration": dur,
                    "velocity": vel,
                    "mute": mute,
                }
            )


class FakeClipSlot:
    def __init__(self):
        self.clip: Optional[FakeClip] = None
        self.create_calls: List[float] = []
        self.fire_calls: int = 0
        self.stop_calls: int = 0

    @property
    def has_clip(self) -> bool:
        return self.clip is not None

    def create_clip(self, length: float) -> None:
        if self.has_clip:
            raise RuntimeError("clip slot already has a clip")
        self.create_calls.append(float(length))
        self.clip = FakeClip(name="", length=float(length))

    def fire(self) -> None:
        self.fire_calls += 1
        if self.clip is not None:
            self.clip.is_playing = True

    def stop(self) -> None:
        self.stop_calls += 1
        if self.clip is not None:
            self.clip.is_playing = False


class FakeDeviceParameter:
    """Mirrors `Live.DeviceParameter.DeviceParameter` (only the subset used).

    TD-020 (Cycle 7): name/is_quantized/value_items/automation_state are now in
    the constructor to avoid post-build mutation in tests.
    """

    def __init__(
        self,
        value: float = 0.0,
        mn: float = 0.0,
        mx: float = 1.0,
        *,
        name: str = "",
        is_quantized: bool = False,
        value_items: Optional[List[str]] = None,
        automation_state: int = 0,
    ):
        self.value = value
        self.min = mn
        self.max = mx
        self.name = name
        self.is_quantized = is_quantized
        self.value_items = list(value_items) if value_items else []
        self.automation_state = automation_state


class FakeMixerDevice:
    def __init__(self):
        self.volume = FakeDeviceParameter(value=0.85)  # 0 dB
        self.panning = FakeDeviceParameter(value=0.0, mn=-1.0, mx=1.0)
        self.sends: List[FakeDeviceParameter] = []


class FakeTrack:
    def __init__(
        self,
        name: str = "Track",
        *,
        is_midi: bool = False,
        is_audio: bool = False,
        num_slots: int = 8,
        color_index: int = 0,
    ):
        self.name = name
        self.color_index = color_index
        self.has_midi_input = is_midi
        self.has_audio_input = is_audio
        self.is_grouped = False
        self.is_foldable = False
        self.mute = False
        self.solo = False
        self.arm = False
        self.clip_slots = [FakeClipSlot() for _ in range(num_slots)]
        self.mixer_device = FakeMixerDevice()


class FakeReturnTrack:
    def __init__(self, name: str = "Return", color_index: int = 0):
        self.name = name
        self.color_index = color_index
        self.mute = False
        self.solo = False
        self.mixer_device = FakeMixerDevice()


class FakeMasterTrack:
    def __init__(self, name: str = "Master", color_index: int = 0):
        self.name = name
        self.color_index = color_index
        self.mixer_device = FakeMixerDevice()


class FakeScene:
    def __init__(self, name: str = "Scene"):
        self.name = name
        self.fire_calls: int = 0

    def fire(self) -> None:
        self.fire_calls += 1


class FakeSong:
    def __init__(self):
        self.tempo: float = 120.0
        self.is_playing: bool = False
        self.current_song_time: float = 0.0
        self.tracks: List[FakeTrack] = []
        self.return_tracks: List[FakeReturnTrack] = []
        self.master_track: FakeMasterTrack = FakeMasterTrack()
        self.scenes: List[FakeScene] = []
        self.undo_steps: List[str] = []
        self._undo_depth: int = 0
        self.signature_numerator: int = 4
        self.signature_denominator: int = 4
        self.name: str = "Untitled"
        self.song_length: float = 0.0
        self.root_note: int = 0
        self.scale_name: str = ""

    # transport
    def start_playing(self) -> None:
        self.is_playing = True

    def stop_playing(self) -> None:
        self.is_playing = False

    # undo
    def begin_undo_step(self) -> None:
        self.undo_steps.append("begin")
        self._undo_depth += 1

    def end_undo_step(self) -> None:
        self.undo_steps.append("end")
        self._undo_depth -= 1

    # track creation
    def create_midi_track(self, idx: int) -> None:
        self.tracks.insert(idx, FakeTrack(name=f"{idx + 1} MIDI", is_midi=True))

    def create_audio_track(self, idx: int) -> None:
        self.tracks.insert(idx, FakeTrack(name=f"{idx + 1} Audio", is_audio=True))


# ---------- Browser fakes -----------------------------------------------------


class FakeBrowserItem:
    def __init__(self, name: str, is_folder: bool = True, is_loadable: bool = False):
        self.name = name
        self.is_folder = is_folder
        self.is_loadable = is_loadable
        self.children: List["FakeBrowserItem"] = []


class FakeBrowser:
    def __init__(self):
        self.audio_effects = FakeBrowserItem("Audio Effects")
        self.midi_effects = FakeBrowserItem("MIDI Effects")
        self.instruments = FakeBrowserItem("Instruments")
        self.drums = FakeBrowserItem("Drums")
        self.samples = FakeBrowserItem("Samples")
        self.sounds = FakeBrowserItem("Sounds")
        self.current_project = FakeBrowserItem("Current Project")
        self.user_library = FakeBrowserItem("User Library")
        self.packs = FakeBrowserItem("Packs")
        self.plugins = FakeBrowserItem("Plug-ins")


class FakeApplication:
    def __init__(self):
        self.browser = FakeBrowser()


# ---------- ControlSurface stub ----------------------------------------------


def install_listener_methods(obj, props):
    """Helper (TD-025) — installs dynamic `add_<prop>_listener` /
    `remove_<prop>_listener` on `obj` for each prop in `props`. Stores callbacks
    in a dict `obj._fake_listeners` for inspection.

    Typical use in tests:
        install_listener_methods(song, ["tempo", "is_playing"])
        install_listener_methods(track, ["name", "mute", "solo"])

    After `ListenerManager.setup()`, you can inspect `obj._fake_listeners[prop]`
    to confirm a callback was registered, and invoke it manually to simulate
    Live's trigger.
    """
    if not hasattr(obj, "_fake_listeners"):
        obj._fake_listeners = {}
    for prop in props:
        obj._fake_listeners.setdefault(prop, [])

        def make_add(p):
            def _add(cb):
                obj._fake_listeners[p].append(cb)

            return _add

        def make_remove(p):
            def _remove(cb):
                if cb in obj._fake_listeners[p]:
                    obj._fake_listeners[p].remove(cb)

            return _remove

        setattr(obj, f"add_{prop}_listener", make_add(prop))
        setattr(obj, f"remove_{prop}_listener", make_remove(prop))


def fire_listener(obj, prop):
    """Test helper — invokes every callback of `prop` on `obj`."""
    for cb in obj._fake_listeners.get(prop, []):
        cb()


class FakeCtrl:
    """ControlSurface stub — exposes `.song()` (and optionally `.application`)."""

    def __init__(
        self,
        song: Optional[FakeSong] = None,
        application: Optional[FakeApplication] = None,
    ):
        self._song = song or FakeSong()
        self.application = application
        self.log_lines: List[str] = []

    def song(self) -> FakeSong:
        return self._song

    def log_message(self, line: str) -> None:
        self.log_lines.append(line)

    def schedule_message(self, delay_ms: int, fn) -> None:
        pass
