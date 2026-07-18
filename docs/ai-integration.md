# Codex Integration

The official Sema agent integration is Codex through the repository-level
`AGENTS.md`. Codex loads that file automatically and runs the local Sema CLI
inside the project to read contracts, check drift, map impact, and close changes
with evidence.

Sema is an independent project and is not affiliated with or endorsed by OpenAI.
Codex surfaces and `AGENTS.md` behavior are documented at
https://learn.chatgpt.com/docs/agent-configuration/agents-md.

## Before AGENTS.md Exists

The official Sema skill is the required first-contact bootstrap for Codex in a
project that does not have Sema yet. Install it explicitly:

```bash
codex plugin marketplace add gerlanss/Sema
codex plugin add sema@sema
```

The skill locates the local CLI, runs `sema iniciar`, generates `AGENTS.md`, and
then delegates all ongoing workspace governance to that file. It contains no
MCP server, remote workspace bridge, login, license, billing, token, credit,
panel, or authorization gate.

Supported capacity labels: fraca, pequena, media, forte, grande.

## Local-Only Rule

For a local workspace, use the local CLI:

```bash
sema --version
sema resumo
```

A successful `sema --version` is enough to use the local CLI directly. Local
commands require no login, activation key, license check, token, credits, billing
service, control panel, or external authorization request.

## Before Editing

```bash
sema docs-impacto --intencao "describe the change" --json
sema inspecionar contratos/example.sema --json
sema drift contratos/example.sema --escopo modulo --json
sema impacto contratos/example.sema --alvo app.example --mudanca "describe the change" --json
```

Read every document listed by `docs-impacto` before changing code, contracts,
operational docs, generated artifacts, workflows, profiles, or release material.

## Codex Context Tiers

Codex with a small context budget should start with `SEMA_BOOT.md`,
`SEMA_SMALL_MODEL.md`, `SEMA_BRIEF.micro.txt`,
`AGENT_CONTEXT_PACK.json`, and `SEMA_INDEX.json`. They should stop early
when a gate is unclear.

Codex with a medium context budget should start with `SEMA_BOOT.md`,
`AGENT_CONTEXT_PACK.json`, `SEMA_BRIEF.curto.txt`,
`SEMA_INDEX.json`, and `AGENTS.md`. They must run docs-impact, drift, and
impact before edits.

Codex with a large context budget may consume `AGENT_CONTEXT_PACK.json`, `SEMA_BRIEF.md`,
`SEMA_INDEX.json`, AST, IR, drift, and impact outputs, but larger context does
not remove the contract-first rule.

## Governed Code

Generated or governed code should keep a short `SEMA-GOVERNED` marker that
points back to the applicable contract. The marker is not a substitute for
validation, drift, impact, or finalization gates.

Governed code above 1000 lines requires a
split plan. Governed code above 2000
lines blocks closure. Markdown documentation is not counted as governed code
size, but it is still governed by documentation and publication checks.

## Contract Size

`.sema` contracts above 300 lines require a
split plan. Above 500 lines, do not keep
editing the same contract before splitting it by real domain or capability.
Never create artificial `parte_1` or `parte_2` files to hide a large contract.

## Payload Size

Inline payloads in `arquivos_codigo.conteudo` or `conteudo` are limited to
262144 characters. That is a transport/input limit,
not an operational timeout. Split by responsibility or use an authorized file
path/attachment strategy instead of increasing timeouts to push the same payload.

## UI And Terminal Work

When the task involves a site, app, dashboard, form, game, CLI, TUI, or any
user-facing experience, closure requires evidence:

- desktop and mobile validation for UI work;
- no horizontal overflow on narrow mobile viewports such as 390px;
- clear loading, empty, success, and error states when relevant;
- structured terminal output, clear errors, help, and smoke checks for CLI/TUI
  work.

## Platform Policy

Sema governs contract, scope, drift, evidence, and quality. It does not bypass
platform policies, terms of use, permissions, security controls, or laws.