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
- Agent Context Pack consumers use schema version 7, including the deterministic
  discovery summary and the fields `entrypointCodex`, `codexNativo`, and
  `cliLocalSemAutorizacao`.
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

## Commercial Use

Sema is public source for local semantic governance, but commercial resale,
white-label redistribution, or commercial replicas require written permission
from OtimiTare.

## Support

Use [suporte@otimitare.online](mailto:suporte@otimitare.online) for support.
