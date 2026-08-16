// SEMA-GOVERNED: sema.produto.fronteira_repositorios.empacotamento.smoke
// Descrição: prova instalação global isolada sem contaminar HOME, caches de plugins ou workspace real.
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, readlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { extrairPayloadResultadoCliV1 } from "./resultado-cli.mjs";

export function ambienteInstalacaoIsolada(diretorioUsuario, cacheIsolado) {
  return {
    ...process.env,
    HOME: diretorioUsuario,
    USERPROFILE: diretorioUsuario,
    LOCALAPPDATA: path.join(diretorioUsuario, "local-app-data"),
    XDG_CACHE_HOME: path.join(diretorioUsuario, "xdg-cache"),
    CODEX_HOME: path.join(diretorioUsuario, ".codex"),
    npm_config_cache: cacheIsolado,
    NPM_CONFIG_CACHE: cacheIsolado,
  };
}

export function caminhosCachePluginIsolado(diretorioUsuario, ambiente) {
  const codexHome = ambiente.CODEX_HOME?.trim();
  const raizCodex = codexHome && path.isAbsolute(codexHome)
    ? codexHome
    : path.join(diretorioUsuario, ".codex");
  return [...new Set([
    path.join(raizCodex, "plugins", "cache"),
    path.join(diretorioUsuario, ".codex", "plugins", "cache"),
    path.join(diretorioUsuario, ".claude", "plugins", "cache"),
  ])];
}

export function caminhosEstadoSemaReal(raizWorkspace = process.cwd()) {
  const diretorioUsuarioReal = os.homedir();
  const localAppDataReal = process.env.LOCALAPPDATA
    ? path.resolve(process.env.LOCALAPPDATA)
    : path.join(diretorioUsuarioReal, "AppData", "Local");
  const cacheUnixReal = process.env.XDG_CACHE_HOME
    ? path.resolve(process.env.XDG_CACHE_HOME, "sema")
    : path.join(diretorioUsuarioReal, ".cache", "sema");
  const codexHomeReal = process.env.CODEX_HOME?.trim();
  return [...new Set([
    path.join(diretorioUsuarioReal, ".agents", "skills", "sema"),
    path.join(diretorioUsuarioReal, ".claude", "skills", "sema"),
    path.join(diretorioUsuarioReal, ".codex", "skills", "sema"),
    path.join(diretorioUsuarioReal, ".codex", "plugins", "cache", "sema"),
    path.join(diretorioUsuarioReal, ".claude", "plugins", "cache", "sema"),
    ...(codexHomeReal && path.isAbsolute(codexHomeReal)
      ? [path.join(codexHomeReal, "plugins", "cache", "sema")]
      : []),
    path.join(diretorioUsuarioReal, ".sema", "bin"),
    path.join(diretorioUsuarioReal, ".local", "bin", "sema"),
    path.join(diretorioUsuarioReal, ".local", "bin", "sema.cmd"),
    path.join(localAppDataReal, "Sema"),
    cacheUnixReal,
    path.join(raizWorkspace, ".agents", "skills", "sema"),
    path.join(raizWorkspace, ".claude", "skills", "sema"),
    path.join(raizWorkspace, ".codex", "skills", "sema"),
    path.join(raizWorkspace, "skills", "sema"),
    path.join(raizWorkspace, ".sema", "cache"),
  ])];
}

export async function fingerprintCaminhos(caminhos) {
  const hash = createHash("sha256");

  async function visitar(caminho, referencia) {
    let estado;
    try {
      estado = await lstat(caminho);
    } catch (erro) {
      if (erro?.code === "ENOENT") {
        hash.update(`ausente:${referencia}\n`);
        return;
      }
      throw erro;
    }

    if (estado.isSymbolicLink()) {
      hash.update(`link:${referencia}:${await readlink(caminho)}\n`);
      return;
    }
    if (estado.isDirectory()) {
      hash.update(`dir:${referencia}\n`);
      const entradas = await readdir(caminho, { withFileTypes: true });
      entradas.sort((a, b) => a.name.localeCompare(b.name));
      for (const entrada of entradas) {
        await visitar(path.join(caminho, entrada.name), `${referencia}/${entrada.name}`);
      }
      return;
    }
    hash.update(`file:${referencia}:${estado.mode}:${estado.size}\n`);
    hash.update(await readFile(caminho));
  }

  for (const [indice, caminho] of caminhos.entries()) {
    await visitar(caminho, `alvo-${indice}`);
  }
  return hash.digest("hex");
}

