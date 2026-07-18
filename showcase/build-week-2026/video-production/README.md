# Build Week video production

This directory contains the reproducible production pipeline for the Sema OpenAI Build Week 2026 demo video. It is governed by `contratos/sema/build_week_video_production.sema`.

## Inputs

- The approved narration and storyboard in `docs/build-week-2026/`.
- Nine English ElevenLabs MP3 files in `work/narration-elevenlabs/`, named after the scene IDs in `production.json`.
- Voice provenance: ElevenLabs `Dan`, `Multilingual v2`, speed `1.12`.
- Real output captured from the local Build Week demo harness.
- The repository Sema logo.

The `work/` directory is intentionally ignored. The build checks all nine narration files before cleanup and never removes or replaces them. There is no SAPI or synthetic fallback inside the pipeline, and ffmpeg never time-stretches the narration.

## Clean-machine setup

Use Node.js 20 or newer. Dependencies and versions are pinned locally, so no root workspace manifest is changed:

```powershell
cd showcase/build-week-2026/video-production
npm ci
```

`npm ci` installs Sharp and static ffmpeg/ffprobe binaries under the ignored local `node_modules/` directory. Supply the nine approved MP3 inputs after installation.

## Produce and verify

From this directory:

```powershell
npm run produce
```

The command captures real harness evidence, builds the 1920x1080 H.264/AAC video with burned English captions, creates the 1280x720 thumbnail, and performs media plus visual verification. The final video must remain below 180 seconds.

Outputs:

- `sema-build-week-demo.mp4` — local and ignored until manually uploaded.
- `captions.srt` and `thumbnail.png` — versionable submission assets.
- `evidence/` — sanitized logs, hashes, media probe, contact sheet, and verification report.

No command uploads, publishes, or submits anything. Public evidence must not contain absolute workspace paths, secrets, tokens, or fabricated demo output.

## Recovery

If a build fails, keep `work/narration-elevenlabs/` intact, fix the reported input or tool problem, and rerun `npm run produce`. Generated frames, padded audio, and scene segments are disposable; the approved narration files are not.
