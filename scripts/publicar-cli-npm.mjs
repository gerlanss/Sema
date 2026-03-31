import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const raiz = process.cwd();
const manifest = JSON.parse(await readFile(path.join(raiz, "package.json"), "utf8"));
const manifestCli = JSON.parse(await readFile(path.join(raiz, "pacotes", "cli", "package.json"), "utf8"));
const versao = manifest.version;
const tarball = path.join(raiz, ".tmp", "pacotes-publicos", `semacode-cli-${versao}.tgz`);
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tagIndex = args.findIndex((arg) => arg === "--tag");
const tag = tagIndex >= 0 ? args[tagIndex + 1] : "latest";
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
  console.error("Diagnostico provavel:");
  if (versaoPublicada) {
    console.error(`- O pacote ja existe no registry e a versao visivel agora e ${versaoPublicada}.`);
    console.error("- Quando o npm responde 404 no PUT nesse caso, quase sempre e falta de permissao de publish para a conta atual.");
  } else if (scopePacote) {
    console.error(`- O scope ${scopePacote} pode nao existir no npm ou a conta atual nao tem permissao para criar pacote nele.`);
  } else {
    console.error("- A conta atual nao conseguiu publicar o pacote no registry configurado.");
  }

  console.error("");
  console.error("O que conferir agora:");
  if (usuarioAtual) {
    console.error(`- conta atual no npm: ${usuarioAtual}`);
  } else {
    console.error("- rode `npm whoami` para confirmar com qual conta voce esta autenticado.");
  }
  console.error(`- confirme que essa conta tem permissao de publish em ${nomePacote}.`);
  if (scopePacote) {
    console.error(`- se ${scopePacote} for organizacao, confirme membership e permissao de publicar nesse scope.`);
  }
  console.error("- se a conta estiver errada, rode `npm login` com o dono correto e publique de novo.");
  console.error("- se voce usa token granular, confirme que ele tem permissao de publish no pacote/scope.");
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

console.log(`${dryRun ? "Validando" : "Publicando"} a CLI publica da Sema no npm...`);
console.log(`Tarball: ${tarball}`);
console.log(`Tag npm: ${tag}`);
validarPublicacaoAntesDoEnvio();

try {
  executar("npm", argumentosPublish, raiz);
} catch (erro) {
  explicarFalhaPublicacao();
  throw erro;
}
