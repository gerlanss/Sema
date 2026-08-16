<!-- sema:agent-entrypoint:start -->
# Sema Command Catalog

Use this file when Codex does not know which command to run. A Sema command is an operational gate; do not replace it with a Markdown report.

## Minimum Local Flow

```bash
sema --version
sema resumo --drift none
sema docs-impacto --intencao "<acao>" --json
```

If `sema` is absent from `PATH`, use `$HOME/.sema/bin/sema` on macOS/Linux. On Windows, PowerShell resolves `sema.ps1` from PATH, cmd.exe resolves `sema.cmd`, and the absolute fallback is `& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version`. `sema skill sync --json` repairs launcher and skill without touching the workspace or plugin caches.

Then read every required doc returned by `docs-impacto`.

## Public JSON output

`sema --version` stays plain exact SemVer text. With `--json`, help and command-control failures use exactly one six-field `sema.cli.control/v1` document on stdout with empty stderr. Every syntactically valid command uses exactly one eight-field `sema.cli.result/v1` document containing only `schemaVersion`, `ok`, `kind`, `command`, `code`, `message`, `exitCode`, and `payload`. The command-specific result is nested under `payload`, never `data`; envelope `ok` does not replace domain fields inside that payload. Valid structured domain failures use `DOMAIN_ERROR`, while uncaught runtime exceptions remain redacted `FATAL_ERROR` control failures.

## Global Distribution

- `sema skill status --json`: diagnoses the managed launcher and bundled skill without writing.
- `sema skill sync --json`: repairs only Sema-managed launcher and skill destinations; it never writes into the workspace or plugin caches.

## Contract and Discovery

- `sema iniciar --template <template> [--force]`: creates a new Sema project and preserves existing files by default; `--force` is the only explicit overwrite path.
- `sema validar <arquivo-ou-pasta> --json`: validates `.sema` contracts.
- `sema diagnosticos <arquivo.sema> --json`: details errors and warnings.
- `sema formatar <arquivo-ou-pasta>`: formats contracts.
- `sema inspecionar <arquivo-ou-pasta> [--drift <none|cache|fresh>] --json`: shows the contract surface; drift is skipped by default.
- `sema ast <arquivo.sema> --json`: shows AST for syntax debugging.
- `sema ir <arquivo.sema> --json`: shows the IR used by gates and generators.
- `sema descobrir catalogo --json`: lists governance flows, profiles, specialized workflows, pipelines, generators, capability tokens, and adapters from their canonical registries.
- `sema descobrir recomendar --intencao "<goal>" --json`: ranks compatible capabilities deterministically without executing the selected command.
- `sema descobrir explicar <id> --json`: explains inputs, boundaries, reasons, and the command template for one capability.
- `sema pipeline listar|descrever <id> --json` and `sema capabilities --json`: compact projections of the same discovery catalog.

## Change and Closure

- `sema docs-impacto --intencao "<acao>" --json`: discovers required docs and documentary blockers.
- `sema drift <arquivo-ou-pasta> --escopo modulo [--cache <none|cache|fresh>] --json`: plans a safe physical scope, then compares contract and implementation without a global fallback.
- `sema impacto <arquivo-ou-pasta> --alvo <token> --mudanca "<descricao>" --json`: maps impact before changing behavior.
- `sema verificar <arquivo-ou-pasta> --json`: runs aggregated final verification.
- `sema finalizar-mudanca --intencao "<acao>" --doc-lida <arquivo> --json`: proves documentation reading before closure.

Honest closure: unwrap drift JSON and treat its command payload as the source of truth. `payload.sucesso:false`, non-empty `payload.vinculos_quebrados`, non-empty `payload.rotas_divergentes`, or non-empty `payload.impls_quebrados` mean the change is not complete yet. Do not report "clean drift" without a green payload.

Focused drift exposes its planned, declared, inferred, and missing files plus catalog visit/read metrics in `escopo_aplicado`. File and module scopes fail closed without a safe anchor, with homonymous implementation candidates, or with missing local dependencies; only `--escopo projeto` may walk every configured code root. Logical roots such as `src` are probed deterministically without a discovery walk. Configured contract origins and code roots are confined before enumeration, and `inspecionar`, `impacto`, and `renomear-semantico` reuse the same directed boundary without reopening arbitrary external paths.

