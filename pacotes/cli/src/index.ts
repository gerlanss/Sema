#!/usr/bin/env node
// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { principal } from "./index.part08.js";
export * from "./index.part01.js";
export * from "./index.part08.js";
export { iniciarProfileAuthor, comandoAuthor, criarAuthorBriefing, revisarClichesAuthor } from "./profileAuthorCommand.js";
export { validarProfileSemantico } from "./profileCommand.js";
export { materializarExemplosOficiais } from "./exemplosOficiais.js";
export { expandirIntencaoSemanticaProfile, sugerirStarterPresetProfile, validarPipelineProfiles, exigirQaCriativoQuandoPublicavel, catalogoDropdownOnboarding } from "./profileOrquestracao.js";
export * from "./pipelineConteudo/index.js";
export * from "./sistemasInterativos/index.js";
export * from "./discovery/index.js";

function moduloExecutadoDiretamente(): boolean {
  if (!process.argv[1]) {
    return false;
  }
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
  }
}

if (moduloExecutadoDiretamente()) {
  principal().catch((erro) => {
    console.error("Falha ao executar a CLI da Sema.");
    console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
    process.exit(1);
  });
}
