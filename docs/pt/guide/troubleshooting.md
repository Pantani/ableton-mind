# Troubleshooting

Comece pelo menor check que prova onde esta o problema: cliente MCP, servidor Node, bridge TCP ou Remote Script no Live.

## Live nao esta acessivel

Peca ao assistente:

> "Verifique conectividade do ableton-mind sem alterar o set. Tente `session_get_info`, depois explique se a falha esta no servidor MCP, na bridge TCP ou no Remote Script do Live."

Checks manuais:

```bash
npm run build
node dist/cli/doctor.js
```

Depois confirme que o Live tem `AbletonMind` selecionado em Preferences -> Link, Tempo & MIDI -> Control Surface.

## Remote Script nao esta instalado

A partir do repo:

```bash
npm run install:remote-script
```

Ou copie `live/AbletonMind/` para:

- macOS: `~/Music/Ableton/User Library/Remote Scripts/AbletonMind/`
- Windows: `~/Documents/Ableton/User Library/Remote Scripts/AbletonMind/`

Reinicie o Live depois de copiar.

## npm ou .mcpb nao funciona

Os canais publicos npm e release bundle ainda nao foram publicados. Use build via source ate o gate manual final de publicacao rodar:

```bash
npm ci
npm run build
node dist/index.js
```

## Um prompt mudou coisa demais

Use prompts de reparo em vez de continuar no escuro:

> "Tire snapshot do set atual, compare com o snapshot anterior se existir e resuma apenas as mudancas reais. Nao delete nada."

Para limpeza destrutiva, peca ao assistente para relatar o plano antes de mutar o Live.

## Erros de parametro de device

Peca ao assistente para ler o schema do device primeiro:

> "Chame `device_get_parameters` para este device, depois altere apenas parametros que existem por nome exato."

A knowledge base existe para o assistente nao chutar nomes de parametros.
