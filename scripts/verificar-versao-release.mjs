// SEMA-GOVERNED: sema.produto.governanca_ia.release_profiles
// Consulte contratos/sema/governanca_ia_release_profiles.sema antes de editar.
// Descricao: confirma alinhamento de versao entre raiz e CLI publica.
import { readFile } from "node:fs/promises";
import path from "node:path";

const raiz = process.cwd();
const manifestRaiz = JSON.parse(await readFile(path.join(raiz, "package.json"), "utf8"));
const manifestCli = JSON.parse(await readFile(path.join(raiz, "pacotes", "cli", "package.json"), "utf8"));

const versoes = new Map([
  ["raiz", manifestRaiz.version],
  ["cli", manifestCli.version],
]);

const unicas = [...new Set(versoes.values())];
if (unicas.length !== 1) {
  console.error("Release check failed: root and CLI versions are not aligned.");
  for (const [nome, versao] of versoes) {
    console.error(`- ${nome}: ${versao}`);
  }
  process.exit(1);
}

const versao = unicas[0];
const tagEsperada = `v${versao}`;
const tagInformada = process.env.SEMA_RELEASE_TAG?.trim();

if (tagInformada && tagInformada !== tagEsperada) {
  console.error(`Release check failed: tag ${tagInformada} does not match version ${versao}.`);
  process.exit(1);
}

console.log(`Public release version validated: ${versao}`);
