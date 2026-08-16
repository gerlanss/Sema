// SEMA-GOVERNED: sema.produto.fronteira_repositorios.empacotamento, sema.produto.fronteira_repositorios.empacotamento.postinstall, sema.produto.fronteira_repositorios.empacotamento.smoke
// Descrição: prova o envelope público, a inércia local do postinstall e a transação de staging da CLI.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { executarPostinstall } from "../../pacotes/cli/scripts/postinstall.mjs";
import { gerarArtefatosLauncherWindows } from "../../pacotes/cli/src/distribuicao/launcherWindows.js";
import {
  executarFallbackPowerShellAbsoluto as executarFallbackInstalador,
  executarLauncherAbsoluto as executarLauncherInstalador,
} from "../../scripts/instalar-cli-local.mjs";
import {
  executarFallbackPowerShellAbsoluto as executarFallbackSmoke,
  executarLauncherAbsoluto as executarLauncherSmoke,
} from "../../scripts/testar-pacote-cli-publico.mjs";

test("postinstall local retorna no-op completo sem importar nem sincronizar", async () => {
  let importacoes = 0;
  const resultado = await executarPostinstall({
    ambiente: {},
    importar: async () => {
      importacoes += 1;
      throw new Error("a instalacao local nao pode importar a distribuicao");
    },
  });

  assert.equal(importacoes, 0);
  assert.deepEqual(resultado, {
    estado: "no_op",
    motivo: "install_scope_local",
    instalacao_local_no_op: true,
    distribuicao_pronta: false,
    alterado: false,
  });
});

test("postinstall normaliza falhas de import e sync sem expor caminho absoluto", async () => {
  const segredo = "C:\\Users\\Alice\\AppData\\Local\\Sema\\segredo.json";
  const ambiente = {
    npm_config_global: "true",
    ...(process.platform === "win32"
      ? { USERPROFILE: path.dirname(segredo) }
      : { HOME: path.resolve("home-isolada-postinstall") }),
  };
  const casos = [
    {
      codigo: "FALHA_CARREGAR_DISTRIBUICAO",
      importar: async () => { throw new Error(`Cannot import ${segredo}`); },
    },
    {
      codigo: "FALHA_SINCRONIZAR_DISTRIBUICAO",
      importar: async () => ({
        sincronizarDistribuicaoGlobal: async () => { throw new Error(`Cannot write ${segredo}`); },
      }),
    },
  ];

  for (const caso of casos) {
    await assert.rejects(
      executarPostinstall({ ambiente, plataforma: process.platform, importar: caso.importar }),
      (erro: unknown) => {
        assert.ok(erro instanceof Error);
        assert.match(erro.message, new RegExp(`^${caso.codigo}:`, "u"));
        assert.equal(erro.message.includes(segredo), false);
        return true;
      },
    );
  }
});

