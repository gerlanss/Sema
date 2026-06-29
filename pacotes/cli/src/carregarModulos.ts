// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: carregamento compacto de m?dulos Sema para comandos da CLI.

import { carregarProjeto, type ContextoProjetoCarregado } from "./projeto.js";

export async function carregarModulos(entrada: string | undefined, cwd = process.cwd()): Promise<ContextoProjetoCarregado["modulosSelecionados"]> {
  return (await carregarProjeto(entrada, cwd)).modulosSelecionados;
}
