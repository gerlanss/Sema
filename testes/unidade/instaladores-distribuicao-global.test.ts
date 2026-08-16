// SEMA-GOVERNED: sema.produto.distribuicao_global.instaladores, sema.produto.fronteira_repositorios.empacotamento.postinstall, sema.produto.fronteira_repositorios.empacotamento.smoke
// Descrição: sentinelas focais dos installers, da home canônica e do pacote público distribuído.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  executarPostinstall,
  resolverDiretorioUsuario,
} from "../../pacotes/cli/scripts/postinstall.mjs";
import {
  executarLauncherAbsoluto as executarLauncherInstalador,
  exigirTarballLocalDisponivel,
  validarAmbienteDiretorioUsuario,
  validarStatusDistribuicaoPronta as validarStatusInstalador,
  validarVersaoExata,
} from "../../scripts/instalar-cli-local.mjs";
import {
  validarArtefatosDistribuicaoContraFonte,
  validarBytesArtefatoDistribuicao,
} from "../../scripts/cli-publico/fronteira-publica.mjs";
import {
  caminhosCachePluginIsolado,
  executarLauncherAbsoluto as executarLauncherSmoke,
  fingerprintCaminhos,
  payloadContemCaminhoSensivel,
  validarStatusDistribuicaoPronta as validarStatusSmoke,
} from "../../scripts/cli-publico/distribuicao-global.mjs";
import {
  extrairPayloadCliCompativelComVersao,
  validarEnvelopeControleCliV1,
  validarEnvelopeResultadoCliV1,
} from "../../scripts/cli-publico/resultado-cli.mjs";
import { gerarArtefatosLauncherWindows } from "../../pacotes/cli/src/distribuicao/launcherWindows.js";

const raiz = process.cwd();

function payloadReady() {
  return {
    sucesso: true,
    operacao: "status",
    resultado: {
      estado: "READY",
      alterado: false,
      launcher: { estado: "READY" },
      skill: { estado: "READY" },
    },
  };
}

function envelopeResultadoReady(payload = payloadReady()) {
  return {
    schemaVersion: "sema.cli.result/v1",
    ok: true,
    kind: "SUCCESS",
    command: "skill",
    code: "CLI_SUCCESS",
    message: null,
    exitCode: 0,
    payload,
  };
}

test("postinstall rejeita HOME relativo antes de carregar a distribuição", async () => {
  let importacoes = 0;
  await assert.rejects(
    executarPostinstall({
      ambiente: { npm_config_global: "true", HOME: "." },
      plataforma: "linux",
      importar: async () => {
        importacoes += 1;
        return {};
      },
    }),
    /DIRETORIO_USUARIO_INVALIDO/u,
  );
  assert.equal(importacoes, 0);
});

test("postinstall rejeita USERPROFILE e HOMEDRIVE/HOMEPATH relativos", async () => {
  for (const ambiente of [
    { npm_config_global: "true", USERPROFILE: "." },
    { npm_config_global: "true", USERPROFILE: " ", HOMEDRIVE: "C:", HOMEPATH: "relativo" },
  ]) {
    let importacoes = 0;
    await assert.rejects(
      executarPostinstall({
        ambiente,
        plataforma: "win32",
        importar: async () => {
          importacoes += 1;
          return {};
        },
      }),
      /DIRETORIO_USUARIO_INVALIDO/u,
    );
    assert.equal(importacoes, 0);
  }
});

test("HOME vazio ou whitespace usa somente fallback absoluto", () => {
  const linux = resolverDiretorioUsuario({ HOME: "   " }, "linux");
  const windows = resolverDiretorioUsuario({
    USERPROFILE: " ",
    HOMEDRIVE: " ",
    HOMEPATH: " ",
  }, "win32");
  assert.equal(path.isAbsolute(linux), true);
  assert.equal(path.isAbsolute(windows), true);
});

test("postinstall rejeita raiz de pacote relativa antes de importar", async () => {
  let importacoes = 0;
  await assert.rejects(
    executarPostinstall({
      ambiente: { npm_config_global: "true", HOME: os.tmpdir() },
      plataforma: process.platform,
      raizPacote: ".",
      importar: async () => {
        importacoes += 1;
        return {};
      },
    }),
    /RAIZ_PACOTE_INVALIDA/u,
  );
  assert.equal(importacoes, 0);
});

