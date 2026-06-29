# Sema CLI

Sema is now a local CLI distribution. The public package reads the workspace on
the user's machine, validates `.sema` contracts, checks drift, maps impact, and
generates code without requiring external service credentials.

Support: suporte@otimitare.online

## Install

```bash
npm install -g @semacode/cli
sema --version
```

For development inside this repository:

```bash
npm install
npm run build
node pacotes/cli/dist/index.js --help
```

## Required Local Flow

Agents and humans should use the same local sequence before changing governed
code, contracts, workflows, release scripts, or operational docs:

```bash
sema --version
sema preflight resumo --json
sema resumo
sema docs-impacto --intencao "describe the change" --json
sema inspecionar contratos/example.sema --json
sema drift contratos/example.sema --escopo modulo --json
sema impacto contratos/example.sema --alvo sema.example.target --mudanca "describe the change" --json
```

Continue only when `preflight` returns `decisao: "use_cli_local"`. The public
CLI preflight is an offline local gate; it does not check credits, install
keys, or call an external control surface.

## Core Commands

- `sema iniciar`: create a governed starting point.
- `sema validar`: validate `.sema` contracts.
- `sema inspecionar`: inspect the applicable contract surface.
- `sema drift`: compare contracts and implementation.
- `sema impacto`: map the blast radius of a planned change.
- `sema docs-impacto`: identify docs that must be read or updated.
- `sema finalizar-mudanca`: close the governed change with evidence.
- `sema compilar`: generate code from contracts.
- `sema verificar`: run the final local verification bundle.
- `sema contexto-ia`: build local AI context from a contract.

## Public Boundary

Do not publish private or sensitive operational material in public Sema
artifacts.
