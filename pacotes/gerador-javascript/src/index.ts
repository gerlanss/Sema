// @ts-nocheck
import type { ExpressaoSemantica, IrBlocoDeclarativo, IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import {
  mapearTipoParaJavaScript,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
} from "@sema/padroes";

const TIPOS_PRIMITIVOS_SEMA = new Set(["Texto", "Numero", "Inteiro", "Decimal", "Booleano", "Data", "DataHora", "Id", "Email", "Url", "Json", "Vazio"]);

function coletarTiposExternos(modulo) {
  const locais = new Set([
    ...modulo.types.map((item) => item.nome),
    ...modulo.entities.map((item) => item.nome),
    ...modulo.enums.map((item) => item.nome),
  ]);
  const referenciados = new Set();
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

function gerarJsdocTypedef(nome, campos) {
  if (campos.length === 0) {
    return `/**\n * @typedef {Object} ${nome}\n */\n`;
  }
  const propriedades = campos.map((campo) => {
    const tipo = mapearTipoParaJavaScript(campo.tipo);
    const obrigatorio = campo.modificadores.includes("required");
    return ` * @property {${tipo}} ${obrigatorio ? "" : "["}${campo.nome}${obrigatorio ? "" : "]"}`;
  }).join("\n");
  return `/**\n * @typedef {Object} ${nome}\n${propriedades}\n */\n`;
}

function gerarComentarioInvariantes(invariantes) {
  if (invariantes.length === 0) {
    return "";
  }
  return `${invariantes.map((invariante) => `// Invariante: ${invariante.textoOriginal}`).join("\n")}\n`;
}

function gerarLiteralCampos(campos) {
  if (campos.length === 0) {
    return "[]";
  }
  return `[\n${campos.map((campo) => `  { nome: "${campo.nome}", tipo: "${campo.tipo}", obrigatorio: ${campo.modificadores.includes("required") ? "true" : "false"} },`).join("\n")}\n]`;
}

function gerarLiteralErros(erros) {
  const entradas = Object.entries(erros);
  if (entradas.length === 0) {
    return "{}";
  }
  return `{\n${entradas.map(([nome, mensagem]) => `  ${JSON.stringify(nome)}: ${JSON.stringify(mensagem)},`).join("\n")}\n}`;
}

function formatarValorJs(valor, camposConhecidos, variavel) {
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

function resolverReferenciaJs(referencia, variavel) {
  return `${variavel}.${referencia}`;
}

function gerarExpressaoJs(expressao, camposConhecidos, variavel) {
  switch (expressao.tipo) {
    case "existe":
      return `(${resolverReferenciaJs(expressao.alvo, variavel)} !== undefined && ${resolverReferenciaJs(expressao.alvo, variavel)} !== null)`;
    case "comparacao":
      return `(${resolverReferenciaJs(expressao.alvo, variavel)} ${expressao.operador} ${formatarValorJs(expressao.valor, camposConhecidos, variavel)})`;
    case "pertencimento":
      return `([${(expressao.valores ?? []).map((valor) => formatarValorJs(valor, camposConhecidos, variavel)).join(", ")}].includes(${resolverReferenciaJs(expressao.alvo, variavel)}))`;
    case "predicado":
      return "true";
    case "composta":
      return `(${expressao.termos.map((termo) => gerarExpressaoJs(termo, camposConhecidos, variavel)).join(expressao.operadorLogico === "e" ? " && " : " || ")})`;
    case "negacao":
      return `(!${gerarExpressaoJs(expressao.termo, camposConhecidos, variavel)})`;
  }
}

function valorPadraoJs(tipo, nomeCampo) {
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
      return "{}";
  }
}

function formatarLiteralTesteJs(valor, tipoDeclarado) {
  if (["Texto", "Id", "Email", "Url"].includes(tipoDeclarado ?? "")) {
    return JSON.stringify(valor);
  }
  if (["Numero", "Inteiro", "Decimal"].includes(tipoDeclarado ?? "") && /^-?\d+(?:\.\d+)?$/.test(valor)) {
    return valor;
  }
  if ((tipoDeclarado ?? "") === "Booleano") {
    if (valor === "verdadeiro") {
      return "true";
    }
    if (valor === "falso") {
      return "false";
    }
  }
  if (/^-?\d+(?:\.\d+)?$/.test(valor)) {
    return valor;
  }
  if (valor === "verdadeiro") {
    return "true";
  }
  if (valor === "falso") {
    return "false";
  }
  return JSON.stringify(valor);
}

function converterBlocoTesteParaJs(bloco, tiposDeclarados) {
  const entradas = [];
  for (const campo of bloco.campos) {
    entradas.push(`${campo.nome}: ${formatarLiteralTesteJs(campo.tipo, tiposDeclarados?.get(campo.nome))}`);
  }
  for (const subbloco of bloco.blocos) {
    entradas.push(`${subbloco.nome}: ${converterBlocoTesteParaJs(subbloco.conteudo)}`);
  }
  return `{ ${entradas.join(", ")} }`;
}

function gerarValidacoes(task) {
  const linhas = [];
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
        linhas.push(`  if (!${gerarExpressaoJs(regra, camposEntrada, "entrada")}) throw new Error("Regra violada: ${regra.textoOriginal}");`);
        break;
    }
  }
  for (const regra of task.rules.filter((regra) => !task.regrasEstruturadas.some((estruturada) => estruturada.textoOriginal === regra))) {
    linhas.push(`  // Regra declarada em Sema: ${regra}`);
  }
  return linhas.join("\n");
}

