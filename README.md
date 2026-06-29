# Sema

<p align="center">
  <img src="./logo.png" alt="Sema logo" width="240">
</p>

Sema is a local-first semantic governance CLI for AI-assisted software work.
It gives agents a contract-first workflow before they edit code, operational
docs, generated artifacts, or other governed project files.

This public repository is intentionally scoped to the local CLI experience.
It does not publish private or sensitive operational material.

Official support: [suporte@otimitare.online](mailto:suporte@otimitare.online)

## What Sema Does

Sema uses `.sema` contracts to describe modules, tasks, inputs, outputs, rules,
guarantees, effects, links to implementation files, and validation expectations.
The CLI helps an agent answer practical questions before touching a project:

- which contract applies to the change;
- which files are probably affected;
- whether code and contract have semantic drift;
- which documentation must be read or updated;
- what impact the proposed change has;
- whether a contract can generate starter code or tests.

Sema does not replace human approval, platform policy, security review, or legal
judgment. It is a local governance layer for scope, evidence, drift, and quality.

## Install

```bash
npm install -g @semacode/cli
```

Requirements:

- Node.js 20 or newer;
- a local project folder;
- at least one `.sema` contract before implementation work.

## Local Workflow

Use the CLI from the project root:

```bash
sema --version
sema preflight resumo --json
sema resumo
sema docs-impacto --intencao "describe the change" --json
sema inspecionar contratos/sema/software.sema --json
sema drift contratos/sema/software.sema --escopo modulo --json
sema impacto contratos/sema/software.sema --alvo app.software --mudanca "describe the change" --json
```

If a contract changes, validate it:

```bash
sema validar contratos/sema/software.sema --json
sema diagnosticos contratos/sema/software.sema --json
```

Before closing the change, prove the required docs were read:

```bash
sema finalizar-mudanca \
  --intencao "describe the change" \
  --doc-lida AGENTS.md \
  --doc-lida docs/documentation.md \
  --json
```

## Code Generation

Sema can generate starter artifacts from contracts:

```bash
sema compilar contratos/sema/software.sema \
  --alvo typescript \
  --saida .tmp/sema-generated \
  --estrutura modulos
```

Supported generation targets include TypeScript, JavaScript, Python, Dart, Lua,
HTML, and CSS. Generated code remains governed by the source `.sema` contract.

## Public Boundary

The public Sema CLI is local-only:

- local preflight runs without external service credentials;
- the public package ships without secrets or private operational state;
- docs should be written in English for public distribution.

If you are preparing a public release, keep private and sensitive material out
of the repository and out of generated packages.

## Commercial Use

Sema is public source, but it is not a free commercial resale asset. You may use,
study, modify, and share Sema under the license terms, but you may not resell it,
rebrand it as a competing product, offer it as a commercial replica, or bundle
it as a material paid feature without written permission from OtimiTare.

Commercial licensing questions go to [suporte@otimitare.online](mailto:suporte@otimitare.online).

## Useful Commands

```bash
sema ajuda-ia
sema starter-ia
sema prompt-curto contratos/sema/software.sema --json
sema contexto-ia contratos/sema/software.sema --saida .tmp/contexto --json
sema verificar contratos/sema/software.sema --saida .tmp/verificacao --json
```

## License

See [LICENSE](./LICENSE). The license allows public non-commercial use and
prohibits commercial resale or commercial replicas without written permission.
