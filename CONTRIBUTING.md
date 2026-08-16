# Contributing To Sema

Sema is a public Codex-native local CLI project for semantic governance in
AI-assisted software work. Contributions should keep the repository
local-first, contract-first, and safe to publish.

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
sema resumo --drift none
sema docs-impacto --intencao "describe the change" --json
sema inspecionar contratos/sema/software.sema --drift none --json
sema drift contratos/sema/software.sema --escopo modulo --cache fresh --json
```

`resumo` and `inspecionar` default to `--drift none`; in that mode,
`analiseDrift` records that drift was not executed and drift-derived evidence is
`null`, not zero or passing. Direct `drift` defaults to `--cache fresh`. Its
persistent cache is non-authoritative and external to the workspace. See
[Drift Cache And Query Evidence](./docs/drift-cache.md) for all modes and cache
locations.

Do not add login, user-authorization, activation, license, token, credit,
billing, or panel gates to local CLI execution. `AGENTS.md` is the official
Codex entrypoint for Sema-governed repositories. The official Sema skill only
bootstraps projects before that file exists; do not duplicate the governed
workflow or add an MCP server to the plugin.

## Quality Rules

- Keep `.sema` contracts aligned with implementation files.
- Do not publish credentials, environment files, private data, or generated
  private artifacts.
- Do not add public docs in Portuguese unless the project explicitly changes
  its public documentation language policy.
- Add focused tests when behavior changes.
- Run `npm run plugin:testar-codex` when the marketplace, plugin manifest, skill,
  or first-contact flow changes.
- Update [STATUS.md](./STATUS.md) when the real public state changes.

## Commercial Boundary

Sema is public source, but commercial resale and commercial replication require
written permission from OtimiTare. Support goes to
[suporte@otimitare.online](mailto:suporte@otimitare.online).
