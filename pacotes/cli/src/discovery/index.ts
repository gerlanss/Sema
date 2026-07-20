// SEMA-GOVERNED: sema.produto.descoberta_capacidades
// Descrição: superfície única dos módulos puros e handlers de descoberta.

export {
  criarResumoDescobertaAgentContext,
  montarCatalogoCapacidades,
  normalizarDiscoveryKind,
  obterEntradaDescoberta,
} from "./catalog.js";
export {
  comandoCapabilitiesDescobertaHandler,
  comandoDescobertaCapacidades,
  comandoDescobrirHandler,
  comandoPipelineDescobertaHandler,
  REGISTRO_HANDLERS_DESCOBERTA,
  type DiscoveryCliHandler,
} from "./command.js";
export {
  normalizarIntencaoDescoberta,
  recomendarCapacidadePorIntencao,
} from "./ranker.js";
export { renderizarResultadoDescoberta } from "./render.js";
export * from "./types.js";
