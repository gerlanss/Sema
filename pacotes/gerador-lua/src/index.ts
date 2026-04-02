// @ts-nocheck
import path from "node:path";
import type { IrModulo } from "@sema/nucleo";
import {
  descreverEstruturaModulo,
  mapearTipoParaLua,
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
    if (!TIPOS_PRIMITIVOS_SEMA.has(campo.tipoBase) && !locais.has(campo.tipoBase)) {
      referenciados.add(campo.tipoBase);
    }
    for (const tipo of campo.tiposAlternativos) {
      if (!TIPOS_PRIMITIVOS_SEMA.has(tipo) && !locais.has(tipo)) {
        referenciados.add(tipo);
      }
    }
  }

  return [...referenciados].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function comentarInvariantes(invariantes) {
  if (invariantes.length === 0) {
    return "";
  }
  return `${invariantes.map((invariante) => `-- Invariante: ${invariante.textoOriginal}`).join("\n")}\n`;
}

function gerarTabelaCampos(campos) {
  if (campos.length === 0) {
    return "{}";
  }
  return `{\n${campos.map((campo) => `    { nome = ${JSON.stringify(campo.nome)}, tipo = ${JSON.stringify(campo.tipo)}, obrigatorio = ${campo.modificadores.includes("required") ? "true" : "false"} },`).join("\n")}\n  }`;
}

function valorPadraoLua(campo) {
  if (campo.cardinalidade === "lista" || campo.cardinalidade === "mapa") {
    return "{}";
  }
  if (campo.opcional) {
    return "nil";
  }
  switch (campo.tipoBase) {
    case "Texto":
    case "Id":
    case "Email":
    case "Url":
      return JSON.stringify(`${campo.nome}_exemplo`);
    case "Numero":
    case "Inteiro":
    case "Decimal":
      return "1";
    case "Booleano":
      return "false";
    case "Json":
      return "{}";
    case "Vazio":
      return "nil";
    default:
      return "{}";
  }
}

function resolverReferenciaLua(referencia, variavel) {
  const partes = referencia.split(".").filter(Boolean);
  if (partes.length === 0) {
    return variavel;
  }
  return `${variavel}${partes.map((parte) => `[${JSON.stringify(parte)}]`).join("")}`;
}

function formatarValorLua(valor, camposConhecidos, variavel) {
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
    return "nil";
  }
  if (camposConhecidos.has(texto.split(".")[0] ?? texto)) {
    return resolverReferenciaLua(texto, variavel);
  }
  return JSON.stringify(texto);
}

function gerarExpressaoLua(expressao, camposConhecidos, variavel) {
  switch (expressao.tipo) {
    case "existe":
      return `${resolverReferenciaLua(expressao.alvo, variavel)} ~= nil`;
    case "comparacao":
      return `${resolverReferenciaLua(expressao.alvo, variavel)} ${expressao.operador} ${formatarValorLua(expressao.valor, camposConhecidos, variavel)}`;
    case "pertencimento":
      return `contem({ ${((expressao.valores ?? []).map((valor) => formatarValorLua(valor, camposConhecidos, variavel)).join(", "))} }, ${resolverReferenciaLua(expressao.alvo, variavel)})`;
    case "predicado":
      return "true";
    case "composta":
      return `(${expressao.termos.map((termo) => gerarExpressaoLua(termo, camposConhecidos, variavel)).join(expressao.operadorLogico === "e" ? " and " : " or ")})`;
    case "negacao":
      return `(not ${gerarExpressaoLua(expressao.termo, camposConhecidos, variavel)})`;
  }
}

function gerarValidacoes(task) {
  const linhas = [
    ...task.input
      .filter((campo) => campo.modificadores.includes("required"))
      .map((campo) => `  if entrada[${JSON.stringify(campo.nome)}] == nil then error("Campo obrigatorio ausente: ${campo.nome}") end`),
    ...task.regrasEstruturadas.map((regra) => {
      switch (regra.tipo) {
        case "predicado":
          return `  -- Predicado declarado em Sema: ${regra.textoOriginal}`;
        default:
          return `  if not (${gerarExpressaoLua(regra, new Set(task.input.map((campo) => campo.nome)), "entrada")}) then error("Regra violada: ${regra.textoOriginal}") end`;
      }
    }),
    ...task.rules
      .filter((regra) => !task.regrasEstruturadas.some((estruturada) => estruturada.textoOriginal === regra))
      .map((regra) => `  -- Regra declarada em Sema: ${regra}`),
  ];

  return linhas.join("\n");
}

function gerarGarantias(task) {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const linhas = [
    ...task.garantiasEstruturadas.map((garantia) => {
      switch (garantia.tipo) {
        case "predicado":
          return `  -- Predicado de garantia declarado em Sema: ${garantia.textoOriginal}`;
        default:
          return `  if not (${gerarExpressaoLua(garantia, camposSaida, "saida")}) then error("Garantia violada: ${garantia.textoOriginal}") end`;
      }
    }),
    ...task.guarantees
      .filter((garantia) => !task.garantiasEstruturadas.some((estruturada) => estruturada.textoOriginal === garantia))
      .map((garantia) => `  -- Garantia declarada em Sema: ${garantia}`),
  ];

  return `local function verificar_garantias_${normalizarNomeParaSimbolo(task.nome)}(saida)\n${linhas.join("\n")}\nend`;
}

