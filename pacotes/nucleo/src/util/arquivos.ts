import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export async function lerArquivoTexto(caminhoArquivo: string): Promise<string> {
  return readFile(caminhoArquivo, "utf8");
}

export async function listarArquivosSema(entrada: string): Promise<string[]> {
  const informacao = await stat(entrada);
  if (informacao.isFile()) {
    return [entrada];
  }

  const encontrados: string[] = [];
  const filhos = await readdir(entrada, { withFileTypes: true });
  for (const filho of filhos) {
    const caminhoCompleto = path.join(entrada, filho.name);
    if (filho.isDirectory()) {
      encontrados.push(...(await listarArquivosSema(caminhoCompleto)));
      continue;
    }
    if (filho.isFile() && caminhoCompleto.endsWith(".sema")) {
      encontrados.push(caminhoCompleto);
    }
  }
  return encontrados;
}

