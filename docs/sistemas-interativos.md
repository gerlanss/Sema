# AI-native Interactive Systems

Sema Interactive is the declarative control plane for games, simulations, and
hybrid interactive systems. The same core covers 3D, 2.5D, 2D, text, retro
8/16-bit presentation, XR, and headless execution.

It does not embed a game engine or silently control an editor. Sema validates
definitions, calculates required capabilities, selects compatible external
adapter descriptors, expands pipelines into evidence-bearing stages, and
derives non-authoritative local results. An explicitly integrated external
runner must perform any engine, editor, plug-in, build, verifier, or worker
operation.

The public CLI is a read-only control plane. It does **not** detect, probe,
launch, install, or control Unreal, Unity, Godot, Blender, PICO-8, TIC-80,
LÖVE, a browser runtime, a custom engine, a plug-in, or a distributed worker.
Catalog presence means only that a descriptor exists; it is not runtime
availability evidence.

## The dimensions are independent

An interactive definition separates concerns that are often incorrectly mixed:

| Axis | Examples |
| --- | --- |
| Kind | `GAME`, `SIMULATION`, `HYBRID` |
| Spatial model | `NON_SPATIAL`, `TWO_D`, `TWO_POINT_FIVE_D`, `THREE_D` |
| Render mode | `HEADLESS`, `TEXT`, `VISUAL`, `XR` |
| Visual profile | `NONE`, `PIXEL_8_BIT`, `PIXEL_16_BIT`, `RASTER`, `VECTOR`, `STYLIZED`, `REALISTIC` |
| Fidelity | `ARCADE`, `STYLIZED`, `SYSTEMIC`, `REALISTIC`, `CALIBRATED` |
| Control | human, scripted, AI, hybrid, autonomous, or uncontrolled/emergent |
| Time | fixed step, variable step, turn based, event driven, or accelerated |
| Determinism | strict, seeded, best effort, or stochastic |

`PIXEL_8_BIT` and `PIXEL_16_BIT` are visual/technical profiles, not spatial
dimensions or lesser product classes. A 16-bit economic simulation and a 3D
flight simulation use the same world/state/time/evidence core with different
budgets and adapters.

## Core commands

```bash
sema interativo capabilities --json
sema interativo schema --json
sema interativo pipelines --json
sema interativo adapters --spatial-model TWO_D --render-mode VISUAL --json
sema interativo validar exemplos/sistemas-interativos/game-pixel-16-bit.json --json
sema interativo planejar exemplos/sistemas-interativos/game-pixel-16-bit.json --json
sema interativo validar-evidencias <definition.json> [--plano-arquivo <plan.json>] --bundle-arquivo <bundle.json> --json
sema interativo status <definition.json> [--plano-arquivo <plan.json>] --bundle-arquivo <bundle.json> --json
sema interativo validar-protocolo <adapter-run.json> --json
```

Every command above is local and declarative. Responses report
`executed: false` and `workspaceMutated: false`. The CLI does not open an
engine, editor, browser runtime, or custom simulator.

`--evidencias-arquivo` is accepted as an alias for `--bundle-arquivo`. When
`--plano-arquivo` is omitted, the CLI recomputes the deterministic plan and
still rejects any bundle whose definition or plan digest does not match.

`schema` is the stable, read-only machine contract for definition generation.
It exposes required fields, supported enum values, cross-field constraints,
the capability matrix, and canonical example paths. Its advanced command map
links every positional/option surface to input and output schemas; each data
schema exposes required top-level fields and official fixtures. Each subcommand
has an explicit argument allowlist: unknown flags, duplicate semantic flags,
missing values, and invalid enum values fail closed instead of producing an
empty successful result.

## Advanced read-only commands

The advanced command surface exposes the same pure validators and planners to
AI agents. File-based commands read JSON, every command returns structured JSON,
and engine, editor, process, plug-in, and worker inspection remains an external
integration responsibility.

Experience IR:

```bash
sema interativo validar-ir <experience-ir.json> --json
sema interativo indexar-ir <experience-ir.json> --json
sema interativo consultar-ir <experience-ir.json> --semantic-id <id> --json
sema interativo chunk-ir <experience-ir.json> --semantic-id <id> [--raso] --json
sema interativo descrever-ir --json
```

Operational snapshots, provenance, jobs, acceptance, and multimodal evidence:

