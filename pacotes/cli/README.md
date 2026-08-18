# @semacode/cli

`@semacode/cli` is the public local-first CLI for Sema semantic
governance, proven with Claude, Codex, zCode (GLM) and Kimi.

It validates `.sema` contracts, checks semantic drift, maps impact, enforces
documentation gates, generates starter code, and prepares contract-first
contract-first context for coding agents inside a local project folder.

Sema is an independent product and is not affiliated with or endorsed by
OpenAI. Proven compatibility with Claude, Codex, zCode (GLM) and Kimi
describes Sema's product direction, not an official OpenAI program.

Official support: [suporte@otimitare.com](mailto:suporte@otimitare.com)

## Install

```bash
npm install -g @semacode/cli
sema skill status --json
```

The global package installs a stable launcher under `~/.sema/bin` and
synchronizes the bundled skill to `~/.agents/skills/sema`. If Claude is already
configured, it also maintains `~/.claude/skills/sema`. Open a new task after an
install or update because existing tasks do not reload their skill catalog.

## First Run

```bash
sema --version
sema resumo . --curto --drift none
```

Public Sema is local-only. The CLI runs directly without a Sema login, user
authorization, product-license check, activation key, token, credits, billing
service, control panel, or external service credentials. The license governs
use and redistribution; it is not a runtime activation gate.

## Side-Effect-Free Help And JSON Results

`--help` and `-h` short-circuit before the operational runtime or handlers are
imported wherever they appear. Help exits with status `0` without inspecting or mutating the workspace, home,
user cache, or plugin cache, and without starting subprocesses or network
calls.

```bash
sema iniciar --help
sema dev --help --json
sema skill sync --help
```

When `--json` is present, help and command-control failures emit exactly one
`sema.cli.control/v1` document on stdout with empty stderr. Its only fields are
`schemaVersion`, `ok`, `kind`, `code`, `message`, and `exitCode`. Failures are
redacted and never expose a stack, absolute path, or raw argv.

Every syntactically valid command invoked with `--json` in 3.0.0 emits exactly
one `sema.cli.result/v1` document. Its only fields are `schemaVersion`, `ok`,
`kind`, `command`, `code`, `message`, `exitCode`, and `payload`. `SUCCESS` uses
`ok: true`, `CLI_SUCCESS`, `message: null`, and exit code `0`;
`DOMAIN_ERROR` uses `ok: false`, `CLI_DOMAIN_ERROR`, a safe public message, and
a positive exit code. `payload` is always present, may contain any JSON value,
and is the only location for the command-specific result; `data` is not an
alias.

Envelope `ok` classifies the CLI result path and does not replace domain fields
inside `payload`. Consumers must unwrap the payload before reading values such
as `sucesso`, `aprovado`, or `bloqueado`. `sema --version` remains plain exact
SemVer text rather than a JSON envelope.

The package separates execution from imports: `bin.sema` points to
`dist/bin.js`, while `main` and the root export remain `dist/index.js`.
Unknown commands/subcommands, missing or invalid CLI syntax, and uncaught
runtime exceptions use the control envelope; structured domain-level failures
after valid dispatch use `sema.cli.result/v1` with `kind: "DOMAIN_ERROR"`.

## Agent Setup

`AGENTS.md` is the official Sema entrypoint for coding agents:

```bash
sema sync-codex --json
```

Agent tools that read `AGENTS.md` — Claude, Codex, zCode (GLM) and Kimi among
them — load it as durable repository guidance.

The CLI is the engine and source of truth; `AGENTS.md` is the automatic
workspace protocol. The Sema skill bootstraps a project that does not have Sema
yet and then delegates to the generated `AGENTS.md`. The npm lifecycle updates
only Sema-managed launcher and skill roots; it never writes into plugin caches,
credentials, the workspace, or `CODEX_HOME`.

Use `sema skill status --json` for a read-only diagnosis and `sema skill sync
--json` to repair the launcher and skill after `npm install --ignore-scripts`.
If a shell still cannot resolve `sema`, invoke the managed launcher directly:

```powershell
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version
```

```bash
"$HOME/.sema/bin/sema" --version
```

On Windows, PowerShell resolves `sema.ps1` from `PATH`, `cmd.exe` resolves
`sema.cmd`, and `sema-managed.ps1` is the PATH-independent fallback.

## Architecture

- `AGENTS.md` is the only official entrypoint. `sync-codex` changes only valid
  Sema-managed blocks and preserves malformed or manual content for review.
- Agent Context Pack consumers use schema version 7, including the deterministic
  discovery summary and the fields `entrypointCodex`, `codexNativo`, and
  `cliLocalSemAutorizacao`.
- The bundled Sema skill handles first contact. Its canonical shared copy is
  `~/.agents/skills/sema`; Claude gets a managed mirror only when detected. It
  asks for adoption authorization before implementation and does not duplicate
  governance after handing off to `AGENTS.md`. Installing or updating the
  global CLI authorizes distribution changes only, not workspace adoption.

## Local Workflow

```bash
sema docs-impacto --intencao "describe the change" --arquivo contratos/app.sema --json
sema inspecionar contratos/app.sema --drift none --json
sema drift contratos/app.sema --escopo modulo --cache fresh --json
sema impacto contratos/app.sema --alvo app.modulo --mudanca "describe the change" --json
sema finalizar-mudanca --intencao "describe the change" --doc-lida README.md --json
```

`resumo` and `inspecionar` default to `--drift none`; unobserved score,
confidence, implementation, and route evidence inside the result `payload`
stays `null`. Use `--drift cache|fresh` to request analysis. Direct `sema drift`
accepts `--cache none|cache|fresh` and defaults to `fresh`. Persistent objects are stored in the
operating system's user-cache directory outside the workspace. They reuse only
validated extraction data; the final drift decision is always recalculated.

