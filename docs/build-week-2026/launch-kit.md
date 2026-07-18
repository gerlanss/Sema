# Sema Build Week 2026 Launch Kit

This is the publication runbook and paste-ready English copy for the Sema
Build Week release. The launch is about the product and the work; it does not
depend on prize eligibility.

## Source-of-truth links and values

- Repository: https://github.com/gerlanss/Sema
- npm package: https://www.npmjs.com/package/@semacode/cli
- Current verified public CLI: `@semacode/cli@2.0.1`
- Submission deadline: July 21, 2026 at 5:00 PM Pacific Time
  (`2026-07-22T00:00:00Z`, 8:00 PM in Boa Vista/Manaus time)
- Devpost project ID: `1349530`
- Devpost project slug: `sema-the-semantic-governance-layer-for-ai-agents`
- Published Devpost project URL:
  https://devpost.com/software/sema-the-semantic-governance-layer-for-ai-agents
- Demo video: `[ADD PUBLIC YOUTUBE URL]`
- Final source snapshot: https://github.com/gerlanss/Sema/tree/build-week-2026

If the final package version changes, replace `2.0.1` everywhere only after the
CLI, npm package, plugin manifest, repository docs, and isolated install check
all agree. Do not publish channel copy with unresolved placeholders.

## Narrative to preserve

Lead with the product benefit; use the correction of route as the authentic
Build Week story behind it:

1. Instead of rediscovering an entire repository for every task, Codex asks
   Sema for a living semantic map of the relevant intent, rules, guarantees,
   documentation, and code links, then Sema verifies the result.
2. Gerlan uses Sema entirely through Codex.
3. Before Build Week, Sema was spreading itself across shallow integrations for
   several assistants while a separate IDE based on OpenCode was also being
   explored.
4. During Build Week, both directions were stopped.
5. The CLI became the engine and source of truth, `AGENTS.md` became the durable
   handshake, and the plugin became the required first-contact layer before a
   project has that handshake.
6. Login, activation, billing, and remote preflight ceremony were removed from
   the local runtime because a local tool should not need permission from a
   remote Sema service to govern local files.
7. The deterministic demo proves the result with a partial payment rename,
   `sema drift`, a preserved `receipt_id` guarantee, tests, validation, and
   contract and implementation converging on `confirmPayment`, followed by
   documentary closure.

Use this independence line wherever the surrounding context could imply an
official relationship:

> Sema is an independent product by OtimiTare. It is not affiliated with or
> endorsed by OpenAI.

Accurate model wording is **built with GPT-5.6 through Codex**. Do not say that
Sema is powered by GPT-5.6 at runtime; it has no such runtime dependency.

## Publication order

### 0. Lock the evidence

Before posting anything:

- finish the final submission-period commit;
- run the judge smoke test from a clean checkout or equivalent isolated state;
- verify the public npm package and remote plugin installation;
- publish the under-three-minute YouTube demo with English narration;
- replace the video URL and primary `/feedback` Session ID in the submission;
- check every public link in a signed-out browser session;
- confirm no screenshot or video frame exposes email, tokens, local usernames,
  notifications, or unrelated tabs.

The FAQ already settles two administrative points: a pre-existing project may
submit a meaningful, evidenced extension, and one representative core Codex
thread should provide the primary `/feedback` Session ID. Do not create new
organizer questions for those resolved points.

### 1. Publish the governed source snapshot

The repository contract deliberately keeps GitHub Releases and release assets
absent. Do not weaken that boundary for a marketing page. After the final
submission commit is on `main`, create and push the annotated tag
`build-week-2026`. The tag gives every later channel a stable, immutable source
snapshot without inventing a second distribution surface.

**Tag annotation**

```text
Sema 2.0.1 — the Codex route correction built during OpenAI Build Week 2026
```

**Stable links**

- Source snapshot: https://github.com/gerlanss/Sema/tree/build-week-2026
- Judge guide: https://github.com/gerlanss/Sema/blob/build-week-2026/docs/build-week-2026/judge-guide.md
- What changed: https://github.com/gerlanss/Sema/blob/build-week-2026/docs/build-week-2026/new-work.md

The published npm package remains `@semacode/cli@2.0.1`; the tag versions the
showcase, documentation, and judge harness around that already verified runtime.

### 2. Publish the YouTube demo

Publish on the `gerlanss` channel (`UCHtafZRNuILhpvPmyWY6DYg`) as **Public**,
not made for kids, in **Science & Technology**, using the standard YouTube
license and `showcase/build-week-2026/video-production/thumbnail.png`.

**Title candidates**

1. `Sema: The Semantic Governance Layer for AI Agents`
2. `AI Agents Move Fast. Sema Makes “Done” Verifiable.`
3. `From Prompt Context to Verified Execution — Sema + Codex`

Use candidate 1. It names the product and category directly, and every promise
in it is delivered by the demo.

**Description**

