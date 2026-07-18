# OpenAI Build Week Demo Storyboard

## Direction

The film is a compact product proof, not a feature tour. Its visual grammar is
**request → semantic map → relevant code → verification**. Every result shown
in the film comes from the reproducible local harness or the versioned demo
files.

- Master duration: **2:58** (178 seconds), split into the nine exact scene
  windows declared in `production.json`
- Format: 1920×1080, 16:9, 30 fps
- Production method: deterministic scene frames made from sanitized real
  harness evidence, real VS Code captures of the demo contract and code, and
  Sema-owned repository assets
- Codex disclosure: the narration describes the real Codex workflow, but the
  film does **not** claim to be a live recording of the Codex interface
- Audio: nine approved ElevenLabs MP3 files using **Dan**, **Multilingual v2**,
  speed **1.12**; no music, fallback voice, or audio time-stretching
- Edit: static frames with hard cuts at the scene boundaries; no `zoompan`,
  simulated camera movement, push-in, pan, or on-screen timecode badge
- Captions: burned-in English at ASS `FontSize=18`, `MarginV=10`; each SRT cue
  is limited to 42 characters and 8 words so it remains within two lines and
  below the evidence crop
- Privacy: no account email, local username, notification, token, secret, or
  absolute workspace path may appear in a public frame or evidence file

## Scene plan

| Time | Duration | Picture and action | Real proof used | Edit and review |
|---|---:|---|---|---|
| 0:00–0:13 | 13s | Static cold open contrasting the stale semantic link `approvePayment` with implementation symbol `confirmPayment`. Keep the `receipt_id` promise visible. | Sanitized `demo-output.log`, `payment.sema`, and the broken implementation fixture. | Hard cut in. No motion and no timecode badge. |
| 0:13–0:29 | 16s | Show the real workflow as **your request → Codex consults Sema → precise semantic map**, with an explicit **no full-project rescan** outcome. | Product model, real payment-domain identifiers, and Sema-owned logo. | The viewer must understand that Sema prevents Codex from rediscovering the whole project on every task. No camera movement. |
| 0:29–0:48 | 19s | Show the clean bootstrap pre-state beside the first living contract and generated `AGENTS.md` handshake evidence. | Sanitized output from `prepare-bootstrap.mjs` and the generated bootstrap files. | The old **Sema CLI ausente** bar must not appear. This is an evidence composition, not a live Codex capture. |
| 0:48–1:03 | 15s | Show the real `.sema` contract in VS Code as a maintained repository artifact, then connect its intent, rules, guarantees, and semantic links to targeted code and verification. | Real VS Code capture of `payment.sema` plus sanitized project identifiers. | Make **contract → relevant code → verified against contract** immediately legible. Do not imply autonomous contract updates. |
| 1:03–1:25 | 22s | Place real VS Code captures of the stale contract and partially renamed implementation side by side under the exact change request. | Real VS Code captures of `payment.sema` and `payment.broken.mjs`; `receipt_id` remains legible. | Fixed crop only. No digital zoom, pan, or timecode badge. |
| 1:25–1:49 | 24s | Keep the stale contract capture visible next to the blocking drift result. | Real VS Code contract capture plus sanitized red drift evidence naming `approvePayment`. | Hold the decisive fields long enough to read; no terminal animation. |
| 1:49–2:15 | 26s | Replace the stale contract with the corrected VS Code capture and pair it with tests, validation, green drift, and documentary closure. | Real VS Code capture of the corrected contract plus sanitized green harness evidence. | Hard cut from red to green; preserve `receipt_id`, `RESULT: VERIFIED`, and a static final hold. |
| 2:15–2:40 | 25s | Show the route correction and self-governance proof: CLI, `AGENTS.md`, plugin first contact, version, and verified package evidence. | Sanitized capture/build manifests and real demo output. | Static evidence panels only; no live Codex claim or scrolling feature list. |
| 2:40–2:58 | 18s | Return to the domain-neutral semantic chain and finish on the Sema logo, repository, and package. | Sema-owned logo and repository/package identifiers. | Keep the end card visible through 2:58; do not append an extra hold. |

## Evidence continuity

The proof chain must stay reproducible and honest:

1. `capture-evidence.mjs` runs the bootstrap, demo, and smoke harnesses and saves
   their sanitized outputs plus `capture-manifest.json`;
2. `build.mjs` composes the nine static scenes from those outputs, the real VS
   Code captures, the approved narration files, and Sema-owned assets;
3. the partial rename remains `approvePayment` in the stale contract and
   `confirmPayment` in the implementation until the controlled correction;
4. the correction preserves the `receipt_id` guarantee and finishes with tests,
   validation, clean drift, and documentary closure;
5. `verify.mjs` confirms the 178-second media target, narration provenance,
   required sources, captions, and the absence of `zoompan` and rendered
   `scene.timecode`;
6. review frames at 1, 14, 31, 50, 66, 88, 116, 145, and 171 seconds provide a
   scene-by-scene contact sheet for human review. In particular,
   `frame-031.png` and `frame-050.png` must show the bootstrap/handshake cut
   without the retired **Sema CLI ausente** bar or a timecode badge.

Never splice output from a different scenario into this film and never replace
a failed harness result with designed copy that merely looks successful.

## Production and review checklist

- Confirm `production.json` totals exactly 178 seconds with contiguous scene
  boundaries from 0:00 through 2:58.
- Confirm all nine `work/narration-elevenlabs/<scene-id>.mp3` inputs exist and
  retain the ElevenLabs Dan / Multilingual v2 / speed 1.12 provenance.
- Do not accelerate, synthesize, or replace the approved narration to fit.
- Regenerate the real harness evidence before the final build.
- Keep the VS Code captures readable at 1080p and crop only unrelated editor
  chrome; do not fabricate code, contract text, or CLI results.
- Run the final verifier and inspect `evidence/contact-sheet.png`, especially
  the bootstrap, handshake, red-drift, and green-convergence frames.
- Confirm every SRT cue is at most 42 characters and 8 words; any three-line
  caption or caption entering the evidence crop blocks approval.
- Confirm there is no on-screen timecode badge, no **Sema CLI ausente** bar, no
  movement effect, and no exposed private path or identifier.
- Confirm no music, stock footage, external logo, sound effect, or other
  third-party creative asset entered the final export.
