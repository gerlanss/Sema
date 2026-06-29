import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(scriptDir, "..");
const destino = path.join(cliDir, "exemplos");
const marcador = path.join(destino, ".prepack-generated");
const escopoSema = path.join(cliDir, "node_modules", "@sema");
const marcadorDependencias = path.join(cliDir, "node_modules", ".sema-prepack-internal-deps");

try {
  await stat(marcador);
  await rm(destino, { recursive: true, force: true });
} catch {
  // Sem marcador, a pasta nao foi gerada pelo prepack e deve ser preservada.
}

try {
  await stat(marcadorDependencias);
  await rm(escopoSema, { recursive: true, force: true });
  await rm(marcadorDependencias, { force: true });
} catch {
  // Sem marcador, as dependencias locais nao foram geradas pelo prepack.
}
