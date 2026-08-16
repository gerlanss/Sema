# Codex Integration

The official Sema agent integration is Codex through the repository-level
`AGENTS.md`. Codex loads that file automatically and runs the local Sema CLI
inside the project to read contracts, check drift, map impact, and close changes
with evidence.

Sema is an independent project and is not affiliated with or endorsed by OpenAI.
Codex surfaces and `AGENTS.md` behavior are documented at
https://learn.chatgpt.com/docs/agent-configuration/agents-md.

## Before AGENTS.md Exists

The official Sema skill is the first-contact bootstrap for a project that does
not have Sema yet. A global CLI install bundles and synchronizes it:

```bash
npm install -g @semacode/cli
sema skill status --json
```

The package creates an absolute launcher under `~/.sema/bin`, synchronizes the
canonical skill under `~/.agents/skills/sema`, and mirrors Claude only when
detected. Informational requests stay read-only; before implementation the skill asks
for explicit project-adoption authorization, then generates `AGENTS.md` and delegates
ongoing governance. Installing or updating the global CLI authorizes distribution only.
Already-open tasks may need a reload. The distribution contains no
MCP server, remote workspace bridge, login, license, billing, token, credit,
panel, or runtime authorization gate.

Supported capacity labels: fraca, pequena, media, forte, grande.

## Local-Only Rule

For a local workspace, use the local CLI:

```bash
sema --version
sema resumo --drift none
```

If the shell cannot resolve `sema`, use `~/.sema/bin/sema` on macOS/Linux. On Windows, PowerShell uses `sema.ps1` from PATH and cmd.exe uses `sema.cmd`; use `& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version` as the absolute fallback
before declaring the CLI unavailable. A successful version check is enough. Local
commands require no login, activation key, license check, token, credits, billing
service, control panel, or external authorization request.

## Before Editing

```bash
sema docs-impacto --intencao "describe the change" --json
sema inspecionar contratos/example.sema --drift none --json
sema drift contratos/example.sema --escopo modulo --cache fresh --json
sema impacto contratos/example.sema --alvo app.example --mudanca "describe the change" --json
```

Read every document listed by `docs-impacto` before changing code, contracts,
operational docs, generated artifacts, workflows, profiles, or release material.
A cache hit is acceleration, not evidence: closing requires `--cache fresh`,
while contract-only queries keep unobserved implementation fields null inside the command payload.

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

Generated Lua tests preserve the contract's failure shape. A case whose only
expectation is `sucesso: falso` may terminate without an output, while a case
that also declares observable output fields must return a structured failure
result. The generator keeps these paths distinct instead of forcing every
failure into one representation.

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
