// SEMA-GOVERNED: sema.produto.distribuicao_global.skill.intencoes
// Descrição: materializa a matriz de intenção da skill sem executar mutações.

import { versaoSemanticaValida } from "./versaoSemantica.js";

export const INTENCOES_SKILL_SEMA = [
  "INFORMAR",
  "INSTALAR_GLOBAL",
  "ATUALIZAR_GLOBAL",
  "REPARAR_GLOBAL",
  "ADOTAR_WORKSPACE",
] as const;

export type IntencaoSkillSema = typeof INTENCOES_SKILL_SEMA[number];

export type AcaoIntencaoSkillSema =
  | "npm_view_version:@semacode/cli@latest"
  | "validar_semver_exata_resolvida"
  | `npm_install_global:@semacode/cli@${string}`
  | "provar_cli_path_com_versao_e_skill"
  | "provar_launcher_gerenciado_com_versao_e_skill"
  | "preferir_launcher_gerenciado_se_path_stale_ou_sem_skill"
  | "provar_versao_instalada"
  | "consultar_status_distribuicao"
  | "sincronizar_distribuicao_se_necessario"
  | "consultar_status_final_ready"
  | "declarar_cli_indisponivel_apos_path_e_launcher_gerenciado_invalidos"
  | "responder_sem_mutar"
  | "pedir_autorizacao_adocao"
  | "descobrir_explicar_flow_project_adoption"
  | "iniciar_template_base"
  | "sync_codex"
  | "ler_agents_e_boot";

export interface EntradaIntencaoSkillSema {
  intencao: IntencaoSkillSema;
  versaoSolicitada?: string;
  cliDisponivel: boolean;
  adocaoAutorizada: boolean;
}

export interface PlanoIntencaoSkillSema {
  instalar_pacote_global: boolean;
  sincronizar_distribuicao_se_necessario: boolean;
  mutar_workspace: boolean;
  bloqueado_por_autorizacao_adocao: boolean;
  resolver_latest_para_semver_exata: boolean;
  provar_path_e_launcher_gerenciado: boolean;
  exigir_prova_versao: boolean;
  exigir_status_final_ready: boolean;
  acoes_ordenadas: AcaoIntencaoSkillSema[];
}

function versaoGlobalValidada(versao: string | undefined): {
  solicitada: string;
  resolverLatest: boolean;
} {
  if (versao === undefined || versao === "latest") {
    return { solicitada: "latest", resolverLatest: true };
  }
  if (versaoSemanticaValida(versao)) {
    return { solicitada: versao, resolverLatest: false };
  }
  throw new Error("VERSAO_GLOBAL_DEVE_SER_SEMVER_EXATA_OU_LATEST");
}

const ACOES_RESOLVER_CLI_INSTALADA = [
  "provar_cli_path_com_versao_e_skill",
  "provar_launcher_gerenciado_com_versao_e_skill",
  "preferir_launcher_gerenciado_se_path_stale_ou_sem_skill",
] as const satisfies readonly AcaoIntencaoSkillSema[];

const ACOES_PROVAR_AMBAS_CLI = [
  "provar_cli_path_com_versao_e_skill",
  "provar_launcher_gerenciado_com_versao_e_skill",
] as const satisfies readonly AcaoIntencaoSkillSema[];

export function planejarIntencaoSkillSema(
  entrada: EntradaIntencaoSkillSema,
): PlanoIntencaoSkillSema {
  if (["INSTALAR_GLOBAL", "ATUALIZAR_GLOBAL"].includes(entrada.intencao)) {
    const versao = versaoGlobalValidada(entrada.versaoSolicitada);
    const acoesInstalacao: AcaoIntencaoSkillSema[] = versao.resolverLatest
      ? [
          "npm_view_version:@semacode/cli@latest",
          "validar_semver_exata_resolvida",
          "npm_install_global:@semacode/cli@SEMVER_EXATA_RESOLVIDA",
        ]
      : [`npm_install_global:@semacode/cli@${versao.solicitada}`];
    return {
      instalar_pacote_global: true,
      sincronizar_distribuicao_se_necessario: true,
      mutar_workspace: false,
      bloqueado_por_autorizacao_adocao: false,
      resolver_latest_para_semver_exata: versao.resolverLatest,
      provar_path_e_launcher_gerenciado: true,
      exigir_prova_versao: true,
      exigir_status_final_ready: true,
      acoes_ordenadas: [
        ...acoesInstalacao,
        ...ACOES_RESOLVER_CLI_INSTALADA,
        "provar_versao_instalada",
        "consultar_status_distribuicao",
        "sincronizar_distribuicao_se_necessario",
        "consultar_status_final_ready",
      ],
    };
  }

  if (entrada.intencao === "REPARAR_GLOBAL") {
    const cliDisponivel = entrada.cliDisponivel;
    return {
      instalar_pacote_global: false,
      sincronizar_distribuicao_se_necessario: cliDisponivel,
      mutar_workspace: false,
      bloqueado_por_autorizacao_adocao: false,
      resolver_latest_para_semver_exata: false,
      provar_path_e_launcher_gerenciado: true,
      exigir_prova_versao: false,
      exigir_status_final_ready: cliDisponivel,
      acoes_ordenadas: cliDisponivel
        ? [
            ...ACOES_RESOLVER_CLI_INSTALADA,
            "consultar_status_distribuicao",
            "sincronizar_distribuicao_se_necessario",
            "consultar_status_final_ready",
          ]
        : [
            ...ACOES_PROVAR_AMBAS_CLI,
            "declarar_cli_indisponivel_apos_path_e_launcher_gerenciado_invalidos",
          ],
    };
  }

  if (entrada.intencao === "ADOTAR_WORKSPACE") {
    const autorizado = entrada.adocaoAutorizada;
    return {
      instalar_pacote_global: false,
      sincronizar_distribuicao_se_necessario: false,
      mutar_workspace: autorizado,
      bloqueado_por_autorizacao_adocao: !autorizado,
      resolver_latest_para_semver_exata: false,
      provar_path_e_launcher_gerenciado: false,
      exigir_prova_versao: false,
      exigir_status_final_ready: false,
      acoes_ordenadas: autorizado
        ? [
            "descobrir_explicar_flow_project_adoption",
            "iniciar_template_base",
            "sync_codex",
            "ler_agents_e_boot",
          ]
        : ["pedir_autorizacao_adocao"],
    };
  }

  return {
    instalar_pacote_global: false,
    sincronizar_distribuicao_se_necessario: false,
    mutar_workspace: false,
    bloqueado_por_autorizacao_adocao: false,
    resolver_latest_para_semver_exata: false,
    provar_path_e_launcher_gerenciado: false,
    exigir_prova_versao: false,
    exigir_status_final_ready: false,
    acoes_ordenadas: ["responder_sem_mutar"],
  };
}
