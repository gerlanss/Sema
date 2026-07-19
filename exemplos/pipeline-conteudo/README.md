# Content pipeline example

This fixture proves that the pipeline core is independent from a platform,
brand, or media type. One definition creates a global editorial core and two
isolated target branches: a long-form document and a spoken audio episode.
The same AI-native plan can add any number of channels and formats without
making this experience the only delivery path.

Definition v1 declares exactly one output per stage. Each stage also selects an
  `adapterPolicy`: `NONE`, `CONSTRAINTS`, or `CONFIRMATION`. Constraint gates are
  satisfied only by independently signed observations bound to the produced
  artifact, including an independently observed media type; producer metadata
  is not evidence of its own correctness.

```bash
sema conteudo validar exemplos/pipeline-conteudo/definicao.json --json
sema conteudo planejar exemplos/pipeline-conteudo/definicao.json --alvos-arquivo exemplos/pipeline-conteudo/alvos.json --json
```

The example intentionally contains no private keys, signed policy, trust pins,
ledger checkpoint, or signed events. In a live run, an authorized policy
  authority must sign a policy bound to the execution and complete target set
  through `runId` and `targetSetDigest`, with explicit `issuedAt` and `expiresAt`
  authorization bounds. Every event must be recorded within that interval, and
  every append also supplies that policy envelope. Keep the
  trust-root digest, current `revocationDigest`, and
required `expectedHead` outside the runner-controlled workspace. Generate
events in independently controlled producer, evaluator, and adapter processes;
  never commit production private keys to a Sema workspace. The adapter's
  `requiredMetadata + optionalMetadata` is the exact scalar public allowlist;
  artifact metadata is unavailable in v1. The runner resolves credentials
  externally from a strict `account:<alias>` reference.

Every gate declares separate deterministic-attester and semantic-AI quorums.
Use `content.evidence.attest:<evidenceType>` for ordinary attestations. Adapter
observations use the stricter
`content.adapter.attest:<adapterId>@<version>:<evidenceType>` capability and
signed adapter/version binding; a generic receipt capability is intentionally
insufficient.

The runner executes and resumes work from Sema's derived `nextActions`. It does
not calculate verdicts or edit completion state. Operational conditions remain
separate from gate verdicts, and every generated manifest is a non-authoritative
projection of the canonical ledger. There is no native human-review fallback.
