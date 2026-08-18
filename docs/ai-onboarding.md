# Codex Onboarding

The official Sema skill lets Codex and compatible agents recognize and
initialize Sema before a project has its own protocol:

```bash
npm install -g @semacode/cli
sema skill status --json
```

The install maintains the canonical copy in `~/.agents/skills/sema` and a Claude
mirror in `~/.claude/skills/sema` only when Claude is detected. Open a new task
after installation or update because an already-open task does not reload its
skill catalog. Invoking `$sema` for information does not initialize the
workspace. Before implementation, the skill asks for explicit adoption
authorization; installing or updating the global CLI authorizes distribution
changes only. After authorized adoption, it reads the generated `AGENTS.md`,
and later tasks load that protocol automatically.

The optional Codex plugin remains available as a separate namespaced channel;
the npm lifecycle never writes into its cache.

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
2. sema resumo --drift none
3. sema docs-impacto --intencao "<change>" --json
4. sema inspecionar <contract.sema> --drift none --json
5. sema drift <contract.sema> --escopo modulo --cache fresh --json before
   editing existing code
6. sema impacto before changing behavior
7. sema finalizar-mudanca before closing

If `sema --version` is unavailable, try the managed absolute launcher at
`~/.sema/bin/sema` on macOS/Linux. On Windows, PowerShell uses `sema.ps1` from
`PATH`, `cmd.exe` uses `sema.cmd`, and the absolute PowerShell fallback is:
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version
If that also fails, stop and install or repair @semacode/cli. There is no
separate Sema login or license-activation gate. Distribution installation does
not authorize workspace adoption. Do not replace Sema with manual search or
guessed contracts.
```

Query commands default to `--drift none`, so their `analiseDrift` envelope marks
the analysis as not executed and keeps drift-derived evidence `null`. Direct
`sema drift` defaults to `--cache fresh`; `--cache none` still executes drift
without persistent cache access. The cache is non-authoritative, lives outside
the workspace, and safely falls back to recalculation when unavailable or
corrupt. See [Drift Cache And Query Evidence](./drift-cache.md).

## What Codex Should Not Do

- Do not invent `.sema` contracts.
- Do not implement code without an applicable contract.
- Do not ignore severity 4+ warnings.
- Do not publish private or sensitive operational material.
- Do not replace the local CLI when the local workspace is available.

Compatible AI clients can discover the same portable skill through the
canonical global `.agents/skills` root. Sema does not create client-specific
repository rules: `AGENTS.md` remains the only official workspace entrypoint.

Sema is an independent product and is not affiliated with or endorsed by
OpenAI.

Support: suporte@otimitare.com
