import type { BlocoGenericoAst, CampoAst } from "../ast/tipos.js";

export type ModoAuthSemantico = "obrigatorio" | "opcional" | "anonimo" | "interno" | "m2m";
export type PrincipalAuthSemantico = "usuario" | "servico" | "sistema" | "anonimo";
export type OrigemAuthSemantica = "publica" | "interna" | "worker" | "webhook" | "fila" | "cron";
export type TenantAuthzSemantico = "obrigatorio" | "opcional" | "isolado";
export type ClassificacaoDadoSemantico = "publico" | "interno" | "pii" | "financeiro" | "credencial" | "segredo";
export type RedacaoLogSemantica = "livre" | "parcial" | "obrigatoria" | "proibida";
export type MotivoAuditSemantico = "obrigatorio" | "opcional" | "dispensado";
export type PrivilegioEfeitoSemantico = "leitura" | "escrita" | "publicacao" | "execucao" | "admin" | "egress";
export type IsolamentoEfeitoSemantico = "tenant" | "processo" | "host" | "vps" | "global";

export interface ContratoAuthSemantico {
  explicita: boolean;
  modo?: string;
  estrategia?: string;
  principal?: string;
  origem?: string;
}

export interface ContratoAuthzSemantico {
  explicita: boolean;
  papeis: string[];
  escopos: string[];
  politica?: string;
  tenant?: string;
}

export interface CampoDadoSemantico {
  origem: string;
  campo: string;
  classificacao: string;
}

export interface ContratoDadosSemantico {
  explicita: boolean;
  classificacaoPadrao?: string;
  redacaoLog?: string;
  retencao?: string;
  campos: CampoDadoSemantico[];
}

export interface ContratoAuditSemantico {
  explicita: boolean;
  evento?: string;
  ator?: string;
  correlacao?: string;
  retencao?: string;
  motivo?: string;
}

export interface SegredoSemantico {
  nome: string;
  origem?: string;
  escopo?: string;
  acesso?: string;
  rotacao?: string;
  naoLogar?: boolean;
  naoRetornar?: boolean;
  mascarar?: boolean;
}

export interface ContratoSegredosSemantico {
  explicita: boolean;
  itens: SegredoSemantico[];
}

export interface ContratoForbiddenSemantico {
  explicita: boolean;
  regras: string[];
}

export const MODOS_AUTH_SUPORTADOS = new Set<ModoAuthSemantico>([
  "obrigatorio",
  "opcional",
  "anonimo",
  "interno",
  "m2m",
]);

export const PRINCIPAIS_AUTH_SUPORTADOS = new Set<PrincipalAuthSemantico>([
  "usuario",
  "servico",
  "sistema",
  "anonimo",
]);

export const ORIGENS_AUTH_SUPORTADAS = new Set<OrigemAuthSemantica>([
  "publica",
  "interna",
  "worker",
  "webhook",
  "fila",
  "cron",
]);

export const TENANTS_AUTHZ_SUPORTADOS = new Set<TenantAuthzSemantico>([
  "obrigatorio",
  "opcional",
  "isolado",
]);

export const CLASSIFICACOES_DADO_SUPORTADAS = new Set<ClassificacaoDadoSemantico>([
  "publico",
  "interno",
  "pii",
  "financeiro",
  "credencial",
  "segredo",
]);

export const CLASSIFICACOES_DADO_SENSIVEIS = new Set<ClassificacaoDadoSemantico>([
  "pii",
  "financeiro",
  "credencial",
  "segredo",
]);

export const REDACOES_LOG_SUPORTADAS = new Set<RedacaoLogSemantica>([
  "livre",
  "parcial",
  "obrigatoria",
  "proibida",
]);

export const MOTIVOS_AUDIT_SUPORTADOS = new Set<MotivoAuditSemantico>([
  "obrigatorio",
  "opcional",
  "dispensado",
]);

export const PRIVILEGIOS_EFEITO_SUPORTADOS = new Set<PrivilegioEfeitoSemantico>([
  "leitura",
  "escrita",
  "publicacao",
  "execucao",
  "admin",
  "egress",
]);

export const ISOLAMENTOS_EFEITO_SUPORTADOS = new Set<IsolamentoEfeitoSemantico>([
  "tenant",
  "processo",
  "host",
  "vps",
  "global",
]);

