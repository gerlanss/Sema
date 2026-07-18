# Sema CLI

Sema is a Codex-native local CLI distribution. The public package reads the
workspace on the user's machine, validates `.sema` contracts, checks drift,
maps impact, and generates code without login, user authorization, license
activation, tokens, credits, billing services, a control panel, or external
service credentials.

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

## Codex Setup

`AGENTS.md` is the official Sema entrypoint for Codex. Create or refresh it from
the local CLI:

```bash
sema sync-codex --json
```

Codex automatically loads `AGENTS.md` as repository guidance. Sema is an
independent product and is not affiliated with or endorsed by OpenAI.

## Required Local Flow

Codex and humans should use the same local sequence before changing governed
code, contracts, workflows, release scripts, or operational docs:

```bash
sema --version
sema resumo
sema docs-impacto --intencao "describe the change" --json
sema inspecionar contratos/example.sema --json
sema drift contratos/example.sema --escopo modulo --json
sema impacto contratos/example.sema --alvo sema.example.target --mudanca "describe the change" --json
```

Commands run directly against the local workspace. If `sema --version` fails,
install or repair the npm package; there is no separate authorization gate.

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
- `sema sync-codex`: create or refresh the official `AGENTS.md` entrypoint.

## Public Boundary

Do not publish private or sensitive operational material in public Sema
artifacts.
