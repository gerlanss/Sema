// SEMA-GOVERNED: sema.software
// Descricao: nucleo semantico particionado; consulte contratos/sema/software.sema antes de editar.

import type { BlocoCasoTesteAst, BlocoGenericoAst, CampoAst, ModuloAst } from "../ast/tipos.js";
import type { Diagnostico } from "../diagnosticos/index.js";
import {
  localizarCampoPersistencia,
  matrizCompatibilidadePersistencia,
  nomeTipoRecursoPersistencia,
  normalizarConsistenciaPersistencia,
  normalizarDurabilidadePersistencia,
  normalizarEngineBanco,
  normalizarModeloConsultaPersistencia,
  normalizarModeloTransacaoPersistencia,
  parsearBooleanoPersistencia,
  TIPOS_RECURSO_PERSISTENCIA,
  type TipoRecursoPersistencia,
} from "../persistencia/contratos.js";
import type { ContextoSemantico, ErroSemanticoTask } from "../semantico/analisador.js";
import {
  contratoDadosTemSensivel,
  extrairContratoAudit,
  extrairContratoAuth,
  extrairContratoAuthz,
  extrairContratoDados,
  extrairContratoForbidden,
  extrairContratoSegredos,
  efeitoEhPrivilegiado,
} from "../semantico/seguranca.js";
import { parsearEfeitoSemantico, parsearEtapaFlow, parsearExpressaoSemantica, parsearTransicaoEstado } from "../semantico/estruturas.js";
import type {
  IrBlocoDeclarativo,
  IrCampo,
  IrCasoTeste,
  IrAudit,
  IrAuth,
  IrAuthz,
  IrDados,
  IrEntity,
  IrErroOperacional,
  IrExecucao,
  IrForbidden,
  IrFlow,
  IrImplementacaoTask,
  IrBancoDados,
  IrCompatibilidadePersistencia,
  IrModulo,
  IrRecursoPersistencia,
  IrResumoAgente,
  IrRoute,
  IrRoutePublica,
  IrSegredos,
  IrState,
  IrSuperficie,
  IrTask,
  IrType,
  IrVinculo,
  NivelConfiancaSemantica,
  NivelRiscoSemantico,
  PerfilCompatibilidade,
  TipoSuperficieIr,
} from "./modelos.js";

import { TIPOS_PRIMITIVOS, converterAudit, converterAuth, converterAuthz, converterCampos, converterDados, converterExecucao, converterForbidden, converterImplementacoes, converterSegredos, converterVinculos, encontrarSubBloco, localizarCampo, valorCampoCompleto } from "./conversor.part01.js";

export function extrairPerfil(bloco?: BlocoGenericoAst, padrao: PerfilCompatibilidade = "interno"): PerfilCompatibilidade {
  const perfil = valorCampoCompleto(localizarCampo(bloco, "perfil", "compatibilidade"))?.toLowerCase();
  if (
    perfil === "publico"
    || perfil === "interno"
    || perfil === "experimental"
    || perfil === "legado"
    || perfil === "deprecado"
  ) {
    return perfil;
  }
  return padrao;
}

export function tipoNaoPrimitivo(campo: IrCampo): string | undefined {
  if (!TIPOS_PRIMITIVOS.has(campo.tipoBase)) {
    return campo.tipoBase;
  }
  if (campo.tipoItem && !TIPOS_PRIMITIVOS.has(campo.tipoItem)) {
    return campo.tipoItem;
  }
  if (campo.valorMapa && !TIPOS_PRIMITIVOS.has(campo.valorMapa)) {
    return campo.valorMapa;
  }
  return undefined;
}

