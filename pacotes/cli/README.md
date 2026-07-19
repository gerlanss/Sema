# @semacode/cli

`@semacode/cli` is the public Codex-native local CLI for Sema semantic
governance.

It validates `.sema` contracts, checks semantic drift, maps impact, enforces
documentation gates, generates starter code, and prepares contract-first
context for Codex inside a local project folder.

Sema is an independent product and is not affiliated with or endorsed by
OpenAI. Codex-native describes Sema's official product direction, not an
official OpenAI program, integration, or submission.

Official support: [suporte@otimitare.online](mailto:suporte@otimitare.online)

## Install

```bash
npm install -g @semacode/cli
codex plugin marketplace add gerlanss/Sema
codex plugin add sema@sema
```

Open a new Codex task in the target repository after installing the plugin.
Existing tasks do not reload their plugin/skill catalog. Invoke `$sema` in the
new task; after it creates and reads `AGENTS.md`, later tasks load that workspace
protocol automatically.

## First Run

```bash
sema --version
sema resumo . --curto
```

Public Sema is local-only. The CLI runs directly without a Sema login, user
authorization, product-license check, activation key, token, credits, billing
service, control panel, or external service credentials. The license governs
use and redistribution; it is not a runtime activation gate.

## Codex Setup

`AGENTS.md` is the official Sema entrypoint for Codex:

```bash
sema sync-codex --json
```

Codex automatically loads `AGENTS.md` as durable repository guidance. See the
[Codex `AGENTS.md` documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

The CLI is the engine and source of truth; `AGENTS.md` is the automatic
workspace protocol. The Sema skill is required for Codex to bootstrap a project
that does not have Sema yet. After initialization, the skill delegates to the
generated `AGENTS.md`. Installing this npm package never writes into
`CODEX_HOME`; skill installation remains an explicit Codex command.

## Codex-Native Architecture

- `AGENTS.md` is the only official entrypoint. `sync-codex` changes only valid
  Sema-managed blocks and preserves malformed or manual content for review.
- Agent Context Pack consumers use schema version 6 and the fields
  `entrypointCodex`, `codexNativo`, and `cliLocalSemAutorizacao`.
- The Sema Codex skill is required for first contact. It initializes the
  workspace and generates `AGENTS.md`; it does not duplicate the governed
  workflow after that handoff.

## Local Workflow

```bash
sema docs-impacto --intencao "describe the change" --arquivo contratos/app.sema --json
sema inspecionar contratos/app.sema --json
sema drift contratos/app.sema --escopo modulo --json
sema impacto contratos/app.sema --alvo app.modulo --mudanca "describe the change" --json
sema finalizar-mudanca --intencao "describe the change" --doc-lida README.md --json
```

If the project has no `.sema` contract, create one before implementing behavior:

```bash
sema iniciar --template base
```

Initialization preserves existing files and rejects symlink or junction
escapes. Use `--force` only when overwriting the template destinations is an
explicit human decision; the Codex bootstrap skill never adds it.

## Code Generation

```bash
sema compilar contratos/app.sema --alvo typescript --saida .tmp/app-ts --estrutura modulos
sema compilar contratos/app.sema --alvo python --saida .tmp/app-py --estrutura modulos
sema compilar contratos/app.sema --alvo php --saida .tmp/app-php --estrutura modulos
sema compilar contratos/app.sema --alvo dotnet --saida .tmp/app-dotnet --estrutura modulos
sema compilar contratos/app.sema --alvo cpp --saida .tmp/app-cpp --estrutura modulos
```

Generated artifacts include `SEMA-GOVERNED` headers and must stay aligned with
the source contract.

## Validation

```bash
sema validar contratos/app.sema --json
sema diagnosticos contratos/app.sema --json
sema testar contratos/app.sema --alvo typescript --saida .tmp/app-tests
sema testar contratos/app.sema --alvo dotnet --saida .tmp/app-dotnet-tests
sema testar contratos/app.sema --alvo cpp --saida .tmp/app-cpp-tests
sema verificar contratos/app.sema --saida .tmp/app-check --json
```

## Public Boundary

The npm package is for local CLI usage only. It must not contain private or
sensitive operational material.

## Commercial Use

Sema is public source for local semantic governance, but commercial resale,
white-label redistribution, or commercial replicas require written permission
from OtimiTare.

## Support

Use [suporte@otimitare.online](mailto:suporte@otimitare.online) for support.
