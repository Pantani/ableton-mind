# Tech Debt — ableton-mind

⚠ = endereçar próximo ciclo. ✅ = fechado.

## Aberto

| ID | Severidade | Origem | Item | Fix | Owner |
|---|---|---|---|---|---|
| TD-005 | baixa | Cycle 1 | npm install não rodou em sandbox | máquina real | ts-server-engineer |
| TD-030 | baixa | Cycle 10 | Push hardware smoke | conectar Push 2/3 | qa-integration |
| TD-046 | trivial | Cycle 21 smoke | `system.hello` retorna `version: "0.0.1"` hardcoded | ler de pkg ou env var em `handlers/system.py` | python-bridge-engineer |
| TD-047 | trivial | Cycle 21 smoke | `system.hello` retorna `live_version: "0.0.0"` | usar `Application.get_major_version()` etc | python-bridge-engineer |

## Fechado

| ID | Cycle | Item |
|---|---|---|
| TD-001..TD-003 | 2 | env/track.list/naming |
| TD-006, TD-007 | 3 | master/upsert |
| TD-008..TD-011 | 4 | doc/tests/parser |
| TD-012, TD-013 | 5 | Wavetable/verify |
| TD-014, TD-015, TD-017, TD-018 | 6 | broadcast/forward/doc/tests |
| TD-020 | 7 | FakeDeviceParameter |
| TD-016, TD-019, TD-021, TD-022, TD-023 | 8 | verify finish/SDK adapter/doc/tests/curve_type |
| TD-024, TD-025 | 9 | Sampler / mock helper |
| TD-027, TD-028, TD-029 | 10 | contract / recipe-schema / recipe load |
| TD-031, TD-032 | 11 | Roar+Erosion / sidechain-rack |
| TD-026, TD-033, TD-034 | 12 | tests / Doctor bin / neo-soul fallback |
| TD-035, TD-036, TD-037 | 13 | Docker Win / npm prep / live_performance |
| TD-038, TD-039, TD-040 | 14 | workflow tests / version sync / CI secrets |
| TD-041 | 15 | Knowledge units convention |
| TD-042 | 16 | Curve unit re-anotação |
| TD-043 | 17 | 5 MIDI effects |
| TD-044 | 19 | Prompts subsystem tests |
| TD-045 | 20 | DXT manifest resources field |
| **TD-004** | **21** | **🎯 Smoke real Live 12.4.1 PASS** |

**43 TDs fechados em 21 ciclos.** Restante: 2 ambiente (TD-005/030) + 2 trivial pós-smoke (TD-046/047 version stubs).
