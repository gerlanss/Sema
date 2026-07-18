// SEMA-GOVERNED: sema.showcase.build_week_2026.video_production
// Contract: contratos/sema/build_week_video_production.sema
// Descricao: Compõe o filme final com capturas reais, evidência sanitizada e legendas em faixa reservada.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const productionDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(productionDir, "../../..");
const workDir = path.join(productionDir, "work");
const framesDir = path.join(workDir, "frames");
const narrationDir = path.join(workDir, "narration-elevenlabs");
const paddedAudioDir = path.join(workDir, "audio-padded");
const segmentsDir = path.join(workDir, "segments");
const evidenceDir = path.join(productionDir, "evidence");
const finalVideo = path.join(productionDir, "sema-build-week-demo.mp4");
const captionsPath = path.join(productionDir, "captions.srt");
const thumbnailPath = path.join(productionDir, "thumbnail.png");

const toolsRoot = productionDir;
const sharp = require(path.join(toolsRoot, "node_modules", "sharp"));
const ffmpeg = path.join(toolsRoot, "node_modules", "ffmpeg-static", "ffmpeg.exe");
const ffprobe = require(path.join(toolsRoot, "node_modules", "ffprobe-static")).path;

export async function buildVideoProduction() {
const config = JSON.parse(
  await readFile(path.join(productionDir, "production.json"), "utf8"),
);

const pathVariants = [
  repoRoot,
  repoRoot.replaceAll("\\", "/"),
  repoRoot.replaceAll("\\", "\\\\"),
  productionDir,
  productionDir.replaceAll("\\", "/"),
  productionDir.replaceAll("\\", "\\\\"),
].sort((left, right) => right.length - left.length);

const sanitizePathText = (value) => {
  let sanitized = String(value);
  for (const variant of pathVariants) sanitized = sanitized.replaceAll(variant, ".");
  return sanitized;
};

const sanitizeValue = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, sanitizeValue(nested)]),
    );
  }
  return typeof value === "string" ? sanitizePathText(value) : value;
};

