# Ableton Mind Claude Code plugin

This plugin installs the Ableton Mind MCP server into Claude Code through the
Ableton Mind marketplace.

It starts the published npm package with:

```bash
npx -y ableton-mind@0.1.1
```

The npm server defaults to `127.0.0.1:9876` and `info` logging. Set
`ABLETON_MIND_HOST`, `ABLETON_MIND_PORT`, or `ABLETON_MIND_LOG_LEVEL` in the
Claude Code environment only when you need to override those defaults.

The Ableton Live Remote Script still needs to be installed and enabled in Live.
See the main repository README and distribution docs for setup details.
