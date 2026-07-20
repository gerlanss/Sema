# Profiles

Profiles are local validation layers for domains where syntax alone is not
enough. They use the same `.sema` DSL and do not create a second language.

## Principle

A profile checks whether a contract is strong enough for a specific kind of
work. It can require:

- contract-first workflow;
- domain core fields;
- required rules, effects, guarantees, and tests;
- explicit forbidden behavior;
- evidence before closing the change.

When a profile returns `bloqueado: true`, the artifact is not approved.

## Commands

```bash
sema profile capabilities --json
sema profile validar software contratos/example.sema --maturidade production --preset default --json
sema profile validar simulation contratos/example.sema --maturidade production --preset calibration --json
sema rule-packs --profile software --json
```

## Built-In Profiles

- `software`: code, APIs, modules, refactors, persistence, and generated output.
- `workflow`: automations, queues, webhooks, scheduled jobs, and orchestration.
- `ops`: deploy plans, rollback, incidents, runbooks, and operational evidence.
- `legal`: terms, privacy, compliance, risk, and regulated language.
- `research`: comparisons, uncertainty, evidence, citations, and decisions.
- `game`: rules, loops, player states, scoring, and playability checks.
- `simulation`: models, assumptions, units, scenarios, calibration, uncertainty,
  deterministic replay, and tolerance evidence.
- `redacao`: editorial and creative writing, narrative structure, voice,
  clarity, and publication-ready evidence.
- `propostas`: commercial proposals, scope clarity, deliverables, constraints,
  and client-ready wording.
- `conversas`: customer conversation guardrails, escalation, pricing promises,
  and channel changes.

Profiles are local CLI checks. They do not create or require external service
accounts.

`author` remains a dedicated workflow under `sema author`; it is not exposed as
a fake `sema profile validar author` gate. Use `sema descobrir explicar workflow.author`
to inspect that boundary.

The legacy `sema profile capabilities` view lists only profiles accepted by
`profile validar`; its separate `workflowsEspecializados` field points Author
to `sema author` without advertising an invalid validation command.