test("instalador local aceita apenas SemVer exata e exige READY completo", () => {
  for (const versao of ["0.0.0", "2.3.6", "1.2.3-alpha.1", "1.2.3+build.9"]) {
    assert.equal(validarVersaoExata(versao), versao);
  }
  for (const invalida of ["latest", "v2.3.6", "2.3", "01.2.3", "1.2.3-01", "beta", "file:../cli"]) {
    assert.throws(() => validarVersaoExata(invalida), /SemVer exata/u);
  }
  assert.throws(
    () => validarAmbienteDiretorioUsuario({ HOME: ".", USERPROFILE: " " }),
    /HOME deve ser um caminho absoluto/u,
  );
  assert.throws(
    () => validarAmbienteDiretorioUsuario({ HOME: " ", USERPROFILE: "." }),
    /USERPROFILE deve ser um caminho absoluto/u,
  );

  assert.equal(validarStatusInstalador(payloadReady()), true);
  assert.equal(validarStatusSmoke(payloadReady()), true);
  for (const mutacao of [
    { resultado: { estado: "STALE" } },
    { resultado: { launcher: { estado: "STALE" } } },
    { resultado: { skill: { estado: "STALE" } } },
    { resultado: { alterado: true } },
  ]) {
    const payload = {
      ...payloadReady(),
      resultado: { ...payloadReady().resultado, ...mutacao.resultado },
    };
    assert.equal(validarStatusInstalador(payload), false);
    assert.equal(validarStatusSmoke(payload), false);
  }
});

test("normalizador de instalador separa legado 2.x de result/v1 3.x", () => {
  const legado = payloadReady();
  const resultado = envelopeResultadoReady(legado);
  assert.deepEqual(
    extrairPayloadCliCompativelComVersao(legado, { versaoCli: "2.4.0" }),
    legado,
  );
  assert.deepEqual(
    extrairPayloadCliCompativelComVersao(resultado, {
      versaoCli: "3.0.0",
      command: "skill",
      kind: "SUCCESS",
      exitCode: 0,
    }),
    legado,
  );
  assert.throws(
    () => extrairPayloadCliCompativelComVersao(resultado, { versaoCli: "2.4.0" }),
    /payload legado/u,
  );
  assert.throws(
    () => extrairPayloadCliCompativelComVersao(legado, { versaoCli: "3.0.0" }),
    /oito campos/u,
  );
  assert.throws(
    () => extrairPayloadCliCompativelComVersao(
      { ...resultado, payload: resultado },
      { versaoCli: "3.0.0" },
    ),
    /outro envelope/u,
  );
  assert.throws(
    () => extrairPayloadCliCompativelComVersao(
      { ...resultado, command: "resumo" },
      {
        versaoCli: "3.0.0",
        command: "skill",
        kind: "SUCCESS",
        exitCode: 0,
      },
    ),
    /command diverge de skill/u,
  );
});

