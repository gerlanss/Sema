// SEMA-GOVERNED: sema.produto.fronteira_repositorios.empacotamento.postinstall, sema.produto.fronteira_repositorios.empacotamento.smoke
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

test("installers preservam gates de versão, home, READY e marcador governado", async () => {
  const [powerShell, shell, smoke, helper, gitignore] = await Promise.all([
    readFile(path.join(raiz, "install-sema.ps1"), "utf8"),
    readFile(path.join(raiz, "install-sema.sh"), "utf8"),
    readFile(path.join(raiz, "scripts", "testar-pacote-cli-publico.mjs"), "utf8"),
    readFile(path.join(raiz, "scripts", "cli-publico", "distribuicao-global.mjs"), "utf8"),
    readFile(path.join(raiz, ".gitignore"), "utf8"),
  ]);
  for (const conteudo of [powerShell, shell]) {
    assert.match(conteudo, /SEMA-GOVERNED: sema\.produto\.distribuicao_global\.instaladores/u);
    assert.match(conteudo, /resultado.*estado|resultado\?\.estado|resultado\.estado/is);
    assert.match(conteudo, /launcher.*READY/is);
    assert.match(conteudo, /skill.*READY/is);
  }
  assert.match(powerShell, /\$packageSpec = "\$\{packageName\}@\$\{Version\}"/u);
  assert.match(powerShell, /Resolve-CanonicalUserHome[\s\S]*npmCommand/u);
  assert.match(powerShell, /view \$packageSpec version --json --cache \$npmCacheDir/u);
  assert.match(powerShell, /\$resolvedPackageSpec = "\$\{packageName\}@\$\{requestedVersion\}"/u);
  assert.match(powerShell, /install -g \$resolvedPackageSpec/u);
  assert.match(shell, /PACKAGE_SPEC="\$\{PACKAGE_NAME\}@\$\{VERSION\}"/u);
  assert.match(shell, /RESOLVED_PACKAGE_SPEC="\$\{PACKAGE_NAME\}@\$\{REQUESTED_VERSION\}"/u);
  assert.match(shell, /npm install -g "\$RESOLVED_PACKAGE_SPEC"/u);
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
