// SEMA-GOVERNED: sema.produto.cli_melhoria_erros
// Descricao: snippets estruturados para corrigir erros semanticos SEM0xx; consulte contratos/sema/cli_melhoria_erros.sema antes de editar.

export interface SnippetCorrecao {
  snippet: string;
  linhas_adicionais: number;
  campos_necessarios: string[];
}

const SNIPPETS_POR_BLOCO: Record<string, string[]> = {
  auth: ["modo"],
  authz: ["escopo"],
  dados: ["classificacao_padrao", "input", "output"],
  audit: ["evento", "ator", "correlacao", "retencao", "motivo"],
  impl: ["ts"],
  vinculos: ["arquivo", "simbolo"],
  execucao: ["idempotencia", "timeout", "criticidade_operacional"],
};

function renderizarBloco(tipoBlocoFaltante: string): string {
  switch (tipoBlocoFaltante) {
    case "auth":
      return "auth {\n  modo: obrigatorio\n}";
    case "authz":
      return "authz {\n  escopo: sema.acao.executar\n  tenant: opcional\n}";
    case "dados":
      return "dados {\n  classificacao_padrao: interno\n  redacao_log: parcial\n}";
    case "audit":
      return "audit {\n  evento: sema.acao.executada\n  ator: auth.agente\n  correlacao: request_id\n  retencao: \"30d\"\n  motivo: obrigatorio\n}";
    case "impl":
      return "impl {\n  ts: pacote.src.modulo.funcao\n}";
    case "vinculos":
      return "vinculos {\n  arquivo: \"src/modulo.ts\"\n  simbolo: pacote.src.modulo.funcao\n}";
    case "execucao":
      return "execucao {\n  idempotencia: verdadeiro\n  timeout: \"30s\"\n  criticidade_operacional: media\n}";
    default:
      return "// Bloco nao suportado para snippet automatico.";
  }
}

export function gerarSnippetCorrecao(codigoErro: string, tipoBlocoFaltante: string): SnippetCorrecao {
  const snippet = renderizarBloco(tipoBlocoFaltante);
  return {
    snippet,
    linhas_adicionais: snippet.split("\n").length,
    campos_necessarios: SNIPPETS_POR_BLOCO[tipoBlocoFaltante] ?? [codigoErro],
  };
}