function gerarPreparacaoSaida(task) {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const inicializacao = task.output.map((campo) => `    ${campo.nome} = ${valorPadraoLua(campo)},`).join("\n");
  const ajustes = [];

  for (const garantia of task.garantiasEstruturadas) {
    if (garantia.tipo === "pertencimento" && garantia.valores && camposSaida.has(garantia.alvo)) {
      ajustes.push(`  saida[${JSON.stringify(garantia.alvo)}] = ${formatarValorLua(garantia.valores[0] ?? "", camposSaida, "saida")}`);
    }
    if (garantia.tipo === "comparacao" && garantia.valor && camposSaida.has(garantia.alvo.split(".")[0] ?? garantia.alvo) && !garantia.alvo.includes(".")) {
      ajustes.push(`  saida[${JSON.stringify(garantia.alvo)}] = ${formatarValorLua(garantia.valor, camposSaida, "saida")}`);
    }
    if (garantia.tipo === "comparacao" && garantia.valor && garantia.alvo.includes(".")) {
      const [raiz, filho] = garantia.alvo.split(".", 2);
      if (raiz && filho && camposSaida.has(raiz)) {
        ajustes.push(`  saida[${JSON.stringify(raiz)}] = saida[${JSON.stringify(raiz)}] or {}`);
        ajustes.push(`  saida[${JSON.stringify(raiz)}][${JSON.stringify(filho)}] = ${formatarValorLua(garantia.valor, camposSaida, "saida")}`);
      }
    }
    if (garantia.tipo === "existe" && garantia.alvo.includes(".")) {
      const [raiz, filho] = garantia.alvo.split(".", 2);
      if (raiz && filho && camposSaida.has(raiz)) {
        ajustes.push(`  saida[${JSON.stringify(raiz)}] = saida[${JSON.stringify(raiz)}] or {}`);
        ajustes.push(`  if saida[${JSON.stringify(raiz)}][${JSON.stringify(filho)}] == nil then saida[${JSON.stringify(raiz)}][${JSON.stringify(filho)}] = "valor_garantido" end`);
      }
    }
  }

  return `  local saida = {\n${inicializacao}\n  }\n${ajustes.join("\n")}`;
}