Drift analysis and cache modes are explicit:

- `sema drift` defaults to `--cache fresh`. `none` still executes drift but performs zero persistent-cache I/O; `cache` reuses a fully validated extraction hit and publishes misses; `fresh` ignores hits, recalculates, and publishes the new extraction.
- `sema resumo` and `sema inspecionar` default to `--drift none`. In that mode their payload does not execute drift and returns `null` for score, confidence, implementation, routes, or other code evidence that was not observed. Use `--drift cache` or `--drift fresh` when that evidence is required. `--com-drift` remains a temporary alias for `--drift fresh`.
- When a query explicitly runs drift, `payload.analiseDrift.sucesso` exposes the result and a failed requested analysis returns a nonzero exit code.
- The value aliases `off`, `auto`, and `refresh` normalize to `none`, `cache`, and `fresh` for one compatibility release and emit a structured deprecation warning. Wrong flags, repeated flags, conflicts, and invalid values fail instead of falling back silently.
- Persistent cache objects live outside the workspace under the operating system's user-cache directory. Workspace identity is hashed; public JSON and events expose only an opaque key and `$SEMA_CACHE/...` paths. Corruption or cache unavailability becomes a miss and never changes the drift result. Only validated extraction data is reused; links, diagnostics, scores, and the final success decision are recalculated.

A cache hit is acceleration, not final evidence; closure still requires fresh drift.

## Sema Code

- `sema compilar <arquivo-ou-pasta> --alvo <typescript|python|php|dart|lua|javascript|html|css|dotnet|cpp> --saida <diretorio>`: generates starter/support artifacts from the contract.
- `sema testar <arquivo.sema> --alvo <alvo> --saida <diretorio-temporario>`: generates and runs local tests when the target supports it.
- `sema importar <fonte> <diretorio> --saida <diretorio> --json`: imports a legacy project into initial contracts.
- `sema renomear-semantico <arquivo-ou-pasta> --de <nome> --para <nome> --json`: helps rename symbols semantically.

Rule for `--saida`: the folder passed to `sema compilar --saida` is generated output. It is not the final delivery by itself. The final delivery is the target files/links declared by the contract. If the contract asks for `index.html`, `css/styles.css`, and `js/app.js`, creating only `saida/expense_control.ts` does not complete the task.

Sema Code traceability rule: generated artifacts must point back to the source module/contract and preserve that the same final file may be governed by several `.sema` contracts through `vinculos`. Do not force a 1:1 contract-file relationship and do not treat `saida/` as the final project.

Ready UI rule: if the task generates an app, site, dashboard, form, or static HTML, run desktop/mobile visual validation when the surface allows it. On narrow mobile (for example 390px), `scrollWidth <= clientWidth` must pass; a layout that stacks but overflows horizontally is not responsive.

## Canonical Syntax Lists

- Origins for `use` and `impl`: `ts/typescript`, `js/javascript`, `py/python`, `dart`, `lua`, `cs/dotnet`, `java`, `go`, `rust`, `cpp`.
- Frequent `effects` categories: `persistencia`, `consulta`, `evento`, `auditoria`, `db.write`, `queue.publish`, `fs.write`, `network.egress`, `secret.read`, `shell.exec`.
- Accepted `audit.motivo` values: `obrigatorio`, `opcional`, `dispensado`.

`sema compilar --alvo javascript` is a generation target. `impl { js: ... }` is the live-code origin. Do not swap one for the other.

## Codex and Context

- `sema ajuda-ia`: short guidance for Codex.
- `sema starter-ia`: operational starter.
- `sema contexto-ia <arquivo.sema> --saida <dir> --json`: AI context package.
- `sema resumo <arquivo-ou-pasta> [--drift <none|cache|fresh>] --json`: compact context; drift is not executed unless requested.
- `sema prompt-curto <arquivo-ou-pasta> --json`: compact prompt.
- `sema sync-codex --json`: synchronizes the official Codex entrypoint and local support docs.
- `sema instalar-exemplos --json`: installs official examples in the workspace.
- `sema exemplos-prompt-ia`: shows prompt examples, not `.sema` examples.

## Profiles and Author

