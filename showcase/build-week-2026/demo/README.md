# Sema Build Week 2026 Demo

This deterministic demo shows how Sema turns an AI code change into a
contracted, inspectable, and recoverable workflow.

The scenario is deliberately small and ends with the rename completed:

1. An isolated runtime contract and the code are reset to the original
   `approvePayment` baseline.
2. The contract guarantees that every approved payment has a `receipt_id`.
3. An incomplete agent refactor renames only the code symbol to
   `confirmPayment`.
4. `sema drift` reports the broken implementation and semantic link.
5. The contract binding is updated to `confirmPayment`; the code is not rolled
   back and the `receipt_id` guarantee is not deleted.
6. Tests, contract validation, drift, and governed closure all finish green.

The scripts always restore the canonical final state — contract and code both
bound to `confirmPayment` — including after a failed assertion. The controlled
contract mutation occurs only in ignored `.runtime`, so a recording never
leaves the tracked governing contracts red.

## Requirements

- Node.js 20 or newer
- The published Sema CLI, installed directly from npm

```bash
npm install -g @semacode/cli@2.0.1
sema --version
```

No repository dependency installation, TypeScript compilation, or local CLI
rebuild is required.

## Run the complete demo

From the repository root:

```bash
node showcase/build-week-2026/demo/demo.mjs
```

Expected final line:

```text
RESULT: VERIFIED
```

The final JSON evidence includes:

- `drift_detected: true`
- `broken_symbol: "approvePayment"`
- `final_symbol: "confirmPayment"`
- `receipt_guarantee_preserved: true`
- `tests_passed: true`
- `final_drift_clean: true`
- `closure_green: true`

## Judge smoke test

```bash
node showcase/build-week-2026/demo/smoke-test.mjs
```

The command exits with status `0` only if the expected red state was detected,
the contract stayed unchanged during that break, only the intended binding
changed during repair, the payment behavior passed, and the final Sema drift
was clean.

## Reset

The demo restores itself automatically. This explicit recovery command is also
available and is safe to run repeatedly; it restores `confirmPayment`, not the
obsolete symbol:

```bash
node showcase/build-week-2026/demo/reset.mjs
```

## Reproduce first contact in Codex

Create an isolated copy that intentionally contains neither `AGENTS.md` nor a
`.sema` contract:

```bash
node showcase/build-week-2026/demo/prepare-bootstrap.mjs
```

The command prints the absolute `workspace_path` below this demo's ignored
`.runtime` directory. Open that folder in a new Codex task, invoke `$sema` (or
run `sema iniciar --template base` followed by `sema sync-codex --json`), and
then open another new task so Codex loads the generated `AGENTS.md` protocol.

## Inspect the contract directly

```bash
sema validar contratos/sema/build_week_demo.sema --json
sema drift contratos/sema/build_week_demo.sema --escopo modulo --incluir-consumidores-laterais --json
node --test showcase/build-week-2026/demo/project/test/payment.test.mjs
```

The explicit consumer flag is required because Sema intentionally excludes
`showcase` and `demo` directories from normal project-wide drift scans. This
check opts into the exact lateral surface being judged.

The governing contract is
`contratos/sema/build_week_demo.sema`. Every executable demo file carries a
`SEMA-GOVERNED` header pointing back to it.
