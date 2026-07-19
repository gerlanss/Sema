# Testing

Public Sema tests should run locally.

Recommended checks:

```bash
npm run build
npm run status:check
npm run repo:verificar-publico
npm run plugin:testar-codex
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
that GitHub HEAD, the installed skill, and npm 2.1.0 all describe the same
release.

Native generator evidence is mandatory when changing C#/.NET or C++ support.
The `dotnet` smoke must compile and execute through the local .NET SDK. The
`cpp` smoke must compile and execute through GCC, Clang, or MSVC; checking only
for generated files is not sufficient.
