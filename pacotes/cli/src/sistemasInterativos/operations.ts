// SEMA-GOVERNED: sema.produto.sistemas_interativos.operacao
// Descricao: fachada publica estavel para validadores e planejadores operacionais puros.

export {
  criarReferenciaFonteOpaca,
  digestJsonOperacional,
} from "./operationPrimitives.js";
export {
  derivarDiffSnapshotsEngine,
  validarEstadoEditor,
  validarProvenienciaAsset,
  validarSnapshotEngine,
} from "./engineObservation.js";
export { planejarOrquestracaoJobs } from "./jobOrchestration.js";
export {
  digestVinculoClaimMultimodal,
  operarAcceptanceLock,
  validarAcceptanceLock,
  validarEvidenciaMultimodal,
} from "./acceptanceEvidence.js";
export * from "./operationsTypes.js";
