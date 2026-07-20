# Interactive system examples

This directory exercises the same declarative control plane across games and simulations. Spatial model, render mode, visual profile, fidelity, control, time, and determinism are independent axes. In particular, `PIXEL_8_BIT` and `PIXEL_16_BIT` are visual profiles attached to a `TWO_D` spatial model and `VISUAL` rendering; they are not spatial models or render modes.

## Coverage matrix

| Fixture | Kind | Spatial model | Render mode | Visual profile | Fidelity | Control | Time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `game-3d-human.json` | Game | 3D | Visual | Realistic | Systemic | Human | Real time |
| `game-2d.json` | Game | 2D | Visual | Vector | Systemic | Human | Fixed step |
| `game-pixel-8-bit.json` | Game | 2D | Visual | Pixel 8-bit | Arcade | Human | Fixed step |
| `game-pixel-16-bit.json` | Game | 2D | Visual | Pixel 16-bit | Stylized | Human | Fixed step |
| `game-xr-human.json` | Game | 3D | XR | Realistic | Stylized | Human | Real time |
| `hybrid-2-5d.json` | Hybrid | 2.5D | Visual | Stylized | Systemic | Hybrid | Fixed step |
| `simulation-3d-calibrated-autonomous.json` | Simulation | 3D | Visual | Realistic | Calibrated | Autonomous | Fixed step |
| `simulation-2d-controlled.json` | Simulation | 2D | Visual | Vector | Systemic | Scripted (controlled) | Fixed step |
| `simulation-pixel-16-bit.json` | Simulation | 2D | Visual | Pixel 16-bit | Systemic | Uncontrolled | Event driven |
| `simulation-text-controlled.json` | Simulation | Non-spatial | Text | None | Systemic | Scripted (controlled) | Turn based |
| `simulation-headless-autonomous-batch.json` | Simulation | Non-spatial | Headless | None | Systemic | Autonomous | Accelerated |

This is a representative matrix, not a Cartesian product of every axis. It exercises every public spatial model (`NON_SPATIAL`, `TWO_D`, `TWO_POINT_FIVE_D`, and `THREE_D`) and render mode (`HEADLESS`, `TEXT`, `VISUAL`, and `XR`), while the canonical catalog and automated tests enumerate the complete compatibility surface. The fixtures intentionally cover human, scripted, autonomous, uncontrolled, and hybrid modes, plus realistic, calibrated, vector, headless, and constrained pixel-art surfaces. A visual profile never makes a simulation scientifically valid; the calibrated fixture therefore declares its reference, method, tolerances, uncertainty, and telemetry separately.

## Validate and plan

From the repository root, after building the CLI:

```powershell
sema interativo validar exemplos/sistemas-interativos/game-3d-human.json --json
sema interativo planejar exemplos/sistemas-interativos/simulation-headless-autonomous-batch.json --json
```

Run the same validation command for every game and simulation JSON in the coverage matrix. Each fixture declares an explicit compatible adapter composition that covers every planned stage capability. Validation and planning are local and declarative: they do not start an engine, mutate a workspace, or prove that an external run occurred.

## Advanced fixtures

The `advanced/` directory mirrors the public P0/P1/P2 JSON schemas used by the
read-only validators and planners:

| Fixture | Purpose |
| --- | --- |
| `temporal-valid.json` and `temporal-evidence-valid.json` | 4D phases/tracks, order invariant, shot, collision, temporal QA, clean-install/launch/smoke requirements, hardware budget, and a complete supplied structural evidence bundle. |
| `autonomy-repair-valid.json` | `diagnose -> propose -> simulate -> prove` cycle with a derived recovery token, snapshot, checkpoint, resource lock, and rollback plan. |
| `playtest-fuzz-valid.json` | Bounded deterministic bot, save/load recovery cases, budgets, stop criteria, and required evidence. |
| `multiplayer-authority-valid.json` | Server authority, sensitive replicated state, conflict handling, reconnect, and security invariants. |
| `portability-valid.json` | Cross-engine exact, approximate, and unsupported mappings with explicit losses, fallbacks, acceptance criteria, and rollback-ready version migration. |
| `distributed-workers-valid.json` | Cook, shader, render, and test DAG with worker capabilities, budgets, leases, heartbeats, checkpoints, and evidence requirements. |
| `engine-snapshot-before-valid.json` and `engine-snapshot-after-valid.json` | Engine-neutral semantic snapshots for a deterministic local diff. |
| `asset-provenance-valid.json` | Opaque origin reference, license evidence, hashes, transformations, and derivative lineage. |
| `editor-state-valid.json` | Supplied editor-state description with scene, selection, mode, dirty state, jobs, plug-ins, modals, and opaque process references. |
| `job-orchestration-valid.json` | Local queue/lock/budget/heartbeat/checkpoint/resume planning input. |
| `acceptance-lock-valid.json` and `acceptance-context-evaluate-valid.json` | Artifact, scene, and time-range acceptance binding plus an evaluation context. |
| `multimodal-evidence-valid.json` | Ten typed supplied channels with an independent-verifier descriptor and decision record. |
| `control-run-definition-valid.json` and `control-run-valid.json` | A complete local binding across definition, canonical plan, temporal pipeline, validation contract, schema inputs, evidence, and rerun validator result. |

Experience IR itself is represented by `experience-ir-valid.json` in the parent
directory. Its JSON serialization is native; CBOR remains an external-codec
path.

The advanced files are synthetic validation inputs. In particular,
`editor-state-valid.json` is **not** proof that an editor was inspected, and
`multimodal-evidence-valid.json` is **not** captured runtime evidence. The CLI
does not detect or execute engines, editors, plug-ins, verifiers, processes, or
workers when reading them.

The control-run fixtures are templates for deterministic binding. The plan and
result files are intentionally generated by the CLI during tests instead of
being checked in as stale derived artifacts. See `validar-control-run` in
`docs/sistemas-interativos.md` for the full command.

## Adapter protocol records

- `protocol-read-only-valid.json` models a successful read-only `DETECT -> PROBE -> SNAPSHOT -> PLAN -> VALIDATE -> EVIDENCE` record.
- `protocol-mutating-rollback-valid.json` models a mutating adapter whose validation failed and whose rollback completed with a declared rollback evidence identifier.

Validate them with:

```powershell
sema interativo validar-protocolo exemplos/sistemas-interativos/protocol-read-only-valid.json --json
sema interativo validar-protocolo exemplos/sistemas-interativos/protocol-mutating-rollback-valid.json --json
```

The protocol fixtures use real SHA-256 digests of two explicit UTF-8 literals:

| Literal | SHA-256 |
| --- | --- |
| `fixture:protocol-input` | `sha256:8faad66a2e59a27af6bbc6e1421493a2f3758f376515c44e2e16fbcb340ac082` |
| `fixture:protocol-output` | `sha256:4f135cff766c846e90720c6e50676c37a7b98023bbe7b1ef6b3fa46fd54ffc2d` |

Those hashes exist only to exercise protocol structure. They are not runtime observations, artifact evidence, signatures, or authoritative proof.

## Evidence boundary

No core pipeline evidence bundle claiming a real engine run is included. The
advanced temporal and multimodal records are explicitly synthetic validator
fixtures. In production, create evidence only from actual runner or adapter
observations, bind every observation to the selected producer adapter
ID/version and the exact definition/plan digests, and provide non-empty
observation data. Even a local `STRUCTURALLY_COMPLETE` result keeps
`completed: false` and remains non-authoritative until an external trust layer
supplies the required attestation.
