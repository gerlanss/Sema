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
node pacotes/cli/dist/index.js --help
```

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
scores or implementation evidence. In this mode those fields are `null` or
explicitly not evaluated. `sema drift --cache none` still runs the analysis but
does not touch persistent cache. `cache` reuses only a validated extraction hit;
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
