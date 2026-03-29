export type SeveridadeDiagnostico = "erro" | "aviso" | "informacao";

export interface PosicaoFonte {
  indice: number;
  linha: number;
  coluna: number;
}

export interface IntervaloFonte {
  inicio: PosicaoFonte;
  fim: PosicaoFonte;
  arquivo?: string;
}

export interface Diagnostico {
  codigo: string;
  mensagem: string;
  severidade: SeveridadeDiagnostico;
  intervalo?: IntervaloFonte;
  dica?: string;
  contexto?: string;
}

export function formatarDiagnostico(diagnostico: Diagnostico): string {
  const local = diagnostico.intervalo
    ? `${diagnostico.intervalo.arquivo ?? "arquivo"}:${diagnostico.intervalo.inicio.linha}:${diagnostico.intervalo.inicio.coluna}`
    : "local desconhecido";
  const dica = diagnostico.dica ? `\nDica: ${diagnostico.dica}` : "";
  const contexto = diagnostico.contexto ? `\nContexto: ${diagnostico.contexto}` : "";
  return `[${diagnostico.severidade.toUpperCase()} ${diagnostico.codigo}] ${diagnostico.mensagem} (${local})${dica}${contexto}`;
}

export function criarDiagnostico(
  codigo: string,
  mensagem: string,
  severidade: SeveridadeDiagnostico,
  intervalo?: IntervaloFonte,
  dica?: string,
  contexto?: string,
): Diagnostico {
  return { codigo, mensagem, severidade, intervalo, dica, contexto };
}

