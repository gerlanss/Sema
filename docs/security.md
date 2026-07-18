# Security

The public Sema repository must not contain private or sensitive operational
material.

Local Sema execution does not need a credential, login, activation key, license
token, billing token, or control-panel session. Do not introduce one as a
condition for reading or governing a local workspace.

The official Codex bootstrap skill contains instructions only. It must not
bundle an MCP server, app connector, remote workspace bridge, credential flow,
or a second copy of the repository governance that belongs in `AGENTS.md`.

Do not publish:

- real credentials or secret material;
- private data or internal operational artifacts.

Placeholder examples are allowed:

```bash
EXAMPLE_KEY=replace-me
```

If a real credential is exposed in code, docs, logs, screenshots, packages, or
Git history:

1. Rotate it immediately.
2. Remove it from the affected artifact.
3. Rebuild and rescan before publishing.

Official support: suporte@otimitare.online
