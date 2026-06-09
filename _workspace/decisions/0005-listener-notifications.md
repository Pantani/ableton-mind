# ADR 0005 — Formato de listener notifications

**Data:** 2026-06-09
**Status:** Aceito
**Autor:** architect

## Contexto

PLAN.md §4.21 promete listeners reativos: mudanças de estado no Live viram MCP notifications para o cliente LLM. AbletonOSC entrega via OSC raw; nós entregamos via JSON-RPC notification (já especificado no contrato em `_workspace/contracts/jsonrpc.md`).

Falta definir:
1. Nomes de método para os eventos.
2. Shape do `params`.
3. Quais eventos ligar primeiro.
4. Como o servidor MCP repassa para o LLM.

## Decisão

### 1. Naming

`event.<domain>_<property>_changed`. Ex:
- `event.transport_tempo_changed`
- `event.transport_is_playing_changed`
- `event.transport_current_song_time_changed` (alta frequência — opt-in via subscribe)
- `event.track_<i>_name_changed`
- `event.track_<i>_volume_changed`
- `event.clip_<t>_<s>_name_changed`

Por que NÃO `event.<domain>.<verb>`: o ponto já é separador do método JSON-RPC do request side; misturar gera confusão de parsing. Underscore é mais legível.

Beat events ficam fora do padrão (`event.beat`) porque já estavam no contrato JSON-RPC §framing.

### 2. Shape

```ts
{
  jsonrpc: "2.0",
  method: "event.<name>",
  params: {
    // SEMPRE inclui o valor novo:
    value: T,
    // OPCIONAL, presente em mutações via API (não em playback):
    previous?: T,
    // SEMPRE inclui timestamp (ms epoch — server bridge wall clock):
    ts: number,
    // Para listeners object-scoped: referência ao objeto.
    track_index?: number,
    clip_slot_index?: number,
    return_track_index?: number,
  }
}
```

### 3. Bootstrap (Cycle 5)

Liga apenas:
- `event.transport_tempo_changed`
- `event.transport_is_playing_changed`

Phase 2 expande para track/clip listeners. Phase 3 add probability/beat listeners.

### 4. Repasse server → MCP client

`src/server/index.ts` ouve `client.on("notification", ...)` e:

- Se método começa com `event.`, encaminha via `server.notification({method, params})` (MCP SDK 1.x).
- Caso contrário, loga warn e ignora (proteção contra drift).

MCP client recebe como `notifications/<method>` (formato MCP padrão).

### 5. Subscribe / unsubscribe

Phase 2 NÃO obriga subscribe — todos os eventos vão para o cliente. Phase 3 introduz `subscribe(events: string[])` para reduzir tráfego em eventos high-frequency (current_song_time, beat).

## Consequências

- Bridge precisa de `BridgeServer.broadcast(method, params)` que serializa NDJSON em todos os sockets conectados (Phase 0 não precisava porque tudo era request/response síncrono).
- Threading: callbacks LiveAPI executam no main thread (Live API constraint). `broadcast()` enfileira na thread de IO do socket, idêntico ao que dispatcher de request já faz reverso.
- Idempotência não se aplica a events (mas garantimos at-most-once para mutação via undo unitário).

## Como aplicar

- `live/AbletonMind/listeners.py` (novo): registra `song.add_tempo_listener(callback)` e `song.add_is_playing_listener(callback)`. Callbacks chamam `bridge.broadcast`.
- `live/AbletonMind/bridge.py`: método `broadcast(method, params)` que itera `self._clients` e escreve NDJSON.
- `src/server/index.ts`: handler de notification que detecta prefix `event.` e repassa para MCP server via `server.sendNotification` (ou equivalente).

Se a API do MCP SDK não expuser sendNotification facilmente em 1.x, encapsular em `src/server/notifications.ts` e mockar até a versão 2.x.