```bash
sema interativo validar-engine-snapshot <snapshot.json> --json
sema interativo diff-engine-snapshots <before.json> <after.json> --json
sema interativo validar-asset-provenance <provenance.json> --json
sema interativo validar-editor-state <editor-state.json> --json
sema interativo planejar-jobs <jobs.json> --json
sema interativo validar-acceptance <acceptance-lock.json> --json
sema interativo operar-acceptance <acceptance-lock.json> --operation <VALIDATE|EVALUATE|INVALIDATE> --context-file <context.json> --json
sema interativo validar-multimodal <evidence.json> --json
```

Time, autonomy, portability, and distributed work:

```bash
sema interativo validar-temporal <temporal-contract.json> --json
sema interativo validar-evidencia-temporal <temporal-contract.json> --bundle-arquivo <temporal-evidence.json> --json
sema interativo validar-autonomia <repair-cycle.json> --json
sema interativo validar-playtest-fuzz <playtest-fuzz.json> --json
sema interativo validar-multiplayer <authority-model.json> --json
sema interativo analisar-portabilidade <portability-plan.json> --json
sema interativo validar-workers <distributed-jobs.json> --json
```

These commands validate descriptions and derive plans, diffs, indexes, queries,
chunks, eligibility, or assignments. They do not perform the described work.

`sema interativo schema --json` publishes distinct input and output shapes for
all 20 extension commands. The advertised multimodal input includes claim and
producer/verifier bindings; autonomy includes cycle and acceptance-lock fields;
and `jobOrchestrationPlan` exposes `requestDigest`, `planDigest`, and an ordered
`queue` whose entries are the declared job assignments. Result shapes are
checked against the official fixtures, and every command publishes
`outputTargets` path segments from the payload root, so an agent never has to
reuse an input shape or guess where a validator's output lives.

## Bound control runs

`validar-control-run` is the fail-closed bridge from a planned pipeline to one
specific advanced validator invocation. It binds a strict manifest to the
definition digest, recomputed canonical plan, selected pipeline descriptor,
validation contract, schema-declared input digests, evidence, producer and
verifier identity, and the exact validator result. The CLI reruns the selected
pure validator and rejects a result, contract, input, evidence, or pipeline
borrowed from another run.

```bash
sema interativo validar-control-run <control-run.json> \
  --definition-arquivo <definition.json> \
  --plano-arquivo <plan.json> \
  --contrato-arquivo <validation-contract.json> \
  --entrada-arquivo <input.json> \
  [--entrada-auxiliar-arquivo <supporting-input.json>] \
  --evidencia-arquivo <evidence.json> \
  --resultado-arquivo <result.json> \
  --json
```

This proves deterministic local binding only. A valid control run still returns
`completed: false`, `authoritative: false`, and
`awaitingExternalAttestation: true`; it does not prove that an engine, editor,
worker, verifier, or external adapter actually ran.

## Experience IR

Experience IR is the engine-neutral semantic substrate below the advanced
pipelines. Version `sema.experience-ir/v1` models 20 kinds of project, world,
scene, entity, component, transform, camera, light, material, texture, audio,
physics, constraint, animation, VFX, timeline, input, save, network, and build
objects. Stable semantic IDs and explicit references make the graph queryable
without relying on engine-specific object paths.

The v1 kind set remains unchanged. Eight engine-neutral concepts use optional,
typed semantic roles in their natural containers, so existing v1 documents
remain valid while newer documents can expose the concepts explicitly:

| Semantic role | Typed v1 representation |
| --- | --- |
| `LEVEL` | `SCENE.semanticRole` |
| `PIVOT` | `TRANSFORM.semanticRole` |
| `COLLIDER` | `PHYSICS.colliders[]` |
| `EMITTER` | `VFX.emitters[]` |
| `TRACK` | `TIMELINE.tracks[].semanticRole` |
| `CLIP` | `TIMELINE.tracks[].clips[]` |
| `EVENT` | `TIMELINE.tracks[].events[]` |
| `GAME_STATE` | `SAVE.semanticRole` |

`descrever-ir` publishes this mapping as
`sema.experience-ir.semantic-roles/v1`. Index and chunk entries expose their
canonical `semanticRoles`, while node `kind` remains one of the original 20.
Typed clips participate in reference validation and dependency closure.

The IR declares units and coordinate systems, records asset provenance, and
uses content-addressed digests for deterministic indexing and chunking. JSON is
the native canonical serialization. CBOR is an explicitly external codec path;
the CLI does not pretend to encode it. Indexing, lookup, and dependency-aware
chunks are in-memory read-only operations. They do not import assets, convert a
project, materialize a scene, or execute a build.

