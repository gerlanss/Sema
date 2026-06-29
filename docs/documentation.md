# Documentation Governance

Documentation is part of every governed change. An agent must use
`sema docs-impacto` before editing contracts, code, operational docs, workflows,
profiles, generated artifacts, or release material.

Public Sema documentation is English and local-only.

## Required Flow

```bash
sema docs-impacto --intencao "describe the change" --json
```

The result lists:

- `leituraObrigatoria`: files that must be read before the change;
- `docsAusentes`: missing docs that block the change;
- `docsCriadas`: generated draft docs that must be completed by the agent;
- `bloqueios`: blocking diagnostics.

Before closing the change, prove the required docs were read:

```bash
sema finalizar-mudanca \
  --intencao "describe the change" \
  --doc-lida README.md \
  --doc-lida docs/documentation.md \
  --json
```

## Public Docs Rules

- Write public docs in English.
- Keep commands, file paths, package names, environment variable names, and DSL
  keywords literal.
- Do not include private or sensitive operational material.
- Prefer local CLI examples.
- Point support requests to suporte@otimitare.online.