If the project has no `.sema` contract, an informational request must remain
read-only. Before implementing behavior, obtain explicit adoption authorization,
then inspect the official flow and initialize:

```bash
sema descobrir explicar flow.project-adoption --json
sema iniciar --template base
sema sync-codex --json
```

Initialization preserves existing files and rejects symlink or junction
escapes. Use `--force` only when overwriting the template destinations is an
explicit human decision; the bootstrap skill never adds it.

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

## AI-native Content Pipeline

`sema conteudo` validates and plans multi-channel, multi-format content work,
verifies signed policies and evidence, replays canonical state, and projects
non-authoritative manifests. Producer agents, specialized AI evaluators,
creative tools, and delivery adapters run in an external runner; there is no
native human-review transition.

```bash
sema conteudo validar exemplos/pipeline-conteudo/definicao.json --json
sema conteudo planejar exemplos/pipeline-conteudo/definicao.json --alvos-arquivo exemplos/pipeline-conteudo/alvos.json --json
```

See `docs/pipeline-conteudo.md` for the signed trust, quorum, ledger, target,
adapter, and projection model.

## Capability Discovery and Interactive Systems

`sema descobrir` exposes one explainable catalog and a deterministic intent
router. `sema interativo` validates and plans games, simulations, and hybrids
across independent spatial models, render modes, retro visual profiles, control,
time, determinism, and fidelity axes without running an engine or silently
mutating a workspace.

```bash
sema descobrir catalogo --json
sema descobrir recomendar --intencao "calibrate a headless autonomous simulation" --json
sema interativo schema --json
sema interativo pipelines --json
sema interativo validar exemplos/sistemas-interativos/simulation-headless-autonomous-batch.json --json
```

The canonical interactive catalog contains 35 unique pipelines and 28 unique
external adapter descriptors. Its advanced P0/P1/P2 surface covers Experience
IR, semantic engine snapshots, asset provenance, editor-state descriptions,
multimodal evidence, resumable jobs, acceptance locks, temporal/shot/physics QA,
clean-install and hardware constraints, safe autonomous repair, bounded
playtest/fuzz plans, multiplayer authority, portability with declared losses,
and distributed worker DAGs.

Advanced read-only commands:

```bash
sema interativo validar-ir <file> --json
sema interativo indexar-ir <file> --json
sema interativo consultar-ir <file> --semantic-id <id> --json
sema interativo chunk-ir <file> --semantic-id <id> [--raso] --json
sema interativo descrever-ir --json

sema interativo validar-engine-snapshot <file> --json
sema interativo diff-engine-snapshots <before> <after> --json
sema interativo validar-asset-provenance <file> --json
sema interativo validar-editor-state <file> --json
sema interativo planejar-jobs <file> --json
sema interativo validar-acceptance <file> --json
sema interativo operar-acceptance <lock> --operation <VALIDATE|EVALUATE|INVALIDATE> --context-file <file> --json
sema interativo validar-multimodal <file> --json

sema interativo validar-temporal <file> --json
sema interativo validar-evidencia-temporal <contract> --bundle-arquivo <file> --json
sema interativo validar-autonomia <file> --json
sema interativo validar-playtest-fuzz <file> --json
sema interativo validar-multiplayer <file> --json
sema interativo analisar-portabilidade <file> --json
sema interativo validar-workers <file> --json

sema interativo validar-control-run <control-run.json> --definition-arquivo <definition.json> --plano-arquivo <plan.json> --contrato-arquivo <validation-contract.json> --entrada-arquivo <input.json> [--entrada-auxiliar-arquivo <supporting-input.json>] --evidencia-arquivo <evidence.json> --resultado-arquivo <result.json> --json
```

All of these commands are local and read-only. Adapter entries are external
capability descriptors: the package does not detect, probe, launch, install, or
control any engine, editor, plug-in, process, verifier, or worker. A
`STRUCTURALLY_COMPLETE` result is local structural coverage only; it always
remains `completed: false`, `authoritative: false`, and awaits external
attestation. The CLI never equates a descriptor, fixture, plan, or supplied JSON
record with proof that external work occurred.

See `docs/descoberta-capacidades.md` and `docs/sistemas-interativos.md` for the
ranking, adapter protocol, evidence boundary, fidelity, and coverage model.

## Programmatic API

The package root can be imported without executing the CLI process:

```js
import {
  analisarPlanoPortabilidadeInterativa,
  indexarExperienceIr,
  montarCatalogoCapacidades,
  validarContratoTemporalInterativo,
  validarControlRunInterativo,
  validarDefinicaoSistemaInterativo,
  validarExperienceIr,
} from "@semacode/cli";
```

Only the package-root exports are public. Internal `dist/*` deep imports remain
blocked, and importing the package never parses CLI arguments or exits the host
process. Programmatic validators and planners preserve the same read-only,
non-authoritative boundary as their CLI equivalents.

## Public Boundary

The npm package is local-only: its CLI and programmatic API do not depend on a
hosted Sema service. It must not contain private or sensitive operational
material.

Contributors must create the tarball through `npm run cli:empacotar-publica`
from the repository root. Direct `npm pack` in this source package is blocked:
the official factory uses an isolated per-run stage and is the only supported
path that bundles runtime packages, examples, documentation, the launcher, and
the Sema skill.

## Commercial Use

Sema is public source for local semantic governance, but commercial resale,
white-label redistribution, or commercial replicas require written permission
from OtimiTare.

## Support

Use [suporte@otimitare.com](mailto:suporte@otimitare.com) for support.
