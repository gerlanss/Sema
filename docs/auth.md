# Local Runtime Boundary

The public Sema CLI executes directly against the local workspace. It does not
require a Sema login, user authentication, product authorization, license
activation, install key, token, credits, billing service, control panel, or an
external request.

Use local commands:

```bash
sema --version
sema resumo
sema validar contratos/example.sema --json
```

The repository license governs use and redistribution. It is not checked as a
runtime activation mechanism.

An `authz` block inside a `.sema` contract describes authorization in the
application being governed. It does not authenticate a person before the Sema
CLI can run.

Do not put private or sensitive operational material in this repository.

Application-specific authentication belongs in the application repository that
owns it.
