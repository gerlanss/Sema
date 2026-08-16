# Deployment Boundary

The public Sema repository documents one coordinated npm artifact containing
the local CLI, its absolute managed launcher, and the portable bootstrap skill.
The repository Codex plugin remains an optional namespaced distribution channel
for the same versioned skill.

Run the complete public gate:

```bash
npm run build
npm run codex:sync-entrypoint
npm run status:check
npm run repo:verificar-publico
npm run plugin:testar-codex
npm test
npm run release:verificar-drift
npm run release:preparar-publica
npm run release:publicar-npm-dry-run
```

`release:preparar-publica` performs the Codex entrypoint sync before checking
the public boundary, so a clean clone does not depend on ignored generated
handshake files left by a previous local run.

All release and local-install routes delegate to `npm run
cli:empacotar-publica`. The factory uses a unique private stage, disables npm
lifecycle scripts while packing that stage, and publishes only a fully
validated tarball. Do not use `npm pack --workspace @semacode/cli`; the source
package guard rejects that unsupported path without staging files in the
workspace.

The public-package smoke performs a global install with isolated home, npm
prefix, npm cache, and user cache. It proves the launcher works through its
absolute path with Node.js and npm removed from `PATH`. On Windows it exercises
`sema.ps1` as the PowerShell `PATH` entrypoint, `sema-managed.ps1` through the
absolute `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`, and
`sema.cmd` through `cmd.exe`. The smoke also proves the synchronized
skill matches the packaged source, the real user home is unchanged, and local
installs leave global state untouched. The plugin smoke independently compares
its cached skill with the versioned source and proves no Sema MCP server was
registered. Plugin and CLI versions must match before the commit is pushed.

Push the commit containing `.agents/plugins/marketplace.json` and
`plugins/sema/` before telling users to install from `gerlanss/Sema`. Publish
the npm package only after the tarball smoke passes. After npm publication, run
`npm run release:verificar-distribuicao` to verify the registry and live GitHub
state. That final verifier also requires the remote GitHub HEAD to match the
local commit, installs `sema@sema` from `gerlanss/Sema` in an isolated
`CODEX_HOME`, compares the remote skill with the versioned source, and proves
that the remote plugin registers no Sema MCP. The current contract does not
permit creating a GitHub Release or release asset.

Do not publish private or sensitive operational material in this repository.
