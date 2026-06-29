# Security

The public Sema repository must not contain private or sensitive operational
material.

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
