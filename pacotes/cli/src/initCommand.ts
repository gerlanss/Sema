// SEMA-GOVERNED: sema.produto.cli_init_templates, sema.produto.escrita_segura_workspace
// Descrição: inicializa projetos preservando arquivos existentes e bloqueando escapes do workspace.

import * as fs from "node:fs";
import path from "node:path";
import { escreverArquivos } from "./fsGovernado.js";
import { arquivosTemplateIniciar, type TemplateIniciar } from "./initTemplatesBase.js";
import { materializarExemplosOficiais, normalizarCaminhoExemplo, planejarExemplosOficiais } from "./exemplosOficiais.js";
import { validarDestinosEscritaWorkspace } from "./workspaceWrite.js";

async function sincronizarKitIaInicial(cwd: string): Promise<{
  artefatos: string[];
  codex: {
    arquivos: Array<{ caminho: string; status: "criado" | "atualizado" | "preservado" | "pendente" }>;
    criados: string[];
    atualizados: string[];
    preservados: string[];
    entrypointCodex: "AGENTS.md";
    codexNativo: true;
    cliLocalSemAutorizacao: true;
    entrypointsLegadosPendentes: string[];
    entrypointsLegadosLimpos: boolean;
  };
}> {
  const [{ gerarResumoProjetoIa }, { sincronizarEntrypointCodex }] = await Promise.all([
    import("./index.part04.js"),
    import("./agentEntryPoints.js"),
  ]);
  const resumoProjeto = await gerarResumoProjetoIa(cwd, undefined, true, {
    modo: "fresh",
    executar: true,
    avisos: [],
  });
  const indexJson = JSON.parse(fs.readFileSync(path.join(resumoProjeto.pastaSaida, "SEMA_INDEX.json"), "utf8"));
  const codex = await sincronizarEntrypointCodex(
    resumoProjeto.baseProjeto,
    indexJson.agentContextPack,
  );
  return {
    artefatos: [...new Set([
      ...resumoProjeto.artefatos,
      ...codex.arquivos.map((item) => item.caminho),
    ])],
    codex,
  };
}

const EXEMPLOS_STARTER_INICIAR = new Set([
  "exemplos/crud_simples.sema",
  "exemplos/cadastro_usuario.sema",
  "exemplos/pedido.sema",
  "exemplos/autenticacao.sema",
]);

export async function comandoIniciar(
  cwd: string,
  template: TemplateIniciar,
  opcoes: { force?: boolean; exemplosCompletos?: boolean } = {},
): Promise<number> {
  const arquivos = arquivosTemplateIniciar(template);
  const planoExemplos = await planejarExemplosOficiais();
  if (!planoExemplos.origem) {
    console.error("Diretorio de exemplos oficiais nao foi encontrado no pacote da CLI.");
    return 1;
  }
  const exemplosIniciar = opcoes.exemplosCompletos
    ? planoExemplos.arquivos
    : planoExemplos.arquivos.filter((arquivo) => EXEMPLOS_STARTER_INICIAR.has(normalizarCaminhoExemplo(arquivo.caminhoRelativo)));
  const [{ ARQUIVOS_RESUMO_PROJETO_IA }, { listarDestinosEntrypointCodex }] = await Promise.all([
    import("./index.part04.js"),
    import("./agentEntryPoints.js"),
  ]);
  const caminhosTemplate = new Set(arquivos.map((arquivo) => arquivo.caminhoRelativo));
  const destinos = await validarDestinosEscritaWorkspace(
    cwd,
    [
      ...caminhosTemplate,
      ...exemplosIniciar.map((arquivo) => arquivo.caminhoRelativo),
      ...ARQUIVOS_RESUMO_PROJETO_IA,
      ...listarDestinosEntrypointCodex("AGENTS.md"),
    ],
  );
  const existentes = new Set(
    destinos
      .filter((destino) => caminhosTemplate.has(destino.caminhoRelativo) && destino.existe)
      .map((destino) => destino.caminhoRelativo),
  );
  const arquivosParaEscrever = opcoes.force
    ? arquivos
    : arquivos.filter((arquivo) => !existentes.has(arquivo.caminhoRelativo));

  await escreverArquivos(cwd, arquivosParaEscrever, { inserirCabecalhoGovernado: true });
  const exemplos = await materializarExemplosOficiais(
    cwd,
    true,
    opcoes.exemplosCompletos ? undefined : EXEMPLOS_STARTER_INICIAR,
  );
  if (!exemplos.sucesso) {
    console.error(exemplos.erro);
    return 1;
  }
  const kitIa = await sincronizarKitIaInicial(cwd);
  if (!kitIa.codex.entrypointsLegadosLimpos) {
    console.error("Entrypoints Sema pendentes de revisão manual:");
    for (const caminho of kitIa.codex.entrypointsLegadosPendentes) {
      console.error(`- ${caminho}`);
    }
    return 1;
  }
  console.log(`Projeto Sema inicializado com template ${template}.`);
  console.log(`Arquivos do projeto: ${arquivosParaEscrever.length} escritos, ${opcoes.force ? 0 : existentes.size} preservados.`);
  console.log(`Exemplos oficiais sincronizados em ${exemplos.destino} (${exemplos.criados.length} criados, ${exemplos.preservados.length} preservados).`);
  if (!opcoes.exemplosCompletos) {
    console.log("Starter de exemplos instalado; rode sema instalar-exemplos ou sema iniciar --com-exemplos para o pacote completo.");
  }
  console.log(`Kit IA multi-agente sincronizado (${kitIa.artefatos.length} artefatos; entrypoint ${kitIa.codex.entrypointCodex}; ${kitIa.codex.criados.length} criados, ${kitIa.codex.atualizados.length} atualizados, ${kitIa.codex.preservados.length} preservados).`);
  return 0;
}

export async function comandoInstalarExemplos(emJson: boolean): Promise<number> {
  const resultado = await materializarExemplosOficiais(process.cwd(), true);
  const payload = {
    comando: "instalar-exemplos",
    ...resultado,
  };

  if (emJson) {
    console.log(JSON.stringify(payload, null, 2));
    return resultado.sucesso ? 0 : 1;
  }

  if (!resultado.sucesso) {
    console.error(resultado.erro ?? "Falha ao instalar exemplos oficiais.");
    return 1;
  }

  console.log("Exemplos oficiais sincronizados");
  console.log(`- Origem: ${resultado.origem}`);
  console.log(`- Destino: ${resultado.destino}`);
  console.log(`- Criados: ${resultado.criados.length}`);
  console.log(`- Preservados: ${resultado.preservados.length}`);
  return 0;
}
