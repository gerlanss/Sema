// SEMA-GOVERNED: sema.produto.orquestracao_profiles, sema.produto.governanca_ia.drift.cache.modos
// Descrição: comando de profiles com fechamento explícito por drift fresh.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { temErros } from "@sema/nucleo";
import { carregarModulos } from "./carregarModulos.js";
import { obterOpcao } from "./cliArgs.js";
import { resumirListaTexto } from "./textoListas.js";
import {
  CAPABILITY_MATRIX_GOVERNANCA,
  normalizarMaturidadeProfile,
  normalizarProfileSemantico,
  PRESETS_PROFILE,
  REQUISITOS_PROFILE,
  REQUISITOS_PROFILE_COMUNS,
} from "./profileCatalogo.js";
import { REQUISITOS_PRESET_PROFILE, RULE_PACKS_SEMA } from "./profileRulePacks.js";
import { avaliarArtefatoProfile } from "./profileArtefatoValidadores.js";
import {
  avaliarRequisitosProfile,
  calcularConfiancaValidacaoProfile,
  calcularScoreAchadosProfile,
  calcularScoreProfile,
  calcularScoreRiscoProfile,
  criarRuntimeGateProfile,
  decidirAcaoAgenteProfile,
  moduloCombinaComProfile,
  normalizarPresetProfile,
  selecionarRulePacksProfile,
  severidadeMaximaProfile,
} from "./profileRegras.js";
import type {
  AchadoProfile,
  CapabilityProfile,
  ConfidenceEngineProfile,
  ConfiancaValidacaoProfile,
  DecisaoAgenteProfile,
  FonteAchadoProfile,
  MaturidadeProfile,
  OpcoesProfileValidar,
  PerfilSemanticoValidavel,
  PresetProfile,
  ProfileGovernanca,
  RequisitoProfile,
  ResultadoProfileValidar,
  RulePackSema,
  RuntimeGateProfile,
  SeveridadeProfile,
} from "./profileAuthorTipos.js";

export async function carregarArtefatoProfile(args: string[]): Promise<{ texto: string | null; arquivo: string | null }> {
  const texto = obterOpcao(args, "--artefato") ?? obterOpcao(args, "--artifact");
  const arquivo = obterOpcao(args, "--artefato-arquivo") ?? obterOpcao(args, "--artifact-file");
  if (arquivo) {
    const absoluto = path.resolve(process.cwd(), arquivo);
    return { texto: await readFile(absoluto, "utf8"), arquivo: absoluto };
  }
  return { texto: texto ?? null, arquivo: null };
}

