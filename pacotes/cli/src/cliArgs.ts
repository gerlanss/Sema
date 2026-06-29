// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: parse comum de argumentos e flags da CLI.

export function obterOpcao(args: string[], nome: string, padrao?: string): string | undefined {
  const nomes = [nome, ...Object.entries(ALIAS_OPCOES).filter(([, v]) => v === nome).map(([k]) => k)];
  for (const n of nomes) {
    const indice = args.findIndex((arg) => arg === n);
    if (indice !== -1) return args[indice + 1] ?? padrao;
  }
  return padrao;
}

export function possuiFlag(args: string[], nome: string): boolean {
  return args.includes(nome);
}

export function obterOpcoesRepetidas(args: string[], nome: string): string[] {
  const valores: string[] = [];
  for (let indice = 0; indice < args.length; indice += 1) {
    if (args[indice] === nome && args[indice + 1]) {
      valores.push(args[indice + 1]!);
      indice += 1;
    }
  }
  return valores;
}

export const OPCOES_COM_VALOR = new Set([
  "--template",
  "--alvo", "-a",
  "--escopo",
  "--saida", "-s",
  "--estrutura",
  "--framework",
  "--namespace",
  "--mudanca",
  "--de",
  "--para",
  "--intencao",
  "--arquivo",
  "--doc-lida",
  "--texto",
  "--texto-arquivo",
  "--operation-code",
  "--project-id",
  "--comando",
  "--maturidade",
  "--preset",
  "--profile",
  "--artefato",
  "--artifact",
  "--artefato-arquivo",
  "--artifact-file",
]);

export const ALIAS_OPCOES: Record<string, string> = {
  "-a": "--alvo",
  "-s": "--saida",
};

export function obterPosicionais(args: string[]): string[] {
  const posicionais: string[] = [];
  for (let indice = 0; indice < args.length; indice += 1) {
    const atual = args[indice]!;
    if (atual.startsWith("-")) {
      if (OPCOES_COM_VALOR.has(atual)) {
        indice += 1;
      }
      continue;
    }
    posicionais.push(atual);
  }
  return posicionais;
}
