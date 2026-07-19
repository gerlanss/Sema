#!/usr/bin/env node
// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
import { principal } from "./index.part08.js";
export * from "./index.part01.js";
export * from "./index.part08.js";
export { iniciarProfileAuthor, comandoAuthor, criarAuthorBriefing, revisarClichesAuthor } from "./profileAuthorCommand.js";
export { validarProfileSemantico } from "./profileCommand.js";
export { materializarExemplosOficiais } from "./exemplosOficiais.js";
export { expandirIntencaoSemanticaProfile, sugerirStarterPresetProfile, validarPipelineProfiles, exigirQaCriativoQuandoPublicavel, catalogoDropdownOnboarding } from "./profileOrquestracao.js";
export * from "./pipelineConteudo/index.js";

principal().catch((erro) => {
  console.error("Falha ao executar a CLI da Sema.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
