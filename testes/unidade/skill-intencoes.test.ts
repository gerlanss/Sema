// SEMA-GOVERNED: sema.produto.distribuicao_global.skill.intencoes
// Descrição: prova que a política executável e a skill publicada separam distribuição de adoção.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  planejarIntencaoSkillSema,
  type EntradaIntencaoSkillSema,
} from "../../pacotes/cli/src/distribuicao/skillIntentPolicy.js";

const raizRepositorio = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const caminhoSkill = path.join(raizRepositorio, "plugins", "sema", "skills", "sema", "SKILL.md");
const caminhoOpenAi = path.join(
  raizRepositorio,
  "plugins",
  "sema",
  "skills",
  "sema",
  "agents",
  "openai.yaml",
);

function planejar(
  intencao: EntradaIntencaoSkillSema["intencao"],
  complemento: Partial<EntradaIntencaoSkillSema> = {},
) {
  return planejarIntencaoSkillSema({
    intencao,
    cliDisponivel: true,
    adocaoAutorizada: false,
    ...complemento,
  });
}

test("install e update sempre instalam a versão pedida antes de provar distribuição", () => {
  for (const intencao of ["INSTALAR_GLOBAL", "ATUALIZAR_GLOBAL"] as const) {
    const plano = planejar(intencao, { versaoSolicitada: "3.0.0", cliDisponivel: true });
    assert.equal(plano.instalar_pacote_global, true);
    assert.equal(plano.mutar_workspace, false);
    assert.equal(plano.resolver_latest_para_semver_exata, false);
    assert.equal(plano.provar_path_e_launcher_gerenciado, true);
    assert.equal(plano.exigir_prova_versao, true);
    assert.equal(plano.exigir_status_final_ready, true);
    assert.deepEqual(plano.acoes_ordenadas, [
      "npm_install_global:@semacode/cli@3.0.0",
      "provar_cli_path_com_versao_e_skill",
      "provar_launcher_gerenciado_com_versao_e_skill",
      "preferir_launcher_gerenciado_se_path_stale_ou_sem_skill",
      "provar_versao_instalada",
      "consultar_status_distribuicao",
      "sincronizar_distribuicao_se_necessario",
      "consultar_status_final_ready",
    ]);
  }

  for (const plano of [
    planejar("ATUALIZAR_GLOBAL", { versaoSolicitada: "latest" }),
    planejar("INSTALAR_GLOBAL"),
  ]) {
    assert.equal(plano.resolver_latest_para_semver_exata, true);
    assert.deepEqual(plano.acoes_ordenadas.slice(0, 3), [
      "npm_view_version:@semacode/cli@latest",
      "validar_semver_exata_resolvida",
      "npm_install_global:@semacode/cli@SEMVER_EXATA_RESOLVIDA",
    ]);
    assert.equal(
      plano.acoes_ordenadas.includes("npm_install_global:@semacode/cli@latest"),
      false,
    );
  }
  assert.throws(
    () => planejar("ATUALIZAR_GLOBAL", { versaoSolicitada: "next; echo unsafe" }),
    /VERSAO_GLOBAL_DEVE_SER_SEMVER_EXATA_OU_LATEST/u,
  );
});

test("repair sincroniza a instalação atual sem instalar nem adotar", () => {
  const pronto = planejar("REPARAR_GLOBAL");
  assert.equal(pronto.instalar_pacote_global, false);
  assert.equal(pronto.sincronizar_distribuicao_se_necessario, true);
  assert.equal(pronto.mutar_workspace, false);
  assert.equal(pronto.provar_path_e_launcher_gerenciado, true);
  assert.deepEqual(pronto.acoes_ordenadas, [
    "provar_cli_path_com_versao_e_skill",
    "provar_launcher_gerenciado_com_versao_e_skill",
    "preferir_launcher_gerenciado_se_path_stale_ou_sem_skill",
    "consultar_status_distribuicao",
    "sincronizar_distribuicao_se_necessario",
    "consultar_status_final_ready",
  ]);

  const indisponivel = planejar("REPARAR_GLOBAL", { cliDisponivel: false });
  assert.equal(indisponivel.sincronizar_distribuicao_se_necessario, false);
  assert.deepEqual(indisponivel.acoes_ordenadas, [
    "provar_cli_path_com_versao_e_skill",
    "provar_launcher_gerenciado_com_versao_e_skill",
    "declarar_cli_indisponivel_apos_path_e_launcher_gerenciado_invalidos",
  ]);
});

test("informação não muta e adoção exige autorização explícita", () => {
  assert.deepEqual(planejar("INFORMAR"), {
    instalar_pacote_global: false,
    sincronizar_distribuicao_se_necessario: false,
    mutar_workspace: false,
    bloqueado_por_autorizacao_adocao: false,
    resolver_latest_para_semver_exata: false,
    provar_path_e_launcher_gerenciado: false,
    exigir_prova_versao: false,
    exigir_status_final_ready: false,
    acoes_ordenadas: ["responder_sem_mutar"],
  });

  const bloqueado = planejar("ADOTAR_WORKSPACE");
  assert.equal(bloqueado.bloqueado_por_autorizacao_adocao, true);
  assert.equal(bloqueado.mutar_workspace, false);
  assert.deepEqual(bloqueado.acoes_ordenadas, ["pedir_autorizacao_adocao"]);

  const autorizado = planejar("ADOTAR_WORKSPACE", { adocaoAutorizada: true });
  assert.equal(autorizado.bloqueado_por_autorizacao_adocao, false);
  assert.equal(autorizado.mutar_workspace, true);
  assert.deepEqual(autorizado.acoes_ordenadas, [
    "descobrir_explicar_flow_project_adoption",
    "iniciar_template_base",
    "sync_codex",
    "ler_agents_e_boot",
  ]);
});

test("skill publicada contém comandos e fronteiras da matriz de intenção", async () => {
  const [skill, openAi] = await Promise.all([
    readFile(caminhoSkill, "utf8"),
    readFile(caminhoOpenAi, "utf8"),
  ]);

  const resolverLatest = skill.indexOf("npm view @semacode/cli@latest version --json");
  const install = skill.indexOf("npm install --global @semacode/cli@<resolved-exact-semver>");
  const versao = skill.indexOf("Probe both CLI candidates");
  const status = skill.indexOf("Run `sema skill status --json`");
  assert.ok(resolverLatest >= 0 && resolverLatest < install && install < versao && versao < status);
  assert.doesNotMatch(skill, /npm install --global @semacode\/cli@latest/u);
  assert.match(skill, /Run that `npm install --global` even when an older `sema --version` already\s+works/u);
  assert.match(skill, /prefer the managed candidate[\s\S]*stale[\s\S]*does not support `sema skill status --json`/u);
  assert.match(skill, /Do not declare Sema unavailable until both candidates have failed validation/u);
  assert.match(skill, /Repair may synchronize the current\s+launcher and skill, but\s+must not run `npm install`/u);
  assert.match(skill, /Never treat a request to install, update, or repair[\s\S]*permission to adopt/u);

  const explicar = skill.indexOf("sema descobrir explicar flow.project-adoption --json");
  const iniciar = skill.indexOf("sema iniciar --template base");
  const sync = skill.indexOf("sema sync-codex --json");
  assert.ok(explicar >= 0 && explicar < iniciar && iniciar < sync);
  assert.match(skill, /runtime access gates[\s\S]*does not waive explicit human\s+authorization for workspace adoption/u);
  assert.match(openAi, /install|update/iu);
  assert.match(openAi, /repair/iu);
  assert.match(openAi, /adopt/iu);
});