function normalizarCaminhoParaRedacao(valor) {
  return valor
    .normalize("NFC")
    .replaceAll("\\", "/")
    .replace(/\/+$/u, "")
    .toLocaleLowerCase("en-US");
}

function variantesCaminhoParaRedacao(valor) {
  const variantes = new Set([normalizarCaminhoParaRedacao(valor)]);
  let atual = valor;
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    try {
      const decodificado = decodeURIComponent(atual);
      if (decodificado === atual) break;
      variantes.add(normalizarCaminhoParaRedacao(decodificado));
      atual = decodificado;
    } catch {
      break;
    }
  }
  return variantes;
}

function coletarStrings(valor, destino) {
  if (typeof valor === "string") {
    destino.push(valor);
    return;
  }
  if (Array.isArray(valor)) {
    for (const item of valor) coletarStrings(item, destino);
    return;
  }
  if (valor && typeof valor === "object") {
    for (const item of Object.values(valor)) coletarStrings(item, destino);
  }
}

export function payloadContemCaminhoSensivel(payload, caminhos) {
  const candidatos = caminhos
    .filter((caminho) => typeof caminho === "string" && caminho.trim())
    .map(normalizarCaminhoParaRedacao);
  const strings = [];
  coletarStrings(payload, strings);
  return strings.some((valor) => {
    const variantes = variantesCaminhoParaRedacao(valor);
    return candidatos.some((caminho) => [...variantes].some((normalizado) => normalizado.includes(caminho)));
  });
}

function resolverComSpec(ambiente) {
  const systemRoot = ambiente.SystemRoot?.trim();
  return path.join(systemRoot && path.isAbsolute(systemRoot) ? systemRoot : "C:\\Windows", "System32", "cmd.exe");
}

