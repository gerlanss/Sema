// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.distribuicao_global, sema.produto.cli_invocacao_publica
// Descrição: superfície de biblioteca da CLI; o executável público vive exclusivamente em bin.ts.
export * from "./index.part01.js";
export * from "./index.part08.js";
export * from "./cliHelp.js";
export { criarAjudaRaiz } from "./cliHelpTexto.js";
export * from "./saidaCli.js";
export { iniciarProfileAuthor, comandoAuthor, criarAuthorBriefing, revisarClichesAuthor } from "./profileAuthorCommand.js";
export { validarProfileSemantico } from "./profileCommand.js";
export { materializarExemplosOficiais } from "./exemplosOficiais.js";
export { expandirIntencaoSemanticaProfile, sugerirStarterPresetProfile, validarPipelineProfiles, exigirQaCriativoQuandoPublicavel, catalogoDropdownOnboarding } from "./profileOrquestracao.js";
export * from "./pipelineConteudo/index.js";
export * from "./sistemasInterativos/index.js";
export * from "./discovery/index.js";
export * from "./distribuicao/index.js";
