# Rollback Boundary

Public rollback covers the npm CLI, managed launcher, bundled global skill, and
the optional Codex plugin channel.

For a failed pre-publication candidate:

1. Keep the previous tarball until the new one passes smoke tests.
2. Revert the plugin source, marketplace manifest, CLI source, and versions to
   the last known-good commit.
3. Re-run `npm run release:preparar-publica`.

If a bad commit was already pushed, revert it with a normal Git revert and push
the corrective commit. Install the corrected npm version and resynchronize its
managed distribution:

```bash
npm install -g @semacode/cli@<corrected-version>
sema skill sync --json
```

The same sequence may install an explicitly selected previous version. The
installed npm version is authoritative: `sema skill sync --json` aligns the
runtime, managed launcher, and bundled skill to the version that is actually
installed. This is synchronization, not a promise to block an intentional
downgrade.

If the optional plugin channel was also affected, upgrade or reinstall it after
the corrected commit is public. Open a new task before validating the repaired
skill; already-open tasks keep the catalog they started with.

If a bad npm version was published, do not overwrite it. Publish a corrected
version and direct users to that version. Verify the final registry/GitHub state
with `npm run release:verificar-distribuicao`. Do not create a GitHub Release or
asset as a rollback shortcut while the release contract blocks that surface.

Do not publish private or sensitive operational rollback material in this
repository.
