import { readdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const raiz = process.cwd();
const pastaVsix = path.join(raiz, ".tmp", "editor-vscode");

function tryExec(comando, argumentos) {
  try {
    return execFileSync(comando, argumentos, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return undefined;
  }
}

function descobrirCliGlobal() {
  const candidatos = [];

  const prefixoGlobal = tryExec("npm", ["prefix", "-g"]);
  if (prefixoGlobal) {
    const caminho = path.join(prefixoGlobal, process.platform === "win32" ? "sema.cmd" : "sema");
    if (existsSync(caminho)) {
      candidatos.push(caminho);
    }
  }

  if (process.platform === "win32" && process.env.APPDATA) {
    const caminhoAppData = path.join(process.env.APPDATA, "npm", "sema.cmd");
    if (existsSync(caminhoAppData)) {
      candidatos.push(caminhoAppData);
    }
  }

  const shellDetectado = process.platform === "win32"
    ? tryExec("where.exe", ["sema"])
    : tryExec("which", ["sema"]);
  if (shellDetectado) {
    const primeiro = shellDetectado.split(/\r?\n/).map((item) => item.trim()).find(Boolean);
    if (primeiro && existsSync(primeiro)) {
      candidatos.push(primeiro);
    }
  }

  return [...new Set(candidatos)];
}

async function main() {
  const arquivos = await readdir(pastaVsix);
  const vsix = arquivos
    .filter((item) => item.endsWith(".vsix"))
    .sort()
    .at(-1);

  if (!vsix) {
    console.error("Nenhum arquivo .vsix encontrado. Rode primeiro `npm run extensao:empacotar`.");
    process.exit(1);
  }

  const caminhoVsix = path.join(pastaVsix, vsix);

  if (process.platform === "win32") {
    execFileSync("powershell", ["-NoProfile", "-Command", `code --install-extension "${caminhoVsix}" --force`], {
      stdio: "inherit",
    });
  } else {
    execFileSync("code", ["--install-extension", caminhoVsix, "--force"], {
      stdio: "inherit",
    });
  }

  console.log(`Extensao instalada com sucesso a partir de ${caminhoVsix}`);

  const clis = descobrirCliGlobal();
  if (clis.length === 1) {
    console.log(`CLI plausivel detectada para bootstrap automatico: ${clis[0]}`);
    console.log("Ao abrir o VS Code, a extensao deve adotar esse caminho automaticamente se `sema.cliPath` estiver vazio.");
  } else if (clis.length > 1) {
    console.log("Mais de uma CLI plausivel foi detectada. A extensao vai diagnosticar ambiguidade no primeiro carregamento:");
    for (const cli of clis) {
      console.log(`- ${cli}`);
    }
  } else {
    console.log("Nenhuma CLI plausivel foi detectada no instalador. A extensao ainda vai tentar bootstrap no primeiro carregamento.");
  }
}

main().catch((erro) => {
  console.error("Falha ao instalar a extensao VS Code da Sema.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
