// SEMA-GOVERNED: sema.produto.distribuicao_global
// Descrição: gera e valida .cmd, companion Unicode e wrapper PowerShell estável do launcher Windows.

import { createHash } from "node:crypto";
import path from "node:path";
import { versaoSemanticaValida } from "./versaoSemantica.js";

const MARCADOR = "SEMA-MANAGED-LAUNCHER v2";
const MARCADOR_COMPANION = "SEMA-MANAGED-LAUNCHER-COMPANION v1";
const PREFIXO_RECIBO = "SEMA-LAUNCHER-RECEIPT sha256:";
const PREFIXO_VERSAO = "SEMA-LAUNCHER-VERSION ";
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const NOME_WRAPPER = "sema-managed.ps1";
const NOME_LAUNCHER_POWERSHELL = "sema.ps1";
const NOME_ANCORA = "sema-launcher.receipt";
const MARCADOR_WRAPPER = "SEMA-MANAGED-LAUNCHER-WRAPPER v1";
const MARCADOR_ANCORA = "SEMA-MANAGED-LAUNCHER-ANCHOR v1";
const BOOTSTRAP_NODE = "(async()=>{const e=process.env,p=Buffer.from(e.SEMA_LAUNCHER_ENTRYPOINT_B64,'base64').toString('utf8'),a=JSON.parse(Buffer.from(e.SEMA_LAUNCHER_ARGS_B64,'base64').toString('utf8'));if(!Array.isArray(a)||a.some(v=>typeof(v)!=='string'))return Promise.reject();delete e.SEMA_LAUNCHER_ARGS_B64;delete e.SEMA_LAUNCHER_ENTRYPOINT_B64;process.argv=[process.execPath,p,...a];await import((await import('node:url')).pathToFileURL(p).href)})().catch(()=>{console.error('Sema launcher bootstrap failed.');process.exitCode=1})";

export interface ArtefatosLauncherWindows {
  launcher: string;
  companion: Buffer;
  nomeCompanion: string;
  wrapper: Buffer;
  anchor: Buffer;
}

export interface ReciboLauncherWindows {
  versaoPacote: string;
  executavelNode: string;
  entrypoint: string;
  nomeCompanion: string;
}

function sha256(valor: string | Buffer): string {
  return createHash("sha256").update(valor).digest("hex");
}

function escaparPowerShell(valor: string): string {
  return valor.replaceAll("'", "''");
}

function desescaparPowerShell(valor: string): string {
  return valor.replaceAll("''", "'");
}

function gerarCompanionBase(
  executavelNode: string,
  entrypoint: string,
  versaoPacote: string,
): string[] {
  return [
    `# ${MARCADOR_COMPANION}`,
    `# ${PREFIXO_VERSAO}${versaoPacote}`,
    "$ErrorActionPreference = 'Stop'",
    `$node = '${escaparPowerShell(executavelNode)}'`,
    `$entrypoint = '${escaparPowerShell(entrypoint)}'`,
    "$semaUtf8 = [System.Text.UTF8Encoding]::new($false, $true)",
    "$semaArgsJson = ConvertTo-Json -InputObject ([string[]]@($args)) -Compress",
    "$semaArgsB64 = [System.Convert]::ToBase64String($semaUtf8.GetBytes($semaArgsJson))",
    "$semaEntrypointB64 = [System.Convert]::ToBase64String($semaUtf8.GetBytes($entrypoint))",
    "$semaArgsAnterior = [System.Environment]::GetEnvironmentVariable('SEMA_LAUNCHER_ARGS_B64', 'Process')",
    "$semaEntrypointAnterior = [System.Environment]::GetEnvironmentVariable('SEMA_LAUNCHER_ENTRYPOINT_B64', 'Process')",
    "$semaExit = $null",
    "try {",
    "  [System.Environment]::SetEnvironmentVariable('SEMA_LAUNCHER_ARGS_B64', $semaArgsB64, 'Process')",
    "  [System.Environment]::SetEnvironmentVariable('SEMA_LAUNCHER_ENTRYPOINT_B64', $semaEntrypointB64, 'Process')",
    `  $semaBootstrap = '${escaparPowerShell(BOOTSTRAP_NODE)}'`,
    "  & $node '-e' $semaBootstrap",
    "  $semaExit = $LASTEXITCODE",
    "} finally {",
    "  [System.Environment]::SetEnvironmentVariable('SEMA_LAUNCHER_ARGS_B64', $semaArgsAnterior, 'Process')",
    "  [System.Environment]::SetEnvironmentVariable('SEMA_LAUNCHER_ENTRYPOINT_B64', $semaEntrypointAnterior, 'Process')",
    "}",
    "if ($null -eq $semaExit) { $semaExit = 1 }",
    "$semaDedicated = $false",
    "$semaProcessArgs = [System.Environment]::GetCommandLineArgs()",
    "for ($semaIndice = 0; $semaIndice -lt ($semaProcessArgs.Length - 1); $semaIndice++) {",
    "  if ($semaProcessArgs[$semaIndice] -ieq '-File') {",
    "    try { $semaDedicated = [System.StringComparer]::OrdinalIgnoreCase.Equals([System.IO.Path]::GetFullPath($semaProcessArgs[$semaIndice + 1]), [System.IO.Path]::GetFullPath($PSCommandPath)) } catch { $semaDedicated = $false }",
    "    break",
    "  }",
    "}",
    "if (-not $semaDedicated) {",
    "  $global:LASTEXITCODE = $semaExit",
    "  return",
    "}",
    "exit $semaExit",
    "",
  ];
}

