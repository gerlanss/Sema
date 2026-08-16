# Drift Cache And Query Evidence

Sema exposes three drift modes, but the `none` mode intentionally means
different things for direct drift execution and for query commands. The
defaults preserve honest, low-cost queries while keeping an explicit drift run
fresh by default.

| Mode | `sema drift --cache <mode>` | `sema resumo --drift <mode>` / `sema inspecionar --drift <mode>` |
| --- | --- | --- |
| `none` | Runs drift without reading or writing persistent cache. | Skips drift analysis. This is the query default. |
| `cache` | Reuses a valid cache entry; otherwise recalculates and publishes a new entry. | Runs drift with the same reuse-or-recalculate behavior. |
| `fresh` | Does not reuse a prior hit, recalculates, and publishes a fresh entry. This is the direct drift default. | Runs drift from fresh inputs without reusing prior extraction data, then publishes the resulting entry. |

Use `--cache none` when a direct analysis must leave no persistent cache access.
Use `--drift none` when a summary or inspection should not perform drift at all.
The two forms are not interchangeable.

## Honest Query Evidence

`sema resumo` and `sema inspecionar` default to `--drift none`. Their JSON
payload includes an `analiseDrift` envelope that makes the omitted evaluation
explicit:

```json
{
  "analiseDrift": {
    "modo": "none",
    "executada": false,
    "sucesso": null,
    "cache": null
  },
  "scoreDrift": null,
  "confiancaGeral": null
}
```

The surrounding payload varies by command. A human-readable `aviso` or
`avisos` entry explains why drift was not evaluated. Drift-derived framework,
route, surface, bridge, and module implementation evidence is also `null` when
applicable. In this context, `null` means **not evaluated**; it must never be
interpreted as zero, empty, passing, or absent drift.

Request `--drift cache` or `--drift fresh` when a query needs evaluated drift
evidence. In that case, `analiseDrift.sucesso` is `true` or `false`, and a
failed requested analysis makes the command exit nonzero instead of hiding the
failure behind a successful query response.

## External Cache Location

Persistent drift cache is stored outside the governed workspace:

| Platform | Cache root |
| --- | --- |
| Windows | `%LOCALAPPDATA%\Sema\Cache`, falling back to `%USERPROFILE%\AppData\Local\Sema\Cache` |
| macOS | `~/Library/Caches/Sema` |
| Linux and other Unix systems | `$XDG_CACHE_HOME/sema`, falling back to `~/.cache/sema` |

Drift entries live below `drift/v3/workspaces/<opaque-id>/objects/` inside that
root. Public output represents such paths as `$SEMA_CACHE/drift/v3/...`.
`$SEMA_CACHE` is a safe display placeholder, not a promise that an environment
variable with that name exists, and Sema does not expose the real user cache
path.

Sema never writes persistent drift cache inside the repository, `.sema`,
`.tmp`, generated project folders, or any other workspace location.

## Authority And Recovery

The cache is an acceleration layer, not governance evidence and not a source of
truth. Contracts, source files, the active analysis plan, and the validated
result remain authoritative.

- A corrupt or incompatible entry is treated as a recoverable miss: Sema
  recalculates instead of trusting it.
- If external cache storage is unavailable, analysis continues by
  recalculating; cache persistence does not become a governance blocker.
- `cache` may reuse only a valid entry for the current workspace and inputs.
- `fresh` never reuses cached extraction data before analysis. Publication may
  read and validate an existing content-addressed winner to preserve CAS
  integrity without changing the freshly calculated result.
- Direct `none` performs no persistent cache reads or writes.

These rules keep cache failures from hiding drift and keep the governed
workspace free of machine-local state.

## Semantic Integrity And Trust Limit

The reusable payload stores canonical per-extractor indices. It does not store
`todosSimbolos`, route aggregates, resource aggregates, or known-file
aggregates as independent sources. Sema derives those values again after a
cache entry is restored, so a redundant aggregate cannot silently override its
source indices.

Before accepting a hit, Sema checks exact field allowlists, relative catalog
paths, extractor-specific file extensions and symbol origins, consumer-surface
to route relationships, and derived integrity digests across symbols, routes,
resources, surfaces, and persistence details. Detectable structural or
semantic inconsistency becomes a corrupt miss, followed by a fresh in-memory
calculation and repair. A valid hit is therefore limited to a compatible
payload produced for the same CLI, schema, extractor, workspace identity, Git
HEAD, plan, configuration, contracts, and content-digested members.

These SHA-256 digests detect corruption and incoherent rewriting; they do not
authenticate a hostile process running as the same operating-system user. Such
a process can read the implementation and rewrite both data and checksums. The
external cache is not a security boundary, a signature, or final evidence.
Use `--cache fresh` for closure and retain stronger evidence outside the local
user cache when the threat model includes local-user compromise.