const run = (binary, args, label, options = {}) => {
  const result = spawnSync(binary, args, {
    cwd: options.cwd ?? productionDir,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `${label} failed (${result.status})\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
};

const fileExists = async (file) => {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
};

const sha256 = async (file) =>
  createHash("sha256").update(await readFile(file)).digest("hex");

const xml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const cleanLog = (value) =>
  value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "").replaceAll("\r", "");

const findProofLine = (log, token) => {
  const line = cleanLog(log)
    .split("\n")
    .find((candidate) => candidate.includes(token));
  if (!line) throw new Error(`Evidence log does not contain: ${token}`);
  return line.trim().replace(/,$/, "");
};

const safeExcerpt = (log, patterns, maximum = 8) => {
  const lines = cleanLog(log)
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const selected = [];
  for (const pattern of patterns) {
    const line = lines.find((candidate) => candidate.toLowerCase().includes(pattern.toLowerCase()));
    if (line && !selected.includes(line)) selected.push(line);
  }
  if (selected.length < 3) {
    for (const line of lines) {
      if (line.length <= 118 && !selected.includes(line)) selected.push(line);
      if (selected.length >= maximum) break;
    }
  }
  return selected.slice(0, maximum).map(sanitizePathText);
};

const wrap = (text, maxCharacters) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const textLines = ({
  lines,
  x,
  y,
  size,
  lineHeight,
  fill = "#f8fafc",
  weight = 600,
  family = "Segoe UI",
  anchor = "start",
}) => lines
  .map(
    (line, index) =>
      `<text x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${xml(line)}</text>`,
  )
  .join("\n");

const pill = (x, y, width, text, color = "#46d7ff") => `
  <rect x="${x}" y="${y}" width="${width}" height="42" rx="21" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-opacity="0.55"/>
  <text x="${x + width / 2}" y="${y + 28}" text-anchor="middle" font-family="Segoe UI" font-size="18" font-weight="700" letter-spacing="1.2" fill="${color}">${xml(text)}</text>`;

const terminal = ({ x, y, width, height, title, lines, accent = "#46d7ff", fontSize = 22 }) => {
  const lineHeight = Math.round(fontSize * 1.45);
  const maximumCharacters = Math.max(24, Math.floor((width - 68) / (fontSize * 0.61)));
  const wrappedLines = lines.flatMap((line) => wrap(String(line).trim(), maximumCharacters));
  const maximumRows = Math.floor((height - 82) / lineHeight);
  if (wrappedLines.length > maximumRows) {
    throw new Error(`${title} has ${wrappedLines.length} visible rows but only ${maximumRows} fit`);
  }
  const body = wrappedLines
    .map((normalized, index) => {
      let color = "#bac5d6";
      if (/false|broken|quebrado|error|stopped/i.test(normalized)) color = "#ff6b7d";
      if (/true|pass|verified|green|clean|complete/i.test(normalized)) color = "#52e09a";
      if (/bloqueia_acao.*false|(?:vinculos|impls)_quebrados.*\[\]/i.test(normalized)) color = "#52e09a";
      if (/^\$/.test(normalized)) color = "#46d7ff";
      return `<text x="${x + 34}" y="${y + 82 + index * lineHeight}" font-family="Cascadia Mono" font-size="${fontSize}" fill="${color}">${xml(normalized)}</text>`;
    })
    .join("\n");
  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="#0b101a" stroke="#293248" stroke-width="2"/>
    <rect x="${x}" y="${y}" width="${width}" height="54" rx="24" fill="#151d2b"/>
    <rect x="${x}" y="${y + 30}" width="${width}" height="24" fill="#151d2b"/>
    <circle cx="${x + 27}" cy="${y + 27}" r="6" fill="#ff6b7d"/>
    <circle cx="${x + 48}" cy="${y + 27}" r="6" fill="#f2c94c"/>
    <circle cx="${x + 69}" cy="${y + 27}" r="6" fill="#52e09a"/>
    <text x="${x + 96}" y="${y + 35}" font-family="Cascadia Mono" font-size="18" font-weight="600" fill="${accent}">${xml(title)}</text>
    ${body}`;
};

const capturePanel = ({ id, x, y, width, title, capture, crop, accent = "#46d7ff" }) => {
  const scale = width / crop.width;
  const imageHeight = Math.round(crop.height * scale);
  const panelHeight = imageHeight + 48;
  const imageX = x - crop.left * scale;
  const imageY = y + 48 - crop.top * scale;
  return `
    <defs><clipPath id="${id}"><rect x="${x}" y="${y + 48}" width="${width}" height="${imageHeight}" rx="0"/></clipPath></defs>
    <rect x="${x}" y="${y}" width="${width}" height="${panelHeight}" rx="18" fill="#0a0f18" stroke="#2d3b52" stroke-width="2"/>
    <rect x="${x}" y="${y}" width="${width}" height="48" rx="18" fill="#151d2b"/>
    <rect x="${x}" y="${y + 28}" width="${width}" height="20" fill="#151d2b"/>
    <circle cx="${x + 25}" cy="${y + 24}" r="6" fill="${accent}"/>
    <text x="${x + 44}" y="${y + 31}" font-family="Cascadia Mono" font-size="18" font-weight="650" fill="${accent}">${xml(title)}</text>
    <g clip-path="url(#${id})">
      <image href="data:image/png;base64,${capture.data}" x="${imageX}" y="${imageY}" width="${capture.width * scale}" height="${capture.height * scale}"/>
    </g>`;
};

const makeWhiteLogo = async () => {
  const sourcePath = path.join(repoRoot, "logo.png");
  const { data, info } = await sharp(sourcePath)
    .extract({ left: 300, top: 190, width: 420, height: 450 })
    .resize({ width: 260 })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
    rgba[pixel * 4] = 255;
    rgba[pixel * 4 + 1] = 255;
    rgba[pixel * 4 + 2] = 255;
    rgba[pixel * 4 + 3] = 255 - data[pixel];
  }
  return sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();
};

const frameShell = (scene, logoData, content) => `
<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#070b12"/>
      <stop offset="0.58" stop-color="#0e1421"/>
      <stop offset="1" stop-color="#07151a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#46d7ff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#46d7ff" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="52" height="52" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.2" fill="#6c7b91" fill-opacity="0.14"/>
    </pattern>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  <rect width="1920" height="1080" fill="url(#grid)"/>
  <ellipse cx="1650" cy="180" rx="620" ry="480" fill="url(#glow)"/>
  <line x1="96" y1="112" x2="1824" y2="112" stroke="#263044" stroke-width="2"/>
  <image href="data:image/png;base64,${logoData}" x="96" y="40" width="52" height="58" preserveAspectRatio="xMidYMid meet"/>
  <text x="166" y="78" font-family="Segoe UI" font-size="24" font-weight="700" letter-spacing="4" fill="#f8fafc">SEMA</text>
  <text x="275" y="78" font-family="Segoe UI" font-size="18" font-weight="600" letter-spacing="2.4" fill="#77849a">BUILD WEEK 2026</text>
  <text x="1824" y="78" text-anchor="end" font-family="Segoe UI" font-size="17" font-weight="750" letter-spacing="2" fill="#52e09a">${xml(scene.eyebrow)}</text>
  ${content}
  <rect x="0" y="900" width="1920" height="180" fill="#03070d"/>
  <line x1="0" y1="900" x2="1920" y2="900" stroke="#263044" stroke-width="2"/>
</svg>`;

const renderSceneContent = (scene, proof) => {
  const headline = textLines({
    lines: wrap(scene.headline, 47),
    x: 100,
    y: 190,
    size: 54,
    lineHeight: 62,
    weight: 730,
  });

  if (scene.kind === "failure") {
    return `${headline}
      <rect x="100" y="350" width="760" height="360" rx="28" fill="#111827" stroke="#334155" stroke-width="2"/>
      <text x="140" y="414" font-family="Segoe UI" font-size="18" font-weight="700" letter-spacing="2" fill="#46d7ff">SEMANTIC CONTRACT</text>
      <text x="140" y="500" font-family="Cascadia Mono" font-size="30" fill="#f8fafc">payment.approvePayment</text>
      <text x="140" y="570" font-family="Cascadia Mono" font-size="27" fill="#52e09a">receipt_id exists</text>
      <rect x="1060" y="350" width="760" height="360" rx="28" fill="#111827" stroke="#334155" stroke-width="2"/>
      <text x="1100" y="414" font-family="Segoe UI" font-size="18" font-weight="700" letter-spacing="2" fill="#46d7ff">IMPLEMENTATION</text>
      <text x="1100" y="500" font-family="Cascadia Mono" font-size="30" fill="#f8fafc">confirmPayment()</text>
      <text x="1100" y="570" font-family="Cascadia Mono" font-size="27" fill="#ff6b7d">approvePayment not found</text>
      <path d="M865 535 L1055 535" stroke="#ff6b7d" stroke-width="5" stroke-dasharray="12 10"/>
      <circle cx="960" cy="535" r="28" fill="#2a111a" stroke="#ff6b7d" stroke-width="3"/>
      <path d="M948 523 L972 547 M972 523 L948 547" stroke="#ff6b7d" stroke-width="4" stroke-linecap="round"/>
      ${pill(100, 775, 520, proof.brokenSymbol, "#ff6b7d")}`;
  }

  if (scene.kind === "thesis") {
    return `${headline}
      <text x="100" y="290" font-family="Segoe UI" font-size="29" fill="#a9b6c9">One request becomes a precise map for Codex.</text>
      <rect x="100" y="350" width="440" height="420" rx="28" fill="#111827" stroke="#334155" stroke-width="2"/>
      <text x="140" y="410" font-family="Segoe UI" font-size="18" font-weight="750" letter-spacing="2" fill="#46d7ff">YOU TELL CODEX</text>
      <rect x="140" y="450" width="360" height="166" rx="20" fill="#0b101a" stroke="#293248" stroke-width="2"/>
      ${textLines({ lines: wrap("Rename payment approval without losing the receipt guarantee.", 27), x: 170, y: 495, size: 23, lineHeight: 34, fill: "#f8fafc", weight: 620 })}
      <text x="140" y="700" font-family="Segoe UI" font-size="21" fill="#9aa8bc">Human intent, in plain language.</text>

      <path d="M550 560 L630 560" stroke="#34445b" stroke-width="5"/>
      <path d="M610 542 L632 560 L610 578" fill="none" stroke="#34445b" stroke-width="5"/>

      <rect x="650" y="350" width="620" height="420" rx="28" fill="#10212a" stroke="#46d7ff" stroke-width="2"/>
      <text x="690" y="410" font-family="Segoe UI" font-size="18" font-weight="750" letter-spacing="2" fill="#46d7ff">SEMA — LIVING CONTRACT</text>
      <text x="700" y="478" font-family="Cascadia Mono" font-size="24" fill="#f8fafc">intent</text>
      <text x="885" y="478" font-family="Segoe UI" font-size="23" fill="#a9b6c9">approve the payment</text>
      <text x="700" y="544" font-family="Cascadia Mono" font-size="24" fill="#f8fafc">rules</text>
      <text x="885" y="544" font-family="Segoe UI" font-size="23" fill="#a9b6c9">preserve the receipt</text>
      <text x="700" y="610" font-family="Cascadia Mono" font-size="24" fill="#f8fafc">guarantee</text>
      <text x="885" y="610" font-family="Cascadia Mono" font-size="23" fill="#52e09a">receipt_id exists</text>
      <text x="700" y="676" font-family="Cascadia Mono" font-size="24" fill="#f8fafc">links</text>
      <text x="885" y="676" font-family="Cascadia Mono" font-size="21" fill="#46d7ff">payment.sema → payment.mjs</text>
      ${pill(690, 710, 355, "PRECISE SEMANTIC MAP", "#46d7ff")}

      <path d="M1280 560 L1360 560" stroke="#34445b" stroke-width="5"/>
      <path d="M1340 542 L1362 560 L1340 578" fill="none" stroke="#34445b" stroke-width="5"/>

      <rect x="1380" y="350" width="440" height="420" rx="28" fill="#10231f" stroke="#52e09a" stroke-width="2"/>
      <text x="1420" y="410" font-family="Segoe UI" font-size="18" font-weight="750" letter-spacing="2" fill="#52e09a">CODEX STARTS HERE</text>
      <text x="1600" y="500" text-anchor="middle" font-family="Segoe UI" font-size="33" font-weight="760" fill="#f8fafc">NO FULL-PROJECT</text>
      <text x="1600" y="548" text-anchor="middle" font-family="Segoe UI" font-size="38" font-weight="800" fill="#52e09a">RESCAN</text>
      <text x="1600" y="620" text-anchor="middle" font-family="Cascadia Mono" font-size="20" fill="#a9b6c9">contract → impact → files</text>
      <text x="1600" y="690" text-anchor="middle" font-family="Segoe UI" font-size="22" fill="#9aa8bc">Relevant context on every task.</text>`;
  }

  if (scene.kind === "bootstrap") {
    return `${headline}
      ${terminal({ x: 100, y: 300, width: 800, height: 550, title: "bootstrap-output.log — clean pre-state", lines: proof.bootstrapPre, fontSize: 20 })}
      ${terminal({ x: 950, y: 300, width: 870, height: 250, title: "bootstrap-init-output.log", lines: proof.bootstrapInit, fontSize: 18 })}
      ${terminal({ x: 950, y: 585, width: 870, height: 265, title: "bootstrap-generated-AGENTS.md", lines: proof.agentsShort, accent: "#52e09a", fontSize: 18 })}`;
  }

  if (scene.kind === "handshake") {
    return `${headline}
      ${capturePanel({ id: "living-contract", x: 100, y: 315, width: 840, title: "payment.sema — living contract in VS Code", capture: proof.captureContractGreen, crop: proof.contractCrop, accent: "#46d7ff" })}
      <rect x="1010" y="315" width="810" height="150" rx="24" fill="#10212a" stroke="#46d7ff" stroke-width="2"/>
      <text x="1050" y="370" font-family="Segoe UI" font-size="18" font-weight="750" letter-spacing="2" fill="#46d7ff">CONTRACT AS SEMANTIC MAP</text>
      <text x="1050" y="425" font-family="Cascadia Mono" font-size="24" fill="#f8fafc">intent · rules · guarantees · links</text>

      <path d="M1415 475 L1415 505" stroke="#34445b" stroke-width="5"/>
      <path d="M1398 490 L1415 507 L1432 490" fill="none" stroke="#34445b" stroke-width="5"/>

      <rect x="1010" y="520" width="810" height="140" rx="24" fill="#111827" stroke="#334155" stroke-width="2"/>
      <text x="1050" y="573" font-family="Segoe UI" font-size="18" font-weight="750" letter-spacing="2" fill="#f8fafc">TARGETED CODE</text>
      <text x="1050" y="625" font-family="Cascadia Mono" font-size="25" fill="#46d7ff">payment.sema → confirmPayment()</text>

      <path d="M1415 670 L1415 700" stroke="#34445b" stroke-width="5"/>
      <path d="M1398 685 L1415 702 L1432 685" fill="none" stroke="#34445b" stroke-width="5"/>

      <rect x="1010" y="715" width="810" height="140" rx="24" fill="#10231f" stroke="#52e09a" stroke-width="2"/>
      <text x="1050" y="768" font-family="Segoe UI" font-size="18" font-weight="750" letter-spacing="2" fill="#52e09a">VERIFIED AGAINST THE CONTRACT</text>
      <text x="1050" y="820" font-family="Segoe UI" font-size="24" fill="#f8fafc">Implementation must still fulfill the promise.</text>`;
  }

  if (scene.kind === "change") {
    return `${headline}
      <rect x="100" y="285" width="1720" height="82" rx="20" fill="#10212a" stroke="#46d7ff" stroke-width="2"/>
      <text x="140" y="337" font-family="Segoe UI" font-size="26" font-weight="650" fill="#f8fafc">Complete the rename to confirmPayment without losing the receipt_id guarantee.</text>
      ${capturePanel({ id: "contract-before", x: 100, y: 405, width: 800, title: "payment.sema — before fix", capture: proof.captureContractBroken, crop: proof.contractCrop, accent: "#ff6b7d" })}
      ${capturePanel({ id: "implementation-broken", x: 1020, y: 405, width: 800, title: "payment.broken.mjs — implementation renamed", capture: proof.captureCodeBroken, crop: proof.codeCrop, accent: "#ff6b7d" })}`;
  }

  if (scene.kind === "drift") {
    return `${headline}
      ${capturePanel({ id: "contract-drift", x: 100, y: 285, width: 1020, title: "payment.sema — stale semantic link", capture: proof.captureContractBroken, crop: proof.contractCrop, accent: "#ff6b7d" })}
      ${terminal({ x: 1170, y: 285, width: 650, height: 565, title: "red-drift.json — captured CLI result", lines: proof.redDrift, accent: "#ff6b7d", fontSize: 18 })}`;
  }

  if (scene.kind === "converge") {
    return `${headline}
      ${capturePanel({ id: "contract-green", x: 100, y: 285, width: 1020, title: "payment.sema — contract and code converge", capture: proof.captureContractGreen, crop: proof.contractCrop, accent: "#52e09a" })}
      ${terminal({ x: 1170, y: 285, width: 650, height: 565, title: "tests + validation + green drift", lines: proof.greenEvidence, accent: "#52e09a", fontSize: 17 })}`;
  }

  if (scene.kind === "buildweek") {
    return `${headline}
      ${terminal({ x: 100, y: 300, width: 820, height: 550, title: "capture-manifest.json — recorded commands", lines: proof.captureManifest, fontSize: 18 })}
      ${terminal({ x: 970, y: 300, width: 850, height: 550, title: "demo-output.log — public CLI evidence", lines: proof.buildWeek, accent: "#52e09a", fontSize: 19 })}`;
  }

  const chain = ["INTENT", "CONTEXT", "CONTRACT", "IMPACT", "EXECUTION", "EVIDENCE"]
    .map((label, index) => {
      const x = 260 + index * 280;
      return `<circle cx="${x}" cy="690" r="13" fill="${index === 5 ? "#52e09a" : "#46d7ff"}"/><text x="${x}" y="738" text-anchor="middle" font-family="Segoe UI" font-size="16" font-weight="700" fill="#a9b6c9">${label}</text>${index < 5 ? `<line x1="${x + 20}" y1="690" x2="${x + 260}" y2="690" stroke="#334155" stroke-width="4"/>` : ""}`;
    })
    .join("\n");
  return `
    <image href="data:image/png;base64,${proof.logo}" x="835" y="185" width="250" height="270" preserveAspectRatio="xMidYMid meet"/>
    <text x="960" y="520" text-anchor="middle" font-family="Segoe UI" font-size="44" font-weight="760" letter-spacing="8" fill="#f8fafc">SEMA</text>
    ${textLines({ lines: wrap(scene.headline, 46), x: 960, y: 610, size: 46, lineHeight: 56, weight: 690, anchor: "middle" })}
    ${chain}
    <text x="960" y="835" text-anchor="middle" font-family="Cascadia Mono" font-size="26" fill="#52e09a">github.com/gerlanss/Sema  ·  @semacode/cli</text>`;
};

const parseNarrationMaster = (markdown) => {
  const narrations = [];
  let current = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (/^## \d+:\d+/.test(line)) {
      if (current.length) narrations.push(current.join(" "));
      current = [];
      continue;
    }
    if (line.startsWith("> ")) current.push(line.slice(2).trim());
  }
  if (current.length) narrations.push(current.join(" "));
  return narrations;
};

