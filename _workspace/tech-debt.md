# Tech Debt — ableton-mind

⚠ = endereçar próximo ciclo. ✅ = fechado.

## Aberto

| ID | Severidade | Origem | Item | Fix | Owner |
|---|---|---|---|---|---|
| TD-004 | ⚠ medium | Cycle 1 | Smoke test real | `docs/smoke-test.md` | usuário + qa |
| TD-005 | baixa | Cycle 1 | npm install sandbox | máquina real | ts-server-engineer |
| TD-030 | baixa | Cycle 10 | Push hardware smoke | Push 2/3 físico | qa-integration |
| TD-041 | baixa | Cycle 14 | Knowledge: alguns Drive/Amount params são 0..1 linear no UI mas mapeiam para curva no engine | docs no schema | knowledge-curator |

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
| TD-035, TD-036, TD-037 | 13 | Docker Windows / npm publish prep / live_performance |
| **TD-038, TD-039, TD-040** | 14 | workflow tests / version sync / CI secrets docs |
