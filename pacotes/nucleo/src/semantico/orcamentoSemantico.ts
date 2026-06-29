// SEMA-GOVERNED
// Módulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descrição: valida o orçamento semântico de contratos antes que virem monólitos difíceis para IA.

export const LIMITE_AVISO_LINHAS_ORCAMENTO_SEMANTICO = 300;
export const LIMITE_BLOQUEIO_LINHAS_ORCAMENTO_SEMANTICO = 500;

export type SeveridadeOrcamentoSemantico = "ok" | "aviso" | "erro";

export interface EntradaDiagnosticoContratoMonolitico {
  contrato_alvo?: string;
  linhas?: number;
  tasks?: number;
  entities?: number;
  blocos_operacionais?: number;
}

export interface ResultadoDiagnosticoContratoMonolitico {
  diagnostico_emitido: boolean;
  severidade: SeveridadeOrcamentoSemantico;
  limite_aviso_linhas: number;
  limite_bloqueio_linhas: number;
  precisa_refatorar: boolean;
  contrato_indice_sugerido: boolean;
  mensagem: string;
}

export function classificarLinhasOrcamentoSemantico(linhas: number): SeveridadeOrcamentoSemantico {
  if (linhas > LIMITE_BLOQUEIO_LINHAS_ORCAMENTO_SEMANTICO) {
    return "erro";
  }
  if (linhas > LIMITE_AVISO_LINHAS_ORCAMENTO_SEMANTICO) {
    return "aviso";
  }
  return "ok";
}

function contratoTemNomeArtificial(caminho?: string): boolean {
  const nome = (caminho ?? "contrato").replace(/\\/g, "/").split("/").at(-1)?.replace(/\.sema$/i, "").toLowerCase() ?? "";
  return /(^|[_-])(parte|part|p)[_-]?\d+($|[_-])/.test(nome)
    || /(^|[_-])\d+_de_\d+($|[_-])/.test(nome);
}

export function emitirDiagnosticosContratoMonolitico(
  entrada: EntradaDiagnosticoContratoMonolitico,
): ResultadoDiagnosticoContratoMonolitico {
  const linhas = Number(entrada.linhas ?? 0);
  const tasks = Number(entrada.tasks ?? 0);
  const blocosOperacionais = Number(entrada.blocos_operacionais ?? 0);
  const severidadePorLinhas = classificarLinhasOrcamentoSemantico(linhas);
  const nomeArtificial = contratoTemNomeArtificial(entrada.contrato_alvo);
  const excessoEstrutural = tasks > 10 || blocosOperacionais > 14;
  const severidade: SeveridadeOrcamentoSemantico = severidadePorLinhas === "erro" || excessoEstrutural || nomeArtificial
    ? "erro"
    : severidadePorLinhas;
  const precisaRefatorar = severidade === "erro";
  const diagnosticoEmitido = severidade !== "ok";
  const alvo = entrada.contrato_alvo ?? "contrato";

  return {
    diagnostico_emitido: diagnosticoEmitido,
    severidade,
    limite_aviso_linhas: LIMITE_AVISO_LINHAS_ORCAMENTO_SEMANTICO,
    limite_bloqueio_linhas: LIMITE_BLOQUEIO_LINHAS_ORCAMENTO_SEMANTICO,
    precisa_refatorar: precisaRefatorar,
    contrato_indice_sugerido: precisaRefatorar || tasks > 6 || linhas > LIMITE_AVISO_LINHAS_ORCAMENTO_SEMANTICO,
    mensagem: diagnosticoEmitido
      ? `${alvo} passou do orcamento semantico de .sema; mantenha ate 300 linhas, bloqueie acima de 500, divida por dominio/capacidade e nunca use parte_1/parte_2. Varios contratos podem governar o mesmo arquivo via vinculos.`
      : `${alvo} esta dentro do orcamento semantico.`,
  };
}
