# OpenAI Build Week Demo Video Script

## Production target

- Working title: **Sema — From Human Intent to Verified AI Execution**
- Final runtime: **2:58** (178 seconds); the export must remain below 3:00
- Language: English narration with burned-in English captions; each SRT cue is
  limited to 42 characters and 8 words so ASS `FontSize=18` stays within two lines
- Delivery: public 16:9 video, 1920×1080 at 30 fps
- Audio: nine approved ElevenLabs MP3 files using **Dan**, **Multilingual v2**,
  speed **1.12**; no music, sound effects, fallback voice, or time-stretching
- Visual sources: deterministic scene frames built from sanitized real harness
  evidence, real VS Code captures of the demo files, and Sema-owned brand assets
- Editing: static frames and hard cuts only; no `zoompan`, simulated camera
  movement, or on-screen timecode badge

The narration below is the recording master. The film explains a Codex workflow,
but it is not presented as a live recording of the Codex interface. Do not
improvise product claims or replace the captured command evidence with mock
output.

## 0:00–0:13 — The failure mode

> AI agents can change code in seconds. But a real project is more than code:
> it carries intent, rules, and promises. When those disappear between tasks,
> speed becomes drift.

## 0:13–0:29 — What Sema is

> You tell Codex what you want. Instead of scanning the whole project from
> scratch on every task, Codex consults Sema for the context that matters, then
> works from a precise semantic map.

## 0:29–0:48 — Bootstrap

> On first contact, the real bootstrap runs in a small payments project with no
> Sema and no AGENTS.md. It checks the local CLI, creates the first living
> contract, and generates its AGENTS.md, the permanent handshake future Codex
> tasks read automatically.

## 0:48–1:03 — The contract points Codex to the code

> The living contract preserves your intent, rules, guarantees, and semantic
> links, leading Codex directly to the relevant code. Codex implements the
> request. Sema then verifies that implementation against the contract.

## 1:03–1:25 — A concrete change

> The task is concrete: complete a payment approval rename from approvePayment
> to confirmPayment without losing the receipt guarantee. A partial rename
> already exists in the code, while the semantic contract still points to the
> old symbol. It is a quiet mismatch that could poison the next change.

## 1:25–1:49 — Drift becomes visible

> Before editing, Codex asks Sema for context, required documentation, and
> drift. Sema resolves the contract against the implementation and stops the
> change: the old approvePayment link is broken. The result names the contract,
> the symbol, and the affected files. No guesswork, and no fake green check.

## 1:49–2:15 — Contract and code converge

> Codex inspects the applicable dot-sema contract, maps the impact, then updates
> the contract and implementation together. The business promise remains
> explicit: every approved payment returns a receipt ID. Validation passes, the
> symbol link resolves, tests pass, and drift returns green. Only then does Sema
> close the change with its required documentation recorded as evidence.

## 2:15–2:40 — Built through Codex and GPT-5.6

> I use Sema entirely through Codex. Build Week made me stop building a separate
> OpenCode-based IDE and stop spreading Sema across every assistant. With GPT-5.6 through
> Codex, I made the CLI the engine, AGENTS.md the handshake, and the plugin first
> contact—then verified the public package. Sema governs its own development.

## 2:40–2:58 — The larger thesis

> Software is the proving ground, not the boundary. The same chain—intent,
> context, contract, impact, execution, evidence—can govern any structured work
> performed by agents. Sema: from human intent to verified AI execution.

## End card

Keep this card visible through **2:58** underneath the end of the final
sentence. Do not append a hold beyond the 178-second master:

```text
SEMA
From human intent to verified AI execution
github.com/gerlanss/Sema  •  @semacode/cli
```

Do not describe Sema as an OpenAI product or imply endorsement. Codex is the
first native agent integration and software is the first proving ground; neither
is presented as the limit of Sema.
