import path from "node:path";
import type { ExpressaoSemantica, IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import {
  descreverEstruturaModulo,
  mapearTipoParaTypeScript,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
  type FrameworkGeracao,
} from "@sema/padroes";

export interface OpcoesGeracaoTypeScript {
  framework?: FrameworkGeracao;
}

const TIPOS_PRIMITIVOS_SEMA = new Set(["Texto", "Numero", "Inteiro", "Decimal", "Booleano", "Data", "DataHora", "Id", "Email", "Url", "Json", "Vazio"]);

const TIPOS_TYPESCRIPT_NATIVOS = new Set([
  "string",
  "number",
  "boolean",
  "Date",
  "unknown",
  "void",
  "null",
  "undefined",
  "any",
  "Record<string, unknown>",
]);

function gerarInterface(nome: string, campos: IrCampo[]): string {
  const propriedades = campos.length === 0
    ? "  // Sem campos declarados.\n"
    : campos.map((campo) => `  ${campo.nome}${campo.modificadores.includes("required") ? "" : "?"}: ${mapearTipoParaTypeScript(campo.tipo)};`).join("\n");
  return `export interface ${nome} {\n${propriedades}\n}\n`;
}

function gerarComentarioInvariantesTypeScript(invariantes: ExpressaoSemantica[]): string {
  if (invariantes.length === 0) {
    return "";
  }
  return `${invariantes.map((invariante) => `// Invariante: ${invariante.textoOriginal}`).join("\n")}\n`;
}

function gerarLiteralCamposTypeScript(campos: IrCampo[]): string {
  if (campos.length === 0) {
    return "[]";
  }
  return `[\n${campos.map((campo) => `  { nome: "${campo.nome}", tipo: "${campo.tipo}", obrigatorio: ${campo.modificadores.includes("required") ? "true" : "false"} },`).join("\n")}\n]`;
}

function coletarTiposExternos(modulo: IrModulo): string[] {
  const locais = new Set([
    ...modulo.types.map((item) => item.nome),
    ...modulo.entities.map((item) => item.nome),
    ...modulo.enums.map((item) => item.nome),
  ]);
  const referenciados = new Set<string>();
  const campos = [
    ...modulo.entities.flatMap((entity) => entity.campos),
    ...modulo.tasks.flatMap((task) => [...task.input, ...task.output]),
    ...modulo.routes.flatMap((route) => [...route.inputPublico, ...route.outputPublico]),
    ...modulo.states.flatMap((state) => state.campos),
  ];

  for (const campo of campos) {
    if (!TIPOS_PRIMITIVOS_SEMA.has(campo.tipo) && !locais.has(campo.tipo)) {
      referenciados.add(campo.tipo);
    }
  }

  return [...referenciados].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function gerarLiteralErrosTypeScript(erros: Record<string, string>): string {
  const entradas = Object.entries(erros);
  if (entradas.length === 0) {
    return "{}";
  }
  return `{\n${entradas.map(([nome, mensagem]) => `  ${JSON.stringify(nome)}: ${JSON.stringify(mensagem)},`).join("\n")}\n}`;
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
  return `  verificar_garantias_${normalizarNomeParaSimbolo(task.nome)}(saida);\n  return saida;`;
}

function gerarFuncaoGarantias(task: IrTask): string {
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
  if (linhas.length === 0) {
    linhas.push("  // Nenhuma garantia declarada.");
  }
  return `export function verificar_garantias_${normalizarNomeParaSimbolo(task.nome)}(saida: ${task.nome}Saida): void {\n${linhas.join("\n")}\n}\n`;
}

function gerarMetadadosTask(task: IrTask): string {
  const efeitos = task.efeitosEstruturados.length === 0
    ? "[]"
    : `[\n${task.efeitosEstruturados.map((efeito) => `  { categoria: "${efeito.categoria}", alvo: "${efeito.alvo}"${efeito.detalhe ? `, detalhe: ${JSON.stringify(efeito.detalhe)}` : ""}${efeito.criticidade ? `, criticidade: "${efeito.criticidade}"` : ""} },`).join("\n")}\n]`;
  const implementacoes = task.implementacoesExternas.length === 0
    ? "[]"
    : `[\n${task.implementacoesExternas.map((impl) => `  { origem: "${impl.origem}", caminho: "${impl.caminho}", resolucaoImpl: "${impl.resolucaoImpl ?? impl.caminho}", statusImpl: "${impl.statusImpl ?? "nao_verificado"}" },`).join("\n")}\n]`;

  return `export const contrato_${normalizarNomeParaSimbolo(task.nome)} = {
  nome: "${task.nome}",
  input: ${gerarLiteralCamposTypeScript(task.input)},
  output: ${gerarLiteralCamposTypeScript(task.output)},
  effects: ${efeitos},
  impl: ${implementacoes},
  errors: ${gerarLiteralErrosTypeScript(task.errors)},
  guarantees: ${JSON.stringify(task.guarantees, null, 2)},
} as const;
`;
}

function gerarMapeamentoSaidaPublicaTypeScript(nomeVariavel: string, campos: IrCampo[]): string {
  if (campos.length === 0) {
    return "{}";
  }
  return `{\n${campos.map((campo) => `      ${campo.nome}: ${nomeVariavel}.${campo.nome},`).join("\n")}\n    }`;
}

function gerarRotas(modulo: IrModulo): string {
  const rotasComTask = modulo.routes.filter((route) => route.task);
  if (rotasComTask.length === 0) {
    return "";
  }

  return rotasComTask.map((route) => {
    const taskAssociada = modulo.tasks.find((task) => task.nome === route.task);
    if (!taskAssociada) {
      return "";
    }

    const nomeSimboloRoute = normalizarNomeParaSimbolo(route.nome);
    const nomeSimboloTask = normalizarNomeParaSimbolo(taskAssociada.nome);
    const uniaoErros = route.errosPublicos.length === 0
      ? "never"
      : route.errosPublicos.map((erro) => JSON.stringify(erro.nome)).join(" | ");
    const efeitosPublicos = route.efeitosPublicos.length === 0
      ? "[]"
      : `[\n${route.efeitosPublicos.map((efeito) => `  { categoria: "${efeito.categoria}", alvo: "${efeito.alvo}"${efeito.detalhe ? `, detalhe: ${JSON.stringify(efeito.detalhe)}` : ""}${efeito.criticidade ? `, criticidade: "${efeito.criticidade}"` : ""} },`).join("\n")}\n]`;
    const verificacoesErro = route.errosPublicos.map((erro) => `    if (erro instanceof ${taskAssociada.nome}_${erro.nome}Erro) {
      return { sucesso: false, erro: { codigo: "${erro.nome}" as ${route.nome}ErroPublico, mensagem: ${JSON.stringify(erro.mensagem ?? taskAssociada.errors[erro.nome] ?? `Erro publico ${erro.nome}`)} } };
    }`).join("\n");

    return `
${gerarInterface(`${route.nome}EntradaPublica`, route.inputPublico)}
${gerarInterface(`${route.nome}SaidaPublica`, route.outputPublico)}
export type ${route.nome}ErroPublico = ${uniaoErros};
export type ${route.nome}RespostaPublica =
  | { sucesso: true; dados: ${route.nome}SaidaPublica }
  | { sucesso: false; erro: { codigo: ${route.nome}ErroPublico; mensagem: string } };

export const contrato_publico_${nomeSimboloRoute} = {
  nome: "${route.nome}",
  metodo: ${JSON.stringify(route.metodo ?? null)},
  caminho: ${JSON.stringify(route.caminho ?? null)},
  task: ${JSON.stringify(route.task ?? null)},
  input: ${gerarLiteralCamposTypeScript(route.inputPublico)},
  output: ${gerarLiteralCamposTypeScript(route.outputPublico)},
  effects: ${efeitosPublicos},
  guarantees: ${JSON.stringify(route.garantiasPublicasMinimas, null, 2)},
  errors: ${route.errosPublicos.length === 0 ? "[]" : `[\n${route.errosPublicos.map((erro) => `  { nome: "${erro.nome}", mensagem: ${JSON.stringify(erro.mensagem ?? taskAssociada.errors[erro.nome] ?? "")} },`).join("\n")}\n]`},
} as const;

export function verificar_resposta_publica_${nomeSimboloRoute}(dados: ${route.nome}SaidaPublica): void {
${route.outputPublico.length === 0
  ? "  // Route sem campos publicos obrigatorios."
  : route.outputPublico.map((campo) => campo.modificadores.includes("required")
      ? `  if (dados.${campo.nome} === undefined || dados.${campo.nome} === null) throw new Error("Resposta publica invalida: campo obrigatorio ausente ${campo.nome}");`
      : `  // Campo publico opcional: ${campo.nome}`).join("\n")}
}

export async function adaptar_${nomeSimboloRoute}(requisicao: ${route.nome}EntradaPublica): Promise<${route.nome}RespostaPublica> {
  try {
    const saida = await executar_${nomeSimboloTask}(requisicao as ${taskAssociada.nome}Entrada);
    const dados = ${gerarMapeamentoSaidaPublicaTypeScript("saida", route.outputPublico)} as ${route.nome}SaidaPublica;
    verificar_resposta_publica_${nomeSimboloRoute}(dados);
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
${verificacoesErro || "    throw erro;"}
    throw erro;
  }
}
`;
  }).join("\n");
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
${gerarMetadadosTask(task)}

export function validar_${nomeSimbolo}(entrada: ${task.nome}Entrada): void {
${gerarValidacoes(task)}
}

${gerarFuncaoGarantias(task)}

export async function executar_${nomeSimbolo}(entrada: ${task.nome}Entrada): Promise<${task.nome}Saida> {
  validar_${nomeSimbolo}(entrada);
${cenariosErro.map((caso) => `  if (JSON.stringify(entrada) === JSON.stringify(${JSON.stringify(caso.entrada)})) throw new ${task.nome}_${caso.tipoErro}Erro();`).join("\n")}
${task.stateContract ? `  // Vinculo de estado: ${task.stateContract.nomeEstado ?? "nao_definido"}\n  // Transicoes declaradas pela task: ${task.stateContract.transicoes.map((transicao) => `${transicao.origem}->${transicao.destino}`).join(", ") || "nenhuma"}` : ""}
${task.implementacoesExternas.length > 0 ? `  // Implementacoes externas vinculadas:\n${task.implementacoesExternas.map((impl) => `  // - ${impl.origem}: ${impl.caminho} [${impl.statusImpl ?? "nao_verificado"}]`).join("\n")}` : ""}
  // Efeitos declarados:
${task.efeitosEstruturados.map((efeito) => `  // - categoria=${efeito.categoria} alvo=${efeito.alvo}${efeito.detalhe ? ` detalhe=${efeito.detalhe}` : ""}${efeito.criticidade ? ` criticidade=${efeito.criticidade}` : ""}`).join("\n") || task.effects.map((efeito) => `  // - ${efeito}`).join("\n") || "  // - Nenhum efeito declarado."}
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

function gerarTypeScriptBase(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const interoperabilidades = modulo.interoperabilidades
    .map((interop) => `// Interop externo ${interop.origem}: ${interop.caminho}`)
    .join("\n");
  const tiposExternos = coletarTiposExternos(modulo)
    .map((tipo) => `export type ${tipo} = any; // Tipo externo referenciado por use ou por contrato compartilhado.\n`)
    .join("\n");
  const entidades = modulo.entities
    .map((entity) => `${gerarComentarioInvariantesTypeScript(entity.invariantes)}${gerarInterface(entity.nome, entity.campos)}`)
    .join("\n");
  const tipos = modulo.types
    .map((type) => `${gerarComentarioInvariantesTypeScript(type.invariantes)}${gerarInterface(type.nome, type.definicao.campos)}`)
    .join("\n");
  const enums = modulo.enums
    .map((enumeracao) => `export type ${enumeracao.nome} = ${enumeracao.valores.map((valor) => `"${valor}"`).join(" | ")};\n`)
    .join("\n");
  const states = modulo.states
    .map((state) => `// State${state.nome ? ` ${state.nome}` : ""}: campos=${state.campos.length} invariantes=${state.invariantes.length} transicoes=${state.transicoes.length}`)
    .join("\n");
  const flows = modulo.flows
    .map((flow) => `// Flow ${flow.nome}: etapas=${flow.linhas.length} estruturadas=${flow.etapasEstruturadas.length} tasks=${flow.tasksReferenciadas.join(", ") || flow.etapasEstruturadas.map((etapa) => etapa.task).filter(Boolean).join(", ") || "nenhuma"} ramificacoes=${flow.etapasEstruturadas.filter((etapa) => etapa.emSucesso || etapa.emErro).length} mapeamentos=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.mapeamentos.length, 0)} rotas_erro=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.porErro.length, 0)} efeitos=${flow.efeitosEstruturados.map((efeito) => `${efeito.categoria}:${efeito.alvo}`).join(", ") || "nenhum"}`)
    .join("\n");
  const routes = modulo.routes
    .map((route) => `// Route ${route.nome}: metodo=${route.metodo ?? "nao_definido"} caminho=${route.caminho ?? "nao_definido"} task=${route.task ?? "nao_definida"} input_publico=${route.inputPublico.map((campo) => campo.nome).join(", ") || "padrao_task"} output_publico=${route.outputPublico.map((campo) => campo.nome).join(", ") || "padrao_task"} erros_publicos=${route.errosPublicos.map((erro) => erro.nome).join(", ") || "padrao_task"} effects_publicos=${route.efeitosPublicos.map((efeito) => `${efeito.categoria}:${efeito.alvo}`).join(", ") || "nenhum"} garantias_publicas=${route.garantiasPublicasMinimas.length}`)
    .join("\n");
  const tasks = modulo.tasks.map(gerarTask).join("\n");
  const contratosPublicos = gerarRotas(modulo);

  const codigo = `// Arquivo gerado automaticamente pela Sema.\n// Modulo de origem: ${modulo.nome}\n${interoperabilidades ? `${interoperabilidades}\n` : ""}\n${tiposExternos}\n${tipos}\n${entidades}\n${enums}\n${states}\n${flows}\n${routes}\n${tasks}\n${contratosPublicos}\n`;
  const testes = gerarTestes(modulo);

  return [
    { caminhoRelativo: `${nomeBase}.ts`, conteudo: codigo },
    { caminhoRelativo: `${nomeBase}.test.ts`, conteudo: testes },
  ];
}

function paraPascalCase(valor: string): string {
  return valor
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((parte) => parte[0]!.toUpperCase() + parte.slice(1))
    .join("");
}

function limparPrefixoRota(caminho?: string): string {
  return (caminho ?? "/").replace(/^\/+/, "").replace(/\/+$/, "");
}

function gerarNestJsDtos(modulo: IrModulo, caminhoContrato: string): string {
  const tiposReferenciados = new Set<string>();
  const registrarTipos = (campos: IrCampo[]) => {
    for (const campo of campos) {
      const tipoMapeado = mapearTipoParaTypeScript(campo.tipo);
      if (
        !TIPOS_TYPESCRIPT_NATIVOS.has(tipoMapeado)
        && /^[A-Za-z_][A-Za-z0-9_]*$/.test(tipoMapeado)
      ) {
        tiposReferenciados.add(tipoMapeado);
      }
    }
  };

  for (const task of modulo.tasks) {
    registrarTipos(task.input);
    registrarTipos(task.output);
  }
  for (const route of modulo.routes) {
    registrarTipos(route.inputPublico);
    registrarTipos(route.outputPublico);
  }

  const linhas: string[] = [];
  if (tiposReferenciados.size > 0) {
    linhas.push(`import type { ${[...tiposReferenciados].sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ")} } from "${caminhoContrato}";`);
    linhas.push("");
  }

  const gerarClasseDto = (nomeClasse: string, campos: IrCampo[]) => {
    linhas.push(`export class ${nomeClasse} {`);
    if (campos.length === 0) {
      linhas.push("  // Sem campos declarados.");
    } else {
      for (const campo of campos) {
        linhas.push(`  ${campo.nome}${campo.modificadores.includes("required") ? "!" : "?"}: ${mapearTipoParaTypeScript(campo.tipo)};`);
      }
    }
    linhas.push("}");
    linhas.push("");
  };

  for (const task of modulo.tasks) {
    gerarClasseDto(`${paraPascalCase(task.nome)}EntradaDto`, task.input);
    gerarClasseDto(`${paraPascalCase(task.nome)}SaidaDto`, task.output);
  }
  for (const route of modulo.routes) {
    gerarClasseDto(`${paraPascalCase(route.nome)}EntradaPublicaDto`, route.inputPublico);
    gerarClasseDto(`${paraPascalCase(route.nome)}SaidaPublicaDto`, route.outputPublico);
  }

  return `${linhas.join("\n").trim()}\n`;
}

function gerarNestJsService(modulo: IrModulo, caminhoContrato: string): string {
  const nomeClasse = `${paraPascalCase(descreverEstruturaModulo(modulo.nome).nomeArquivo)}Service`;
  const imports = [
    `import { Injectable } from "@nestjs/common";`,
    `import {`,
    ...modulo.tasks.flatMap((task) => [`  executar_${normalizarNomeParaSimbolo(task.nome)},`, `  type ${task.nome}Entrada,`, `  type ${task.nome}Saida,`]),
    ...modulo.routes.flatMap((route) => route.task ? [
      `  adaptar_${normalizarNomeParaSimbolo(route.nome)},`,
      `  type ${route.nome}EntradaPublica,`,
      `  type ${route.nome}RespostaPublica,`,
    ] : []),
    `} from "${caminhoContrato}";`,
  ];

  const metodosTask = modulo.tasks.map((task) => `  async ${normalizarNomeParaSimbolo(task.nome)}(entrada: ${task.nome}Entrada): Promise<${task.nome}Saida> {
${task.implementacoesExternas.length > 0 ? task.implementacoesExternas.map((impl) => `    // impl ${impl.origem}: ${impl.caminho}`).join("\n") : "    // TODO: ajustar a implementacao real e preencher dependencias do framework."}
    return executar_${normalizarNomeParaSimbolo(task.nome)}(entrada);
  }`).join("\n\n");

  const metodosRota = modulo.routes
    .filter((route) => route.task)
    .map((route) => `  async ${normalizarNomeParaSimbolo(route.nome)}(entrada: ${route.nome}EntradaPublica): Promise<${route.nome}RespostaPublica> {
    return adaptar_${normalizarNomeParaSimbolo(route.nome)}(entrada);
  }`).join("\n\n");

  return `${imports.join("\n")}

@Injectable()
export class ${nomeClasse} {
${metodosTask}${metodosTask && metodosRota ? "\n\n" : ""}${metodosRota}
}
`;
}

function gerarNestJsController(modulo: IrModulo, caminhoDto: string, caminhoService: string): string {
  const nomeArquivo = descreverEstruturaModulo(modulo.nome).nomeArquivo;
  const nomeClasse = `${paraPascalCase(nomeArquivo)}Controller`;
  const nomeService = `${paraPascalCase(nomeArquivo)}Service`;
  const decoratorsImport = new Set<string>(["Controller"]);
  const metodos = modulo.routes
    .filter((route) => route.task)
    .map((route) => {
      const metodo = (route.metodo ?? "POST").toUpperCase();
      if (metodo === "GET") {
        decoratorsImport.add("Get");
      } else if (metodo === "PUT") {
        decoratorsImport.add("Put");
      } else if (metodo === "PATCH") {
        decoratorsImport.add("Patch");
      } else if (metodo === "DELETE") {
        decoratorsImport.add("Delete");
      } else {
        decoratorsImport.add("Post");
      }
      if ((route.inputPublico ?? []).length > 0) {
        decoratorsImport.add("Body");
      }
      const decorator = metodo === "GET" ? "Get" : metodo === "PUT" ? "Put" : metodo === "PATCH" ? "Patch" : metodo === "DELETE" ? "Delete" : "Post";
      const caminhoDecorador = limparPrefixoRota(route.caminho);
      const bodyArg = route.inputPublico.length > 0
        ? `@Body() entrada: ${paraPascalCase(route.nome)}EntradaPublicaDto`
        : "";
      const tipoResposta = `${route.nome}RespostaPublica`;
      return `  @${decorator}(${JSON.stringify(caminhoDecorador)})
  async ${normalizarNomeParaSimbolo(route.nome)}(${bodyArg}): Promise<${tipoResposta}> {
    return this.service.${normalizarNomeParaSimbolo(route.nome)}(${route.inputPublico.length > 0 ? "entrada" : "{}"});
  }`;
    }).join("\n\n");

  const dtosImportados = [...new Set(modulo.routes
    .filter((route) => route.task && route.inputPublico.length > 0)
    .map((route) => `${paraPascalCase(route.nome)}EntradaPublicaDto`))];

  const contratosImportados = [...new Set(modulo.routes
    .filter((route) => route.task)
    .map((route) => `type ${route.nome}RespostaPublica`))];

  return `import { ${[...decoratorsImport].join(", ")} } from "@nestjs/common";
import { ${nomeService} } from "${caminhoService}";
${dtosImportados.length > 0 ? `import { ${dtosImportados.join(", ")} } from "${caminhoDto}";` : ""}
${contratosImportados.length > 0 ? `import { ${contratosImportados.join(", ")} } from "./${descreverEstruturaModulo(modulo.nome).nomeArquivo}.contract";` : ""}

@Controller()
export class ${nomeClasse} {
  constructor(private readonly service: ${nomeService}) {}

${metodos || "  // Nenhuma route publica declarada no modulo."}
}
`;
}

function gerarNestJsSpec(modulo: IrModulo, caminhoService: string, caminhoController: string): string {
  const nomeArquivo = descreverEstruturaModulo(modulo.nome).nomeArquivo;
  const nomeService = `${paraPascalCase(nomeArquivo)}Service`;
  const nomeController = `${paraPascalCase(nomeArquivo)}Controller`;

  return `import { describe, it } from "@jest/globals";
import { ${nomeService} } from "${caminhoService}";
import { ${nomeController} } from "${caminhoController}";

describe("${nomeController}", () => {
  it("mantem o scaffold inicial em pe", () => {
    const service = new ${nomeService}();
    const controller = new ${nomeController}(service);
    expect(controller).toBeDefined();
  });
});
`;
}

function gerarTypeScriptNestJs(modulo: IrModulo): ArquivoGerado[] {
  const base = gerarTypeScriptBase(modulo);
  const contrato = base.find((arquivo) => arquivo.caminhoRelativo.endsWith(".ts") && !arquivo.caminhoRelativo.endsWith(".test.ts"));
  const testeContrato = base.find((arquivo) => arquivo.caminhoRelativo.endsWith(".test.ts"));
  const estrutura = descreverEstruturaModulo(modulo.nome);
  const contexto = estrutura.contextoRelativo;
  const contratoPath = `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}.contract.ts`;
  const dtoPath = `${contexto ? `${contexto}/` : ""}dto/${estrutura.nomeArquivo}.dto.ts`;
  const servicePath = `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}.service.ts`;
  const controllerPath = `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}.controller.ts`;
  const caminhoImportDto = `./dto/${estrutura.nomeArquivo}.dto`;
  const caminhoImportContrato = `./${estrutura.nomeArquivo}.contract`;
  const caminhoImportService = `./${estrutura.nomeArquivo}.service`;
  const caminhoContratoTeste = path.posix.join("test", `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}.contract.test.ts`);
  const caminhoControllerSpec = path.posix.join("test", `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}.controller.spec.ts`);
  const relativoContratoDoTeste = path.posix.relative(path.posix.dirname(caminhoContratoTeste), path.posix.join("src", contratoPath).replace(/\.ts$/, ""));
  const relativoServiceDoSpec = path.posix.relative(path.posix.dirname(caminhoControllerSpec), path.posix.join("src", servicePath).replace(/\.ts$/, ""));
  const relativoControllerDoSpec = path.posix.relative(path.posix.dirname(caminhoControllerSpec), path.posix.join("src", controllerPath).replace(/\.ts$/, ""));

  const arquivos: ArquivoGerado[] = [
    {
      caminhoRelativo: path.posix.join("src", contratoPath),
      conteudo: contrato?.conteudo ?? "// Nenhum contrato base gerado.\n",
    },
    {
      caminhoRelativo: path.posix.join("src", dtoPath),
      conteudo: gerarNestJsDtos(modulo, `../${path.posix.basename(contratoPath, ".ts")}`),
    },
    {
      caminhoRelativo: path.posix.join("src", servicePath),
      conteudo: gerarNestJsService(modulo, caminhoImportContrato),
    },
    {
      caminhoRelativo: path.posix.join("src", controllerPath),
      conteudo: gerarNestJsController(modulo, caminhoImportDto, caminhoImportService),
    },
    {
      caminhoRelativo: caminhoContratoTeste,
      conteudo: (testeContrato?.conteudo ?? "")
        .replace(`./${estrutura.nomeBase}.ts`, relativoContratoDoTeste)
        .replace(`./${estrutura.nomeArquivo}.ts`, relativoContratoDoTeste),
    },
    {
      caminhoRelativo: caminhoControllerSpec,
      conteudo: gerarNestJsSpec(modulo, relativoServiceDoSpec, relativoControllerDoSpec),
    },
  ];

  return arquivos;
}

export function gerarTypeScript(modulo: IrModulo, opcoes: OpcoesGeracaoTypeScript = {}): ArquivoGerado[] {
  if (opcoes.framework === "nestjs") {
    return gerarTypeScriptNestJs(modulo);
  }
  return gerarTypeScriptBase(modulo);
}
