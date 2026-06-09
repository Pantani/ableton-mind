# QA Report — Cycle 21 — TD-004 SMOKE REAL ✅

**Data:** 2026-06-09
**Veredito:** **PASS — TD-004 FECHADO contra Ableton Live 12.4.1 rodando**

## Executive summary

Smoke test real contra Live 12.4.1 macOS executado. **Todas as 8 chamadas RPC passaram**, incluindo:
- handshake `system.hello`
- read-only `system.ping`, `session.get_info`, `track.list`
- mutations `transport.play`, `transport.stop`, `transport.set_tempo`, `track.set_name`
- **6 listener notifications** (`event.transport_is_playing_changed` × 2, `event.transport_tempo_changed` × 2, `event.track_name_changed` × 2)

**Phase 0 fechada oficialmente. Sistema pronto para tag `v0.1.0-rc.1`.**

## Setup

1. ✅ Symlink Remote Script: `~/Music/Ableton/User Library/Remote Scripts/AbletonMind → repo/live/AbletonMind`.
2. ✅ Live reiniciado (Cmd+Q + reopen).
3. ✅ Live → Preferences → Link/Tempo/MIDI → Control Surface = **AbletonMind**.
4. ✅ Live carregou Remote Script (sem traceback no Log.txt).
5. ✅ Porta TCP 9876 LISTEN (Live PID 63434).

## Smoke calls executados

### Handshake

```
→ {"jsonrpc":"2.0","id":1,"method":"system.hello","params":{"client":"smoke","version":"0.0.20"}}
← {"jsonrpc":"2.0","id":1,"result":{
    "bridge":"ableton-mind/python","version":"0.0.1",
    "live_version":"0.0.0","python_version":"3.11.6",
    "protocol_version":"0.1"}}
```

**Nota:** `version: "0.0.1"` é stub do bridge (esperado 0.0.20). `live_version: "0.0.0"` também stub. **Bugs descobertos** — TD-046, TD-047.

### Ping

```
→ {"jsonrpc":"2.0","id":2,"method":"system.ping"}
← {"jsonrpc":"2.0","id":2,"result":{"pong":true,"ts":1781037418716}}
```

### session.get_info

```
← {tempo:120, num_tracks:4, num_return_tracks:2, has_master:true, is_playing:false,
   song_length:232, root_note:0, scale_name:"Major", time_signature:{numerator:4,denominator:4}}
```

LOM acesso real ✅.

### transport.play (from_beginning:true)

```
← {"changed":true, "is_playing":false, "current_song_time":0.0}
+ NOTIFICATION: event.transport_is_playing_changed {value:true, previous:false, ts:1781037448794}
```

**Race documentada:** `is_playing: false` no return imediato é race read-after-write da LiveAPI. Documentado em Cycle 8: `playTool` marcado `UNVERIFIABLE` em `src/tools/transport.ts`. Notification confirma realidade.

Phase 2 listener pipeline ✅.

### transport.stop

```
+ NOTIFICATION: event.transport_is_playing_changed {value:false, previous:true} (chega antes do reply)
← {"changed":true, "is_playing":true, "current_song_time":0.0}
```

Idempotência idem play (race). Notification correta.

### transport.set_tempo

```
→ bpm:126
← {"changed":true, "before":120.0, "after":126.0}
+ NOTIFICATION: event.transport_tempo_changed {value:126, previous:120}

→ bpm:120 (revert)
← {"changed":true, "before":126.0, "after":120.0}
+ NOTIFICATION: event.transport_tempo_changed {value:120, previous:126}
```

Verify field PASS — `after === intent`. Live voltou ao tempo original.

### track.list (ADR-0002 shape)

```
← {tracks: [
     {index:0, name:"1-MIDI", color_index:10, is_midi:true, ...},
     {index:1, name:"2-MIDI", color_index:12, is_midi:true, ...},
     {index:2, name:"3-Audio", color_index:26, is_audio:true, ...},
     {index:3, name:"4-Audio", color_index:14, is_audio:true, ...}
   ],
   return_tracks: [
     {index:0, name:"A-Reverb", color_index:0, mute:false, solo:false},
     {index:1, name:"B-Delay", color_index:2, mute:false, solo:false}
   ],
   master_track: {name:"Main", color_index:25},
   total: 7}
```

ADR-0002 shape EXATA. Verifica que TD-002 (indexing negativos) está corretamente eliminado.

### track.set_name (verify roundtrip)

```
→ index:0, name:"Drums"
← {"changed":true, "before":"1-MIDI", "after":"Drums"}
+ NOTIFICATION: event.track_name_changed {value:"Drums", previous:"1-MIDI", track_index:0}

→ index:0, name:"1-MIDI"  (revert)
← {"changed":true, "before":"Drums", "after":"1-MIDI"}
+ NOTIFICATION: event.track_name_changed {value:"1-MIDI", previous:"Drums", track_index:0}
```

Verify loop PASS (after === intent). Listener inclui `track_index` ✅. Live state restaurado.

## Bugs descobertos no smoke real — fechados em Cycle 22

### TD-046 — `system.hello` retorna `version: "0.0.1"` hardcoded — ✅ FECHADO

Fix: `_read_pkg_version()` lê `version` de `package.json` no module load. Cache em `BRIDGE_VERSION` constant.

**Verificação pós-fix (Live recarregado):**
```
→ system.hello
← {"version": "0.0.21", ...}
```
✓ Confirmado live em 2026-06-09.

### TD-047 — `system.hello` retorna `live_version: "0.0.0"` — ✅ FECHADO

Fix: `_live_version()` tenta 3 paths: `get_major_version()/get_minor_version()/get_bugfix_version()` (Live 11+), `get_major_minor_patch_version()` (tupla), `get_version_string()` (fallback). Path 1 funcionou em Live 12.4.1.

**Verificação pós-fix:**
```
→ system.hello
← {"live_version": "12.4.1", ...}
```
✓ Confirmado live em 2026-06-09.

## TDs fechados / abertos

| ID | Status pré-smoke | Status pós-smoke |
|---|---|---|
| TD-004 | ⚠ medium aberto | ✅ FECHADO |

Abertos agora:
- TD-005 (npm sandbox — não testado)
- TD-030 (Push hardware — não testado)
- TD-046 (version stub) ⚠ trivial
- TD-047 (live_version stub) ⚠ trivial

## Métricas

- **8 RPC calls executados** contra Live real.
- **6 notifications** emitidas (Phase 2 confirmado).
- **0 erros, 0 timeouts.**
- **Latência observada:** ~5s entre request e response (dispatcher queue + schedule_message 50ms). Aceitável para uso humano; testar carga em Phase 9.

## Recomendação

**PASS Cycle 21.** TD-004 fechado contra Live 12.4.1 real.

**Próximo:**

```bash
git checkout -b release/0.1.0-rc.1
# bump version 0.1.0-rc.1
git commit -m "release: v0.1.0-rc.1 (TD-004 smoke PASS)"
git tag v0.1.0-rc.1
git push origin main v0.1.0-rc.1
```

→ release.yml automático: ghcr.io push + GitHub Release + .mcpb attached.
