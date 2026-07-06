// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descrição: centraliza busca segura de caminhos e arquivos usados pelo carregamento de projeto.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export const DIRETORIOS_CODIGO_IGNORADOS = new Set([
  ".git",
  ".github",
  ".pytest_cache",
  ".tmp",
  ".turbo",
  ".venv",
  ".next",
  ".nuxt",
  ".dart_tool",
  ".claude",
  ".codex",
  ".cursor",
  ".minimax",
  "__pycache__",
  ".opencode",
  ".roo",
  "build",
  "coverage",
  "deploy",
  "dist",
  "doc",
  "docs",
  "generated",
  "node_modules",
  "ephemeral",
  ".vscode",
  ".windsurf",
  "test",
  "tests",
  "vendor",
  "venv",
]);

export const EXTENSOES_CODIGO = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".dart",
  ".lua",
  ".cs",
  ".java",
  ".go",
  ".rs",
  ".cpp",
  ".cc",
  ".cxx",
  ".hpp",
  ".h",
  ".php",
  ".html",
  ".htm",
  ".css",
];

export async function caminhoExiste(caminhoAlvo: string): Promise<boolean> {
  try {
    await stat(caminhoAlvo);
    return true;
  } catch {
    return false;
  }
}

export async function lerConteudoSeExistir(caminhoAlvo: string): Promise<string | undefined> {
  try {
    return await readFile(caminhoAlvo, "utf8");
  } catch {
    return undefined;
  }
}

export async function listarDiretoriosFilhos(diretorioBase: string): Promise<string[]> {
  try {
    const entradas = await readdir(diretorioBase, { withFileTypes: true });
    return entradas
      .filter((entrada) => entrada.isDirectory())
      .map((entrada) => path.join(diretorioBase, entrada.name));
  } catch {
    return [];
  }
}

export async function listarArquivosRecursivosLimitado(
  diretorioBase: string,
  extensoes: string[],
  profundidadeMaxima = 4,
  limite = 40,
): Promise<string[]> {
  const encontrados: string[] = [];

  const visitar = async (diretorioAtual: string, profundidadeAtual: number): Promise<void> => {
    if (encontrados.length >= limite) {
      return;
    }

    let entradas;
    try {
      entradas = await readdir(diretorioAtual, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entrada of entradas) {
      if (encontrados.length >= limite) {
        return;
      }

      const caminhoAtual = path.join(diretorioAtual, entrada.name);
      if (entrada.isDirectory()) {
        if (profundidadeAtual <= 0 || DIRETORIOS_CODIGO_IGNORADOS.has(entrada.name.toLowerCase())) {
          continue;
        }
        await visitar(caminhoAtual, profundidadeAtual - 1);
        continue;
      }

      if (extensoes.some((extensao) => entrada.name.toLowerCase().endsWith(extensao))) {
        encontrados.push(caminhoAtual);
      }
    }
  };

  await visitar(diretorioBase, profundidadeMaxima);
  return encontrados;
}

export async function procurarArquivosPorNome(
  diretorioBase: string,
  nomes: string[],
  profundidadeMaxima = 4,
): Promise<string[]> {
  const nomesNormalizados = new Set(nomes.map((nome) => nome.toLowerCase()));
  const encontrados: string[] = [];

  const visitar = async (diretorioAtual: string, profundidadeAtual: number): Promise<void> => {
    let entradas;
    try {
      entradas = await readdir(diretorioAtual, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entrada of entradas) {
      const caminhoAtual = path.join(diretorioAtual, entrada.name);
      if (entrada.isDirectory()) {
        if (profundidadeAtual <= 0 || DIRETORIOS_CODIGO_IGNORADOS.has(entrada.name.toLowerCase())) {
          continue;
        }
        await visitar(caminhoAtual, profundidadeAtual - 1);
        continue;
      }

      if (nomesNormalizados.has(entrada.name.toLowerCase())) {
        encontrados.push(caminhoAtual);
      }
    }
  };

  await visitar(diretorioBase, profundidadeMaxima);
  return encontrados;
}