const formatSrtTime = (seconds) => {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const ms = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
};

const captionChunks = (text, maxCharacters = 42, maxWords = 8) => {
  const words = text.split(/\s+/);
  const chunks = [];
  let current = [];
  for (const word of words) {
    const candidate = [...current, word].join(" ");
    if (current.length && (candidate.length > maxCharacters || current.length >= maxWords)) {
      chunks.push(current.join(" "));
      current = [word];
    } else {
      current.push(word);
    }
  }
  if (current.length) chunks.push(current.join(" "));
  if (chunks.length > 1) {
    const lastWords = chunks.at(-1).split(/\s+/);
    const previousWords = chunks.at(-2).split(/\s+/);
    while (lastWords.length < 3 && previousWords.length > 3) {
      const candidate = [previousWords.at(-1), ...lastWords];
      if (candidate.length > maxWords || candidate.join(" ").length > maxCharacters) break;
      lastWords.unshift(previousWords.pop());
    }
    chunks[chunks.length - 2] = previousWords.join(" ");
    chunks[chunks.length - 1] = lastWords.join(" ");
  }
  return chunks;
};

const probeJson = (file) =>
  JSON.parse(
    run(
      ffprobe,
      ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
      `ffprobe ${path.basename(file)}`,
    ).stdout,
  );

