# Teaching Sema To AI Agents

Give agents a short rule: contracts come first, and the local CLI is the source
of truth.

## Minimal Prompt

```text
This workspace is governed by Sema. Before editing code, contracts, docs,
workflows, profiles, or release scripts, run:

1. sema --version
2. sema preflight resumo --json
3. sema resumo
4. sema docs-impacto --intencao "<change>" --json
5. sema inspecionar on the applicable .sema contract
6. sema drift before editing existing code
7. sema impacto before changing behavior
8. sema finalizar-mudanca before closing

If the CLI is unavailable or preflight does not return use_cli_local, stop.
Do not replace Sema with manual search or guessed contracts.
```

## What Agents Should Not Do

- Do not invent `.sema` contracts.
- Do not implement code without an applicable contract.
- Do not ignore severity 4+ warnings.
- Do not publish private or sensitive operational material.
- Do not replace the local CLI when the local workspace is available.

Support: suporte@otimitare.online
