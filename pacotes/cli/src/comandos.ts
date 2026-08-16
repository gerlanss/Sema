// SEMA-GOVERNED: sema.governanca_ia_contexto, sema.produto.distribuicao_global, sema.produto.cli_invocacao_publica.argumentos
// Descricao: dispatcher de comandos publicos da CLI local; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { comandoDev } from "./dev/index.js";
import { comandoInit } from "./init/index.js";
import { comandoSyncPrisma } from "./sync/index.js";
import { comandoPipelineConteudo } from "./pipelineConteudo/command.js";
import { REGISTRO_HANDLERS_DESCOBERTA } from "./discovery/index.js";
import { comandoSistemasInterativos } from "./sistemasInterativos/command.js";
import { comandoSkill } from "./skillCommand.js";

export type HandlerComando = (
  posicionais: string[],
  args: string[],
  emJson: boolean,
) => Promise<number>;

async function comandoInitHandler(
  posicionais: string[],
  args: string[],
  _emJson: boolean,
): Promise<number> {
  await comandoInit([...posicionais, ...args]);
  return 0;
}

async function comandoDevHandler(
  posicionais: string[],
  args: string[],
  _emJson: boolean,
): Promise<number> {
  await comandoDev([...posicionais, ...args]);
  return 0;
}

async function comandoSyncPrismaHandler(
  posicionais: string[],
  args: string[],
  _emJson: boolean,
): Promise<number> {
  await comandoSyncPrisma([...posicionais, ...args]);
  return 0;
}

async function comandoGuard(
  posicionais: string[],
  _args: string[],
  emJson: boolean,
): Promise<number> {
  const { ativarGuarda, desativarGuarda, statusGuarda } = await import("./guard.js");
  const baseProjeto = process.cwd();
  const subcomando = posicionais[0] ?? "status";

  const resultado = subcomando === "on"
    ? await ativarGuarda(baseProjeto)
    : subcomando === "off"
      ? await desativarGuarda(baseProjeto)
      : await statusGuarda(baseProjeto);

  if (emJson) {
    console.log(JSON.stringify(resultado, null, 2));
  } else {
    console.log(resultado.mensagem ?? `Guarda: ${resultado.sucesso ? "ok" : "falha"}`);
    if (resultado.estado) {
      console.log(`  Ativo: ${resultado.estado.ativo ? "sim" : "nao"}`);
      console.log(`  Docs-impacto: ${resultado.estado.docsImpactoChamado ? "chamado" : "pendente"}`);
      if (resultado.estado.intencao) {
        console.log(`  Intencao: ${resultado.estado.intencao}`);
      }
    }
  }

  return resultado.sucesso ? 0 : 1;
}

export const REGISTRO_COMANDOS: Record<string, HandlerComando> = {
  guard: comandoGuard,
  init: comandoInitHandler,
  dev: comandoDevHandler,
  sync: comandoSyncPrismaHandler,
  conteudo: comandoPipelineConteudo,
  interativo: comandoSistemasInterativos,
  skill: comandoSkill,
  ...REGISTRO_HANDLERS_DESCOBERTA,
};
