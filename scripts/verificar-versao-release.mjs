import { readFile } from "node:fs/promises";
import path from "node:path";

const raiz = process.cwd();
const manifestRaiz = JSON.parse(await readFile(path.join(raiz, "package.json"), "utf8"));
const manifestCli = JSON.parse(await readFile(path.join(raiz, "pacotes", "cli", "package.json"), "utf8"));
const manifestMcp = JSON.parse(await readFile(path.join(raiz, "pacotes", "mcp", "package.json"), "utf8"));
const manifestExtensao = JSON.parse(await readFile(path.join(raiz, "pacotes", "editor-vscode", "package.json"), "utf8"));

const versoes = new Map([
  ["raiz", manifestRaiz.version],
  ["cli", manifestCli.version],
  ["mcp", manifestMcp.version],
  ["extensao", manifestExtensao.version],
]);

const unicas = [...new Set(versoes.values())];
if (unicas.length !== 1) {
  console.error("Falha de release: as versoes publicas nao estao alinhadas.");
  for (const [nome, versao] of versoes) {
    console.error(`- ${nome}: ${versao}`);
  }
  process.exit(1);
}

const versao = unicas[0];
const tagEsperada = `v${versao}`;
const tagInformada = process.env.SEMA_RELEASE_TAG?.trim();

if (tagInformada && tagInformada !== tagEsperada) {
  console.error(`Falha de release: a tag ${tagInformada} nao bate com a versao publica ${versao}.`);
  process.exit(1);
}

console.log(`Versao publica validada: ${versao}`);