export async function validarProfileSemantico(
  entrada: string | undefined,
  profile: PerfilSemanticoValidavel,
  opcoes: OpcoesProfileValidar,
): Promise<ResultadoProfileValidar> {
  if (!entrada) {
    throw new Error("Uso: sema profile validar <software|workflow|ops|game|simulation|legal|research|redacao|propostas|conversas> <arquivo-ou-pasta> [--maturidade draft|prototype|production|critical] [--preset <preset>] [--artefato <texto>|--artefato-arquivo <arquivo>] [--json]");
  }

  const modulos = await carregarModulos(entrada);
  const escolhido = modulos.find((item) => moduloCombinaComProfile(item.resultado.modulo?.nome, item.caminho, profile)) ?? modulos[0];
  if (!escolhido) {
    throw new Error(`Nenhum modulo Sema encontrado para ${entrada}.`);
  }

  const conteudo = await readFile(escolhido.caminho, "utf8");
  const maturidade = opcoes.maturidade;
  const preset = opcoes.preset ?? null;
  const contratoValido = !temErros(escolhido.resultado.diagnosticos);
  const requisitosPreset = preset ? REQUISITOS_PRESET_PROFILE[preset] ?? [] : [];
  const achadosContrato = avaliarRequisitosProfile(conteudo, [...REQUISITOS_PROFILE_COMUNS, ...REQUISITOS_PROFILE[profile]], profile, maturidade);
  const achadosPreset = avaliarRequisitosProfile(conteudo, requisitosPreset, profile, maturidade, "preset");
  const achadosArtefato = avaliarArtefatoProfile(profile, conteudo, opcoes.artefatoTexto, maturidade, preset);
  const achados = [...achadosContrato, ...achadosPreset, ...achadosArtefato];
  const requisitosPendentes = achados.filter((achado) => !achado.atendido).map((achado) => achado.id);
  const obrigatoriosPendentes = achados.filter((achado) => achado.obrigatorio && !achado.atendido).map((achado) => achado.id);
  const scoreContrato = calcularScoreProfile(contratoValido, [...achadosContrato, ...achadosPreset]);
  const scoreArtefato = opcoes.artefatoTexto ? calcularScoreAchadosProfile(100, achadosArtefato) : null;
  const scoreProntoParaAcao = Math.min(scoreContrato, scoreArtefato ?? scoreContrato);
  const decisaoAgente = decidirAcaoAgenteProfile(contratoValido, achados);
  const aprovado = contratoValido && obrigatoriosPendentes.length === 0 && scoreProntoParaAcao >= 80;
  const podeContinuar = decisaoAgente === "continuar" || decisaoAgente === "continuar_com_ressalva";
  const scoreRisco = calcularScoreRiscoProfile(achados);
  const confiancaValidacao = calcularConfiancaValidacaoProfile(Boolean(opcoes.artefatoTexto), achadosArtefato, scoreRisco);
  const prontoParaAcao = aprovado && podeContinuar;
  const confidenceEngine: ConfidenceEngineProfile = {
    scoreContratoFormal: scoreContrato,
    scoreAderenciaSemantica: scoreArtefato,
    scoreRisco,
    prontoParaAcao,
    confiancaValidacao,
    comparacaoArtefatoReal: Boolean(opcoes.artefatoTexto),
    heuristicaParcial: confiancaValidacao === "parcial" || confiancaValidacao === "baixa",
  };
  const runtimeGate = criarRuntimeGateProfile(decisaoAgente, maturidade, achados, scoreRisco);
  const capabilityMatrix = CAPABILITY_MATRIX_GOVERNANCA[profile];
  const rulePacksSugeridos = selecionarRulePacksProfile(profile);

  return {
    comando: "profile validar",
    sucesso: aprovado,
    profile,
    arquivo: escolhido.caminho,
    modulo: escolhido.resultado.modulo?.nome ?? null,
    maturidade,
    preset,
    presetsDisponiveis: PRESETS_PROFILE[profile],
    contratoValido,
    artefatoRecebido: Boolean(opcoes.artefatoTexto),
    artefatoArquivo: opcoes.artefatoArquivo ?? null,
    aprovado,
    bloqueado: !aprovado,
    podeContinuar,
    decisaoAgente,
    scoreContrato,
    scoreArtefato,
    scoreProntoParaAcao,
    scoreContratoFormal: scoreContrato,
    scoreAderenciaSemantica: scoreArtefato,
    scoreRisco,
    prontoParaAcao,
    confiancaValidacao,
    confidenceEngine,
    capabilityMatrix,
    runtimeGate,
    rulePacksSugeridos,
    achados,
    achadosArtefato,
    requisitosAtendidos: achados.filter((achado) => achado.atendido).map((achado) => achado.id),
    requisitosPendentes,
    checks: [
      `sema profile validar ${profile} <arquivo> --preset ${preset ?? "<opcional>"} --artefato-arquivo <artefato> --json`,
      "sema validar <arquivo> --json",
      "sema drift <arquivo> --escopo modulo --cache fresh --json",
      "sema contexto-ia <arquivo>",
    ],
    diagnosticos: escolhido.resultado.diagnosticos,
  };
}

