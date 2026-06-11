# Começando

`ableton-mind` e um servidor MCP que permite que um assistente de IA crie, inspecione e verifique sets no Ableton Live. Esta pagina leva voce de um checkout local ate a primeira chamada verificada.

## Pré-requisitos

- **Node.js 20+**
- **Ableton Live 12**. O smoke real usou Live 12.4.1 no macOS.
- Um cliente MCP como Claude Desktop, Claude Code, Codex ou Cursor.

## 1. Build via source

Para desenvolvimento, use o caminho via source:

```bash
npm ci
npm run build
```

## 2. Instalar o Remote Script (bridge Python)

O Remote Script roda **dentro do Live** e expõe o LOM via TCP em `127.0.0.1:9876`.

```bash
npm run install:remote-script
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

## 4. Apontar o cliente MCP para o build local

Exemplo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ableton-mind": {
      "command": "node",
      "args": ["/absolute/path/to/ableton-mind/dist/index.js"]
    }
  }
}
```

Troque o path pelo caminho absoluto deste repo depois de `npm run build`.

## 5. Primeira leitura

No Claude/Cursor, peça:

> "Verifique se o ableton-mind consegue acessar o Live. Leia as informacoes da sessao e liste as tracks. Nao altere nada."

Depois tente:

> "Toque o set, verifique o estado de playback e depois pare."

O assistente deve retornar estado verificado e um diff pequeno. A partir dai, siga para [Seu primeiro set no Live](./first-live-set) ou o [prompt cookbook](./prompt-cookbook).

## Próximos passos

- [Arquitetura](../architecture) — entenda as 3 camadas.
- [Tools](../tools/) — os 21 domínios LOM.
- [Knowledge base](../knowledge/) — schemas de devices.
- [Prompt cookbook](./prompt-cookbook) — exemplos prontos de prompts.
- [Recipes](../recipes/) — drums/bass/racks por genero.
- [Smoke test](../smoke-test) — checklist end-to-end.
