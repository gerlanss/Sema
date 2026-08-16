// SEMA-GOVERNED: sema.produto.distribuicao_global
// Descrição: prova launcher absoluto, idempotente, íntegro e confinado à home injetada.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, chmod, copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  capturarSnapshotLauncherGlobalTransacao,
  restaurarSnapshotLauncherGlobalTransacao,
  sincronizarLauncherGlobal,
  sincronizarLauncherGlobalTransacional,
  statusLauncherGlobal,
} from "../../pacotes/cli/src/distribuicao/launcherGlobal.js";

function aspasCmd(valor: string): string {
  if (/[\r\n"%!]/u.test(valor)) throw new Error("valor incompatível com o invocador de teste");
  return `"${valor}"`;
}

async function criarPacote(base: string, nome: string, versao = "2.3.6-test"): Promise<string> {
  const raiz = path.join(base, nome);
  await mkdir(path.join(raiz, "dist"), { recursive: true });
  await writeFile(path.join(raiz, "package.json"), JSON.stringify({
    name: "@semacode/cli",
    version: versao,
  }), "utf8");
  await writeFile(path.join(raiz, "dist", "index.js"), [
    "const partes = [];",
    "process.stdin.on('data', (parte) => partes.push(Buffer.from(parte)));",
    "process.stdin.on('end', () => {",
    "  const args = process.argv.slice(2);",
    "  const indice = args.indexOf('--exit');",
    "  const exitCode = indice >= 0 ? Number(args[indice + 1]) : 0;",
    "  process.stdout.write(`${JSON.stringify({ args, stdin: Buffer.concat(partes).toString('utf8'), node_options: process.env.NODE_OPTIONS ?? null })}\\n`);",
    "  process.exit(exitCode);",
    "});",
    "process.stdin.resume();",
    "",
  ].join("\n"), "utf8");
  return raiz;
}

async function executarLauncher(
  launcher: string,
  args: string[],
  entrada: string,
): Promise<{ codigo: number | null; stdout: string; stderr: string }> {
  const filho = process.platform === "win32"
    ? spawn(
      process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe",
      ["/d", "/s", "/c", `"${[launcher, ...args].map(aspasCmd).join(" ")}"`],
      {
        env: { ...process.env, PATH: "" },
        windowsHide: true,
        windowsVerbatimArguments: true,
      },
    )
    : spawn(launcher, args, { env: { ...process.env, PATH: "" } });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  filho.stdout.on("data", (parte) => stdout.push(Buffer.from(parte)));
  filho.stderr.on("data", (parte) => stderr.push(Buffer.from(parte)));
  filho.stdin.end(entrada);
  const codigo = await new Promise<number | null>((resolve, reject) => {
    filho.once("error", reject);
    filho.once("close", resolve);
  });
  return {
    codigo,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
  };
}

async function executarPowerShellBare(
  diretorioLauncher: string,
  args: string[],
  entrada: string,
  launcherCmd?: string,
): Promise<{ codigo: number | null; stdout: string; stderr: string }> {
  const powershell = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$utf8 = [System.Text.UTF8Encoding]::new($false, $true)",
    "$argsJson = $utf8.GetString([System.Convert]::FromBase64String($env:SEMA_TEST_ARGS_B64))",
    "$decoded = ConvertFrom-Json -InputObject $argsJson",
    "[string[]]$invokeArgs = @($decoded | ForEach-Object { [string]$_ })",
    "if ($env:SEMA_TEST_LAUNCHER) { $env:PATH = ''; & $env:SEMA_TEST_LAUNCHER @invokeArgs } else { $env:PATH = $env:SEMA_TEST_BIN; & sema @invokeArgs }",
    "exit $LASTEXITCODE",
  ].join("\r\n");
  const filho = spawn(powershell, [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script,
  ], {
    env: {
      ...process.env,
      PATH: "",
      SEMA_TEST_ARGS_B64: Buffer.from(JSON.stringify(args), "utf8").toString("base64"),
      SEMA_TEST_BIN: diretorioLauncher,
      SEMA_TEST_LAUNCHER: launcherCmd ?? "",
    },
    windowsHide: true,
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  filho.stdout.on("data", (parte) => stdout.push(Buffer.from(parte)));
  filho.stderr.on("data", (parte) => stderr.push(Buffer.from(parte)));
  filho.stdin.end(entrada);
  const codigo = await new Promise<number | null>((resolve, reject) => {
    filho.once("error", reject);
    filho.once("close", resolve);
  });
  return {
    codigo,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
  };
}

async function executarFallbackWindows(
  homeTeste: string,
  args: string[],
  entrada: string,
): Promise<{
    codigo: number | null;
    codigoHost: number | null;
    hostContinuou: boolean;
    stdout: string;
    stderr: string;
  }> {
  const powershell = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const fallback = path.join(homeTeste, ".sema", "bin", "sema-managed.ps1");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$utf8 = [System.Text.UTF8Encoding]::new($false, $true)",
    "$wrapper = $utf8.GetString([System.Convert]::FromBase64String($env:SEMA_TEST_WRAPPER_B64))",
    "$argsJson = $utf8.GetString([System.Convert]::FromBase64String($env:SEMA_TEST_ARGS_B64))",
    "$decoded = ConvertFrom-Json -InputObject $argsJson",
    "[string[]]$invokeArgs = @($decoded | ForEach-Object { [string]$_ })",
    "$env:PATH = ''",
    "& $wrapper @invokeArgs",
    "$semaExit = $LASTEXITCODE",
    "[Console]::Error.WriteLine(('SEMA_HOST_CONTINUES:{0}' -f $semaExit))",
    "if ($semaExit -eq 7) { exit 0 }",
    "exit 91",
  ].join("\r\n");
  const filho = spawn(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script,
    ],
    {
      env: {
        ...process.env,
        META: "EXPANDED",
        NODE_OPTIONS: "--input-type=module",
        PATH: "",
        SEMA_TEST_ARGS_B64: Buffer.from(JSON.stringify(args), "utf8").toString("base64"),
        SEMA_TEST_WRAPPER_B64: Buffer.from(fallback, "utf8").toString("base64"),
      },
      windowsHide: true,
    },
  );
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  filho.stdout.on("data", (parte) => stdout.push(Buffer.from(parte)));
  filho.stderr.on("data", (parte) => stderr.push(Buffer.from(parte)));
  filho.stdin.end(entrada);
  const codigoHost = await new Promise<number | null>((resolve, reject) => {
    filho.once("error", reject);
    filho.once("close", resolve);
  });
  const stderrTexto = Buffer.concat(stderr).toString("utf8");
  const marcador = stderrTexto.match(/SEMA_HOST_CONTINUES:(-?[0-9]+)/u);
  return {
    codigo: marcador ? Number(marcador[1]) : null,
    codigoHost,
    hostContinuou: marcador !== null,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: stderrTexto,
  };
}

async function executarFallbackWindowsDedicado(
  homeTeste: string,
  args: string[],
  entrada: string,
): Promise<{ codigo: number | null; stdout: string; stderr: string }> {
  const powershell = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const fallback = path.join(homeTeste, ".sema", "bin", "sema-managed.ps1");
  const filho = spawn(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      fallback,
      ...args,
    ],
    {
      env: {
        ...process.env,
        META: "EXPANDED",
        PATH: "",
      },
      windowsHide: true,
    },
  );
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  filho.stdout.on("data", (parte) => stdout.push(Buffer.from(parte)));
  filho.stderr.on("data", (parte) => stderr.push(Buffer.from(parte)));
  filho.stdin.end(entrada);
  const codigo = await new Promise<number | null>((resolve, reject) => {
    filho.once("error", reject);
    filho.once("close", resolve);
  });
  return {
    codigo,
    stdout: Buffer.concat(stdout).toString("utf8"),
    stderr: Buffer.concat(stderr).toString("utf8"),
  };
}

