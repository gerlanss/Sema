# Testing

Public Sema tests should run locally.

Recommended checks:

```bash
npm run build
node pacotes/cli/dist/index.js --help
node pacotes/cli/dist/index.js preflight resumo --json
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema --json
npm run cli:empacotar-publica
node scripts/testar-pacote-cli-publico.mjs
```

Do not require private or sensitive operational material for public test
evidence.