export function deduplicarTexto(valores: string[]): string[] {
  return [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function resumirAgente(params: {
  input?: IrCampo[];
  output?: IrCampo[];
  efeitos?: Array<{ categoria: string; alvo: string; criticidade?: string }>;
  vinculos?: IrVinculo[];
  execucao?: IrExecucao;
  auth?: IrAuth;
  authz?: IrAuthz;
  dados?: IrDados;
  audit?: IrAudit;
  segredos?: IrSegredos;
  forbidden?: IrForbidden;
  superficiePublica?: string;
}): IrResumoAgente {
  const entidadesAfetadas = deduplicarTexto([
    ...(params.input ?? []).map(tipoNaoPrimitivo).filter((item): item is string => Boolean(item)),
    ...(params.output ?? []).map(tipoNaoPrimitivo).filter((item): item is string => Boolean(item)),
    ...(params.efeitos ?? []).map((efeito) => efeito.alvo),
  ]);

  const mutacoesPrevistas = deduplicarTexto(
    (params.efeitos ?? []).map((efeito) => `${efeito.categoria}:${efeito.alvo}`),
  );

  const riscos = new Set<string>();
  if ((params.efeitos ?? []).some((efeito) => efeito.categoria === "persistencia")) {
    riscos.add("altera_persistencia");
  }
  if ((params.efeitos ?? []).some((efeito) => efeitoEhPrivilegiado(efeito))) {
    riscos.add("efeito_privilegiado");
  }
  if ((params.efeitos ?? []).some((efeito) => efeito.criticidade === "alta" || efeito.criticidade === "critica")) {
    riscos.add("efeito_critico");
  }
  if (params.execucao?.criticidadeOperacional === "alta" || params.execucao?.criticidadeOperacional === "critica") {
    riscos.add("execucao_critica");
  }
  if (contratoDadosTemSensivel(params.dados)) {
    riscos.add("dados_sensiveis");
  }
  if (params.segredos?.itens.length) {
    riscos.add("segredo_operacional");
  }
  if ((params.vinculos ?? []).length === 0) {
    riscos.add("vinculo_fraco");
  }

  const checks = new Set<string>();
  checks.add("rodar sema validar --json");
  if ((params.output ?? []).length > 0) {
    checks.add("verificar guarantees");
  }
  if ((params.vinculos ?? []).length > 0) {
    checks.add("rodar sema drift --json");
  }
  if (params.auth?.explicita || params.authz?.explicita) {
    checks.add("revisar auth e authz");
  }
  if (params.dados?.explicita) {
    checks.add("validar classificacao de dados");
  }
  if (params.audit?.explicita) {
    checks.add("validar trilha de auditoria");
  }
  if (params.forbidden?.explicita) {
    checks.add("confirmar proibicoes operacionais");
  }
  if (params.superficiePublica) {
    checks.add("validar superficie publica impactada");
  }

  return {
    riscos: [...riscos],
    checks: [...checks],
    entidadesAfetadas,
    superficiesPublicas: params.superficiePublica ? [params.superficiePublica] : [],
    mutacoesPrevistas,
  };
}

export function recomporCaminho(campo?: CampoAst): string | undefined {
  const valor = valorCampoCompleto(campo);
  return valor?.replace(/\s*\/\s*/g, "/").trim();
}

export function ehUseInterop(
  use: ModuloAst["uses"][number],
): use is ModuloAst["uses"][number] & { origem: "ts" | "js" | "py" | "dart" | "lua" | "cs" | "java" | "go" | "rust" | "cpp" | "php" } {
  return use.origem !== "sema";
}

export function converterErroPublico(erro: IrErroOperacional, origemTask?: string) {
  return {
    nome: erro.codigo,
    codigo: erro.codigo,
    mensagem: erro.mensagem,
    categoria: erro.categoria,
    recuperabilidade: erro.recuperabilidade,
    acaoChamador: erro.acaoChamador,
    impactaEstado: erro.impactaEstado,
    requerCompensacao: erro.requerCompensacao,
    origemTask,
  };
}

export function calcularConfiancaPublica(route: IrRoute): NivelConfiancaSemantica {
  if (route.task && route.vinculos.length > 0) {
    return "alta";
  }
  if (route.task || route.vinculos.length > 0) {
    return "media";
  }
  return "baixa";
}

export function calcularRiscoPublico(route: IrRoute): NivelRiscoSemantico {
  if (
    !route.auth.explicita
    || contratoDadosTemSensivel(route.dados)
    || route.efeitosPublicos.some((efeito) => efeitoEhPrivilegiado(efeito) || efeito.categoria === "persistencia" || efeito.criticidade === "critica")
  ) {
    return "alto";
  }
  if (route.efeitosPublicos.length > 0 || route.errosPublicos.length > 0) {
    return "medio";
  }
  return "baixo";
}

export function converterSuperficie(
  tipo: TipoSuperficieIr,
  superficie: BlocoGenericoAst,
): IrSuperficie {
  const input = converterCampos(encontrarSubBloco(superficie, "input"));
  const output = converterCampos(encontrarSubBloco(superficie, "output"));
  const effects = (encontrarSubBloco(superficie, "effects")?.linhas ?? [])
    .map((linha) => parsearEfeitoSemantico(linha.conteudo))
    .filter((linha): linha is NonNullable<typeof linha> => Boolean(linha));
  const vinculos = converterVinculos(encontrarSubBloco(superficie, "vinculos"));
  const execucao = converterExecucao(encontrarSubBloco(superficie, "execucao"));
  const auth = converterAuth(encontrarSubBloco(superficie, "auth"));
  const authz = converterAuthz(encontrarSubBloco(superficie, "authz"));
  const dados = converterDados(encontrarSubBloco(superficie, "dados"));
  const audit = converterAudit(encontrarSubBloco(superficie, "audit"));
  const segredos = converterSegredos(encontrarSubBloco(superficie, "segredos"));
  const forbidden = converterForbidden(encontrarSubBloco(superficie, "forbidden"));
  const task = valorCampoCompleto(localizarCampo(superficie, "task", "tarefa"));
  const perfilCompatibilidade = extrairPerfil(superficie, tipo === "webhook" ? "publico" : "interno");
  const resumoAgente = resumirAgente({
    input,
    output,
    efeitos: effects,
    vinculos,
    execucao,
    auth,
    authz,
    dados,
    audit,
    segredos,
    forbidden,
    superficiePublica: perfilCompatibilidade === "publico" ? `${tipo}:${superficie.nome ?? tipo}` : undefined,
  });

  return {
    tipo,
    nome: superficie.nome ?? tipo,
    campos: converterCampos(superficie),
    linhas: superficie.linhas.map((linha) => linha.conteudo),
    task: task || undefined,
    input,
    output,
    effects,
    implementacoesExternas: converterImplementacoes(encontrarSubBloco(superficie, "impl")),
    vinculos,
    execucao,
    auth,
    authz,
    dados,
    audit,
    segredos,
    forbidden,
    perfilCompatibilidade,
    resumoAgente,
  };
}