export const CATEGORIAS_EFEITO_PRIVILEGIADAS = new Set([
  "db.read",
  "db.write",
  "queue.publish",
  "queue.consume",
  "fs.read",
  "fs.write",
  "network.egress",
  "secret.read",
  "shell.exec",
]);

function valorCampoCompleto(campo?: CampoAst): string | undefined {
  if (!campo) {
    return undefined;
  }
  return [campo.valor, ...campo.modificadores].join(" ").trim() || undefined;
}

function parsearBooleanoSemantico(valor?: string): boolean | undefined {
  if (!valor) {
    return undefined;
  }
  if (valor === "verdadeiro" || valor === "true") {
    return true;
  }
  if (valor === "falso" || valor === "false") {
    return false;
  }
  return undefined;
}

function localizarCampo(bloco: BlocoGenericoAst | undefined, ...nomes: string[]): CampoAst | undefined {
  if (!bloco) {
    return undefined;
  }
  return bloco.campos.find((campo) => nomes.includes(campo.nome));
}

function localizarSubBloco(bloco: BlocoGenericoAst | undefined, nome: string): BlocoGenericoAst | undefined {
  if (!bloco) {
    return undefined;
  }
  return bloco.blocos.find((item): item is BlocoGenericoAst =>
    item.tipo === "bloco_generico" && (item.palavraChave === nome || item.nome === nome));
}

