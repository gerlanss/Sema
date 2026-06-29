# Authentication Boundary

The public Sema CLI does not require authentication.

Use local commands:

```bash
sema --version
sema preflight resumo --json
sema validar contratos/example.sema --json
```

Do not put private or sensitive operational material in this repository.

Application-specific authentication belongs in the application repository that
owns it.
