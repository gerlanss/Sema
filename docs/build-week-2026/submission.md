# OpenAI Build Week 2026 Submission

This is the canonical English submission record for Sema. The administrative
track is **Developer Tools**; that track describes the first proving ground,
not the product's ceiling. The final copy was reviewed in Gerlan's own voice
before submission, following the organizer's July 17 guidance against generic
AI-written descriptions.

## Paste-ready fields

**Project name**

Sema — The semantic governance layer for AI agents

**Tagline**

Codex starts from a semantic map, not a project-wide rescan.

**Administrative track**

Developer Tools

**Repository**

https://github.com/gerlanss/Sema

**Published package**

https://www.npmjs.com/package/@semacode/cli

**Demo video**

https://youtu.be/IXkIlC9FxIs

**Primary Codex `/feedback` Session ID**

`019f72fa-88f6-7193-b1ec-d290ba0eab75`

**Devpost project record**

- Project ID: `1349530`
- Slug: `sema-the-semantic-governance-layer-for-ai-agents`
- Submission ID: `1102882`
- Submission status: `Submitted`
- Canonical URL:
  https://devpost.com/software/sema-the-semantic-governance-layer-for-ai-agents

**Built with**

- Codex
- GPT-5.6
- Node.js
- TypeScript
- JavaScript
- npm
- `AGENTS.md`

## Exact Devpost submission fields

The Devpost plugin returned these live fields on July 18, 2026. Use the field
IDs to keep the final submission automation deterministic.

| Field ID | Form status | Final answer |
|---|---|---|
| `27945` — Submitter Type | Required | `Individual` (the project currently has one author) |
| `27946` — Country of Residence | Required | `Argentina` |
| `27947` — Category | Required | `Developer Tools` |
| `27948` — Code repository | Required | `https://github.com/gerlanss/Sema` |
| `27949` — Project/test link | Optional; complete it | Use the judge-only test-path answer below |
| `27950` — `/feedback` Session ID | Required | `019f72fa-88f6-7193-b1ec-d290ba0eab75` |
| `27951` — Dev tool installation/platform/testing | Optional in schema; required by event instructions for dev tools | Use the paste-ready answer below |

The deliverables require a video and do not require a website or zip file.

### Live submission state

After the final submission on July 18, 2026, the Devpost connector confirmed:

- project `1349530` is `published`;
- submission `1102882` is `Submitted` to OpenAI Build Week;
- the account relationships are both `registered` and `submitted`;
- country of residence: `Argentina`;
- category: `Developer Tools`;
- video URL: https://youtu.be/IXkIlC9FxIs;
- repository URL: https://github.com/gerlanss/Sema;
- submitted at: `2026-07-18T16:29:41.470-04:00`.

**Field `27949` — judge-only project/test path**

```text
No credentials or hosted account are required. Install the published CLI from
npm, then use the deterministic judge path in:
https://github.com/gerlanss/Sema/blob/main/docs/build-week-2026/judge-guide.md

The fastest test is:
node showcase/build-week-2026/demo/smoke-test.mjs

Expected result: exit code 0 and RESULT: VERIFIED.
```

**Field `27951` — installation, supported platform, and testing**

```text
Verified Build Week platform: Windows 11 Pro (build 26200).
Runtime: Node.js 20 or newer. The CLI is designed to be portable, but macOS and
Linux are not claimed as Build Week-verified platforms.

Install the public artifacts:
npm install --global @semacode/cli@2.0.1
codex plugin marketplace add gerlanss/Sema
codex plugin add sema@sema

Confirm the CLI:
sema --version
Expected: 2.0.1

No Sema account, API key, activation key, hosted workspace, or source build is
required. From a clone of the public repository, run:
node showcase/build-week-2026/demo/smoke-test.mjs

The command exits 0 only after the controlled partial rename is detected, the
receipt_id guarantee is preserved, contract and implementation converge on
confirmPayment, behavior tests pass, final drift is green, and documentation
closure succeeds.

Full instructions:
https://github.com/gerlanss/Sema/blob/main/docs/build-week-2026/judge-guide.md

If plugin marketplace installation is unavailable in the judge's Codex
environment, the CLI-only fallback in the judge guide creates the same durable
`AGENTS.md` protocol and omits only automatic first-contact skill discovery.
```

## Final submission checklist

- [x] Submitted only to the **Developer Tools** track.
- [x] Added the public demo video and primary `/feedback` Session ID.
- [x] Kept the narrated public YouTube demo under three minutes.
- [x] Used the single most representative core Codex task as the primary
  `/feedback` Session ID and documented the broader contribution in the README.
- [x] Preserved the pre-existing/new-work boundary in
  [new-work.md](./new-work.md).
