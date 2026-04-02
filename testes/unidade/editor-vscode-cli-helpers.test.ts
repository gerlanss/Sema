import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  executarCandidato,
  obterCandidatosCli,
} = require(path.resolve("pacotes/editor-vscode/cli-helpers.js"));

test("editor-vscode cli helpers trata sema.cliPath como autoridade total", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-editor-cli-config-"));

  try {
    await mkdir(path.join(baseTemporaria, "node_modules", ".bin"), { recursive: true });
    await mkdir(path.join(baseTemporaria, "pacotes", "cli", "dist"), { recursive: true });
    await writeFile(path.join(baseTemporaria, "node_modules", ".bin", process.platform === "win32" ? "sema.cmd" : "sema"), "", "utf8");
    await writeFile(path.join(baseTemporaria, "pacotes", "cli", "dist", "index.js"), "", "utf8");

    const candidatos = obterCandidatosCli({
      cliConfigurada: "C:\\Users\\gerlanss\\AppData\\Roaming\\npm\\sema.cmd",
      workspaceRoot: baseTemporaria,
      shellResolvedPath: "C:\\Outro\\sema.cmd",
      globalPrefix: "C:\\Users\\gerlanss\\AppData\\Roaming\\npm",
      appData: "C:\\Users\\gerlanss\\AppData\\Roaming",
      platform: "win32",
    });

    assert.equal(candidatos.length, 1);
    assert.equal(candidatos[0].origem, "configuracao sema.cliPath");
    assert.equal(candidatos[0].comando, "C:\\Users\\gerlanss\\AppData\\Roaming\\npm\\sema.cmd");
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("editor-vscode cli helpers preferem instalacao do usuario antes do bin local do projeto", async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-editor-cli-order-"));
  const appData = path.join(baseTemporaria, "appdata");
  const globalPrefix = path.join(baseTemporaria, "global-prefix");

  try {
    await mkdir(path.join(appData, "npm"), { recursive: true });
    await mkdir(path.join(globalPrefix), { recursive: true });
    await mkdir(path.join(baseTemporaria, "node_modules", ".bin"), { recursive: true });

    await writeFile(path.join(appData, "npm", "sema.cmd"), "", "utf8");
    await writeFile(path.join(globalPrefix, "sema.cmd"), "", "utf8");
    await writeFile(path.join(baseTemporaria, "node_modules", ".bin", "sema.cmd"), "", "utf8");

    const candidatos = obterCandidatosCli({
      workspaceRoot: baseTemporaria,
      shellResolvedPath: path.join(appData, "npm", "sema.cmd"),
      globalPrefix,
      appData,
      platform: "win32",
    });

    assert.deepEqual(
      candidatos.map((item: { origem: string }) => item.origem),
      [
        "bin global ou shell atual",
        "resolvido do shell",
        "prefixo global do npm",
        "AppData do usuario no Windows",
        "bin local do projeto",
      ],
    );
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});

test("editor-vscode cli helpers executam wrapper .cmd configurado no Windows", { skip: process.platform !== "win32" }, async () => {
  const baseTemporaria = await mkdtemp(path.join(os.tmpdir(), "sema-editor-cli-cmd-"));
  const script = path.join(baseTemporaria, "sema.cmd");

  try {
    await writeFile(
      script,
      "@echo off\r\nif \"%1\"==\"--help\" echo Sema fake help\r\nexit /b 0\r\n",
      "utf8",
    );

    const resultado = await executarCandidato(
      {
        comando: script,
        argumentosBase: [],
        origem: "configuracao sema.cliPath",
      },
      ["--help"],
      { cwd: baseTemporaria },
    );

    assert.match(String(resultado.stdout), /Sema fake help/);
  } finally {
    await rm(baseTemporaria, { recursive: true, force: true });
  }
});
