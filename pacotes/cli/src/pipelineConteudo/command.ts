// SEMA-GOVERNED: sema.produto.pipeline_conteudo.cli, sema.produto.cli_invocacao_publica
// Descrição: CLI declarativa do pipeline de conteúdo; não executa agentes, ferramentas ou publicação.

import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { criarAjudaPipelineConteudo } from "./help.js";
export { criarAjudaPipelineConteudo } from "./help.js";
import {
  digestEnvelopeConteudo,
  hashCanonicoConteudo,
} from "./canonical.js";
import {
  CAPABILITIES_CONTEUDO_PADRAO,
} from "./adapters.js";
import {
  anexarEventoLedgerConteudo,
  HEAD_GENESIS_LEDGER_CONTEUDO,
  validarLedgerConteudo,
  validarPayloadEventoConteudo,
} from "./ledger.js";
import {
  planejarPipelineConteudo,
  validarDefinicaoPipelineConteudo,
} from "./planner.js";
import { projetarManifestoPipelineConteudo } from "./projection.js";
import { derivarEstadoPipelineConteudo } from "./state.js";
import {
  validarConfiguracaoConfiancaConteudo,
  verificarEnvelopeAssinadoConteudo,
} from "./trust.js";
import type {
  ConfiguracaoConfiancaConteudo,
  DefinicaoPipelineConteudo,
  EnvelopeAssinadoConteudo,
  EventoLedgerConteudo,
  EventoPayloadConteudo,
  PoliticaConfiancaConteudo,
} from "./types.js";

const OPCOES_COM_VALOR_CONTEUDO = new Set([
  "--alvos-arquivo",
  "--envelope-arquivo",
  "--confianca-arquivo",
  "--payload-type",
  "--capability",
  "--scope",
  "--ledger-id",
  "--expected-head",
  "--politica-arquivo",
  "--ledger-arquivo",
  "--saida",
  "--trust-root-digest",
  "--revocation-digest",
]);

const SUBCOMANDOS_CONTEUDO = new Set([
  "ajuda",
  "capabilities",
  "validar",
  "planejar",
  "validar-envelope",
  "registrar",
  "status",
  "projetar",
]);

const CAUSAS_PUBLICAS_CONTEUDO = [
  "expected_head_divergente",
  "trust_root_digest_divergente",
  "revocation_digest_divergente",
  "envelope_politica_ausente",
  "politica_contexto_divergente",
  "politica_expirada",
] as const;

interface FalhaComandoConteudo {
  readonly sucesso: false;
  readonly comando: string;
  readonly erro: string;
}

function obterOpcaoConteudo(args: readonly string[], nome: string): string | undefined {
  const indice = args.indexOf(nome);
  if (indice < 0) return undefined;
  const valor = args[indice + 1];
  if (valor === undefined || valor.startsWith("--")) {
    throw new Error(`opcao_sem_valor:${nome}`);
  }
  return valor;
}

function posicionaisConteudo(args: readonly string[]): string[] {
  const resultado: string[] = [];
  for (let indice = 0; indice < args.length; indice += 1) {
    const atual = args[indice]!;
    if (atual.startsWith("-")) {
      if (OPCOES_COM_VALOR_CONTEUDO.has(atual)) indice += 1;
      continue;
    }
    resultado.push(atual);
  }
  return resultado;
}

async function lerJson<T>(arquivo: string): Promise<T> {
  try {
    return JSON.parse(await readFile(path.resolve(arquivo), "utf8")) as T;
  } catch {
    throw new Error("json_invalido");
  }
}

async function lerTextoOpcional(arquivo: string): Promise<string> {
  try {
    return await readFile(path.resolve(arquivo), "utf8");
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw erro;
  }
}

