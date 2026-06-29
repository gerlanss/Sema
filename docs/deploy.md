# Deployment Boundary

The public Sema repository only documents public local CLI release checks.

Public release work should focus on the local CLI package:

```bash
npm run build
npm run cli:empacotar-publica
node scripts/testar-pacote-cli-publico.mjs
```

Do not publish private or sensitive operational material in this repository.
