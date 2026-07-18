# Sema Judge Guide — OpenAI Build Week 2026

This guide provides a published-artifact test path for Sema. It does not require
building Sema from source, creating a Sema account, or supplying an OpenAI API
key to the Sema runtime.

## What to evaluate

The administrative category is **Developer Tools**, but the product claim is
broader:

> Sema is the semantic governance layer between human intent and verified AI
> execution. Codex is its first native integration; software is its first
> proving ground.

You tell Codex what you want. Instead of rediscovering the repository from
scratch, Codex asks Sema for a living semantic map of the applicable contract,
guarantees, documentation, and implementation links. Codex follows that map to
the relevant code; Sema then verifies whether the result still fulfills the
contract.

The fastest useful evaluation is not “how many commands exist?” It is whether a
new project can acquire a durable agent protocol, expose its semantic risks, map
the impact of a proposed change, and produce verifiable artifacts without a
hosted Sema control plane.

## Verified environment and honest platform support

The Build Week release was directly verified in this environment:

| Component | Verified value |
| --- | --- |
| Operating system | Microsoft Windows 11 Pro, build `26200` |
| Node.js | `v22.17.1` |
| npm | `11.6.0` |
| Codex CLI | `0.137.0` |
| Sema CLI | `2.0.1` |

The npm package declares **Node.js 20 or newer** as its runtime floor. The core
CLI uses Node.js and is designed to be portable, but this submission currently
certifies Windows 11 only. macOS and Linux have not yet received equivalent
Build Week release evidence, so they are not claimed as verified platforms.

The Codex bootstrap additionally requires a current Codex surface with plugin
marketplace support. The CLI-only fallback below still exercises the local
engine and generates the same `AGENTS.md` protocol if plugin installation is not
available in the judge's environment.

## One-command deterministic demo (recommended)

This is the fastest proof of the complete red-to-green governance cycle. From a
clone of the public repository, install only the published CLI and run the
versioned harness:

```bash
npm install --global @semacode/cli@2.0.1
node showcase/build-week-2026/demo/demo.mjs
```

No repository dependency installation, TypeScript compilation, or local Sema
build is required. The scenario:

1. proves the healthy `approvePayment` implementation and contract agree;
2. applies an incomplete implementation-only rename to `confirmPayment`;
3. requires `sema drift` to detect the broken `approvePayment` link;
4. proves the contract's `receipt_id` guarantee was not removed to make the
   finding disappear;
5. completes the rename so contract and implementation converge on
   `confirmPayment`, then requires behavior tests, contract validation, final
   drift, and documentary closure to finish green;
6. restores the canonical final `confirmPayment` state even if an assertion
   fails.

The expected final line is:

```text
RESULT: VERIFIED
```

The final JSON evidence includes:

```text
drift_detected: true
broken_symbol: "approvePayment"
final_symbol: "confirmPayment"
receipt_guarantee_preserved: true
tests_passed: true
final_drift_clean: true
closure_green: true
```

For an automated pass/fail check, run:

```bash
node showcase/build-week-2026/demo/smoke-test.mjs
```

It exits with status `0` only when the intended red state was detected and the
repaired state is fully green. The harness restores itself automatically; an
explicit idempotent reset is also available:

```bash
node showcase/build-week-2026/demo/reset.mjs
```

To inspect the tracked showcase contract directly, opt into lateral consumers:

```bash
sema validar contratos/sema/build_week_demo.sema --json
sema drift contratos/sema/build_week_demo.sema --escopo modulo --incluir-consumidores-laterais --json
```

Sema excludes `showcase` and `demo` directories from ordinary project-wide
drift scans, so the explicit consumer flag is required for this judge surface.

## Five-minute published-artifact test

### 1. Install the public CLI and plugin

```bash
npm install --global @semacode/cli@2.0.1
codex plugin marketplace add gerlanss/Sema
codex plugin add sema@sema
```

Confirm the package:

```bash
sema --version
```

Expected result:

```text
2.0.1
```

No Sema source build is involved. Network access is needed for npm and
marketplace installation; normal Sema commands then operate on the local
workspace.

### 2. Create a disposable project

Create and enter an empty folder, then open a **new Codex task** in that folder.
Plugin and skill catalogs are loaded when a task starts, so an already-open task
will not acquire the newly installed Sema skill retroactively.

Ask Codex:

```text
$sema Initialize Sema in this project with the base template. Preserve any
existing files and prepare the AGENTS.md protocol.
```

The expected flow is:

