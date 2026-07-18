# OpenAI Build Week Clarifications and Verification

Only the Brazil eligibility contradiction currently warrants an external
question. The official FAQ already resolves meaningful extensions and
`/feedback`. Save the exact wording, URL, access date, and interpretation for
every conclusion; ask the organizers only if a concrete gap remains.

## 1. Eligibility of a resident of Brazil — unresolved for prizes

The country list in the currently published Official Rules does not include
Brazil. At the same time, the Devpost submission form offers Brazil as a country
choice. That is a real interface/rules mismatch, but the dropdown does not amend
the rules or prove prize eligibility.

The Devpost connector reproduced the mismatch at `2026-07-18T12:29Z`:

- rules: geographic eligibility is `Only specific countries/territories
  included`; Brazil is absent from `geographic_included_countries`;
- submission field `27946`: `Please indicate your Country of Residence.`;
  `Brazil` is one of its options, and its own description says to consult the
  Official Rules for eligible countries.

> I live in Boa Vista, Roraima, Brazil and registered after receiving an
> invitation by email. The country list in the published Official Rules does
> not include Brazil, while the Devpost submission form does offer Brazil as a
> country choice. May a Brazilian resident submit a project and be eligible for
> judging and prizes? If yes, will the Official Rules be corrected, and may I
> rely on your written confirmation for this submission?

Required answer: an explicit **yes or no** covering submission, judging, and
prize eligibility—not only attendance, registration, or form access. The public
Sema launch, repository, package, demo, and technical discussion do not depend
on that answer; only claims about event/prize eligibility do.

The question is publicly visible in the [Devpost forum topic about
Brazil](https://openai.devpost.com/forum_topics/44359-what-about-brazil?page=1).
As of July 18, 2026, it is awaiting an official organizer answer. The earlier
reply in that topic came from another participant and is not an official ruling.

### Brazil-only message

> Hi Build Week team — I need a written eligibility clarification. I live in
> Boa Vista, Roraima, Brazil and registered after receiving an invitation by
> email. The country list in the published Official Rules does not include
> Brazil, while the Devpost submission form offers Brazil as a country choice.
> May a Brazilian resident submit a project and be eligible for judging and
> prizes? If yes, will the Official Rules be corrected, and may I rely on your
> written confirmation for this submission? Thank you.

## 2. Meaningful extension of a pre-existing project — resolved by FAQ

The [official Build Week FAQ](https://openai.devpost.com/details/faqs) allows a
pre-existing project when the submission clearly documents what is new and
provides evidence that the extension was built with Codex and/or GPT-5.6 during
the Submission Period. The FAQ gives timestamped session logs and commit history
as examples of acceptable evidence.

Submission action:

- State the precise boundary between pre-existing Sema and the Build Week work:
  Codex bootstrap plugin and skill, persistent `AGENTS.md` handshake,
  local-first workflow changes, verification, and release evidence.
- Provide the dated commit range and a concise before/after changelog.
- Preserve the representative Codex session evidence and timestamped work.
- Link claims in the submission to concrete commits, checks, and demo output.

Status: **resolved by the official FAQ; no organizer question required**.

## 3. `/feedback` and Codex Session ID — resolved by FAQ

The [official Build Week FAQ](https://openai.devpost.com/details/faqs) says to
run `/feedback` in the Codex thread where most of the core work occurred. If
multiple threads were significant, choose the most representative thread. Use
that as the primary Session ID and document Codex's contribution to the rest of
the workflow in the README.

Submission action:

- Choose the single thread with the strongest end-to-end core evidence.
- Run `/feedback` in that thread and preserve its primary Session ID.
- Describe the material contribution of the other Codex threads in the README.
- Keep supporting session and commit evidence available without presenting
  several IDs as competing primaries.

Status: **resolved by the official FAQ; one representative primary Session ID**.

## Internal decision: GPT-5.6 through Codex — not an organizer question

The Build Week extension was genuinely developed with GPT-5.6 through Codex.
That use will be stated and demonstrated directly. Sema is a local-first
CLI/plugin and does not need an OpenAI API call at runtime, so we will not add a
cosmetic model call merely to imply deeper integration. This is a non-blocking
product decision, not a question for the organizers.

## Evidence log

| Item | Status | Source or channel | Date | Permalink or saved evidence | Confirmed interpretation |
|---|---|---|---|---|---|
| Brazil eligibility | Question published; awaiting official organizer answer | Official Rules, Devpost submission field `27946`, and Devpost forum | 2026-07-18 | [Official Rules](https://openai.devpost.com/rules); [Brazil topic](https://openai.devpost.com/forum_topics/44359-what-about-brazil?page=1) | Brazil is absent from the rules' included-country list but present in the submission dropdown; neither form access nor a participant reply is an eligibility ruling |
| Meaningful extension | Resolved | Official FAQ | 2026-07-18 | [Build Week FAQ](https://openai.devpost.com/details/faqs) | Clearly document new work during the Submission Period with Codex/GPT-5.6 evidence |
| `/feedback` / Session ID | Resolved | Official FAQ | 2026-07-18 | [Build Week FAQ](https://openai.devpost.com/details/faqs) | Use one representative core thread; document the rest in README |
| GPT-5.6 via Codex | Internal decision recorded | Local evidence | 2026-07-18 | — | No cosmetic runtime API integration |
