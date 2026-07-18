# Build Week 2026: Pre-existing Work and New Work

This document separates the Sema codebase that existed before the OpenAI Build
Week submission period from the extension built during the period. It should be
read with the dated Git history and the primary Codex `/feedback` session.

## Submission-period boundary

The official submission period begins **July 13, 2026 at 9:00 AM Pacific Time**
and ends **July 21, 2026 at 5:00 PM Pacific Time**. This inventory is current
through July 18, 2026. The final judging boundary is defined by the immutable
`build-week-2026` source tag created after the final submission-period commit,
so this document does not attempt the impossible loop of listing the hash of
the commit that contains itself.

The last repository commit before the submission period is:

```text
f2501cb9b5f39e9560327c3697c9ce3a2288d317
2026-07-06T17:41:08-04:00
feat: adicionar gerador PHP governado
```

That commit is the comparison baseline for judging new work.

## What existed before Build Week

Before the submission period, Sema already had:

- the `.sema` domain-specific language and contract parser;
- a local TypeScript CLI;
- contract validation, inspection, semantic summaries, drift analysis, impact
  analysis, documentation gates, and code generation;
- generation targets for TypeScript, JavaScript, Python, PHP, Dart, Lua, HTML,
  and CSS;
- a family of domain profiles and rule packs;
- a public-source, local-first repository and npm distribution;
- experimental instructions for several different coding-agent clients;
- a local preflight/authorization concept and billing-related code that were
  still part of the architecture.

Judges should not treat those pre-existing capabilities alone as Build Week
work. They are the engine on which the new product direction was built.

## What was meaningfully extended during Build Week

### 1. Codex became Sema's first native integration

The project moved from a collection of shallow, duplicated instructions for
multiple assistants to one deliberate architecture:

- Codex is Sema's supported agent surface;
- `AGENTS.md` is the single durable repository protocol;
- `@semacode/cli` is the local engine and source of truth;
- a Sema plugin and required first-contact skill bootstrap projects before their
  `AGENTS.md` protocol exists;
- after initialization, the skill delegates to the generated repository
  protocol instead of keeping a second copy of the workflow alive.
- the generated protocol, context pack, index, and semantic links give each new
  Codex task a precise starting map instead of forcing it to rediscover the
  entire repository from scratch.

Managed instruction files for Claude, Cline, Cursor, Copilot, OpenCode, Roo, and
Windsurf were removed from the official surface. This was a product focus
decision, not a claim that Sema's semantic model applies only to Codex.

### 2. The plugin became installable and independently testable

Build Week added:

- `.agents/plugins/marketplace.json`;
- `plugins/sema/.codex-plugin/plugin.json`;
- the `plugins/sema/skills/sema/SKILL.md` bootstrap workflow;
- the official Sema logo in the plugin package;
- isolated tests that install the plugin from the marketplace and compare the
  installed skill and logo with the repository source;
- explicit verification that the plugin does not install a Sema MCP server.

This gives judges a test path from the published artifact without rebuilding
Sema from source.

### 3. Runtime authorization ceremony was removed

The local CLI no longer requires a Sema login, product-license check, activation
key, token, credit balance, billing service, control panel, or external
authorization request. The old `preflight` command and billing implementation
were removed from the public runtime.

The repository license still governs use and redistribution. Removing runtime
authorization does not remove the license and does not weaken platform policy,
filesystem permissions, or human approval.

### 4. First contact became safe and fail-closed

The initialization and synchronization paths were rebuilt so the bootstrap:

- preserves existing project files by default;
- requires an explicit `--force` decision before overwriting;
- validates the destination set before the first write;
- anchors writes to the real workspace and rejects path traversal;
- rejects symlink or junction escapes;
- protects against unsafe hardlink and identity-change conditions covered by
  the test suite;
- preserves malformed managed blocks and fails instead of deleting ambiguous
  user content;
- generates the Codex `AGENTS.md`, boot files, context pack, index, docs, and
  official examples as one coherent handshake.

### 5. Release evidence became part of the product

The public release path was expanded to verify:

- the source version, npm package version, plugin manifest version, and
  documentation agree;
- the tarball can be installed and executed in isolation;
- removed authorization and billing artifacts do not leak into the package;
- the remote GitHub marketplace installs the expected plugin and skill;
- the installed logo is byte-identical to the official Sema logo;
- GitHub HEAD and the published npm release describe the same distribution.

