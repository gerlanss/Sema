// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: detec??o localizada de presen?a positiva em artefatos avaliados por profile.

import type {
  AchadoProfile,
  CapabilityProfile,
  ConfidenceEngineProfile,
  ConfiancaValidacaoProfile,
  DecisaoAgenteProfile,
  FonteAchadoProfile,
  MaturidadeProfile,
  OpcoesProfileValidar,
  PerfilSemantico,
  PresetProfile,
  ProfileGovernanca,
  RequisitoProfile,
  ResultadoProfileValidar,
  RulePackSema,
  RuntimeGateProfile,
  SeveridadeProfile,
} from "./profileAuthorTipos.js";
import { criarAchadoArtefatoProfile } from "./profileRegras.js";

export interface PresencaArtefatoProfile {
  atendido: boolean;
  trecho?: string;
  linha?: number;
  coluna?: number;
  inicio?: number;
  fim?: number;
  motivo?: string;
}

export function regexGlobalProfile(regex: RegExp): RegExp {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  return new RegExp(regex.source, flags);
}

export function trechoDoMatchProfile(texto: string, indice: number, tamanho: number): string {
  const inicio = Math.max(0, indice - 60);
  const fim = Math.min(texto.length, indice + tamanho + 60);
  return texto.slice(inicio, fim).replace(/\s+/g, " ").trim();
}

export function localizacaoDoMatchProfile(texto: string, indice: number, tamanho: number): Omit<PresencaArtefatoProfile, "atendido" | "motivo"> {
  const antes = texto.slice(0, indice);
  const linhas = antes.split(/\r?\n/);
  return {
    trecho: trechoDoMatchProfile(texto, indice, tamanho),
    linha: linhas.length,
    coluna: (linhas.at(-1) ?? "").length + 1,
    inicio: indice,
    fim: indice + tamanho,
  };
}

export function localizarRegexProfile(texto: string, regex: RegExp): Omit<PresencaArtefatoProfile, "atendido" | "motivo"> | undefined {
  const flags = regex.flags.replace(/g/g, "");
  const busca = new RegExp(regex.source, flags);
  const match = busca.exec(texto);
  if (!match) return undefined;
  return localizacaoDoMatchProfile(texto, match.index, match[0].length);
}

export function termoNegadoNoArtefato(texto: string, indice: number, tamanho: number): boolean {
  const antes = texto.slice(Math.max(0, indice - 90), indice);
  const depois = texto.slice(indice + tamanho, Math.min(texto.length, indice + tamanho + 90));
  const negacaoAntes = /\b(?:sem|ausente|ausencia|ausÃªncia|faltando|falta|faltam|inexistente|indefinid[ao]s?|pendente|nao\s+(?:ha|hÃ¡|define|declara|especifica|possui|tem|existe|inclui|contem|contÃ©m|configura|implementa|mapeia|separa|informa|descreve|testa|valida)|nÃ£o\s+(?:ha|hÃ¡|define|declara|especifica|possui|tem|existe|inclui|contem|contÃ©m|configura|implementa|mapeia|separa|informa|descreve|testa|valida))\b[\s\S]{0,80}$/i;
  const negacaoDepois = /^[\s\S]{0,80}\b(?:ausente|ausentes|ausencia|ausÃªncia|inexistente|indefinid[ao]s?|faltando|pendente|nao\s+(?:definid[ao]|declarad[ao]|especificad[ao]|testad[ao]|valid[ao]|implementad[ao]|configurad[ao]|mapead[ao])|nÃ£o\s+(?:definid[ao]|declarad[ao]|especificad[ao]|testad[ao]|valid[ao]|implementad[ao]|configurad[ao]|mapead[ao]))\b/i;
  return negacaoAntes.test(antes) || negacaoDepois.test(depois);
}

export function avaliarPresencaPositivaArtefato(texto: string, regex: RegExp): PresencaArtefatoProfile {
  const busca = regexGlobalProfile(regex);
  let primeiroNegado: { indice: number; tamanho: number } | null = null;
  let match: RegExpExecArray | null;
  let iteracoes = 0;

  while ((match = busca.exec(texto)) && iteracoes < 80) {
    iteracoes += 1;
    if (match[0].length === 0) busca.lastIndex += 1;

    if (!termoNegadoNoArtefato(texto, match.index, match[0].length)) {
      return { atendido: true };
    }
    primeiroNegado ??= { indice: match.index, tamanho: match[0].length };
  }

  if (primeiroNegado) {
    return {
      atendido: false,
      ...localizacaoDoMatchProfile(texto, primeiroNegado.indice, primeiroNegado.tamanho),
      motivo: "termo encontrado em contexto de negacao/ausencia; mencao negativa nao satisfaz requisito.",
    };
  }

  return { atendido: false };
}

