# Tech Debt — ableton-mind

⚠ = address next cycle. ✅ = closed.

## Open

| ID | Severity | Origin | Item | Fix | Owner |
|---|---|---|---|---|---|
| TD-030 | low | Cycle 10 | Push hardware smoke blocked: no Push 2/3 visible over USB/CoreMIDI | connect Push 2/3 and run real sysex smoke | qa-integration |
| TD-048 | high | Cycle 23 | Package validation red before rc.1 (`typecheck`, tests, build, DXT check) | fix TS/test/build failures, then rerun release gate | ts-server-engineer + distribution-docs-engineer |

**2 open.** TD-030 is environment-blocked; TD-048 is a release-gate blocker discovered while closing TD-005.

## Closed (most recent)

| ID | Cycle | Item |
|---|---|---|
| TD-038, TD-039, TD-040 | 14 | workflow tests / version sync / CI secrets |
| TD-041 | 15 | Knowledge units convention |
| TD-042 | 16 | Curve unit re-annotation |
| TD-043 | 17 | 5 MIDI effects |
| TD-044 | 19 | Prompts subsystem tests |
| TD-045 | 20 | DXT manifest resources field |
| **TD-004** | **21** | **🎯 Real smoke Live 12.4.1 PASS** |
| **TD-046, TD-047** | **22** | **system.hello version stubs (pkg.json + Live API multi-path)** |
| **TD-005** | **23** | **npm install environment verified on real machine; validation failures split to TD-048** |

**46 TDs closed in 23 cycles.** Remaining: TD-030 (Push hardware) and TD-048 (package validation gate).