Validation also rejects sensitive values under neutral keys, including private
keys, Bearer credentials, and common `sk`, `ghp`, or `github_pat` token forms,
as well as credential-bearing URI queries such as `access_token`, `api_key`,
`signature`, or `X-Amz-*`, without echoing the value or caller-controlled key
path. Entity and transform
parent graphs must be acyclic. Network nodes apply cross-field policy:
`OFFLINE` means `NONE`, no replicated IDs, and tick zero; `CLIENT_SERVER`
requires `SERVER`; `PEER_TO_PEER` accepts `OWNER` or `DISTRIBUTED`; and
`LOCKSTEP` requires `DISTRIBUTED`. Every online mode requires declared
replication and a positive integer tick rate.

## P0, P1, and P2 coverage

The advanced surface is grouped by operational responsibility, not rendering
style:

| Priority | Covered responsibilities |
| --- | --- |
| P0 — represent and observe | Experience IR; semantic engine snapshots and diffs; asset origin, license, hashes, transforms, and derivatives; editor-state descriptors; multimodal evidence descriptors; job budgets, locks, heartbeats, checkpoints, resume tokens, and recovery; artifact/time-bound acceptance locks. |
| P1 — validate behavior over time | 4D phases, tracks, clips, and invariants; shots and camera visibility; collision, attachment, and separation relations; flicker, ghosting, popping, exposure, and jitter QA; materialization, clean-install, launch, and smoke-playtest requirements; target hardware budgets. |
| P2 — diagnose, scale, and migrate | `diagnose -> propose -> simulate -> prove` repair cycles with safe rollback; bounded bots, fuzzing, and save/load recovery; explicit multiplayer authority and reconnect rules; versioned engine migration and cross-engine portability with declared losses; distributed worker DAGs with capabilities, leases, budgets, and checkpoints. |

All three groups apply to 3D, 2.5D, 2D, 8-bit, 16-bit, text, XR, and headless
games or simulations. A visual profile changes constraints and evidence needs;
it does not switch to a weaker governance model.

## Canonical pipelines

The canonical catalog exposes **35 unique pipelines** and **28 unique external
adapter descriptors**. Pipelines are reusable goals rather than one workflow
per rendering style.

Core pipelines:

- `interactive.prototype`
- `interactive.playtest`
- `interactive.package`
- `interactive.release`
- `interactive.replay`
- `interactive.calibrate`
- `interactive.safety`
- `game.balance`
- `game.progression`
- `game.multiplayer`
- `simulation.scenario`
- `simulation.batch_run`
- `simulation.calibrate`
- `simulation.validate`
- `simulation.safety`

P0/P1/P2 pipelines:

- `interactive.experience_ir`
- `interactive.observe`
- `interactive.asset_provenance`
- `interactive.editor_state`
- `interactive.evidence_capture`
- `interactive.job_recovery`
- `interactive.acceptance_lock`
- `interactive.temporal_validate`
- `interactive.shot_validate`
- `interactive.physics_validate`
- `interactive.temporal_qa`
- `interactive.clean_install_smoke`
- `interactive.hardware_budget`
- `interactive.autonomous_repair`
- `interactive.bot_playtest`
- `interactive.state_fuzz`
- `interactive.multiplayer_authority`
- `interactive.engine_migration`
- `interactive.portability`
- `interactive.distributed_jobs`

Spatial model, render mode, and visual profile influence capabilities, budgets,
evidence, and adapter compatibility. They do not decide the workflow goal.
`THREE_D + HEADLESS` is therefore valid, while `XR` requires `THREE_D`.

## Adapter boundary

Adapter descriptors represent runtime, editor, asset, build, telemetry,
observation, IR, autonomy, portability, or distributed-job capabilities. They
describe compatibility; they do not prove that an engine, editor, plug-in, or
worker is installed, reachable, or running.

The protocol model uses a read-only observation prefix:

```text
DETECT -> PROBE -> SNAPSHOT -> PLAN
```

Those names describe phases that an external adapter must implement; the local
CLI does not perform `DETECT` or `PROBE`. Read-only adapters continue with
`VALIDATE -> EVIDENCE`. Mutating adapters add `APPLY` and must support
`ROLLBACK`:

