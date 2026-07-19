# AI-native Content Pipeline

Sema Content Pipeline is a contract-first control plane for creating content
with AI agents across arbitrary destinations and formats. It plans work,
verifies signed evidence, evaluates policy, derives canonical state, and tells
an external runner what can happen next. It does not execute agents, call
creative tools, publish content, or provide a native human-review path.

Brands, channels, accounts, and formats are configuration. They are never
closed enums in the pipeline core. A video channel, a site, a newsletter, an
RSS feed, or a future destination all use the same target and adapter model.

## Architecture

```text
.sema contracts, target set, and signed policy
  -> Sema creates a declarative plan
  -> external runner invokes producer agents and tools
  -> producers submit signed claims and immutable artifacts
  -> independent adapters/verifiers attest observable facts
  -> specialized AI evaluators submit signed semantic assessments
  -> Sema verifies identity, scope, independence, quorum, and deterministic rules
  -> state is replayed from the canonical ledger
  -> the external runner receives nextActions
  -> manifests and dashboards are regenerated projections
```

Existing Author, research, writing, copy, image, video, creative-QA, and
publication profiles are optional capabilities used by a pipeline definition.
They are not the pipeline state machine and they do not become universal
requirements for every kind of content.

## Trust boundary

A hash proves the identity and integrity of bytes. It does not prove that a
claim is true. A JSON receipt produced by the runner therefore remains a claim.
It becomes accepted evidence only when an authorized, independent principal
attests it with an Ed25519 signature and the attestation matches the exact run,
artifact digest, target, evidence type, policy, and validity window.

The trust configuration accepts only Ed25519 SPKI public material
(`-----BEGIN PUBLIC KEY-----`). PKCS#8 private PEM is rejected even though the
crypto runtime could derive a public key from it. Private keys must stay in the
producer, evaluator, adapter, or independent verification service that owns
them. If the executor controls every private key and the canonical store, the
signatures provide no meaningful separation.

For high assurance, keep trust anchors outside the runner workspace and store
the ledger in an independently controlled append-only service, WORM store, or
transparency log. Every trusted operation requires a canonical trust-root digest
retained by that external boundary; reading `trust.json` and trusting a digest
from the same file would merely let the executor nominate its own authority.

The signed policy is bound to the exact execution, pipeline definition, trust
root, ledger, and complete target set through `runId`, `definitionDigest`,
`trustRootDigest`, `ledgerId`, and `targetSetDigest`. Its `issuedAt` and
`expiresAt` define the complete authorization window: the trusted `recordedAt`
of `RUN_STARTED` must satisfy the configured maximum envelope age, and every
event must be recorded inclusively between those policy bounds. Once
`expiresAt` passes, the policy cannot authorize another append. It cannot be
replayed as authorization for another run, and a controller cannot silently
remove a channel to make a run appear complete.

The trust-root digest and revocation digest are separate external pins. The
trust root identifies the immutable authority set and its verification rules;
`revocationDigest` identifies the current revocation overlay. Rotating that
overlay must not redefine historical signatures, while revoked credentials no
longer count as active evidence, authorization, or quorum.
An authority key in the current revocation overlay cannot authorize a policy;
historical ledger verification remains a separate operation.

Public-key fingerprints, principal IDs, and key IDs must be unique, so one key
cannot masquerade as several independent voters.

The local file backend is useful for development and portable replay, but it is
not advertised as a strong append-only root. A trusted external checkpoint
(`expectedHead`) is required on ledger reads and writes to detect a truncated
or concurrently replaced local ledger. A trust file
inside the current workspace is rejected unless
`--development-local-trust` is explicit; that flag relaxes file placement only
and never removes digest pinning.

## Evidence and semantic evaluation

The pipeline separates three things:

- a producer or runner claim (`EVIDENCE_CLAIMED`);
- an independently signed observation (`EVIDENCE_ATTESTED`);
- a specialized AI assessment (`AI_ASSESSMENT`).

Sema evaluates deterministic constraints directly. Artifact metadata and
producer claims never prove those constraints by themselves: observable facts
must come from independently signed adapter/verifier observations bound to the
artifact digest, run, target, policy, and trust context. This includes
`observedMediaType`, obtained through independent sniffing; an artifact's
producer-declared `mediaType` cannot satisfy adapter acceptance on its own.
Semantic questions such as
factual quality, narrative quality, channel fit, brand voice, accessibility,
or audiovisual coherence require assessments from principals with the declared
capability. Sema verifies those assessments against policy; it does not invent
their semantic judgment.

Critical gates can require multiple approvals, distinct principals, distinct
control domains, and producer/evaluator separation. Deterministic attestations
use `minAttestationsPerEvidence` and
`minDistinctAttesterControlDomains` for every required evidence type; semantic
AI opinions use `minApprovals` and `minDistinctControlDomains`. Multiple agent
names under one credential or control domain do not create an independent
quorum.
Every gate that contributes to canonical completion must set
`producerDisjoint: true`; self-approval cannot be configured as a completion
shortcut.

A generic `content.evidence.attest` capability never authorizes evidence. Base
evidence requires `content.evidence.attest:<evidenceType>`. Adapter evidence is
stricter: the externally pinned trust root must grant
`content.adapter.attest:<adapterId>@<version>:<evidenceType>`, and the signed
data must name the exact adapter and version. Delivery confirmation also carries
an `observationDigest`; it is not a bare success receipt from the runner.

## Canonical state

Ledger events are hash-chained and carry signed envelopes. The state engine
replays the ledger deterministically. It never reads `concluido`, `approved`, or
similar fields from a hand-edited manifest.

