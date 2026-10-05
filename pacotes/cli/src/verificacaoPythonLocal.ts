// SEMA-GOVERNED: sema.produto.cli_verificacao
// Contrato: contratos/sema/cli_verificacao.sema
// Descrição: preserva Python local explicitamente; testes continuam derivados do contrato, sem cache.
import { lstat } from "node:fs/promises";
import path from "node:path";

type Arquivo = { caminhoRelativo: string; conteudo: string };

export function erroModoPreservacao(
  preservar: boolean | undefined,
  configuracoes: Array<{ alvo: string; framework: string }>,
): string | undefined {
  if (preservar && (configuracoes.length !== 1 || configuracoes[0].alvo !== "python" || configuracoes[0].framework !== "base")) {
    return "--preservar-implementacao exige --alvo python e framework base.";
  }
  return undefined;
}

export async function prepararImplementacaoPythonLocal(
  base: string,
  arquivos: Arquivo[],
): Promise<{ arquivosParaEscrita: Arquivo[]; erro?: string }> {
  const implementacoes = arquivos.filter(arquivo => arquivo.caminhoRelativo.endsWith(".py") && !path.basename(arquivo.caminhoRelativo).startsWith("test_"));
  if (implementacoes.length === 0) return { arquivosParaEscrita: [], erro: "Nenhuma implementação Python local prevista pelo contrato." };
  try {
    for (const arquivo of implementacoes) {
      const destino = path.resolve(base, arquivo.caminhoRelativo);
      const relativo = path.relative(path.resolve(base), destino);
      if (path.isAbsolute(relativo) || relativo.split(path.sep).includes("..")) throw new Error("escape");
      let atual = destino;
      while (true) {
        const info = await lstat(atual);
        if (info.isSymbolicLink() || (atual === destino ? !info.isFile() || info.nlink > 1 : !info.isDirectory())) throw new Error("link ou tipo inválido");
        const pai = path.dirname(atual);
        if (pai === atual) break;
        atual = pai;
      }
    }
    const preservados = new Set(implementacoes.map(arquivo => arquivo.caminhoRelativo));
    return { arquivosParaEscrita: arquivos.filter(arquivo => !preservados.has(arquivo.caminhoRelativo)) };
  } catch {
    return { arquivosParaEscrita: [], erro: "Implementação Python local ausente ou caminho não seguro. Gere e preencha a implementação antes de usar --preservar-implementacao." };
  }
}

export function evidenciaPython(preservar: boolean | undefined) {
  return {
    tipoEvidencia: preservar ? "implementacao_local_preservada" as const : "andaime_demonstrativo" as const,
    implementacaoExternaExecutada: false,
  };
}
