# Installation And First Use

Sema is installed and used as a local CLI.

```bash
npm install -g @semacode/cli
codex plugin marketplace add gerlanss/Sema
codex plugin add sema@sema
```

Open a new Codex task in the target repository so the newly installed `$sema`
skill is loaded, then ask it to initialize Sema. Existing tasks do not refresh
their skill catalog. After bootstrap, `AGENTS.md` becomes the automatic protocol
for subsequent tasks.

Then verify the local engine:

```bash
sema --version
sema resumo --drift none
```

The CLI is ready when `sema --version` succeeds. No Sema login, user
authorization, activation key, product-license check, token, credits, billing
service, or control panel is involved.

The Codex skill is required for first contact with a project that does not yet
have Sema. It only bootstraps the local CLI and generates the repository's
`AGENTS.md`; that file becomes the automatic workspace protocol afterward.
Plugin installation is explicit and does not happen from npm lifecycle scripts.

## First Project

```bash
sema iniciar --template base
sema validar contratos/*.sema --json
sema resumo --drift none
```

`sema iniciar` preserves existing project files and refuses symlink or junction
escapes. The bootstrap skill never uses `--force`; explicit overwrite remains a
human decision.

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
