# Sema Status

Sema is a public, local-first semantic governance layer for AI agents. The CLI is the local engine; the official skill bootstraps projects
without Sema, and the generated `AGENTS.md` becomes the automatic workspace protocol afterward.
Claude, Codex, zCode (GLM) and Kimi are proven integrations, and software is
the first proving ground, not the product boundary.

## Current Line

- Version: `3.13.0`
- Package: `@semacode/cli`
- Last updated: 2026-09-03
- Reference commit: `f92fb1f`
- Support: `suporte@otimitare.com`
- Public boundary: local CLI, absolute managed launcher, bundled global skill,
  optional repo marketplace,
  `AGENTS.md` protocol, contracts, examples, tests, release scripts, and English
  documentation, without competition-specific workflows or submission assets.
- License: public source with non-commercial terms; resale and commercial
  replication require written permission from OtimiTare.

## Release Gate

Every public publication must pass:

- `npm run build`
- `npm test`
- `npm run status:check`
- `npm run repo:verificar-publico`
- `npm run plugin:testar-codex`
- `npm run release:preparar-publica`
- `npm run release:verificar-drift`

## Maintenance Focus

- Keep `--help` and `-h` side-effect-free in every argv position, before
  operational runtime import, dispatch, handler resolution, workspace access,
  cache access, subprocesses, or network calls.
- Keep `sema.cli.control/v1` limited to JSON help and command-control failures.
  Every syntactically valid command invoked with `--json` must emit the exact
  eight-field `sema.cli.result/v1` envelope and keep its command result nested
  under `payload`; transport `ok` never replaces a domain verdict in the
  payload. Keep `--version` as plain exact SemVer text.
- Keep the repository local-only and source-first.
- Keep the skill limited to first-contact bootstrap and delegate ongoing
  governance to `AGENTS.md`.
- Keep the launcher independent from the npm and Node.js `PATH`, and atomically
  update only Sema-managed skill destinations outside plugin caches.
- Keep public documentation in English.
- Keep governance contracts split by named capability before they cross the
  semantic line budget; never use numbered part files.
- Plan focused drift before cataloging, share one in-memory source read across
  indexers, and reserve whole-project walks for explicit project scope.
- Keep `resumo` and `inspecionar` contract-only by default, with unobserved
  implementation evidence represented as `null`, never fabricated zeros.
- Keep drift cache non-authoritative, content-addressed, and outside the
  workspace; use fresh analysis for closure evidence.
- Keep product capabilities independent from competitions, event workflows,
  submission platforms, and one-off showcase harnesses.
- Keep support metadata pointed to `suporte@otimitare.com`.
- Keep commercial resale and commercial replication blocked unless OtimiTare
  grants written permission.