- [x] Linked the public repository and no-rebuild judge path.
- [x] Linked the submission copy, new-work boundary, and judge guide from the
  repository README.
- [x] Submitted successfully as Devpost submission `1102882`.

## Short description

You tell Codex what you want. Instead of rediscovering the whole repository on
every task, Codex asks Sema for a living semantic map of the relevant contracts,
guarantees, documentation, and code links. Codex follows that map to the right
files, and Sema verifies that implementation, tests, drift, and documentation
still match what was agreed.

## Full description

The text between the markers below is the exact Devpost project description.
Keep the markers in this repository, but omit them from the submitted field.

<!-- devpost:description:start -->

You tell Codex what you want. Instead of rediscovering the whole repository
from scratch on every task, Codex asks Sema for a living semantic map: the
applicable contract, intent, rules, guarantees, required documentation, and
links to the relevant implementation. Codex follows that map to the right
files. Sema then verifies that contract, code, tests, drift, and documentation
still agree before the work can close.

That is the product. The primary workflow is human → Codex → Sema: the human
describes the intent, Codex operates Sema, and the repository preserves what
was agreed beyond one chat.

I did not start Build Week with an empty repository. I started with a working
Sema engine and the wrong product surface around it.

I use Sema 100% through Codex, but Sema was still trying to support every coding
assistant at once, and I was building a separate IDE based on OpenCode. During
Build Week I stopped doing both. That was the meaningful extension: make the
product match the way I actually use it, then prove the new path from install to
evidence.

The architecture is now deliberately simple:

- **`@semacode/cli` is the engine and source of truth.** It reads the local
  workspace, contracts, implementation, and evidence.
- **`AGENTS.md` is the durable handshake.** A new Codex task can discover the
  same project protocol without chat memory or a pasted master prompt.
- **The Sema plugin handles first contact.** It is needed before a project has
  its own `AGENTS.md`; after initialization, the repository protocol takes over.

I also removed the old login, activation, billing, and preflight ceremony from
the local runtime. A local tool should not have to ask a remote Sema service for
permission before it can govern files on the user's own machine. The license,
operating-system permissions, platform policies, repository authorization, and
human approval still apply.

The problem Sema addresses did not change. An agent can generate a patch in
seconds, but speed does not answer the harder questions: What did the human
intend? Which promises must survive? What else will this change affect? Does the
implementation still match the contract? What evidence makes the work done?

Sema externalizes those answers into semantic contracts and an executable local
workflow. A `.sema` contract describes tasks, inputs, outputs, rules, effects,
guarantees, tests, public surfaces, and links to real implementation files. The
CLI then lets an agent inspect the relevant contract, map impact, detect drift,
validate changes, discover required documentation, and close work with explicit
evidence.

The result is a governed loop:

> human intent → semantic contract → impact → agent execution → drift check → evidence

### Why I submitted it as Developer Tools

Developer Tools is the closest Build Week category because Sema's strongest
demonstration today is a working Codex integration for software repositories.
The underlying primitive is broader: it governs structured agent work wherever
intent, constraints, effects, and completion criteria matter.

The CLI already exposes ten profiles—author, software, workflow, operations,
legal, research, editorial writing, proposals, games, and conversations—with
their limitations stated explicitly. I demonstrate software because it is the
most concrete, reproducible test of the thesis, not because governance ends at
source code.

### What I want judges to try

The demo follows one end-to-end story rather than presenting a command catalog:

1. Install the published CLI and Codex plugin without rebuilding Sema.
2. Open a project with no Sema protocol and let the bootstrap create the first
   contract and `AGENTS.md` handshake while preserving existing files.
3. Open a new Codex task and ask it to complete a payment approval rename from
   `approvePayment` to `confirmPayment` without losing the contract's
   `receipt_id` guarantee.
4. Show that the implementation was only partially renamed while the semantic
   contract still points to the old symbol. Sema resolves the real link and
   blocks the mismatch before another change is built on top of it.
5. Complete the rename across contract and implementation without deleting the
   inconvenient guarantee.
6. Run behavior tests, contract validation, drift, and documentary closeout.
   Close only when the implementation, documentation, and evidence agree.

That is the claim in one small, reproducible example: the agent can still move
fast, but it cannot quietly redefine “done” while it works.

### Built through Codex and GPT-5.6

I used GPT-5.6 through Codex to inspect the old architecture, challenge the
direction, implement the plugin and safer initialization path, edit contracts,
run the Sema gates, and verify the published package. I made the product calls:
stop the separate IDE, stop shallow support for every assistant, keep the engine
local, use Codex as the first supported agent surface, and remove runtime
authorization ceremony. Codex helped turn those decisions into code and
evidence.