function gerarCompanion(
  executavelNode: string,
  entrypoint: string,
  versaoPacote: string,
): Buffer {
  const base = gerarCompanionBase(executavelNode, entrypoint, versaoPacote);
  const baseTexto = base.join("\r\n");
  base.splice(2, 0, `# ${PREFIXO_RECIBO}${sha256(baseTexto)}`);
  return Buffer.concat([UTF8_BOM, Buffer.from(base.join("\r\n"), "utf8")]);
}

function gerarComandoCompanion(_nomeCompanion: string): string {
  // `%*` segue a semântica normal do cmd.exe; transporte byte-exato pertence aos wrappers .ps1.
  return `@"%SystemRoot%\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0${NOME_LAUNCHER_POWERSHELL}" %*`;
}

function gerarComandoEsperadoWrapper(): string {
  return `  $expectedCommand = '${escaparPowerShell(gerarComandoCompanion(""))}'`;
}

function gerarAncora(
  launcher: string,
  companion: Buffer,
  nomeCompanion: string,
  wrapper: Buffer,
): Buffer {
  const base = [
    `# ${MARCADOR_ANCORA}`,
    `launcher_sha256=${sha256(launcher)}`,
    `wrapper_sha256=${sha256(wrapper)}`,
    `companion_name=${nomeCompanion}`,
    `companion_sha256=${sha256(companion)}`,
    "",
  ];
  const baseTexto = base.join("\r\n");
  base.splice(5, 0, `receipt_sha256=${sha256(baseTexto)}`);
  return Buffer.from(base.join("\r\n"), "ascii");
}

function gerarCmdBase(nomeCompanion: string, versaoPacote: string): string[] {
  return [
    "@echo off",
    "@setlocal DisableDelayedExpansion",
    `rem ${MARCADOR}`,
    `rem ${PREFIXO_VERSAO}${versaoPacote}`,
    `rem SEMA-LAUNCHER-COMPANION ${nomeCompanion}`,
    gerarComandoCompanion(nomeCompanion),
    "@set \"_SEMA_EXIT=%ERRORLEVEL%\"",
    "@endlocal & exit /b %_SEMA_EXIT%",
    "",
  ];
}