function parsearLedgerNdjson(texto: string): EventoLedgerConteudo<EventoPayloadConteudo>[] {
  if (texto.trim().length === 0) return [];
  return texto
    .split(/\r?\n/u)
    .filter((linha) => linha.trim().length > 0)
    .map((linha, indice) => {
      try {
        return JSON.parse(linha) as EventoLedgerConteudo<EventoPayloadConteudo>;
      } catch {
        throw new Error(`ledger_ndjson_invalido:linha_${indice + 1}`);
      }
    });
}

function imprimirConteudo(payload: unknown, emJson: boolean): void {
  if (emJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (typeof payload === "object" && payload !== null && "mensagem" in payload) {
    console.log(String((payload as { mensagem: unknown }).mensagem));
    return;
  }
  console.log(JSON.stringify(payload, null, 2));
}

function codigoErroPublicoConteudo(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : "";
  for (const causa of CAUSAS_PUBLICAS_CONTEUDO) {
    if (mensagem === causa || mensagem.includes(`:${causa}`) || mensagem.includes(`,${causa}`)) return causa;
  }
  return /^([a-z][a-z0-9_]{2,})/u.exec(mensagem)?.[1] ?? "falha_operacional";
}

function exigir(valor: string | undefined, nome: string): string {
  if (valor === undefined || valor.trim().length === 0) throw new Error(`argumento_obrigatorio_ausente:${nome}`);
  return valor;
}

function trustRootDigestEsperado(args: readonly string[]): string {
  const porFlag = obterOpcaoConteudo(args, "--trust-root-digest");
  const porAmbiente = process.env.SEMA_CONTENT_TRUST_ROOT_DIGEST;
  if (porFlag !== undefined && porAmbiente !== undefined && porFlag !== porAmbiente) {
    throw new Error("trust_root_digest_fontes_divergentes");
  }
  return exigir(porFlag ?? porAmbiente, "--trust-root-digest|SEMA_CONTENT_TRUST_ROOT_DIGEST");
}

function revocationDigestEsperado(args: readonly string[]): string {
  const porFlag = obterOpcaoConteudo(args, "--revocation-digest");
  const porAmbiente = process.env.SEMA_CONTENT_REVOCATION_DIGEST;
  if (porFlag !== undefined && porAmbiente !== undefined && porFlag !== porAmbiente) {
    throw new Error("revocation_digest_fontes_divergentes");
  }
  return exigir(porFlag ?? porAmbiente, "--revocation-digest|SEMA_CONTENT_REVOCATION_DIGEST");
}

function raizWorkspaceAtual(): string {
  let atual = realpathSync(path.resolve(process.cwd()));
  while (true) {
    if (existsSync(path.join(atual, ".git"))) return atual;
    const pai = path.dirname(atual);
    if (pai === atual) return realpathSync(path.resolve(process.cwd()));
    atual = pai;
  }
}

function caminhoEstaNoWorkspace(arquivo: string): boolean {
  const raiz = raizWorkspaceAtual();
  const caminhoReal = realpathSync(path.resolve(arquivo));
  const relativo = path.relative(raiz, caminhoReal);
  return relativo === "" || (!relativo.startsWith(`..${path.sep}`) && relativo !== ".." && !path.isAbsolute(relativo));
}

function validarRaizConfiancaDaCli(
  confianca: ConfiguracaoConfiancaConteudo,
  confiancaArquivo: string,
  args: readonly string[],
): { readonly trustRootDigest: string; readonly revocationDigest: string } {
  if (caminhoEstaNoWorkspace(confiancaArquivo) && !args.includes("--development-local-trust")) {
    throw new Error("trust_root_local_requer_development_local_trust");
  }
  const resultado = validarConfiguracaoConfiancaConteudo(
    confianca,
    trustRootDigestEsperado(args),
    revocationDigestEsperado(args),
  );
  if (!resultado.valida) throw new Error(`raiz_confianca_invalida:${resultado.bloqueios.join(",")}`);
  return { trustRootDigest: resultado.trustRootDigest, revocationDigest: resultado.revocationDigest };
}

function payloadTypeEsperado(payload: EventoPayloadConteudo): string {
  return payload.kind === "EVIDENCE_CLAIMED" ? "CLAIM_SUBMITTED" : payload.kind;
}

function papeisPermitidos(payload: EventoPayloadConteudo): readonly string[] {
  switch (payload.kind) {
    case "RUN_STARTED": return ["PIPELINE_CONTROLLER"];
    case "ARTIFACT_REGISTERED": return ["PRODUCER"];
    case "EVIDENCE_CLAIMED": return ["PRODUCER", "RUNNER", "ADAPTER"];
    case "EVIDENCE_ATTESTED": return ["EVIDENCE_ATTESTER", "ADAPTER"];
    case "AI_ASSESSMENT": return ["EVALUATOR"];
    case "OPERATIONAL_CONDITION": return ["RUNNER", "ADAPTER"];
  }
}

async function carregarContextoEstado(
  definicaoArquivo: string,
  args: readonly string[],
): Promise<{
  definicao: DefinicaoPipelineConteudo;
  politica: PoliticaConfiancaConteudo;
  envelopePolitica: EnvelopeAssinadoConteudo<PoliticaConfiancaConteudo>;
  confianca: ConfiguracaoConfiancaConteudo;
  eventos: EventoLedgerConteudo<EventoPayloadConteudo>[];
  expectedHead: string;
  definitionDigest: string;
  policyEnvelopeDigest: string;
  trustRootDigest: string;
  revocationDigest: string;
}> {
  const politicaArquivo = exigir(obterOpcaoConteudo(args, "--politica-arquivo"), "--politica-arquivo");
  const confiancaArquivo = exigir(obterOpcaoConteudo(args, "--confianca-arquivo"), "--confianca-arquivo");
  const ledgerArquivo = exigir(obterOpcaoConteudo(args, "--ledger-arquivo"), "--ledger-arquivo");
  const [definicao, envelopePolitica, confianca, ledgerTexto] = await Promise.all([
    lerJson<DefinicaoPipelineConteudo>(definicaoArquivo),
    lerJson<EnvelopeAssinadoConteudo<PoliticaConfiancaConteudo>>(politicaArquivo),
    lerJson<ConfiguracaoConfiancaConteudo>(confiancaArquivo),
    lerTextoOpcional(ledgerArquivo),
  ]);

  const validacaoDefinicao = validarDefinicaoPipelineConteudo(definicao);
  if (!validacaoDefinicao.valida) {
    throw new Error(`definicao_invalida:${validacaoDefinicao.bloqueios.join(",")}`);
  }
  const { trustRootDigest, revocationDigest } = validarRaizConfiancaDaCli(confianca, confiancaArquivo, args);
  const verificacaoPolitica = verificarEnvelopeAssinadoConteudo(
    envelopePolitica,
    confianca,
    {
      trustRootDigestEsperado: trustRootDigest,
      revocationDigestEsperado: revocationDigest,
      payloadTypeEsperado: "TRUST_POLICY",
      papeisPermitidos: ["POLICY_AUTHORITY"],
      agora: envelopePolitica.payload.issuedAt,
    },
  );
  if (!verificacaoPolitica.valido) {
    throw new Error(`politica_nao_confiavel:${verificacaoPolitica.bloqueios.join(",")}`);
  }
  const politica = envelopePolitica.payload;
  if (politica.definitionDigest !== validacaoDefinicao.definitionDigest) {
    throw new Error("politica_definition_digest_divergente");
  }
  if (politica.trustDomainId !== confianca.trustDomainId) {
    throw new Error("politica_trust_domain_divergente");
  }
  if (typeof politica.runId !== "string" || politica.runId.trim().length === 0) {
    throw new Error("politica_run_id_invalido");
  }
  if (
    !Number.isFinite(Date.parse(politica.issuedAt)) ||
    !Number.isFinite(Date.parse(politica.expiresAt)) ||
    Date.parse(politica.expiresAt) <= Date.parse(politica.issuedAt) ||
    envelopePolitica.issuedAt !== politica.issuedAt
  ) {
    throw new Error("politica_janela_temporal_invalida");
  }
  if (politica.trustRootDigest !== trustRootDigest) {
    throw new Error("politica_trust_root_digest_divergente");
  }
  if (politica.ledgerId.trim().length === 0) throw new Error("politica_ledger_id_ausente");
  if (!/^sha256:[a-f0-9]{64}$/u.test(politica.targetSetDigest)) {
    throw new Error("politica_target_set_digest_invalido");
  }
  if (hashCanonicoConteudo(politica.gates) !== hashCanonicoConteudo(definicao.gates)) {
    throw new Error("politica_gates_divergentes_da_definicao");
  }

  return {
    definicao,
    politica,
    envelopePolitica,
    confianca,
    eventos: parsearLedgerNdjson(ledgerTexto),
    expectedHead: exigir(obterOpcaoConteudo(args, "--expected-head"), "--expected-head"),
    definitionDigest: validacaoDefinicao.definitionDigest,
    policyEnvelopeDigest: digestEnvelopeConteudo(envelopePolitica),
    trustRootDigest,
    revocationDigest,
  };
}

async function registrarEnvelopeLocal(args: readonly string[], ledgerArquivo: string): Promise<unknown> {
  const envelopeArquivo = exigir(obterOpcaoConteudo(args, "--envelope-arquivo"), "--envelope-arquivo");
  const confiancaArquivo = exigir(obterOpcaoConteudo(args, "--confianca-arquivo"), "--confianca-arquivo");
  const politicaArquivo = exigir(obterOpcaoConteudo(args, "--politica-arquivo"), "--politica-arquivo");
  const ledgerId = exigir(obterOpcaoConteudo(args, "--ledger-id"), "--ledger-id");
  const expectedHead = exigir(obterOpcaoConteudo(args, "--expected-head"), "--expected-head");
  const [envelope, envelopePolitica, confianca, ledgerAntes] = await Promise.all([
    lerJson<EnvelopeAssinadoConteudo<EventoPayloadConteudo>>(envelopeArquivo),
    lerJson<EnvelopeAssinadoConteudo<PoliticaConfiancaConteudo>>(politicaArquivo),
    lerJson<ConfiguracaoConfiancaConteudo>(confiancaArquivo),
    lerTextoOpcional(ledgerArquivo),
  ]);
  const { trustRootDigest, revocationDigest } = validarRaizConfiancaDaCli(confianca, confiancaArquivo, args);
  const politica = envelopePolitica.payload;
  const verificacaoPolitica = verificarEnvelopeAssinadoConteudo(envelopePolitica, confianca, {
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: revocationDigest,
    payloadTypeEsperado: "TRUST_POLICY",
    papelRequerido: "POLICY_AUTHORITY",
    agora: politica.issuedAt,
  });
  if (!verificacaoPolitica.valido) {
    throw new Error(`politica_nao_confiavel:${verificacaoPolitica.bloqueios.join(",")}`);
  }
  const policyDigest = hashCanonicoConteudo(politica);
  const contextoEsperado = {
    runId: politica.runId,
    trustDomainId: politica.trustDomainId,
    trustRootDigest: politica.trustRootDigest,
    ledgerId: politica.ledgerId,
    policyDigest,
    definitionDigest: politica.definitionDigest,
  };
  if (
    politica.trustDomainId !== confianca.trustDomainId ||
    politica.trustRootDigest !== trustRootDigest ||
    politica.ledgerId !== ledgerId ||
    envelope.payload.runId !== politica.runId ||
    envelope.payload.policyDigest !== policyDigest ||
    envelope.payload.definitionDigest !== politica.definitionDigest
  ) {
    throw new Error("politica_contexto_divergente");
  }
  const validacaoPayload = validarPayloadEventoConteudo(envelope.payload, {
    principalId: envelope.principalId,
  });
  if (!validacaoPayload.valido) {
    throw new Error(`payload_evento_invalido:${validacaoPayload.bloqueios.join(",")}`);
  }
  if (envelope.payload.trustRootDigest !== trustRootDigest) {
    throw new Error("payload_trust_root_digest_divergente");
  }
  const verificacao = verificarEnvelopeAssinadoConteudo(envelope, confianca, {
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: revocationDigest,
    payloadTypeEsperado: payloadTypeEsperado(envelope.payload),
    papeisPermitidos: papeisPermitidos(envelope.payload),
  });
  if (!verificacao.valido) throw new Error(`envelope_nao_confiavel:${verificacao.bloqueios.join(",")}`);

  const eventos = parsearLedgerNdjson(ledgerAntes);
  const validacaoAtual = validarLedgerConteudo({
    eventos,
    envelopePolitica,
    ledgerId,
    expectedHead,
    principals: confianca.principals,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: revocationDigest,
    configuracaoConfianca: confianca,
    contextoEsperado,
  });
  if (!validacaoAtual.valido) throw new Error(`ledger_invalido:${validacaoAtual.bloqueios.join(",")}`);

  const agora = new Date().toISOString();
  const envelopeDigest = digestEnvelopeConteudo(envelope);
  const anexado = anexarEventoLedgerConteudo(eventos, {
    ledgerId,
    expectedHead,
    schemaVersion: envelope.schemaVersion,
    eventId: `event:${envelopeDigest.slice("sha256:".length)}`,
    recordedAt: agora,
    envelope,
    envelopePolitica,
    configuracaoConfianca: confianca,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: revocationDigest,
  });
  const validacaoNova = validarLedgerConteudo({
    eventos: anexado.eventos,
    envelopePolitica,
    ledgerId,
    expectedHead: anexado.head,
    principals: confianca.principals,
    trustRootDigestEsperado: trustRootDigest,
    revocationDigestEsperado: revocationDigest,
    configuracaoConfianca: confianca,
    contextoEsperado,
  });
  if (!validacaoNova.valido) throw new Error(`evento_nao_registravel:${validacaoNova.bloqueios.join(",")}`);

  // Segunda leitura reduz a janela de corrida. NDJSON local continua sem CAS/WORM;
  // armazenamento forte deve ser fornecido por uma fronteira externa.
  if (await lerTextoOpcional(ledgerArquivo) !== ledgerAntes) throw new Error("ledger_alterado_durante_append");
  const prefixo = ledgerAntes.length > 0 && !ledgerAntes.endsWith("\n") ? "\n" : "";
  await mkdir(path.dirname(path.resolve(ledgerArquivo)), { recursive: true });
  await appendFile(path.resolve(ledgerArquivo), `${prefixo}${JSON.stringify(anexado.evento)}\n`, "utf8");
  return {
    sucesso: true,
    comando: "registrar",
    backend: "ndjson_local_nao_worm",
    ledgerId,
    previousHead: expectedHead,
    head: anexado.head,
    sequence: anexado.evento.sequence,
    eventId: anexado.evento.eventId,
    trustRootDigest,
    revocationDigest,
  };
}

export async function comandoPipelineConteudo(
  _posicionaisGlobais: string[],
  args: string[],
  emJson: boolean,
): Promise<number> {
  const posicionais = posicionaisConteudo(args);
  const solicitouAjuda = args.includes("--help") || args.includes("-h") || posicionais[0] === "help" || posicionais[0] === "ajuda";
  const subcomando = solicitouAjuda ? "ajuda" : posicionais[0] ?? "capabilities";
  const comandoPublico = SUBCOMANDOS_CONTEUDO.has(subcomando) ? subcomando : "desconhecido";
  try {
    let payload: unknown;
    switch (subcomando) {
      case "ajuda":
        payload = criarAjudaPipelineConteudo();
        break;
      case "capabilities":
        payload = {
          sucesso: true,
          comando: subcomando,
          capabilities: CAPABILITIES_CONTEUDO_PADRAO,
          roles: ["POLICY_AUTHORITY", "PIPELINE_CONTROLLER", "PRODUCER", "RUNNER", "ADAPTER", "EVIDENCE_ATTESTER", "EVALUATOR"],
          payloadTypes: ["TRUST_POLICY", "RUN_STARTED", "ARTIFACT_REGISTERED", "CLAIM_SUBMITTED", "EVIDENCE_ATTESTED", "AI_ASSESSMENT", "OPERATIONAL_CONDITION"],
          nativeHumanReview: false,
          runner: "external",
          canonicalState: "signed_hash_chained_ledger",
          trustRootPin: "required_external_digest",
          revocationPin: "required_external_digest",
          attestationCapability: "content.evidence.attest:<evidenceType>",
          adapterAttestationCapability: "content.adapter.attest:<adapterId>@<version>:<evidenceType>",
        };
        break;
      case "validar": {
        const definicaoArquivo = exigir(posicionais[1], "definition.json");
        const definicao = await lerJson<DefinicaoPipelineConteudo>(definicaoArquivo);
        const resultado = validarDefinicaoPipelineConteudo(definicao);
        payload = { sucesso: resultado.valida, comando: subcomando, ...resultado };
        imprimirConteudo(payload, emJson);
        return resultado.valida ? 0 : 1;
      }
      case "planejar": {
        const definicaoArquivo = exigir(posicionais[1], "definition.json");
        const alvosArquivo = exigir(obterOpcaoConteudo(args, "--alvos-arquivo"), "--alvos-arquivo");
        const [definicao, alvos] = await Promise.all([
          lerJson<DefinicaoPipelineConteudo>(definicaoArquivo),
          lerJson<Parameters<typeof planejarPipelineConteudo>[1]>(alvosArquivo),
        ]);
        const resultado = planejarPipelineConteudo(definicao, alvos);
        payload = { sucesso: resultado.bloqueios.length === 0, comando: subcomando, ...resultado };
        imprimirConteudo(payload, emJson);
        return resultado.bloqueios.length === 0 ? 0 : 1;
      }
      case "validar-envelope": {
        const envelopeArquivo = exigir(obterOpcaoConteudo(args, "--envelope-arquivo"), "--envelope-arquivo");
        const confiancaArquivo = exigir(obterOpcaoConteudo(args, "--confianca-arquivo"), "--confianca-arquivo");
        const payloadType = exigir(obterOpcaoConteudo(args, "--payload-type"), "--payload-type");
        const [envelope, confianca] = await Promise.all([
          lerJson<EnvelopeAssinadoConteudo<unknown>>(envelopeArquivo),
          lerJson<ConfiguracaoConfiancaConteudo>(confiancaArquivo),
        ]);
        const { trustRootDigest, revocationDigest } = validarRaizConfiancaDaCli(confianca, confiancaArquivo, args);
        let papeis: readonly string[];
        if (payloadType === "TRUST_POLICY") {
          papeis = ["POLICY_AUTHORITY"];
        } else {
          const validacaoPayload = validarPayloadEventoConteudo(envelope.payload, {
            principalId: envelope.principalId,
          });
          if (!validacaoPayload.valido || validacaoPayload.kind === undefined) {
            throw new Error(`payload_evento_invalido:${validacaoPayload.bloqueios.join(",")}`);
          }
          const payloadEvento = envelope.payload as EventoPayloadConteudo;
          if (payloadEvento.trustRootDigest !== trustRootDigest) {
            throw new Error("payload_trust_root_digest_divergente");
          }
          if (payloadTypeEsperado(payloadEvento) !== payloadType) {
            throw new Error("payload_type_incompativel_com_kind");
          }
          papeis = papeisPermitidos(payloadEvento);
        }
        const resultado = verificarEnvelopeAssinadoConteudo(envelope, confianca, {
          trustRootDigestEsperado: trustRootDigest,
          revocationDigestEsperado: revocationDigest,
          payloadTypeEsperado: payloadType,
          capabilityRequerida: obterOpcaoConteudo(args, "--capability"),
          scopeRequerido: obterOpcaoConteudo(args, "--scope"),
          papeisPermitidos: papeis,
        });
        payload = {
          sucesso: resultado.valido,
          comando: subcomando,
          trustRootDigest,
          revocationDigest,
          ...resultado,
          envelopeVerificado: undefined,
        };
        imprimirConteudo(payload, emJson);
        return resultado.valido ? 0 : 1;
      }
      case "registrar":
        payload = await registrarEnvelopeLocal(args, exigir(posicionais[1], "ledger.ndjson"));
        break;
      case "status": {
        const definicaoArquivo = exigir(posicionais[1], "definition.json");
        const contexto = await carregarContextoEstado(definicaoArquivo, args);
        const estado = derivarEstadoPipelineConteudo({
          eventos: contexto.eventos,
          envelopePolitica: contexto.envelopePolitica,
          definicao: contexto.definicao,
          configuracaoConfianca: contexto.confianca,
          trustRootDigestEsperado: contexto.trustRootDigest,
          revocationDigestEsperado: contexto.revocationDigest,
          expectedHead: contexto.expectedHead,
        });
        const ledger = validarLedgerConteudo({
          eventos: contexto.eventos,
          envelopePolitica: contexto.envelopePolitica,
          ledgerId: contexto.politica.ledgerId,
          expectedHead: contexto.expectedHead,
          principals: contexto.confianca.principals,
          trustRootDigestEsperado: contexto.trustRootDigest,
          revocationDigestEsperado: contexto.revocationDigest,
          configuracaoConfianca: contexto.confianca,
          contextoEsperado: {
            runId: contexto.politica.runId,
            trustDomainId: contexto.politica.trustDomainId,
            trustRootDigest: contexto.trustRootDigest,
            ledgerId: contexto.politica.ledgerId,
            policyDigest: hashCanonicoConteudo(contexto.politica),
            definitionDigest: contexto.definitionDigest,
          },
        });
        payload = {
          sucesso: ledger.valido && estado.valido,
          comando: subcomando,
          definitionDigest: contexto.definitionDigest,
          policyEnvelopeDigest: contexto.policyEnvelopeDigest,
          trustRootDigest: contexto.trustRootDigest,
          revocationDigest: contexto.revocationDigest,
          ledger,
          estado,
        };
        break;
      }
      case "projetar": {
        const definicaoArquivo = exigir(posicionais[1], "definition.json");
        const contexto = await carregarContextoEstado(definicaoArquivo, args);
        const projecao = projetarManifestoPipelineConteudo({
          eventos: contexto.eventos,
          envelopePolitica: contexto.envelopePolitica,
          definicao: contexto.definicao,
          configuracaoConfianca: contexto.confianca,
          trustRootDigestEsperado: contexto.trustRootDigest,
          revocationDigestEsperado: contexto.revocationDigest,
          expectedHead: contexto.expectedHead,
        });
        const saida = obterOpcaoConteudo(args, "--saida");
        if (saida !== undefined) {
          await mkdir(path.dirname(path.resolve(saida)), { recursive: true });
          await writeFile(path.resolve(saida), `${JSON.stringify(projecao, null, 2)}\n`, "utf8");
        }
        payload = { sucesso: true, comando: subcomando, saida: saida ? path.resolve(saida) : null, projecao };
        break;
      }
      default:
        throw new Error("subcomando_conteudo_desconhecido");
    }
    imprimirConteudo(payload, emJson);
    return 0;
  } catch (erro) {
    const falha: FalhaComandoConteudo = {
      sucesso: false,
      comando: comandoPublico,
      erro: codigoErroPublicoConteudo(erro),
    };
    imprimirConteudo(falha, emJson);
    return 1;
  }
}

export { HEAD_GENESIS_LEDGER_CONTEUDO };