function dividirListaDeclarativa(valor?: string): string[] {
  return (valor ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function extrairContratoAuth(bloco?: BlocoGenericoAst): ContratoAuthSemantico {
  return {
    explicita: Boolean(bloco),
    modo: valorCampoCompleto(localizarCampo(bloco, "modo")),
    estrategia: valorCampoCompleto(localizarCampo(bloco, "estrategia")),
    principal: valorCampoCompleto(localizarCampo(bloco, "principal")),
    origem: valorCampoCompleto(localizarCampo(bloco, "origem")),
  };
}

export function extrairContratoAuthz(bloco?: BlocoGenericoAst): ContratoAuthzSemantico {
  return {
    explicita: Boolean(bloco),
    papeis: deduplicarTexto([
      ...dividirListaDeclarativa(valorCampoCompleto(localizarCampo(bloco, "papel", "papeis"))),
      ...bloco?.campos.filter((campo) => campo.nome === "papel").map((campo) => valorCampoCompleto(campo) ?? "") ?? [],
    ]),
    escopos: deduplicarTexto([
      ...dividirListaDeclarativa(valorCampoCompleto(localizarCampo(bloco, "escopo", "escopos"))),
      ...bloco?.campos.filter((campo) => campo.nome === "escopo").map((campo) => valorCampoCompleto(campo) ?? "") ?? [],
    ]),
    politica: valorCampoCompleto(localizarCampo(bloco, "politica")),
    tenant: valorCampoCompleto(localizarCampo(bloco, "tenant")),
  };
}

export function extrairContratoDados(bloco?: BlocoGenericoAst): ContratoDadosSemantico {
  const campos: CampoDadoSemantico[] = [];
  const camposDiretos = bloco?.campos ?? [];

  for (const campo of camposDiretos) {
    if (["classificacao_padrao", "redacao_log", "retencao"].includes(campo.nome)) {
      continue;
    }
    const classificacao = valorCampoCompleto(campo);
    if (!classificacao) {
      continue;
    }
    campos.push({
      origem: "geral",
      campo: campo.nome,
      classificacao,
    });
  }

  for (const origem of ["input", "output"]) {
    const subbloco = localizarSubBloco(bloco, origem);
    for (const campo of subbloco?.campos ?? []) {
      const classificacao = valorCampoCompleto(campo);
      if (!classificacao) {
        continue;
      }
      campos.push({
        origem,
        campo: campo.nome,
        classificacao,
      });
    }
  }

  return {
    explicita: Boolean(bloco),
    classificacaoPadrao: valorCampoCompleto(localizarCampo(bloco, "classificacao_padrao")),
    redacaoLog: valorCampoCompleto(localizarCampo(bloco, "redacao_log")),
    retencao: valorCampoCompleto(localizarCampo(bloco, "retencao")),
    campos,
  };
}

export function extrairContratoAudit(bloco?: BlocoGenericoAst): ContratoAuditSemantico {
  return {
    explicita: Boolean(bloco),
    evento: valorCampoCompleto(localizarCampo(bloco, "evento")),
    ator: valorCampoCompleto(localizarCampo(bloco, "ator")),
    correlacao: valorCampoCompleto(localizarCampo(bloco, "correlacao")),
    retencao: valorCampoCompleto(localizarCampo(bloco, "retencao")),
    motivo: valorCampoCompleto(localizarCampo(bloco, "motivo")),
  };
}

export function extrairContratoSegredos(bloco?: BlocoGenericoAst): ContratoSegredosSemantico {
  const itens = (bloco?.blocos ?? [])
    .filter((item): item is BlocoGenericoAst => item.tipo === "bloco_generico")
    .map((item) => ({
      nome: item.nome ?? item.palavraChave,
      origem: valorCampoCompleto(localizarCampo(item, "origem")),
      escopo: valorCampoCompleto(localizarCampo(item, "escopo")),
      acesso: valorCampoCompleto(localizarCampo(item, "acesso")),
      rotacao: valorCampoCompleto(localizarCampo(item, "rotacao")),
      naoLogar: parsearBooleanoSemantico(valorCampoCompleto(localizarCampo(item, "nao_logar"))),
      naoRetornar: parsearBooleanoSemantico(valorCampoCompleto(localizarCampo(item, "nao_retornar"))),
      mascarar: parsearBooleanoSemantico(valorCampoCompleto(localizarCampo(item, "mascarar"))),
    }))
    .filter((item) => item.nome && item.nome !== "desconhecido");

  return {
    explicita: Boolean(bloco),
    itens,
  };
}

export function extrairContratoForbidden(bloco?: BlocoGenericoAst): ContratoForbiddenSemantico {
  return {
    explicita: Boolean(bloco),
    regras: deduplicarTexto([
      ...(bloco?.linhas.map((linha) => linha.conteudo.trim()) ?? []),
      ...(bloco?.campos.map((campo) => valorCampoCompleto(campo) ?? campo.nome) ?? []),
    ]),
  };
}

export function classificacaoEhSensivel(classificacao?: string): boolean {
  return CLASSIFICACOES_DADO_SENSIVEIS.has((classificacao ?? "").trim().toLowerCase() as ClassificacaoDadoSemantico);
}

export function contratoDadosTemSensivel(contrato?: ContratoDadosSemantico): boolean {
  if (!contrato?.explicita) {
    return false;
  }
  if (classificacaoEhSensivel(contrato.classificacaoPadrao)) {
    return true;
  }
  return contrato.campos.some((campo) => classificacaoEhSensivel(campo.classificacao));
}

export function contratoDadosTemSegredoOuCredencial(contrato?: ContratoDadosSemantico): boolean {
  if (!contrato?.explicita) {
    return false;
  }
  const padrao = (contrato.classificacaoPadrao ?? "").trim().toLowerCase();
  if (padrao === "segredo" || padrao === "credencial") {
    return true;
  }
  return contrato.campos.some((campo) => {
    const classificacao = campo.classificacao.trim().toLowerCase();
    return classificacao === "segredo" || classificacao === "credencial";
  });
}

export function efeitoEhPrivilegiado(efeito: { categoria: string; criticidade?: string; privilegio?: string }): boolean {
  if (efeito.criticidade === "alta" || efeito.criticidade === "critica") {
    return true;
  }
  if (CATEGORIAS_EFEITO_PRIVILEGIADAS.has(efeito.categoria)) {
    return true;
  }
  return ["escrita", "publicacao", "execucao", "admin", "egress"].includes(efeito.privilegio ?? "");
}

export function efeitoRequerSegredo(efeito: { categoria: string }): boolean {
  return efeito.categoria === "secret.read";
}

export function forbiddenContemRegra(forbidden: ContratoForbiddenSemantico | undefined, regra: string): boolean {
  return Boolean(forbidden?.regras.some((item) => item === regra));
}

function deduplicarTexto(valores: string[]): string[] {
  return [...new Set(valores.filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
