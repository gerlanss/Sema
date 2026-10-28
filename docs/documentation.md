# Documentation Governance

Documentation is part of every governed change. Codex must use
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
- `docsCriadas`: generated draft docs that must be completed by Codex;
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
- Point support requests to suporte@otimitare.com.

## Contract Structure

Documentation governance is split by capability: required-document resolution
stays in `governanca_ia_documentacao.sema`, while localization and
change-finalization evidence live in explicitly named child contracts. The
same rule applies to drift and semantic-budget governance: keep a cohesive
primary capability in the root contract and move secondary responsibilities to
named children. Preserve task names, guarantees, implementations, and
`vinculos`; never create numbered part files.


## Progressive AI Context

The mandatory entry is AGENTS.md and SEMA_BOOT.md. SEMA_INDEX.json and
AGENT_CONTEXT_PACK.json are internal CLI sources, not required full readings.
The session asks for the effective context window when it is unknown. The local
`.sema/contexto-ia.json` profile is saved only by `--salvar-perfil` or by `iniciar`
with a declared window. Reconfigure it after switching models.

`sema sessao "<intent>" --janela-contexto 32768 --salvar-perfil --json`
configures a 32K window. Defaults allocate 4096 estimated tokens to the session
response and reserve 4096 for output. Other instructions, tools, conversation
and code need the remaining space. `--orcamento-contexto` and `--reserva-saida`
adjust this split. The characters/4 estimate includes the public envelope and
a margin; it is not an exact tokenizer or a measurement of the client's used
context. The limit applies to the session response, not every legacy command
or the cumulative conversation. The output reserve does not configure the model.

In docs-impacto and finalizar-mudanca, `--arquivo` fixes the target. Explicit
contracts are included even beyond the 80th catalog entry. Source files resolve
through `vinculos.arquivo`. Required expansion follows declared `use` dependencies,
with reasons and originating contracts. Missing or ambiguous dependencies block.
`docs.arquivo` references are recommendations and do not expand the dependency
graph. Intent suggestions stay in `leituraRecomendada`, distinct from
`leituraObrigatoria`, and do not block closure. Pass the same target at closure
and confirm the selected contracts before editing code.

The context-budget and docs-relevancia tests measure actual CLI output, prove
that the raw index is absent, verify hash invalidation and configuration before
writes, and cover WhatsApp alongside 85 unrelated contracts. Drift, contract
and behavioral gates remain required. To roll back, restore the prior generators
and resolvers and run sync-codex; preserve manual blocks and the local profile.
