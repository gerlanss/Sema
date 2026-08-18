# Sema

<p align="center">
  <img src="./logo.png" alt="Sema logo" width="240">
</p>

Sema is a local-first semantic governance layer for AI agents, with proven
compatibility in Claude, Codex, zCode (GLM) and Kimi. Those integrations are
the proven baseline, not the product ceiling. Sema turns
human intent into explicit contracts, constraints, impact analysis, verified
execution, and evidence instead of asking an agent to rely on prompt context
alone.

`intent -> context -> contract -> constraints -> impact -> execution -> evidence`

## Watch Sema Work in 2:58

https://github.com/user-attachments/assets/62308e14-7e57-4073-8945-c1801bf81498

You tell Codex what you want. Instead of rediscovering the whole repository on
every task, Codex uses Sema's living semantic map to reach the relevant code.
In this real red-to-green demo, Sema catches a partial payment rename, preserves
the `receipt_id` guarantee, and verifies contract, code, tests, drift, and
documentation before closing the change.

**[Watch on YouTube](https://youtu.be/IXkIlC9FxIs)**

Claude, Codex, zCode (GLM) and Kimi are the proven agent integrations, and
software is the first proving ground. The same governance model already supports workflows,
operations, games, research, legal review, writing, proposals, conversations,
and other systems where an agent must preserve intent across a real change.

The official Sema agent surface is Codex through `AGENTS.md`. Codex loads this
file as durable repository guidance across its CLI, IDE extension, and desktop
app workflows. See the [Codex `AGENTS.md` documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Sema is an independent product and is not affiliated with or endorsed by
OpenAI. "Official" in this repository means the official product direction of
Sema, not an official OpenAI program, integration, or submission.

This public repository is intentionally scoped to the local CLI experience.
It does not publish private or sensitive operational material.

Official support: [suporte@otimitare.com](mailto:suporte@otimitare.com)

## What Sema Does

Sema uses `.sema` contracts to describe modules, tasks, inputs, outputs, rules,
guarantees, effects, links to implementation files, and validation expectations.
The current CLI helps coding agents — Claude, Codex, zCode (GLM) and Kimi —
answer practical questions before touching a project:

- which contract applies to the change;
- which files are probably affected;
- whether code and contract have semantic drift;
- which documentation must be read or updated;
- what impact the proposed change has;
- whether a contract can generate starter code or tests;
- which public routes exist in the live code, across Express, Fastify, Koa,
  NestJS, Next.js (App and Pages Router, including mounted routers and route
  prefixes) and consumer surfaces such as React/Vite, Angular, SvelteKit, Nuxt
  and Flutter;
- whether the declared visual identity is materialized, with contract-driven
  design tokens for CSS, TypeScript/JavaScript themes, SCSS, Tailwind and
  terminal UIs, in light and dark modes;
- whether executed tests actually back the contract score, instead of trusting
  declared blocks alone.

Sema does not replace human approval, platform policy, security review, or legal
judgment. It is a local governance layer for scope, evidence, drift, and quality.

## Discoverable Pipelines and Interactive Systems

Sema now exposes an explainable capability catalog so an agent can distinguish
governance flows, validation profiles, specialized workflows, orchestration
pipelines, generators, capability tokens, and external adapters before choosing
what to use.

The interactive control plane models games, simulations, and hybrid systems
without coupling the contract to one engine or visual style. Spatial model and
render mode are independent: `THREE_D + HEADLESS` is valid, while XR requires
`THREE_D`; 8-bit and 16-bit remain independent visual profiles. Human-controlled, scripted, AI-controlled,
autonomous, and emergent systems share the same world, time, pipeline, adapter,
and evidence model.

```bash
sema descobrir recomendar --intencao "validate an autonomous calibrated 3D simulator" --json
sema interativo schema --json
sema interativo pipelines --json
sema interativo validar exemplos/sistemas-interativos/simulation-3d-calibrated-autonomous.json --json
```

Interactive catalog entries are external descriptors, not proof that an engine,
editor, plug-in, verifier, or worker is installed or ran. The local
`validar-control-run` binder can prove that a definition, canonical plan,
pipeline contract, schemas, evidence, and validator result belong together, but
even `STRUCTURALLY_COMPLETE` remains non-authoritative and keeps
`completed: false` until an external trust layer attests the run.

See [Capability Discovery](./docs/descoberta-capacidades.md) and
[AI-native Interactive Systems](./docs/sistemas-interativos.md).

## Install

```bash
npm install -g @semacode/cli
sema skill status --json
```

A global install creates a managed launcher under `~/.sema/bin`, bundles the
official skill into `~/.agents/skills/sema`, and mirrors it to
`~/.claude/skills/sema` only when Claude is already configured. The launcher
embeds absolute paths to Node.js and the installed CLI, so the skill can recover
even when the npm shim or `node` is missing from `PATH`. Open a new task after
installing or updating because already-open agents do not reload their skill
catalog retroactively.

On Windows, PowerShell resolves the managed `sema.ps1` entrypoint from `PATH`,
while `cmd.exe` resolves `sema.cmd`. If PowerShell cannot resolve `sema`, use
the managed fallback through the absolute system executable:

```powershell
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version
```

On macOS or Linux, use `"$HOME/.sema/bin/sema" --version`.

The Codex plugin remains an optional namespaced distribution channel:

```bash
codex plugin marketplace add gerlanss/Sema
codex plugin add sema@sema
```

Requirements:

- Node.js 20 or newer;
- a local project folder;
- at least one `.sema` contract before implementation work.

The CLI runs directly after installation. It does not require a Sema login,
user authorization, product-license check, activation key, token, credits, or
control panel. The repository license still governs use and redistribution; it
is not a runtime activation gate.

## Side-Effect-Free Help And JSON Results

`--help` and `-h` take precedence wherever they appear in an invocation. Help
exits with status `0` before the operational runtime or any handler is imported,
resolved, or dispatched, and does not
inspect or mutate the workspace, home, user cache, or plugin cache. It also does
not start a subprocess or make a network call.

```bash
sema iniciar --help
sema skill sync --help
sema comando-inexistente --opcao valor --help --json
```

With `--json`, help and command-control failures emit exactly one
`sema.cli.control/v1` document on stdout and keep stderr empty. That envelope
has only `schemaVersion`, `ok`, `kind`, `code`, `message`, and `exitCode`.

Every syntactically valid command invoked with `--json` emits exactly one
`sema.cli.result/v1` document with eight fields: `schemaVersion`, `ok`, `kind`,
`command`, `code`, `message`, `exitCode`, and `payload`. `SUCCESS` uses
`ok: true`, `code: "CLI_SUCCESS"`, `message: null`, and exit code `0`;
`DOMAIN_ERROR` uses `ok: false`, `code: "CLI_DOMAIN_ERROR"`, a safe public
message, and a non-zero exit code. The command-specific result is always nested
under `payload`, which may be any JSON value. Envelope `ok` classifies the CLI
result path; consumers must still read command-specific domain fields such as
`payload.sucesso`, `payload.aprovado`, or `payload.bloqueado` when present.

`sema --version` remains plain exact SemVer text rather than a JSON envelope.
See [CLI](./docs/cli.md) for the complete contract.

The npm executable is `dist/bin.js`; the package API remains `dist/index.js`.
Control failures cover unknown commands/subcommands, missing or invalid CLI
syntax, and uncaught runtime exceptions. Structured failures returned after a
valid command dispatch use `sema.cli.result/v1` with `kind: "DOMAIN_ERROR"`.

## Codex Setup

The CLI is the local engine and source of truth. `AGENTS.md` is the automatic
workspace protocol with Codex. The Sema skill is the required bootstrap for a
project that does not have that protocol yet: it teaches Codex to locate the
CLI, request adoption authorization before implementation, generate
`AGENTS.md`, and then delegate to it. Installing or updating the global CLI
does not authorize adoption of the current workspace.

After explicit project-adoption authorization:

```bash
sema descobrir explicar flow.project-adoption --json
sema iniciar --template base
sema sync-codex --json
```

Initialization preserves existing project files. `--force` is available only
for an explicit overwrite and is never used automatically by the bootstrap
skill. Symlinks and junctions below the workspace boundary are rejected.

For an existing Sema project:

```bash
sema sync-codex --json
```

The npm lifecycle owns only the managed launcher and skill directories. It does
not write into plugin caches, credentials, the workspace, or `CODEX_HOME`.
`sema skill status --json` is read-only; `sema skill sync --json` repairs both
the launcher and the bundled skill after an install made with
`--ignore-scripts`.

## Codex-Native Architecture

- `AGENTS.md` is the only official client entrypoint.
- Agent Context Pack schema version 7 exposes the deterministic capability
  discovery summary alongside `entrypointCodex`, `codexNativo`, and
  `cliLocalSemAutorizacao`.
- The globally bundled Sema skill handles first contact in projects that do not
  have Sema. Once initialized, the generated `AGENTS.md` owns the governed
  workflow and the skill does not duplicate it.
- `~/.agents/skills/sema` is the canonical cross-agent copy. Claude receives a
  managed mirror only when `~/.claude` already exists; Sema never writes into a
  plugin cache or creates per-client workspace entrypoints.

## Local Workflow

Use the CLI from the project root:

```bash
sema --version
sema resumo --drift none
sema docs-impacto --intencao "describe the change" --json
sema inspecionar contratos/sema/software.sema --drift none --json
sema drift contratos/sema/software.sema --escopo modulo --cache fresh --json
sema impacto contratos/sema/software.sema --alvo app.software --mudanca "describe the change" --json
```

`resumo` and `inspecionar` skip drift by default and leave unobserved code
evidence inside the result `payload` as `null`. Request `--drift cache` or
`--drift fresh` when needed.
Direct `sema drift` defaults to `--cache fresh`; `--cache none` executes without
persistent-cache I/O, while `cache` reuses only validated extraction data. The
cache lives in the operating system's user-cache directory outside the
workspace, and final diagnostics, links, score, and success are always
recalculated.

If a contract changes, validate it:

```bash
sema validar contratos/sema/software.sema --json
sema diagnosticos contratos/sema/software.sema --json
```

Before closing the change, prove the required docs were read:

```bash
sema finalizar-mudanca \
  --intencao "describe the change" \
  --doc-lida AGENTS.md \
  --doc-lida docs/documentation.md \
  --json
```

## Code Generation

Sema can generate starter artifacts from contracts:

```bash
sema compilar contratos/sema/software.sema \
  --alvo typescript \
  --saida .tmp/sema-generated \
  --estrutura modulos
```

Supported generation targets include TypeScript, JavaScript, Python, PHP, Dart,
Lua, HTML, CSS, C#/.NET, and C++. The native targets emit self-contained
projects and executable contract tests: `dotnet` uses the local .NET SDK, while
`cpp` uses GCC, Clang, or MSVC. They are opt-in for project-wide verification,
so projects that do not use native toolchains keep a portable default. Generated
code remains governed by the source `.sema` contract.

## Public Boundary

The public Sema CLI is local-only:

- commands execute directly against the local workspace filesystem;
- no login, user authorization, product-license check, activation key, token,
  credits, billing service, or control panel is required to run them;
- `AGENTS.md` is the official Codex entrypoint;
- the public package ships without secrets or private operational state;
- docs should be written in English for public distribution.

If you are preparing a public release, keep private and sensitive material out
of the repository and out of generated packages.

## Commercial Use

Sema is public source, but it is not a free commercial resale asset. You may use,
study, modify, and share Sema under the license terms, but you may not resell it,
rebrand it as a competing product, offer it as a commercial replica, or bundle
it as a material paid feature without written permission from OtimiTare.

Commercial licensing questions go to [suporte@otimitare.com](mailto:suporte@otimitare.com).

## Useful Commands

```bash
sema ajuda-ia
sema starter-ia
sema prompt-curto contratos/sema/software.sema --json
sema contexto-ia contratos/sema/software.sema --saida .tmp/contexto --json
sema verificar contratos/sema/software.sema --alvo typescript --saida .tmp/verificacao --json
sema importar express src --json
```

## License

See [LICENSE](./LICENSE). The license allows public non-commercial use and
prohibits commercial resale or commercial replicas without written permission.
