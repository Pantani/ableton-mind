# Smoke Test — ableton-mind end-to-end

Roteiro manual para validar que server TS + bridge Python + Live conversam. **Este é o gate de fechamento da Phase 0.** Não há como rodar automaticamente em sandbox (precisa GUI do Live aberta).

## Pré-requisitos

- macOS (primário; Windows segue mesmo passo a passo trocando os paths).
- Ableton Live 12.x instalado e ativado.
- Node 20+ no PATH (`node --version`).
- Repositório clonado em `~/Desktop/projects/art/ableton-mind` (ou ajuste caminhos).
- `npm install` rodado com sucesso na raiz.

## 1. Instalar a bridge Python

```bash
cd ~/Desktop/projects/art/ableton-mind
node scripts/install-remote-script.mjs --check   # mostra estado atual
node scripts/install-remote-script.mjs           # cria symlink
```

Esperado:
```
source: .../ableton-mind/live/AbletonMind
target: ~/Music/Ableton/User Library/Remote Scripts/AbletonMind
status atual: AUSENTE
✓ symlink criado.
```

## 2. Ativar no Live

1. Abra (ou reinicie) o Ableton Live 12.
2. **Live → Preferences → Link, Tempo & MIDI**.
3. Na seção **Control Surface**, escolha **AbletonMind** num slot vazio.
4. Live carrega o Remote Script. Em caso de erro, abra **Help → Show Log File** e procure por "AbletonMind" — o bridge loga `bridge_started host=127.0.0.1 port=9876`.

Verificação rápida: a porta 9876 deve estar em LISTEN:

```bash
lsof -nP -iTCP:9876 -sTCP:LISTEN
```

Esperado: linha mostrando `Live` ou `Python` segurando a porta.

## 3. Build do server TS

```bash
cd ~/Desktop/projects/art/ableton-mind
npm run build
```

Esperado: `dist/index.js` criado, sem erros de TS.

## 4. Conectar manualmente (sem MCP client) — handshake check

Antes de plugar no Claude Desktop, valide handshake direto via `netcat`:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"system.hello","params":{"client":"manual","version":"0.0.0"}}\n' | nc 127.0.0.1 9876
```

Esperado (na mesma linha):
```json
{"jsonrpc":"2.0","id":1,"result":{"bridge":"ableton-mind/python","version":"0.0.1","live_version":"12.0.10","python_version":"3.11.6","protocol_version":"0.1"}}
```

Se travar ou der `connection refused`: o Remote Script não foi carregado, ou o slot Control Surface não foi confirmado.

## 5. Ping + play + stop direto via netcat

```bash
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"system.ping"}' \
  '{"jsonrpc":"2.0","id":2,"method":"transport.play","params":{"from_beginning":false}}' \
  '{"jsonrpc":"2.0","id":3,"method":"transport.stop"}' \
  | nc 127.0.0.1 9876
```

Esperado: 3 responses; durante o id=2 o Live deve começar a tocar; após o id=3, parar.

## 6. Smoke via servidor MCP

Conecte o Claude Desktop (ou Cursor) ao server:

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ableton-mind": {
      "command": "node",
      "args": ["/Users/SEU_USER/Desktop/projects/art/ableton-mind/dist/index.js"],
      "env": {
        "ABLETON_MIND_LOG_LEVEL": "debug"
      }
    }
  }
}
```

Reinicie o Claude Desktop e peça:

> "Use a tool play do servidor ableton-mind para começar a tocar."

Esperado: tool call disparada, Live começa a tocar, resposta volta com `{ ok: true, verified: true, changed: true, is_playing: true, current_song_time: 0 }`.

Outras tools para testar nesta ordem:
1. `track_list` — deve listar tracks do set aberto.
2. `set_tempo` com bpm=140 — Live atualiza.
3. `track_create` com `type=midi` — track nova aparece.
4. `create_midi_clip` com `track_index=0, clip_slot_index=0, length_beats=4` — clip vazio de 1 bar criado.

## 7. Critérios de PASS

| Critério | Como verificar |
|---|---|
| Handshake responde com `protocol_version: "0.1"` | passo 4 |
| Play/stop refletem no transport do Live | passo 5 |
| Tool MCP `play` funciona end-to-end via Claude Desktop | passo 6 |
| Undo do Live (Cmd+Z) desfaz `track_create` em UMA undo step | manual após passo 6 |
| Idempotência: chamar `play` 2x retorna `changed: true` então `changed: false` | manual |

Se todos passarem → Phase 0 está FECHADA. Registre no `_workspace/PROGRESS.md` com data e atualize `qa/cycle-2-report.md`.

## 8. Falhas comuns

- `connection refused` na porta 9876 → Remote Script não carregou. Cheque o Log File do Live por exceções Python.
- `protocol_version mismatch` → bridge nova, server velho (ou vice-versa). Confira `git log` em `live/AbletonMind/handlers/system.py` e `src/live-client/handshake.ts`.
- Live trava ao chamar uma tool → algum handler tocou LiveAPI fora do main thread. Cheque que `BridgeServer.__init__` recebeu `ctrl` (não `headless=True`).

## 9. Reverter

```bash
rm ~/Music/Ableton/User\ Library/Remote\ Scripts/AbletonMind  # remove o symlink
```

Reinicie o Live, desmarque AbletonMind no Control Surface.
