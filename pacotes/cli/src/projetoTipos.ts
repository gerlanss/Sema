// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descrição: define os tipos compartilhados do carregamento de projeto Sema.

import type { EngineBanco, ResultadoCompilacaoProjetoModulo } from '@sema/nucleo';
import type { AlvoGeracao, FrameworkGeracao } from '@sema/padroes';
import type { EstruturaSaida, FonteLegado, ModoAdocao } from './tipos.js';

export type EscopoCarregamentoProjeto = "arquivo" | "modulo" | "projeto";

export interface OpcoesCarregarProjeto {
  escopo?: EscopoCarregamentoProjeto;
}

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

export interface ModuloProjetoCarregado {
  caminho: string;
  codigo: string;
  resultado: ResultadoCompilacaoProjetoModulo;
}

export interface ContextoProjetoCarregado {
  entradaResolvida: string;
  baseProjeto: string;
  configCarregada?: ConfiguracaoProjetoCarregada;
  /** Contratos efetivamente lidos e compilados nesta execucao. */
  arquivosProjeto: string[];
  /** Contratos encontrados nas origens, inclusive os que ficaram fora do escopo carregado. */
  arquivosDescobertos: string[];
  origensProjeto: string[];
  diretoriosCodigo: string[];
  fontesLegado: FonteLegado[];
  modoAdocao: ModoAdocao;
  modulosCarregados: ModuloProjetoCarregado[];
  modulosSelecionados: ModuloProjetoCarregado[];
}
