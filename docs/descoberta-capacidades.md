# Capability Discovery

Sema exposes one explainable catalog so an AI can distinguish a validation
profile, an orchestration pipeline, a specialized workflow, a generator, a
governance gate, an adapter descriptor, and an opaque capability token.

Discovery is local, deterministic, and read-only. It recommends or explains a
capability but never executes the recommended command:

```bash
sema descobrir catalogo --json
sema descobrir recomendar --intencao "validar simulador 3D autonomo calibrado" --json
sema descobrir recomendar --intencao "port a 16-bit game to another engine and declare losses" --json
sema descobrir explicar interactive.portability --json
sema pipeline listar --json
sema pipeline descrever interactive.playtest --json
sema capabilities --json
```

The response schema is `sema.discovery/v1` and always reports:

- `executed: false`;
- `workspaceMutated: false`;
- `externalCalls: false`;
- actionable command templates with placeholders;
- required inputs and execution boundaries;
- matched signals, reasons, missing inputs, and stable scores.

Advanced interactive intent is routed to the narrowest local validator or
analyzer (`validar-temporal`, `validar-playtest-fuzz`, `analisar-portabilidade`,
and peers). A broad profile or engine descriptor does not outrank that specific
pipeline, and the suggested template retains every required file and flag.

Raw paths and credential-like values supplied in intents or filters are used
only for the in-memory lookup and are redacted from JSON and human output.

## Catalog coverage

The interactive catalog exposes **35 unique pipelines** and **28 unique
external adapter descriptors**. The pipeline set covers the original game and
simulation lifecycle plus P0/P1/P2 operational capabilities:

- P0 representation and observation: Experience IR, engine snapshots, asset
  provenance, editor state, multimodal evidence, resumable jobs, and acceptance
  locks;
- P1 behavior over time: timeline validation, shot/camera checks, physics
  relations, temporal QA, clean-install/launch/smoke checks, and hardware
  budgets;
- P2 autonomy and scale: safe repair cycles, bot playtests, state fuzzing,
  multiplayer authority, engine migration, portability with declared losses,
  and distributed job DAGs.

These entries apply across 3D, 2.5D, 2D, 8-bit, 16-bit, text, XR, and headless
games and simulations. Discovery ranks the requested goal independently from
the spatial model and visual profile.

The 28 adapters are **descriptors for external capabilities**. Catalog lookup
does not detect an installed engine, inspect an editor, enumerate plug-ins,
probe processes, contact a worker, or prove that any integration is available.
An external runner must establish runtime availability and return bound
evidence.

## Capability kinds

- `GOVERNANCE_FLOW`: contract, drift, impact, verification, and closure gates.
- `PROFILE_GATE`: semantic validation such as game, simulation, software, or ops.
- `SPECIALIZED_WORKFLOW`: dedicated surfaces such as `sema author`.
- `ORCHESTRATION_PIPELINE`: a staged workflow such as content, interactive
  playtest, temporal validation, portability, or distributed jobs.
- `CAPABILITY_TOKEN`: an opaque producer, evaluator, runtime, or evidence token.
- `GENERATOR`: code generation targets.
- `ADAPTER`: compatibility descriptors for external engines, editors, runtimes,
  observers, verifiers, asset tools, build systems, and workers.

`author` is intentionally a specialized workflow, not a fake
`sema profile validar author` command. Likewise, `profile.game` validates game
semantics; it is not the same thing as the `interactive.playtest` pipeline.

## Deterministic recommendation

The base router normalizes accents and aliases, applies positive and negative
signals, scores the entry kind and domain, and sorts by score then stable ID.
The minimum recommendation score is 60. When the top two candidates are within
seven points, the response reports ambiguity and does not choose a command.

This rule is deliberate: an AI should request more concrete intent instead of
silently running the wrong pipeline.

Interactive pipeline entries point to declarative planning with
`sema interativo planejar <definition.json> --json`. The definition must list
the recommended pipeline ID; the secondary `descrever` template remains
available when the AI first needs the pipeline contract. Advanced entries point
to their dedicated `sema interativo` validator or analyzer. Those commands
still return local, non-authoritative results and do not execute engines,
editors, plug-ins, or workers.

Legacy views remain available:

```bash
sema profile capabilities --json
sema conteudo capabilities --json
sema interativo capabilities --json
```

They are projections of the same authoritative catalog sources, not separate
manually maintained product maps.
