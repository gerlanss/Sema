---
name: sema
description: Use before creating or editing software in a workspace, including small fixes, plain HTML/CSS/JavaScript apps, and empty projects. Ask about first-time Sema adoption, confirm the effective context window, then follow local contracts before implementation. Also handles Sema installation, updates and repair. The user need not mention Sema.
---

# Sema

Load this skill before the first project write for creation or editing tasks.
Sema applies to simple static apps as well as larger systems. A request to
create an app, fix a bug or change a feature enters this workflow even when
it does not name Sema. Loading the skill is not consent to adopt it.

## Create or edit a project

1. In the current workspace, run `sema --version`. If PATH fails, use the
   fallback below. Look for `AGENTS.md`, `SEMA_BOOT.md` and applicable contracts
   without reading the whole project.
2. **First use in a project without Sema:** before implementation, ask whether
   the user wants to adopt Sema in this project and wait for the answer. This
   applies both to an empty project and to editing existing ungoverned code.
   Do not infer consent from installation, automatic skill activation or a
   generic request to create/edit software. An explicit adoption request or
   previous acceptance for this same project already answers the question;
   do not ask again. If declined, do not initialize Sema or claim its validation;
   follow the remaining user and project instructions.
3. **After acceptance, or in an existing Sema project:** obtain the model's
   effective configured context window in tokens from the client or user.
   If unknown, ask and wait before loading project context or implementing.
   Parameter count (4B, 9B), advertised maximum and output-token limit are not
   the configured context window. Recheck when the model/configuration changes.
4. **Adopting this project:** preserve existing files and run:

   ```text
   sema descobrir explicar flow.project-adoption --json
   sema iniciar --template base --janela-contexto <confirmed-tokens>
   sema sync-codex --json
   ```

   Read the generated `AGENTS.md` and `SEMA_BOOT.md`. Initialization does not
   invent a business contract: examples stay under `exemplos/`. Model the actual
   requested behavior in `contratos/` before implementing; preserve existing contracts. Never add `--force`
   without an explicit overwrite decision.
5. **Existing Sema project:** read its `AGENTS.md` and `SEMA_BOOT.md`, then run
   `sema sessao "<task intention>" --janela-contexto <confirmed-tokens> --json`.
   Follow the local gates and selected contract through implementation/testing.
   Save a context profile only with `--salvar-perfil` as requested.

Run `docs-impacto --intencao "<intent>" --arquivo <contract> --json` and retain
`mudancaId`. After compaction, resume `sessao --mudanca-id <id> --json`.
Use the returned argument arrays for closure; repeat `--doc-lida` only for docs
actually read. Hashes reuse declarations until a file changes. Missing scope or
nonexistent files block closure. This gate checks declarations, not comprehension
or behavior: validation, fresh drift and application tests remain separate.
Use `drift <contract> --cache fresh --pacote --json` and inspect evidence gaps;
consume JSON without truncating lines or object depth. When creating a contract,
plan each task's `impl { js: app.cadastrar }` and
`vinculos { arquivo: "app.js" simbolo: app.cadastrar }` before implementation.
Confirm the planned files and symbols with fresh drift once they exist.
Link HTML/CSS as module files; they are not JavaScript implementations.
`SEMA-GOVERNED` headers identify ownership but do not replace task mappings.
Quote `arquivo` paths. Do not convert plain JavaScript to ES modules for Sema.

`sema formatar` formats .sema contracts and `sema validar` validates those
contracts. Neither adopts a project or proves that HTML, CSS, JavaScript or
the application works. Report what was actually checked, including no contracts
found. If the user corrects a missed Sema workflow, resume it before more writes.

Read only the selected contract, declared dependencies and blocking docs.
`SEMA_INDEX.json` and `AGENT_CONTEXT_PACK.json` are internal CLI databases,
not files to preload. Resolve stale indexes or ambiguous targets before editing.
The profile-selected summary is optional: skip it when the session already supplies the needed context.
The budget counts local entry instructions plus the current delivery, not the whole chat.
Do not load multiple summaries or choose context size from labels such as small/strong.

## CLI fallback and results

On Windows PowerShell, use this directly if PATH fails:

```powershell
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version
```

On macOS/Linux: `"$HOME/.sema/bin/sema" --version`. Do not declare the CLI
unavailable before trying the managed fallback. If both fail, stop governed
edits. JSON results nest domain state in `payload`; `ok` alone is not proof
of success. Respect `payload.sucesso`, `valido`, blockers and scope.

## Install, update or repair Sema

Only for distribution work, read [references/distribution.md](references/distribution.md).
Do not load it for ordinary project creation or editing. Informational requests
do not mutate a workspace. Installation and repair remain separate from adoption.