Sema does not call GPT-5.6 at runtime and does not require an OpenAI API key. It
is an independent product by OtimiTare and is not affiliated with or endorsed
by OpenAI.

Repository: https://github.com/gerlanss/Sema

No-rebuild judge path:
https://github.com/gerlanss/Sema/blob/main/docs/build-week-2026/judge-guide.md

<!-- devpost:description:end -->

## Internal judging map — do not paste as project description

The official Stage Two criteria are equally weighted. The evidence below is
organized so each criterion can be assessed independently.

### Technological Implementation

- A real TypeScript CLI is published as `@semacode/cli@2.0.1`.
- A real Codex marketplace plugin installs the first-contact Sema skill.
- The generated `AGENTS.md` protocol, Agent Context Pack, contract parser,
  validation, drift, impact analysis, documentation gates, and code generators
  operate on the local filesystem.
- Bootstrap preserves existing files by default and fails closed on unsafe
  symlink, junction, hardlink, malformed managed-block, or workspace-boundary
  conditions covered by the release tests.
- Release verification installs the public package and remote marketplace copy
  in isolation; it does not assume the source checkout is the product.
- A deterministic judge harness demonstrates a real red-to-green cycle: an
  incomplete `approvePayment` rename creates a broken semantic link, Sema
  detects it, the `receipt_id` guarantee remains intact, and the repaired state
  must pass tests, validation, drift, and documentary closure.

### Design

The route correction is also the design decision. I removed the separate IDE
and the pile of duplicated assistant instructions. A new project sees a thin
bootstrap; an initialized project carries its own protocol. The CLI returns
compact summaries and structured JSON with risks, missing evidence, and the
next required action. Warnings stay visible instead of becoming a cosmetic green
score.

### Potential Impact

The immediate audience is developers and teams using coding agents on real
repositories, where an incorrect “done” can create security, migration,
documentation, or operational failures. The broader opportunity is a common
contract layer for agents operating across structured human systems: software,
operations, research, documents, commercial workflows, and other domains where
intent and evidence must survive beyond one chat.

### Quality of the Idea

Most agent tooling improves generation, orchestration, or access to tools. Sema
addresses a different layer: governing what an agent is allowed to conclude
from the context it has. Its novelty is treating intent, impact, drift, and
evidence as executable product primitives shared by humans and agents—not as a
larger prompt or an after-the-fact checklist.

## How Codex and GPT-5.6 were used

I use Sema through Codex, and Codex running GPT-5.6 was the primary engineering
environment for this Build Week extension. The work included:

- auditing the pre-existing architecture and identifying the split between the
  local engine, first-contact bootstrap, and durable repository protocol;
- making the product decision to focus Sema's supported agent integration on
  Codex while keeping the engine domain-independent;
- implementing and reviewing the plugin, skill, secure initialization path,
  workspace-write protections, release checks, tests, and public documentation;
- running the Sema gates, package isolation tests, remote marketplace checks,
  and npm distribution verification;
- challenging the positioning so Developer Tools remains the submission track
  without shrinking Sema's long-term product thesis.

I made the product calls: stop building a separate IDE, stop maintaining shallow
support for every assistant, use Codex as the first supported agent surface,
keep the engine local and domain-independent, remove runtime authorization
ceremony, and define what counts as honest release evidence. Codex helped turn
those decisions into contracts, code, tests, documentation, and a public
distribution that could be checked instead of merely described.

GPT-5.6 was used through Codex to build and validate this extension. Sema does
**not** claim to call GPT-5.6 at runtime, and the project does not require an
OpenAI API key. The dated commits, primary Codex `/feedback` Session ID, and demo
voiceover provide the submission-period evidence.

Technical judges can use the
[no-rebuild judge path](https://github.com/gerlanss/Sema/blob/main/docs/build-week-2026/judge-guide.md)
and inspect the explicit
[pre-existing/new-work boundary](https://github.com/gerlanss/Sema/blob/main/docs/build-week-2026/new-work.md).

## Independence disclosure

Sema is an independent product by OtimiTare. It is not affiliated with, endorsed
by, sponsored by, or an official integration of OpenAI. “Codex-native” describes
Sema's product architecture and supported workflow. “OpenAI Build Week” is used
only to identify the event in which this project is being submitted.

## Submission references

- [OpenAI Build Week overview](https://openai.com/build-week/)
- [Official challenge rules](https://openai.devpost.com/rules)
- [Challenge FAQ](https://openai.devpost.com/details/faqs)
- [Codex `AGENTS.md` documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Sema new-work boundary](./new-work.md)
- [Judge installation and test guide](./judge-guide.md)
- [Launch kit and channel copy](./launch-kit.md)
