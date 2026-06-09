# AbletonMind — Remote Script (Phase 0)

Servidor TCP NDJSON JSON-RPC 2.0 que roda dentro do Ableton Live como
`Control Surface`. Expoe a Live API para o servidor MCP em TypeScript.

- Porta default: `127.0.0.1:9876` (override via `ABLETON_MIND_HOST` /
  `ABLETON_MIND_PORT`).
- Stdlib only — sem dependências pip.
- Live 12 / Python 3.11 prioritário (Phase 0). Compat Live 11 / Python 3.7
  fica para Phase 1.

## Instalação

Copie a pasta `live/AbletonMind/` para o diretório de Remote Scripts do Live:

### macOS

```
~/Music/Ableton/User Library/Remote Scripts/AbletonMind/
```

Exemplo (a partir da raiz do repo):

```bash
ln -s "$(pwd)/live/AbletonMind" \
  "$HOME/Music/Ableton/User Library/Remote Scripts/AbletonMind"
```

### Windows

```
%USERPROFILE%\Documents\Ableton\User Library\Remote Scripts\AbletonMind\
```

PowerShell:

```powershell
New-Item -ItemType Junction `
  -Path "$env:USERPROFILE\Documents\Ableton\User Library\Remote Scripts\AbletonMind" `
  -Target "$(Resolve-Path .\live\AbletonMind)"
```

## Ativação no Live

1. Live → Settings (ou Preferences) → **Link, Tempo & MIDI**.
2. Em **Control Surface**, escolha `AbletonMind`.
3. Deixe Input / Output como `None`.
4. O Log.txt do Live deve mostrar `AbletonMind started on 127.0.0.1:9876`.

Locais do `Log.txt`:

- macOS: `~/Library/Preferences/Ableton/Live <version>/Log.txt`
- Windows: `%USERPROFILE%\AppData\Roaming\Ableton\Live <version>\Preferences\Log.txt`

## Métodos Phase 0

| Método | Idempotente? | Transacional? |
|---|---|---|
| `system.hello` | n/a | não |
| `system.ping` | n/a | não |
| `transport.play` | sim | não |
| `transport.stop` | sim | não |
| `transport.set_tempo` | sim | não |
| `track.list` | n/a (read-only) | não |
| `clip.create_midi` | sim (rejeita slot ocupado) | sim |

Veja `_workspace/contracts/phase0-methods.md` para schema completo dos params
e returns.

## Testes offline

```bash
cd <repo root>
python -m unittest discover -s live/AbletonMind/tests -t .
```

Os fakes da LiveAPI ficam em `live/AbletonMind/tests/_fakes/live_api.py`.
Nenhum teste depende do Live aberto.

## Smoke contra Live real

Não roda neste ciclo — fica para o Ciclo 2 (smoke do architect + qa-integration).
