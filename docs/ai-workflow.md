<!-- sema:agent-entrypoint:start -->
# Practical Codex + Sema Workflow

This is the minimum workflow for Codex in a local workspace.

1. Read `SEMA_BOOT.md`.
2. Run `sema --version`. If the shell cannot find it, use `$HOME/.sema/bin/sema` on macOS/Linux. On Windows, PowerShell resolves `sema.ps1` from PATH and cmd.exe resolves `sema.cmd`; use `& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version` as the absolute fallback. Only then declare the CLI unavailable.
3. Run `sema resumo --drift none` for contract-only orientation; request `--drift cache` or `--drift fresh` only when code evidence is needed.
4. Run `sema docs-impacto --intencao "<change>" --json`.
5. Read every required document returned by the command.
6. Read `docs/commands.md` before selecting a command or interpreting `--saida`.
7. If the right capability is unclear, run `sema descobrir recomendar --intencao "<goal>" --json`; do not auto-run ambiguous recommendations.
8. Use `exemplos/` and `docs/syntax.md` before creating or editing a contract.
9. Run `sema drift --cache fresh` and `sema impacto` before editing existing code.
10. For a new module with a validated contract, scaffold with `sema compilar <contract> --alvo <default target>`, fill the real implementation keeping `impl`/`vinculos`, and close with `sema verificar`.
11. Run `sema formatar` and `sema validar` after changing a `.sema` contract.
12. Run `sema finalizar-mudanca` with the documents read before closure.

Contract edit rule: `.sema` has its own size budget. Above 300 lines, plan a split by domain/capability; above 500, do not create or edit before splitting. Do not use parte_1/parte_2 and do not force a 1:1 contract-to-file relationship; several contracts can govern the same file through `vinculos`.

Closing rule: the `payload` of `sema drift --cache fresh --json` must return `sucesso:true`. If it reports `sucesso:false`, `vinculos_quebrados`, `rotas_divergentes`, or `impls_quebrados`, the task is still blocked. Passing unit tests or a cache hit do not replace fresh green drift. In 3.0.0, `ok` describes the CLI result path and never replaces a command-specific domain verdict.

Focused drift rule: file and module scopes plan their physical file set before cataloging. They never fall back to a whole-project walk when no safe anchor exists. All indexers and semantic-budget checks reuse the same in-memory source read; a global walk is reserved for explicit `--escopo projeto`. Code discovery is deferred until that plan exists, homonymous candidates fail as ambiguous, and configured contract origins or code roots resolving outside the workspace are rejected before enumeration. `inspecionar`, `impacto`, and `renomear-semantico` preserve the same directed boundary. Missing unambiguous local dependencies make coverage partial and block success. In Python, an unresolved `name` from `from module import name` is not itself a missing file after `module` resolves: it may be an exported symbol, while a real child module is still included whenever its file exists.

Cache rule: a closure gate should use `sema drift <contrato> --escopo modulo --cache fresh --json`. `--cache none` executes the same analysis without persistent-cache I/O, while `--cache cache` may reuse only extraction data whose schema, workspace identity, Git HEAD, plan, configuration, contracts, member paths, and strong content digests all match. Cache objects are stored in the operating system's user-cache directory, never below the workspace. A hit is acceleration, not evidence: final links, diagnostics, score, and success are always recalculated. Corruption or an unavailable cache degrades to an in-memory calculation.

Query honesty rule: `resumo` and `inspecionar` default to `--drift none`. When analysis is skipped, score, confidence, implementation, routes, and other unobserved code claims inside the command payload must be `null` or explicitly marked not evaluated; zero is not a substitute for absent evidence.

UI rule: if the task involves an interface, minimum evidence includes desktop and mobile. On a narrow viewport such as 390px, `document.documentElement.scrollWidth <= document.documentElement.clientWidth` must pass; horizontal scroll blocks closure.

## Codex Context Capacity

- Small context: `SEMA_SMALL_MODEL.md`, `SEMA_BRIEF.micro.txt`, `AGENT_CONTEXT_PACK.json`, `SEMA_INDEX.json`.
- Medium context: `SEMA_BOOT.md`, `AGENT_CONTEXT_PACK.json`, `SEMA_BRIEF.curto.txt`, `SEMA_INDEX.json`, `AGENTS.md`.
- Large context: `SEMA_BOOT.md`, `AGENT_CONTEXT_PACK.json`, `SEMA_BRIEF.md`, `SEMA_INDEX.json`, AST, IR, drift, and impact.

## When to Generate Code

If the delivery includes code derived from a contract, run `sema compilar`.

```bash
sema compilar contratos/orders.sema --alvo javascript --saida ./generated/javascript
```

Replace `javascript` with `typescript`, `python`, `php`, `dart`, `lua`, `html`, `css`, `dotnet`, or `cpp` when appropriate.

## Fail Closed

- If the local CLI is unavailable, stop before editing governed code or contracts and ask for `@semacode/cli` installation.
- If the applicable contract or semantic link is missing, create or repair it before code.
- If validation or drift reports failure, broken links, divergent routes, or broken implementations, fix the evidence and run the gate again.
- A local timeout is not authorization to skip Sema; retry with a larger timeout or a narrower scope.
<!-- sema:agent-entrypoint:end -->
