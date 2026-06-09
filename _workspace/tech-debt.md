# Tech Debt — ableton-mind

⚠ = endereçar próximo ciclo. ✅ = fechado.

## Aberto

| ID | Severidade | Origem | Item | Fix | Owner |
|---|---|---|---|---|---|
| TD-004 | ⚠ medium | Cycle 1 | Smoke real contra Live UI (manual) | `docs/smoke-test.md` | usuário + qa |
| TD-005 | baixa | Cycle 1 | npm install sandbox | máquina real | ts-server-engineer |
| TD-030 | baixa | Cycle 10 | Push hardware smoke | Push 2/3 físico | qa-integration |

**3 abertos — todos dependentes de hardware ou Live UI.**

## Fechado (mais recentes)

| ID | Cycle | Item |
|---|---|---|
| TD-038, TD-039, TD-040 | 14 | workflow tests / version sync / CI secrets |
| TD-041 | 15 | Knowledge units convention |
| TD-042 | 16 | Curve unit re-anotação |
| TD-043 | 17 | 5 MIDI effects |
| TD-044 | 19 | Prompts subsystem tests |
| **TD-045** | 20 | DXT manifest resources field |

**42 TDs fechados em 20 ciclos.** Cycle 20 também entregou:
- `live/AbletonMind/__main__.py` — bridge CLI headless.
- `tests/wire-smoke.test.ts` — real TCP+NDJSON+JSON-RPC smoke (opt-in).
- Doctor CLI 7º check (MCP primitives count).
