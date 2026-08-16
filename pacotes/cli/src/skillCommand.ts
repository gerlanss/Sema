// SEMA-GOVERNED: sema.produto.distribuicao_global, sema.produto.distribuicao_global.skill
// Descrição: expõe diagnóstico read-only e reparo explícito da distribuição global gerenciada.

import {
  sincronizarDistribuicaoGlobal,
  statusDistribuicaoGlobal,
  type ResultadoDistribuicaoGlobal,
} from "./distribuicao/index.js";

type OperacaoSkill = "status" | "sync";

interface PayloadSkill {
  schema: "sema.skill-distribution/v1";
  comando: "skill";
  operacao: OperacaoSkill;
  sucesso: boolean;
  resultado: ResultadoDistribuicaoGlobal;
}

export function renderizarResultadoSkill(
  operacao: OperacaoSkill,
  resultado: ResultadoDistribuicaoGlobal,
): string {
  const linhas = [
    `Distribuição global Sema (${operacao}): ${resultado.estado}`,
    `  Alterada: ${resultado.alterado ? "sim" : "não"}`,
    `  Launcher: ${resultado.launcher.estado} (${resultado.launcher.destino_simbolico})`,
    ...(resultado.launcher.fallback_simbolico
      ? [`  Fallback PowerShell: ${resultado.launcher.fallback_simbolico}`]
      : []),
    `  Diagnóstico launcher: ${resultado.launcher.codigo}`,
    `  Skill: ${resultado.skill.estado} (${resultado.skill.origem_simbolica})`,
    `  Destino .agents: ${resultado.skill.destino_agents}`,
    `  Destino Claude: ${resultado.skill.destino_claude}`,
    `  Diagnósticos skill: ${resultado.skill.destinos
      .map((destino) => `${destino.id}=${destino.codigo}`)
      .join(", ") || "nenhum"}`,
  ];
  return linhas.join("\n");
}

function imprimirSubcomandoInvalido(emJson: boolean): void {
  const mensagem = "Use `sema skill status` ou `sema skill sync`.";
  if (emJson) {
    console.log(JSON.stringify({
      schema: "sema.skill-distribution/v1",
      comando: "skill",
      sucesso: false,
      erro: {
        codigo: "SUBCOMANDO_SKILL_INVALIDO",
        mensagem,
      },
    }, null, 2));
    return;
  }
  console.error(mensagem);
}

export async function comandoSkill(
  posicionais: string[],
  args: string[],
  emJson: boolean,
): Promise<number> {
  const operacao = (posicionais[0] ?? "status").toLocaleLowerCase("en-US");
  const possuiArgumentoExtra = posicionais.length > 1;
  const possuiFlagDesconhecida = args.some(
    (arg) => arg.startsWith("-") && arg !== "--json",
  );
  if (
    (operacao !== "status" && operacao !== "sync")
    || possuiArgumentoExtra
    || possuiFlagDesconhecida
  ) {
    imprimirSubcomandoInvalido(emJson);
    return 1;
  }

  try {
    const resultado = operacao === "sync"
      ? await sincronizarDistribuicaoGlobal()
      : await statusDistribuicaoGlobal();
    const sucesso = resultado.estado === "READY";
    if (emJson) {
      const payload: PayloadSkill = {
        schema: "sema.skill-distribution/v1",
        comando: "skill",
        operacao,
        sucesso,
        resultado,
      };
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(renderizarResultadoSkill(operacao, resultado));
    }
    return sucesso ? 0 : 1;
  } catch {
    const mensagem = "Falha ao consultar ou sincronizar a distribuição global Sema.";
    if (emJson) {
      console.log(JSON.stringify({
        schema: "sema.skill-distribution/v1",
        comando: "skill",
        operacao,
        sucesso: false,
        erro: {
          codigo: "FALHA_DISTRIBUICAO_GLOBAL",
          mensagem,
        },
      }, null, 2));
    } else {
      console.error(mensagem);
    }
    return 1;
  }
}
