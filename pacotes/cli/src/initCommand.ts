// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: comandos de inicializa??o de projeto e sincroniza??o de exemplos oficiais da CLI.

import * as fs from "node:fs";
import path from "node:path";
import { escreverArquivos } from "./fsGovernado.js";
import { arquivosTemplateIniciar, type TemplateIniciar } from "./initTemplatesBase.js";
import { materializarExemplosOficiais } from "./exemplosOficiais.js";

async function sincronizarKitIaInicial(cwd: string): Promise<{
  artefatos: string[];
  clientes: { criados: string[]; atualizados: string[]; preservados: string[] };
}> {
  const [{ gerarResumoProjetoIa }, { sincronizarEntryPointsAgentes }] = await Promise.all([
    import("./index.part04.js"),
    import("./agentEntryPoints.js"),
  ]);
  const resumoProjeto = await gerarResumoProjetoIa(cwd, undefined, true);
  const indexJson = JSON.parse(fs.readFileSync(path.join(resumoProjeto.pastaSaida, "SEMA_INDEX.json"), "utf8"));
  const clientes = await sincronizarEntryPointsAgentes(
    resumoProjeto.baseProjeto,
    indexJson.agentContextPack,
  );
  return {
    artefatos: [...new Set([
      ...resumoProjeto.artefatos,
      ...clientes.arquivos.map((item) => item.caminho),
    ])],
    clientes,
  };
}

export async function comandoIniciar(cwd: string, template: TemplateIniciar): Promise<number> {
  const arquivos = arquivosTemplateIniciar(template);


  await escreverArquivos(cwd, arquivos, { inserirCabecalhoGovernado: true });
  const exemplos = await materializarExemplosOficiais(cwd, true);
  if (!exemplos.sucesso) {
    console.error(exemplos.erro);
    return 1;
  }
  const kitIa = await sincronizarKitIaInicial(cwd);
  console.log(`Projeto Sema inicializado com template ${template}.`);
  console.log(`Exemplos oficiais sincronizados em ${exemplos.destino} (${exemplos.criados.length} criados, ${exemplos.preservados.length} preservados).`);
  console.log(`Kit IA sincronizado (${kitIa.artefatos.length} artefatos; clientes ${kitIa.clientes.criados.length} criados, ${kitIa.clientes.atualizados.length} atualizados, ${kitIa.clientes.preservados.length} preservados).`);
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
