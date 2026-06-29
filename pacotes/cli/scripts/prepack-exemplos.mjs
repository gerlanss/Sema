import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(cliDir, "..", "..");
const origem = path.join(repoRoot, "exemplos");
const destino = path.join(cliDir, "exemplos");
const marcador = path.join(destino, ".prepack-generated");
const dependenciasInternas = [
  "nucleo",
  "padroes",
  "gerador-typescript",
  "gerador-python",
  "gerador-dart",
  "gerador-lua",
  "gerador-javascript",
  "gerador-html",
  "gerador-css",
];
const escopoSema = path.join(cliDir, "node_modules", "@sema");
const marcadorDependencias = path.join(cliDir, "node_modules", ".sema-prepack-internal-deps");

async function existe(caminho) {
  try {
    await stat(caminho);
    return true;
  } catch {
    return false;
  }
}

if (!(await existe(origem))) {
  throw new Error(`Diretorio de exemplos oficiais nao encontrado: ${origem}`);
}

if (await existe(destino)) {
  if (!(await existe(marcador))) {
    throw new Error(`Nao vou sobrescrever exemplos locais sem marcador: ${destino}`);
  }

  await rm(destino, { recursive: true, force: true });
}

await mkdir(destino, { recursive: true });

for (const entrada of await readdir(origem, { withFileTypes: true })) {
  if (!entrada.isFile() || !entrada.name.endsWith(".sema")) {
    continue;
  }

  await cp(path.join(origem, entrada.name), path.join(destino, entrada.name));
}

await writeFile(marcador, "gerado pelo prepack do @semacode/cli\n", "utf8");

if (await existe(escopoSema)) {
  if (!(await existe(marcadorDependencias))) {
    throw new Error(`Nao vou sobrescrever dependencias locais sem marcador: ${escopoSema}`);
  }

  await rm(escopoSema, { recursive: true, force: true });
  await rm(marcadorDependencias, { force: true });
}

await mkdir(escopoSema, { recursive: true });

for (const pacote of dependenciasInternas) {
  const origemPacote = path.join(repoRoot, "pacotes", pacote);
  const destinoPacote = path.join(escopoSema, pacote);

  if (!(await existe(origemPacote))) {
    throw new Error(`Pacote interno nao encontrado: ${origemPacote}`);
  }

  await cp(origemPacote, destinoPacote, {
    recursive: true,
    filter: (caminho) => !caminho.split(path.sep).includes("node_modules"),
  });
}

await writeFile(marcadorDependencias, "gerado pelo prepack do @semacode/cli\n", "utf8");
