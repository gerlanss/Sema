// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: utilit?rios pequenos para listas, unicidade e resumo textual.

export function unicos<T>(itens: T[]): T[] {
  return [...new Set(itens)];
}

export function unicosOrdenados(itens: string[]): string[] {
  return unicos(itens).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function limitarLista(itens: string[], limite: number): string[] {
  return itens.slice(0, limite);
}

export function resumirListaTexto(itens: string[], limite: number, padrao = "nenhum"): string {
  if (itens.length === 0) {
    return padrao;
  }
  const visiveis = itens.slice(0, limite);
  const restante = itens.length - visiveis.length;
  return restante > 0 ? `${visiveis.join(", ")} (+${restante})` : visiveis.join(", ");
}
