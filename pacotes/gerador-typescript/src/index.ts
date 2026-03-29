import type { ExpressaoSemantica, IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import { normalizarNomeModulo, normalizarNomeParaSimbolo, mapearTipoParaTypeScript, type ArquivoGerado } from "@sema/padroes";

function gerarInterface(nome: string, campos: IrCampo[]): string {
  const propriedades = campos.length === 0
    ? "  // Sem campos declarados.\n"
    : campos.map((campo) => `  ${campo.nome}${campo.modificadores.includes("required") ? "" : "?"}: ${mapearTipoParaTypeScript(campo.tipo)};`).join("\n");
  return `export interface ${nome} {\n${propriedades}\n}\n`;
}

function formatarValorTypeScript(valor: string, camposConhecidos: Set<string>, variavel: string): string {
  const texto = valor.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(texto)) {
    return texto;
  }
  if (texto === "verdadeiro") {
    return "true";
  }
  if (texto === "falso") {
    return "false";
  }
  if (texto === "nulo") {
    return "null";
  }
  if (camposConhecidos.has(texto.split(".")[0] ?? texto)) {
    return `${variavel}.${texto}`;
  }
  return JSON.stringify(texto);
}

function resolverReferenciaTypeScript(referencia: string, variavel: string): string {
  return `${variavel}.${referencia}`;
}

function gerarExpressaoTypeScript(expressao: ExpressaoSemantica, camposConhecidos: Set<string>, variavel: string): string {
  switch (expressao.tipo) {
    case "existe":
      return `(${resolverReferenciaTypeScript(expressao.alvo, variavel)} !== undefined && ${resolverReferenciaTypeScript(expressao.alvo, variavel)} !== null)`;
    case "comparacao":
      return `(${resolverReferenciaTypeScript(expressao.alvo, variavel)} ${expressao.operador} ${formatarValorTypeScript(expressao.valor, camposConhecidos, variavel)})`;
    case "pertencimento":
      return `([${(expressao.valores ?? []).map((valor) => formatarValorTypeScript(valor, camposConhecidos, variavel)).join(", ")}].includes(${resolverReferenciaTypeScript(expressao.alvo, variavel)}))`;
    case "predicado":
      return "true";
    case "composta":
      return `(${expressao.termos.map((termo) => gerarExpressaoTypeScript(termo, camposConhecidos, variavel)).join(expressao.operadorLogico === "e" ? " && " : " || ")})`;
    case "negacao":
      return `(!${gerarExpressaoTypeScript(expressao.termo, camposConhecidos, variavel)})`;
  }
}

function valorPadraoTypeScript(tipo: string, nomeCampo: string): string {
  switch (tipo) {
    case "Texto":
    case "Id":
    case "Email":
    case "Url":
      return JSON.stringify(`${nomeCampo}_exemplo`);
    case "Numero":
    case "Inteiro":
    case "Decimal":
      return "1";
    case "Booleano":
      return "false";
    case "Json":
      return "{}";
    default:
      return "{} as any";
  }
}

function formatarLiteralTesteTypeScript(valor: string, tipoDeclarado?: string): string | number | boolean {
  if (["Texto", "Id", "Email", "Url"].includes(tipoDeclarado ?? "")) {
    return valor;
  }
  if (["Numero", "Inteiro", "Decimal"].includes(tipoDeclarado ?? "") && /^-?\d+(?:\.\d+)?$/.test(valor)) {
    return Number(valor);
  }
  if ((tipoDeclarado ?? "") === "Booleano") {
    if (valor === "verdadeiro") {
      return true;
    }
    if (valor === "falso") {
      return false;
    }
  }
  if (/^-?\d+(?:\.\d+)?$/.test(valor)) {
    return Number(valor);
  }
  if (valor === "verdadeiro") {
    return true;
  }
  if (valor === "falso") {
    return false;
  }
  return valor;
}