function gerarWrapper(): Buffer {
  // A âncora detecta corrupção do conjunto antes do payload; não autentica uma
  // substituição coordenada de wrapper e âncora pelo mesmo usuário do processo.
  const linhas = [
    `# ${MARCADOR_WRAPPER}`,
    "$ErrorActionPreference = 'Stop'",
    "$semaDedicated = $false",
    "$semaProcessArgs = [System.Environment]::GetCommandLineArgs()",
    "for ($semaIndice = 0; $semaIndice -lt ($semaProcessArgs.Length - 1); $semaIndice++) {",
    "  if ($semaProcessArgs[$semaIndice] -ieq '-File') {",
    "    try { $semaDedicated = [System.StringComparer]::OrdinalIgnoreCase.Equals([System.IO.Path]::GetFullPath($semaProcessArgs[$semaIndice + 1]), [System.IO.Path]::GetFullPath($PSCommandPath)) } catch { $semaDedicated = $false }",
    "    break",
    "  }",
    "}",
    "try {",
    "  $selfInfo = [System.IO.FileInfo]::new($PSCommandPath)",
    "  if (-not $selfInfo.Exists -or $selfInfo.Length -gt 65536 -or (($selfInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'wrapper inválido' }",
    "  $selfBytes = [System.IO.File]::ReadAllBytes($PSCommandPath)",
    "  $selfInfo.Refresh()",
    "  if (-not $selfInfo.Exists -or $selfInfo.Length -ne $selfBytes.Length -or (($selfInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'wrapper alterado' }",
    `  $anchorPath = [System.IO.Path]::Combine($PSScriptRoot, '${NOME_ANCORA}')`,
    "  $anchorInfo = [System.IO.FileInfo]::new($anchorPath)",
    "  if (-not $anchorInfo.Exists -or $anchorInfo.Length -gt 8192 -or (($anchorInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'âncora inválida' }",
    "  $anchorBytes = [System.IO.File]::ReadAllBytes($anchorPath)",
    "  $anchorInfo.Refresh()",
    "  if (-not $anchorInfo.Exists -or $anchorInfo.Length -ne $anchorBytes.Length -or (($anchorInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'âncora alterada' }",
    "  $ascii = [System.Text.Encoding]::ASCII",
    "  $anchorLines = [System.Text.RegularExpressions.Regex]::Split($ascii.GetString($anchorBytes), '\\r\\n')",
    `  if ($anchorLines.Count -ne 7 -or $anchorLines[0] -ne '# ${MARCADOR_ANCORA}' -or $anchorLines[6] -ne '') { throw 'âncora não gerenciada' }`,
    "  $launcherDigestMatch = [System.Text.RegularExpressions.Regex]::Match($anchorLines[1], '^launcher_sha256=([a-f0-9]{64})$')",
    "  $wrapperDigestMatch = [System.Text.RegularExpressions.Regex]::Match($anchorLines[2], '^wrapper_sha256=([a-f0-9]{64})$')",
    "  $anchorCompanionMatch = [System.Text.RegularExpressions.Regex]::Match($anchorLines[3], '^companion_name=(\\.sema-launcher-[a-f0-9]{64}\\.ps1)$')",
    "  $anchorCompanionDigestMatch = [System.Text.RegularExpressions.Regex]::Match($anchorLines[4], '^companion_sha256=([a-f0-9]{64})$')",
    "  $anchorReceiptMatch = [System.Text.RegularExpressions.Regex]::Match($anchorLines[5], '^receipt_sha256=([a-f0-9]{64})$')",
    "  if (-not $launcherDigestMatch.Success -or -not $wrapperDigestMatch.Success -or -not $anchorCompanionMatch.Success -or -not $anchorCompanionDigestMatch.Success -or -not $anchorReceiptMatch.Success) { throw 'âncora sem recibo' }",
    "  $sha = [System.Security.Cryptography.SHA256]::Create()",
    "  try {",
    "    $selfDigest = ([System.BitConverter]::ToString($sha.ComputeHash($selfBytes))).Replace('-', '').ToLowerInvariant()",
    "    $anchorBase = [string]::Join(\"`r`n\", @($anchorLines[0..4] + $anchorLines[6]))",
    "    $anchorDigest = ([System.BitConverter]::ToString($sha.ComputeHash($ascii.GetBytes($anchorBase)))).Replace('-', '').ToLowerInvariant()",
    "  } finally { $sha.Dispose() }",
    "  if ($selfDigest -ne $wrapperDigestMatch.Groups[1].Value -or $anchorDigest -ne $anchorReceiptMatch.Groups[1].Value) { throw 'integridade do wrapper divergente' }",
    "  $cmdPath = [System.IO.Path]::Combine($PSScriptRoot, 'sema.cmd')",
    "  $cmdInfo = [System.IO.FileInfo]::new($cmdPath)",
    "  if (-not $cmdInfo.Exists -or $cmdInfo.Length -gt 65536 -or (($cmdInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'cmd inválido' }",
    "  $cmdBytes = [System.IO.File]::ReadAllBytes($cmdPath)",
    "  $cmdInfo.Refresh()",
    "  if (-not $cmdInfo.Exists -or $cmdInfo.Length -ne $cmdBytes.Length -or $cmdBytes.Length -gt 65536 -or (($cmdInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'cmd alterado' }",
    "  $utf8 = [System.Text.UTF8Encoding]::new($false, $true)",
    "  $cmdLines = [System.Text.RegularExpressions.Regex]::Split($utf8.GetString($cmdBytes), '\\r\\n')",
    "  if ($cmdLines.Count -ne 10 -or $cmdLines[0] -ne '@echo off' -or $cmdLines[1] -ne '@setlocal DisableDelayedExpansion' -or $cmdLines[2] -ne 'rem SEMA-MANAGED-LAUNCHER v2' -or $cmdLines[7] -ne '@set \"_SEMA_EXIT=%ERRORLEVEL%\"' -or $cmdLines[8] -ne '@endlocal & exit /b %_SEMA_EXIT%' -or $cmdLines[9] -ne '') { throw 'cmd não gerenciado' }",
    "  if (-not [System.Text.RegularExpressions.Regex]::IsMatch($cmdLines[3], '^rem SEMA-LAUNCHER-VERSION (0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$')) { throw 'versão inválida' }",
    "  $companionMatch = [System.Text.RegularExpressions.Regex]::Match($cmdLines[4], '^rem SEMA-LAUNCHER-COMPANION (\\.sema-launcher-[a-f0-9]{64}\\.ps1)$')",
    "  $receiptMatch = [System.Text.RegularExpressions.Regex]::Match($cmdLines[5], '^rem SEMA-LAUNCHER-RECEIPT sha256:([a-f0-9]{64})$')",
    "  if (-not $companionMatch.Success -or -not $receiptMatch.Success) { throw 'recibo inválido' }",
    "  $companionName = $companionMatch.Groups[1].Value",
    "  $expectedDigest = $companionName.Substring(15, 64)",
    gerarComandoEsperadoWrapper(),
    "  if ($cmdLines[6] -ne $expectedCommand) { throw 'comando inválido' }",
    "  $cmdBase = [string]::Join(\"`r`n\", @($cmdLines[0..4] + $cmdLines[6..9]))",
    "  $sha = [System.Security.Cryptography.SHA256]::Create()",
    "  try { $cmdDigest = ([System.BitConverter]::ToString($sha.ComputeHash($utf8.GetBytes($cmdBase)))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }",
    "  if ($cmdDigest -ne $receiptMatch.Groups[1].Value) { throw 'recibo divergente' }",
    "  $sha = [System.Security.Cryptography.SHA256]::Create()",
    "  try { $cmdBytesDigest = ([System.BitConverter]::ToString($sha.ComputeHash($cmdBytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }",
    "  if ($cmdBytesDigest -ne $launcherDigestMatch.Groups[1].Value) { throw 'launcher divergente da âncora' }",
    "  $companionPath = [System.IO.Path]::Combine($PSScriptRoot, $companionName)",
    "  $companionInfo = [System.IO.FileInfo]::new($companionPath)",
    "  if (-not $companionInfo.Exists -or $companionInfo.Length -gt 65536 -or (($companionInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'companion inválido' }",
    "  $companionBytes = [System.IO.File]::ReadAllBytes($companionPath)",
    "  $companionInfo.Refresh()",
    "  if (-not $companionInfo.Exists -or $companionInfo.Length -ne $companionBytes.Length -or $companionBytes.Length -gt 65536 -or (($companionInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) { throw 'companion alterado' }",
    "  $sha = [System.Security.Cryptography.SHA256]::Create()",
    "  try { $companionDigest = ([System.BitConverter]::ToString($sha.ComputeHash($companionBytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }",
    "  if ($companionName -ne $anchorCompanionMatch.Groups[1].Value -or $companionDigest -ne $anchorCompanionDigestMatch.Groups[1].Value -or $companionName -ne ('.sema-launcher-' + $companionDigest + '.ps1')) { throw 'digest divergente' }",
    "  if ($companionBytes.Length -lt 3 -or $companionBytes[0] -ne 239 -or $companionBytes[1] -ne 187 -or $companionBytes[2] -ne 191) { throw 'encoding divergente' }",
    "  $companionTexto = $utf8.GetString($companionBytes, 3, $companionBytes.Length - 3)",
    "  $companionScript = [ScriptBlock]::Create($companionTexto)",
    "  $semaExit = $null",
    "  & $companionScript @args",
    "  $semaExit = $LASTEXITCODE",
    "  if ($null -eq $semaExit) { $semaExit = 1 }",
    "  if ($semaDedicated) { exit $semaExit }",
    "  $global:LASTEXITCODE = $semaExit",
    "  return",
    "} catch {",
    "  [Console]::Error.WriteLine('Sema managed launcher integrity check failed.')",
    "  if ($semaDedicated) { exit 1 }",
    "  $global:LASTEXITCODE = 1",
    "  return",
    "}",
    "",
  ];
  return Buffer.concat([UTF8_BOM, Buffer.from(linhas.join("\r\n"), "utf8")]);
}