async function resolverSemaBareWindows(bin: string): Promise<string> {
  const powershell = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const filho = spawn(
    powershell,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$env:PATH = $env:SEMA_TEST_BIN; (Get-Command sema -CommandType Application).Source",
    ],
    {
      env: {
        ...process.env,
        PATH: `${process.env.SystemRoot ?? "C:\\Windows"};${path.join(process.env.SystemRoot ?? "C:\\Windows", "System32")}`,
        SEMA_TEST_BIN: bin,
      },
      windowsHide: true,
    },
  );
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  filho.stdout.on("data", (parte) => stdout.push(Buffer.from(parte)));
  filho.stderr.on("data", (parte) => stderr.push(Buffer.from(parte)));
  const codigo = await new Promise<number | null>((resolve, reject) => {
    filho.once("error", reject);
    filho.once("close", resolve);
  });
  assert.equal(codigo, 0, Buffer.concat(stderr).toString("utf8"));
  return Buffer.concat(stdout).toString("utf8").trim();
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

test("launcher global preserva args, stdin e exit sem depender de PATH", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-launcher-global-"));
  try {
    const home = path.join(base, process.platform === "win32"
      ? "Home José %META% &^!"
      : "Home usuário (A)&B");
    await mkdir(path.join(home, ".sema", "certs"), { recursive: true });
    await writeFile(path.join(home, ".sema", "certs", "keep.pem"), "certificado-intocado", "utf8");
    const raizPacote = await criarPacote(base, "Pacote üni %META% &^!");
    let executavelNode = process.execPath;
    if (process.platform === "win32") {
      const pastaNodeUnicode = path.join(base, "Nóde 日本 %META% &^!");
      await mkdir(pastaNodeUnicode);
      executavelNode = path.join(pastaNodeUnicode, "nóde.exe");
      await copyFile(process.execPath, executavelNode);
    }
    const opcoes = {
      plataforma: process.platform,
      diretorioUsuario: home,
      executavelNode,
      raizPacote,
    } as const;

    const ausente = await statusLauncherGlobal(opcoes);
    assert.equal(ausente.estado, "MISSING");
    assert.equal(ausente.node_absoluto, true);
    assert.equal(ausente.entrypoint_absoluto, true);
    assert.equal(ausente.recibo_valido, false);
    assert.equal(ausente.independente_path, false);
    assert.equal(ausente.destino_simbolico, process.platform === "win32"
      ? "$HOME/.sema/bin/sema.cmd"
      : "$HOME/.sema/bin/sema");
    assert.equal(ausente.fallback_simbolico, process.platform === "win32"
      ? "$HOME/.sema/bin/sema-managed.ps1"
      : null);
    assert.equal(JSON.stringify(ausente).includes(base), false);

    const instalado = await sincronizarLauncherGlobal(opcoes);
    assert.equal(instalado.estado, "READY");
    assert.equal(instalado.alterado, true);
    assert.equal(instalado.node_absoluto, true);
    assert.equal(instalado.entrypoint_absoluto, true);
    assert.equal(instalado.recibo_valido, true);
    assert.equal(instalado.independente_path, true);

    const launcher = path.join(home, ".sema", "bin", process.platform === "win32"
      ? "sema.cmd"
      : "sema");
    const conteudoAntes = await readFile(launcher, "utf8");
    const mtimeAntes = (await stat(launcher)).mtimeMs;
    let wrapperAntes: Buffer | undefined;
    let mtimeWrapperAntes: number | undefined;
    let powerShellAntes: Buffer | undefined;
    let mtimePowerShellAntes: number | undefined;
    assert.match(conteudoAntes, /SEMA-LAUNCHER-RECEIPT sha256:[a-f0-9]{64}/u);
    if (process.platform === "win32") {
      assert.equal(Buffer.from(conteudoAntes, "utf8").every((byte) => byte < 0x80), true);
      const companion = (await readdir(path.dirname(launcher))).find((nome) => nome.endsWith(".ps1"));
      assert.match(companion ?? "", /^\.sema-launcher-[a-f0-9]{64}\.ps1$/u);
      const bytesCompanion = await readFile(path.join(path.dirname(launcher), companion ?? ""));
      assert.deepEqual([...bytesCompanion.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
      assert.match(bytesCompanion.subarray(3).toString("utf8"), /Nóde 日本 %META% &\^!/u);
      const wrapper = path.join(path.dirname(launcher), "sema-managed.ps1");
      wrapperAntes = await readFile(wrapper);
      mtimeWrapperAntes = (await stat(wrapper)).mtimeMs;
      assert.deepEqual([...wrapperAntes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
      assert.match(wrapperAntes.subarray(3).toString("utf8"), /SEMA-MANAGED-LAUNCHER-WRAPPER v1/u);
      const powerShell = path.join(path.dirname(launcher), "sema.ps1");
      powerShellAntes = await readFile(powerShell);
      mtimePowerShellAntes = (await stat(powerShell)).mtimeMs;
      assert.deepEqual(powerShellAntes, wrapperAntes);
      assert.equal(
        path.basename(await resolverSemaBareWindows(path.dirname(launcher))).toLocaleLowerCase("en-US"),
        "sema.cmd",
      );
    }
    assert.equal(await readFile(path.join(home, ".sema", "certs", "keep.pem"), "utf8"), "certificado-intocado");

    const args = [
      "",
      'quote="x"',
      'espaço e "aspas" internas',
      "C:\\caminho com espaço\\",
      "ação %META% &^!",
      "(grupo) | < > ; , @ # $ ` 'simples'",
      "--exit",
      "7",
    ];
    const entrada = "entrada %META% &^! 日本";
    const execucao = process.platform === "win32"
      ? await executarFallbackWindows(home, args, entrada)
      : await executarLauncher(launcher, args, entrada);
    assert.equal(execucao.codigo, 7, JSON.stringify(execucao));
    if (process.platform === "win32") {
      assert.equal(execucao.hostContinuou, true, execucao.stderr);
      assert.equal(execucao.codigoHost, 0, execucao.stderr);
      assert.match(execucao.stderr, /SEMA_HOST_CONTINUES:7/u);
    }
    const payload = JSON.parse(execucao.stdout.trim()) as {
      args: string[];
      stdin: string;
      node_options: string | null;
    };
    assert.deepEqual(payload.args, args);
    assert.equal(payload.stdin, entrada);
    assert.equal(payload.node_options, process.platform === "win32"
      ? "--input-type=module"
      : (process.env.NODE_OPTIONS ?? null));
    if (process.platform === "win32") {
      const primario = await executarPowerShellBare(
        path.dirname(launcher),
        args,
        entrada,
      );
      assert.equal(primario.codigo, 7, JSON.stringify(primario));
      assert.deepEqual(JSON.parse(primario.stdout.trim()), {
        args,
        stdin: entrada,
        node_options: process.env.NODE_OPTIONS ?? null,
      });
      const argsCmd = ["status", "--json", "--exit", "7"];
      const cmd = await executarPowerShellBare(path.dirname(launcher), argsCmd, "stdin cmd", launcher);
      assert.equal(cmd.codigo, 7, JSON.stringify(cmd));
      assert.deepEqual(JSON.parse(cmd.stdout.trim()), {
        args: argsCmd,
        stdin: "stdin cmd",
        node_options: process.env.NODE_OPTIONS ?? null,
      });
      const argsDedicados = ["smoke-dedicado", "--exit", "7"];
      const dedicado = await executarFallbackWindowsDedicado(home, argsDedicados, "stdin dedicado");
      assert.equal(dedicado.codigo, 7, JSON.stringify(dedicado));
      assert.deepEqual(JSON.parse(dedicado.stdout.trim()), {
        args: argsDedicados,
        stdin: "stdin dedicado",
        node_options: process.env.NODE_OPTIONS ?? null,
      });
    }

    const repetido = await sincronizarLauncherGlobal(opcoes);
    assert.equal(repetido.estado, "READY");
    assert.equal(repetido.alterado, false);
    assert.equal(await readFile(launcher, "utf8"), conteudoAntes);
    assert.equal((await stat(launcher)).mtimeMs, mtimeAntes);
    if (wrapperAntes && mtimeWrapperAntes !== undefined) {
      const wrapper = path.join(path.dirname(launcher), "sema-managed.ps1");
      assert.deepEqual(await readFile(wrapper), wrapperAntes);
      assert.equal((await stat(wrapper)).mtimeMs, mtimeWrapperAntes);
    }
    if (powerShellAntes && mtimePowerShellAntes !== undefined) {
      const powerShell = path.join(path.dirname(launcher), "sema.ps1");
      assert.deepEqual(await readFile(powerShell), powerShellAntes);
      assert.equal((await stat(powerShell)).mtimeMs, mtimePowerShellAntes);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("launcher sincroniza downgrade solicitado explicitamente com o runtime instalado", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-launcher-downgrade-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const pacoteNovo = await criarPacote(base, "pacote-3", "3.0.0");
    const pacoteAntigo = await criarPacote(base, "pacote-2", "2.3.6");
    const comum = {
      plataforma: process.platform,
      diretorioUsuario: home,
      executavelNode: process.execPath,
    } as const;
    assert.equal((await sincronizarLauncherGlobal({ ...comum, raizPacote: pacoteNovo })).estado, "READY");
    const bin = path.join(home, ".sema", "bin");

    const status = await statusLauncherGlobal({ ...comum, raizPacote: pacoteAntigo });
    assert.equal(status.estado, "STALE");
    assert.equal(status.codigo, "DESTINO_DESATUALIZADO");
    assert.equal(status.recibo_valido, true);
    const sync = await sincronizarLauncherGlobal({ ...comum, raizPacote: pacoteAntigo });
    assert.equal(sync.estado, "READY");
    assert.equal(sync.codigo, "DESTINO_PRONTO");
    assert.equal(sync.alterado, true);
    assert.equal((await statusLauncherGlobal({ ...comum, raizPacote: pacoteAntigo })).estado, "READY");
    if (process.platform === "win32") {
      const companions = (await readdir(bin)).filter((nome) => (
        /^\.sema-launcher-[a-f0-9]{64}\.ps1$/u.test(nome)
      ));
      assert.equal(companions.length, 1);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("launcher reporta e recupera limpeza pendente sem remover arquivo alheio", async (t) => {
  if (process.platform !== "win32") {
    t.skip("regressão específica do bloqueio de exclusão no Windows");
    return;
  }
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-launcher-limpeza-"));
  let liberar: (() => Promise<void>) | undefined;
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacote(base, "pacote", "2.3.6");
    const opcoes = {
      plataforma: "win32" as const,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    };
    assert.equal((await sincronizarLauncherGlobal(opcoes)).estado, "READY");
    const bin = path.join(home, ".sema", "bin");
    const companionsIniciais = (await readdir(bin)).filter((nome) => (
      /^\.sema-launcher-[a-f0-9]{64}\.ps1$/u.test(nome)
    ));
    assert.equal(companionsIniciais.length, 1);
    const companionAntigo = path.join(bin, companionsIniciais[0] ?? "");
    const nomeFalso = `.sema-launcher-${"0".repeat(64)}.ps1`;
    assert.notEqual(path.basename(companionAntigo), nomeFalso);
    const falso = path.join(bin, nomeFalso);
    await writeFile(falso, "arquivo alheio com nome parecido\n", "utf8");
    liberar = await bloquearExclusaoArquivoWindows(companionAntigo);

    await writeFile(path.join(raizPacote, "package.json"), JSON.stringify({
      name: "@semacode/cli",
      version: "2.3.7",
    }), "utf8");
    const pendente = await sincronizarLauncherGlobal(opcoes);
    assert.equal(pendente.estado, "READY");
    assert.equal(pendente.codigo, "LIMPEZA_PENDENTE");
    assert.equal(pendente.alterado, true);
    assert.equal((await statusLauncherGlobal(opcoes)).codigo, "LIMPEZA_PENDENTE");
    assert.match(await readFile(companionAntigo, "utf8"), /SEMA-MANAGED-LAUNCHER/u);
    assert.equal(await readFile(falso, "utf8"), "arquivo alheio com nome parecido\n");

    await liberar();
    liberar = undefined;
    const recuperado = await sincronizarLauncherGlobal(opcoes);
    assert.equal(recuperado.estado, "READY");
    assert.equal(recuperado.codigo, "DESTINO_PRONTO");
    assert.equal(recuperado.alterado, true);
    await assert.rejects(stat(companionAntigo), { code: "ENOENT" });
    assert.equal(await readFile(falso, "utf8"), "arquivo alheio com nome parecido\n");
  } finally {
    await liberar?.();
    await rm(base, { recursive: true, force: true });
  }
});

test("launcher diferencia stale gerenciado de conteúdo sem recibo e target quebrado", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-launcher-estados-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const pacoteA = await criarPacote(base, "pacote-a");
    const pacoteB = await criarPacote(base, "pacote-b");
    const baseOpcoes = {
      plataforma: process.platform,
      diretorioUsuario: home,
      executavelNode: process.execPath,
    } as const;
    await sincronizarLauncherGlobal({ ...baseOpcoes, raizPacote: pacoteA });
    const launcher = path.join(home, ".sema", "bin", process.platform === "win32"
      ? "sema.cmd"
      : "sema");

    const stale = await statusLauncherGlobal({ ...baseOpcoes, raizPacote: pacoteB });
    assert.equal(stale.estado, "STALE");
    assert.equal(stale.recibo_valido, true);
    assert.equal(stale.node_absoluto, true);
    assert.equal(stale.entrypoint_absoluto, true);
    assert.equal(stale.independente_path, false);
    assert.equal((await sincronizarLauncherGlobal({ ...baseOpcoes, raizPacote: pacoteB })).estado, "READY");

    await writeFile(launcher, "SEMA-MANAGED-LAUNCHER v1\nsem recibo válido\n", "utf8");
    const quebrado = await statusLauncherGlobal({ ...baseOpcoes, raizPacote: pacoteB });
    assert.equal(quebrado.estado, "BROKEN_TARGET");
    assert.equal(quebrado.codigo, "RECIBO_INVALIDO");
    assert.equal(quebrado.recibo_valido, false);
    const naoSobrescrito = await sincronizarLauncherGlobal({ ...baseOpcoes, raizPacote: pacoteB });
    assert.equal(naoSobrescrito.estado, "BROKEN_TARGET");
    assert.equal(await readFile(launcher, "utf8"), "SEMA-MANAGED-LAUNCHER v1\nsem recibo válido\n");

    await rm(path.join(pacoteB, "dist", "index.js"));
    const targetQuebrado = await statusLauncherGlobal({ ...baseOpcoes, raizPacote: pacoteB });
    assert.equal(targetQuebrado.estado, "BROKEN_TARGET");
    assert.equal(targetQuebrado.codigo, "TARGET_CLI_INVALIDO");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("fallback Windows falha fechado quando wrapper está ausente, adulterado ou é reparse point", async (t) => {
  if (process.platform !== "win32") {
    t.skip("regressão específica do fallback PowerShell no Windows");
    return;
  }
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-launcher-wrapper-integridade-"));
  try {
    const home = path.join(base, "home %META% &^!");
    const externo = path.join(base, "wrapper-externo.ps1");
    await mkdir(home);
    await writeFile(externo, "sentinela externa", "utf8");
    const raizPacote = await criarPacote(base, "pacote");
    const opcoes = {
      plataforma: "win32" as const,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    };
    assert.equal((await sincronizarLauncherGlobal(opcoes)).estado, "READY");
    const wrapper = path.join(home, ".sema", "bin", "sema-managed.ps1");

    await rm(wrapper);
    const ausente = await statusLauncherGlobal(opcoes);
    assert.equal(ausente.estado, "STALE");
    assert.equal(ausente.codigo, "DESTINO_DESATUALIZADO");
    assert.equal(ausente.independente_path, false);
    assert.equal((await sincronizarLauncherGlobal(opcoes)).estado, "READY");

    const adulterado = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from("# SEMA-MANAGED-LAUNCHER-WRAPPER v1\r\nWrite-Output 'adulterado'\r\n", "utf8"),
    ]);
    await writeFile(wrapper, adulterado);
    const quebrado = await statusLauncherGlobal(opcoes);
    assert.equal(quebrado.estado, "BROKEN_TARGET");
    assert.equal(quebrado.codigo, "RECIBO_INVALIDO");
    assert.equal(quebrado.independente_path, false);
    assert.equal((await sincronizarLauncherGlobal(opcoes)).alterado, false);
    assert.deepEqual(await readFile(wrapper), adulterado);

    await rm(wrapper);
    try {
      await symlink(externo, wrapper, "file");
    } catch (erro) {
      if (["EPERM", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.diagnostic("ambiente não permite criar symlink de arquivo para o teste de reparse point");
        return;
      }
      throw erro;
    }
    const reparse = await statusLauncherGlobal(opcoes);
    assert.equal(reparse.estado, "BROKEN_TARGET");
    assert.equal(reparse.codigo, "SYMLINK_OU_JUNCTION");
    assert.equal((await sincronizarLauncherGlobal(opcoes)).alterado, false);
    assert.equal(await readFile(externo, "utf8"), "sentinela externa");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("rollback transacional remove cmd, wrapper e companion criados pelo launcher", async (t) => {
  if (process.platform !== "win32") {
    t.skip("regressão específica do conjunto transacional Windows");
    return;
  }
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-launcher-wrapper-rollback-"));
  let liberar: (() => Promise<void>) | undefined;
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacote(base, "pacote");
    const opcoes = {
      plataforma: "win32" as const,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    };
    const snapshot = await capturarSnapshotLauncherGlobalTransacao(opcoes);
    const sincronizado = await sincronizarLauncherGlobalTransacional(snapshot);
    assert.equal(sincronizado.estado, "READY");
    const bin = path.join(home, ".sema", "bin");
    await stat(path.join(bin, "sema.cmd"));
    await stat(path.join(bin, "sema.ps1"));
    await stat(path.join(bin, "sema-managed.ps1"));
    await stat(path.join(bin, "sema-launcher.receipt"));
    assert.equal((await readdir(bin)).filter((nome) => (
      /^\.sema-launcher-[a-f0-9]{64}\.ps1$/u.test(nome)
    )).length, 1);

    liberar = await bloquearExclusaoArquivoWindows(path.join(bin, "sema.ps1"));
    await assert.rejects(restaurarSnapshotLauncherGlobalTransacao(snapshot), /ROLLBACK_FALHOU/u);
    await assert.rejects(stat(path.join(bin, "sema.cmd")), { code: "ENOENT" });
    await assert.rejects(stat(path.join(bin, "sema-managed.ps1")), { code: "ENOENT" });
    await assert.rejects(stat(path.join(bin, "sema-launcher.receipt")), { code: "ENOENT" });
    await stat(path.join(bin, "sema.ps1"));
    await liberar();
    liberar = undefined;
    await restaurarSnapshotLauncherGlobalTransacao(snapshot);
    await assert.rejects(stat(path.join(bin, "sema.cmd")), { code: "ENOENT" });
    await assert.rejects(stat(path.join(bin, "sema.ps1")), { code: "ENOENT" });
    await assert.rejects(stat(path.join(bin, "sema-managed.ps1")), { code: "ENOENT" });
    await assert.rejects(stat(path.join(bin, "sema-launcher.receipt")), { code: "ENOENT" });
    assert.equal((await readdir(bin)).filter((nome) => (
      /^\.sema-launcher-[a-f0-9]{64}\.ps1$/u.test(nome)
    )).length, 0);
    assert.equal((await statusLauncherGlobal(opcoes)).estado, "MISSING");
  } finally {
    await liberar?.();
    await rm(base, { recursive: true, force: true });
  }
});

test("launcher canonicaliza junctions informadas de Node e pacote sem relaxar a home", async (t) => {
  if (process.platform !== "win32") {
    t.skip("regressão específica de junctions do nvm-windows");
    return;
  }
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-launcher-junction-runtime-"));
  try {
    const home = path.join(base, "Home José %META% &^!");
    const nodeReal = path.join(base, "Node real 日本");
    const nodeLink = path.join(base, "Node link");
    const pacoteReal = await criarPacote(base, "Pacote real 日本");
    const pacoteLink = path.join(base, "Pacote link");
    await mkdir(home);
    await mkdir(nodeReal);
    const nodeRealExe = path.join(nodeReal, "node.exe");
    await copyFile(process.execPath, nodeRealExe);
    try {
      await symlink(nodeReal, nodeLink, "junction");
      await symlink(pacoteReal, pacoteLink, "junction");
    } catch (erro) {
      if (["EPERM", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("ambiente não permite criar junctions de teste");
        return;
      }
      throw erro;
    }
    const nodeViaJunction = path.join(nodeLink, "node.exe");
    const resultado = await sincronizarLauncherGlobal({
      plataforma: "win32",
      diretorioUsuario: home,
      executavelNode: nodeViaJunction,
      raizPacote: pacoteLink,
    });
    assert.equal(resultado.estado, "READY");
    const bin = path.join(home, ".sema", "bin");
    const nomeCompanion = (await readdir(bin)).find((nome) => (
      /^\.sema-launcher-[a-f0-9]{64}\.ps1$/u.test(nome)
    ));
    const companion = (await readFile(path.join(bin, nomeCompanion ?? ""))).subarray(3).toString("utf8");
    const nodeCanonico = await realpath(nodeViaJunction);
    const pacoteCanonico = await realpath(pacoteLink);
    assert.equal(companion.includes(nodeCanonico), true);
    assert.equal(companion.includes(path.join(pacoteCanonico, "dist", "index.js")), true);
    assert.equal(companion.includes(nodeViaJunction), false);
    assert.equal(companion.includes(path.join(pacoteLink, "dist", "index.js")), false);

    const args = ["via junction %META% &^!", "--exit", "7"];
    const execucao = await executarFallbackWindows(home, args, "stdin junction");
    assert.equal(execucao.codigo, 7, JSON.stringify(execucao));
    assert.equal(execucao.hostContinuou, true, execucao.stderr);
    assert.equal(execucao.codigoHost, 0, execucao.stderr);
    const payload = JSON.parse(execucao.stdout.trim()) as {
      args: string[];
      stdin: string;
      node_options: string | null;
    };
    assert.deepEqual(payload, {
      args,
      stdin: "stdin junction",
      node_options: "--input-type=module",
    });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("launcher rejeita junction ou symlink na cadeia e não atravessa para fora", async (t) => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-launcher-link-"));
  try {
    const home = path.join(base, "home");
    const externo = path.join(base, "externo");
    await mkdir(home);
    await mkdir(externo);
    await writeFile(path.join(externo, "sentinela.txt"), "intacta", "utf8");
    const raizPacote = await criarPacote(base, "pacote");
    try {
      await symlink(externo, path.join(home, ".sema"), process.platform === "win32" ? "junction" : "dir");
    } catch (erro) {
      if (["EPERM", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) {
        t.skip("ambiente não permite criar link de teste");
        return;
      }
      throw erro;
    }
    const opcoes = {
      plataforma: process.platform,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    } as const;
    const status = await statusLauncherGlobal(opcoes);
    assert.equal(status.estado, "BROKEN_TARGET");
    assert.equal(status.codigo, "SYMLINK_OU_JUNCTION");
    assert.equal((await sincronizarLauncherGlobal(opcoes)).alterado, false);
    assert.equal(await readFile(path.join(externo, "sentinela.txt"), "utf8"), "intacta");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("launcher Windows valida os mesmos bytes do companion antes de executar", async (t) => {
  if (process.platform !== "win32") {
    t.skip("cadeia .cmd/PowerShell específica do Windows");
    return;
  }
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-launcher-runtime-integrity-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacote(base, "pacote");
    const opcoes = {
      plataforma: "win32" as const,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    };
    assert.equal((await sincronizarLauncherGlobal(opcoes)).estado, "READY");
    const bin = path.join(home, ".sema", "bin");
    const launcher = path.join(bin, "sema.cmd");
    const companion = (await readdir(bin)).find((nome) => (
      /^\.sema-launcher-[a-f0-9]{64}\.ps1$/u.test(nome)
    ));
    assert.ok(companion);
    const companionPath = path.join(bin, companion);
    const companionOriginal = await readFile(companionPath);

    const valido = await executarLauncher(launcher, ["runtime-ok", "--exit", "7"], "stdin-ok");
    assert.equal(valido.codigo, 7, JSON.stringify(valido));
    assert.deepEqual(JSON.parse(valido.stdout.trim()), {
      args: ["runtime-ok", "--exit", "7"],
      stdin: "stdin-ok",
      node_options: process.env.NODE_OPTIONS ?? null,
    });

    await writeFile(
      companionPath,
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from("Write-Output 'COMPANION_TAMPER_EXECUTED'; exit 0\r\n", "utf8"),
      ]),
    );
    const adulterado = await executarLauncher(launcher, [], "");
    assert.notEqual(adulterado.codigo, 0, JSON.stringify(adulterado));
    assert.doesNotMatch(`${adulterado.stdout}\n${adulterado.stderr}`, /COMPANION_TAMPER_EXECUTED/u);
    assert.match(adulterado.stderr, /integrity check failed/u);

    await writeFile(companionPath, companionOriginal);
    const primario = path.join(bin, "sema.ps1");
    const fallback = path.join(bin, "sema-managed.ps1");
    const original = await readFile(primario);
    const payload = Buffer.from("\r\nWrite-Output 'WRAPPER_TAMPER_EXECUTED'; exit 0\r\n", "utf8");
    await writeFile(primario, Buffer.concat([original, payload]));
    for (const execucao of [
      await executarPowerShellBare(bin, [], ""),
      await executarLauncher(launcher, [], ""),
    ]) {
      assert.notEqual(execucao.codigo, 0, JSON.stringify(execucao));
      assert.doesNotMatch(`${execucao.stdout}\n${execucao.stderr}`, /WRAPPER_TAMPER_EXECUTED/u);
      assert.match(execucao.stderr, /integrity check failed/u);
    }
    await writeFile(primario, original);
    await writeFile(fallback, Buffer.concat([original, payload]));
    const fallbackAdulterado = await executarFallbackWindowsDedicado(home, [], "");
    assert.notEqual(fallbackAdulterado.codigo, 0, JSON.stringify(fallbackAdulterado));
    assert.doesNotMatch(
      `${fallbackAdulterado.stdout}\n${fallbackAdulterado.stderr}`,
      /WRAPPER_TAMPER_EXECUTED/u,
    );
    assert.match(fallbackAdulterado.stderr, /integrity check failed/u);
    await writeFile(fallback, original);
    const externo = path.join(base, "wrapper-exato.ps1");
    await writeFile(externo, original);
    await rm(primario);
    try {
      await symlink(externo, primario, "file");
      for (const execucao of [
        await executarPowerShellBare(bin, [], ""),
        await executarLauncher(launcher, [], ""),
      ]) {
        assert.notEqual(execucao.codigo, 0, JSON.stringify(execucao));
        assert.match(execucao.stderr, /integrity check failed/u);
      }
    } catch (erro) {
      if (!["EPERM", "EACCES"].includes((erro as NodeJS.ErrnoException).code ?? "")) throw erro;
      t.diagnostic("ambiente não permite reparse point do wrapper em runtime");
      await writeFile(primario, original);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("launcher POSIX exige Node executável e repara permissão do artefato gerenciado", async (t) => {
  if (process.platform === "win32") {
    t.skip("permissões X_OK são específicas de POSIX");
    return;
  }
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-launcher-x-ok-"));
  try {
    const home = path.join(base, "home");
    await mkdir(home);
    const raizPacote = await criarPacote(base, "pacote");
    const opcoes = {
      plataforma: process.platform,
      diretorioUsuario: home,
      executavelNode: process.execPath,
      raizPacote,
    } as const;
    assert.equal((await sincronizarLauncherGlobal(opcoes)).estado, "READY");
    const launcher = path.join(home, ".sema", "bin", "sema");
    await chmod(launcher, 0o600);
    const semExecucao = await statusLauncherGlobal(opcoes);
    assert.equal(semExecucao.estado, "STALE");
    assert.equal(semExecucao.codigo, "PERMISSAO_EXECUCAO_INVALIDA");
    assert.equal((await sincronizarLauncherGlobal(opcoes)).estado, "READY");
    await access(launcher, constants.X_OK);

    const nodeSemExecucao = path.join(base, "node-sem-x");
    await copyFile(process.execPath, nodeSemExecucao);
    await chmod(nodeSemExecucao, 0o600);
    const nodeInvalido = await statusLauncherGlobal({ ...opcoes, executavelNode: nodeSemExecucao });
    assert.notEqual(nodeInvalido.estado, "READY");
    assert.equal(nodeInvalido.independente_path, false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