The current public artifact is `@semacode/cli@2.0.1` with npm distribution
SHA-1 `04cc9fd6ac059a70914c27715b5ed3cf58c781c0`.

### 6. Public positioning and boundaries were clarified

Public documentation now explains that:

- Sema is a semantic governance layer, not another code-completion assistant;
- Codex is the first native integration and software is the first proving
  ground;
- the runtime is local-first and requires no Sema account or hosted workspace;
- Sema governance never bypasses platform policy, security, permissions, law,
  or human approval;
- Sema is independent and does not claim OpenAI affiliation or endorsement.

### 7. A deterministic no-rebuild judge demo was added

The versioned Build Week showcase turns the main product claim into a repeatable
red-to-green proof:

- a healthy `approvePayment` implementation satisfies the contract and returns
  the required `receipt_id`;
- a partial implementation-only rename to `confirmPayment` creates a realistic
  broken semantic link;
- `sema drift` must detect the old `approvePayment` link as broken;
- repair must make contract and implementation converge on `confirmPayment`
  while preserving the receipt guarantee rather than deleting the inconvenient
  rule;
- behavior tests, `sema validar`, final drift, and documentary closure must all
  return green;
- the script restores its canonical final `confirmPayment` state even after a
  failed assertion.

Judges can run the scenario with Node.js 20+ and the published
`@semacode/cli@2.0.1`; no repository dependency installation, TypeScript build,
or local CLI rebuild is required.

## Foundation commits before showcase packaging

These commits established the Codex-native architecture and public `2.0.1`
distribution before the final showcase, video, and submission bundle was
packaged:

| Commit | Timestamp | Purpose |
| --- | --- | --- |
| `26e46f3a4d85f6c8887f3e9b15d9d596937b3505` | `2026-07-18T02:50:15-04:00` | Re-architect Sema as Codex-native, add the required bootstrap skill, secure local runtime, tests, release verification, and public boundary. |
| `001afc17e570049ae00ed5331db9e8b79601bf59` | `2026-07-18T03:00:26-04:00` | Normalize plugin-skill line endings in distribution verification. |
| `b5e56eaa024bee9f8e3bfdf3428ff212bd2174e5` | `2026-07-18T06:55:17-04:00` | Replace the provisional plugin icon with the official Sema logo and publish the aligned `2.0.1` release. |
| `1cf50f714ea283b0fdd65f0716cce3b087c548c2` | `2026-07-18T07:05:39-04:00` | Verify the official logo from the remotely installed Codex marketplace plugin. |

For the complete submission-period diff, compare baseline `f2501cb9...` with
tag `build-week-2026`:

```bash
git diff --stat f2501cb9b5f39e9560327c3697c9ce3a2288d317..build-week-2026
```

Line counts are supporting context, not the claim of meaningful extension; the
architectural, safety, distribution, demo, and user-workflow changes above are
the substantive work.

## Codex and GPT-5.6 evidence

Codex running GPT-5.6 was used to inspect, design, implement, test, release, and
document the Build Week extension. Evidence for the final submission consists
of:

1. the primary Codex `/feedback` Session ID:
   `019f72fa-88f6-7193-b1ec-d290ba0eab75`;
2. the timestamped commit list above;
3. the source diff from baseline `f2501cb9...` to the final submission commit;
4. the public demo video explaining the collaboration with Codex and GPT-5.6;
5. the release and distribution checks recorded in the repository.

GPT-5.6 was used through Codex as the engineering collaborator. It is not
presented as a hidden runtime API dependency of Sema.

## Recommended judging boundary

Evaluate the Build Week entry on the work added after the baseline:

- the focused Codex-native architecture;
- first-contact plugin and skill;
- durable `AGENTS.md` protocol;
- direct local runtime without authorization ceremony;
- safe, preservation-first initialization;
- isolated plugin, package, and remote-distribution verification;
- the resulting end-to-end experience from an unknown project to governed
  agent execution.

The pre-existing parser, DSL, drift engine, impact engine, profiles, and code
generators demonstrate that the new experience is built on a real product, but
they are not being misrepresented as work created during Build Week.

## References

- [Official challenge rules](https://openai.devpost.com/rules)
- [Submission copy](./submission.md)
- [Judge guide](./judge-guide.md)
