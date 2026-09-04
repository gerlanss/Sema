// SEMA-GOVERNED: sema.produto.cli_init_templates, sema.produto.escrita_segura_workspace
// Descrição: inicializa projetos preservando arquivos existentes e bloqueando escapes do workspace.

import * as fs from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { escreverArquivos } from "./fsGovernado.js";
import { arquivosTemplateIniciar, type TemplateIniciar } from "./initTemplatesBase.js";
import { materializarExemplosOficiais, normalizarCaminhoExemplo, planejarExemplosOficiais } from "./exemplosOficiais.js";
import { carregarConfiguracaoProjeto } from "./projetoConfig.js";
import { escreverArquivoWorkspaceSeguro, validarDestinosEscritaWorkspace } from "./workspaceWrite.js";

async function registrarSubpastaNoConfigAncestral(caminhoConfig: string, subpastaAbsoluta: string): Promise<void> {
  const basePai = path.dirname(caminhoConfig);
  const relativoSubpasta = `./${path.relative(basePai, subpastaAbsoluta).replace(/\\/g, "/")}`;
  try {
    const configPai = JSON.parse(await readFile(caminhoConfig, "utf8")) as Record<string, unknown>;
    const diretoriosAtuais = Array.isArray(configPai.diretoriosCodigo)
      ? configPai.diretoriosCodigo.filter((valor): valor is string => typeof valor === "string")
      : [];
    const jaRegistrado = diretoriosAtuais.some((diretorio) =>
      diretorio.replace(/\\/g, "/").toLowerCase() === relativoSubpasta.toLowerCase());
    if (jaRegistrado) {
      console.log(`Subpasta ${relativoSubpasta} ja consta em diretoriosCodigo de ${caminhoConfig}.`);
      return;
    }
    configPai.diretoriosCodigo = [...diretoriosAtuais, relativoSubpasta];
    await escreverArquivoWorkspaceSeguro(basePai, "sema.config.json", `${JSON.stringify(configPai, null, 2)}\n`, { sobrescrever: true });
    console.log(`Subpasta ${relativoSubpasta} registrada em diretoriosCodigo de ${caminhoConfig}.`);
  } catch (erro) {
    console.error(`Nao foi possivel registrar a subpasta no config do workspace pai: ${erro instanceof Error ? erro.message : String(erro)}`);
    console.error(`Adicione "${relativoSubpasta}" a diretoriosCodigo em ${caminhoConfig} para o drift cobrir esta subpasta.`);
  }
}

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
  const arquivosCompletos = arquivosTemplateIniciar(template);
  const configAncestral = await carregarConfiguracaoProjeto(cwd);
  const subpastaGovernada = Boolean(configAncestral
    && path.resolve(configAncestral.baseDiretorio) !== path.resolve(cwd));
  // Em subpasta de workspace ja governado o config do template e omitido: a
  // subpasta e registrada nos diretoriosCodigo do sema.config.json ancestral
  // e o lookup de workspace continua subindo para o pai.
  const arquivos = subpastaGovernada && configAncestral
    ? arquivosCompletos.filter((arquivo) => arquivo.caminhoRelativo !== "sema.config.json")
    : arquivosCompletos;
  if (subpastaGovernada && configAncestral) {
    await registrarSubpastaNoConfigAncestral(configAncestral.caminho, path.resolve(cwd));
  }
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
