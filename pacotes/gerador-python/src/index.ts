import type { IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import { mapearTipoParaPython, normalizarNomeModulo, normalizarNomeParaSimbolo, type ArquivoGerado } from "@sema/padroes";

function gerarDataclass(nome: string, campos: IrCampo[]): string {
  const linhas = campos.length === 0
    ? "    pass"
    : campos.map((campo) => {
      const tipoBase = mapearTipoParaPython(campo.tipo);
      if (campo.modificadores.includes("required")) {
        return `    ${campo.nome}: ${tipoBase}`;
      }
      return `    ${campo.nome}: ${tipoBase} | None = None`;
    }).join("\n");
  return `@dataclass\nclass ${nome}:\n${linhas}\n`;
}

function gerarTask(task: IrTask): string {
  const nome = normalizarNomeParaSimbolo(task.nome);
  const validacoes = [
    ...task.input
      .filter((campo) => campo.modificadores.includes("required"))
      .map((campo) => `    if entrada.${campo.nome} is None:\n        raise ValueError("Campo obrigatorio ausente: ${campo.nome}")`),
    ...task.rules.map((regra) => `    # Regra declarada em Sema: ${regra}`),
  ].join("\n");

  const efeitos = task.effects.length === 0
    ? "    # Nenhum efeito declarado."
    : task.effects.map((efeito) => `    # Efeito declarado: ${efeito}`).join("\n");

  const garantias = task.guarantees.length === 0
    ? "    return saida"
    : `${task.guarantees.map((garantia) => `    # Garantia declarada em Sema: ${garantia}`).join("\n")}\n    return saida`;

  return `
${gerarDataclass(`${task.nome}Entrada`, task.input)}
${gerarDataclass(`${task.nome}Saida`, task.output)}

def validar_${nome}(entrada: ${task.nome}Entrada) -> None:
${validacoes || "    pass"}

def executar_${nome}(entrada: ${task.nome}Entrada) -> ${task.nome}Saida:
    validar_${nome}(entrada)
${efeitos}
    saida = ${task.nome}Saida(${task.output.map((campo) => `${campo.nome}=None`).join(", ")})
${garantias}
`;
}

function gerarTestes(modulo: IrModulo): string {
  const linhas = ["import pytest", `from ${normalizarNomeModulo(modulo.nome).replace(/\./g, "_")} import *`, ""];
  for (const task of modulo.tasks) {
    const nomeFuncao = `executar_${normalizarNomeParaSimbolo(task.nome)}`;
    for (const caso of task.tests) {
      const argumentos = caso.given.campos.map((campo) => `${campo.nome}="${campo.tipo}"`).join(", ");
      linhas.push(`def test_${normalizarNomeParaSimbolo(task.nome)}_${normalizarNomeParaSimbolo(caso.nome)}() -> None:\n    entrada = ${task.nome}Entrada(${argumentos})\n    resultado = ${nomeFuncao}(entrada)\n    assert resultado is not None\n`);
    }
  }
  return linhas.join("\n");
}

export function gerarPython(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const enums = modulo.enums.map((enumeracao) => `class ${enumeracao.nome}:\n${enumeracao.valores.map((valor) => `    ${valor} = "${valor}"`).join("\n")}\n`).join("\n");
  const entidades = modulo.entities.map((entity) => gerarDataclass(entity.nome, entity.campos)).join("\n");
  const states = modulo.states.map((state) => `# State${state.nome ? ` ${state.nome}` : ""}: campos=${state.campos.length} linhas=${state.linhas.length}`).join("\n");
  const flows = modulo.flows.map((flow) => `# Flow ${flow.nome}: etapas=${flow.linhas.length} tasks=${flow.tasksReferenciadas.join(", ") || "nenhuma"}`).join("\n");
  const routes = modulo.routes.map((route) => `# Route ${route.nome}: metodo=${route.metodo ?? "nao_definido"} caminho=${route.caminho ?? "nao_definido"} task=${route.task ?? "nao_definida"}`).join("\n");
  const tasks = modulo.tasks.map(gerarTask).join("\n");

  const codigo = `# Arquivo gerado automaticamente pela Sema.\n# Modulo de origem: ${modulo.nome}\n\nfrom dataclasses import dataclass\n\n${enums}\n${entidades}\n${states}\n${flows}\n${routes}\n${tasks}\n`;
  const testes = gerarTestes(modulo);

  return [
    { caminhoRelativo: `${nomeBase}.py`, conteudo: codigo },
    { caminhoRelativo: `test_${nomeBase}.py`, conteudo: testes },
  ];
}
