// SEMA-GOVERNED: sema.produto.pipeline_conteudo.estado
// Descricao: projecao regeneravel e explicitamente nao autoritativa do ledger canonico de conteudo.

import { hashCanonicoConteudo } from "./canonical.js";
import { validarLedgerConteudo } from "./ledger.js";
import { derivarEstadoPipelineConteudo } from "./state.js";
import type {
  ConfiguracaoConfiancaConteudo,
  DefinicaoPipelineConteudo,
  EnvelopeAssinadoConteudo,
  EventoLedgerConteudo,
  EventoPayloadConteudo,
  PoliticaConfiancaConteudo,
  ProjecaoPipelineConteudo,
} from "./types.js";

export interface EntradaProjetarManifestoPipelineConteudo {
  readonly eventos: readonly EventoLedgerConteudo<EventoPayloadConteudo>[];
  readonly envelopePolitica: EnvelopeAssinadoConteudo<PoliticaConfiancaConteudo>;
  readonly definicao: DefinicaoPipelineConteudo;
  readonly configuracaoConfianca: ConfiguracaoConfiancaConteudo;
  readonly trustRootDigestEsperado: string;
  readonly revocationDigestEsperado: string;
  readonly expectedHead: string;
  readonly generatedAt?: string | Date;
}

function instanteIso(valor: string | Date | undefined): string {
  const data = valor instanceof Date ? valor : new Date(valor ?? Date.now());
  if (!Number.isFinite(data.getTime())) throw new TypeError("generated_at_invalido");
  return data.toISOString();
}

/**
 * Gera uma leitura descartavel. Nao recebe manifesto anterior e, portanto,
 * campos editados manualmente (inclusive `concluido`) nunca voltam ao estado.
 */
export function projetarManifestoPipelineConteudo(
  entrada: EntradaProjetarManifestoPipelineConteudo,
): ProjecaoPipelineConteudo {
  const politica = entrada.envelopePolitica.payload;
  const validacao = validarLedgerConteudo({
    eventos: entrada.eventos,
    envelopePolitica: entrada.envelopePolitica,
    ledgerId: politica.ledgerId,
    expectedHead: entrada.expectedHead,
    principals: entrada.configuracaoConfianca.principals,
    trustRootDigestEsperado: entrada.trustRootDigestEsperado,
    revocationDigestEsperado: entrada.revocationDigestEsperado,
    configuracaoConfianca: entrada.configuracaoConfianca,
    contextoEsperado: {
      runId: politica.runId,
      trustDomainId: politica.trustDomainId,
      trustRootDigest: entrada.trustRootDigestEsperado,
      ledgerId: politica.ledgerId,
      policyDigest: hashCanonicoConteudo(politica),
      definitionDigest: politica.definitionDigest,
    },
  });
  if (!validacao.valido) {
    throw new Error(`ledger_invalido:${validacao.bloqueios.join(",")}`);
  }

  const estado = derivarEstadoPipelineConteudo(entrada);
  if (!estado.valido) {
    throw new Error(`estado_canonico_indisponivel:${estado.nextActions.join(",")}`);
  }
  const inicio = entrada.eventos.find(
    (evento) => evento.envelope.payload.kind === "RUN_STARTED" && evento.envelope.payload.runId === estado.runId,
  );
  const targets = inicio?.envelope.payload.kind === "RUN_STARTED" ? inicio.envelope.payload.targets : [];
  return {
    authoritative: false,
    ledgerId: politica.ledgerId,
    ledgerHead: validacao.head,
    runId: estado.runId,
    generatedAt: instanteIso(entrada.generatedAt),
    gates: estado.estadosGate,
    targets: [...targets],
    artifacts: [...estado.artifactsAceitos],
    nextActions: estado.nextActions,
  };
}