```text
DETECT -> PROBE -> SNAPSHOT -> PLAN -> APPLY -> VALIDATE -> EVIDENCE
                                                \-> ROLLBACK on failure
```

Stable semantic target IDs bind every phase. A failed external mutation without
rollback evidence is a blocking result.

The descriptor catalog includes general targets for Unreal, Unity, Godot,
Blender, web canvas, LÖVE, PICO-8, TIC-80, headless runtimes, simulation
runners, validators, telemetry, assets, builds, operational observers, IR,
autonomy, portability, and distributed jobs. These are compatibility
descriptors, not bundled integrations, probes, detections, or installation
claims.

Planning is provider-aware. `adapterTargets` is an explicit composition, not a
decorative preference: every expanded stage capability must be supplied by at
least one selected compatible descriptor. An empty or partial selection
produces a blocked plan with deterministic candidate and
recommended-composition output. A telemetry descriptor cannot stand in for an
executor, and a generic headless descriptor cannot claim packaging capabilities
it does not declare.

## Evidence and operational truth

Pipeline stages declare exact evidence types. Examples include runtime boot,
first input, loop completion, failure state, deterministic replay, calibration,
tolerance comparison, package creation, packaged launch, smoke execution, and
rollback observation.

Compilation does not prove playability. Opening an editor does not prove a
simulation is valid. An editor playtest does not prove a packaged build. A
runner saying “success” does not replace observed evidence.

The portable evidence bundle in v1 is explicitly non-authoritative. It
validates binding, digests, stage coverage, stable IDs, non-empty observation
data, and the producing adapter ID/version against the selected provider for
each stage. High-assurance environments must additionally provide signed
envelopes, quorum, anti-replay state, and externally retained checkpoints
through an appropriate trust/ledger layer. Sema does not label a local JSON file
as a strong trust boundary.

When all local structural checks and supplied observation records pass, status
is `STRUCTURALLY_COMPLETE`. This is **not authoritative completion**. It means
only that local structural coverage is complete; it deliberately keeps
`completed: false`, `authoritative: false`, and
`awaitingExternalAttestation: true`. It does not prove that an engine ran, an
editor was inspected, a plug-in existed, a worker accepted a job, a package
launched, or an external observer attested the result.

## Semantic responsibility split

The operational surface is divided by responsibility while preserving
`operations.ts` as the stable explicit export facade:

- `operationPrimitives.ts` contains shared validation, canonicalization, digest,
  and evidence primitives;
- `engineObservation.ts` owns engine snapshots, semantic diffs, asset
  provenance, and editor-state observation;
- `jobOrchestration.ts` owns queues, locks, budgets, leases, checkpoints, and
  recovery planning;
- `acceptanceEvidence.ts` owns acceptance locks, invalidation, and multimodal
  claim evidence.

The contracts follow the same boundaries through
`sistemas_interativos_operacao.sema`,
`sistemas_interativos_observacao_engine.sema`,
`sistemas_interativos_orquestracao_jobs.sema`, and
`sistemas_interativos_acceptance_evidencias.sema`. The installed-package smoke
also keeps one stable orchestrator and one isolated installation, delegating
public-boundary security, Codex bootstrap, content-pipeline compatibility,
interactive systems, and generated toolchains to named helpers under
`scripts/cli-publico/`.

This is a responsibility split, not a numbered-file workaround. Existing
exports, schema versions, fixtures, digests, and fail-closed behavior remain
backward compatible across the facades.

## Fidelity rules

Visual realism and model validity are separate. A `REALISTIC` or `CALIBRATED`
simulation must declare reference data, units, calibration method, tolerances,
uncertainty, and telemetry. A photorealistic scene without those items is only
photorealistic, not a validated simulation.

Strict or seeded determinism requires a seed, snapshots, event log, reproducible
step model, and replay result digest. Autonomous or uncontrolled systems require
stopping criteria, boundaries, and safety evidence.

## Examples

The fixtures under `exemplos/sistemas-interativos/` deliberately cover opposing
cases: human-controlled retro games, 2D simulations, 3D calibrated simulations,
and autonomous headless batch execution. The `advanced/` fixtures mirror the
public schemas for IR-adjacent operations, temporal validation, autonomy,
multiplayer authority, portability, distributed jobs, and fully bound control
runs. They are synthetic validation inputs, not captured runtime evidence. The coverage matrix proves
that kind, spatial model, render mode, visual profile, control, fidelity, and
runtime are composable rather than hardcoded around one showcase project.