- `sema author iniciar|validar|briefing|revisar-cliches|validar-narrativa|validar-proibicoes`: governs authorial writing.
- `sema profile validar <software|workflow|ops|game|simulation|legal|research|redacao|propostas|conversas> <arquivo> --json`: validates an artifact by profile.
- `sema profile capabilities --json`: lists profiles/capabilities.
- `sema rule-packs --profile <profile> --json`: lists rule packs.

`author` is a specialized `sema author` workflow, not a `profile validar` alias. Discovery exposes that distinction explicitly.

## AI-native Content Pipeline

- `sema conteudo capabilities --json`: lists generic producer, evaluator, and adapter capabilities without fixing a platform.
- `sema conteudo validar <definition.json> --json`: validates the content DAG, gates, and open adapters.
- `sema conteudo planejar <definition.json> --alvos-arquivo <targets.json> --json`: creates a declarative multi-target plan for an external runner.
- `sema conteudo validar-envelope --envelope-arquivo <envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --payload-type <type> --json`: verifies Ed25519 identity, authorization, freshness, scope, and the separately pinned trust root and current revocation overlay.
- `sema conteudo registrar <ledger.ndjson> --envelope-arquivo <envelope.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-id <id> --expected-head <sha256:...> --json`: appends a verified envelope under the signed run policy to the local replay ledger at an externally retained head.
- `sema conteudo status <definition.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-arquivo <ledger.ndjson> --expected-head <sha256:...> --json`: verifies the signed policy and its `targetSetDigest`, then derives verdicts, operational conditions, completion, and next actions from canonical events.
- `sema conteudo projetar <definition.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-arquivo <ledger.ndjson> --expected-head <sha256:...> --saida <manifest.json> --json`: regenerates a non-authoritative manifest bound to the ledger head.

The content command is an AI-native, multi-channel, multi-format control plane. It never runs producers, evaluators, creative tools, or publication adapters; those belong to an external runner. It has no native human-review transition. A signed policy binds `runId`, definition, ledger, trust root, gates, complete target set, and the full `issuedAt`/`expiresAt` authorization window; no event may be recorded outside it. Stages select `adapterPolicy` as `NONE`, `CONSTRAINTS`, or `CONFIRMATION`; definition v1 accepts one output per stage. Constraint results must come from independent signed observations, including independently observed media type, not artifact metadata or executor claims. Target metadata is an exact scalar allowlist from `requiredMetadata + optionalMetadata`; `accountScope` is a credential-free `account:<alias>` reference, and artifact metadata is prohibited in v1. Deterministic evidence and AI opinions have separate quorum fields. Evidence requires an exact `content.evidence.attest:<evidenceType>` capability; adapter evidence requires `content.adapter.attest:<adapterId>@<version>:<evidenceType>` plus signed adapter binding.

Verdicts such as `APROVADO`, `REPROVADO`, and `INCONCLUSIVO` remain separate from operational conditions such as `AGUARDANDO_EVENTO_EXTERNO` and `FERRAMENTA_INDISPONIVEL`. A generated manifest is only a projection and cannot alter canonical state.

Local NDJSON plus a hash chain is portable evidence for replay, not a strong append-only trust boundary. Retain `expectedHead`, the canonical trust-root digest, and the current revocation digest externally, or use protected storage for high assurance. The trust-root pin identifies the authority snapshot independently from the revocation overlay. A workspace-local trust file additionally requires `--development-local-trust`; the flag does not disable digest pinning. Append freshness uses the platform clock rather than caller-provided `recordedAt`, and an authority in the current revocation overlay cannot sign an accepted policy.

## AI-native Interactive Systems