export function renderizarProfileValidarTexto(resultado: ResultadoProfileValidar): string {
  const linhas = [
    "PROFILE_VALIDAR",
    `PROFILE: ${resultado.profile}`,
    `ARQUIVO: ${resultado.arquivo}`,
    `MODULO: ${resultado.modulo ?? "desconhecido"}`,
    `MATURIDADE: ${resultado.maturidade}`,
    `PRESET: ${resultado.preset ?? "nenhum"}`,
    `ARTEFATO_RECEBIDO: ${resultado.artefatoRecebido ? "sim" : "nao"}`,
    `APROVADO: ${resultado.aprovado ? "sim" : "nao"}`,
    `BLOQUEADO: ${resultado.bloqueado ? "sim" : "nao"}`,
    `DECISAO_AGENTE: ${resultado.decisaoAgente}`,
    `SCORE_CONTRATO: ${resultado.scoreContrato}`,
    `SCORE_ARTEFATO: ${resultado.scoreArtefato ?? "nao_avaliado"}`,
    `SCORE_PRONTO_PARA_ACAO: ${resultado.scoreProntoParaAcao}`,
    `SCORE_RISCO: ${resultado.scoreRisco}`,
    `CONFIANCA_VALIDACAO: ${resultado.confiancaValidacao}`,
    `RUNTIME_GATE: ${resultado.runtimeGate.decisao}`,
  ];
  for (const achado of resultado.achados) {
    linhas.push(`- ${achado.id}: ${achado.atendido ? "ok" : "pendente"} ${achado.severidade}${achado.obrigatorio ? " obrigatorio" : " recomendado"} ${achado.fonte} - ${achado.descricao}`);
    if (achado.linha && achado.coluna) linhas.push(`  posicao: linha ${achado.linha}, coluna ${achado.coluna}`);
    if (achado.trecho) linhas.push(`  trecho: ${achado.trecho}`);
    if (achado.motivo) linhas.push(`  motivo: ${achado.motivo}`);
    if (achado.risco) linhas.push(`  risco: ${achado.risco}`);
    if (achado.sugestao) linhas.push(`  sugestao: ${achado.sugestao}`);
  }
  return linhas.join("\n");
}

export function criarPayloadCapabilityMatrix() {
  const profiles = Object.values(CAPABILITY_MATRIX_GOVERNANCA)
    .filter((profile) => profile.profile !== "author");
  const workflowsEspecializados = [{
    id: "workflow.author",
    comando: "sema author <subcomando>",
    resumo: "Workflow narrativo especializado; não é um profile validável.",
  }] as const;
  return {
    comando: "profile capabilities",
    sucesso: true,
    profiles,
    workflowsEspecializados,
    resumo: {
      profiles: profiles.length,
      workflowsEspecializados: workflowsEspecializados.length,
      validaArtefatoReal: profiles.filter((profile) => profile.validaArtefatoReal).map((profile) => profile.profile),
      interpretaNegacao: profiles.filter((profile) => profile.interpretaNegacao).map((profile) => profile.profile),
    },
  };
}

export function renderizarCapabilityMatrixTexto(payload: ReturnType<typeof criarPayloadCapabilityMatrix>): string {
  return [
    "CAPABILITY_MATRIX",
    ...payload.profiles.map((profile) => [
      `- ${profile.profile}: confianca=${profile.confianca}`,
      `  literal=${profile.detectaLiteral ? "sim" : "nao"} semantico=${profile.detectaSemantico} ordem=${profile.detectaOrdemExecucao} artefato=${profile.validaArtefatoReal} negacao=${profile.interpretaNegacao ? "sim" : "nao"}`,
      `  packs=${profile.rulePacksSugeridos.join(", ")}`,
      `  limites=${profile.limites.join(" | ")}`,
    ].join("\n")).join("\n"),
    "SPECIALIZED_WORKFLOWS",
    ...payload.workflowsEspecializados.map((workflow) => (
      `- ${workflow.id}: ${workflow.resumo}\n  comando=${workflow.comando}`
    )),
  ].join("\n");
}

export function criarPayloadRulePacks(profileFiltro: ProfileGovernanca | null = null) {
  const packs = profileFiltro
    ? RULE_PACKS_SEMA.filter((pack) => pack.profiles.includes(profileFiltro))
    : RULE_PACKS_SEMA;
  return {
    comando: "rule-packs",
    sucesso: true,
    profile: profileFiltro,
    packs,
    resumo: {
      total: packs.length,
      abertos: packs.filter((pack) => pack.monetizacao === "aberto").map((pack) => pack.id),
      pagos: packs.filter((pack) => pack.monetizacao !== "aberto").map((pack) => pack.id),
      enterprise: packs.filter((pack) => pack.categoria === "enterprise").map((pack) => pack.id),
    },
  };
}