```text
Every new AI task can waste time rediscovering the same repository—and still
forget the promise that mattered. Sema gives Codex a living semantic map of the
relevant intent, rules, guarantees, documentation, and code links. Codex follows
that map to the right files, and Sema verifies the result.

This under-three-minute OpenAI Build Week demo shows Sema governing a real
Codex workflow: a partial approvePayment → confirmPayment rename breaks the
semantic link, Sema stops the change, the receipt_id guarantee survives, and
the work closes only after contract, code, tests, drift, and documentation
agree.

Source snapshot: https://github.com/gerlanss/Sema/tree/build-week-2026
Judge guide: https://github.com/gerlanss/Sema/blob/build-week-2026/docs/build-week-2026/judge-guide.md
Devpost: https://devpost.com/software/sema-the-semantic-governance-layer-for-ai-agents
npm: https://www.npmjs.com/package/@semacode/cli

00:00 Speed without memory becomes drift
00:13 What Sema is
00:29 First contact through the Sema plugin
00:48 A new Codex task reads AGENTS.md
01:03 Complete the payment rename
01:25 Sema makes drift visible
01:49 Contract and code converge
02:15 Built through Codex and GPT-5.6
02:40 From human intent to verified execution

Built with GPT-5.6 through Codex. Sema does not call GPT-5.6 at runtime and does
not require an OpenAI API key. This deterministic film uses sanitized real
harness evidence and real VS Code captures; it is not a live Codex recording.
Narration was generated with ElevenLabs Dan, Multilingual v2, at speed 1.12.

Sema is an independent product by OtimiTare. It is not affiliated with or
endorsed by OpenAI.

Technical criticism is welcome: what part of the
contract → drift → evidence loop should become clearer next?

#AIAgents #Codex #DeveloperTools
```

**Tags**

```text
Sema, AI agents, Codex, GPT-5.6, semantic contracts, semantic governance,
developer tools, OpenAI Build Week, local-first AI
```

### 3. Finish the Devpost project record

Use published project `1349530` with slug
`sema-the-semantic-governance-layer-for-ai-agents`. Paste the canonical fields
from [submission.md](./submission.md). The live project description is exactly
the text between `<!-- devpost:description:start -->` and
`<!-- devpost:description:end -->`, without the marker comments. Add the public
video, repository, package, `Built with` values, and primary `/feedback` Session
ID, then re-read the rendered page instead of trusting the editor preview.

Brazil is absent from the country list in the published Official Rules while
Brazil is present in the submission dropdown. Form access does not settle prize
eligibility. Complete the project page if the platform allows it, but do not say
that prize eligibility is confirmed unless an organizer or corrected rule says
so. The repository, package, demo, discussion, and public launch continue either
way.

### 4. Start one Devpost discussion

Do not turn the discussion into a pasted submission. Lead with the route
correction, show the proof, and ask for technical criticism.

**Title**

```text
Showcase: Sema gives Codex a contract it cannot quietly redefine
```

**Body**

```markdown
I use Sema entirely through Codex, so Build Week forced a useful decision. I
stopped building a separate Sema IDE and stopped pretending that shallow support
for every coding assistant was a product strategy.

The new path is smaller and more honest: the CLI is the local engine,
`AGENTS.md` is the durable handshake for later Codex tasks, and a thin plugin
handles first contact before the project has that handshake. I also removed the
old login/preflight ceremony; a local tool should not need permission from a
remote Sema service to govern your own folder.

The demo is deliberately tiny. Code renames `approvePayment` to
`confirmPayment`, but the semantic contract still points to the old symbol.
Sema catches the broken link, keeps the `receipt_id` business guarantee intact,
and refuses to call the change complete until tests, validation, drift, and
documentation evidence agree.

Demo: [DEMO_URL]
Repository: https://github.com/gerlanss/Sema
Judge path: https://github.com/gerlanss/Sema/blob/main/docs/build-week-2026/judge-guide.md

The question I would most value feedback on: is the contract/drift/evidence loop
clear from the demo, or is any part still hidden behind Sema vocabulary?

Sema is an independent product by OtimiTare and is not affiliated with or
endorsed by OpenAI.
```

### 5. Publish the X thread

Post after the source tag, video, and Devpost page are public. Keep the first post
under the platform limit after inserting the URL.

**Post 1**

```text
Every new Codex task should not have to rediscover the whole repository. Sema gives it a living semantic map of intent, guarantees, docs, and code links—and verifies the result. During Build Week I rebuilt Sema around that workflow. [DEMO_URL]
```

**Post 2**

```text
The architecture now has 3 jobs: @semacode/cli is the local engine. AGENTS.md is the durable handshake. The plugin handles first contact. I removed login/preflight ceremony too—a local tool should not ask a remote Sema service for permission to govern your files.
```

**Post 3**

```text
The demo applies a partial payment rename, catches the broken semantic link, preserves the receipt_id guarantee, and closes only when code, contract, tests, drift, and docs agree. Repo: https://github.com/gerlanss/Sema
```

Reply to the thread with the Devpost project URL instead of squeezing every link
into the first post. If independence is unclear in the surrounding conversation,
add: `Independent OtimiTare project; not affiliated with or endorsed by OpenAI.`

