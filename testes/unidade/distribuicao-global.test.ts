// SEMA-GOVERNED: sema.produto.distribuicao_global
// Descrição: prova a API combinada e a precedência fechada dos estados de distribuição global.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { link, mkdir, mkdtemp, readFile, readdir, rm, stat, unlink, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import {
  ESTADOS_DISTRIBUICAO_GLOBAL,
  sincronizarLauncherGlobal,
  sincronizarDistribuicaoGlobal,
  statusDistribuicaoGlobal,
  type ResultadoDistribuicaoGlobal,
} from "../../pacotes/cli/src/distribuicao/index.js";
import {
  comLockDistribuicaoGlobal,
  nomeLockDistribuicaoGlobal,
} from "../../pacotes/cli/src/distribuicao/lockGlobal.js";
import {
  escreverArquivoAtomico,
  prepararTransacaoArquivosLauncher,
  recuperarTransacaoArquivosLauncher,
} from "../../pacotes/cli/src/distribuicao/filesystemGlobal.js";
import {
  comandoSkill,
  renderizarResultadoSkill,
} from "../../pacotes/cli/src/skillCommand.js";

function stringsProfundas(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(stringsProfundas);
  if (valor && typeof valor === "object") {
    return Object.values(valor as Record<string, unknown>).flatMap(stringsProfundas);
  }
  return [];
}

function normalizarCaminho(valor: string): string {
  return valor.normalize("NFC").replaceAll("\\", "/").toLocaleLowerCase("en-US");
}

function contemCaminhoEstrutural(payload: unknown, caminho: string): boolean {
  const caminhoNormalizado = normalizarCaminho(caminho);
  return stringsProfundas(payload)
    .map(normalizarCaminho)
    .some((valor) => valor.includes(caminhoNormalizado));
}

async function criarPacoteCompleto(
  base: string,
  versao = "2.3.6-test",
  skill = "skill",
): Promise<string> {
  const raiz = path.join(base, "pacote");
  await mkdir(path.join(raiz, "dist"), { recursive: true });
  await mkdir(path.join(raiz, "skills", "sema", "agents"), { recursive: true });
  await writeFile(path.join(raiz, "package.json"), JSON.stringify({
    name: "@semacode/cli",
    version: versao,
  }), "utf8");
  await writeFile(path.join(raiz, "dist", "bin.js"), "process.exitCode = 0;\n", "utf8");
  await writeFile(path.join(raiz, "skills", "sema", "SKILL.md"), `${skill}\n`, "utf8");
  await writeFile(
    path.join(raiz, "skills", "sema", "agents", "openai.yaml"),
    `name: sema\nversion: ${versao}\n`,
    "utf8",
  );
  return raiz;
}

async function atualizarPacoteCompleto(
  raiz: string,
  versao: string,
  skill: string,
): Promise<void> {
  await writeFile(path.join(raiz, "package.json"), JSON.stringify({
    name: "@semacode/cli",
    version: versao,
  }), "utf8");
  await writeFile(path.join(raiz, "skills", "sema", "SKILL.md"), `${skill}\n`, "utf8");
  await writeFile(
    path.join(raiz, "skills", "sema", "agents", "openai.yaml"),
    `name: sema\nversion: ${versao}\n`,
    "utf8",
  );
}

async function bloquearExclusaoArquivoWindows(caminho: string): Promise<() => Promise<void>> {
  const powershell = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const script = [
    "& { param([string]$arquivo)",
    "$stream = $null",
    "try {",
    "  $stream = [System.IO.File]::Open($arquivo, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)",
    "  [Console]::Out.WriteLine('LOCKED')",
    "  [Console]::Out.Flush()",
    "  [Console]::In.ReadLine() | Out-Null",
    "} finally { if ($null -ne $stream) { $stream.Dispose() } }",
    "}",
  ].join("\n");
  const filho = spawn(
    powershell,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script, caminho],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  const erros: Buffer[] = [];
  filho.stderr.on("data", (parte) => erros.push(Buffer.from(parte)));
  await new Promise<void>((resolve, reject) => {
    let stdout = "";
    const temporizador = setTimeout(() => {
      filho.kill();
      reject(new Error("timeout ao bloquear arquivo de teste no Windows"));
    }, 10_000);
    filho.stdout.on("data", (parte) => {
      stdout += Buffer.from(parte).toString("utf8");
      if (stdout.includes("LOCKED")) {
        clearTimeout(temporizador);
        resolve();
      }
    });
    filho.once("error", (erro) => {
      clearTimeout(temporizador);
      reject(erro);
    });
    filho.once("exit", (codigo) => {
      clearTimeout(temporizador);
      reject(new Error(`processo de lock encerrou com ${codigo}: ${Buffer.concat(erros).toString("utf8")}`));
    });
  });
  return async () => {
    if (filho.exitCode !== null) return;
    const fechado = new Promise<void>((resolve) => filho.once("close", () => resolve()));
    filho.stdin.end("\n");
    await fechado;
  };
}