function resolverPowerShellSpec(ambiente) {
  const systemRoot = ambiente.SystemRoot?.trim();
  return path.join(
    systemRoot && path.isAbsolute(systemRoot) ? systemRoot : "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
}

function prepararInvocacaoCmd(launcher, argumentos, ambiente) {
  const valores = [launcher, ...argumentos];
  if (valores.some((valor) => /[\0\r\n"]/u.test(valor))) {
    throw new Error("The launcher or argument contains an unsupported cmd.exe character.");
  }
  const env = {
    ...ambiente,
    SEMA_CHCP: path.join(
      ambiente.SystemRoot?.trim() && path.isAbsolute(ambiente.SystemRoot.trim())
        ? ambiente.SystemRoot.trim()
        : "C:\\Windows",
      "System32",
      "chcp.com",
    ),
    SEMA_LAUNCHER: launcher,
  };
  const referencias = ['"%SEMA_LAUNCHER%"'];
  argumentos.forEach((arg, indice) => {
    const nome = `SEMA_ARG_${indice}`;
    env[nome] = arg;
    referencias.push(`"%${nome}%"`);
  });
  return {
    argumentosCmd: [
      "/d",
      "/s",
      "/v:off",
      "/c",
      `""%SEMA_CHCP%" 65001>nul & ${referencias.join(" ")}"`,
    ],
    env,
  };
}

export function executarLauncherAbsoluto(launcher, argumentos, cwd, ambiente, entrada) {
  const invocacao = process.platform === "win32"
    ? prepararInvocacaoCmd(launcher, argumentos, ambiente)
    : undefined;
  const resultado = process.platform === "win32"
    ? spawnSync(resolverComSpec(ambiente), invocacao.argumentosCmd, {
      cwd,
      env: invocacao.env,
      encoding: "utf8",
      input: entrada,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
      windowsVerbatimArguments: true,
    })
    : spawnSync(launcher, argumentos, {
      cwd,
      env: ambiente,
      encoding: "utf8",
      input: entrada,
      maxBuffer: 16 * 1024 * 1024,
    });
  if (resultado.error) {
    throw resultado.error;
  }
  if (resultado.status !== 0) {
    throw new Error(`Absolute Sema launcher failed with exit code ${resultado.status}.`);
  }
  return resultado.stdout;
}

export function executarFallbackPowerShellAbsoluto(fallback, argumentos, cwd, ambiente, entrada) {
  const resultado = process.platform === "win32"
    ? spawnSync(resolverPowerShellSpec(ambiente), [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      fallback,
      ...argumentos,
    ], {
      cwd,
      env: ambiente,
      encoding: "utf8",
      input: entrada,
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    })
    : spawnSync(fallback, argumentos, {
      cwd,
      env: ambiente,
      encoding: "utf8",
      input: entrada,
      maxBuffer: 16 * 1024 * 1024,
    });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`Absolute Sema PowerShell fallback failed with exit code ${resultado.status}.`);
  }
  return resultado.stdout;
}

export function validarStatusDistribuicaoPronta(payload) {
  return payload?.sucesso === true
    && payload.operacao === "status"
    && payload.resultado?.estado === "READY"
    && payload.resultado?.launcher?.estado === "READY"
    && payload.resultado?.skill?.estado === "READY"
    && payload.resultado?.alterado === false;
}

export async function validarInstalacaoGlobalIsolada({
  caminhoTarball,
  sandbox,
  versaoEsperada,
  executar,
  existe,
  raizWorkspace = process.cwd(),
}) {
  const diretorioUsuarioIsolado = path.join(sandbox, "日本 A%META%B 100%! & caret^");
  const prefixoGlobalIsolado = path.join(sandbox, "Prefixo global (A)&B");
  const cacheNpmGlobalIsolado = path.join(sandbox, "Cache npm global (A)&B");
  const workspaceGlobalIsolado = path.join(sandbox, "Workspace global (A)&B");
  const pathSemNodeNpm = path.join(sandbox, "path-sem-node-npm");
  await Promise.all([
    mkdir(diretorioUsuarioIsolado, { recursive: true }),
    mkdir(prefixoGlobalIsolado, { recursive: true }),
    mkdir(workspaceGlobalIsolado, { recursive: true }),
    mkdir(pathSemNodeNpm, { recursive: true }),
  ]);

  const ambienteGlobal = {
    ...ambienteInstalacaoIsolada(diretorioUsuarioIsolado, cacheNpmGlobalIsolado),
    META: "EXPANDIDO",
    npm_config_prefix: prefixoGlobalIsolado,
    NPM_CONFIG_PREFIX: prefixoGlobalIsolado,
    npm_config_userconfig: path.join(diretorioUsuarioIsolado, ".npmrc"),
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
  };
  delete ambienteGlobal.npm_config_global;
  delete ambienteGlobal.NPM_CONFIG_GLOBAL;
  const caminhosReais = caminhosEstadoSemaReal(raizWorkspace);
  const caminhosPluginsIsolados = caminhosCachePluginIsolado(diretorioUsuarioIsolado, ambienteGlobal);
  const estadoRealAntes = await fingerprintCaminhos(caminhosReais);
  const estadoPluginsAntes = await fingerprintCaminhos(caminhosPluginsIsolados);
  if ((await readdir(workspaceGlobalIsolado)).length !== 0) {
    throw new Error("The isolated global workspace was not empty before npm install.");
  }

  try {
    executar("npm", [
      "install",
      "--global",
      "--prefix",
      prefixoGlobalIsolado,
      "--foreground-scripts",
      "--no-audit",
      "--no-fund",
      caminhoTarball,
    ], workspaceGlobalIsolado, {
      env: ambienteGlobal,
      cacheNpm: cacheNpmGlobalIsolado,
    });

    const baseNodeModulesGlobal = process.platform === "win32"
      ? path.join(prefixoGlobalIsolado, "node_modules")
      : path.join(prefixoGlobalIsolado, "lib", "node_modules");
    const basePacoteGlobal = path.join(baseNodeModulesGlobal, "@semacode", "cli");
    const skillEmpacotada = path.join(basePacoteGlobal, "skills", "sema");
    const skillSincronizada = path.join(diretorioUsuarioIsolado, ".agents", "skills", "sema");
    const launcher = path.join(
      diretorioUsuarioIsolado,
      ".sema",
      "bin",
      process.platform === "win32" ? "sema.cmd" : "sema",
    );
    const fallbackPowerShell = process.platform === "win32"
      ? path.join(diretorioUsuarioIsolado, ".sema", "bin", "sema-managed.ps1")
      : launcher;
    const apiDistribuicao = await import(pathToFileURL(path.join(
      basePacoteGlobal,
      "dist",
      "distribuicao",
      "index.js",
    )).href);
    if (
      typeof apiDistribuicao.statusDistribuicaoGlobal !== "function" ||
      typeof apiDistribuicao.sincronizarDistribuicaoGlobal !== "function"
    ) {
      throw new Error("The installed package omitted the compiled global distribution API.");
    }
    const statusDistribuicao = await apiDistribuicao.statusDistribuicaoGlobal({
      plataforma: process.platform,
      diretorioUsuario: diretorioUsuarioIsolado,
      executavelNode: process.execPath,
      raizPacote: basePacoteGlobal,
    });
    if (
      statusDistribuicao.estado !== "READY" ||
      statusDistribuicao.launcher?.estado !== "READY" ||
      statusDistribuicao.skill?.estado !== "READY"
    ) {
      throw new Error("The global npm postinstall did not leave launcher and skill in READY state.");
    }

    for (const arquivo of [
      path.join(basePacoteGlobal, "scripts", "postinstall.mjs"),
      path.join(skillEmpacotada, "SKILL.md"),
      path.join(skillEmpacotada, "agents", "openai.yaml"),
      path.join(skillSincronizada, "SKILL.md"),
      path.join(skillSincronizada, "agents", "openai.yaml"),
      launcher,
      fallbackPowerShell,
    ]) {
      if (!(await existe(arquivo))) {
        throw new Error(`The isolated global install did not materialize ${path.basename(arquivo)}.`);
      }
    }
    if (await fingerprintCaminhos([
      path.join(skillEmpacotada, "SKILL.md"),
      path.join(skillEmpacotada, "agents", "openai.yaml"),
    ]) !== await fingerprintCaminhos([
      path.join(skillSincronizada, "SKILL.md"),
      path.join(skillSincronizada, "agents", "openai.yaml"),
    ])) {
      throw new Error("The globally synchronized Sema skill differs from the packaged source.");
    }
    if (await existe(path.join(diretorioUsuarioIsolado, ".claude"))) {
      throw new Error("The global install created a Claude skill root that was not already present.");
    }

    const ambienteSemNodeNpm = {
      ...ambienteGlobal,
      PATH: pathSemNodeNpm,
      Path: pathSemNodeNpm,
    };
    const versao = executarLauncherAbsoluto(
      launcher,
      ["--version"],
      workspaceGlobalIsolado,
      ambienteSemNodeNpm,
    ).trim();
    if (versao !== versaoEsperada) {
      throw new Error(`The absolute global launcher returned ${versao}; expected ${versaoEsperada}.`);
    }
    const versaoFallback = executarFallbackPowerShellAbsoluto(
      fallbackPowerShell,
      ["--version"],
      workspaceGlobalIsolado,
      ambienteSemNodeNpm,
    ).trim();
    if (versaoFallback !== versaoEsperada) {
      throw new Error(`The managed PowerShell fallback returned ${versaoFallback}; expected ${versaoEsperada}.`);
    }
    const ajuda = executarLauncherAbsoluto(
      launcher,
      ["--help"],
      workspaceGlobalIsolado,
      ambienteSemNodeNpm,
    );
    if (!ajuda.includes("sema resumo") || !ajuda.includes("sema sync-codex")) {
      throw new Error("The absolute global launcher returned incomplete help without Node/npm on PATH.");
    }
    const statusSkill = extrairPayloadResultadoCliV1(executarLauncherAbsoluto(
      launcher,
      ["skill", "status", "--json"],
      workspaceGlobalIsolado,
      ambienteSemNodeNpm,
    ), {
      contexto: "skill status no launcher global isolado",
      command: "skill",
      exitCode: 0,
      kind: "SUCCESS",
    });
    if (
      !validarStatusDistribuicaoPronta(statusSkill) ||
      statusSkill.resultado?.launcher?.fallback_simbolico !== (process.platform === "win32"
        ? "$HOME/.sema/bin/sema-managed.ps1"
        : null) ||
      payloadContemCaminhoSensivel(statusSkill, [
        diretorioUsuarioIsolado,
        prefixoGlobalIsolado,
        basePacoteGlobal,
        process.execPath,
      ])
    ) {
      throw new Error("The installed `sema skill status` command was not read-only, ready, and redacted.");
    }
    const syncSkill = extrairPayloadResultadoCliV1(executarLauncherAbsoluto(
      launcher,
      ["skill", "sync", "--json"],
      workspaceGlobalIsolado,
      ambienteSemNodeNpm,
    ), {
      contexto: "skill sync no launcher global isolado",
      command: "skill",
      exitCode: 0,
      kind: "SUCCESS",
    });
    if (
      syncSkill.sucesso !== true ||
      syncSkill.operacao !== "sync" ||
      syncSkill.resultado?.estado !== "READY" ||
      syncSkill.resultado?.alterado !== false
    ) {
      throw new Error("The installed `sema skill sync` command was not idempotent after postinstall.");
    }
    const resumo = extrairPayloadResultadoCliV1(executarLauncherAbsoluto(
      launcher,
      [
        "resumo",
        path.join(basePacoteGlobal, "exemplos", "calculadora.sema"),
        "--micro",
        "--drift",
        "none",
        "--json",
      ],
      basePacoteGlobal,
      ambienteSemNodeNpm,
    ), {
      contexto: "resumo no launcher global isolado",
      command: "resumo",
      exitCode: 0,
      kind: "SUCCESS",
    });
    if (
      resumo.comando !== "resumo" ||
      resumo.analiseDrift?.modo !== "none" ||
      resumo.analiseDrift.executada !== false
    ) {
      throw new Error("The absolute global launcher did not preserve resumo --drift none semantics.");
    }

    const cacheDriftIsolado = process.platform === "win32"
      ? path.join(ambienteGlobal.LOCALAPPDATA, "Sema", "Cache")
      : process.platform === "darwin"
        ? path.join(diretorioUsuarioIsolado, "Library", "Caches", "Sema")
        : path.join(ambienteGlobal.XDG_CACHE_HOME, "sema");
    if (await existe(cacheDriftIsolado)) {
      throw new Error("The absolute resumo --drift none launcher smoke wrote persistent drift cache.");
    }
  } finally {
    const [estadoRealDepois, estadoPluginsDepois, entradasWorkspace] = await Promise.all([
      fingerprintCaminhos(caminhosReais),
      fingerprintCaminhos(caminhosPluginsIsolados),
      readdir(workspaceGlobalIsolado),
    ]);
    if (estadoRealDepois !== estadoRealAntes) {
      throw new Error("The isolated global install mutated a real HOME, workspace, or Sema cache target.");
    }
    if (estadoPluginsDepois !== estadoPluginsAntes ||
        (await Promise.all(caminhosPluginsIsolados.map(existe))).some(Boolean)) {
      throw new Error("The isolated global install created or mutated an AI plugin cache.");
    }
    if (entradasWorkspace.length !== 0) {
      throw new Error("The isolated global npm install wrote files into its current working directory.");
    }
  }
}
