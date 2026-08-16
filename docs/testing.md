# Testing

Public Sema tests should run locally.

Recommended checks:

```bash
npm run build
npm run status:check
npm run repo:verificar-publico
npm run plugin:testar-codex
npm run cli:empacotar-publica
npm run cli:testar-pacote-publico
node pacotes/cli/dist/index.js --help
node pacotes/cli/dist/index.js --version
node pacotes/cli/dist/index.js resumo exemplos/calculadora.sema --micro --json
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema --json
node pacotes/cli/dist/index.js testar exemplos/calculadora.sema --alvo dotnet --saida .tmp/testing-dotnet
node pacotes/cli/dist/index.js testar exemplos/calculadora.sema --alvo cpp --saida .tmp/testing-cpp
npm run release:preparar-publica
npm run release:verificar-drift
```

Do not require private or sensitive operational material for public test
evidence. The public-package smoke must also reject the removed authorization
command, legacy gate markers, any stale billing artifact, secrets, and broken
encoding in every published document. The plugin smoke must validate the repo
marketplace, manifest version, installed skill copy, and absence of Sema MCP.
After push and npm publication, `npm run release:verificar-distribuicao` must
repeat that installation from the remote `gerlanss/Sema` marketplace and prove
that GitHub HEAD, the installed skill, and the manifest-declared npm version
all describe the same release.

The local public-package smoke installs the generated tarball in an isolated
sandbox. It must import the root API without executing the CLI, materialize
nested interactive examples, and execute discovery, interactive schema,
definition validation, planning, and adapter-protocol validation through the
installed binary. Passing this smoke proves the local tarball only; it does not
mean that npm or a GitHub release was published.

The public-package smoke has one orchestrator and named helpers under
`scripts/cli-publico/`. All helpers share the same temporary sandbox and the
same installed tarball; splitting the checks must never multiply installations
or weaken the single `try/finally` cleanup boundary.

Focused drift regressions live in
`testes/unidade/drift-escopo-dependencias.test.ts`,
`testes/unidade/drift-escopo-referencias.test.ts`,
`testes/unidade/drift-catalogo.test.ts`,
`testes/unidade/drift-leitura-compartilhada.test.ts`, and
`testes/integracao/drift-escopo-io.test.ts`, plus the external-path attack
regressions in `testes/integracao/drift-caminhos-externos.test.ts`. They must prove planning before
cataloging, path confinement, dependency closure, one physical read and one AST
per canonical file, no homonymous last-write-wins resolution, and no
project-wide walk for `arquivo` or `modulo` scope. Project-loading regressions
also prove deferred code discovery and rejection of external configured roots
or contract origins before enumeration. In project scope, physical file
bindings outside code roots must enter the safe catalog individually, including
non-indexable assets, without causing a walk of their parent directories.
Drift, impact, and semantic rename must not expose an external path or read its
contents.
Persistent-cache regressions live in
`testes/unidade/drift-cache-modes.test.ts`,
`testes/unidade/drift-cache-store.test.ts`,
`testes/integracao/drift-cache-persistente.test.ts`, and
`testes/integracao/drift-cli-modes.test.ts`. They must prove all three modes,
query defaults, nullable non-evidence, zero cache I/O for `none`, storage outside
the workspace, opaque paths, strong-content invalidation even with restored
metadata, corruption recovery, immutable concurrent publication, and semantic
equivalence between fresh and warm results. Shape-valid semantic tampering with
only the envelope `payloadDigest` recalculated must fail the cross-index
invariants, become a corrupt miss, recalculate, and match the fresh result. The
payload must derive symbol, route, resource, and known-file aggregates from its
canonical per-extractor indices instead of trusting redundant aggregate lists.
A warm hit may skip AST/extractor work, but it never reuses the final score,
links, diagnostics, or success decision. Junctions, symlinks, hardlinks, path
traversal, drive-relative paths,
intermediate-directory swaps, and cache unavailability must fail closed or
degrade to an in-memory calculation without mutating the workspace.

Cache digests are corruption checks, not authentication against a hostile
process running as the same operating-system user. Tests must not present a
warm cache hit as a protected trust boundary; final closure evidence uses
`--cache fresh`.

Native generator evidence is mandatory when changing C#/.NET or C++ support.
The `dotnet` smoke must compile and execute through the local .NET SDK. The
`cpp` smoke must compile and execute through GCC, Clang, or MSVC; checking only
for generated files is not sufficient.
