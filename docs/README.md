# Sema Documentation

These docs describe the public local-first CLI distribution of Sema, proven with Claude, Codex, zCode (GLM) and Kimi.

Sema is local-first: Codex runs the CLI inside a project folder, reads `.sema`
contracts, checks drift, maps impact, and closes changes with documentation
evidence. In 3.0.0, valid commands using `--json` return the exact
`sema.cli.result/v1` envelope with command data nested under `payload`, while
help and command-control failures keep the separate `sema.cli.control/v1`
envelope. `AGENTS.md` is the official Codex entrypoint. Public docs are written
in English.

Sema is an independent product and is not affiliated with or endorsed by
OpenAI. Proven compatibility with Claude, Codex, zCode (GLM) and Kimi describes
Sema's product direction, not an official OpenAI program.

Start here:

- [CLI](./cli.md) — installation and the public JSON output contract
- [Commands](./commands.md) — command catalog and envelope-consumption rules
- [Drift Cache And Query Evidence](./drift-cache.md)
- [Syntax](./syntax.md)
- [Profiles](./profiles.md)
- [Capability Discovery](./descoberta-capacidades.md) — one explainable catalog
  for governance flows, profiles, specialized workflows, pipelines, generators,
  capability tokens, and adapters.
- [AI-native Interactive Systems](./sistemas-interativos.md) — declarative
  control plane for games, simulations, and hybrids across 3D, 2D, retro,
  text, XR, and headless execution.
- [AI-native Content Pipeline](./pipeline-conteudo.md) — signed-policy,
  multi-channel and multi-format orchestration for external AI runners, with
  canonical ledger replay and no native human-review path.
- [Documentation Governance](./documentation.md)
- [Repository Boundary](./repositories.md)
- [Security](./security.md)
- [Codex Integration](./ai-integration.md)

Official support: [suporte@otimitare.com](mailto:suporte@otimitare.com)
