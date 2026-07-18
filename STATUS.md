# Sema Status

Sema is a public Codex-native, local-first project. The CLI is the local engine,
the official skill bootstraps projects that do not have Sema yet, and the
generated `AGENTS.md` becomes the automatic workspace protocol afterward.

## Current Line

- Version: `2.0.1`
- Package: `@semacode/cli`
- Last updated: 2026-07-17
- Reference commit: `f2501cb`
- Support: `suporte@otimitare.online`
- Public boundary: local CLI, thin Codex bootstrap skill, repo marketplace,
  `AGENTS.md` protocol, contracts, examples, tests, release scripts, and English
  documentation.
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
- Keep support metadata pointed to `suporte@otimitare.online`.
- Keep commercial resale and commercial replication blocked unless OtimiTare
  grants written permission.
