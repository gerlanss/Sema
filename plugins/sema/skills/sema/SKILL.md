---
name: sema
description: Required Sema bootstrap for Codex and compatible coding agents when a local project does not yet contain its generated AGENTS.md protocol. Use when the user asks to install, update, repair, introduce, initialize, or adopt Sema, or mentions Sema in a workspace without that protocol. Treat global install or update, distribution repair, informational use, and explicit workspace adoption as separate intents; never infer adoption from distribution work. Resolve the managed PATH-independent launcher before declaring the CLI unavailable; after AGENTS.md exists, read it and delegate project governance to it and the local CLI.
---

# Sema Bootstrap

This skill is required for the first contact, before a project can explain Sema
to Codex through `AGENTS.md`. It does not replace or duplicate workspace
governance.

## Classify the request

Separate these intents before running a command:

- **Install or update the global distribution**: install a requested exact
  version, or `latest` when no version is specified. This changes the global
  package, launcher, and managed skill only.
- **Repair the current distribution**: diagnose and synchronize the launcher
  and managed skill without selecting or installing another package version.
- **Adopt the current workspace**: introduce Sema governance into this project.
  Require an explicit request to introduce, initialize, or adopt Sema here.
- **Informational use**: explain or inspect without initializing the workspace.

Never treat a request to install, update, or repair the global CLI or skill as
permission to adopt the current workspace. If a request explicitly asks for
both distribution work and workspace adoption, execute them as two distinct
authorized intents. If wording such as "install Sema in this project" leaves
the workspace scope ambiguous, ask one scoped question before mutating the
workspace.

## Install or update the global distribution

When the user explicitly requests a global install or update:

1. Accept only an exact SemVer requested by the user or the literal `latest`.
   Treat an omitted version as `latest`. For `latest`, resolve the registry tag
   before installation:

   ```bash
   npm view @semacode/cli@latest version --json
   ```

   Require the result to be one JSON string containing an exact SemVer: no
   leading `v`, tag, range, whitespace, command syntax, or array. Stop if npm
   fails or the result is not an exact SemVer. For an exact user request, use
   that already-validated version. In both cases install only the resulting
   exact version; substitute it and never pass the placeholder literally:

   ```bash
   npm install --global @semacode/cli@<resolved-exact-semver>
   ```

2. Run that `npm install --global` even when an older `sema --version` already
   works. Never run `npm install ...@latest`; the mutable tag is resolved and
   frozen first. `sema skill sync` repairs files from the installed package; it
   does not install the version the user requested.

3. Probe both CLI candidates as described below. Require the selected candidate
   to report the exact installed version and support `sema skill status --json`.
   A stale command found through `PATH` must not hide a valid managed launcher.

4. Run `sema skill status --json`, validate its public result envelope, and
   unwrap `payload`. If any managed component in that command payload is not
   `READY`, run `sema skill sync --json`, validate and unwrap its result, then
   run status again. Require a final `READY` state; do not report a successful
   install or update from npm's exit code alone.

5. Stop without touching the current workspace unless workspace adoption was
   also requested explicitly. Report that an already-open agent may need the
   host's skill reload action or a new task to load changed skill files.

## Resolve the installed CLI

For install, repair, or workspace bootstrap, probe the regular command from the
project root:

```bash
sema --version
```

Also probe the PATH-independent managed fallback. On Windows PowerShell:

```powershell
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version
```

PowerShell resolves `sema.ps1` for a normal `sema` lookup; `cmd.exe` resolves
`sema.cmd`. Do not invoke the batch entrypoint with PowerShell's call operator
as the absolute fallback. `sema-managed.ps1` is the managed fallback.

On macOS or Linux:

```bash
"$HOME/.sema/bin/sema" --version
```

For each candidate, run `--version` and the read-only `skill status --json`
probe. During install or update, a candidate is valid only when its version
equals the exact version installed. During repair or bootstrap, if both are
valid but report different versions, prefer the managed candidate. Also prefer
the managed candidate when the regular command from `PATH` is stale, fails, or
does not support `sema skill status --json`. Use the selected invocation for
every remaining command.