function gerarFuncaoGarantias(task) {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const linhas = [];
  for (const garantia of task.garantiasEstruturadas) {
    switch (garantia.tipo) {
      case "predicado":
        linhas.push(`  // Predicado de garantia declarado em Sema: ${garantia.textoOriginal}`);
        break;
      default:
        linhas.push(`  if (!${gerarExpressaoJs(garantia, camposSaida, "saida")}) throw new Error("Garantia violada: ${garantia.textoOriginal}");`);
        break;
    }
  }
  for (const garantia of task.guarantees.filter((texto) => !task.garantiasEstruturadas.some((estruturada) => estruturada.textoOriginal === texto))) {
    linhas.push(`  // Garantia declarada em Sema: ${garantia}`);
  }
  if (linhas.length === 0) {
    linhas.push("  // Nenhuma garantia declarada.");
  }
  return `/**\n * Verifica garantias de saida para ${task.nome}.\n * @param {${task.nome}Saida} saida\n * @returns {void}\n */\nexport function verificar_garantias_${normalizarNomeParaSimbolo(task.nome)}(saida) {\n${linhas.join("\n")}\n}\n`;
}

function gerarPreparacaoSaida(task) {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const linhas = [];
  for (const campo of task.output) {
    linhas.push(`    ${campo.nome}: ${valorPadraoJs(campo.tipo, campo.nome)},`);
  }

  const ajustes = [];
  for (const garantia of task.garantiasEstruturadas) {
    if (garantia.tipo === "pertencimento" && garantia.valores && camposSaida.has(garantia.alvo)) {
      ajustes.push(`  saida.${garantia.alvo} = ${formatarValorJs(garantia.valores[0] ?? "", camposSaida, "saida")};`);
    }
    if (garantia.tipo === "comparacao" && garantia.valor && camposSaida.has(garantia.alvo.split(".")[0] ?? garantia.alvo)) {
      ajustes.push(`  ${resolverReferenciaJs(garantia.alvo, "saida")} = ${formatarValorJs(garantia.valor, camposSaida, "saida")};`);
    }
    if (garantia.tipo === "existe" && garantia.alvo.includes(".")) {
      const [raiz, filho] = garantia.alvo.split(".", 2);
      if (raiz && filho && camposSaida.has(raiz)) {
        ajustes.push(`  saida.${raiz} = saida.${raiz} ?? {};`);
        ajustes.push(`  saida.${raiz}.${filho} = saida.${raiz}.${filho} ?? "valor_garantido";`);
      }
    }
  }

  return `  const saida = {\n${linhas.join("\n")}\n  };\n${ajustes.join("\n")}`;
}

function gerarMetadadosTask(task) {
  const efeitos = task.efeitosEstruturados.length === 0
    ? "[]"
    : `[\n${task.efeitosEstruturados.map((efeito) => `  { categoria: "${efeito.categoria}", alvo: "${efeito.alvo}"${efeito.detalhe ? `, detalhe: ${JSON.stringify(efeito.detalhe)}` : ""}${efeito.criticidade ? `, criticidade: "${efeito.criticidade}"` : ""} },`).join("\n")}\n]`;
  const implementacoes = task.implementacoesExternas.length === 0
    ? "[]"
    : `[\n${task.implementacoesExternas.map((impl) => `  { origem: "${impl.origem}", caminho: "${impl.caminho}", resolucaoImpl: "${impl.resolucaoImpl ?? impl.caminho}", statusImpl: "${impl.statusImpl ?? "nao_verificado"}" },`).join("\n")}\n]`;

  return `export const contrato_${normalizarNomeParaSimbolo(task.nome)} = {
  nome: "${task.nome}",
  input: ${gerarLiteralCampos(task.input)},
  output: ${gerarLiteralCampos(task.output)},
  effects: ${efeitos},
  impl: ${implementacoes},
  errors: ${gerarLiteralErros(task.errors)},
  guarantees: ${JSON.stringify(task.guarantees, null, 2)},
};
`;
}

