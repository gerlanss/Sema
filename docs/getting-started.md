# Installation And First Use

Sema is installed and used as a local CLI.

```bash
npm install -g @semacode/cli
sema --version
sema preflight resumo --json
```

Proceed only when `preflight` returns `decisao: "use_cli_local"`.

## First Project

```bash
sema iniciar --template base
sema validar contratos/*.sema --json
sema resumo
```

## Existing Project

```bash
sema resumo
sema docs-impacto --intencao "describe the change" --json
sema inspecionar contratos/example.sema --json
sema drift contratos/example.sema --escopo modulo --json
sema impacto contratos/example.sema --alvo sema.example.target --mudanca "describe the change" --json
```

The public CLI does not require private service credentials.

Support: suporte@otimitare.online
