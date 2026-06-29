# @semacode/cli

`@semacode/cli` is the public local CLI for Sema semantic governance.

It validates `.sema` contracts, checks semantic drift, maps impact, enforces
documentation gates, generates starter code, and prepares AI-first context for
agents working inside a local project folder.

Official support: [suporte@otimitare.online](mailto:suporte@otimitare.online)

## Install

```bash
npm install -g @semacode/cli
```

## First Run

```bash
sema --version
sema preflight resumo --json
sema resumo . --curto
```

Public Sema is local-only. The CLI does not require external service credentials,
does not install service keys, and does not contact external services during
`preflight`.

## Local Workflow

```bash
sema docs-impacto --intencao "describe the change" --arquivo contratos/app.sema --json
sema inspecionar contratos/app.sema --json
sema drift contratos/app.sema --escopo modulo --json
sema impacto contratos/app.sema --alvo app.modulo --mudanca "describe the change" --json
sema finalizar-mudanca --intencao "describe the change" --doc-lida README.md --json
```

If the project has no `.sema` contract, create one before implementing behavior:

```bash
sema iniciar --template base
```

## Code Generation

```bash
sema compilar contratos/app.sema --alvo typescript --saida .tmp/app-ts --estrutura modulos
sema compilar contratos/app.sema --alvo python --saida .tmp/app-py --estrutura modulos
```

Generated artifacts include `SEMA-GOVERNED` headers and must stay aligned with
the source contract.

## Validation

```bash
sema validar contratos/app.sema --json
sema diagnosticos contratos/app.sema --json
sema testar contratos/app.sema --alvo typescript --saida .tmp/app-tests
sema verificar contratos/app.sema --saida .tmp/app-check --json
```

## Public Boundary

The npm package is for local CLI usage only. It must not contain private or
sensitive operational material.

## Commercial Use

Sema is public source for local semantic governance, but commercial resale,
white-label redistribution, or commercial replicas require written permission
from OtimiTare.

## Support

Use [suporte@otimitare.online](mailto:suporte@otimitare.online) for support.
