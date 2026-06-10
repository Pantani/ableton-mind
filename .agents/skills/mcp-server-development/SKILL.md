---
name: mcp-server-development
description: Implementation patterns for the ableton-mind TypeScript MCP server: Zod tools, resources, prompts, bridge client, verify loop, transactions and idempotency.
---

# MCP Server Development — TS/Node Patterns

Use this skill when implementing or reviewing src/server, src/tools, src/resources, src/prompts, src/live-client or src/feedback.

## Stack

TypeScript 5, Node 20, ESM, @modelcontextprotocol/sdk, zod, tsup, biome, vitest and native net.

## Tool Rules

- Tool names use snake_case and align with Python handler names.
- Descriptions explain what changes, idempotency and side effects.
- Input and output schemas use Zod. Avoid any and unknown except debug sinks.
- Handlers are async and receive input plus ctx.
- Mutations read before write and verify by reading back.
- Return ok, verified and diff where relevant.
- Errors are structured and never call process.exit.

## Bridge Client

Keep a persistent JSON-RPC TCP client with request IDs, timeout, reconnect backoff and notification events. Tools talk through the context abstraction, not by importing low-level clients directly.

## Resources and Prompts

Resources expose live state or embedded knowledge without mutating Live. Prompts are short client-visible templates and should not replace documentation.

## Tests

Each tool needs at least one happy path and one validation/error path. Integration tests use a mock bridge by default and a real bridge only when explicitly enabled.