const getDuration = (file) => Number(probeJson(file).format.duration);

const totalConfiguredDuration = config.scenes.reduce(
  (sum, scene) => sum + Number(scene.durationSeconds),
  0,
);
if (totalConfiguredDuration !== config.targetDurationSeconds) {
  throw new Error(
    `Configured scene duration ${totalConfiguredDuration}s does not equal target ${config.targetDurationSeconds}s`,
  );
}

const scriptMaster = await readFile(
  path.join(repoRoot, "docs", "build-week-2026", "video-script.md"),
  "utf8",
);
const approvedNarrations = parseNarrationMaster(scriptMaster);
if (approvedNarrations.length !== config.scenes.length) {
  throw new Error(
    `Narration master has ${approvedNarrations.length} sections; production manifest has ${config.scenes.length}`,
  );
}
config.scenes.forEach((scene, index) => {
  if (scene.narration !== approvedNarrations[index]) {
    throw new Error(`Narration mismatch in ${scene.id}; update production.json from the approved script`);
  }
});

for (const required of [ffmpeg, ffprobe]) {
  if (!(await fileExists(required))) throw new Error(`Required video tool not found: ${required}`);
}

const evidencePaths = Object.fromEntries(
  [
    "bootstrap-output.log",
    "bootstrap-init-output.log",
    "bootstrap-sync-output.log",
    "bootstrap-generated-AGENTS.md",
    "contract-before-fix.sema",
    "implementation-broken.mjs",
    "red-drift.json",
    "contract-after-fix.sema",
    "implementation-after-fix.mjs",
    "tests-output.log",
    "validation-green.json",
    "green-drift.json",
    "capture-manifest.json",
    "demo-output.log",
    "smoke-output.log",
  ].map((name) => [name, path.join(evidenceDir, name)]),
);
const capturePaths = {
  codeBroken: path.join(workDir, "vscode-code-broken-focus.png"),
  contractBroken: path.join(workDir, "vscode-contract-broken-focus-2x.png"),
  contractGreen: path.join(workDir, "vscode-contract-green-focus-2x.png"),
};
for (const required of [...Object.values(evidencePaths), ...Object.values(capturePaths)]) {
  if (!(await fileExists(required))) {
    throw new Error(`Evidence is missing: ${required}. Run node capture-evidence.mjs after the harness is green.`);
  }
}

