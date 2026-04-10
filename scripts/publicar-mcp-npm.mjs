import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const raiz = process.cwd();
const manifest = JSON.parse(await readFile(path.join(raiz, "pacotes", "mcp", "package.json"), "utf8"));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tagIndex = args.findIndex((arg) => arg === "--tag");
const tag = tagIndex >= 0 ? args[tagIndex + 1] : "latest";
const nomePacote = manifest.name;
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
    console.error("- Quando o npm responde erro de publish nesse caso, quase sempre e permissao insuficiente para a conta atual.");
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
}

function main() {
  const argumentos = ["publish", "--workspace", nomePacote, "--access", "public", "--tag", tag];
  if (dryRun) {
    argumentos.push("--dry-run");
  }

  try {
    executar("npm", argumentos, raiz);
  } catch (erro) {
    explicarFalhaPublicacao();
    throw erro;
  }
}

try {
  main();
} catch (erro) {
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
}