test("runner direto do postinstall não imprime causa ou caminho bruto", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-postinstall-redacao-"));
  const segredo = "C:\\Users\\Alice\\AppData\\Local\\Sema\\segredo.json";
  try {
    const script = path.join(base, "scripts", "postinstall.mjs");
    await mkdir(path.dirname(script), { recursive: true });
    await copyFile(path.resolve("pacotes/cli/scripts/postinstall.mjs"), script);
    const resultado = spawnSync(process.execPath, [script], {
      cwd: base,
      env: {
        ...process.env,
        npm_config_global: "true",
        NPM_CONFIG_GLOBAL: "true",
        ...(process.platform === "win32"
          ? { USERPROFILE: path.dirname(segredo) }
          : { HOME: path.join(base, "home") }),
      },
      encoding: "utf8",
    });
    const saida = `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`;
    assert.equal(resultado.status, 1);
    assert.match(saida, /FALHA_CARREGAR_DISTRIBUICAO:/u);
    assert.equal(saida.includes(segredo), false);
    assert.equal(saida.includes(base), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("postinstall global reduz o agregado READY a envelope estavel sem caminhos", async () => {
  const raizPacote = path.resolve("pacote-global-com-espacos");
  const diretorioUsuario = path.resolve("usuario-global-com-espacos");
  let sincronizacoes = 0;

  const resultado = await executarPostinstall({
    ambiente: {
      npm_config_global: "true",
      ...(process.platform === "win32"
        ? { USERPROFILE: diretorioUsuario }
        : { HOME: diretorioUsuario }),
    },
    plataforma: process.platform,
    executavelNode: process.execPath,
    raizPacote,
    importar: async () => ({
      sincronizarDistribuicaoGlobal: async (opcoes: Record<string, unknown>) => {
        sincronizacoes += 1;
        assert.equal(opcoes.diretorioUsuario, diretorioUsuario);
        assert.equal(opcoes.raizPacote, raizPacote);
        return {
          estado: "READY",
          alterado: true,
          launcher: { estado: "READY", destino_simbolico: "$HOME/.sema/bin/sema" },
          skill: { estado: "READY", origem_simbolica: "$PACKAGE_ROOT/skills/sema" },
        };
      },
    }),
  });

  assert.equal(sincronizacoes, 1);
  assert.deepEqual(resultado, {
    estado: "READY",
    motivo: "distribution_ready",
    instalacao_local_no_op: false,
    distribuicao_pronta: true,
    alterado: true,
  });
  assert.equal(JSON.stringify(resultado).includes(raizPacote), false);
  assert.equal(JSON.stringify(resultado).includes(diretorioUsuario), false);
});

test("invocadores Windows preservam HOME %META%, metacaracteres, stdin e exit sem PATH", {
  skip: process.platform !== "win32",
}, async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-cmd-quote-"));
  try {
    const home = path.join(base, "日本 A%META%B 100%! & caret^");
    const launcher = path.join(home, ".sema", "bin", "sema.cmd");
    await mkdir(path.dirname(launcher), { recursive: true });
    const probe = path.join(path.dirname(launcher), "probe.mjs");
    await writeFile(probe, [
      "const partes = [];",
      "for await (const parte of process.stdin) partes.push(Buffer.from(parte));",
      "const args = process.argv.slice(2);",
      "process.stdout.write(`${JSON.stringify({ args, stdin_base64: Buffer.concat(partes).toString('base64') })}\\n`);",
      "process.exitCode = args.includes('exit23') ? 23 : 0;",
      "",
    ].join("\n"), "utf8");
    const artefatos = gerarArtefatosLauncherWindows(process.execPath, probe, "2.3.6");
    await writeFile(launcher, artefatos.launcher, "utf8");
    await writeFile(path.join(path.dirname(launcher), artefatos.nomeCompanion), artefatos.companion);
    await writeFile(path.join(path.dirname(launcher), "sema.ps1"), artefatos.wrapper);
    const launcherPowerShell = path.join(path.dirname(launcher), "sema-managed.ps1");
    await writeFile(launcherPowerShell, artefatos.wrapper);
    await writeFile(path.join(path.dirname(launcher), "sema-launcher.receipt"), artefatos.anchor);
    const ambiente = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      META: "EXPANDIDO",
      PATH: "",
      Path: "",
    };

    const argumentos = [
      "--version",
      "literal=%META%",
      "percent=100%",
      "bang=!",
      "amp=&",
      "caret=^",
      "pipe=|",
      "lt=<",
      "gt=>",
      "paren=()",
      "igual=a=b",
      "espaço 日本",
    ];
    const entrada = Buffer.from("stdin %META% !&^\0日本\n", "utf8");
    const esperado = { args: argumentos, stdin_base64: entrada.toString("base64") };
    const smoke = JSON.parse(executarLauncherSmoke(launcher, argumentos, base, ambiente, entrada));
    assert.deepEqual(smoke, esperado);
    const instalador = JSON.parse(executarLauncherInstalador(launcher, argumentos, {
      env: ambiente,
      input: entrada,
      stdio: "pipe",
    }));
    assert.deepEqual(instalador, esperado);
    assert.throws(
      () => executarLauncherSmoke(launcher, [...argumentos, "exit23"], base, ambiente, entrada),
      /exit code 23/u,
    );
    assert.throws(
      () => executarLauncherInstalador(launcher, [...argumentos, "exit23"], {
        env: ambiente,
        input: entrada,
        stdio: "pipe",
      }),
      /exit code 23/u,
    );

    const fallbackSmoke = JSON.parse(executarFallbackSmoke(
      launcherPowerShell,
      argumentos,
      base,
      ambiente,
      entrada,
    ));
    assert.deepEqual(fallbackSmoke, esperado);
    const fallbackInstalador = JSON.parse(executarFallbackInstalador(
      launcherPowerShell,
      argumentos,
      { cwd: base, env: ambiente, input: entrada, stdio: "pipe" },
    ));
    assert.deepEqual(fallbackInstalador, esperado);
    assert.throws(
      () => executarFallbackSmoke(launcherPowerShell, [...argumentos, "exit23"], base, ambiente, entrada),
      /exit code 23/u,
    );
    assert.throws(
      () => executarFallbackInstalador(launcherPowerShell, [...argumentos, "exit23"], {
        cwd: base,
        env: ambiente,
        input: entrada,
        stdio: "pipe",
      }),
      /exit code 23/u,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("install-sema.ps1 mantém sema.cmd no PATH e fuma pelo fallback gerenciado", async () => {
  const instalador = await readFile(path.resolve("install-sema.ps1"), "utf8");
  assert.match(instalador, /Join-Path \$launcherDir "sema\.cmd"/u);
  assert.match(instalador, /Join-Path \$launcherDir "sema-managed\.ps1"/u);
  assert.match(instalador, /Join-Path \$env:SystemRoot "System32\\WindowsPowerShell\\v1\.0\\powershell\.exe"/u);
  assert.match(instalador, /Invoke-ManagedSema \$windowsPowerShell \$launcherPowerShell @\("--version"\)/u);
  assert.match(instalador, /Invoke-ManagedSema \$windowsPowerShell \$launcherPowerShell @\("skill", "status", "--json"\)/u);
  assert.doesNotMatch(instalador, /& \$launcher\s/u);
});
