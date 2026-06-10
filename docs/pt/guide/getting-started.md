# Começando

`ableton-mind` é um servidor MCP que expõe o **Live Object Model** completo para LLMs. Esta página leva você do zero ao primeiro `play` no Live.

## Pré-requisitos

- **Node.js 20+**
- **Ableton Live 12** (suporte 11 vem na Phase 1 final). macOS prioritário.
- Um cliente MCP — **Claude Desktop**, **Cursor**, **Continue**, etc.

## 1. Instalar

Veja [Instalação](./installation) para os 4 canais (DXT one-click, npm, Docker, Smithery). Para começar rápido:

```bash
npm install -g ableton-mind
```

## 2. Instalar o Remote Script (bridge Python)

O Remote Script roda **dentro do Live** e expõe o LOM via TCP em `127.0.0.1:9876`.

```bash
ableton-mind install:remote-script
```

Ou manualmente, copie `live/AbletonMind/` para:

- **macOS:** `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- **Windows:** `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

## 3. Ativar no Live

**Live → Preferences → Link/Tempo/MIDI → Control Surface → AbletonMind**.

Confirme no Log da bridge que o TCP server subiu:

```
[AbletonMind] TCP server listening on 127.0.0.1:9876
```

## 4. Apontar seu cliente MCP

Exemplo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ableton-mind": {
      "command": "ableton-mind"
    }
  }
}
```

## 5. Primeiro `play`

No Claude/Cursor, peça:

> "Toca o set."

O LLM chama `play`. A tool retorna `{ ok, verified: { is_playing: true }, diff: { is_playing: false → true } }`.

## Próximos passos

- [Arquitetura](../architecture) — entenda as 3 camadas.
- [Tools](../tools/) — os 21 domínios LOM.
- [Knowledge base](../knowledge/) — schemas de devices.
- [Recipes](../recipes/) — drums/bass/racks por gênero.
- [Smoke test](../smoke-test) — checklist end-to-end.
