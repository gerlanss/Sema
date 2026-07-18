// SEMA-GOVERNED: sema.showcase.build_week_2026.video_production
// Contract: contratos/sema/build_week_video_production.sema
// Descricao: Verifica o filme final, sua proveniência determinística e as evidências visuais de revisão.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const productionDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(productionDir, "../../..");
const evidenceDir = path.join(productionDir, "evidence");
const reviewDir = path.join(evidenceDir, "review-frames");
const videoPath = path.join(productionDir, "sema-build-week-demo.mp4");
const thumbnailPath = path.join(productionDir, "thumbnail.png");
const captionsPath = path.join(productionDir, "captions.srt");
const configPath = path.join(productionDir, "production.json");
const buildPath = path.join(productionDir, "build.mjs");
const buildManifestPath = path.join(evidenceDir, "build-manifest.json");
const captureManifestPath = path.join(evidenceDir, "capture-manifest.json");
const sharp = require(path.join(productionDir, "node_modules", "sharp"));
const ffmpeg = path.join(productionDir, "node_modules", "ffmpeg-static", "ffmpeg.exe");
const ffprobe = require(path.join(productionDir, "node_modules", "ffprobe-static")).path;
const reviewTimestamps = [1, 14, 31, 50, 66, 88, 116, 145, 171];
const captionCharacterLimit = 42;
const captionWordLimit = 8;