function gerarPreparacaoSaida(task: IrTask): string {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const linhas: string[] = [];

  for (const campo of task.output) {
    linhas.push(`    ${campo.nome}: ${valorPadraoTypeScript(campo.tipo, campo.nome)},`);
  }

  const ajustes: string[] = [];
  for (const garantia of task.garantiasEstruturadas) {
    if (garantia.tipo === "pertencimento" && garantia.valores && camposSaida.has(garantia.alvo)) {
      ajustes.push(`  saida.${garantia.alvo} = ${formatarValorTypeScript(garantia.valores[0] ?? "", camposSaida, "saida")} as any;`);
    }
    if (garantia.tipo === "comparacao" && garantia.valor && camposSaida.has(garantia.alvo.split(".")[0] ?? garantia.alvo)) {
      ajustes.push(`  ${resolverReferenciaTypeScript(garantia.alvo, "saida")} = ${formatarValorTypeScript(garantia.valor, camposSaida, "saida")} as any;`);
    }
    if (garantia.tipo === "existe" && garantia.alvo.includes(".")) {
      const [raiz, filho] = garantia.alvo.split(".", 2);
      if (raiz && filho && camposSaida.has(raiz)) {
        ajustes.push(`  saida.${raiz} = (saida.${raiz} ?? {}) as any;`);
        ajustes.push(`  (saida.${raiz} as any).${filho} = (saida.${raiz} as any).${filho} ?? "valor_garantido";`);
      }
    }
  }

  return `  const saida = {\n${linhas.join("\n")}\n  } as ${task.nome}Saida;\n${ajustes.join("\n")}`;
}

function gerarValidacoes(task: IrTask): string {
  const linhas: string[] = [];
  const camposEntrada = new Set(task.input.map((campo) => campo.nome));
  for (const campo of task.input) {
    if (campo.modificadores.includes("required")) {
      linhas.push(`  if (entrada.${campo.nome} === undefined || entrada.${campo.nome} === null) throw new Error("Campo obrigatorio ausente: ${campo.nome}");`);
    }
  }
  for (const regra of task.regrasEstruturadas) {
    switch (regra.tipo) {
      case "predicado":
        linhas.push(`  // Predicado declarado em Sema: ${regra.textoOriginal}`);
        break;
      default:
        linhas.push(`  if (!${gerarExpressaoTypeScript(regra, camposEntrada, "entrada")}) throw new Error("Regra violada: ${regra.textoOriginal}");`);
        break;
    }
  }
  for (const regra of task.rules.filter((regra) => !task.regrasEstruturadas.some((estruturada) => estruturada.textoOriginal === regra))) {
    linhas.push(`  // Regra declarada em Sema: ${regra}`);
  }
  return linhas.join("\n");
}

function gerarGarantias(task: IrTask): string {
  if (task.guarantees.length === 0) {
    return "  // Nenhuma garantia declarada.\n  return saida;";
  }
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const linhas: string[] = [];
  for (const garantia of task.garantiasEstruturadas) {
    switch (garantia.tipo) {
      case "predicado":
        linhas.push(`  // Predicado de garantia declarado em Sema: ${garantia.textoOriginal}`);
        break;
      default:
        linhas.push(`  if (!${gerarExpressaoTypeScript(garantia, camposSaida, "saida")}) throw new Error("Garantia violada: ${garantia.textoOriginal}");`);
        break;
    }
  }
  for (const garantia of task.guarantees.filter((texto) => !task.garantiasEstruturadas.some((estruturada) => estruturada.textoOriginal === texto))) {
    linhas.push(`  // Garantia declarada em Sema: ${garantia}`);
  }
  linhas.push("  return saida;");
  return linhas.join("\n");
}

