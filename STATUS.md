# Sema Status

Sema is now a public, local-only CLI project. This repository intentionally
starts from a clean public history and is scoped to public CLI source,
contracts, examples, tests, installation scripts, and English documentation.

## Current Line

- Version: `1.5.53`
- Package: `@semacode/cli`
- Support: `suporte@otimitare.online`
- Public boundary: local CLI, local packages, contracts, examples, tests,
  installation scripts, and English documentation.
- License: public source with non-commercial terms; resale and commercial
  replication require written permission from OtimiTare.

## Validation Baseline

Before public publication, the local tree passed:

- `npm run build`
- `npm test`
- `npm run repo:verificar-publico`
- `npm run cli:empacotar-publica`
- `npm run cli:testar-pacote-publico`
- `node pacotes/cli/dist/index.js drift contratos/sema/fronteira_repositorios.sema --json`

## Maintenance Focus

- Keep the repository local-only and source-first.
- Keep public documentation in English.
- Keep support metadata pointed to `suporte@otimitare.online`.
- Keep commercial resale and commercial replication blocked unless OtimiTare
  grants written permission.
