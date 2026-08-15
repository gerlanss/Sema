# Sema Status

Sema is a public Codex-native, local-first semantic governance layer for AI
agents. The CLI is the local engine; the official skill bootstraps projects
without Sema, and the generated `AGENTS.md` becomes the automatic workspace protocol afterward.
Codex is the first native integration and software is the first proving ground,
not the product boundary.

## Current Line

- Version: `2.3.3`
- Package: `@semacode/cli`
- Last updated: 2026-08-15
- Reference commit: `48f14ea`
- Support: `suporte@otimitare.online`
- Public boundary: local CLI, thin Codex bootstrap skill, repo marketplace,
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

- Keep the repository local-only and source-first.
- Keep the skill limited to first-contact bootstrap and delegate ongoing
  governance to `AGENTS.md`.
- Keep public documentation in English.
- Keep governance contracts split by named capability before they cross the
  semantic line budget; never use numbered part files.
- Keep product capabilities independent from competitions, event workflows,
  submission platforms, and one-off showcase harnesses.
- Keep support metadata pointed to `suporte@otimitare.online`.
- Keep commercial resale and commercial replication blocked unless OtimiTare
  grants written permission.