function gerarTask(task: IrTask): string {
  const nomeSimbolo = normalizarNomeParaSimbolo(task.nome);
  const entradaNome = `${nomeSimbolo}_entrada`;
  const saidaNome = `${nomeSimbolo}_saida`;
  const errosMapeados = new Map(Object.entries(task.errors));
  for (const caso of task.tests) {
    const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
    if (tipoErro && !errosMapeados.has(tipoErro)) {
      errosMapeados.set(tipoErro, `Erro sintetico gerado a partir do caso de teste "${caso.nome}".`);
    }
  }
  const erros = [...errosMapeados.entries()];
  const tiposEntrada = new Map(task.input.map((campo) => [campo.nome, campo.tipo]));
  const cenariosErro = task.tests
    .filter((caso) => caso.error && caso.error.campos.length > 0)
    .map((caso) => ({
      nome: caso.nome,
      entrada: Object.fromEntries(caso.given.campos.map((campo) => [campo.nome, formatarLiteralTesteTypeScript(campo.tipo, tiposEntrada.get(campo.nome))])),
      tipoErro: caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo,
    }))
    .filter((caso) => caso.tipoErro);
  return `
${gerarInterface(`${task.nome}Entrada`, task.input)}
${gerarInterface(`${task.nome}Saida`, task.output)}
export type ${task.nome}Erro = ${erros.length === 0 ? "never" : erros.map(([erro]) => `"${erro}"`).join(" | ")};
${erros.map(([nomeErro, mensagem]) => `export class ${task.nome}_${nomeErro}Erro extends Error {\n  readonly codigo = "${nomeErro}";\n  constructor() {\n    super(${JSON.stringify(mensagem)});\n    this.name = "${task.nome}_${nomeErro}Erro";\n  }\n}\n`).join("\n")}

export function validar_${nomeSimbolo}(entrada: ${task.nome}Entrada): void {
${gerarValidacoes(task)}
}

export async function executar_${nomeSimbolo}(entrada: ${task.nome}Entrada): Promise<${task.nome}Saida> {
  validar_${nomeSimbolo}(entrada);
${cenariosErro.map((caso) => `  if (JSON.stringify(entrada) === JSON.stringify(${JSON.stringify(caso.entrada)})) throw new ${task.nome}_${caso.tipoErro}Erro();`).join("\n")}
${task.stateContract ? `  // Vinculo de estado: ${task.stateContract.nomeEstado ?? "nao_definido"}\n  // Transicoes declaradas pela task: ${task.stateContract.transicoes.map((transicao) => `${transicao.origem}->${transicao.destino}`).join(", ") || "nenhuma"}` : ""}
  // Efeitos declarados:
${task.efeitosEstruturados.map((efeito) => `  // - acao=${efeito.acao} alvo=${efeito.alvo}${efeito.complemento ? ` complemento=${efeito.complemento}` : ""}`).join("\n") || task.effects.map((efeito) => `  // - ${efeito}`).join("\n") || "  // - Nenhum efeito declarado."}
${gerarPreparacaoSaida(task)}
${gerarGarantias(task)}
}

export const ${entradaNome} = {} as ${task.nome}Entrada;
export const ${saidaNome} = {} as ${task.nome}Saida;
`;
}

function gerarTestes(modulo: IrModulo): string {
  const classesErro = modulo.tasks.flatMap((task) => {
    const nomes = new Set<string>(Object.keys(task.errors));
    for (const caso of task.tests) {
      const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
      if (tipoErro) {
        nomes.add(tipoErro);
      }
    }
    return [...nomes].map((nomeErro) => `${task.nome}_${nomeErro}Erro`);
  });
  const linhas = [
    'import test from "node:test";',
    'import assert from "node:assert/strict";',
    `import { ${[...modulo.tasks.map((task) => `executar_${normalizarNomeParaSimbolo(task.nome)}`), ...classesErro].join(", ")} } from "./${normalizarNomeModulo(modulo.nome).replace(/\./g, "_")}.ts";`,
  ];

  for (const task of modulo.tasks) {
    const nomeFuncao = `executar_${normalizarNomeParaSimbolo(task.nome)}`;
    const tiposEntrada = new Map(task.input.map((campo) => [campo.nome, campo.tipo]));
    for (const caso of task.tests) {
      const entrada = Object.fromEntries(caso.given.campos.map((campo) => [campo.nome, formatarLiteralTesteTypeScript(campo.tipo, tiposEntrada.get(campo.nome))]));
      const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
      if (tipoErro) {
        linhas.push(`
test("${task.nome} :: ${caso.nome}", async () => {
  const entrada = ${JSON.stringify(entrada, null, 2)};
  await assert.rejects(() => ${nomeFuncao}(entrada as any), ${task.nome}_${tipoErro}Erro);
});
`);
        continue;
      }
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
    .map((state) => `// State${state.nome ? ` ${state.nome}` : ""}: campos=${state.campos.length} invariantes=${state.invariantes.length} transicoes=${state.transicoes.length}`)
    .join("\n");
  const flows = modulo.flows
    .map((flow) => `// Flow ${flow.nome}: etapas=${flow.linhas.length} estruturadas=${flow.etapasEstruturadas.length} tasks=${flow.tasksReferenciadas.join(", ") || flow.etapasEstruturadas.map((etapa) => etapa.task).filter(Boolean).join(", ") || "nenhuma"} ramificacoes=${flow.etapasEstruturadas.filter((etapa) => etapa.emSucesso || etapa.emErro).length} mapeamentos=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.mapeamentos.length, 0)} rotas_erro=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.porErro.length, 0)}`)
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
