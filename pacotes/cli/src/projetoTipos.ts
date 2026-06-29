// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descrição: define os tipos compartilhados do carregamento de projeto Sema.

import type { EngineBanco, ResultadoCompilacaoProjetoModulo } from '@sema/nucleo';
import type { AlvoGeracao, FrameworkGeracao } from '@sema/padroes';
import type { EstruturaSaida, FonteLegado, ModoAdocao } from './tipos.js';

export interface ConfiguracaoPersistenciaProjeto {
  enginesHabilitados?: EngineBanco[];
  adaptersPorEngine?: Partial<Record<EngineBanco, string>>;
}

export interface SemaConfigProjeto {
  origem?: string;
  origens?: string[];
  saida?: string;
  alvos?: AlvoGeracao[];
  alvoPadrao?: AlvoGeracao;
  modoEstrito?: boolean;
  estruturaSaida?: EstruturaSaida;
  framework?: FrameworkGeracao;
  diretoriosSaidaPorAlvo?: Partial<Record<AlvoGeracao, string>>;
  convencoesGeracaoPorProjeto?: "base" | "backend";
  diretoriosCodigo?: string[];
  fontesLegado?: FonteLegado[];
  modoAdocao?: ModoAdocao;
  persistencia?: ConfiguracaoPersistenciaProjeto;
  pontuacaoSemanticaMinimaOperacional?: number;
  pontuacaoSemanticaAlvo?: number;
  pontuacaoSemanticaAlvoFinal?: number;
  pontuacaoSemanticaPasso?: number;
}

export interface ConfiguracaoProjetoCarregada {
  caminho: string;
  baseDiretorio: string;
  config: SemaConfigProjeto;
}

export interface ContextoProjetoCarregado {
  entradaResolvida: string;
  baseProjeto: string;
  configCarregada?: ConfiguracaoProjetoCarregada;
  arquivosProjeto: string[];
  origensProjeto: string[];
  diretoriosCodigo: string[];
  fontesLegado: FonteLegado[];
  modoAdocao: ModoAdocao;
  modulosSelecionados: Array<{
    caminho: string;
    codigo: string;
    resultado: ResultadoCompilacaoProjetoModulo;
  }>;
}