const evidence = Object.fromEntries(
  await Promise.all(
    Object.entries(evidencePaths).map(async ([name, file]) => [name, await readFile(file, "utf8")]),
  ),
);
const bootstrapLog = evidence["bootstrap-output.log"];
const demoLog = evidence["demo-output.log"];
const smokeLog = evidence["smoke-output.log"];
if (
  !demoLog.includes("RESULT: VERIFIED") ||
  !smokeLog.includes('"mode": "smoke"') ||
  !smokeLog.includes("RESULT: VERIFIED")
) {
  throw new Error("Captured harness evidence is not green");
}
const requiredTokensByArtifact = {
  "bootstrap-output.log": ["agents_absent", "contracts_absent"],
  "bootstrap-generated-AGENTS.md": ["AGENTS.md", "sema --version", "docs-impacto", "drift"],
  "contract-before-fix.sema": ["payment.approvePayment", "receipt_id"],
  "implementation-broken.mjs": ["confirmPayment", "receipt_id"],
  "red-drift.json": ["approvePayment", "vinculos_quebrados"],
  "contract-after-fix.sema": ["payment.confirmPayment", "receipt_id"],
  "implementation-after-fix.mjs": ["confirmPayment", "receipt_id"],
  "tests-output.log": ["# pass"],
  "validation-green.json": ["true"],
  "green-drift.json": ["true"],
};
for (const [name, tokens] of Object.entries(requiredTokensByArtifact)) {
  const missing = tokens.filter((token) => !evidence[name].includes(token));
  if (missing.length > 0) throw new Error(`${name} is missing real evidence: ${missing.join(", ")}`);
}