test("mensagens públicas rejeitam eco de argv e segredo sem bloquear textos estáveis", () => {
  for (const mensagemHostil of [
    "Invalid argument --token demo-secret from argv",
    "Authorization failed: Bearer credencial-super-secreta",
    "token=demo-secret",
    "secret=demo-secret",
  ]) {
    let erroCapturado: unknown;
    assert.throws(
      () => validarEnvelopeResultadoCliV1({
        schemaVersion: "sema.cli.result/v1",
        ok: false,
        kind: "DOMAIN_ERROR",
        command: "validar",
        code: "CLI_DOMAIN_ERROR",
        message: mensagemHostil,
        exitCode: 1,
        payload: null,
      }),
      (erro) => {
        erroCapturado = erro;
        return /mensagem pública segura/u.test(String(erro));
      },
    );
    assert.equal(String(erroCapturado).includes(mensagemHostil), false);
    assert.doesNotMatch(String(erroCapturado), /credencial-super-secreta|demo-secret|--token/u);
  }

  assert.doesNotThrow(() => validarEnvelopeResultadoCliV1({
    schemaVersion: "sema.cli.result/v1",
    ok: false,
    kind: "DOMAIN_ERROR",
    command: "validar",
    code: "CLI_DOMAIN_ERROR",
    message: "O comando Sema não foi concluído.",
    exitCode: 1,
    payload: null,
  }));
  for (const [kind, code, message] of [
    ["ARGUMENT_ERROR", "CLI_ARGUMENT_ERROR", "Argumentos inválidos. Consulte a ajuda do comando."],
    ["FATAL_ERROR", "CLI_FATAL_ERROR", "Falha ao executar a CLI da Sema."],
  ] as const) {
    assert.doesNotThrow(() => validarEnvelopeControleCliV1({
      schemaVersion: "sema.cli.control/v1",
      ok: false,
      kind,
      code,
      message,
      exitCode: 1,
    }));
  }
  assert.doesNotThrow(() => validarEnvelopeControleCliV1({
    schemaVersion: "sema.cli.control/v1",
    ok: true,
    kind: "HELP",
    code: "CLI_HELP",
    message: "Uso: sema validar <arquivo.sema> --json",
    exitCode: 0,
  }));
});

