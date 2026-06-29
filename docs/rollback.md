# Rollback Boundary

Public Sema rollback guidance is limited to local files and npm package
artifacts.

For public package work:

1. Keep the previous tarball until the new one passes smoke tests.
2. Rebuild with `npm run cli:empacotar-publica`.
3. Re-run `node scripts/testar-pacote-cli-publico.mjs`.

Do not publish private or sensitive operational rollback material in this
repository.
