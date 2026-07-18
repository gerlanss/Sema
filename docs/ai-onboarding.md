# Codex Onboarding

The official Sema skill is required for Codex to recognize and initialize Sema
before a project has its own protocol:

```bash
codex plugin marketplace add gerlanss/Sema
codex plugin add sema@sema
```

Open a new Codex task in the target repository after installation. Codex loads
the plugin/skill catalog at task start, so `$sema` is not added retroactively to
an already-open task. Invoke `$sema` in the new task; it bootstraps the project,
reads the generated `AGENTS.md`, and later tasks load that protocol
automatically.

`AGENTS.md` is the official Sema entrypoint for Codex. It gives Codex the durable
repository rule that contracts come first and the local CLI is the source of
truth. Once the file exists, the skill delegates to it instead of carrying a
second copy of the governed workflow.

Create or refresh the entrypoint with:

```bash
sema sync-codex --json
```

## Minimal Prompt

```text
This workspace is governed by Sema. Before editing code, contracts, docs,
workflows, profiles, or release scripts, run:

1. sema --version
2. sema resumo
3. sema docs-impacto --intencao "<change>" --json
4. sema inspecionar on the applicable .sema contract
5. sema drift before editing existing code
6. sema impacto before changing behavior
7. sema finalizar-mudanca before closing

If the CLI is unavailable, stop and install or repair @semacode/cli. There is
no separate Sema login, license activation, or authorization gate. Do not
replace Sema with manual search or guessed contracts.
```

## What Codex Should Not Do

- Do not invent `.sema` contracts.
- Do not implement code without an applicable contract.
- Do not ignore severity 4+ warnings.
- Do not publish private or sensitive operational material.
- Do not replace the local CLI when the local workspace is available.

Other AI clients can invoke the public CLI manually, but Sema does not ship or
manage an official repository entrypoint for them. The supported product path
is Codex plus `AGENTS.md`.

Sema is an independent product and is not affiliated with or endorsed by
OpenAI.

Support: suporte@otimitare.online