test("falha de tarball local ausente usa mensagem fixa sem caminho nem erro interno", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-tarball-ausente-"));
  const ausente = path.join(base, "arquivo-privado-nao-existe.tgz");
  try {
    await assert.rejects(
      exigirTarballLocalDisponivel(ausente),
      (erro: unknown) => {
        assert.ok(erro instanceof Error);
        assert.equal(erro.message, "O tarball público local da Sema não está disponível.");
        assert.doesNotMatch(erro.message, /ENOENT|arquivo-privado|sema-tarball-ausente/u);
        assert.equal(erro.message.includes(base), false);
        return true;
      },
    );
    await mkdir(path.join(base, "pacotes", "cli"), { recursive: true });
    await Promise.all([
      writeFile(path.join(base, "package.json"), JSON.stringify({ version: "3.0.0" }), "utf8"),
      writeFile(path.join(base, "pacotes", "cli", "package.json"), JSON.stringify({
        name: "@semacode/cli",
        version: "3.0.0",
      }), "utf8"),
    ]);
    const resultado = spawnSync(process.execPath, [
      path.join(raiz, "scripts", "instalar-cli-local.mjs"),
    ], {
      cwd: base,
      env: { ...process.env, HOME: base, USERPROFILE: base },
      encoding: "utf8",
    });
    const saida = `${resultado.stdout}\n${resultado.stderr}`;
    assert.equal(resultado.status, 1);
    assert.match(saida, /O tarball público local da Sema não está disponível\./u);
    assert.doesNotMatch(saida, /ENOENT|semacode-cli-3\.0\.0\.tgz/u);
    assert.equal(saida.includes(base), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("parsers embarcados dos instaladores exigem a família da versão instalada", async (t) => {
  const legado = JSON.stringify(payloadReady());
  const resultado = JSON.stringify(envelopeResultadoReady());
  const resultadoComCampoExtra = JSON.stringify({ ...envelopeResultadoReady(), extra: true });
  const resultadoDuplo = JSON.stringify({
    ...envelopeResultadoReady(),
    payload: envelopeResultadoReady(),
  });

  const shell = await readFile(path.join(raiz, "install-sema.sh"), "utf8");
  const shellNormalizado = shell.replaceAll("\r\n", "\n");
  const inicioFuncao = shellNormalizado.indexOf("status_pronto() {");
  const fimFuncao = shellNormalizado.indexOf("\n}\n\nextrair_versao_json()", inicioFuncao);
  assert.ok(inicioFuncao >= 0 && fimFuncao > inicioFuncao);
  const funcaoStatus = shellNormalizado.slice(inicioFuncao, fimFuncao + 2);
  const executarShell = (json: string, versao: string) => spawnSync(
    "bash",
    ["-c", `${funcaoStatus}\nstatus_pronto`],
    {
      cwd: raiz,
      env: { ...process.env, SEMA_INSTALLED_VERSION: versao },
      input: json,
      encoding: "utf8",
    },
  );
  const bashDisponivel = spawnSync("bash", ["-c", "command -v node >/dev/null 2>&1"], {
    cwd: raiz,
    encoding: "utf8",
  });
  if ((bashDisponivel.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT"
      || bashDisponivel.status !== 0) {
    t.diagnostic("bash com Node.js indisponível; validação PowerShell segue ativa no Windows");
  } else {
    const probeBash = executarShell(legado, "2.4.0");
    assert.equal(probeBash.status, 0, probeBash.stderr);
    assert.equal(executarShell(resultado, "3.0.0").status, 0);
    assert.notEqual(executarShell(resultado, "2.4.0").status, 0);
    assert.notEqual(executarShell(legado, "3.0.0").status, 0);
    assert.notEqual(executarShell(resultadoComCampoExtra, "3.0.0").status, 0);
    assert.notEqual(executarShell(resultadoDuplo, "3.0.0").status, 0);
  }

  if (process.platform !== "win32") return;
  const powershell = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const caminhoScript = path.join(raiz, "install-sema.ps1").replaceAll("'", "''");
  const comando = [
    `. '${caminhoScript}'`,
    "$pronto = Test-DistributionReady -Json $env:SEMA_TEST_JSON -InstalledVersion $env:SEMA_TEST_VERSION",
    "if ($pronto) { exit 0 } else { exit 1 }",
  ].join("\r\n");
  const executarPowerShell = (json: string, versao: string) => spawnSync(
    powershell,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", comando],
    {
      cwd: raiz,
      env: { ...process.env, SEMA_TEST_JSON: json, SEMA_TEST_VERSION: versao },
      encoding: "utf8",
    },
  );
  assert.equal(executarPowerShell(legado, "2.4.0").status, 0);
  assert.equal(executarPowerShell(resultado, "3.0.0").status, 0);
  assert.notEqual(executarPowerShell(resultado, "2.4.0").status, 0);
  assert.notEqual(executarPowerShell(legado, "3.0.0").status, 0);
  assert.notEqual(executarPowerShell(resultadoComCampoExtra, "3.0.0").status, 0);
  assert.notEqual(executarPowerShell(resultadoDuplo, "3.0.0").status, 0);
});

test("fingerprint detecta qualquer cache de plugin na home isolada", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-plugin-cache-"));
  try {
    const home = path.join(base, "home");
    const codexHome = path.join(home, ".codex");
    await mkdir(home, { recursive: true });
    const caminhos = caminhosCachePluginIsolado(home, { CODEX_HOME: codexHome });
    const antes = await fingerprintCaminhos(caminhos);
    const cache = path.join(codexHome, "plugins", "cache");
    await mkdir(cache, { recursive: true });
    await writeFile(path.join(cache, "sentinela.txt"), "não deve existir\n", "utf8");
    assert.notEqual(await fingerprintCaminhos(caminhos), antes);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("gate de redação reconhece caminhos em file URL percent-encoded", () => {
  const sensivel = path.join(os.tmpdir(), "Audit Home", "perfil");
  const codificado = `file:///${sensivel.replaceAll("\\", "/").replaceAll(" ", "%20")}/segredo.txt`;
  assert.equal(payloadContemCaminhoSensivel({ origem: codificado }, [sensivel]), true);
});

test("gate do tarball compara postinstall e skill byte a byte com a fonte", async () => {
  validarBytesArtefatoDistribuicao(Buffer.from("igual"), Buffer.from("igual"), "fixture");
  assert.throws(
    () => validarBytesArtefatoDistribuicao(Buffer.from("a"), Buffer.from("b"), "fixture"),
    /byte-for-byte/u,
  );

  const base = await mkdtemp(path.join(os.tmpdir(), "sema-tarball-fonte-"));
  try {
    const pacote = path.join(base, "package");
    await Promise.all([
      mkdir(path.join(pacote, "scripts"), { recursive: true }),
      mkdir(path.join(pacote, "skills", "sema", "agents"), { recursive: true }),
    ]);
    const pares = [
      ["pacotes/cli/scripts/postinstall.mjs", "scripts/postinstall.mjs"],
      ["plugins/sema/skills/sema/SKILL.md", "skills/sema/SKILL.md"],
      ["plugins/sema/skills/sema/agents/openai.yaml", "skills/sema/agents/openai.yaml"],
    ];
    for (const [fonte, destino] of pares) {
      await copyFile(path.join(raiz, fonte), path.join(pacote, destino));
    }
    const tarball = path.join(base, "fixture.tgz");
    execFileSync("tar", ["-czf", tarball, "-C", base, "package"]);
    await validarArtefatosDistribuicaoContraFonte(tarball, raiz);

    await writeFile(path.join(pacote, "skills", "sema", "SKILL.md"), "stale\n", "utf8");
    execFileSync("tar", ["-czf", tarball, "-C", base, "package"]);
    await assert.rejects(
      validarArtefatosDistribuicaoContraFonte(tarball, raiz),
      /package\/skills\/sema\/SKILL\.md/u,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("installers preservam gates de versão, home, READY, redação e marcador governado", async () => {
  const [powerShell, shell, instaladorLocal, smoke, helper, gitignore] = await Promise.all([
    readFile(path.join(raiz, "install-sema.ps1"), "utf8"),
    readFile(path.join(raiz, "install-sema.sh"), "utf8"),
    readFile(path.join(raiz, "scripts", "instalar-cli-local.mjs"), "utf8"),
    readFile(path.join(raiz, "scripts", "testar-pacote-cli-publico.mjs"), "utf8"),
    readFile(path.join(raiz, "scripts", "cli-publico", "distribuicao-global.mjs"), "utf8"),
    readFile(path.join(raiz, ".gitignore"), "utf8"),
  ]);
  for (const conteudo of [powerShell, shell]) {
    assert.match(conteudo, /SEMA-GOVERNED: sema\.produto\.distribuicao_global\.instaladores/u);
    assert.match(conteudo, /resultado.*estado|resultado\?\.estado|resultado\.estado/is);
    assert.match(conteudo, /launcher.*READY/is);
    assert.match(conteudo, /skill.*READY/is);
    assert.match(conteudo, /sema\.cli\.result\/v1/u);
    assert.match(conteudo, /CLI_SUCCESS/u);
  }
  assert.match(powerShell, /\$packageSpec = "\$\{packageName\}@\$\{Version\}"/u);
  assert.match(powerShell, /Resolve-CanonicalUserHome[\s\S]*npmCommand/u);
  assert.match(powerShell, /"view", \$packageSpec, "version", "--json", "--cache", \$npmCacheDir/u);
  assert.match(powerShell, /\$resolvedPackageSpec = "\$\{packageName\}@\$\{requestedVersion\}"/u);
  assert.match(powerShell, /"install", "-g", \$resolvedPackageSpec/u);
  assert.match(powerShell, /Invoke-NpmCaptured[\s\S]*2>\$null/u);
  assert.doesNotMatch(powerShell, /Managed launcher: \$launcher|PATH contains: \$launcherDir|Out-Host/u);
  assert.match(powerShell, /Test-DistributionReady \$statusResult\.Text \$installedVersion/u);
  assert.match(shell, /PACKAGE_SPEC="\$\{PACKAGE_NAME\}@\$\{VERSION\}"/u);
  assert.match(shell, /RESOLVED_PACKAGE_SPEC="\$\{PACKAGE_NAME\}@\$\{REQUESTED_VERSION\}"/u);
  assert.match(shell, /npm install -g "\$RESOLVED_PACKAGE_SPEC"/u);
  assert.match(shell, /npm install -g "\$RESOLVED_PACKAGE_SPEC"[^\r\n]*>\/dev\/null 2>&1/u);
  assert.doesNotMatch(shell, /Unknown argument: \$arg|Managed launcher: \$LAUNCHER|added to: \$SHELL_PROFILE/u);
  assert.match(shell, /export SEMA_INSTALLED_VERSION="\$INSTALLED_VERSION"/u);
  assert.equal(instaladorLocal.match(/command: "skill"/gu)?.length, 3);
  assert.ok(shell.indexOf("validar_bloco_profile") < shell.indexOf("npm install -g"));
  assert.ok(shell.indexOf("ZDOTDIR must be an absolute path") < shell.indexOf("npm install -g"));
  assert.match(shell, /inicios === 1 && fins === 1 && texto\.includes\(bloco\)/u);
  assert.match(shell, /managed Sema PATH block is incomplete or modified/u);
  assert.match(smoke, /validarArtefatosDistribuicaoContraFonte\(caminhoTarball, raiz\)/u);
  assert.ok(smoke.split(/\r?\n/u).length < 1000);
  assert.ok(helper.split(/\r?\n/u).length < 1000);
  assert.match(gitignore, /^\.codex-remote-attachments\/$/mu);
});

test("PowerShell rejeita USERPROFILE relativo antes do npm", { skip: process.platform !== "win32" }, () => {
  const powershell = path.join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const resultado = spawnSync(powershell, [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    path.join(raiz, "install-sema.ps1"),
  ], {
    cwd: raiz,
    env: { ...process.env, USERPROFILE: ".", HOME: "" },
    encoding: "utf8",
  });
  assert.notEqual(resultado.status, 0);
  assert.match(`${resultado.stdout}\n${resultado.stderr}`, /must be absolute paths/u);
  assert.doesNotMatch(`${resultado.stdout}\n${resultado.stderr}`, /Installing the Sema CLI/u);
});

test("invocadores preservam Unicode, %META%, metacaracteres e stdin", {
  skip: process.platform !== "win32",
}, async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-installer-quote-"));
  try {
    const home = path.join(base, "日本 A%META%B 100%! & caret^");
    const launcher = path.join(home, ".sema", "bin", "sema.cmd");
    await mkdir(path.dirname(launcher), { recursive: true });
    const probe = path.join(path.dirname(launcher), "probe.mjs");
    await writeFile(probe, [
      "const partes = [];",
      "for await (const parte of process.stdin) partes.push(Buffer.from(parte));",
      "process.stdout.write(JSON.stringify({ args: process.argv.slice(2), stdin: Buffer.concat(partes).toString('base64') }));",
      "",
    ].join("\n"), "utf8");
    const artefatos = gerarArtefatosLauncherWindows(process.execPath, probe, "2.3.6");
    await Promise.all([
      writeFile(launcher, artefatos.launcher, "utf8"),
      writeFile(path.join(path.dirname(launcher), artefatos.nomeCompanion), artefatos.companion),
      writeFile(path.join(path.dirname(launcher), "sema.ps1"), artefatos.wrapper),
      writeFile(path.join(path.dirname(launcher), "sema-managed.ps1"), artefatos.wrapper),
      writeFile(path.join(path.dirname(launcher), "sema-launcher.receipt"), artefatos.anchor),
    ]);
    const ambiente = {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      META: "EXPANDIDO",
      PATH: "",
      Path: "",
    };
    const argumentos = ["literal=%META%", "percent=100%", "amp=&", "caret=^", "espaço 日本"];
    const entrada = Buffer.from("stdin %META% !&^\0日本\n", "utf8");
    const esperado = { args: argumentos, stdin: entrada.toString("base64") };
    assert.deepEqual(
      JSON.parse(executarLauncherSmoke(launcher, argumentos, base, ambiente, entrada)),
      esperado,
    );
    assert.deepEqual(
      JSON.parse(executarLauncherInstalador(launcher, argumentos, {
        cwd: base,
        env: ambiente,
        input: entrada,
        stdio: "pipe",
      })),
      esperado,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("shell rejeita spec arbitrária sem invocar npm", () => {
  const resultado = spawnSync("bash", ["./install-sema.sh", "--version=beta"], {
    cwd: raiz,
    encoding: "utf8",
  });
  if ((resultado.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return;
  assert.notEqual(resultado.status, 0);
  assert.match(`${resultado.stdout}\n${resultado.stderr}`, /exact SemVer or latest/u);
  assert.doesNotMatch(`${resultado.stdout}\n${resultado.stderr}`, /Installing the Sema CLI/u);
});

test("shell rejeita argv hostil sem ecoar token", () => {
  const segredoArgv = "--token=demo-secret";
  const resultado = spawnSync("bash", ["./install-sema.sh", segredoArgv], {
    cwd: raiz,
    encoding: "utf8",
  });
  if ((resultado.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") return;
  const saida = `${resultado.stdout}\n${resultado.stderr}`;
  assert.notEqual(resultado.status, 0);
  assert.match(saida, /Unknown installer argument/u);
  assert.equal(saida.includes(segredoArgv), false);
  assert.doesNotMatch(saida, /demo-secret/u);
});

test("PowerShell não repassa saída npm bruta nem caminho da home", {
  skip: process.platform !== "win32",
}, async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-installer-redaction-"));
  try {
    const home = path.join(base, "home-privada");
    const bin = path.join(base, "fake-bin");
    await Promise.all([mkdir(home, { recursive: true }), mkdir(bin, { recursive: true })]);
    const marcador = "NPM_RAW_SECRET=/home/demo/.npm/_logs/private.log";
    await writeFile(path.join(bin, "npm.cmd"), [
      "@echo off",
      "if /I \"%~1\"==\"view\" (",
      "  echo \"3.0.0\"",
      "  exit /b 0",
      ")",
      "if /I \"%~1\"==\"install\" (",
      `  echo ${marcador}`,
      `  echo ${marcador} 1>&2`,
      "  exit /b 42",
      ")",
      "exit /b 43",
      "",
    ].join("\r\n"), "utf8");
    const powershell = path.join(
      process.env.SystemRoot ?? "C:\\Windows",
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const resultado = spawnSync(powershell, [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(raiz, "install-sema.ps1"),
      "-Version",
      "3.0.0",
    ], {
      cwd: raiz,
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: home,
        SEMA_NPM_PACKAGE: "@semacode/cli",
        PATH: `${bin};${path.dirname(process.execPath)};${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });
    const saida = `${resultado.stdout}\n${resultado.stderr}`;
    assert.notEqual(resultado.status, 0);
    assert.match(saida, /npm failed to install the Sema CLI globally/u);
    assert.equal(saida.includes(marcador), false);
    assert.equal(saida.includes(home), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("shell não repassa saída npm bruta nem caminho da home", {
  skip: process.platform === "win32",
}, async (t) => {
  const probe = spawnSync("bash", ["-c", "command -v node >/dev/null 2>&1"], { encoding: "utf8" });
  if ((probe.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT" || probe.status !== 0) {
    t.skip("bash com Node.js indisponível");
    return;
  }
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-installer-redaction-"));
  try {
    const home = path.join(base, "home-privada");
    const bin = path.join(base, "fake-bin");
    await Promise.all([mkdir(home, { recursive: true }), mkdir(bin, { recursive: true })]);
    const marcador = "NPM_RAW_SECRET=/home/demo/.npm/_logs/private.log";
    await writeFile(path.join(bin, "npm"), [
      "#!/usr/bin/env bash",
      "case \"${1:-}\" in",
      "  view) printf '\"3.0.0\"\\n' ; exit 0 ;;",
      `  install) printf '%s\\n' '${marcador}'; printf '%s\\n' '${marcador}' >&2; exit 42 ;;`,
      "  *) exit 43 ;;",
      "esac",
      "",
    ].join("\n"), { encoding: "utf8", mode: 0o755 });
    const resultado = spawnSync("bash", ["./install-sema.sh", "--version=3.0.0"], {
      cwd: raiz,
      env: {
        ...process.env,
        HOME: home,
        USERPROFILE: "",
        ZDOTDIR: "",
        SHELL: "/bin/bash",
        PATH: `${bin}:${process.env.PATH ?? ""}`,
      },
      encoding: "utf8",
    });
    const saida = `${resultado.stdout}\n${resultado.stderr}`;
    assert.notEqual(resultado.status, 0);
    assert.match(saida, /npm failed to install the Sema CLI globally/u);
    assert.equal(saida.includes(marcador), false);
    assert.equal(saida.includes(home), false);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
