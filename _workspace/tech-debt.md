# Tech Debt — ableton-mind

⚠ = endereçar próximo ciclo. ✅ = fechado.

## Aberto

| ID | Severidade | Origem | Item | Fix | Owner |
|---|---|---|---|---|---|
| TD-005 | baixa | Cycle 1 | npm install não rodou em sandbox | máquina real | ts-server-engineer |
| TD-030 | baixa | Cycle 10 | Push hardware smoke | conectar Push 2/3 | qa-integration |

**Só 2 abertos — ambos ambiente real (não-resolvíveis em CI/sandbox).**

## Fechado (mais recentes)

| ID | Cycle | Item |
|---|---|---|
| TD-038, TD-039, TD-040 | 14 | workflow tests / version sync / CI secrets |
| TD-041 | 15 | Knowledge units convention |
| TD-042 | 16 | Curve unit re-anotação |
| TD-043 | 17 | 5 MIDI effects |
| TD-044 | 19 | Prompts subsystem tests |
| TD-045 | 20 | DXT manifest resources field |
| **TD-004** | **21** | **🎯 Smoke real Live 12.4.1 PASS** |
| **TD-046, TD-047** | **22** | **system.hello version stubs (pkg.json + Live API multi-path)** |

**45 TDs fechados em 22 ciclos.** Restante: só TD-005 (npm sandbox) e TD-030 (Push hardware).
