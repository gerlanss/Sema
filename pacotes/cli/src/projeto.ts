// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descrição: reexporta a API p?blica de carregamento de projeto a partir de m?dulos pequenos por responsabilidade.

export type {
  ConfiguracaoPersistenciaProjeto,
  ConfiguracaoProjetoCarregada,
  ContextoProjetoCarregado,
  SemaConfigProjeto,
} from './projetoTipos.js';
export {
  carregarConfiguracaoProjeto,
  localizarConfiguracaoProjeto,
  normalizarEstruturaSaida,
  normalizarFrameworkGeracao,
} from './projetoConfig.js';
export { carregarProjeto } from './projetoCarregar.js';
export {
  resolverAlvoPadrao,
  resolverAlvosVerificacao,
  resolverEstruturaSaidaPadrao,
  resolverFrameworkPadrao,
  resolverSaidaPadrao,
} from './projetoResolucao.js';
