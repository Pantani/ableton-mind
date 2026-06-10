# TD-030 Summary — Push Hardware Smoke

**Cycle:** 23  
**Owner:** qa-integration  
**Collected:** 2026-06-09 23:22:44 -03  
**Verdict:** BLOCKED  

TD-030 cannot close in this cycle. A real Push 2/3 hardware smoke did not run because this machine does not expose a connected Push over USB or active CoreMIDI endpoints. Sending Push Sysex was not a valid/safe smoke without hardware visibility.

## Scope Read

- `AGENTS.md`
- `_workspace/cycle-briefing-23.md`
- `_workspace/tech-debt.md`
- `live/AbletonMind/handlers/push.py`
- `src/tools/push.ts`
- `tests/tools-locator-and-phase4.test.ts`
- Relevant Push/smoke docs:
  - `_workspace/decisions/0008-push-control.md`
  - `_workspace/qa/cycle-10-report.md`
  - `docs/smoke-test.md`
  - `tests/phase5-6-recipes.test.ts`
  - `src/cli/doctor.ts`

## Push Contract Observed

- TS tools: `push_set_pad_color`, `push_set_button_led`, `push_set_mode`.
- Bridge methods: `push.set_pad_color`, `push.set_button_led`, `push.set_mode`.
- Python detection is `application.control_surfaces` name contains `Push`.
- No-Push behavior is expected to return `-32000` with `detected: false`.
- Real closure criterion is stricter than unit tests: TD-030 closes only after a real Push 2/3 hardware smoke.

## Evidence

### Hardware / MIDI

- `rtk system_profiler -listDataTypes`
  - Exit 0.
  - `SPUSBHostDataType` is available; no dedicated `SPMIDIDataType` is available on this machine.
- `rtk proxy sh -lc 'system_profiler SPUSBHostDataType 2>/dev/null | rg -i -C 4 "Ableton|Push|MIDI"'`
  - Exit 1.
  - No USB hardware lines matching `Ableton`, `Push`, or `MIDI`.
- `rtk proxy swift -e '<CoreMIDI inventory>'`
  - Exit 0.
  - CoreMIDI devices:
    - `Network`, entities `0`
    - `UMP Network`, entities `0`
    - `IAC Driver`, offline `1`, entity `Bus 1`
    - `Bluetooth MIDI Driver`, entities `0`
  - `CoreMIDI sources: 0`
  - `CoreMIDI destinations: 0`
- `rtk proxy sh -lc 'system_profiler SPAudioDataType 2>/dev/null | rg -i -C 4 "Ableton|Push|MIDI"'`
  - Exit 1.
  - No audio/MIDI hardware lines matching `Ableton`, `Push`, or `MIDI`.
- `rtk proxy sh -lc 'system_profiler SPBluetoothDataType 2>/dev/null | rg -i -C 4 "Ableton|Push|MIDI"'`
  - Exit 1.
  - No Bluetooth device lines matching `Ableton`, `Push`, or `MIDI`.

### Live / Bridge

- `rtk pgrep -fl "Ableton Live|Live"`
  - Exit 0.
  - Ableton Live 12 Trial process is running.
- `rtk lsof -nP -iTCP:9876 -sTCP:LISTEN`
  - Exit 0.
  - `Live` is listening on `127.0.0.1:9876`.
- `rtk nc -vz -w 2 127.0.0.1 9876`
  - Exit 0.
  - TCP connection succeeded.
- `rtk proxy sh -lc 'printf ... system.hello ... | nc -w 2 127.0.0.1 9876'`
  - Exit 0.
  - Response:
    - `bridge: ableton-mind/python`
    - `version: 0.0.21`
    - `live_version: 12.4.1`
    - `python_version: 3.11.6`
    - `protocol_version: 0.1`
- `rtk ls -ld "$HOME/Music/Ableton/User Library/Remote Scripts/AbletonMind"`
  - Exit 0.
  - Remote Script is installed as a symlink to this repo's `live/AbletonMind`.

### Push Tests / CLI Surface

- `rtk npm test -- tests/phase5-6-recipes.test.ts -t push`
  - Exit 0.
  - Vitest: 1 file passed; 6 Push-focused tests passed; 14 skipped.
  - This validates TS forwarding/defaults/schema rejection only. It is not a hardware smoke.
- `rtk ls dist/cli/doctor.js`
  - Exit 1.
  - Built doctor CLI is not present in `dist/`; source `src/cli/doctor.ts` checks bridge/install/knowledge/recipes but has no Push hardware check.

## Safety Decision

No Push 2/3 is visible via USB or active CoreMIDI endpoints. Because the Push handlers send Sysex when the bridge thinks a Push control surface exists, I did not call `push.set_pad_color`, `push.set_button_led`, or `push.set_mode`. Without visible hardware, such a call would not prove TD-030 and could still mutate a stale/manual Live control-surface route.

## TD-030 Closure

**Cannot close.** Keep TD-030 open as environment-blocked until a Push 2 or Push 3 is attached and activated in Live. Closure requires a real hardware smoke that sends one or more Push commands and confirms the hardware response.