const run = (binary, args, label) => {
  const result = spawnSync(binary, args, {
    cwd: productionDir,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

const fileInfo = async (file) => {
  if (!file) return null;
  try {
    return await stat(file);
  } catch {
    return null;
  }
};

const sha256 = async (file) => {
  const info = await fileInfo(file);
  if (!info?.isFile()) return null;
  return createHash("sha256").update(await readFile(file)).digest("hex");
};

const isInside = (base, target) => {
  const relative = path.relative(base, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
};

const resolveManifestSource = (value) => {
  if (typeof value !== "string" || path.isAbsolute(value)) return null;
  const normalized = value.replaceAll("\\", "/");
  const base = normalized.startsWith("docs/") ||
    normalized.startsWith("showcase/") ||
    normalized === "logo.png"
    ? repoRoot
    : productionDir;
  const resolved = path.resolve(base, ...normalized.split("/"));
  return isInside(repoRoot, resolved) ? resolved : null;
};

const parseTimePoint = (minutes, seconds) => Number(minutes) * 60 + Number(seconds);

const timelineIsExact = (config) => {
  let cursor = 0;
  for (const scene of config.scenes ?? []) {
    const match = /^(\d+):([0-5]\d)–(\d+):([0-5]\d)$/u.exec(scene.timecode ?? "");
    if (!match) return false;
    const start = parseTimePoint(match[1], match[2]);
    const end = parseTimePoint(match[3], match[4]);
    if (start !== cursor || end - start !== Number(scene.durationSeconds)) return false;
    cursor = end;
  }
  return cursor === 178 && cursor === Number(config.targetDurationSeconds);
};

const cropIsValid = (crop) => crop &&
  [crop.left, crop.top, crop.width, crop.height].every(Number.isFinite) &&
  crop.left >= 0 && crop.top >= 0 && crop.width > 0 && crop.height > 0;

export async function verifyVideoProduction() {
  const [config, buildManifest, captureManifest, buildSource, captions] = await Promise.all([
    readJson(configPath),
    readJson(buildManifestPath),
    readJson(captureManifestPath),
    readFile(buildPath, "utf8"),
    readFile(captionsPath, "utf8"),
  ]);

  const probe = JSON.parse(
    run(
      ffprobe,
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", videoPath],
      "ffprobe",
    ).stdout,
  );
  const videoStream = probe.streams.find((stream) => stream.codec_type === "video");
  const audioStream = probe.streams.find((stream) => stream.codec_type === "audio");
  const durationSeconds = Number(probe.format.duration);
  const videoInfo = await fileInfo(videoPath);
  const fileSizeBytes = videoInfo?.size ?? 0;
  const captionCount = (captions.match(/^\d+$/gm) ?? []).length;
  const captionTexts = captions
    .trim()
    .split(/\r?\n\r?\n/u)
    .map((cue) => cue.split(/\r?\n/u).slice(2).join(" ").trim())
    .filter(Boolean);
  const captionLengths = captionTexts.map((text) => ({
    characters: [...text].length,
    words: text.split(/\s+/u).length,
  }));
  const thumbnail = await sharp(thumbnailPath).metadata();

  const sourceValues = [
    buildManifest.sources?.narrationMaster,
    buildManifest.sources?.narrationDirectory,
    buildManifest.sources?.storyboard,
    buildManifest.sources?.logo,
    ...(Array.isArray(buildManifest.sources?.evidence) ? buildManifest.sources.evidence : []),
    ...(Array.isArray(buildManifest.sources?.visualCaptures)
      ? buildManifest.sources.visualCaptures
      : []),
  ];
  const resolvedSources = sourceValues.map(resolveManifestSource);
  const sourceInfo = await Promise.all(resolvedSources.map(fileInfo));
  const evidenceValues = Array.isArray(buildManifest.sources?.evidence)
    ? buildManifest.sources.evidence
    : [];
  const evidenceFiles = evidenceValues.map(resolveManifestSource);
  const visualCaptureValues = Array.isArray(buildManifest.sources?.visualCaptures)
    ? buildManifest.sources.visualCaptures
    : [];
  const visualCaptureFiles = visualCaptureValues.map(resolveManifestSource);
  const narrationFiles = (config.scenes ?? []).map((scene) =>
    path.join(productionDir, config.narration?.directory ?? "", `${scene.id}.mp3`)
  );
  const narrationInfo = await Promise.all(narrationFiles.map(fileInfo));

  const cropValues = Object.values(buildManifest.sources?.visualCaptureCrops ?? {});
  const requiredHashTargets = {
    video: videoPath,
    thumbnail: thumbnailPath,
    captions: captionsPath,
    demoLog: path.join(evidenceDir, "demo-output.log"),
    vscodeCodeBroken: visualCaptureFiles[0],
    vscodeContractBroken: visualCaptureFiles[1],
    vscodeContractGreen: visualCaptureFiles[2],
    buildSource: buildPath,
  };
  const actualHashes = Object.fromEntries(
    await Promise.all(
      Object.entries(requiredHashTargets).map(async ([name, file]) => [name, await sha256(file)]),
    ),
  );
  const hashesMatch = Object.entries(requiredHashTargets).every(([name]) =>
    /^[a-f0-9]{64}$/u.test(buildManifest.sha256?.[name] ?? "") &&
    buildManifest.sha256[name] === actualHashes[name]
  );
  const captureArtifacts = new Map(
    (Array.isArray(captureManifest.artifacts) ? captureManifest.artifacts : [])
      .map((artifact) => [artifact.filename, artifact.sha256]),
  );
  const evidenceArtifactHashes = await Promise.all(evidenceFiles.map(sha256));
  const evidenceArtifactsMatch = evidenceValues.length === 15 && evidenceValues.every((value, index) => {
    const filename = path.basename(value);
    if (filename === "capture-manifest.json") {
      return /^[a-f0-9]{64}$/u.test(evidenceArtifactHashes[index] ?? "");
    }
    const expectedHash = captureArtifacts.get(filename);
    return /^[a-f0-9]{64}$/u.test(expectedHash ?? "") && expectedHash === evidenceArtifactHashes[index];
  });

  const textEvidenceFiles = resolvedSources.filter((file) =>
    file && [".json", ".log", ".md", ".mjs", ".sema", ".txt"].includes(path.extname(file))
  );
  const publicEvidence = await Promise.all(
    textEvidenceFiles.map(async (file) => {
      const info = await fileInfo(file);
      return info?.isFile() ? readFile(file, "utf8") : "";
    }),
  );
  publicEvidence.push(
    JSON.stringify(buildManifest),
    JSON.stringify(captureManifest),
  );
  const forbiddenPathVariants = [
    repoRoot,
    repoRoot.replaceAll("\\", "/"),
    repoRoot.replaceAll("\\", "\\\\"),
    productionDir,
    productionDir.replaceAll("\\", "/"),
    productionDir.replaceAll("\\", "\\\\"),
  ];
  const pathsSanitized = publicEvidence.every((text) =>
    forbiddenPathVariants.every((variant) => !text.includes(variant)) &&
    !/[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/]/iu.test(text)
  );

  const deterministic = buildManifest.deterministicRequirements ?? {};
  const recordedNarrationDurations = buildManifest.rawNarrationDurationsSeconds ?? {};
  const semanticNarration = (config.scenes ?? [])
    .filter((scene) => ["02-what-sema-is", "04-new-task"].includes(scene.id))
    .map((scene) => scene.narration)
    .join(" ");
  const expectedSceneIds = [
    "01-failure-mode",
    "02-what-sema-is",
    "03-bootstrap",
    "04-new-task",
    "05-concrete-change",
    "06-drift-visible",
    "07-convergence",
    "08-built-with-codex",
    "09-larger-thesis",
  ];
  const captureCommands = Array.isArray(captureManifest.commands) ? captureManifest.commands : [];
  const captureCommandIds = new Set(captureCommands.map((command) => command.id));
  const expectedCaptureCommandIds = [
    "bootstrap",
    "bootstrap-init",
    "bootstrap-sync",
    "red-drift",
    "tests",
    "validation-green",
    "green-drift",
    "demo",
    "smoke",
  ];
  const sceneBoundaries = [0];
  for (const scene of config.scenes ?? []) {
    sceneBoundaries.push(sceneBoundaries.at(-1) + Number(scene.durationSeconds));
  }
  const reviewTimestampsCoverScenes = reviewTimestamps.every((timestamp, index) =>
    timestamp >= sceneBoundaries[index] && timestamp < sceneBoundaries[index + 1]
  );

  await mkdir(reviewDir, { recursive: true });
  const reviewImages = [];
  const reviewFrameFiles = [];
  for (const timestamp of reviewTimestamps) {
    const file = path.join(reviewDir, `frame-${String(timestamp).padStart(3, "0")}.png`);
    run(
      ffmpeg,
      ["-y", "-ss", String(timestamp), "-i", videoPath, "-frames:v", "1", "-vf", "scale=640:360", file],
      `extract review frame ${timestamp}`,
    );
    const metadata = await sharp(file).metadata();
    if (metadata.width !== 640 || metadata.height !== 360) {
      throw new Error(`Review frame has unexpected dimensions: ${path.basename(file)}`);
    }
    reviewImages.push(await sharp(file).toBuffer());
    reviewFrameFiles.push(path.relative(productionDir, file).replaceAll("\\", "/"));
  }

  const tiles = reviewImages.map((input, index) => ({
    input,
    left: (index % 3) * 640,
    top: Math.floor(index / 3) * 360,
  }));
  const contactSheet = path.join(evidenceDir, "contact-sheet.png");
  await sharp({
    create: {
      width: 1920,
      height: 1080,
      channels: 3,
      background: "#05080d",
    },
  })
    .composite(tiles)
    .png()
    .toFile(contactSheet);

  const volume = run(
    ffmpeg,
    ["-i", videoPath, "-af", "volumedetect", "-f", "null", "NUL"],
    "audio volume analysis",
  ).stderr;
  const meanVolume = Number(volume.match(/mean_volume:\s*(-?[\d.]+) dB/u)?.[1]);
  const maxVolume = Number(volume.match(/max_volume:\s*(-?[\d.]+) dB/u)?.[1]);

  const checks = {
    videoExistsAndNonempty: fileSizeBytes > 1_000_000,
    resolution1920x1080: videoStream?.width === 1920 && videoStream?.height === 1080,
    fps30: videoStream?.avg_frame_rate === "30/1",
    codecH264: videoStream?.codec_name === "h264",
    durationExactly178: Number.isFinite(durationSeconds) && Math.abs(durationSeconds - 178) <= 0.1,
    durationUnder180: durationSeconds < 180,
    audioPresent: Boolean(audioStream),
    audioAac: audioStream?.codec_name === "aac",
    audio48kHz: Number(audioStream?.sample_rate) === 48000,
    audioLevelValid: Number.isFinite(meanVolume) && Number.isFinite(maxVolume) && maxVolume >= -12,
    captionsPresent: captionCount >= 30,
    captionsFitTwoLineBudget: captionTexts.length === captionCount &&
      captionLengths.every(({ characters, words }) =>
        characters <= captionCharacterLimit && words <= captionWordLimit
      ),
    captionsHaveNoOrphanCues: captionLengths.every(({ words }) => words >= 3),
    captionRenderStyleExact: /FontSize=18,[^'"\r\n]*MarginV=10/iu.test(buildSource),
    thumbnail1280x720: thumbnail.width === 1280 && thumbnail.height === 720,
    productionTimelineExact: timelineIsExact(config),
    nineCanonicalScenes: (config.scenes ?? []).map((scene) => scene.id).join("|") ===
      expectedSceneIds.join("|"),
    narrationConfigExact: config.narration?.provider === "ElevenLabs" &&
      config.narration?.voice === "Dan" &&
      config.narration?.model === "Multilingual v2" &&
      Number(config.narration?.speed) === 1.12,
    narrationManifestExact: deterministic.targetDurationSeconds === 178 &&
      deterministic.narrationProvider === "ElevenLabs" &&
      deterministic.narrationVoice === "Dan" &&
      deterministic.narrationModel === "Multilingual v2" &&
      Number(deterministic.narrationSpeed) === 1.12,
    semanticNavigationExplicit: deterministic.semanticNavigationExplicit === true &&
      /instead of scanning the whole project from scratch on every task/iu.test(semanticNarration) &&
      /living contract preserves your intent, rules, guarantees, and semantic links/iu.test(semanticNarration) &&
      /leading Codex directly to the relevant code/iu.test(semanticNarration) &&
      /Sema then verifies that implementation against the contract/iu.test(semanticNarration),
    narrationInputsPresent: narrationInfo.length === 9 &&
      narrationInfo.every((info) => info?.isFile() && info.size > 1_000),
    narrationDurationsRecorded: expectedSceneIds.every((id) =>
      Number.isFinite(Number(recordedNarrationDurations[id])) &&
      Number(recordedNarrationDurations[id]) > 0
    ),
    narrationNotTimeStretched: !/\batempo\b/iu.test(buildSource),
    creativeAssetsDeclared: deterministic.music === false &&
      deterministic.thirdPartyVisualCreativeAssets === false,
    zoompanAbsent: !/\bzoompan\b/iu.test(buildSource),
    movementFiltersAbsent: !/\b(?:zoompan|xfade|sendcmd|scroll)\b/iu.test(buildSource),
    renderedTimecodeAbsent: !/\bscene\s*\.\s*timecode\b/u.test(buildSource) &&
      !/\btimecode\s*=/iu.test(buildSource) &&
      !/%\{(?:pts|gmtime|localtime)/iu.test(buildSource),
    retiredCliAbsentBarSourceAbsent: !/Sema CLI ausente/iu.test(buildSource),
    manifestSourcesAreRelative: sourceValues.length >= 22 &&
      sourceValues.every((value) => typeof value === "string" && !path.isAbsolute(value)) &&
      resolvedSources.every(Boolean),
    buildSourcesPresent: sourceInfo.length === sourceValues.length &&
      sourceInfo.every(Boolean),
    realVsCodeCapturesPresent: visualCaptureFiles.length === 3 &&
      visualCaptureFiles.every((file) => file && /vscode-.*\.png$/iu.test(path.basename(file))),
    visualCaptureCropsValid: cropValues.length >= 2 && cropValues.every(cropIsValid),
    buildHashesMatch: hashesMatch,
    capturedEvidenceHashesMatch: evidenceArtifactsMatch,
    captureEvidenceGreen: captureManifest.verified === true &&
      captureManifest.pathsSanitized === true &&
      captureManifest.proof?.controlledDriftDetected === true &&
      captureManifest.proof?.brokenSymbol === "approvePayment" &&
      captureManifest.proof?.finalSymbol === "confirmPayment" &&
      captureManifest.proof?.receiptGuaranteePreserved === true &&
      captureManifest.proof?.testsPassed === true &&
      captureManifest.proof?.finalValidationGreen === true &&
      captureManifest.proof?.finalDriftClean === true &&
      captureCommands.length === expectedCaptureCommandIds.length &&
      captureCommands.every((command) => command.exitCode === (command.id === "red-drift" ? 1 : 0)) &&
      expectedCaptureCommandIds.every((id) => captureCommandIds.has(id)),
    reviewFramesCoverAllScenes: reviewTimestampsCoverScenes && reviewImages.length === 9,
    pathsSanitized,
  };

  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const report = {
    verifiedAt: new Date().toISOString(),
    approved: failed.length === 0,
    checks,
    failed,
    media: {
      durationSeconds,
      fileSizeBytes,
      width: videoStream?.width,
      height: videoStream?.height,
      fps: videoStream?.avg_frame_rate,
      videoCodec: videoStream?.codec_name,
      audioCodec: audioStream?.codec_name,
      audioSampleRate: Number(audioStream?.sample_rate),
      audioChannels: audioStream?.channels,
      meanVolumeDb: meanVolume,
      maxVolumeDb: maxVolume,
      captionCount,
      captionCharacterLimit,
      captionWordLimit,
      captionMaxCharacters: Math.max(...captionLengths.map(({ characters }) => characters)),
      captionMaxWords: Math.max(...captionLengths.map(({ words }) => words)),
    },
    provenance: {
      targetDurationSeconds: config.targetDurationSeconds,
      narration: config.narration,
      captions: {
        fontSize: 18,
        marginV: 10,
        maxCharactersPerCue: captionCharacterLimit,
        maxWordsPerCue: captionWordLimit,
      },
      sourceCount: sourceValues.length,
      visualCaptures: visualCaptureValues,
      buildSourceSha256: actualHashes.buildSource,
    },
    visualReview: {
      timestampsSeconds: reviewTimestamps,
      frames: reviewFrameFiles,
      contactSheet: "evidence/contact-sheet.png",
      requiredHumanAssertions: [
        "No on-screen timecode badge is visible.",
        "The bootstrap and handshake cuts do not show the retired 'Sema CLI ausente' bar.",
        "The contract and implementation panels are real VS Code captures and remain legible.",
      ],
    },
  };
  await writeFile(
    path.join(evidenceDir, "verification.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  if (failed.length > 0) throw new Error(`Verification failed: ${failed.join(", ")}`);
  console.log(`VIDEO_VERIFIED duration=${durationSeconds.toFixed(3)}s size=${fileSizeBytes}`);
  console.log(`AUDIO_VERIFIED mean=${meanVolume}dB max=${maxVolume}dB`);
  console.log(`PROVENANCE_VERIFIED sources=${sourceValues.length} vscodeCaptures=${visualCaptureValues.length}`);
  console.log(`VISUAL_REVIEW ${path.relative(productionDir, contactSheet)}`);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyVideoProduction();
}
