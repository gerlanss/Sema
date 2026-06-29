// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function criarDiretoriosBaseFutebot(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "docs"), { recursive: true }),
    mkdir(path.join(base, "tests"), { recursive: true }),
    mkdir(path.join(base, ".pytest_cache"), { recursive: true }),
  ]);
}

export async function escreverFutebotFixture(base: string, caminhoRelativo: string, conteudo: string): Promise<void> {
  const destino = path.join(base, caminhoRelativo);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, conteudo, "utf8");
}
