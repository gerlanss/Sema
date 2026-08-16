# Repository Boundary

The public Sema repository should contain only the Codex-native local CLI, the
first-contact Codex skill, runtime packages, examples, tests that run locally,
and English documentation.

## Public

- local CLI source
- contract parser and validators
- local drift and impact tooling
- local code generators
- examples
- English docs
- local package scripts
- `AGENTS.md` as the official Codex entrypoint
- the official Sema skill as a thin bootstrap before `AGENTS.md` exists
- the managed absolute launcher and portable global skill bundled in npm
- the optional repo marketplace that exposes the same skill namespaced

## Not Public

- private or sensitive operational material
- real credentials, environment files, or secret inventories
- private project data or generated private artifacts
- runtime authorization, activation, billing, credit, token, or panel gates
- product-specific repository entrypoint files for AI clients other than Codex
- MCP servers, remote workspace bridges, or duplicated governance inside the
  bootstrap skill

The portable skill may be synchronized to the canonical user-level
`.agents/skills` directory and a detected Claude mirror. That does not change
the workspace boundary: Sema still generates only `AGENTS.md` as the official
repository protocol and never writes into plugin caches.

The repository has one npm package factory: `npm run cli:empacotar-publica`.
It assembles a private stage per execution and never materializes examples,
runtime dependencies, or skills inside `pacotes/cli`. Direct workspace packing
is intentionally blocked so a second, mutable packaging path cannot drift from
the public artifact.

The Windows distribution uses `sema.ps1` for PowerShell `PATH` resolution,
`sema.cmd` for `cmd.exe`, and `sema-managed.ps1` for the PATH-independent
fallback invoked through the absolute system `powershell.exe`; all remain
inside the managed `~/.sema/bin` boundary.

The CLI must run directly against the local workspace without login, user
authorization, a product-license check, activation key, credits, token, billing
service, or control panel.

Sema is an independent product and is not affiliated with or endorsed by
OpenAI. Codex-native is Sema's official product direction, not an official
OpenAI program or submission.

## Commercial Use

The public Sema source may not be copied, rebranded, bundled, or replicated for
commercial resale without written permission from OtimiTare.

Support: suporte@otimitare.online
