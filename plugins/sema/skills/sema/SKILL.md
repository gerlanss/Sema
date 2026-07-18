---
name: sema
description: Required Sema bootstrap for Codex when a local project does not yet contain its generated AGENTS.md protocol. Use when the user asks to install, introduce, initialize, or repair Sema, or mentions Sema in a workspace without that protocol. After AGENTS.md exists, read it and delegate the governed workflow to it and the local CLI.
---

# Sema Bootstrap

This skill is required for the first contact, before a project can explain Sema
to Codex through `AGENTS.md`. It does not replace or duplicate workspace
governance.

## Bootstrap

1. From the project root, run:

   ```bash
   sema --version
   ```

2. If the command is unavailable, stop and ask the user to install the public
   local CLI explicitly:

   ```bash
   npm install --global @semacode/cli
   ```

3. If the project has no Sema contract and no generated Sema `AGENTS.md`,
   initialize it:

   ```bash
   sema iniciar --template base
   ```

   This command preserves existing project files. Never add `--force`
   automatically; an overwrite must be an explicit user decision.

4. Generate or repair the official Codex handshake:

   ```bash
   sema sync-codex --json
   ```

5. Read the generated `AGENTS.md` and `SEMA_BOOT.md`. From this point onward,
   follow those workspace instructions and execute the local CLI directly.

## Boundary

- The CLI is the engine and source of truth.
- `AGENTS.md` is the automatic, continuous workspace protocol for Codex.
- This skill is mandatory while that protocol is absent.
- This skill only bridges the absence of that protocol during first contact.
- Bootstrap must preserve existing files and stop on symlink or junction
  escapes; it must never choose overwrite on the user's behalf.
- Do not introduce MCP servers, remote workspace mirrors, login, license,
  billing, token, credit, panel, or authorization gates.
- Do not continue with a second copy of the governed workflow after
  `AGENTS.md` exists.