async function matarAoPublicarTemporarioLauncher(
  home: string,
  tipo: "stage" | "backup",
): Promise<void> {
  const bin = path.join(home, ".sema", "bin");
  await mkdir(bin, { recursive: true });
  const modulo = pathToFileURL(path.join(
    process.cwd(),
    "pacotes",
    "cli",
    "src",
    "distribuicao",
    "filesystemGlobal.ts",
  )).href;
  const codigo = [
    "const api = await import(process.env.SEMA_TEST_MODULO);",
    "await api.prepararTransacaoArquivosLauncher(process.env.SEMA_TEST_HOME, process.env.SEMA_TEST_BIN, [{ nome: process.platform === 'win32' ? 'sema.cmd' : 'sema', conteudoDepois: Buffer.from('crash'), modo: 0o755 }]);",
    "setInterval(() => undefined, 1000);",
  ].join("\n");
  let filho: ReturnType<typeof spawn>;
  const observado = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout aguardando ${tipo}`)), 10_000);
    const monitor = watch(bin, (_evento, nome) => {
      if (!nome || !new RegExp(`^\\.sema-${tipo}-[a-f0-9-]{36}$`, "u").test(nome)) return;
      clearTimeout(timer);
      monitor.close();
      filho.kill();
      resolve();
    });
  });
  filho = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "--eval", codigo], {
    cwd: process.cwd(),
    env: { ...process.env, SEMA_TEST_MODULO: modulo, SEMA_TEST_HOME: home, SEMA_TEST_BIN: bin },
    stdio: "ignore",
  });
  await observado;
  if (filho.exitCode === null) await new Promise<void>((resolve) => filho.once("close", () => resolve()));
}

test("coordenador oferece status e sync combinados com ambiente totalmente injetável", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-distribuicao-global-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacoteCompleto(base);
    const opcoes = {
      plataforma: process.platform,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    } as const;
    assert.deepEqual(ESTADOS_DISTRIBUICAO_GLOBAL, [
      "READY",
      "MISSING",
      "STALE",
      "BROKEN_TARGET",
      "PERMISSION_DENIED",
    ]);

    const antes = await statusDistribuicaoGlobal(opcoes);
    assert.equal(antes.estado, "MISSING");
    assert.equal(antes.launcher.estado, "MISSING");
    assert.equal(antes.skill.estado, "MISSING");
    assert.equal(contemCaminhoEstrutural(antes, base), false);
    assert.equal(contemCaminhoEstrutural({ aninhado: { caminho: base } }, base), true);

    const sincronizado = await sincronizarDistribuicaoGlobal(opcoes);
    assert.equal(sincronizado.estado, "READY");
    assert.equal(sincronizado.alterado, true);
    assert.equal(sincronizado.launcher.estado, "READY");
    assert.equal(sincronizado.skill.estado, "READY");

    const repetido = await sincronizarDistribuicaoGlobal(opcoes);
    assert.equal(repetido.estado, "READY");
    assert.equal(repetido.alterado, false);

    await rm(path.join(raizPacote, "dist", "bin.js"));
    const fechado = await statusDistribuicaoGlobal(opcoes);
    assert.equal(fechado.estado, "BROKEN_TARGET");
    assert.equal(fechado.launcher.estado, "BROKEN_TARGET");
    assert.equal(fechado.skill.estado, "READY");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("comando skill rejeita subcomando e flags curtas ou longas desconhecidas", async () => {
  const linhas: string[] = [];
  const logOriginal = console.log;
  console.log = (...valores: unknown[]) => linhas.push(valores.map(String).join(" "));
  try {
    for (const caso of [
      { posicionais: ["desconhecido"], args: ["--json"] },
      { posicionais: [], args: ["--json", "-x"] },
      { posicionais: [], args: ["--json", "-h"] },
      { posicionais: [], args: ["--json", "--help"] },
      { posicionais: [], args: ["--json", "--force"] },
    ]) {
      linhas.length = 0;
      const codigo = await comandoSkill(caso.posicionais, caso.args, true);
      assert.equal(codigo, 1);
      const payload = JSON.parse(linhas.join("\n")) as {
        sucesso: boolean;
        erro: { codigo: string };
      };
      assert.equal(payload.sucesso, false);
      assert.equal(payload.erro.codigo, "SUBCOMANDO_SKILL_INVALIDO");
    }
  } finally {
    console.log = logOriginal;
  }
});

test("CLI skill expõe códigos diagnósticos finais sem caminho físico", () => {
  const resultado = {
    estado: "STALE",
    alterado: false,
    launcher: {
      estado: "STALE",
      alterado: false,
      destino_simbolico: "$HOME/.sema/bin/sema.cmd",
      codigo: "DESTINO_DESATUALIZADO",
      node_absoluto: true,
      entrypoint_absoluto: true,
      recibo_valido: true,
      independente_path: false,
      fallback_simbolico: "$HOME/.sema/bin/sema-managed.ps1",
    },
    skill: {
      estado: "READY",
      alterado: false,
      origem_simbolica: "$PACKAGE_ROOT/skills/sema",
      destino_agents: "READY",
      destino_claude: "NOT_DETECTED",
      espelho_claude_detectado: false,
      ownership_valido: true,
      digest_alinhado: true,
      cache_plugin_intocado: true,
      destinos: [{
        id: "agents",
        estado: "READY",
        alterado: false,
        destino_simbolico: "$HOME/.agents/skills/sema",
        codigo: "DESTINO_PRONTO",
      }],
    },
  } satisfies ResultadoDistribuicaoGlobal;

  const texto = renderizarResultadoSkill("status", resultado);
  assert.match(texto, /Fallback PowerShell: \$HOME\/\.sema\/bin\/sema-managed\.ps1/u);
  assert.match(texto, /Diagnóstico launcher: DESTINO_DESATUALIZADO/u);
  assert.match(texto, /Diagnósticos skill: agents=DESTINO_PRONTO/u);
  assert.doesNotMatch(texto, /[A-Z]:\\|\/Users\//u);
});

test("diagnóstico inicial bloqueia toda escrita quando a skill existente não é gerenciada", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-distribuicao-diagnostico-"));
  try {
    const home = path.join(base, "home");
    const skillAlheia = path.join(home, ".agents", "skills", "sema");
    await mkdir(skillAlheia, { recursive: true });
    await writeFile(path.join(skillAlheia, "SKILL.md"), "conteúdo do usuário", "utf8");
    const raizPacote = await criarPacoteCompleto(base);
    const opcoes = {
      plataforma: process.platform,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    } as const;
    const launcher = path.join(home, ".sema", "bin", process.platform === "win32"
      ? "sema.cmd"
      : "sema");

    const resultado = await sincronizarDistribuicaoGlobal(opcoes);
    assert.equal(resultado.estado, "BROKEN_TARGET");
    assert.equal(resultado.alterado, false);
    assert.equal(resultado.launcher.alterado, false);
    assert.equal(resultado.skill.alterado, false);
    await assert.rejects(stat(launcher), { code: "ENOENT" });
    assert.equal(await readFile(path.join(skillAlheia, "SKILL.md"), "utf8"), "conteúdo do usuário");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("coordenador mantém READY com limpeza pendente e conclui o GC no retry", async (t) => {
  if (process.platform !== "win32") {
    t.skip("regressão específica do bloqueio de exclusão no Windows");
    return;
  }
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-distribuicao-limpeza-"));
  let liberar: (() => Promise<void>) | undefined;
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacoteCompleto(base, "2.3.6", "skill-v1");
    const opcoes = {
      plataforma: "win32" as const,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    };
    assert.equal((await sincronizarDistribuicaoGlobal(opcoes)).estado, "READY");
    const bin = path.join(home, ".sema", "bin");
    const companions = (await readdir(bin)).filter((nome) => (
      /^\.sema-launcher-[a-f0-9]{64}\.ps1$/u.test(nome)
    ));
    assert.equal(companions.length, 1);
    const companionAntigo = path.join(bin, companions[0] ?? "");
    liberar = await bloquearExclusaoArquivoWindows(companionAntigo);
    await atualizarPacoteCompleto(raizPacote, "2.3.7", "skill-v2");

    const pendente = await sincronizarDistribuicaoGlobal(opcoes);
    assert.equal(pendente.estado, "READY");
    assert.equal(pendente.launcher.estado, "READY");
    assert.equal(pendente.launcher.codigo, "LIMPEZA_PENDENTE");
    await stat(companionAntigo);

    await liberar();
    liberar = undefined;
    const recuperado = await sincronizarDistribuicaoGlobal(opcoes);
    assert.equal(recuperado.estado, "READY");
    assert.equal(recuperado.launcher.estado, "READY");
    assert.equal(recuperado.launcher.codigo, "DESTINO_PRONTO");
    assert.equal(recuperado.alterado, true);
    await assert.rejects(stat(companionAntigo), { code: "ENOENT" });
  } finally {
    await liberar?.();
    await rm(base, { recursive: true, force: true });
  }
});

test("coordenador retorna bytes físicos restaurados após rollback da skill", async (t) => {
  if (process.platform !== "win32") {
    t.skip("regressão específica do bloqueio de rename no Windows");
    return;
  }
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-distribuicao-rollback-fisico-"));
  let liberar: (() => Promise<void>) | undefined;
  try {
    const home = path.join(base, "home");
    await mkdir(path.join(home, ".claude"), { recursive: true });
    const raizPacote = await criarPacoteCompleto(base, "2.3.6", "skill-v1");
    const opcoes = {
      plataforma: "win32" as const,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    };
    assert.equal((await sincronizarDistribuicaoGlobal(opcoes)).estado, "READY");
    const agentsSkill = path.join(home, ".agents", "skills", "sema", "SKILL.md");
    const claudeSkill = path.join(home, ".claude", "skills", "sema", "SKILL.md");
    await atualizarPacoteCompleto(raizPacote, "2.3.7", "skill-v2");
    liberar = await bloquearExclusaoArquivoWindows(claudeSkill);

    const resultado = await sincronizarDistribuicaoGlobal(opcoes);
    assert.equal(resultado.estado, "STALE");
    assert.equal(resultado.alterado, false);
    assert.equal(resultado.launcher.estado, "STALE");
    assert.equal(resultado.launcher.alterado, false);
    assert.equal(resultado.skill.estado, "STALE");
    assert.equal(resultado.skill.destino_agents, "STALE");
    assert.equal(resultado.skill.destino_claude, "STALE");
    assert.equal(await readFile(agentsSkill, "utf8"), "skill-v1\n");
    assert.equal(await readFile(claudeSkill, "utf8"), "skill-v1\n");
  } finally {
    await liberar?.();
    await rm(base, { recursive: true, force: true });
  }
});

async function executarWorkerSync(
  modulo: string,
  opcoes: Record<string, string>,
): Promise<ResultadoDistribuicaoGlobal> {
  const codigo = [
    "const { parentPort, workerData } = require('node:worker_threads');",
    "void import('tsx/esm/api').then(({ register }) => { register(); return import(workerData.modulo); }).then(async (api) => {",
    "  parentPort.postMessage(await api.sincronizarDistribuicaoGlobal(workerData.opcoes));",
    "}).catch((erro) => { parentPort.postMessage({ erro: String(erro?.stack ?? erro) }); });",
  ].join("\n");
  const worker = new Worker(codigo, {
    eval: true,
    workerData: { modulo, opcoes },
  });
  return new Promise((resolve, reject) => {
    worker.once("message", (mensagem: ResultadoDistribuicaoGlobal & { erro?: string }) => {
      if (mensagem.erro) reject(new Error(mensagem.erro));
      else resolve(mensagem);
    });
    worker.once("error", reject);
    worker.once("exit", (codigoSaida) => {
      if (codigoSaida !== 0) reject(new Error(`worker encerrou com ${codigoSaida}`));
    });
  });
}

async function executarProcessoSync(
  modulo: string,
  opcoes: Record<string, string>,
): Promise<ResultadoDistribuicaoGlobal> {
  const codigo = [
    "const api = await import(process.env.SEMA_TEST_MODULE);",
    "const opcoes = JSON.parse(Buffer.from(process.env.SEMA_TEST_OPTIONS_B64, 'base64').toString('utf8'));",
    "const resultado = await api.sincronizarDistribuicaoGlobal(opcoes);",
    "process.stdout.write(JSON.stringify(resultado));",
  ].join("\n");
  const filho = spawn(process.execPath, [
    "--import",
    "tsx",
    "--input-type=module",
    "-e",
    codigo,
  ], {
    env: {
      ...process.env,
      SEMA_TEST_MODULE: modulo,
      SEMA_TEST_OPTIONS_B64: Buffer.from(JSON.stringify(opcoes), "utf8").toString("base64"),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  filho.stdout.on("data", (parte) => stdout.push(Buffer.from(parte)));
  filho.stderr.on("data", (parte) => stderr.push(Buffer.from(parte)));
  const codigoSaida = await new Promise<number | null>((resolve, reject) => {
    filho.once("error", reject);
    filho.once("close", resolve);
  });
  assert.equal(codigoSaida, 0, Buffer.concat(stderr).toString("utf8"));
  return JSON.parse(Buffer.concat(stdout).toString("utf8")) as ResultadoDistribuicaoGlobal;
}

test("lock por HOME serializa coordenador, workers e processos concorrentes", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-distribuicao-concorrente-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacoteCompleto(base, "2.3.6", "skill-v1");
    const opcoes = {
      plataforma: process.platform,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    };
    const modulo = pathToFileURL(path.resolve(
      "pacotes/cli/src/distribuicao/index.ts",
    )).href;

    const locais = await Promise.all(Array.from({ length: 12 }, async () => (
      sincronizarDistribuicaoGlobal(opcoes)
    )));
    assert.equal(
      locais.every((resultado) => resultado.estado === "READY"),
      true,
      JSON.stringify(locais),
    );

    await atualizarPacoteCompleto(raizPacote, "2.3.7", "skill-v2");
    const workers = await Promise.all(Array.from({ length: 6 }, async () => (
      executarWorkerSync(modulo, opcoes)
    )));
    assert.equal(
      workers.every((resultado) => resultado.estado === "READY"),
      true,
      JSON.stringify(workers),
    );

    await atualizarPacoteCompleto(raizPacote, "2.3.8", "skill-v3");
    const processos = await Promise.all(Array.from({ length: 4 }, async () => (
      executarProcessoSync(modulo, opcoes)
    )));
    assert.equal(
      processos.every((resultado) => resultado.estado === "READY"),
      true,
      JSON.stringify(processos),
    );
    assert.equal((await statusDistribuicaoGlobal(opcoes)).estado, "READY");
    assert.equal((await readdir(home)).includes(nomeLockDistribuicaoGlobal()), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("lock recupera worker morto no mesmo PID após expirar o heartbeat", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-distribuicao-worker-crash-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const moduloLock = pathToFileURL(path.resolve(
      "pacotes/cli/src/distribuicao/lockGlobal.ts",
    )).href;
    const codigo = [
      "const { parentPort, workerData } = require('node:worker_threads');",
      "void import('tsx/esm/api').then(({ register }) => { register(); return import(workerData.modulo); }).then((api) => api.comLockDistribuicaoGlobal(",
      "  { diretorioUsuario: workerData.home },",
      "  async () => { parentPort.postMessage('LOCKED'); await new Promise(() => {}); },",
      "));",
    ].join("\n");
    const worker = new Worker(codigo, {
      eval: true,
      workerData: { modulo: moduloLock, home },
    });
    await new Promise<void>((resolve, reject) => {
      worker.once("message", (mensagem) => mensagem === "LOCKED" && resolve());
      worker.once("error", reject);
    });
    await worker.terminate();
    const lock = path.join(home, nomeLockDistribuicaoGlobal());
    const antigo = new Date(Date.now() - 60_000);
    await utimes(lock, antigo, antigo);

    let executou = false;
    await comLockDistribuicaoGlobal({ diretorioUsuario: home }, async () => {
      executou = true;
    });
    assert.equal(executou, true);
    await assert.rejects(stat(lock), { code: "ENOENT" });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("reclaim cercado recua quando o owner renova heartbeat", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-distribuicao-reclaim-heartbeat-"));
  let worker: Worker | undefined;
  let envelhecer: NodeJS.Timeout | undefined;
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const moduloLock = pathToFileURL(path.resolve(
      "pacotes/cli/src/distribuicao/lockGlobal.ts",
    )).href;
    const moduloFs = pathToFileURL(path.resolve(
      "pacotes/cli/src/distribuicao/filesystemGlobal.ts",
    )).href;
    const codigo = [
      "const { parentPort, workerData } = require('node:worker_threads');",
      "void import('tsx/esm/api').then(({ register }) => { register(); return Promise.all([import(workerData.lock), import(workerData.fs)]); }).then(async ([lock, fs]) => {",
      "  let liberarGo; let liberarFim;",
      "  const go = new Promise((resolve) => { liberarGo = resolve; });",
      "  const fim = new Promise((resolve) => { liberarFim = resolve; });",
      "  parentPort.on('message', (mensagem) => { if (mensagem === 'GO') liberarGo(); if (mensagem === 'RELEASE') liberarFim(); });",
      "  await lock.comLockDistribuicaoGlobal({ diretorioUsuario: workerData.home }, async () => {",
      "    parentPort.postMessage('LOCKED');",
      "    await go;",
      "    await fs.escreverArquivoAtomico(workerData.home, workerData.sentinela, 'owner-ativo', 0o600);",
      "    parentPort.postMessage('MUTATED');",
      "    await fim;",
      "  });",
      "  parentPort.postMessage('DONE');",
      "}).catch((erro) => parentPort.postMessage({ erro: String(erro?.stack ?? erro) }));",
    ].join("\n");
    const sentinela = path.join(home, "owner-ativo.txt");
    worker = new Worker(codigo, {
      eval: true,
      workerData: { lock: moduloLock, fs: moduloFs, home, sentinela },
    });
    const esperarMensagem = (esperada: string): Promise<void> => new Promise((resolve, reject) => {
      const aoReceber = (mensagem: unknown) => {
        if (typeof mensagem === "object" && mensagem && "erro" in mensagem) {
          worker?.off("message", aoReceber);
          reject(new Error(String((mensagem as { erro: unknown }).erro)));
        } else if (mensagem === esperada) {
          worker?.off("message", aoReceber);
          resolve();
        }
      };
      worker?.on("message", aoReceber);
      worker?.once("error", reject);
    });
    await esperarMensagem("LOCKED");
    const lock = path.join(home, nomeLockDistribuicaoGlobal());
    const antigo = new Date(Date.now() - 60_000);
    envelhecer = setInterval(() => {
      void utimes(lock, antigo, antigo).catch(() => undefined);
    }, 20);
    await utimes(lock, antigo, antigo);
    let segundoExecutou = false;
    const segundo = comLockDistribuicaoGlobal({ diretorioUsuario: home }, async () => {
      segundoExecutou = true;
    });
    const limite = Date.now() + 5_000;
    while (Date.now() < limite) {
      if ((await readdir(home)).some((nome) => nome.includes(".lock.reclaim."))) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    clearInterval(envelhecer);
    envelhecer = undefined;
    assert.equal((await readdir(home)).some((nome) => nome.includes(".lock.reclaim.")), true);
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    const mutado = esperarMensagem("MUTATED");
    worker.postMessage("GO");
    await mutado;
    assert.equal(await readFile(sentinela, "utf8"), "owner-ativo");
    const concluido = esperarMensagem("DONE");
    worker.postMessage("RELEASE");
    await concluido;
    await segundo;
    assert.equal(segundoExecutou, true);
    assert.equal((await readdir(home)).some((nome) => nome.includes(".lock.reclaim.")), false);
  } finally {
    if (envelhecer) clearInterval(envelhecer);
    await worker?.terminate();
    await rm(base, { recursive: true, force: true });
  }
});

test("lock preserva final alheio e recupera publicações próprias interrompidas", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-distribuicao-lock-publicacao-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacoteCompleto(base);
    const opcoes = {
      plataforma: process.platform,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    } as const;
    const lock = path.join(home, nomeLockDistribuicaoGlobal());
    await writeFile(lock, "arquivo alheio reservado\n", "utf8");
    const bloqueado = await sincronizarDistribuicaoGlobal(opcoes);
    assert.equal(bloqueado.estado, "BROKEN_TARGET");
    assert.equal(bloqueado.launcher.codigo, "CONTEUDO_NAO_GERENCIADO");
    assert.equal(await readFile(lock, "utf8"), "arquivo alheio reservado\n");
    await assert.rejects(stat(path.join(home, ".agents", "skills", "sema")), { code: "ENOENT" });
    await unlink(lock);

    const nonceAntesLink = "11111111-1111-4111-8111-111111111111";
    const tempAntesLink = path.join(
      home,
      `${nomeLockDistribuicaoGlobal()}.${nonceAntesLink}.tmp`,
    );
    const nonceDesconhecido = "33333333-3333-4333-8333-333333333333";
    const tempDesconhecido = path.join(
      home,
      `${nomeLockDistribuicaoGlobal()}.${nonceDesconhecido}.tmp`,
    );
    const falsoParecido = path.join(home, `${nomeLockDistribuicaoGlobal()}.nao-gerenciado.tmp`);
    await writeFile(tempAntesLink, `${JSON.stringify({
      schema: "sema.distribuicao-global-lock/v1",
      pid: process.pid,
      threadId: 999_998,
      nonce: nonceAntesLink,
      criadoEm: new Date(0).toISOString(),
    })}\n`, "utf8");
    await writeFile(tempDesconhecido, "arquivo alheio em nome reservado", "utf8");
    await writeFile(falsoParecido, "preservar", "utf8");
    const antigo = new Date(Date.now() - 60_000);
    await utimes(tempAntesLink, antigo, antigo);
    await utimes(tempDesconhecido, antigo, antigo);
    assert.equal((await sincronizarDistribuicaoGlobal(opcoes)).estado, "READY");
    await assert.rejects(stat(tempAntesLink), { code: "ENOENT" });
    assert.equal(await readFile(tempDesconhecido, "utf8"), "arquivo alheio em nome reservado");
    assert.equal(await readFile(falsoParecido, "utf8"), "preservar");

    const nonceDepoisLink = "22222222-2222-4222-8222-222222222222";
    const tempDepoisLink = path.join(
      home,
      `${nomeLockDistribuicaoGlobal()}.${nonceDepoisLink}.tmp`,
    );
    const recibo = `${JSON.stringify({
      schema: "sema.distribuicao-global-lock/v1",
      pid: process.pid,
      threadId: 999_999,
      nonce: nonceDepoisLink,
      criadoEm: new Date(0).toISOString(),
    })}\n`;
    await writeFile(tempDepoisLink, recibo, "utf8");
    await link(tempDepoisLink, lock);
    await utimes(tempDepoisLink, antigo, antigo);
    assert.equal((await sincronizarDistribuicaoGlobal(opcoes)).estado, "READY");
    await assert.rejects(stat(lock), { code: "ENOENT" });
    await assert.rejects(stat(tempDepoisLink), { code: "ENOENT" });
    assert.equal(await readFile(falsoParecido, "utf8"), "preservar");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("contexto tardio não reutiliza lease liberado e owner retomado não declara sucesso", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-distribuicao-lock-owner-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const lock = path.join(home, nomeLockDistribuicaoGlobal());
    let resolverTardio!: (valor: boolean) => void;
    let rejeitarTardio!: (erro: unknown) => void;
    const tardio = new Promise<boolean>((resolve, reject) => {
      resolverTardio = resolve;
      rejeitarTardio = reject;
    });
    await comLockDistribuicaoGlobal({ diretorioUsuario: home }, async () => {
      setTimeout(() => {
        let adquiriuNovoLease = false;
        void comLockDistribuicaoGlobal({ diretorioUsuario: home }, async () => {
          adquiriuNovoLease = (await stat(lock)).isFile();
        }).then(() => resolverTardio(adquiriuNovoLease)).catch(rejeitarTardio);
      }, 0);
    });
    assert.equal(await tardio, true);

    await assert.rejects(
      comLockDistribuicaoGlobal({ diretorioUsuario: home }, async () => {
        await unlink(lock);
        await writeFile(lock, "owner substituto", "utf8");
        const proibido = path.join(home, "mutacao-owner-antigo.txt");
        await assert.rejects(
          escreverArquivoAtomico(home, proibido, "não escrever", 0o600),
          (erro: unknown) => (erro as { codigo?: string }).codigo === "LOCK_PERDIDO",
        );
        await assert.rejects(stat(proibido), { code: "ENOENT" });
        return "NAO_PODE_SER_SUCESSO";
      }),
      (erro: unknown) => (erro as { codigo?: string }).codigo === "LOCK_PERDIDO",
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("retry recupera crash em stage e backup do launcher sem coletar falso padrão", async () => {
  for (const tipo of ["stage", "backup"] as const) {
    const base = await mkdtemp(path.join(os.tmpdir(), `sema-launcher-crash-${tipo}-`));
    try {
      const home = path.join(base, "home");
      const raizPacote = await criarPacoteCompleto(base);
      await matarAoPublicarTemporarioLauncher(home, tipo);
      const bin = path.join(home, ".sema", "bin");
      assert.equal((await readdir(bin)).some((nome) => (
        new RegExp(`^\\.sema-${tipo}-[a-f0-9-]{36}$`, "u").test(nome)
      )), true);
      const falso = `.sema-stage-${tipo === "stage"
        ? "ffffffff-ffff-4fff-8fff-ffffffffffff"
        : "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"}`;
      await writeFile(path.join(bin, falso), "arquivo alheio", "utf8");
      const resultado = await sincronizarLauncherGlobal({
        plataforma: process.platform,
        diretorioUsuario: home,
        executavelNode: process.execPath,
        raizPacote,
      });
      assert.equal(resultado.estado, "READY", JSON.stringify(resultado));
      const restantes = await readdir(bin);
      assert.equal(restantes.includes(falso), true);
      assert.equal(restantes.includes(".sema-launcher-journal"), false);
      assert.deepEqual(restantes.filter((nome) => (
        nome !== falso && /^\.sema-(?:stage|backup)-[a-f0-9-]{36}$/u.test(nome)
      )), []);
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  }
});

test("journal preparado compensa mutação parcial e journal alheio falha fechado", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-launcher-journal-recovery-"));
  try {
    const home = path.join(base, "home");
    const bin = path.join(home, ".sema", "bin");
    const nomeLauncher = process.platform === "win32" ? "sema.cmd" : "sema";
    const launcher = path.join(bin, nomeLauncher);
    await mkdir(bin, { recursive: true });
    await writeFile(launcher, "antes", "utf8");
    await prepararTransacaoArquivosLauncher(home, bin, [{
      nome: nomeLauncher,
      conteudoDepois: Buffer.from("depois", "utf8"),
      modo: 0o755,
    }]);
    await writeFile(launcher, "depois", "utf8");

    const recuperado = await recuperarTransacaoArquivosLauncher(home, bin);
    assert.equal(recuperado.alterado, true);
    assert.equal(await readFile(launcher, "utf8"), "antes");
    assert.deepEqual((await readdir(bin)).filter((nome) => (
      nome === ".sema-launcher-journal" || /^\.sema-(?:stage|backup)-/u.test(nome)
    )), []);

    await writeFile(path.join(bin, ".sema-launcher-journal"), "arquivo alheio", "utf8");
    const raizPacote = await criarPacoteCompleto(base);
    const fechado = await sincronizarLauncherGlobal({
      plataforma: process.platform,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    });
    assert.equal(fechado.estado, "BROKEN_TARGET");
    assert.equal(fechado.codigo, "RECIBO_INVALIDO");
    assert.equal(await readFile(path.join(bin, ".sema-launcher-journal"), "utf8"), "arquivo alheio");
    assert.equal(await readFile(launcher, "utf8"), "antes");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