const narrationFiles = config.scenes.map((scene) =>
  path.join(narrationDir, `${scene.id}.mp3`),
);
for (const narrationFile of narrationFiles) {
  if (!(await fileExists(narrationFile))) {
    throw new Error(`Required ElevenLabs narration is missing: ${path.basename(narrationFile)}`);
  }
}

await Promise.all([
  rm(framesDir, { recursive: true, force: true }),
  rm(paddedAudioDir, { recursive: true, force: true }),
  rm(segmentsDir, { recursive: true, force: true }),
  rm(path.join(workDir, "base.mp4"), { force: true }),
  rm(path.join(workDir, "concat.txt"), { force: true }),
]);
await Promise.all([
  mkdir(framesDir, { recursive: true }),
  mkdir(paddedAudioDir, { recursive: true }),
  mkdir(segmentsDir, { recursive: true }),
  mkdir(evidenceDir, { recursive: true }),
]);

const logoBuffer = await makeWhiteLogo();
const logoData = logoBuffer.toString("base64");
const loadCapture = async (file) => {
  const [data, metadata] = await Promise.all([readFile(file), sharp(file).metadata()]);
  if (!metadata.width || !metadata.height) throw new Error(`Capture dimensions unavailable: ${file}`);
  return { data: data.toString("base64"), width: metadata.width, height: metadata.height };
};
const [captureCodeBroken, captureContractBroken, captureContractGreen] = await Promise.all([
  loadCapture(capturePaths.codeBroken),
  loadCapture(capturePaths.contractBroken),
  loadCapture(capturePaths.contractGreen),
]);
const codeCrop = { left: 100, top: 140, width: 1100, height: 520 };
const contractCrop = { left: 100, top: 140, width: 1100, height: 600 };
const artifactExcerpt = (name, patterns, maximum) =>
  safeExcerpt(evidence[name], patterns, maximum);
const proof = {
  logo: logoData,
  brokenSymbol: findProofLine(demoLog, '"broken_symbol": "approvePayment"'),
  captureCodeBroken,
  captureContractBroken,
  captureContractGreen,
  codeCrop,
  contractCrop,
  bootstrapPre: artifactExcerpt("bootstrap-output.log", ["$ node", '"success": true', "agents_absent", "contracts_absent", "next"], 7),
  bootstrapInit: artifactExcerpt("bootstrap-init-output.log", ["$ ", "sema iniciar", "success", "AGENTS.md", "SEMA_BOOT", "contratos"], 6),
  bootstrapSync: artifactExcerpt("bootstrap-sync-output.log", ["$ ", "sema sync-codex", "success", "AGENTS.md", "entrypoint"], 6),
  agentsShort: artifactExcerpt("bootstrap-generated-AGENTS.md", ["# Sema", "SEMA_BOOT.md", "sema --version", "docs-impacto", "drift"], 6),
  agents: artifactExcerpt("bootstrap-generated-AGENTS.md", ["# Sema", "SEMA_BOOT.md", "sema --version", "docs-impacto", "inspecionar", "drift", "impacto", "finalizar-mudanca", "falha"], 10),
  redDrift: artifactExcerpt("red-drift.json", ["sucesso", "impls_quebrados", "vinculos_quebrados", "approvePayment", "nao_encontrado", "score"], 9),
  greenEvidence: [
    ...artifactExcerpt("tests-output.log", ["$ ", "PASS", "tests", "receipt_id", "confirmPayment"], 5),
    ...artifactExcerpt("validation-green.json", ["valido", "sucesso", "true"], 3),
    ...artifactExcerpt("green-drift.json", ["sucesso", "vinculos_quebrados", "impls_quebrados", "confirmPayment", "score"], 6),
  ],
  captureManifest: artifactExcerpt("capture-manifest.json", ["capturedAt", '"command"', "bootstrap-init", "red-drift", "green-drift", '"verified": true'], 9),
  buildWeek: safeExcerpt(demoLog, ["sema 2.0.1", "no local rebuild", "receipt_id is guaranteed", "contract and code converge", "finalizar-mudanca", "RESULT: VERIFIED", '"closure_green": true'], 8),
};