function formatarLiteralTesteLua(valor, tipoDeclarado) {
  if (["Texto", "Id", "Email", "Url", "Data", "DataHora"].includes(tipoDeclarado ?? "")) {
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

function gerarTabelaLua(campos, blocos) {
  const entradas = [
    ...campos.map((campo) => `  ${campo.nome} = ${campo.valor},`),
    ...blocos.map((bloco) => `  ${bloco.nome} = ${bloco.conteudo},`),
  ];
  return `{\n${entradas.join("\n")}\n}`;
}

function converterBlocoTesteParaLua(bloco, tiposDeclarados) {
  const campos = bloco.campos.map((campo) => ({
    nome: campo.nome,
    valor: formatarLiteralTesteLua(campo.tipo, tiposDeclarados?.get(campo.nome)),
  }));
  const blocos = bloco.blocos.map((subbloco) => ({
    nome: subbloco.nome,
    conteudo: converterBlocoTesteParaLua(subbloco.conteudo),
  }));
  return gerarTabelaLua(campos, blocos);
}

function gerarTabelaTiposDeclarados(task) {
  return new Map(task.input.map((campo) => [campo.nome, campo.tipo]));
}

function gerarTestesLua(modulo, arquivoModulo) {
  const testes = modulo.tasks.flatMap((task) => task.tests.map((caso, indice) => ({ task, caso, indice })));
  if (testes.length === 0) {
    return undefined;
  }
  const nomeArquivo = path.basename(arquivoModulo);
  const funcoes = testes.map(({ task, caso, indice }) => {
    const nomeTeste = `test_${normalizarNomeParaSimbolo(task.nome)}_${indice + 1}`;
    const tiposDeclarados = gerarTabelaTiposDeclarados(task);
    return `local function ${nomeTeste}()
  local entrada = ${converterBlocoTesteParaLua(caso.given, tiposDeclarados)}
  local saida = modulo.executar_${normalizarNomeParaSimbolo(task.nome)}(entrada)
  if ${caso.expect.campos.some((campo) => campo.nome === "sucesso" && campo.tipo === "falso") ? "saida ~= nil" : "saida == nil"} then
    error("Caso ${caso.nome} nao respeitou expectativa basica de execucao.")
  end
end`;
  });
  const lista = testes.map(({ task, caso, indice }) => `{ nome = ${JSON.stringify(caso.nome)}, fn = test_${normalizarNomeParaSimbolo(task.nome)}_${indice + 1} }`).join(",\n  ");
  return `local origem = debug.getinfo(1, "S").source:sub(2)
local base = origem:match("^(.*[/\\\\])") or "./"
local modulo = assert(loadfile(base .. ${JSON.stringify(nomeArquivo)}))()

${funcoes.join("\n\n")}

local testes = {
  ${lista}
}

for _, teste in ipairs(testes) do
  io.write("test ", teste.nome, "\\n")
  teste.fn()
end

io.write("ok ", tostring(#testes), " testes\\n")
`;
}

function gerarMetadadosTask(task) {
  const efeitos = task.efeitosEstruturados.map((efeito) => `${efeito.categoria}:${efeito.alvo}`).join(", ") || "nenhum";
  const impl = task.implementacoesExternas.map((item) => `${item.origem}:${item.caminho}[${item.statusImpl ?? "nao_verificado"}]`).join(", ") || "nenhuma";
  return `M.contrato_${normalizarNomeParaSimbolo(task.nome)} = {
  nome = ${JSON.stringify(task.nome)},
  input = ${gerarTabelaCampos(task.input)},
  output = ${gerarTabelaCampos(task.output)},
  effects = ${JSON.stringify(efeitos)},
  impl = ${JSON.stringify(impl)}
}`;
}

function gerarFuncoesTask(task) {
  const simbolo = normalizarNomeParaSimbolo(task.nome);
  const validacoes = gerarValidacoes(task);
  const garantias = gerarGarantias(task);
  const preparacaoSaida = gerarPreparacaoSaida(task);
  return `${gerarMetadadosTask(task)}

${garantias}

function M.executar_${simbolo}(entrada)
  entrada = entrada or {}
${validacoes ? `${validacoes}\n` : ""}${preparacaoSaida}
  verificar_garantias_${simbolo}(saida)
  return saida
end`;
}

export function gerarLua(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const estrutura = descreverEstruturaModulo(modulo.nome);
  const interops = modulo.interoperabilidades.map((interop) => `-- Interop externo ${interop.origem}: ${interop.caminho}`).join("\n");
  const tiposExternos = coletarTiposExternos(modulo).map((tipo) => `---@class ${tipo}`).join("\n");
  const enums = modulo.enums.map((enumeracao) => `M.enum_${normalizarNomeParaSimbolo(enumeracao.nome)} = { ${enumeracao.valores.map((valor) => `${valor} = ${JSON.stringify(valor)}`).join(", ")} }`).join("\n\n");
  const entidades = modulo.entities.map((entity) => `${comentarInvariantes(entity.invariantes)}---@class ${entity.nome}\nM.${normalizarNomeParaSimbolo(entity.nome)} = {\n${entity.campos.map((campo) => `  ${campo.nome} = nil, -- ${mapearTipoParaLua(campo.tipoBase)}`).join("\n")}\n}`).join("\n\n");
  const tipos = modulo.types.map((type) => `${comentarInvariantes(type.invariantes)}---@alias ${type.nome} table`).join("\n\n");
  const tasks = modulo.tasks.map((task) => gerarFuncoesTask(task)).join("\n\n");
  const flows = modulo.flows.map((flow) => `-- Flow ${flow.nome}: etapas=${flow.etapasEstruturadas.length} tasks=${flow.tasksReferenciadas.join(", ") || "nenhuma"}`).join("\n");
  const routes = modulo.routes.map((route) => `-- Route ${route.nome}: metodo=${route.metodo ?? "nao_definido"} caminho=${route.caminho ?? "nao_definido"} task=${route.task ?? "nao_definida"}`).join("\n");
  const codigo = `-- Arquivo gerado automaticamente pela Sema.
-- Modulo de origem: ${modulo.nome}
${interops ? `${interops}\n` : ""}${tiposExternos ? `${tiposExternos}\n\n` : ""}local M = {}

local function contem(lista, valor)
  for _, item in ipairs(lista) do
    if item == valor then
      return true
    end
  end
  return false
end

${tipos ? `${tipos}\n\n` : ""}${entidades ? `${entidades}\n\n` : ""}${enums ? `${enums}\n\n` : ""}${tasks}${flows ? `\n\n${flows}` : ""}${routes ? `\n${routes}` : ""}

return M
`;
  const caminhoModulo = estrutura.contextoRelativo
    ? path.join(estrutura.contextoRelativo, `${estrutura.nomeArquivo}.lua`)
    : `${nomeBase}.lua`;
  const arquivos: ArquivoGerado[] = [{ caminhoRelativo: caminhoModulo, conteudo: codigo }];
  const testes = gerarTestesLua(modulo, path.basename(caminhoModulo));
  if (testes) {
    arquivos.push({
      caminhoRelativo: estrutura.contextoRelativo
        ? path.join(estrutura.contextoRelativo, `test_${estrutura.nomeArquivo}.lua`)
        : `test_${nomeBase}.lua`,
      conteudo: testes,
    });
  }
  return arquivos;
}
