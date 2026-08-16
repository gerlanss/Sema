# Installation And First Use

Sema is installed and used as a local CLI.

```bash
npm install -g @semacode/cli
sema skill status --json
```

The global package creates an absolute launcher under `~/.sema/bin`, installs
the bundled skill in `~/.agents/skills/sema`, and mirrors it to
`~/.claude/skills/sema` only when Claude is already present. Open a new task so
the updated skill catalog is loaded. Installing or updating the global CLI does
not authorize Sema adoption in the current workspace: informational requests
stay read-only, and implementation requires explicit adoption authorization.
After an authorized bootstrap, `AGENTS.md` becomes the automatic protocol for
subsequent tasks.

Then verify the local engine:

```bash
sema --version
sema resumo --drift none
```

The CLI is ready when `sema --version` succeeds. No Sema login, user
authorization, activation key, product-license check, token, credits, billing
service, or control panel is involved.

The skill handles first contact with a project that does not yet have Sema. It
only bootstraps the local CLI and generates the repository's `AGENTS.md`; that
file becomes the automatic workspace protocol afterward. The npm lifecycle does
not install plugins or touch plugin caches.

If the install used `--ignore-scripts`, run `sema skill sync --json`. If the
shell cannot resolve the npm shim, use `~/.sema/bin/sema` on macOS or Linux. On
Windows, PowerShell resolves `sema.ps1` from `PATH`, `cmd.exe` resolves
`sema.cmd`, and the robust PowerShell fallback is:

```powershell
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version
```

The managed fallback contains absolute Node.js and CLI paths and does not
depend on `PATH`.

## First Project

```bash
sema descobrir explicar flow.project-adoption --json
sema iniciar --template base
sema sync-codex --json
sema validar contratos/*.sema --json
sema resumo --drift none
```

Run this sequence only after explicit project-adoption authorization. The
`sema iniciar` command preserves existing project files and refuses symlink or
junction escapes. The bootstrap skill never uses `--force`; explicit overwrite
remains a human decision.

## Existing Project

```bash
sema resumo --drift none
sema docs-impacto --intencao "describe the change" --json
sema inspecionar contratos/example.sema --drift none --json
sema drift contratos/example.sema --escopo modulo --cache fresh --json
sema impacto contratos/example.sema --alvo sema.example.target --mudanca "describe the change" --json
```

`sema resumo` and `sema inspecionar` default to `--drift none`: they skip drift
analysis and report drift-derived evidence as `null`, meaning not evaluated.
Direct `sema drift` defaults to `--cache fresh`; its `--cache none` mode still
runs the analysis, but without reading or writing persistent cache. See
[Drift Cache And Query Evidence](./drift-cache.md) for the complete mode table,
external cache locations, and recovery behavior.

The public CLI does not require private service credentials or an external
request before local commands run.

Support: suporte@otimitare.online