Event and envelope wrappers are exact schemas: unsigned extra fields are
rejected. Every append requires the signed policy envelope and a complete
expected context derived from it. The genesis event is anchored to the
externally pinned trust domain, trust root, ledger ID, policy, definition, and
complete target set; none of those values are accepted merely because
`RUN_STARTED` declared them. During append, envelope freshness is measured
against the platform clock; caller-controlled `recordedAt` cannot backdate an
expired signature.

Gate verdicts are independent from operational conditions:

- verdict: `NAO_AVALIADO`, `APROVADO`, `REPROVADO`, `INCONCLUSIVO`;
- condition: `PENDENTE`, `PRONTA`, `EXECUTANDO`,
  `AGUARDANDO_EVIDENCIA`, `AGUARDANDO_EVENTO_EXTERNO`,
  `FERRAMENTA_INDISPONIVEL`, `CAPACIDADE_AUSENTE`,
  `AUTORIZACAO_AUSENTE`, `FALHA_TRANSITORIA`, `FALHA_TERMINAL`, or
  `EXECUCAO_ENCERRADA`.

For example, a content-quality gate may be `APROVADO` while a publication gate
is `NAO_AVALIADO` and its operational condition is
`AGUARDANDO_EVENTO_EXTERNO`. Tool unavailability never approves or rejects a
gate. Missing semantic capacity becomes `CAPACIDADE_AUSENTE`; the runner can
route the task to another authorized AI evaluator.

Changing an artifact creates a new digest. Evidence and assessments bound to
the previous digest become superseded for gate calculation. Targets also evolve
independently: failure for one destination does not invalidate another.

Every generated manifest declares:

```json
{
  "authoritative": false,
  "ledgerHead": "sha256:..."
}
```

It is a read model, not an input to canonical state.

The isolated gate calculator is internal. The public authoritative surface is
canonical state derivation after the ledger replay has independently derived
the producer, authorization scope, target, and complete producer lineage.
The npm package exposes only its root entrypoint; `dist/pipelineConteudo/*`
deep imports are blocked by the package `exports` map, including in the
generated public tarball.

## Open adapters and targets

An adapter declares an opaque `adapterId`, immutable version, accepted media
types, format profiles, deterministic constraints, required public metadata,
optional public metadata, and externally verifiable confirmation predicates.
`requiredMetadata + optionalMetadata` is the exact top-level allowlist signed
through the definition digest. Target metadata accepts only declared keys and
scalar public values. `accountScope` is a strict `account:<alias>` reference;
credentials and tokens remain outside the ledger and are resolved by the
external runner from that alias. Artifact metadata is prohibited in v1 until a
separate signed schema exists. Recursive DLP checks additionally reject common
secret key names, private-key material, JWTs, provider-token prefixes, and
authorization headers without echoing the detected value.
Deterministic-constraint configuration has an exact one-field numeric schema;
extra, ambiguous, or sensitive fields block the adapter before its constraints
can be copied into a public plan. Free-form operational `reason` text passes
the same credential detector before it can enter the signed ledger.

Public CLI failures expose static error codes and a sanitized command label;
filesystem exceptions, unknown subcommands, rejected schema field names, and
invalid trust identifiers are not echoed. Domain identifiers that belong to a
valid definition or signed ledger (such as stage, target, evidence, and
assessment IDs) remain public because they are required for planning,
traceability, and remediation; they are never credential storage.

Each stage declares an `adapterPolicy`:

- `NONE`: no adapter gate is introduced by the stage;
- `CONSTRAINTS`: require independently signed observations for the adapter's
  deterministic format constraints;
- `CONFIRMATION`: require the target adapter's externally verifiable
  confirmation predicates.

Pipeline definition v1 requires exactly one declared output per stage. A stage
that needs several artifacts must split them into semantically distinct stages,
preserving explicit lineage and dependency edges.

No platform literal is required by the core. A project-specific experience is
just a pipeline definition plus target configuration and can coexist with any
number of other channels and formats.

## CLI

The public surface is `sema conteudo`:

```bash
sema conteudo capabilities --json
sema conteudo validar <definition.json> --json
sema conteudo planejar <definition.json> --alvos-arquivo <targets.json> --json
sema conteudo validar-envelope --envelope-arquivo <envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --payload-type <type> --json
sema conteudo registrar <ledger.ndjson> --envelope-arquivo <envelope.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-id <id> --expected-head <sha256:...> --json
sema conteudo status <definition.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-arquivo <ledger.ndjson> --expected-head <sha256:...> --json
sema conteudo projetar <definition.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-arquivo <ledger.ndjson> --expected-head <sha256:...> --saida <manifest.json> --json
```

`--trust-root-digest` and `--revocation-digest` may also come from the
externally controlled `SEMA_CONTENT_TRUST_ROOT_DIGEST` and
`SEMA_CONTENT_REVOCATION_DIGEST` environment variables. If a value is present
in both sources, the values must match. `registrar`, `status`, and `projetar` also require the
externally retained `expectedHead`, including the genesis head for a new
ledger. This protects against stale concurrent append and detects truncation;
it does not turn a runner-controlled file into protected storage.

## External runner protocol

The runner may schedule, execute, retry, resume, and request more AI capacity.
It may submit signed envelopes and report operational conditions. It may not
write calculated verdicts, mark an execution complete, edit canonical history,
or promote its own claim to accepted evidence.

The runner advances only from `nextActions` derived by Sema. There is no native
human-approval transition. Organizations may build an external policy adapter
for human input if they need one, but that is outside this AI-native pipeline
and never a hidden fallback.
