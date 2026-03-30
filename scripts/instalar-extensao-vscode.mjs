import { readdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

const raiz = process.cwd();
const pastaVsix = path.join(raiz, ".tmp", "editor-vscode");

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
}

main().catch((erro) => {
  console.error("Falha ao instalar a extensao VS Code da Sema.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