export function gerarWrapperLauncherWindows(): Buffer {
  return gerarWrapper();
}

export function validarWrapperLauncherWindows(conteudo: Buffer): boolean {
  return conteudo.equals(gerarWrapper());
}

export function nomeWrapperLauncherWindows(): string {
  return NOME_WRAPPER;
}

export function nomeLauncherPowerShellWindows(): string {
  return NOME_LAUNCHER_POWERSHELL;
}

export function nomeAncoraLauncherWindows(): string {
  return NOME_ANCORA;
}

export function gerarArtefatosLauncherWindows(
  executavelNode: string,
  entrypoint: string,
  versaoPacote: string,
): ArtefatosLauncherWindows {
  if (!versaoSemanticaValida(versaoPacote)
    || !path.win32.isAbsolute(executavelNode)
    || !path.win32.isAbsolute(entrypoint)) {
    throw new Error("ARTEFATO_LAUNCHER_WINDOWS_INVALIDO");
  }
  const companion = gerarCompanion(executavelNode, entrypoint, versaoPacote);
  const nomeCompanion = `.sema-launcher-${sha256(companion)}.ps1`;
  const base = gerarCmdBase(nomeCompanion, versaoPacote);
  const baseTexto = base.join("\r\n");
  base.splice(5, 0, `rem ${PREFIXO_RECIBO}${sha256(baseTexto)}`);
  const launcher = base.join("\r\n");
  const wrapper = gerarWrapper();
  return {
    launcher,
    companion,
    nomeCompanion,
    wrapper,
    anchor: gerarAncora(launcher, companion, nomeCompanion, wrapper),
  };
}