- `sema interativo capabilities --json`: lists the canonical interactive capability vocabulary.
- `sema interativo schema --json`: exposes the stable read-only definition schema, enum matrix, constraints, extension-command and data-schema shapes, plus canonical example paths for AI clients.
- `sema interativo pipelines --json`: lists reusable game, simulation, and hybrid pipelines.
- `sema interativo adapters [--spatial-model <NON_SPATIAL|TWO_D|TWO_POINT_FIVE_D|THREE_D>] [--render-mode <HEADLESS|TEXT|VISUAL|XR>] --json`: lists compatible external adapter descriptors.
- `sema interativo validar <definition.json> --json`: validates independent kind, spatial model, render mode, visual profile, fidelity, control, time, world, budget, pipeline, and acceptance axes.
- `sema interativo planejar <definition.json> --json`: expands compatible stages and required evidence without running an engine.
- `sema interativo validar-evidencias|status <definition.json> [--plano-arquivo <plan.json>] --bundle-arquivo <bundle.json> --json`: validates a portable evidence bundle or derives non-authoritative status; `--evidencias-arquivo` is an alias and an omitted plan is recomputed deterministically.
- `sema interativo validar-protocolo <adapter-run.json> --json`: checks DETECT/PROBE/SNAPSHOT/PLAN/APPLY/VALIDATE/EVIDENCE/ROLLBACK ordering and stable target binding.
- Experience IR: `validar-ir`, `indexar-ir`, `consultar-ir --semantic-id <id>`, `chunk-ir --semantic-id <id> [--raso]`, and `descrever-ir`.
- Operational state: `validar-engine-snapshot`, `diff-engine-snapshots`, `validar-asset-provenance`, `validar-editor-state`, `planejar-jobs`, `validar-acceptance`, `operar-acceptance --operation <VALIDATE|EVALUATE|INVALIDATE> --context-file <file>`, and `validar-multimodal`.
- Temporal, autonomy, and testing: `validar-temporal`, `validar-evidencia-temporal --bundle-arquivo <file>`, `validar-autonomia`, `validar-playtest-fuzz`, and `validar-multiplayer`.
- Portability and workers: `analisar-portabilidade` and `validar-workers`.
- `sema interativo validar-control-run <control-run.json> --definition-arquivo <definition.json> --plano-arquivo <plan.json> --contrato-arquivo <validation-contract.json> --entrada-arquivo <input.json> [--entrada-auxiliar-arquivo <supporting-input.json>] --evidencia-arquivo <evidence.json> --resultado-arquivo <result.json> --json`: binds one advanced validation to its complete local digest chain instead of trusting a standalone result.

The control-run command recomputes the canonical plan and selected pure validator, then verifies the definition, pipeline descriptor, validation contract, schema-declared inputs, evidence, and result digests. Prefix advanced items with `sema interativo` and pass the documented JSON file as the positional argument; an agent does not have to infer the validator or payload shape from a filename or visual style. The machine-readable schema publishes command maps, input/output schema links, required top-level fields, `outputTargets` path segments from the payload root, at least one real output shape per command, and official fixtures for all 20 advanced commands. Validation-result shapes describe `payload.resultado`; projected IR values use `indice`, `entry`, `chunk`, or `descriptor`; operation projections such as `engineDiff` and `jobOrchestrationPlan` live under `payload.resultado.value`; the job plan's ordered `queue` is the assignment list and exposes kind, priority, adapter, dependencies, locks, budgets, heartbeat, checkpoint, and recovery data.

Spatial model and render mode are orthogonal: `THREE_D + HEADLESS` is valid, while XR requires `THREE_D`. `PIXEL_8_BIT` and `PIXEL_16_BIT` are independent visual profiles available to games and simulations. Every command above rejects unknown, duplicate, missing-value, or invalid-enum arguments, remains local, read-only, and non-authoritative, and leaves engine/editor execution, authorization, mutation, rollback, migration, rendering, playtest, and worker scheduling to external runners. Full local coverage is `STRUCTURALLY_COMPLETE`, never authoritative completion, and a local evidence bundle is never presented as authoritative trust.

## Operational

- `sema doctor`: diagnoses local installation.

## Forbidden

- Do not use an external workspace source to inspect a local workspace when `sema --version` or the managed launcher works.
- Do not search the entire disk for `.sema` syntax; use `exemplos/`, `docs/syntax.md`, and this catalog.
- Do not stop after `sema compilar` if the contract target files still do not exist.
- Do not replace `sema compilar` with `sema testar` when the contract requires generated code.
- Do not create a Markdown report to pretend a gate ran.
- Do not say drift passed when the unwrapped `sema drift --cache fresh --json` payload returned `sucesso:false`, a non-empty `vinculos_quebrados`, `rotas_divergentes`, or `impls_quebrados` list.
- Do not declare a UI responsive without mobile/desktop proof; horizontal scroll at 390px blocks closure.

Governed code policy: keep the `SEMA-GOVERNED` marker, split large code by real responsibility, preserve contract links, and never treat a generated output directory as the final delivery.
<!-- sema:agent-entrypoint:end -->
