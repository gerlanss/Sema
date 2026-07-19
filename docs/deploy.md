# Deployment Boundary

The public Sema repository documents two coordinated release surfaces: the
local npm CLI and the Codex bootstrap skill. The skill remains a separate,
explicit Codex installation and is never injected by npm lifecycle scripts.

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

The plugin smoke installs the repo marketplace into an isolated `CODEX_HOME`,
installs `sema@sema`, compares the cached skill with the versioned source, and
proves no Sema MCP server was registered. Plugin and CLI versions must match
before the commit is pushed. The release command itself runs the full test suite
and project-wide Sema drift gate; these are not optional manual preliminaries.

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