export function renderizarRulePacksTexto(payload: ReturnType<typeof criarPayloadRulePacks>): string {
  return [
    "RULE_PACKS",
    ...payload.packs.map((pack) => [
      `- ${pack.id}: ${pack.nome}`,
      `  profiles=${pack.profiles.join(", ")} maturidade_minima=${pack.maturidadeMinima} monetizacao=${pack.monetizacao} status=${pack.status}`,
      `  controles=${pack.controles.join(", ")}`,
    ].join("\n")),
  ].join("\n");
}

export function normalizarProfileGovernanca(valor: string | undefined): ProfileGovernanca | null {
  if (!valor) return null;
  const chave = valor.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (chave === "author" || chave === "autor" || chave === "escrita") return "author";
  return normalizarProfileSemantico(valor);
}

export async function comandoProfile(posicionais: string[], args: string[], emJson: boolean): Promise<number> {
  const subcomando = posicionais[0];
  if (!subcomando || subcomando === "help" || subcomando === "ajuda") {
    console.log([
      "Uso: sema profile <validar|capabilities|rule-packs>",
      "",
      "Comandos:",
      "  sema profile validar <software|workflow|ops|game|simulation|legal|research|redacao|propostas|conversas> <arquivo-ou-pasta> [--maturidade draft|prototype|production|critical] [--preset <preset>] [--artefato <texto>|--artefato-arquivo <arquivo>] [--json]",
      "  sema profile capabilities [--json]",
      "  sema profile rule-packs [--profile <author|software|workflow|ops|game|simulation|legal|research|redacao|propostas|conversas>] [--json]",
      "",
      "O profile e um gate semantico: se requisito obrigatorio faltar, a saida bloqueia.",
    ].join("\n"));
    return subcomando ? 0 : 1;
  }

  if (subcomando === "capabilities" || subcomando === "capability-matrix" || subcomando === "matrix") {
    const payload = criarPayloadCapabilityMatrix();
    console.log(emJson ? JSON.stringify(payload, null, 2) : renderizarCapabilityMatrixTexto(payload));
    return 0;
  }

  if (subcomando === "rule-packs" || subcomando === "packs") {
    const profileFiltro = normalizarProfileGovernanca(obterOpcao(args, "--profile"));
    const payload = criarPayloadRulePacks(profileFiltro);
    console.log(emJson ? JSON.stringify(payload, null, 2) : renderizarRulePacksTexto(payload));
    return 0;
  }

  if (subcomando !== "validar") {
    console.error(`Subcomando profile desconhecido: ${subcomando}`);
    return 1;
  }

  const profile = normalizarProfileSemantico(posicionais[1] ?? obterOpcao(args, "--profile"));
  const entrada = posicionais[2] ?? obterOpcao(args, "--arquivo");
  if (!profile) {
    console.error("Profile invalido. Use software, workflow, ops, game, simulation, legal, research, redacao, propostas ou conversas.");
    return 1;
  }

  const preset = normalizarPresetProfile(profile, obterOpcao(args, "--preset"));
  if (obterOpcao(args, "--preset") && !preset) {
    console.error(`Preset invalido para ${profile}. Use: ${PRESETS_PROFILE[profile].join(", ")}.`);
    return 1;
  }
  const artefato = await carregarArtefatoProfile(args);
  const resultado = await validarProfileSemantico(entrada, profile, {
    maturidade: normalizarMaturidadeProfile(obterOpcao(args, "--maturidade")),
    preset,
    artefatoTexto: artefato.texto,
    artefatoArquivo: artefato.arquivo,
  });
  if (emJson) {
    console.log(JSON.stringify(resultado, null, 2));
  } else {
    console.log(renderizarProfileValidarTexto(resultado));
  }
  return resultado.sucesso ? 0 : 1;
}