export function validarTermosObrigatoriosArtefato(
  texto: string,
  checks: Array<{ id: string; descricao: string; regex: RegExp; severidade?: SeveridadeProfile; sugestao: string }>,
): AchadoProfile[] {
  return checks.map((check) => {
    const presenca = avaliarPresencaPositivaArtefato(texto, check.regex);
    return criarAchadoArtefatoProfile(
      check.id,
      check.descricao,
      presenca.atendido,
      check.severidade ?? "blocking",
      presenca.trecho,
      check.sugestao,
      presenca.motivo,
      {
        linha: presenca.linha,
        coluna: presenca.coluna,
        inicio: presenca.inicio,
        fim: presenca.fim,
        regra: check.id,
      },
    );
  });
}

export function artefatoPareceWebhookProfile(artefato: string, preset: PresetProfile | null): boolean {
  return preset === "webhook" || /webhook|externalEventId|invoiceId|paidAt|paymentEvent|pagamento/i.test(artefato);
}

export function artefatoParecePagamentoWebhookProfile(artefato: string): boolean {
  return /invoiceId|fatura|cobranc|paymentEvent|paidAt|pagamento/i.test(artefato) &&
    /webhook|externalEventId|evento externo|evento de pagamento/i.test(artefato);
}

export function artefatoPareceMultiTenantProfile(contrato: string, artefato: string): boolean {
  return /workspace|tenant|multi[- ]?tenant|multi[- ]?workspace|organiz/i.test(`${contrato}\n${artefato}`);
}

export function presencaAutenticacaoWebhookProfile(artefato: string): PresencaArtefatoProfile {
  return avaliarPresencaPositivaArtefato(artefato, /authorization|bearer|webhookSecret|webhook_secret|secret|assinatura|signature|hmac|x-webhook-secret|api[-_ ]?key|token/i);
}

export function presencaWorkspaceWebhookProfile(artefato: string): PresencaArtefatoProfile {
  return avaliarPresencaPositivaArtefato(artefato, /workspace(?:Id|Slug)?|workspace_id|workspace_slug|tenant(?:Id)?|tenant_id|organizationId|orgId|accountId|x-workspace(?:-slug|-id)?|isolamento por workspace/i);
}

export function presencaIdempotenciaWorkspaceScopedProfile(artefato: string): PresencaArtefatoProfile {
  const workspace = presencaWorkspaceWebhookProfile(artefato);
  if (!workspace.atendido) {
    return {
      atendido: false,
      trecho: workspace.trecho,
      linha: workspace.linha,
      coluna: workspace.coluna,
      inicio: workspace.inicio,
      fim: workspace.fim,
      motivo: workspace.motivo ?? "idempotencia com externalEventId precisa de workspace/tenant positivo no mesmo artefato.",
    };
  }
  const regexes = [
    /@@unique\s*\(\s*\[[^\]]*(?:workspaceId|workspace_id|workspace|tenantId|tenant_id|tenant|organizationId|orgId|accountId)[^\]]*externalEventId[^\]]*\]\s*\)/i,
    /@@unique\s*\(\s*\[[^\]]*externalEventId[^\]]*(?:workspaceId|workspace_id|workspace|tenantId|tenant_id|tenant|organizationId|orgId|accountId)[^\]]*\]\s*\)/i,
    /(?:workspace|tenant|organization|orgId|accountId|x-workspace)[\s\S]{0,180}externalEventId/i,
    /externalEventId[\s\S]{0,180}(?:workspace|tenant|organization|orgId|accountId|x-workspace)/i,
  ];
  for (const regex of regexes) {
    const presenca = avaliarPresencaPositivaArtefato(artefato, regex);
    if (presenca.atendido) return presenca;
  }
  const negada = regexes
    .map((regex) => avaliarPresencaPositivaArtefato(artefato, regex))
    .find((presenca) => presenca.trecho);
  return negada ?? { atendido: false };
}

export function localizarIdempotenciaGlobalExternalEventProfile(artefato: string): Omit<PresencaArtefatoProfile, "atendido" | "motivo"> | undefined {
  return localizarRegexProfile(artefato, /\bexternalEventId\b[^\n\r;{}]*@unique/i) ??
    localizarRegexProfile(artefato, /@@unique\s*\(\s*\[\s*externalEventId\s*\]\s*\)/i) ??
    localizarRegexProfile(artefato, /externalEventId[\s\S]{0,120}global/i) ??
    localizarRegexProfile(artefato, /global[\s\S]{0,120}externalEventId/i) ??
    localizarRegexProfile(artefato, /externalEventId[\s\S]{0,120}(?:unico global|globalmente|global unique|unique global)/i) ??
    localizarRegexProfile(artefato, /(?:unico global|globalmente|global unique|unique global)[\s\S]{0,120}externalEventId/i);
}