1. the skill checks `sema --version`;
2. the CLI runs `sema iniciar --template base`;
3. the CLI generates `AGENTS.md`, `SEMA_BOOT.md`, the Agent Context Pack,
   `SEMA_INDEX.json`, public workflow docs, examples, and
   `contratos/pedidos.sema`;
4. the skill reads the generated protocol and delegates future governance to
   the project itself.

Initialization preserves existing files by default. It never selects `--force`
on the user's behalf.

### 3. Exercise the local governance engine

From the disposable project folder, run:

```bash
sema validar contratos/pedidos.sema --json
sema resumo contratos/pedidos.sema --micro --json
sema impacto contratos/pedidos.sema --alvo app.pedidos.criar_pedido --mudanca "add a required currency field" --json
sema compilar contratos/pedidos.sema --alvo javascript --saida generated/javascript --estrutura modulos
```

On the verified `2.0.1` release:

- validation returns `"valido": true` and keeps explicit security and
  traceability warnings visible;
- the summary identifies module `app.pedidos`, route `POST /pedidos`,
  persistence and audit effects, operational risk, and missing evidence;
- impact analysis identifies `app.pedidos.criar_pedido` and the public route as
  affected before any edit occurs;
- compilation creates:
  - `generated/javascript/app/pedidos.js`
  - `generated/javascript/app/pedidos.test.js`

The warnings in the base example are intentional evaluation signals. Sema is
showing that a syntactically valid public operation can still lack explicit
authorization, data classification, audit, execution, and implementation links.
It does not convert “valid syntax” into a dishonest claim that production
governance is complete.

### 4. Verify the persistent Codex handshake

Open another new Codex task in the initialized folder and ask:

```text
Before editing anything, use this repository's protocol to explain what must be
inspected and which Sema gates apply if criar_pedido gains a required currency
field. Do not edit yet.
```

The important behavior is that Codex discovers the workflow from `AGENTS.md`
and the local project, without invoking the bootstrap skill as a permanent
second governance system. It should inspect the applicable contract and map
impact before proposing implementation work.

## CLI-only fallback

If the judge's Codex environment cannot install marketplace plugins, the same
project handshake can be created directly:

```bash
mkdir sema-judge-demo
cd sema-judge-demo
sema iniciar --template base
sema sync-codex --json
```

Then run the commands in step 3 and open a new Codex task in the folder. This
fallback tests the engine and durable `AGENTS.md` protocol; it omits only the
first-contact skill discovery step.

## What each judging criterion can be verified against

The official Stage Two criteria are equally weighted.

| Criterion | Direct evidence |
| --- | --- |
| Technological Implementation | Published CLI, installable Codex plugin, real `.sema` parser and gates, safe initialization, isolated package/marketplace checks, generated artifacts. |
| Design | Thin first-contact skill, automatic repository protocol, compact summaries, structured JSON, explicit next actions, visible warnings instead of cosmetic success. |
| Potential Impact | Immediate developer workflow plus a reusable contract model already exposed through ten domain profiles with stated limitations. |
| Quality of the Idea | Governance of agent conclusions through intent, impact, drift, and evidence as executable primitives rather than a larger prompt or generic orchestration layer. |

## Operational boundaries

- Sema runs locally and reads only the workspace it is asked to govern.
- No Sema login, activation key, product-license check, token, credit balance,
  billing service, hosted panel, or remote workspace mirror is required.
- The plugin installs a skill, not a Sema MCP server.
- The repository license permits free personal, educational, research, internal
  business, and non-commercial evaluation while restricting commercial resale
  and commercial replicas without written permission.
- Sema does not bypass Codex/OpenAI policies, operating-system permissions,
  repository authorization, security review, or human approval.
- Sema is an independent OtimiTare product and is not affiliated with or
  endorsed by OpenAI.

## Troubleshooting

**The Sema skill does not appear after installation**

Open a new Codex task or restart the Codex surface. Plugin catalogs are resolved
at task start.

**`sema` is not found after npm installation on Windows**

Open a new terminal and confirm npm's global binary directory is present in the
user `PATH`.

**The project already contains Sema**

Do not reinitialize it. Run:

```bash
sema --version
sema sync-codex --json
sema resumo
```

**A validation command returns warnings**

Read them as governance findings. A warning is not silently discarded simply
because the contract parses. Findings with the project-defined blocking
severity must be resolved or explicitly justified before closure.

## Links

- [Repository](https://github.com/gerlanss/Sema)
- [Published npm package](https://www.npmjs.com/package/@semacode/cli)
- [Submission copy](./submission.md)
- [Pre-existing versus new work](./new-work.md)
- [Official challenge rules](https://openai.devpost.com/rules)
