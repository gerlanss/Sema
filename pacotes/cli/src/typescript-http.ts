// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fachada de extracao HTTP TypeScript; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

export type {
  CampoInferidoTypeScriptHttp,
  ExportacaoTypeScriptHttp,
  ParametroRotaTypeScript,
  RotaTypeScriptExtraida,
  SemanticaHandlerTypeScriptHttp,
} from "./typescript-http-modelos.js";
export { extrairRotasExpressFastify, extrairRotasTypeScriptHttp } from "./typescript-http-rotas.js";
export {
  inferirSemanticaHandlerTypeScriptHttp,
  localizarExportacaoTypeScriptHttp,
} from "./typescript-http-semantica.js";
