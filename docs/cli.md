# Sema CLI

Sema is a Codex-native local CLI distribution. The public package reads the
workspace on the user's machine, validates `.sema` contracts, checks drift,
maps impact, and generates code without login, user authorization, license
activation, tokens, credits, billing services, a control panel, or external
service credentials.

Support: suporte@otimitare.online

## Install

```bash
npm install -g @semacode/cli
sema --version
sema skill status --json
```

The global install bundles the portable Sema skill and creates a launcher under
`~/.sema/bin` with absolute Node.js and CLI paths. If the npm shim is absent
from `PATH`, run `~/.sema/bin/sema` on macOS/Linux. On Windows, PowerShell
resolves `sema.ps1` from `PATH`, while `cmd.exe` resolves `sema.cmd`; invoke the
managed fallback through the absolute system executable:

```powershell
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version
```

Use `sema skill sync --json` to repair an installation performed with lifecycle
scripts disabled.

For development inside this repository:

```bash
npm install
npm run build
node pacotes/cli/dist/bin.js --help
```

## Side-Effect-Free Help

`--help` and `-h` take precedence wherever they appear in argv, including after
an unknown command or option. The CLI exits with status `0` before command
runtime import, command dispatch, or handler resolution. Help does not inspect or mutate the workspace,
home, user cache, or plugin cache, start a subprocess, or make a network call.

`dist/bin.js` is the executable bootstrap and imports the operational runtime
only after these control paths finish. `dist/index.js` remains the package API
entrypoint and is not an executable alias.

```bash
sema iniciar --help
sema formatar --help
sema sync-codex --help
sema skill sync --help
sema unknown --option value --help
```

## Public JSON Output

`sema --version` (and its version aliases) prints one plain exact SemVer string.
It is intentionally not wrapped in JSON.

### Help and command control

Adding `--json` to help or a command-control failure emits exactly one JSON
document on stdout and keeps stderr empty:

```json
{
  "schemaVersion": "sema.cli.control/v1",
  "ok": true,
  "kind": "HELP",
  "code": "CLI_HELP",
  "message": "Sema CLI help",
  "exitCode": 0
}
```

The envelope contains exactly `schemaVersion`, `ok`, `kind`, `code`, `message`,
and `exitCode`. Supported control kinds are `HELP`, `UNKNOWN_COMMAND`,
`ARGUMENT_ERROR`, and `FATAL_ERROR`. Help uses exit code `0`; failures preserve
a non-zero process status equal to `exitCode`. Failure messages are public and
redacted: they do not include stacks, absolute paths, raw argv, or internal
causes.

Command-control failures are unknown top-level commands or subcommands, missing
or invalid required CLI arguments/options rejected before valid dispatch, and
uncaught runtime exceptions. An uncaught exception uses the redacted
`FATAL_ERROR` control envelope. `sema.cli.control/v1` is never nested inside a
command result.

### Valid command results

In 3.0.0, every syntactically valid command invoked with `--json` emits exactly
one `sema.cli.result/v1` document on stdout with empty stderr:

```json
{
  "schemaVersion": "sema.cli.result/v1",
  "ok": true,
  "kind": "SUCCESS",
  "command": "resumo",
  "code": "CLI_SUCCESS",
  "message": null,
  "exitCode": 0,
  "payload": {
    "comando": "resumo",
    "sucesso": true
  }
}
```

The result envelope contains exactly `schemaVersion`, `ok`, `kind`, `command`,
`code`, `message`, `exitCode`, and `payload`; extra or missing fields are
invalid, and `data` is not an alias for `payload`. `command` is the canonical
top-level command name. `payload` is always present and may be any JSON value,
including an object, array, scalar, or `null`.

- `SUCCESS` requires `ok: true`, `code: "CLI_SUCCESS"`, `message: null`, and
  `exitCode: 0`.
- `DOMAIN_ERROR` requires `ok: false`, `code: "CLI_DOMAIN_ERROR"`, a non-empty
  safe public `message`, and a positive `exitCode` equal to the process status.

The envelope describes the CLI result transport and classification. It does
not replace the command's domain model: consumers must unwrap `payload` and
evaluate fields such as `payload.sucesso`, `payload.aprovado`,
`payload.bloqueado`, or another command-specific verdict separately. A
syntactically valid operation that returns a structured domain failure uses
`DOMAIN_ERROR`; it does not fall back to `sema.cli.control/v1`.

## Codex Setup

`AGENTS.md` is the official Sema entrypoint for Codex. Create or refresh it from
the local CLI:

```bash
sema sync-codex --json
```

Codex automatically loads `AGENTS.md` as repository guidance. Sema is an
independent product and is not affiliated with or endorsed by OpenAI.

## Required Local Flow

Codex and humans should use the same local sequence before changing governed
code, contracts, workflows, release scripts, or operational docs:

```bash
sema --version
sema resumo --drift none
sema docs-impacto --intencao "describe the change" --json
sema inspecionar contratos/example.sema --drift none --json
sema drift contratos/example.sema --escopo modulo --cache fresh --json
sema impacto contratos/example.sema --alvo sema.example.target --mudanca "describe the change" --json
```

Commands run directly against the local workspace. If `sema --version` fails,
try the managed absolute launcher before declaring the CLI unavailable. If both
fail, install or repair the npm package; there is no separate authorization
gate.

## Core Commands

- `sema iniciar`: create a governed starting point.
- `sema validar`: validate `.sema` contracts.
- `sema inspecionar`: inspect the applicable contract surface; add `--drift cache|fresh` to request code evidence.
- `sema drift`: compare contracts and implementation with `--cache none|cache|fresh` (default `fresh`).
- `sema impacto`: map the blast radius of a planned change.
- `sema docs-impacto`: identify docs that must be read or updated.
- `sema finalizar-mudanca`: close the governed change with evidence.
- `sema compilar`: generate code from contracts.
- `sema testar`: generate, compile, and execute local contract tests, including `dotnet` and `cpp`.
- `sema verificar`: run the final local verification bundle.
- `sema contexto-ia`: build local AI context from a contract.
- `sema sync-codex`: create or refresh the official `AGENTS.md` entrypoint.
- `sema skill status|sync`: inspect or repair the managed launcher and bundled
  global skill without touching plugin caches or workspace files.

`resumo` and `inspecionar` default to `--drift none`, so they do not fabricate
scores or implementation evidence. In this mode those fields inside `payload`
are `null` or explicitly not evaluated. `sema drift --cache none` still runs
the analysis but does not touch persistent cache. `cache` reuses only a validated extraction hit;
`fresh` ignores hits and republishes recalculated extraction data. Cache objects
live in the operating system's user-cache directory outside the workspace, and
the final links, diagnostics, score, and success decision are always recomputed.

Generation targets are `typescript`, `python`, `php`, `dart`, `lua`,
`javascript`, `html`, `css`, `dotnet`, and `cpp`. The aliases `cs` and
`csharp` select `dotnet`; `c++`, `cxx`, and `cc` select `cpp`.
Native targets are opt-in in `sema.config.json.alvos` for project-wide
verification because they require local compiler toolchains.

## Public Boundary

Do not publish private or sensitive operational material in public Sema
artifacts.