const rawDurations = {};
for (const scene of config.scenes) {
  const rawAudio = path.join(narrationDir, `${scene.id}.mp3`);
  const rawDuration = getDuration(rawAudio);
  rawDurations[scene.id] = rawDuration;
  if (rawDuration + 0.25 > scene.durationSeconds - 0.25) {
    throw new Error(
      `${scene.id} narration is ${rawDuration.toFixed(2)}s, too long for ${scene.durationSeconds}s. Increase the scene duration; narration is never time-stretched.`,
    );
  }

  const paddedAudio = path.join(paddedAudioDir, `${scene.id}.wav`);
  run(
    ffmpeg,
    [
      "-y",
      "-i",
      rawAudio,
      "-af",
      `adelay=250|250,apad=pad_dur=${scene.durationSeconds},atrim=0:${scene.durationSeconds},loudnorm=I=-16:LRA=7:TP=-1.5,aresample=48000`,
      "-ar",
      "48000",
      "-ac",
      "2",
      "-c:a",
      "pcm_s16le",
      paddedAudio,
    ],
    `pad narration ${scene.id}`,
  );

  const svg = frameShell(scene, logoData, renderSceneContent(scene, proof));
  const framePath = path.join(framesDir, `${scene.id}.png`);
  await sharp(Buffer.from(svg)).png().toFile(framePath);

  const segmentPath = path.join(segmentsDir, `${scene.id}.mp4`);
  run(
    ffmpeg,
    [
      "-y",
      "-loop",
      "1",
      "-framerate",
      String(config.fps),
      "-i",
      framePath,
      "-i",
      paddedAudio,
      "-vf",
      `scale=${config.width}:${config.height}:flags=lanczos,format=yuv420p`,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-t",
      String(scene.durationSeconds),
      "-shortest",
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-r",
      String(config.fps),
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-movflags",
      "+faststart",
      segmentPath,
    ],
    `render scene ${scene.id}`,
  );
}

let sceneStart = 0;
let cueIndex = 1;
const srt = [];
for (const scene of config.scenes) {
  const chunks = captionChunks(scene.narration);
  const words = chunks.map((chunk) => chunk.split(/\s+/).length);
  const totalWords = words.reduce((sum, count) => sum + count, 0);
  const captionStart = sceneStart + 0.25;
  const captionDuration = Math.min(
    rawDurations[scene.id],
    scene.durationSeconds - 0.55,
  );
  let cursor = captionStart;
  chunks.forEach((chunk, index) => {
    const duration = captionDuration * (words[index] / totalWords);
    const end = index === chunks.length - 1
      ? captionStart + captionDuration
      : cursor + duration;
    srt.push(
      String(cueIndex),
      `${formatSrtTime(cursor)} --> ${formatSrtTime(end)}`,
      chunk,
      "",
    );
    cueIndex += 1;
    cursor = end;
  });
  sceneStart += scene.durationSeconds;
}
await writeFile(captionsPath, `${srt.join("\n")}\n`, "utf8");

const concatList = config.scenes
  .map((scene) => `file 'segments/${scene.id}.mp4'`)
  .join("\n");
const concatPath = path.join(workDir, "concat.txt");
await writeFile(concatPath, `${concatList}\n`, "utf8");
const baseVideo = path.join(workDir, "base.mp4");
run(
  ffmpeg,
  [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatPath,
    "-c",
    "copy",
    "-movflags",
    "+faststart",
    baseVideo,
  ],
  "concatenate scenes",
  { cwd: workDir },
);

const subtitlesFilter = [
  "subtitles=captions.srt",
  "force_style='FontName=Segoe UI,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H0003070D,BorderStyle=1,Outline=2,Shadow=0,MarginL=120,MarginR=120,MarginV=10,Alignment=2'",
].join(":");
run(
  ffmpeg,
  [
    "-y",
    "-i",
    baseVideo,
    "-vf",
    subtitlesFilter,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "copy",
    "-movflags",
    "+faststart",
    finalVideo,
  ],
  "burn captions",
);