function gerarTask(task) {
  const nomeSimbolo = normalizarNomeParaSimbolo(task.nome);
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
      entrada: converterBlocoTesteParaJs(caso.given, tiposEntrada),
      tipoErro: caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo,
    }))
    .filter((caso) => caso.tipoErro);

  return `
${gerarJsdocTypedef(`${task.nome}Entrada`, task.input)}
${gerarJsdocTypedef(`${task.nome}Saida`, task.output)}
${erros.map(([nomeErro, mensagem]) => `export class ${task.nome}_${nomeErro}Erro extends Error {
  constructor() {
    super(${JSON.stringify(mensagem)});
    this.name = "${task.nome}_${nomeErro}Erro";
    this.codigo = "${nomeErro}";
  }
}
`).join("\n")}
${gerarMetadadosTask(task)}

/**
 * Valida a entrada para ${task.nome}.
 * @param {${task.nome}Entrada} entrada
 * @returns {void}
 */
export function validar_${nomeSimbolo}(entrada) {
${gerarValidacoes(task)}
}

${gerarFuncaoGarantias(task)}

/**
 * Executa a task ${task.nome}.
 * @param {${task.nome}Entrada} entrada
 * @returns {Promise<${task.nome}Saida>}
 */
export async function executar_${nomeSimbolo}(entrada) {
  validar_${nomeSimbolo}(entrada);
${cenariosErro.map((caso) => `  if (JSON.stringify(entrada) === JSON.stringify(${caso.entrada})) throw new ${task.nome}_${caso.tipoErro}Erro();`).join("\n")}
${task.stateContract ? `  // Vinculo de estado: ${task.stateContract.nomeEstado ?? "nao_definido"}\n  // Transicoes declaradas pela task: ${task.stateContract.transicoes.map((transicao) => `${transicao.origem}->${transicao.destino}`).join(", ") || "nenhuma"}` : ""}
${task.implementacoesExternas.length > 0 ? `  // Implementacoes externas vinculadas:\n${task.implementacoesExternas.map((impl) => `  // - ${impl.origem}: ${impl.caminho} [${impl.statusImpl ?? "nao_verificado"}]`).join("\n")}` : ""}
  // Efeitos declarados:
${task.efeitosEstruturados.map((efeito) => `  // - categoria=${efeito.categoria} alvo=${efeito.alvo}${efeito.detalhe ? ` detalhe=${efeito.detalhe}` : ""}${efeito.criticidade ? ` criticidade=${efeito.criticidade}` : ""}`).join("\n") || task.effects.map((efeito) => `  // - ${efeito}`).join("\n") || "  // - Nenhum efeito declarado."}
${gerarPreparacaoSaida(task)}
  verificar_garantias_${nomeSimbolo}(saida);
  return saida;
}
`;
}

function gerarRotas(modulo) {
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
    const efeitosPublicos = route.efeitosPublicos.length === 0
      ? "[]"
      : `[\n${route.efeitosPublicos.map((efeito) => `  { categoria: "${efeito.categoria}", alvo: "${efeito.alvo}"${efeito.detalhe ? `, detalhe: ${JSON.stringify(efeito.detalhe)}` : ""}${efeito.criticidade ? `, criticidade: "${efeito.criticidade}"` : ""} },`).join("\n")}\n]`;

    return `
${gerarJsdocTypedef(`${route.nome}EntradaPublica`, route.inputPublico)}
${gerarJsdocTypedef(`${route.nome}SaidaPublica`, route.outputPublico)}

export const contrato_publico_${nomeSimboloRoute} = {
  nome: "${route.nome}",
  metodo: ${JSON.stringify(route.metodo ?? null)},
  caminho: ${JSON.stringify(route.caminho ?? null)},
  task: ${JSON.stringify(route.task ?? null)},
  input: ${gerarLiteralCampos(route.inputPublico)},
  output: ${gerarLiteralCampos(route.outputPublico)},
  effects: ${efeitosPublicos},
  guarantees: ${JSON.stringify(route.garantiasPublicasMinimas, null, 2)},
};

/**
 * Adaptador publico para a rota ${route.nome}.
 * @param {${route.nome}EntradaPublica} requisicao
 * @returns {Promise<{sucesso: boolean, dados?: ${route.nome}SaidaPublica, erro?: {codigo: string, mensagem: string}}>}
 */
