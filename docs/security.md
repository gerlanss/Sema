# Security

The public Sema repository must not contain private or sensitive operational
material.

Local Sema execution does not need a credential, login, activation key, license
token, billing token, or control-panel session. Do not introduce one as a
condition for reading or governing a local workspace.

The official bootstrap skill contains instructions only. The global npm
postinstall may atomically update the managed launcher under `~/.sema/bin`, the
canonical copy under `~/.agents/skills/sema`, and a Claude mirror under
`~/.claude/skills/sema` when Claude is already detected. It must not scan the
home recursively, overwrite an unowned destination, follow symlinks or
junctions, write into a plugin cache, bundle an MCP server, add a credential
flow, or duplicate the repository governance that belongs in `AGENTS.md`.

Status output exposes symbolic paths such as `$HOME/.sema/bin/sema`,
`$HOME/.sema/bin/sema.ps1`, `$HOME/.sema/bin/sema.cmd`, and
`$HOME/.sema/bin/sema-managed.ps1`, never the real home, Node.js executable, or
package path. On Windows, PowerShell resolves `sema.ps1` from `PATH`, `cmd.exe`
resolves `sema.cmd`, and the fallback runs `sema-managed.ps1` through
`%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`. A managed receipt
detects isolated corruption of the launchers and companion; it is integrity
recovery, not authentication against a hostile process running as the same
user. Private absolute paths are not published in JSON or logs.

The public-package factory rejects pre-existing symlinks, junctions, and
reparse points in source, stage, and output chains and revalidates filesystem
identity around each path-based operation. This is fail-closed hardening, not a
native sandbox: Node.js does not expose cross-platform `openat`/`linkat`-style
operations anchored to directory handles, so a hostile process running as the
same operating-system user can still race a parent-path swap. Do not present
the private package stage as a security boundary against that attacker.

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

Official support: suporte@otimitare.com
