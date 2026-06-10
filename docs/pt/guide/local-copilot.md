# Copilot local

`ableton-mind` inclui um copilot com LLM local para tarefas simples no Ableton Live sem API paga. Ele fala com qualquer endpoint compatível com OpenAI Chat e usa Ollama local por padrão.

## Começo rápido

```bash
# uma vez: instale o Ollama e, se quiser, baixe o modelo padrão
ollama pull qwen2.5:3b

# a partir do checkout buildado
npm run build
node dist/index.js chat
```

A UI abre em `http://127.0.0.1:4142`.

## Tiers de segurança

O tier padrão é **safe**, somente leitura. Isso é intencional: sessões do Live podem conter trabalho real, então o modelo local deve inspecionar antes de ter permissão para mudar qualquer coisa.

```bash
ableton-mind chat              # safe: só inspeciona
ableton-mind chat --write      # standard: mudanças simples em transport/tracks/clips/devices
ableton-mind chat --creative   # standard + recipes/browser load
ableton-mind chat --read-only  # trava a UI em modo safe
```

## Prompts headless

Use `ask` para scripts ou checagens rápidas:

```bash
ableton-mind ask "Liste as tracks e diga o que parece faltar"
ableton-mind ask --write "Coloque o tempo em 128 BPM"
ableton-mind ask --json "O que voce consegue inspecionar sem mudar o Live?"
```

`chat --prompt` usa o mesmo motor:

```bash
ableton-mind chat --prompt "O que tem nesse set?"
```

## Configuração

| Var | Default | Uso |
|---|---|---|
| `ABLETON_MIND_LLM_BASE_URL` | `http://127.0.0.1:11434/v1` | Endpoint compatível com OpenAI |
| `ABLETON_MIND_LLM_MODEL` | `qwen2.5:3b` | ID do modelo |
| `ABLETON_MIND_LLM_API_KEY` | unset | Bearer token opcional |
| `ABLETON_MIND_LLM_TIER` | `safe` | `safe`, `standard` ou `creative` |
| `ABLETON_MIND_LLM_MAX_STEPS` | `8` | Máximo de passos modelo/tool |
| `ABLETON_MIND_LLM_TEMPERATURE` | `0.4` | Temperatura de amostragem |
| `ABLETON_MIND_CHAT_PORT` | `4142` | Porta da UI local |

Flags `--model`, `--base-url`, `--port`, `--no-ollama` e `--no-open` sobrescrevem os defaults em uma execução.

## Comportamento da bridge

A UI local consegue abrir mesmo com o Ableton Live fechado. Orientações estáticas ainda funcionam, mas tools que precisam do Live retornam erro de bridge offline até o Remote Script AbletonMind estar ativo.

O servidor do browser escuta apenas em loopback e rejeita Host/Origin que não sejam locais.
