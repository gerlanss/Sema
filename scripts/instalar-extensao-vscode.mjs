import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const raiz = process.cwd();
const pastaVsix = path.join(raiz, ".tmp", "editor-vscode");

function resolverCodeCliWindows() {
  const localAppData = process.env.LOCALAPPDATA;
  const candidatos = [
    localAppData ? path.join(localAppData, "Programs", "Microsoft VS Code", "bin", "code.cmd") : undefined,
    localAppData ? path.join(localAppData, "Programs", "VSCodium", "bin", "codium.cmd") : undefined,
  ].filter(Boolean);

  for (const candidato of candidatos) {
    if (existsSync(candidato)) {
      return candidato;
    }
  }

  return "code.cmd";
}

async function main() {
  const manifestExtensao = JSON.parse(
    await readFile(path.join(raiz, "pacotes", "editor-vscode", "package.json"), "utf8"),
  );
  const arquivos = await readdir(pastaVsix);
  const nomeEsperado = `${manifestExtensao.name}-${manifestExtensao.version}.vsix`;
  const vsix = arquivos.includes(nomeEsperado)
    ? nomeEsperado
    : arquivos
      .filter((item) => item.endsWith(".vsix") && item.startsWith(`${manifestExtensao.name}-`))
      .sort()
      .at(-1);

  if (!vsix) {
    console.error(`Nenhum arquivo .vsix compativel com ${manifestExtensao.name} encontrado. Rode primeiro \`npm run extensao:empacotar\`.`);
    process.exit(1);
  }

  const caminhoVsix = path.join(pastaVsix, vsix);

  if (process.platform === "win32") {
    const codeCli = resolverCodeCliWindows();
    execFileSync("powershell", ["-NoProfile", "-Command", `& "${codeCli}" --install-extension "${caminhoVsix}" --force`], {
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
