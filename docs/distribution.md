# Distribution

Como o `ableton-mind` chega ao usuário final. Cada canal tem audiência diferente.

## 1. Claude Desktop `.mcpb` (recomendado)

One-click install. Geração:

```bash
npm run build           # tsup → dist/
npm run build:dxt       # zipa em build/ableton-mind-<ver>.mcpb
```

Arraste o `.mcpb` sobre o Claude Desktop. Ele configura `claude_desktop_config.json` automaticamente.

User config (host/port/log_level) editável pelo próprio Claude Desktop UI conforme `dxt/manifest.json::user_config`.

## 2. npm (after v1.0)

```bash
npm install -g ableton-mind
ableton-mind                # MCP server (stdio)
ableton-mind-doctor         # diagnóstico
```

Pre-1.0 fica `npm pack`/local install. CI valida `npm publish --dry-run`.

## 3. Docker

```bash
docker build -t ableton-mind .
docker run --rm -i --network host ableton-mind
```

### macOS / Linux

`--network host` funciona nativamente → container acessa `127.0.0.1:9876` do host.

### Windows (TD-035)

Docker Desktop em Windows **não suporta `--network host`** corretamente para todos os cenários. Soluções:

**Opção A — WSL2 backend (recomendado).** Docker Desktop com WSL2:
```bash
# Dentro de WSL2 (Ubuntu, etc):
docker run --rm -i --network host ableton-mind
```
Bridge precisa estar acessível pelo IP da WSL — use `ABLETON_MIND_HOST` apontando para o IP do host:
```bash
docker run --rm -i \
  -e ABLETON_MIND_HOST=$(hostname -I | awk '{print $1}') \
  ableton-mind
```

**Opção B — `host.docker.internal`.** Sem `--network host`:
```bash
docker run --rm -i \
  -e ABLETON_MIND_HOST=host.docker.internal \
  -e ABLETON_MIND_PORT=9876 \
  -p 9876:9876 \
  ableton-mind
```
Ableton Live precisa aceitar conexão externa. O Remote Script padrão escuta em `0.0.0.0` se você setar `ABLETON_MIND_HOST=0.0.0.0` no User Library.

**Opção C — Não use Docker em Windows.** Use o `.mcpb` ou `npm` local. Docker é primariamente para Linux/CI deployment.

## 4. Smithery

[`smithery.yaml`](../smithery.yaml) configurado. Após v0.1.0 publicar via:

```bash
smithery publish
```

Smithery hospeda o container e cria endpoint MCP. Usuário aponta Claude Desktop para o Smithery URL.

## 5. Dev install

Modo desenvolvedor: symlink em vez de cópia.

```bash
node scripts/install-remote-script.mjs           # symlink
node scripts/install-remote-script.mjs --check   # status
```

Edits no repo refletem direto no Live (reabrir Control Surface para recarregar).

## 5b. CI / Release secrets (TD-040)

Os workflows em `.github/workflows/` precisam de secrets configurados em **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Quando é usado | Como gerar |
|---|---|---|
| `NPM_TOKEN` | `release.yml` step `npm publish` (apenas em tags `v1.x.x+`, pre-1.0 skipa) | npmjs.com → Access Tokens → "Automation" token. Granular access OK se incluir publish em `ableton-mind`. |
| `GITHUB_TOKEN` | `release.yml` push para ghcr.io + criar Release | Automático — já vem injetado pelo GitHub Actions. |

Permissions necessárias do `GITHUB_TOKEN` (já declaradas no workflow):
- `contents: write` — criar Release + upload `.mcpb`.
- `packages: write` — push para `ghcr.io/<owner>/ableton-mind`.
- `id-token: write` — npm provenance (Sigstore signing).

### Smithery (opcional)

Se quiser auto-sync com Smithery:
- `SMITHERY_API_KEY` — obtido em https://smithery.ai/settings.
- Adicionar step no release.yml: `smithery publish`.

Cycle 13 NÃO incluiu o step Smithery — fica para v0.1.0.

### Testar release localmente

```bash
# Dry-run sem publicar
npm publish --dry-run

# Build artefato sem publicar
git tag v0.0.0-test
git push origin v0.0.0-test  # CI roda mas npm/docker pushes podem falhar sem secrets
git tag -d v0.0.0-test
git push origin :v0.0.0-test  # remove
```

## 6. Doctor CLI

```bash
npx ableton-mind-doctor
```

5 checks: Node ≥ 20, Remote Script symlink, porta 9876, knowledge válida, recipes válidas.

## 7. Diagnóstico de problemas

| Sintoma | Provável causa | Fix |
|---|---|---|
| `connection refused` na porta 9876 | Remote Script não carregou | Veja Live → Help → Show Log File por exceptions Python |
| `protocol_version mismatch` | Server e bridge de versões diferentes | Atualize ambos para mesma minor |
| Push tools devolvem `detected: false` | Push não está em Control Surface ativo | Ative em Live → Preferences |
| `clip.add_notes` adiciona X mas verify falha | LiveAPI não populou clip → `add_new_notes` indisponível em Live antigo | Live 11+ exigido |
| Docker Windows não conecta | Veja seção 3 — Windows | Use `--network host` (WSL2) ou `host.docker.internal` |