export function validarAncoraLauncherWindows(
  conteudo: Buffer,
  launcher: string,
  companion: Buffer,
  nomeCompanion: string,
  wrapper: Buffer,
): boolean {
  return conteudo.equals(gerarAncora(launcher, companion, nomeCompanion, wrapper));
}

export function validarReciboAncoraLauncherWindows(conteudo: Buffer): boolean {
  if (conteudo.some((byte) => byte > 0x7f)) return false;
  const linhas = conteudo.toString("ascii").split("\r\n");
  if (linhas.length !== 7
    || linhas[0] !== `# ${MARCADOR_ANCORA}`
    || !/^launcher_sha256=[a-f0-9]{64}$/u.test(linhas[1] ?? "")
    || !/^wrapper_sha256=[a-f0-9]{64}$/u.test(linhas[2] ?? "")
    || !/^companion_name=\.sema-launcher-[a-f0-9]{64}\.ps1$/u.test(linhas[3] ?? "")
    || !/^companion_sha256=[a-f0-9]{64}$/u.test(linhas[4] ?? "")
    || !/^receipt_sha256=[a-f0-9]{64}$/u.test(linhas[5] ?? "")
    || linhas[6] !== "") return false;
  const recibo = linhas[5]?.slice("receipt_sha256=".length);
  const base = [...linhas];
  base.splice(5, 1);
  return sha256(Buffer.from(base.join("\r\n"), "ascii")) === recibo;
}

