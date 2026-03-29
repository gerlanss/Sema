import type { IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import { normalizarNomeModulo, normalizarNomeParaSimbolo, mapearTipoParaTypeScript, type ArquivoGerado } from "@sema/padroes";

function gerarInterface(nome: string, campos: IrCampo[]): string {
  const propriedades = campos.length === 0
    ? "  // Sem campos declarados.\n"
    : campos.map((campo) => `  ${campo.nome}${campo.modificadores.includes("required") ? "" : "?"}: ${mapearTipoParaTypeScript(campo.tipo)};`).join("\n");
  return `export interface ${nome} {\n${propriedades}\n}\n`;
}

function gerarValidacoes(task: IrTask): string {
  const linhas: string[] = [];
  for (const campo of task.input) {
    if (campo.modificadores.includes("required")) {
      linhas.push(`  if (entrada.${campo.nome} === undefined || entrada.${campo.nome} === null) throw new Error("Campo obrigatorio ausente: ${campo.nome}");`);
    }
  }
  for (const regra of task.rules) {
    linhas.push(`  // Regra declarada em Sema: ${regra}`);
  }
  return linhas.join("\n");
}

function gerarGarantias(task: IrTask): string {
  if (task.guarantees.length === 0) {
    return "  // Nenhuma garantia declarada.\n  return saida;";
  }
  const linhas = task.guarantees.map((garantia) => `  // Garantia declarada em Sema: ${garantia}`);
  linhas.push("  return saida;");
  return linhas.join("\n");
}

function gerarTask(task: IrTask): string {
  const nomeSimbolo = normalizarNomeParaSimbolo(task.nome);
  const entradaNome = `${nomeSimbolo}_entrada`;
  const saidaNome = `${nomeSimbolo}_saida`;
  return `
${gerarInterface(`${task.nome}Entrada`, task.input)}
${gerarInterface(`${task.nome}Saida`, task.output)}
export type ${task.nome}Erro = ${Object.keys(task.errors).length === 0 ? "never" : Object.keys(task.errors).map((erro) => `"${erro}"`).join(" | ")};

export function validar_${nomeSimbolo}(entrada: ${task.nome}Entrada): void {
${gerarValidacoes(task)}
}

export async function executar_${nomeSimbolo}(entrada: ${task.nome}Entrada): Promise<${task.nome}Saida> {
  validar_${nomeSimbolo}(entrada);
  // Efeitos declarados:
${task.effects.map((efeito) => `  // - ${efeito}`).join("\n") || "  // - Nenhum efeito declarado."}
  const saida = {} as ${task.nome}Saida;
${gerarGarantias(task)}
}

export const ${entradaNome} = {} as ${task.nome}Entrada;
export const ${saidaNome} = {} as ${task.nome}Saida;
`;
}

function gerarTestes(modulo: IrModulo): string {
  const linhas = [
    'import test from "node:test";',
    'import assert from "node:assert/strict";',
    `import { ${modulo.tasks.map((task) => `executar_${normalizarNomeParaSimbolo(task.nome)}`).join(", ")} } from "./${normalizarNomeModulo(modulo.nome).replace(/\./g, "_")}.ts";`,
  ];

  for (const task of modulo.tasks) {
    const nomeFuncao = `executar_${normalizarNomeParaSimbolo(task.nome)}`;
    for (const caso of task.tests) {
      const entrada = Object.fromEntries(caso.given.campos.map((campo) => [campo.nome, `"${campo.tipo}"`]));
      linhas.push(`
test("${task.nome} :: ${caso.nome}", async () => {
  const entrada = ${JSON.stringify(entrada, null, 2)};
  const resultado = await ${nomeFuncao}(entrada as any);
  assert.ok(resultado !== undefined);
});
`);
    }
  }

  return linhas.join("\n");
}

export function gerarTypeScript(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const entidades = modulo.entities
    .map((entity) => gerarInterface(entity.nome, entity.campos))
    .join("\n");
  const enums = modulo.enums
    .map((enumeracao) => `export type ${enumeracao.nome} = ${enumeracao.valores.map((valor) => `"${valor}"`).join(" | ")};\n`)
    .join("\n");
  const states = modulo.states
    .map((state) => `// State${state.nome ? ` ${state.nome}` : ""}: campos=${state.campos.length} linhas=${state.linhas.length}`)
    .join("\n");
  const flows = modulo.flows
    .map((flow) => `// Flow ${flow.nome}: etapas=${flow.linhas.length} tasks=${flow.tasksReferenciadas.join(", ") || "nenhuma"}`)
    .join("\n");
  const routes = modulo.routes
    .map((route) => `// Route ${route.nome}: metodo=${route.metodo ?? "nao_definido"} caminho=${route.caminho ?? "nao_definido"} task=${route.task ?? "nao_definida"}`)
    .join("\n");
  const tasks = modulo.tasks.map(gerarTask).join("\n");

  const codigo = `// Arquivo gerado automaticamente pela Sema.\n// Modulo de origem: ${modulo.nome}\n\n${entidades}\n${enums}\n${states}\n${flows}\n${routes}\n${tasks}\n`;
  const testes = gerarTestes(modulo);

  return [
    { caminhoRelativo: `${nomeBase}.ts`, conteudo: codigo },
    { caminhoRelativo: `${nomeBase}.test.ts`, conteudo: testes },
  ];
}
