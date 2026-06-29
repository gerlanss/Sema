# Contributing To Sema

Sema is a public local CLI project for semantic governance in AI-assisted
software work. Contributions should keep the repository local-first,
contract-first, and safe to publish.

## Before You Start

1. Read [README.md](./README.md).
2. Read [STATUS.md](./STATUS.md).
3. Run the local checks that match your change.
4. Keep public documentation in English.

## Local Flow

```bash
npm install
npm run build
npm test
npm run repo:verificar-publico
```

For governed changes, use the Sema CLI before editing behavior:

```bash
sema --version
sema preflight resumo --json
sema docs-impacto --intencao "describe the change" --json
sema inspecionar contratos/sema/software.sema --json
sema drift contratos/sema/software.sema --escopo modulo --json
```

## Quality Rules

- Keep `.sema` contracts aligned with implementation files.
- Do not publish credentials, environment files, private data, or generated
  private artifacts.
- Do not add public docs in Portuguese unless the project explicitly changes
  its public documentation language policy.
- Add focused tests when behavior changes.
- Update [STATUS.md](./STATUS.md) when the real public state changes.

## Commercial Boundary

Sema is public source, but commercial resale and commercial replication require
written permission from OtimiTare. Support goes to
[suporte@otimitare.online](mailto:suporte@otimitare.online).