Interpret Sema CLI output as follows:

- Treat `--version` as plain exact SemVer text, never as a JSON envelope.
- For help or a command-control failure with `--json`, accept only the exact
  six-field `sema.cli.control/v1` envelope.
- For every syntactically valid command with `--json`, accept only the exact
  eight-field `sema.cli.result/v1` envelope containing `schemaVersion`, `ok`,
  `kind`, `command`, `code`, `message`, `exitCode`, and `payload`.
- Unwrap `payload` before reading command-specific state. Do not accept `data`
  as an alias, do not read domain fields from the envelope top level, and do
  not treat transport `ok` as a replacement for `payload.sucesso` or another
  command-specific verdict.

Do not declare Sema unavailable until both candidates have failed validation.
Do not treat a missing npm shim, stale `PATH`, or an old command without the
`skill` subcommand as proof that Sema is absent.

If neither invocation works, stop. For a bootstrap request, ask the user to
authorize a global CLI install explicitly, then follow the install flow above:
resolve `latest` to an exact SemVer and install that immutable version. Do not
issue a direct install against the mutable `latest` tag.

For a repair-only request, explain that synchronization requires a working
installed CLI. Do not silently choose `latest` or another version as a repair.

## Repair the current distribution

When the user explicitly requests repair without an update, resolve the CLI by
probing both candidates above. Run `sema skill sync --json` only when the
selected candidate reports a managed component that is not `READY`, then prove
the result with a second status call. Repair may synchronize the current
launcher and skill, but must not run `npm install`, select another version, or
mutate the workspace.

## Follow or create workspace governance

1. If the project already has a generated Sema `AGENTS.md`, read it and
   `SEMA_BOOT.md`, then delegate project work to that protocol. Do not run
   `sema iniciar` or `sema sync-codex` merely because this skill was invoked or
   because global distribution work completed.

2. If the project has no Sema contract and no generated Sema `AGENTS.md`, do
   not treat invocation of this skill as permission to mutate the workspace:

   - for an informational request, answer without initializing Sema;
   - before implementing or changing the project, ask for explicit adoption
     authorization and stop until it is granted;
   - an explicit request to introduce, initialize, or adopt Sema in this
     project is that authorization;
   - global install, update, repair, or skill synchronization authorizes
     distribution changes only and must not initialize the current workspace.

3. After adoption is explicitly authorized, inspect the official adoption
   flow and then initialize the project:

   ```bash
   sema descobrir explicar flow.project-adoption --json
   sema iniciar --template base
   ```

   This command preserves existing project files. Never add `--force`
   automatically; an overwrite must be an explicit user decision.

4. Generate the official Codex handshake for the newly initialized or adopted
   workspace:

   ```bash
   sema sync-codex --json
   ```

5. Read the generated `AGENTS.md` and `SEMA_BOOT.md`. From this point onward,
   follow those workspace instructions and execute the local CLI directly.

## Boundary

- The CLI is the engine and source of truth.
- `AGENTS.md` is the automatic, continuous workspace protocol for Codex.
- The launchers are managed only at `~/.sema/bin`; on Windows, `sema.ps1` is
  the PowerShell PATH entrypoint, `sema.cmd` is the cmd.exe entrypoint, and
  `sema-managed.ps1` is the absolute fallback. The canonical skill copy is
  managed only at `~/.agents/skills/sema`; a Claude mirror is managed only at
  `~/.claude/skills/sema` when Claude is already detected.
- Never write into a host-managed plugin cache or create duplicate copies in
  every vendor-specific skill directory.
- This skill is mandatory while that protocol is absent.
- This skill only bridges the absence of that protocol during first contact.
- Bootstrap must preserve existing files and stop on symlink or junction
  escapes; it must never choose overwrite on the user's behalf.
- Do not introduce runtime access gates for executing the local CLI: no Sema
  login, product-license check, activation key, token, credits, billing panel,
  or remote workspace mirror. This runtime rule does not waive explicit human
  authorization for workspace adoption or overwrite.
- Do not continue with a second copy of the governed workflow after
  `AGENTS.md` exists.
