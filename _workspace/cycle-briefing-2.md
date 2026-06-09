# Cycle 2 — 2026-06-08

**Fase PLAN.md:** transição Phase 0 → Phase 1.
**Objetivo do ciclo:** fechar 5 débitos técnicos do Cycle 1 + expor as 4 tools restantes do bridge + 1 handler novo (`track.create`) + stub de Distribuição.

## Estratégia

Execução **inline pelo architect** (sem disparar agentes). Motivo:
- Agentes do Cycle 1 falharam com API error de socket.
- Trabalho do Cycle 2 é majoritariamente cirúrgico (fixes pontuais + arquivos pequenos seguindo patterns já estabelecidos).
- Custo de contexto < custo de re-disparar e arriscar nova falha.

Se Cycle 3+ tiver entregas grandes (50+ handlers, knowledge), volta para agentes.

## Atribuições inline

### Trilha A — Server TS
1. Fix TD-001: tcp-client.ts env var parsing.
2. Expor `stop`, `set_tempo`, `track_list`, `create_midi_clip` como tools MCP em `src/tools/`.
3. Expor `track_create` (tool nova).
4. Atualizar `src/tools/index.ts` para incluir todas.
5. Adicionar testes de cada tool nova em `tests/`.

### Trilha A — Bridge Python
1. Fix TD-003: renomear `LIVE_API_FAILED` → `LIVE_API_CALL_FAILED`.
2. Fix TD-002: alterar shape de `track.list` para `{tracks, return_tracks, master_track, total}` (não usar indexes negativos).
3. Adicionar handler `track.create` em `handlers/track.py` + schema em `schemas.py`.
4. Atualizar testes afetados.

### Trilha D — Distribuição (entra agora)
1. Esboço `dxt/manifest.json` para Claude Desktop one-click install (MCPB v0.2 spec).
2. Atualizar `README.md` raiz com seção "Instalação dev".
3. Adicionar script `scripts/install-remote-script.mjs` (symlink dev — não copia).

### Trilha — Docs (architect)
1. `docs/smoke-test.md` — passo a passo para usuário rodar o smoke manual (gate Phase 0).

### QA (inline)
- Parity check após mudanças (track.list shape mudou; track_create é novo).
- Contract drift: phase0-methods.md vai precisar de uma nota de "phase 1 evolves track.list shape" — mas sem mutar o contrato em si.
- Registrar em ADR-0002 a mudança de track.list (breaking change pré-1.0, OK).

## Contratos novos/alterados

### track.list — breaking change
**ADR-0002** vai documentar. Shape novo:
```ts
{
  tracks: TrackInfo[];        // só song.tracks regulares, index = posição em song.tracks
  return_tracks: TrackInfo[]; // só returns, index = posição em song.return_tracks
  master_track: TrackInfo | null;
  total: number;              // sum(tracks) + sum(returns) + (master ? 1 : 0)
}
```

`TrackInfo` mantém os mesmos campos do Cycle 1 (name, color_index, is_midi, is_audio, mute, solo, arm, is_grouped, is_foldable, etc) — mas com `index` agora sendo posição dentro da própria coleção.

Remove `is_return`/`is_master` dos TrackInfo (a posição na coleção já indica).

### track.create — novo método

```ts
// request
{ type: "midi" | "audio"; index?: number; name?: string }

// response
{
  changed: true;
  track: {
    index: number;       // posição em song.tracks após criação
    name: string;
    is_midi: boolean;
    is_audio: boolean;
  };
}
```

Erros: `-32004` se `index` for inválido (>= num_tracks + 1).

## Dependências

- Distribution depende apenas de saber as tools registradas (não bloqueia).
- track.list shape change deve ser feita **simultaneamente** nos dois lados (TS aceita só shape novo, Python só devolve shape novo). Mudança coordenada inline.
- Tools MCP novas (stop, set_tempo, etc) dependem dos handlers do bridge (já existem desde Cycle 1) — só TS muda.

## Critérios de gate

- [ ] Tech debt TD-001, TD-002, TD-003 fechados.
- [ ] TD-004 e TD-005 documentados como aceitos até Cycle 3.
- [ ] 4 tools MCP novas registradas + testadas (mock).
- [ ] track.create handler + tool funcionando (mock).
- [ ] dxt/manifest.json existe e tem campos mínimos.
- [ ] README tem seção "Instalação dev".
- [ ] docs/smoke-test.md existe.
- [ ] ADR-0002 escrito.

## Próximo ciclo (depois deste)

- Smoke real (TD-004) — usuário roda manual seguindo `docs/smoke-test.md`.
- Phase 1 contínua: tools restantes do ahujasid (~15) + verify loop genérico.
- Knowledge curator entra (esboço de schema de Wavetable como prova de conceito).