function validarCmd(conteudo: string): {
  versaoPacote: string;
  nomeCompanion: string;
} | null {
  if (/[^\x00-\x7f]/u.test(conteudo)) return null;
  const linhas = conteudo.split("\r\n");
  if (linhas.length !== 10
    || linhas[0] !== "@echo off"
    || linhas[1] !== "@setlocal DisableDelayedExpansion"
    || linhas[2] !== `rem ${MARCADOR}`
    || linhas[7] !== "@set \"_SEMA_EXIT=%ERRORLEVEL%\""
    || linhas[8] !== "@endlocal & exit /b %_SEMA_EXIT%"
    || linhas[9] !== "") return null;
  const versao = linhas[3]?.slice(`rem ${PREFIXO_VERSAO}`.length) ?? "";
  const companion = linhas[4]?.match(/^rem SEMA-LAUNCHER-COMPANION (\.sema-launcher-[a-f0-9]{64}\.ps1)$/u)?.[1];
  const recibo = linhas[5]?.match(new RegExp(`^rem ${PREFIXO_RECIBO}([a-f0-9]{64})$`, "u"))?.[1];
  if (!versaoSemanticaValida(versao) || !companion || !recibo) return null;
  if (linhas[6] !== gerarComandoCompanion(companion)) {
    return null;
  }
  const base = [...linhas];
  base.splice(5, 1);
  if (sha256(base.join("\r\n")) !== recibo) return null;
  return { versaoPacote: versao, nomeCompanion: companion };
}

export function validarCompanionLauncherWindows(
  conteudo: Buffer,
  nomeCompanion: string,
): { versaoPacote: string; executavelNode: string; entrypoint: string } | null {
  if (conteudo.length < UTF8_BOM.length
    || !conteudo.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)
    || nomeCompanion !== `.sema-launcher-${sha256(conteudo)}.ps1`) return null;
  const texto = conteudo.subarray(UTF8_BOM.length).toString("utf8");
  const linhas = texto.split("\r\n");
  const versaoPacote = linhas[1]?.slice(`# ${PREFIXO_VERSAO}`.length) ?? "";
  if (linhas[0] !== `# ${MARCADOR_COMPANION}`
    || linhas[1] !== `# ${PREFIXO_VERSAO}${versaoPacote}`
    || !versaoSemanticaValida(versaoPacote)
    || linhas[3] !== "$ErrorActionPreference = 'Stop'") return null;
  const node = linhas[4]?.match(/^\$node = '((?:[^']|'')*)'$/u)?.[1];
  const entrypoint = linhas[5]?.match(/^\$entrypoint = '((?:[^']|'')*)'$/u)?.[1];
  if (node === undefined || entrypoint === undefined) return null;
  const executavelNode = desescaparPowerShell(node);
  const entrypointReal = desescaparPowerShell(entrypoint);
  if (!path.win32.isAbsolute(executavelNode) || !path.win32.isAbsolute(entrypointReal)) return null;
  if (!conteudo.equals(gerarCompanion(executavelNode, entrypointReal, versaoPacote))) return null;
  return { versaoPacote, executavelNode, entrypoint: entrypointReal };
}

export function validarArtefatosLauncherWindows(
  launcher: string,
  companion: Buffer,
): ReciboLauncherWindows | null {
  const cmd = validarCmd(launcher);
  if (!cmd) return null;
  const ps1 = validarCompanionLauncherWindows(companion, cmd.nomeCompanion);
  if (!ps1 || ps1.versaoPacote !== cmd.versaoPacote) return null;
  return {
    versaoPacote: cmd.versaoPacote,
    executavelNode: ps1.executavelNode,
    entrypoint: ps1.entrypoint,
    nomeCompanion: cmd.nomeCompanion,
  };
}

export function extrairNomeCompanionLauncherWindows(launcher: string): string | null {
  return validarCmd(launcher)?.nomeCompanion ?? null;
}
