// SEMA-GOVERNED: sema.produto.fronteira_repositorios
// Consulte contratos/sema/fronteira_repositorios.sema antes de editar.
// Descrição: publica somente o pacote instalador @semacode/cli no npm, com dry-run e validações de fronteira.

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const raiz = process.cwd();
const manifest = JSON.parse(await readFile(path.join(raiz, "package.json"), "utf8"));
const manifestCli = JSON.parse(await readFile(path.join(raiz, "pacotes", "cli", "package.json"), "utf8"));
const versao = manifestCli.version;
const tarball = path.join(raiz, ".tmp", "pacotes-instalador-npm", `semacode-cli-${versao}.tgz`);
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tagIndex = args.findIndex((arg) => arg === "--tag");
const tag = tagIndex >= 0 ? args[tagIndex + 1] : "latest";
const otpIndex = args.findIndex((arg) => arg === "--otp" || arg.startsWith("--otp="));
const otpArg = otpIndex >= 0 ? args[otpIndex] : undefined;
const otp =
  otpArg?.startsWith("--otp=") ? otpArg.slice("--otp=".length) : otpIndex >= 0 ? args[otpIndex + 1] : undefined;
const nomePacote = manifestCli.name;
const scopePacote = nomePacote.startsWith("@") ? nomePacote.split("/")[0] : undefined;

function executar(comando, argumentos, cwd) {
  if (process.platform === "win32" && comando === "npm") {
    execFileSync("powershell", ["-NoProfile", "-Command", [comando, ...argumentos].join(" ")], {
      cwd,
      stdio: "inherit",
    });
    return;
  }

  execFileSync(comando, argumentos, {
    cwd,
    stdio: "inherit",
  });
}

function capturarSaida(comando, argumentos, cwd) {
  try {
    if (process.platform === "win32" && comando === "npm") {
      return execFileSync("powershell", ["-NoProfile", "-Command", [comando, ...argumentos].join(" ")], {
        cwd,
        stdio: "pipe",
        encoding: "utf8",
      }).trim();
    }

    return execFileSync(comando, argumentos, {
      cwd,
      stdio: "pipe",
      encoding: "utf8",
    }).trim();
  } catch {
    return undefined;
  }
}

function explicarFalhaPublicacao() {
  const versaoPublicada = capturarSaida("npm", ["view", nomePacote, "version"], raiz);
  const usuarioAtual = capturarSaida("npm", ["whoami"], raiz);

  console.error("");
  console.error(`Falha ao publicar ${nomePacote} no npm.`);
  console.error("");
  console.error("Diagnóstico:");
  console.error("- Leia o erro do npm logo acima; ele é a fonte primária.");
  console.error("- Se o erro foi EOTP, o npm exigiu código de autenticação 2FA para publish.");
  console.error("- Nesse caso, repita com `npm run cli:publicar-npm -- --otp <codigo>` ou use um token de publish autorizado a bypassar 2FA.");
  if (versaoPublicada) {
    console.error(`- O pacote já existe no registry e a versão visível agora é ${versaoPublicada}.`);
    console.error("- Se o erro não foi EOTP, confira permissão de publish, membership do scope e versão já publicada.");
  } else if (scopePacote) {
    console.error(`- O scope ${scopePacote} pode não existir no npm ou a conta atual não tem permissão para criar pacote nele.`);
  } else {
    console.error("- A conta atual não conseguiu publicar o pacote no registry configurado.");
  }

  console.error("");
  console.error("O que conferir agora:");
  if (usuarioAtual) {
    console.error(`- conta atual no npm: ${usuarioAtual}`);
  } else {
    console.error("- rode `npm whoami` para confirmar com qual conta você está autenticado.");
  }
  console.error(`- confirme que essa conta tem permissão de publish em ${nomePacote}.`);
  if (scopePacote) {
    console.error(`- se ${scopePacote} for organização, confirme membership e permissão de publicar nesse scope.`);
  }
  console.error("- se a conta estiver errada, rode `npm login` com o dono correto e publique de novo.");
  console.error("- se você usa token granular, confirme que ele tem permissão de publish no pacote/scope e, se necessário, bypass de 2FA.");
}

function validarPublicacaoAntesDoEnvio() {
  if (dryRun) {
    return;
  }

  const usuarioAtual = capturarSaida("npm", ["whoami"], raiz);
  if (!usuarioAtual) {
    console.error("");
    console.error(`Nao foi possivel validar a autenticacao npm antes de publicar ${nomePacote}.`);
    console.error("- rode `npm whoami` e confirme que existe uma conta autenticada.");
    if (scopePacote) {
      console.error(`- depois rode \`npm login --scope=${scopePacote} --registry=https://registry.npmjs.org/\` se precisar renovar o login.`);
    } else {
      console.error("- depois rode `npm login --registry=https://registry.npmjs.org/` se precisar renovar o login.");
    }
    console.error("- publique de novo so quando a conta autenticada tiver permissao no pacote/scope.");
    process.exit(1);
  }

  console.log(`Conta npm autenticada: ${usuarioAtual}`);
}

function versaoExataJaPublicada() {
  return capturarSaida("npm", ["view", `${nomePacote}@${versao}`, "version"], raiz) === versao;
}

const argumentosPublish = [
  "publish",
  tarball,
  "--access",
  "public",
  "--tag",
  tag,
];

if (dryRun) {
  argumentosPublish.push("--dry-run");
}

if (otp) {
  argumentosPublish.push("--otp", otp);
}

console.log(`${dryRun ? "Validando" : "Publicando"} o instalador npm da CLI da Sema...`);
console.log(`Tarball: ${tarball}`);
console.log(`Tag npm: ${tag}`);
validarPublicacaoAntesDoEnvio();

if (dryRun && versaoExataJaPublicada()) {
  console.log(`Dry-run OK: ${nomePacote}@${versao} ja existe no npm; tarball local foi empacotado para conferencia.`);
  process.exit(0);
}

try {
  executar("npm", argumentosPublish, raiz);
} catch (erro) {
  explicarFalhaPublicacao();
  throw erro;
}
