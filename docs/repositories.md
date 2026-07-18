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
- the repo marketplace that installs that skill explicitly

## Not Public

- private or sensitive operational material
- real credentials, environment files, or secret inventories
- private project data or generated private artifacts
- runtime authorization, activation, billing, credit, token, or panel gates
- product-specific entrypoint files for AI clients other than Codex
- MCP servers, remote workspace bridges, or duplicated governance inside the
  bootstrap skill

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
