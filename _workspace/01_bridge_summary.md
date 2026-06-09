# Cycle 1 — Trilha Bridge (python-bridge-engineer)

**Status:** ENTREGUE (agente original sofreu API error de socket após escrever arquivos; este sumário foi reconstituído pelo architect via inspeção).

## Arquivos criados (21 .py + 1 .md)

```
live/
├── __init__.py
└── AbletonMind/
    ├── __init__.py                # ControlSurface entry
    ├── README.md                  # install paths macOS/Windows
    ├── bridge.py                  # TCP NDJSON server + dispatcher JSON-RPC
    ├── errors.py                  # RpcError + códigos -32000..-32008
    ├── log.py                     # StructuredLogger
    ├── schemas.py                 # dataclasses I/O (7 inputs)
    ├── transactions.py            # `with undo_step(name, song):`
    └── handlers/
        ├── __init__.py            # popula REGISTRY via import
        ├── _base.py               # Handler base + @register decorator
        ├── system.py              # system.hello, system.ping
        ├── transport.py           # play, stop, set_tempo
        ├── track.py               # list (read-only)
        └── clip.py                # create_midi (transacional)
    └── tests/
        ├── __init__.py
        ├── _fakes/                # LiveAPI mock fixtures
        │   ├── __init__.py
        │   └── live_api.py
        ├── test_bridge.py
        ├── test_handlers_system.py
        ├── test_handlers_transport.py
        ├── test_handlers_track.py
        └── test_handlers_clip.py
```

## Decisões intermediárias

### Threading
- TCP server roda em **thread daemon**. Cada cliente também em thread daemon.
- Despacho via `queue.Queue` para o main thread do Live.
- `ctrl.schedule_message(50, _drain_queue)` acorda main thread a cada ~50ms para drenar fila.
- Thread do socket bloqueia em `result_q.get(timeout=10s)` esperando resposta.
- **Modo `headless=True`**: se nenhum ControlSurface for fornecido (testes, smoke fora do Live), despacha sincronamente na thread do socket. Permite testes determinísticos sem Live aberto.

### Framing NDJSON
- Buffer parcial por cliente (`buffer += chunk; split(b"\n", 1)` loop).
- `socket.timeout(0.5)` no accept para permitir shutdown limpo.
- `SO_REUSEADDR` setado para evitar `[Errno 48]` ao reiniciar.

### Mapeamento de exceções (no dispatcher)
- `json.JSONDecodeError` → `-32700` parse error
- `TypeError` ao construir dataclass de input → `-32602` invalid params
- `KeyError` no REGISTRY → `-32601` method not found
- `RpcError` (handler levantou) → usa `exc.code/message/data`
- Qualquer outra `Exception` → `-32001` LIVE_API_FAILED com `exception` (classname) + `reason` (str)

### Idempotência
Todos os handlers de mutação seguem read-before-write:
- `transport.play` lê `is_playing`, só chama `start_playing()` se necessário.
- `transport.stop` mesma coisa.
- `transport.set_tempo` compara com tolerância 1e-3 antes de set (evita undo step inútil).
- `clip.create_midi` verifica slot vazio antes; se ocupado, levanta `-32005` com `existing_clip_name`.

### Transações
`with undo_step(name, song):` envolve `begin_undo_step()`/`end_undo_step()` em try/finally. Único uso real na Phase 0 é `clip.create_midi`; padrão fica pronto para todos os mutators da Phase 1+.

## Riscos abertos / TODOs

- **Indexing de master/return** em `track.list` é provisório (-1 master, -2..-N returns). Phase 1 vai expor `song.tracks`, `song.return_tracks`, `song.master_track` como coleções separadas (alinhamento com PLAN.md §4.2).
- `_python_version()` em `system.py` reporta a versão do interpretador que está rodando; em Live 12 deve ser 3.11.x. Sem cobertura para Live 11 / Py 3.7 — Phase 1 deve testar compat.
- Mensagem de erro `-32001` retorna `exception` (classname) + `reason` (str) — não inclui stack trace por privacidade. Phase 1 pode adicionar flag debug.
- Smoke test contra Live real ainda não rodou — fica para Ciclo 2 ou 3.

## Como rodar testes offline

```bash
cd /Users/pantani/Desktop/projects/art/ableton-mind
python -m unittest discover -s live/AbletonMind/tests -v
```

Todos os testes usam o fake `live/AbletonMind/tests/_fakes/live_api.py` no lugar do `Live.Application` real, então rodam sem Ableton aberto.

## Notas para o architect

- Contratos NÃO foram mutados (`_workspace/contracts/{jsonrpc,phase0-methods}.md` preservados).
- Implementação 100% dentro do escopo do briefing — nenhum desvio.
- Agente original (`python-bridge-engineer`) crashou com API error ao escrever este sumário; arquivos de código estavam todos no disco. Este sumário é reconstituição via inspeção pelo architect.
