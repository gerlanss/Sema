import path from "node:path";
import type { ExpressaoSemantica, IrBlocoDeclarativo, IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import {
  descreverEstruturaModulo,
  mapearTipoParaLua,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
} from "@sema/padroes";

const TIPOS_PRIMITIVOS_SEMA = new Set(["Texto", "Numero", "Inteiro", "Decimal", "Booleano", "Data", "DataHora", "Id", "Email", "Url", "Json", "Vazio"]);

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

function comentarInvariantes(invariantes: ExpressaoSemantica[]): string {
  if (invariantes.length === 0) {
    return "";
  }
  return `${invariantes.map((invariante) => `-- Invariante: ${invariante.textoOriginal}`).join("\n")}\n`;
}

function gerarTabelaCampos(campos: IrCampo[]): string {
  if (campos.length === 0) {
    return "{}";
  }
  return `{\n${campos.map((campo) => `    { nome = ${JSON.stringify(campo.nome)}, tipo = ${JSON.stringify(campo.tipo)}, obrigatorio = ${campo.modificadores.includes("required") ? "true" : "false"} },`).join("\n")}\n  }`;
}

function valorPadraoLua(campo: IrCampo): string {
  if (campo.cardinalidade === "lista") {
    return "{}";
  }
  if (campo.cardinalidade === "mapa") {
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

function normalizarReferenciaLua(referencia: string): string {
  return referencia
    .split(".")
    .map((parte) => `[${JSON.stringify(parte)}]`)
    .join("");
}

function resolverReferenciaLua(referencia: string, variavel: string): string {
  const partes = referencia.split(".").filter(Boolean);
  if (partes.length === 0) {
    return variavel;
  }
  return `${variavel}${partes.map((parte) => `[${JSON.stringify(parte)}]`).join("")}`;
}

function formatarValorLua(valor: string, camposConhecidos: Set<string>, variavel: string): string {
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

function gerarExpressaoLua(expressao: ExpressaoSemantica, camposConhecidos: Set<string>, variavel: string): string {
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

function gerarValidacoes(task: IrTask): string {
  const linhas: string[] = [];
  const camposEntrada = new Set(task.input.map((campo) => campo.nome));

  for (const campo of task.input) {
    if (campo.modificadores.includes("required")) {
      linhas.push(`  if entrada[${JSON.stringify(campo.nome)}] == nil then error("Campo obrigatorio ausente: ${campo.nome}") end`);
    }
  }

  for (const regra of task.regrasEstruturadas) {
    if (regra.tipo === "predicado") {
      linhas.push(`  -- Predicado declarado em Sema: ${regra.textoOriginal}`);
      continue;
    }
    linhas.push(`  if not (${gerarExpressaoLua(regra, camposEntrada, "entrada")}) then error("Regra violada: ${regra.textoOriginal}") end`);
  }

  for (const regra of task.rules.filter((texto) => !task.regrasEstruturadas.some((estruturada) => estruturada.textoOriginal === texto))) {
    linhas.push(`  -- Regra declarada em Sema: ${regra}`);
  }

  return linhas.join("\n");
}

function gerarGarantias(task: IrTask): string {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const linhas: string[] = [];

  for (const garantia of task.garantiasEstruturadas) {
    if (garantia.tipo === "predicado") {
      linhas.push(`  -- Predicado de garantia declarado em Sema: ${garantia.textoOriginal}`);
      continue;
    }
    linhas.push(`  if not (${gerarExpressaoLua(garantia, camposSaida, "saida")}) then error("Garantia violada: ${garantia.textoOriginal}") end`);
  }

  for (const garantia of task.guarantees.filter((texto) => !task.garantiasEstruturadas.some((estruturada) => estruturada.textoOriginal === texto))) {
    linhas.push(`  -- Garantia declarada em Sema: ${garantia}`);
  }

  if (linhas.length === 0) {
    linhas.push("  return");
  }

  return `local function verificar_garantias_${normalizarNomeParaSimbolo(task.nome)}(saida)\n${linhas.join("\n")}\nend`;
}

function gerarAjustesGarantias(task: IrTask): string[] {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const tabelasGarantidas = new Set<string>();
  const ajustes: string[] = [];

  for (const garantia of task.garantiasEstruturadas) {
    if (garantia.tipo === "pertencimento" && garantia.valores && camposSaida.has(garantia.alvo)) {
      ajustes.push(`  saida[${JSON.stringify(garantia.alvo)}] = ${formatarValorLua(garantia.valores[0] ?? "", camposSaida, "saida")}`);
      continue;
    }

    if (garantia.tipo === "comparacao" && garantia.valor) {
      const [raiz, filho] = garantia.alvo.split(".", 2);
      if (!raiz || !camposSaida.has(raiz)) {
        continue;
      }

      if (filho) {
        if (!tabelasGarantidas.has(raiz)) {
          ajustes.push(`  saida[${JSON.stringify(raiz)}] = saida[${JSON.stringify(raiz)}] or {}`);
          tabelasGarantidas.add(raiz);
        }
        ajustes.push(`  ${resolverReferenciaLua(garantia.alvo, "saida")} = ${formatarValorLua(garantia.valor, camposSaida, "saida")}`);
        continue;
      }

      ajustes.push(`  saida[${JSON.stringify(garantia.alvo)}] = ${formatarValorLua(garantia.valor, camposSaida, "saida")}`);
      continue;
    }

    if (garantia.tipo === "existe") {
      const [raiz, filho] = garantia.alvo.split(".", 2);
      if (!raiz || !filho || !camposSaida.has(raiz)) {
        continue;
      }

      if (!tabelasGarantidas.has(raiz)) {
        ajustes.push(`  saida[${JSON.stringify(raiz)}] = saida[${JSON.stringify(raiz)}] or {}`);
        tabelasGarantidas.add(raiz);
      }
      ajustes.push(`  if ${resolverReferenciaLua(garantia.alvo, "saida")} == nil then ${resolverReferenciaLua(garantia.alvo, "saida")} = "valor_garantido" end`);
    }
  }

  return ajustes;
}

function gerarPreparacaoSaida(task: IrTask): string {
  if (task.output.length === 0) {
    return "  local saida = nil";
  }

  const linhas = task.output.map((campo) => `    [${JSON.stringify(campo.nome)}] = ${valorPadraoLua(campo)},`);
  const ajustes = gerarAjustesGarantias(task);
  return `  local saida = {\n${linhas.join("\n")}\n  }${ajustes.length > 0 ? `\n${ajustes.join("\n")}` : ""}`;
}

function formatarLiteralTesteLua(valor: string, tipoDeclarado?: string): string {
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
  if (valor === "nulo") {
    return "nil";
  }
  return JSON.stringify(valor);
}

function gerarTabelaLua(campos: Array<{ nome: string; valor: string }>, blocos: Array<{ nome: string; conteudo: string }>): string {
  const entradas = [
    ...campos.map((campo) => `  [${JSON.stringify(campo.nome)}] = ${campo.valor},`),
    ...blocos.map((bloco) => `  [${JSON.stringify(bloco.nome)}] = ${bloco.conteudo},`),
  ];
  if (entradas.length === 0) {
    return "{}";
  }
  return `{\n${entradas.join("\n")}\n}`;
}

function converterBlocoTesteParaLua(bloco: IrBlocoDeclarativo, tiposDeclarados?: Map<string, string>): string {
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

function gerarTabelaTiposDeclarados(task: IrTask): Map<string, string> {
  return new Map(task.input.map((campo) => [campo.nome, campo.tipo]));
}

function gerarTestesLua(modulo: IrModulo, arquivoModulo: string): string | undefined {
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

function gerarMetadadosTask(task: IrTask): string {
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

function gerarFuncoesTask(task: IrTask): string {
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