### 6. Publish the LinkedIn post

```text
I spent part of OpenAI Build Week deleting the wrong future for Sema.

I use Sema 100% through Codex, but the project was still trying to support every
coding assistant at once. I was also exploring a separate IDE based on OpenCode.
Both directions added surface area without matching how I actually worked.

So I corrected the route.

The Sema CLI is now the local engine and source of truth. AGENTS.md is the
durable handshake that a new Codex task can discover without chat memory. A
small plugin handles first contact before a project has that handshake.

I also removed the old login, activation, billing, and preflight ceremony from
the local runtime. A local tool should not need permission from a remote Sema
service before it can govern files on the user's own machine.

The public demo is intentionally small: a payment function is only partially
renamed. Sema detects that the contract still points to the old symbol, preserves
the receipt_id guarantee, and will not close the change until tests, validation,
semantic drift, and documentation evidence agree.

That is the larger idea behind Sema: an agent can move quickly without being
allowed to quietly redefine what “done” means.

Demo: [DEMO_URL]
Repository: https://github.com/gerlanss/Sema
Package: https://www.npmjs.com/package/@semacode/cli

Built with GPT-5.6 through Codex. Sema is an independent OtimiTare product and
is not affiliated with or endorsed by OpenAI.
```

Recommended visual: the final demo frame or a short native clip showing the red
broken link becoming a verified green result. Alt text:

```text
Sema terminal demo detecting a broken approvePayment semantic link, preserving the receipt_id guarantee, and ending with RESULT: VERIFIED.
```

### 7. Publish to Hacker News, then one relevant Reddit community

Do not post the same promotional paragraph everywhere at the same minute. Post
to Hacker News first, participate in the discussion, then use Reddit only in a
community whose current rules allow project/self-promotion posts.

**Hacker News title**

```text
Show HN: Sema – a semantic map and drift checks for Codex
```

**Hacker News text**

```text
I use Sema entirely through Codex. During Build Week I stopped building a
separate Sema IDE and removed shallow support files for every assistant. The
architecture is now a local Node CLI, AGENTS.md as the persistent project
protocol, and a small Codex plugin only for first contact.

The CLI reads .sema contracts that link intent, rules, guarantees, effects, and
tests to real implementation files. The demo creates a controlled partial
function rename, verifies that drift catches the broken link, and proves the
receipt guarantee was not deleted just to get green.

No Sema account, hosted workspace, API key, or runtime model call is required.
The package and judge demo are public here:

https://github.com/gerlanss/Sema
[DEMO_URL]

I would especially value criticism of the contract format and whether the
failure/repair evidence is understandable without knowing Sema first.
```

**Reddit title**

```text
I stopped building Sema as its own IDE and made Codex + AGENTS.md the real interface
```

**Reddit text**

```text
I use Sema entirely through Codex, but the project had drifted toward two things
I did not actually need: its own IDE and shallow support for every coding
assistant. Build Week became the excuse to cut both.

Now the CLI is the local engine, AGENTS.md is the persistent project handshake,
and a thin plugin handles only the first contact. The demo tests the part I care
about: code is partially renamed, the contract still points to the old symbol,
and Sema blocks completion without sacrificing the receipt guarantee.

Demo: [DEMO_URL]
Code and judge path: https://github.com/gerlanss/Sema

I am looking for technical feedback, especially on whether this kind of
contract/drift/evidence loop would help in a real agent-driven repository or
just add ceremony.

Independent OtimiTare project; not affiliated with or endorsed by OpenAI.
```

## Response rules after launch

- Answer technical criticism with a command, file, test, or documented boundary
  whenever possible.
- Do not claim macOS or Linux as Build Week-verified platforms until equivalent
  evidence exists.
- Do not call warnings “passed governance”; explain what is syntactically valid
  and what evidence is still missing.
- Do not argue that the Devpost country dropdown overrides the Official Rules.
- If an organizer clarifies Brazil eligibility, update
  [questions.md](./questions.md) and the submission record before repeating the
  claim elsewhere.
- If a channel asks whether Sema is an OpenAI product, use the independence line
  verbatim and then explain the CLI/`AGENTS.md`/plugin architecture.
- Record final URLs and publication timestamps in the checklist below.

## Publication record

| Channel | URL | Published at | Status / follow-up |
|---|---|---|---|
| GitHub source tag | `https://github.com/gerlanss/Sema/tree/build-week-2026` | `[ADD]` | `[ADD]` |
| YouTube demo | `[ADD]` | `[ADD]` | `[ADD]` |
| Devpost project | `[ADD]` | `[ADD]` | `[ADD]` |
| Devpost discussion | `[ADD]` | `[ADD]` | `[ADD]` |
| X | `[ADD]` | `[ADD]` | `[ADD]` |
| LinkedIn | `[ADD]` | `[ADD]` | `[ADD]` |
| Hacker News | `[ADD]` | `[ADD]` | `[ADD]` |
| Reddit | `[ADD]` | `[ADD]` | `[ADD]` |
