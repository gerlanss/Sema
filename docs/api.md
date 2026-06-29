# API Boundary

The public Sema distribution exposes a local CLI, not an online API.

## Public Surface

- `@semacode/cli`
- local `.sema` parsing and validation
- local drift and impact checks
- local code generation
- local AI context generation
- examples and English documentation

## Not Public

- private or sensitive operational material
- real credentials, environment files, or secret inventories

If a project needs an HTTP API, document that API in the project that owns it.
Do not document private operational material in the public CLI repository.
