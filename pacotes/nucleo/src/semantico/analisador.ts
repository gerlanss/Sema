// SEMA-GOVERNED: sema.software
// Descricao: fachada publica particionada; consulte contratos/sema/software.sema antes de editar.
export { SimboloSemantico, CampoSemantico, ErroSemanticoTask, ResumoTaskSemantico, InteropSemantico, ImplementacaoTaskSemantica, ContextoSemantico, ResultadoSemantico, OpcoesAnaliseSemantica } from "./analisador.part01.js";
export { criarContextoLocal, validarTesteSemanticoForte, emitirDiagnosticosContratoFrouxo } from "./analisador.part07.js";
export { listarCandidatosUseRelativo } from "./analisador.part04.js";
export { analisarSemantica } from "./analisador.part08.js";