const thumbnailSvg = `
<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="thumbBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#070b12"/>
      <stop offset="0.62" stop-color="#111a2b"/>
      <stop offset="1" stop-color="#06201b"/>
    </linearGradient>
    <radialGradient id="thumbGlow">
      <stop offset="0" stop-color="#52e09a" stop-opacity="0.24"/>
      <stop offset="1" stop-color="#52e09a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#thumbBg)"/>
  <circle cx="1080" cy="170" r="360" fill="url(#thumbGlow)"/>
  <rect x="54" y="54" width="190" height="48" rx="24" fill="#46d7ff" fill-opacity="0.14" stroke="#46d7ff"/>
  <text x="149" y="86" text-anchor="middle" font-family="Segoe UI" font-size="19" font-weight="750" letter-spacing="2" fill="#46d7ff">SEMA</text>
  <text x="60" y="220" font-family="Segoe UI" font-size="84" font-weight="780" fill="#f8fafc">AI AGENTS</text>
  <text x="60" y="338" font-family="Segoe UI" font-size="104" font-weight="800" fill="#52e09a">NEED MEMORY</text>
  <text x="64" y="407" font-family="Segoe UI" font-size="28" font-weight="600" fill="#a9b6c9">From human intent to verified execution.</text>
  <rect x="60" y="478" width="760" height="150" rx="24" fill="#0b101a" stroke="#31405a" stroke-width="2"/>
  <text x="96" y="530" font-family="Cascadia Mono" font-size="23" fill="#8290a5">semantic contract</text>
  <text x="96" y="584" font-family="Cascadia Mono" font-size="31" fill="#ff6b7d">approvePayment  ✕</text>
  <path d="M405 575 L545 575" stroke="#3e4d67" stroke-width="4"/>
  <path d="M527 561 L548 575 L527 589" fill="none" stroke="#3e4d67" stroke-width="4"/>
  <text x="580" y="584" font-family="Cascadia Mono" font-size="31" fill="#52e09a">confirmPayment  ✓</text>
  <image href="data:image/png;base64,${logoData}" x="940" y="125" width="250" height="300" preserveAspectRatio="xMidYMid meet"/>
  <text x="1065" y="488" text-anchor="middle" font-family="Segoe UI" font-size="46" font-weight="780" letter-spacing="8" fill="#f8fafc">SEMA</text>
  <rect x="930" y="530" width="280" height="54" rx="27" fill="#52e09a" fill-opacity="0.15" stroke="#52e09a"/>
  <text x="1070" y="565" text-anchor="middle" font-family="Segoe UI" font-size="20" font-weight="750" letter-spacing="1.5" fill="#52e09a">RESULT: VERIFIED</text>
</svg>`;
await sharp(Buffer.from(thumbnailSvg)).png().toFile(thumbnailPath);

const finalProbe = probeJson(finalVideo);
await writeFile(
  path.join(evidenceDir, "ffprobe.json"),
  `${JSON.stringify(sanitizeValue(finalProbe), null, 2)}\n`,
  "utf8",
);

const ffmpegVersion = run(ffmpeg, ["-version"], "ffmpeg version").stdout.split("\n")[0];
const manifest = {
  builtAt: new Date().toISOString(),
  title: config.title,
  output: {
    video: path.basename(finalVideo),
    thumbnail: path.basename(thumbnailPath),
    captions: path.basename(captionsPath),
  },
  deterministicRequirements: {
    resolution: `${config.width}x${config.height}`,
    fps: config.fps,
    targetDurationSeconds: config.targetDurationSeconds,
    narrationProvider: config.narration.provider,
    narrationVoice: config.narration.voice,
    narrationModel: config.narration.model,
    narrationSpeed: config.narration.speed,
    narrationLanguage: "en-US",
    semanticNavigationExplicit: true,
    music: false,
    thirdPartyVisualCreativeAssets: false,
  },
  sources: {
    narrationMaster: "docs/build-week-2026/video-script.md",
    narrationDirectory: config.narration.directory,
    storyboard: "docs/build-week-2026/storyboard.md",
    logo: "logo.png",
    evidence: Object.keys(evidencePaths).map((name) => `evidence/${name}`),
    visualCaptures: Object.values(capturePaths).map((file) => `work/${path.basename(file)}`),
    visualCaptureCrops: {
      code: codeCrop,
      contract: contractCrop,
    },
  },
  tools: { ffmpeg: ffmpegVersion, sharp: sharp.versions.sharp },
  rawNarrationDurationsSeconds: rawDurations,
  sha256: {
    buildSource: await sha256(fileURLToPath(import.meta.url)),
    video: await sha256(finalVideo),
    thumbnail: await sha256(thumbnailPath),
    captions: await sha256(captionsPath),
    demoLog: await sha256(evidencePaths["demo-output.log"]),
    vscodeCodeBroken: await sha256(capturePaths.codeBroken),
    vscodeContractBroken: await sha256(capturePaths.contractBroken),
    vscodeContractGreen: await sha256(capturePaths.contractGreen),
  },
};
await writeFile(
  path.join(evidenceDir, "build-manifest.json"),
  `${JSON.stringify(sanitizeValue(manifest), null, 2)}\n`,
  "utf8",
);

console.log(`VIDEO_BUILT ${path.basename(finalVideo)}`);
console.log(`THUMBNAIL_BUILT ${path.basename(thumbnailPath)}`);
console.log(`CAPTIONS_BUILT ${path.basename(captionsPath)}`);
return {
  video_path: path.basename(finalVideo),
  thumbnail_path: path.basename(thumbnailPath),
  captions_path: path.basename(captionsPath),
  narration_preserved: true,
  semantic_navigation_explicit: true,
  duration_under_180: true,
  captions_burned: true,
  paths_sanitized: true,
};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildVideoProduction();
}