export async function adaptar_${nomeSimboloRoute}(requisicao) {
  try {
    const saida = await executar_${nomeSimboloTask}(requisicao);
    return {
      sucesso: true,
      dados: {${route.outputPublico.map((campo) => `\n        ${campo.nome}: saida.${campo.nome},`).join("")}
      },
    };
  } catch (erro) {
    throw erro;
  }
}
`;
  }).join("\n");
}

function gerarTestes(modulo) {
  const classesErro = modulo.tasks.flatMap((task) => {
    const nomes = new Set(Object.keys(task.errors));
    for (const caso of task.tests) {
      const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
      if (tipoErro) {
        nomes.add(tipoErro);
      }
    }
    return [...nomes].map((nomeErro) => `${task.nome}_${nomeErro}Erro`);
  });
  const nomeModulo = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const linhas = [
    'import test from "node:test";',
    'import assert from "node:assert/strict";',
    `import { ${[...modulo.tasks.map((task) => `executar_${normalizarNomeParaSimbolo(task.nome)}`), ...classesErro].join(", ")} } from "./${nomeModulo}.js";`,
  ];

  for (const task of modulo.tasks) {
    const nomeFuncao = `executar_${normalizarNomeParaSimbolo(task.nome)}`;
    const tiposEntrada = new Map(task.input.map((campo) => [campo.nome, campo.tipo]));
    for (const caso of task.tests) {
      const entrada = converterBlocoTesteParaJs(caso.given, tiposEntrada);
      const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
      if (tipoErro) {
        linhas.push(`
test("${task.nome} :: ${caso.nome}", async () => {
  const entrada = ${entrada};
  await assert.rejects(() => ${nomeFuncao}(entrada), ${task.nome}_${tipoErro}Erro);
});
`);
        continue;
      }
      linhas.push(`
test("${task.nome} :: ${caso.nome}", async () => {
  const entrada = ${entrada};
  const resultado = await ${nomeFuncao}(entrada);
  assert.ok(resultado !== undefined);
});
`);
    }
  }

  return linhas.join("\n");
}

export function gerarJavaScript(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const interoperabilidades = modulo.interoperabilidades
    .map((interop) => `// Interop externo ${interop.origem}: ${interop.caminho}`)
    .join("\n");
  const tiposExternos = coletarTiposExternos(modulo)
    .map((tipo) => `/** @typedef {Object} ${tipo} Tipo externo referenciado por use ou por contrato compartilhado. */\n`)
    .join("\n");
  const entidades = modulo.entities
    .map((entity) => `${gerarComentarioInvariantes(entity.invariantes)}${gerarJsdocTypedef(entity.nome, entity.campos)}`)
    .join("\n");
  const tipos = modulo.types
    .map((type) => `${gerarComentarioInvariantes(type.invariantes)}${gerarJsdocTypedef(type.nome, type.definicao.campos)}`)
    .join("\n");
  const enums = modulo.enums
    .map((enumeracao) => `/** @enum {string} */\nexport const ${enumeracao.nome} = Object.freeze({\n${enumeracao.valores.map((valor) => `  ${valor}: "${valor}",`).join("\n")}\n});\n`)
    .join("\n");
  const states = modulo.states
    .map((state) => `// State${state.nome ? ` ${state.nome}` : ""}: campos=${state.campos.length} invariantes=${state.invariantes.length} transicoes=${state.transicoes.length}`)
    .join("\n");
  const flows = modulo.flows
    .map((flow) => `// Flow ${flow.nome}: etapas=${flow.linhas.length} estruturadas=${flow.etapasEstruturadas.length} tasks=${flow.tasksReferenciadas.join(", ") || flow.etapasEstruturadas.map((etapa) => etapa.task).filter(Boolean).join(", ") || "nenhuma"} ramificacoes=${flow.etapasEstruturadas.filter((etapa) => etapa.emSucesso || etapa.emErro).length} mapeamentos=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.mapeamentos.length, 0)} rotas_erro=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.porErro.length, 0)} efeitos=${flow.efeitosEstruturados.map((efeito) => `${efeito.categoria}:${efeito.alvo}`).join(", ") || "nenhum"}`)
    .join("\n");
  const routes = modulo.routes
    .map((route) => `// Route ${route.nome}: metodo=${route.metodo ?? "nao_definido"} caminho=${route.caminho ?? "nao_definido"} task=${route.task ?? "nao_definida"}`)
    .join("\n");
  const tasks = modulo.tasks.map(gerarTask).join("\n");
  const contratosPublicos = gerarRotas(modulo);

  const codigo = `// Arquivo gerado automaticamente pela Sema.\n// Modulo de origem: ${modulo.nome}\n${interoperabilidades ? `${interoperabilidades}\n` : ""}\n${tiposExternos}\n${tipos}\n${entidades}\n${enums}\n${states}\n${flows}\n${routes}\n${tasks}\n${contratosPublicos}\n`;
  const testes = gerarTestes(modulo);

  return [
    { caminhoRelativo: `${nomeBase}.js`, conteudo: codigo },
    { caminhoRelativo: `${nomeBase}.test.js`, conteudo: testes },
  ];
}
