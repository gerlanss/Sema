# Sema distribution

Read only for installation, updates or repair. Never treat a request to install, update, or repair the global distribution as permission to adopt the current workspace.

## Install or update globally

1. Accept an exact SemVer, or resolve an omitted version / `latest` once:
   `npm view @semacode/cli@latest version --json`.
   Require one exact SemVer JSON string; stop on failure, range or malformed
   output. Freeze that version before installing:
   `npm install --global @semacode/cli@<resolved-exact-semver>`.
   Substitute the validated version; never pass the placeholder literally.
2. Run that `npm install --global` even when an older `sema --version` already
   works. Synchronizing a skill does not upgrade the package.
3. Probe both CLI candidates below. Require the selected candidate to report
   the exact installed version and support the skill status command.
4. Run `sema skill status --json`. If a managed component is not `READY`, run
   `sema skill sync --json`, then status again. Require the final `READY`
   state and version match; npm exit code alone is insufficient proof.
5. Report the installed version. Existing chats may need a skill reload or
   a new chat. Do not initialize a workspace unless adoption was also requested.

## Resolve the CLI and its results

Probe `sema --version` and `sema skill status --json` from the workspace root.
Also probe the PATH-independent fallback with the same two arguments.
Windows PowerShell fallback:

```powershell
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version
```

On macOS/Linux: `"$HOME/.sema/bin/sema" --version`.
Windows PATH uses `sema.ps1` in PowerShell and `sema.cmd` in cmd.exe. Do not
invoke the batch shim as the absolute PowerShell fallback.

If valid candidates disagree, prefer the managed candidate. Use it when PATH
is stale, fails, or does not support `sema skill status --json`. During an
update, any selected candidate must match the installed exact version.
Do not declare Sema unavailable until both candidates have failed validation.
If unavailable, stop before governed edits; install only within an authorized
global install/update request. Repair alone does not authorize a new version.

`--version` is plain SemVer. JSON help/control failures use the six-field
`sema.cli.control/v1` envelope. Valid commands use the eight-field
`sema.cli.result/v1`: schemaVersion, ok, kind, command, code, message, exitCode,
payload. Read domain state inside `payload`; `data` is not an alias and `ok`
does not replace `payload.sucesso` or another domain verdict.

## Repair without upgrading

Resolve the current CLI, inspect status, and synchronize only non-READY
managed components. Prove the result with status again. Repair may synchronize the current
launcher and skill, but must not run `npm install`, choose a new version or
mutate the workspace.

## Distribution boundaries

- `AGENTS.md` is the automatic, continuous workspace protocol for Codex.
  Compatible clients follow the same local protocol; do not duplicate it here.
- Launchers are managed at `~/.sema/bin`. The canonical skill is managed at
  `~/.agents/skills/sema`; the mirror at `~/.claude/skills/sema` is managed
  when Claude is detected. Client-specific copies require an explicit request
  and the client's supported discovery location; preserve unrelated skills.
- Never write into a host-managed plugin cache or overwrite an unmanaged or
  modified skill silently. Preserve files and stop on symlink/junction escapes.
- Do not introduce runtime access gates: no Sema login, activation key,
  license check, tokens, credits, billing or remote workspace mirror. This
  does not waive explicit human
  authorization for workspace adoption or overwrite.
