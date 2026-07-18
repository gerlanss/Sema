# Rollback Boundary

Public rollback covers both the npm CLI and the separately installed Codex
bootstrap skill.

For a failed pre-publication candidate:

1. Keep the previous tarball until the new one passes smoke tests.
2. Revert the plugin source, marketplace manifest, CLI source, and versions to
   the last known-good commit.
3. Re-run `npm run release:preparar-publica`.

If a bad commit was already pushed, revert it with a normal Git revert and push
the corrective commit. Refresh the marketplace and reinstall the skill:

```bash
codex plugin marketplace upgrade sema
codex plugin remove sema@sema
codex plugin add sema@sema
```

Open a new Codex task before validating the reinstalled skill. Already-open
tasks keep the plugin/skill catalog they started with.

If a bad npm version was published, do not overwrite it. Publish a corrected
version and direct users to that version. Verify the final registry/GitHub state
with `npm run release:verificar-distribuicao`. Do not create a GitHub Release or
asset as a rollback shortcut while the release contract blocks that surface.

Do not publish private or sensitive operational rollback material in this
repository.
