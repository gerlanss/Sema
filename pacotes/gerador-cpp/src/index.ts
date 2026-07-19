// SEMA-GOVERNED: sema.produto.geradores_nativos, sema.produto.geradores_codigo_governado
// Descrição: gera projetos C++/CMake autocontidos e testes locais sem framework externo a partir do IR Sema.

import path from "node:path";
import type {
  ExpressaoSemantica,
  IrBlocoDeclarativo,
  IrCampo,
  IrEntity,
  IrModulo,
  IrTask,
  IrType,
} from "@sema/nucleo";
import {
  descreverEstruturaModulo,
  dividirTipoNoNivelRaiz,
  extrairTiposNomeados,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
} from "@sema/padroes";

const TIPOS_PRIMITIVOS_SEMA = new Set([
  "Texto",
  "Numero",
  "Inteiro",
  "Decimal",
  "Booleano",
  "Data",
  "DataHora",
  "Id",
  "Email",
  "Url",
  "Json",
  "Objeto",
  "Lista",
  "Mapa",
  "Vazio",
]);

const PALAVRAS_RESERVADAS_CPP = new Set([
  "alignas", "alignof", "and", "and_eq", "asm", "auto", "bitand", "bitor", "bool", "break",
  "case", "catch", "char", "char16_t", "char32_t", "class", "compl", "concept", "const",
  "consteval", "constexpr", "constinit", "const_cast", "continue", "co_await", "co_return", "co_yield",
  "decltype", "default", "delete", "do", "double", "dynamic_cast", "else", "enum", "explicit",
  "export", "extern", "false", "float", "for", "friend", "goto", "if", "inline", "int", "long",
  "mutable", "namespace", "new", "noexcept", "not", "not_eq", "nullptr", "operator", "or", "or_eq",
  "private", "protected", "public", "register", "reinterpret_cast", "requires", "return", "short",
  "signed", "sizeof", "static", "static_assert", "static_cast", "struct", "switch", "template", "this",
  "thread_local", "throw", "true", "try", "typedef", "typeid", "typename", "union", "unsigned", "using",
  "virtual", "void", "volatile", "wchar_t", "while", "xor", "xor_eq",
]);

type ModeloCpp = { nome: string; campos: IrCampo[]; origem: "type" | "entity" };
type ModoInicializacao = "modelo" | "entrada" | "saida";
type TipoCabecalhoCpp = "cabecalho" | "implementacao" | "teste" | "cmake";

function identificadorCpp(valor: string, fallback = "valor"): string {
  let simbolo = normalizarNomeParaSimbolo(valor) || fallback;
  if (/^\d/.test(simbolo)) {
    simbolo = `valor_${simbolo}`;
  }
  if (PALAVRAS_RESERVADAS_CPP.has(simbolo)) {
    simbolo = `${simbolo}_sema`;
  }
  return simbolo;
}

function paraPascalCase(valor: string): string {
  const partes = identificadorCpp(valor, "Contrato").split(/_+/).filter(Boolean);
  const nome = partes.map((parte) => parte[0]!.toUpperCase() + parte.slice(1)).join("");
  const seguro = nome || "Contrato";
  return /^\d/.test(seguro) ? `Tipo${seguro}` : seguro;
}

function paraConstanteCpp(valor: string): string {
  const simbolo = identificadorCpp(valor, "VAZIO").toUpperCase();
  return /^\d/.test(simbolo) ? `VALOR_${simbolo}` : simbolo;
}

function comentarioCpp(valor: string): string {
  return valor.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
}

function literalStringCpp(valor: string): string {
  return JSON.stringify(valor);
}

function removerAspas(valor: string): string {
  return valor.trim().replace(/^["']|["']$/g, "");
}

function nomeNamespace(modulo: IrModulo): string {
  const segmentos = modulo.nome.split(".").map((item) => identificadorCpp(item.toLowerCase())).filter(Boolean);
  return ["sema_generated", ...segmentos].join("::");
}

function mapearTipoCpp(tipo: string): string {
  const limpo = tipo.trim();
  const uniao = dividirTipoNoNivelRaiz(limpo, "|");
  if (uniao.length > 1) {
    const alternativas = [...new Set(uniao.map(mapearTipoCpp))];
    return `std::variant<${alternativas.join(", ")}>`;
  }
  if (/^Opcional<.+>$/.test(limpo)) {
    return `std::optional<${mapearTipoCpp(limpo.slice("Opcional<".length, -1))}>`;
  }
  if (limpo.endsWith("[]")) {
    return `std::vector<${mapearTipoCpp(limpo.slice(0, -2))}>`;
  }
  if (/^Lista<.+>$/.test(limpo)) {
    return `std::vector<${mapearTipoCpp(limpo.slice("Lista<".length, -1))}>`;
  }
  if (/^Mapa<.+>$/.test(limpo)) {
    const partes = dividirTipoNoNivelRaiz(limpo.slice("Mapa<".length, -1), ",");
    return `std::map<${mapearTipoCpp(partes[0] ?? "Texto")}, ${mapearTipoCpp(partes[1] ?? "Json")}>`;
  }
  switch (limpo) {
    case "Texto":
    case "Id":
    case "Email":
    case "Url":
    case "Data":
    case "DataHora":
      return "std::string";
    case "Numero":
    case "Decimal":
      return "double";
    case "Inteiro":
      return "std::int64_t";
    case "Booleano":
      return "bool";
    case "Json":
      return "JsonValue";
    case "Objeto":
      return "std::map<std::string, JsonValue>";
    case "Lista":
      return "std::vector<JsonValue>";
    case "Mapa":
      return "std::map<std::string, JsonValue>";
    case "Vazio":
      return "std::monostate";
    default:
      return paraPascalCase(limpo);
  }
}

function tipoCampoCpp(campo: IrCampo): string {
  let tipo: string;
  if (campo.cardinalidade === "lista") {
    tipo = `std::vector<${mapearTipoCpp(campo.tipoItem ?? campo.tipoBase)}>`;
  } else if (campo.cardinalidade === "mapa") {
    tipo = `std::map<${mapearTipoCpp(campo.chaveMapa ?? "Texto")}, ${mapearTipoCpp(campo.valorMapa ?? "Json")}>`;
  } else if (campo.cardinalidade === "uniao") {
    const alternativas = [...new Set(campo.tiposAlternativos.map(mapearTipoCpp))];
    tipo = alternativas.length > 0 ? `std::variant<${alternativas.join(", ")}>` : "JsonValue";
  } else {
    tipo = mapearTipoCpp(campo.tipoBase || campo.tipo);
  }
  if (campo.opcional && !tipo.startsWith("std::optional<")) {
    return `std::optional<${tipo}>`;
  }
  return tipo;
}

function enumDoCampo(campo: IrCampo, modulo: IrModulo) {
  return modulo.enums.find((item) => item.nome === campo.tipoBase || item.nome === campo.tipo);
}

function valorInicialCpp(campo: IrCampo, modulo: IrModulo, modo: ModoInicializacao): string {
  if (campo.opcional) {
    return "std::nullopt";
  }
  if (campo.cardinalidade === "lista" || campo.cardinalidade === "mapa") {
    return "{}";
  }
  if (campo.cardinalidade === "uniao") {
    const primeiro = campo.tiposAlternativos[0];
    return primeiro ? `${mapearTipoCpp(primeiro)}{}` : "JsonValue{}";
  }
  const enumeracao = enumDoCampo(campo, modulo);
  if (enumeracao) {
    return `${paraPascalCase(enumeracao.nome)}::${paraConstanteCpp(enumeracao.valores[0] ?? "VAZIO")}`;
  }
  switch (campo.tipoBase) {
    case "Texto":
    case "Id":
    case "Email":
    case "Url":
    case "Data":
    case "DataHora":
      return modo === "saida" ? literalStringCpp(`${campo.nome}_exemplo`) : "{}";
    case "Numero":
    case "Decimal":
      return modo === "saida" ? "1.0" : "0.0";
    case "Inteiro":
      return modo === "saida" ? "1" : "0";
    case "Booleano":
      return "false";
    case "Json":
      return modo === "saida" ? literalStringCpp("{}") : "{}";
    case "Vazio":
      return "{}";
    default:
      return "{}";
  }
}

function literalCpp(valor: string, campo: IrCampo | undefined, modulo: IrModulo): string {
  const texto = removerAspas(valor);
  if (!campo) {
    if (texto === "verdadeiro") return "true";
    if (texto === "falso") return "false";
    if (texto === "nulo") return "{}";
    if (/^-?\d+(?:\.\d+)?$/.test(texto)) return texto;
    return literalStringCpp(texto);
  }
  const ehLista = campo.cardinalidade === "lista" || campo.tipoBase === "Lista";
  const ehMapa = campo.cardinalidade === "mapa" || ["Mapa", "Objeto"].includes(campo.tipoBase);
  if (ehLista) {
    const tipoItem = campo.tipoItem ?? "Json";
    const campoItem: IrCampo = {
      ...campo,
      tipo: tipoItem,
      tipoOriginal: tipoItem,
      tipoBase: tipoItem,
      cardinalidade: "unitario",
      opcional: false,
      tiposAlternativos: [],
      refinamentos: [],
    };
    const itens = dividirTipoNoNivelRaiz(texto.replace(/^\[|\]$/g, ""), ",")
      .filter(Boolean)
      .map((item) => literalCpp(item, campoItem, modulo));
    const tipo = tipoCampoCpp(campo).replace(/^std::optional<(.+)>$/, "$1");
    return `${tipo}{${itens.join(", ")}}`;
  }
  if (ehMapa) {
    const tipo = tipoCampoCpp(campo).replace(/^std::optional<(.+)>$/, "$1");
    return `${tipo}{}`;
  }
  const enumeracao = enumDoCampo(campo, modulo);
  if (enumeracao) {
    return `${paraPascalCase(enumeracao.nome)}::${paraConstanteCpp(texto)}`;
  }
  switch (campo.tipoBase) {
    case "Booleano":
      return texto === "verdadeiro" || texto === "true" ? "true" : "false";
    case "Numero":
    case "Decimal":
    case "Inteiro":
      return /^-?\d+(?:\.\d+)?$/.test(texto) ? texto : valorInicialCpp(campo, modulo, "modelo");
    case "Texto":
    case "Id":
    case "Email":
    case "Url":
    case "Data":
    case "DataHora":
    case "Json":
      return literalStringCpp(texto);
    case "Vazio":
      return "{}";
    default:
      return `${tipoCampoCpp(campo)}{}`;
  }
}

function coletarTiposExternos(modulo: IrModulo): string[] {
  const locais = new Set([
    ...modulo.types.map((item) => item.nome),
    ...modulo.entities.map((item) => item.nome),
    ...modulo.enums.map((item) => item.nome),
  ]);
  const campos = [
    ...modulo.types.flatMap((item) => item.definicao.campos),
    ...modulo.entities.flatMap((item) => item.campos),
    ...modulo.tasks.flatMap((item) => [...item.input, ...item.output]),
    ...modulo.routes.flatMap((item) => [...item.inputPublico, ...item.outputPublico]),
    ...modulo.states.flatMap((item) => item.campos),
  ];
  const externos = new Set<string>();
  for (const campo of campos) {
    for (const tipo of extrairTiposNomeados(campo.tipo)) {
      if (!locais.has(tipo) && !TIPOS_PRIMITIVOS_SEMA.has(tipo)) {
        externos.add(tipo);
      }
    }
  }
  return [...externos].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function ordenarModelos(modulo: IrModulo): ModeloCpp[] {
  const modelos: ModeloCpp[] = [
    ...modulo.types.map((item: IrType) => ({ nome: item.nome, campos: item.definicao.campos, origem: "type" as const })),
    ...modulo.entities.map((item: IrEntity) => ({ nome: item.nome, campos: item.campos, origem: "entity" as const })),
  ];
  const nomes = new Set(modelos.map((item) => item.nome));
  const pendentes = [...modelos];
  const emitidos = new Set<string>();
  const ordenados: ModeloCpp[] = [];
  while (pendentes.length > 0) {
    const indice = pendentes.findIndex((modelo) => modelo.campos.every((campo) =>
      extrairTiposNomeados(campo.tipo).every((tipo) => !nomes.has(tipo) || tipo === modelo.nome || emitidos.has(tipo))));
    const escolhido = pendentes.splice(indice >= 0 ? indice : 0, 1)[0]!;
    ordenados.push(escolhido);
    emitidos.add(escolhido.nome);
  }
  return ordenados;
}

function gerarStruct(nome: string, campos: IrCampo[], modulo: IrModulo, modo: ModoInicializacao): string {
  const linhas = campos.map((campo) =>
    `    ${tipoCampoCpp(campo)} ${identificadorCpp(campo.nome)} = ${valorInicialCpp(campo, modulo, modo)};`);
  return `struct ${paraPascalCase(nome)} final {
${linhas.length > 0 ? linhas.join("\n") : "    // Estrutura intencionalmente vazia."}
    bool operator==(const ${paraPascalCase(nome)}&) const = default;
};`;
}

function gerarEnum(nome: string, valores: string[]): string {
  const itens = (valores.length > 0 ? valores : ["VAZIO"]).map((valor) => `    ${paraConstanteCpp(valor)}`).join(",\n");
  return `enum class ${paraPascalCase(nome)} {
${itens}
};`;
}

function camposPorNome(campos: IrCampo[]): Map<string, IrCampo> {
  return new Map(campos.map((campo) => [campo.nome, campo]));
}

function resolverReferenciaCpp(
  referencia: string,
  campos: Map<string, IrCampo>,
  variavel: string,
  modulo: IrModulo,
): { codigo: string; campo: IrCampo } | undefined {
  const partes = referencia.split(".").filter(Boolean);
  let campo = campos.get(partes[0] ?? "");
  if (!campo) return undefined;
  let codigo = `${variavel}.${identificadorCpp(campo.nome)}`;
  for (const parte of partes.slice(1)) {
    const modelo = [...modulo.types.map((item) => ({ nome: item.nome, campos: item.definicao.campos })), ...modulo.entities]
      .find((item) => item.nome === campo?.tipoBase);
    const filho = modelo?.campos.find((item) => item.nome === parte);
    if (!filho) return undefined;
    codigo += `${campo.opcional ? "->" : "."}${identificadorCpp(filho.nome)}`;
    campo = filho;
  }
  return { codigo, campo };
}

function formatarValorExpressaoCpp(
  valor: string,
  alvo: string,
  campos: Map<string, IrCampo>,
  variavel: string,
  modulo: IrModulo,
): string {
  const referenciaValor = resolverReferenciaCpp(valor, campos, variavel, modulo);
  if (referenciaValor) return referenciaValor.codigo;
  return literalCpp(valor, resolverReferenciaCpp(alvo, campos, variavel, modulo)?.campo, modulo);
}

function expressaoExisteCpp(
  alvo: string,
  campos: Map<string, IrCampo>,
  variavel: string,
  modulo: IrModulo,
): string | undefined {
  const referencia = resolverReferenciaCpp(alvo, campos, variavel, modulo);
  if (!referencia) return undefined;
  if (referencia.campo.opcional) return `${referencia.codigo}.has_value()`;
  if (
    referencia.campo.cardinalidade === "lista"
    || referencia.campo.cardinalidade === "mapa"
    || ["Texto", "Id", "Email", "Url", "Data", "DataHora", "Json", "Lista", "Mapa", "Objeto"].includes(referencia.campo.tipoBase)
  ) {
    return `!${referencia.codigo}.empty()`;
  }
  return "true";
}

function resolverPredicadoCpp(
  expressao: Extract<ExpressaoSemantica, { tipo: "predicado" }>,
  campos: Map<string, IrCampo>,
  variavel: string,
  modulo: IrModulo,
): string | undefined {
  const referencia = resolverReferenciaCpp(expressao.alvo, campos, variavel, modulo);
  if (!referencia) return undefined;
  const predicado = expressao.predicadoCanonico ?? expressao.predicado;
  if (["preenchido", "nao_vazio", "valido"].includes(predicado)) {
    return expressaoExisteCpp(expressao.alvo, campos, variavel, modulo);
  }
  if (predicado === "positivo" && ["Numero", "Inteiro", "Decimal"].includes(referencia.campo.tipoBase)) {
    return `${referencia.codigo} > 0`;
  }
  if (predicado === "diferente_de_zero" && ["Numero", "Inteiro", "Decimal"].includes(referencia.campo.tipoBase)) {
    return `${referencia.codigo} != 0`;
  }
  if (predicado === "numero_valido" && ["Numero", "Decimal"].includes(referencia.campo.tipoBase)) {
    return `std::isfinite(${referencia.codigo})`;
  }
  if (predicado === "email_valido" && ["Texto", "Email"].includes(referencia.campo.tipoBase)) {
    return `${referencia.codigo}.find('@') != std::string::npos`;
  }
  if (["em", "um_de"].includes(predicado) && expressao.argumentos) {
    const valores = dividirTipoNoNivelRaiz(expressao.argumentos.replace(/^\[|\]$/g, ""), ",").filter(Boolean);
    return valores.length > 0
      ? `(${valores.map((valor) => `${referencia.codigo} == ${literalCpp(valor, referencia.campo, modulo)}`).join(" || ")})`
      : undefined;
  }
  if (predicado === "booleano") return referencia.campo.tipoBase === "Booleano" ? "true" : undefined;
  if (predicado === "verdadeiro" && referencia.campo.tipoBase === "Booleano") return referencia.codigo;
  return undefined;
}

function resolverExpressaoCpp(
  expressao: ExpressaoSemantica,
  campos: Map<string, IrCampo>,
  variavel: string,
  modulo: IrModulo,
): string | undefined {
  switch (expressao.tipo) {
    case "existe":
      return expressaoExisteCpp(expressao.alvo, campos, variavel, modulo);
    case "comparacao": {
      if (/\squando\s/u.test(expressao.valor)) return undefined;
      const alvo = resolverReferenciaCpp(expressao.alvo, campos, variavel, modulo);
      if (!alvo) return undefined;
      const valor = expressao.valorLiteral === false
        ? resolverReferenciaCpp(expressao.valor, campos, variavel, modulo)?.codigo
        : formatarValorExpressaoCpp(expressao.valor, expressao.alvo, campos, variavel, modulo);
      if (!valor) return undefined;
      if (!["==", "!="].includes(expressao.operador)
        && !["Texto", "Id", "Email", "Url", "Data", "DataHora", "Numero", "Inteiro", "Decimal"].includes(alvo.campo.tipoBase)
        && !enumDoCampo(alvo.campo, modulo)) return undefined;
      return `${alvo.codigo} ${expressao.operador} ${valor}`;
    }
    case "pertencimento": {
      const alvo = resolverReferenciaCpp(expressao.alvo, campos, variavel, modulo);
      if (!alvo) return undefined;
      const opcoes = expressao.valores.map((valor) =>
        `${alvo.codigo} == ${literalCpp(valor, alvo.campo, modulo)}`);
      return opcoes.length > 0 ? `(${opcoes.join(" || ")})` : "false";
    }
    case "predicado":
      return resolverPredicadoCpp(expressao, campos, variavel, modulo);
    case "composta": {
      const termos = expressao.termos.map((termo) => resolverExpressaoCpp(termo, campos, variavel, modulo));
      return termos.some((termo) => !termo)
        ? undefined
        : `(${termos.join(expressao.operadorLogico === "e" ? " && " : " || ")})`;
    }
    case "negacao": {
      const termo = resolverExpressaoCpp(expressao.termo, campos, variavel, modulo);
      return termo ? `!(${termo})` : undefined;
    }
  }
}

function gerarValidacoes(task: IrTask, modulo: IrModulo): string {
  const campos = camposPorNome(task.input);
  const linhas: string[] = ["    (void)entrada;"];
  for (const campo of task.input.filter((item) => item.modificadores.includes("required"))) {
    const referencia = `entrada.${identificadorCpp(campo.nome)}`;
    if (campo.opcional) {
      linhas.push(`    if (!${referencia}.has_value()) throw std::invalid_argument(${literalStringCpp(`Campo obrigatório ausente: ${campo.nome}`)});`);
    } else if (["Texto", "Id", "Email", "Url", "Data", "DataHora"].includes(campo.tipoBase)) {
      linhas.push(`    if (${referencia}.empty()) throw std::invalid_argument(${literalStringCpp(`Campo obrigatório vazio: ${campo.nome}`)});`);
    }
  }
  for (const regra of task.regrasEstruturadas) {
    const condicao = resolverExpressaoCpp(regra, campos, "entrada", modulo);
    linhas.push(condicao
      ? `    if (!(${condicao})) throw std::invalid_argument(${literalStringCpp(`Regra violada: ${regra.textoOriginal}`)});`
      : `    // SEMA-UNENFORCED: regra exige implementação de domínio: ${comentarioCpp(regra.textoOriginal)}`);
  }
  for (const regra of task.rules.filter((item) => !task.regrasEstruturadas.some((estruturada) => estruturada.textoOriginal === item))) {
    linhas.push(`    // Regra declarada em Sema: ${comentarioCpp(regra)}`);
  }
  return linhas.join("\n");
}

function gerarGarantias(task: IrTask, modulo: IrModulo): string {
  const campos = camposPorNome(task.output);
  const linhas: string[] = ["    (void)saida;"];
  for (const garantia of task.garantiasEstruturadas) {
    const condicao = resolverExpressaoCpp(garantia, campos, "saida", modulo);
    linhas.push(condicao
      ? `    if (!(${condicao})) throw std::runtime_error(${literalStringCpp(`Garantia violada: ${garantia.textoOriginal}`)});`
      : `    // SEMA-UNENFORCED: garantia exige implementação de domínio: ${comentarioCpp(garantia.textoOriginal)}`);
  }
  for (const garantia of task.guarantees.filter((item) => !task.garantiasEstruturadas.some((estruturada) => estruturada.textoOriginal === item))) {
    linhas.push(`    // Garantia declarada em Sema: ${comentarioCpp(garantia)}`);
  }
  return linhas.join("\n");
}

function coletarErrosTask(task: IrTask): Map<string, string> {
  const erros = new Map(Object.entries(task.errors));
  for (const caso of task.tests) {
    const tipo = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
    if (tipo && !erros.has(tipo)) {
      erros.set(tipo, `Erro sintético gerado a partir do caso de teste "${caso.nome}".`);
    }
  }
  return erros;
}

function nomeClasseErro(task: IrTask, codigo: string): string {
  return `${paraPascalCase(task.nome)}${paraPascalCase(codigo)}Erro`;
}

function gerarErrosTask(task: IrTask): string {
  return [...coletarErrosTask(task).entries()].map(([codigo, mensagem]) => `class ${nomeClasseErro(task, codigo)} final : public std::runtime_error {
public:
    inline static constexpr std::string_view codigo = ${literalStringCpp(codigo)};
    ${nomeClasseErro(task, codigo)}() : std::runtime_error(${literalStringCpp(mensagem)}) {}
};`).join("\n\n");
}

function literalCamposContrato(campos: IrCampo[]): string {
  return campos.length > 0
    ? `{\n${campos.map((campo) => `        {${literalStringCpp(campo.nome)}, ${literalStringCpp(campo.tipo)}, ${campo.modificadores.includes("required") ? "true" : "false"}}`).join(",\n")}\n    }`
    : "{}";
}

function literalStringsCpp(valores: string[]): string {
  return valores.length > 0 ? `{${valores.map((item) => literalStringCpp(item)).join(", ")}}` : "{}";
}

function gerarDeclaracoesTask(task: IrTask, modulo: IrModulo): string {
  const nome = identificadorCpp(task.nome);
  const entrada = paraPascalCase(`${task.nome}_entrada`);
  const saida = paraPascalCase(`${task.nome}_saida`);
  return `${gerarStruct(`${task.nome}_entrada`, task.input, modulo, "entrada")}

${gerarStruct(`${task.nome}_saida`, task.output, modulo, "saida")}

${gerarErrosTask(task)}${coletarErrosTask(task).size > 0 ? "\n\n" : ""}TaskContract contrato_${nome}();
void validar_${nome}(const ${entrada}& entrada);
void verificar_garantias_${nome}(const ${saida}& saida);
${saida} executar_${nome}(const ${entrada}& entrada, const ExecutionContext& contexto = {});`;
}

function valorExistenteCpp(campo: IrCampo, modulo: IrModulo): string | undefined {
  if (campo.cardinalidade === "lista" || campo.tipoBase === "Lista") {
    return literalCpp("valor_garantido", campo, modulo);
  }
  if (campo.cardinalidade === "mapa" || ["Mapa", "Objeto"].includes(campo.tipoBase)) {
    const tipo = tipoCampoCpp(campo).replace(/^std::optional<(.+)>$/, "$1");
    const tipoChave = mapearTipoCpp(campo.chaveMapa ?? "Texto");
    const tipoValor = mapearTipoCpp(campo.valorMapa ?? "Json");
    const chave = tipoChave === "std::string" ? literalStringCpp("chave") : `${tipoChave}{}`;
    const valor = tipoValor === "std::string" ? literalStringCpp("valor") : `${tipoValor}{}`;
    return `${tipo}{{${chave}, ${valor}}}`;
  }
  if (["Texto", "Id", "Email", "Url", "Data", "DataHora", "Json"].includes(campo.tipoBase)) {
    return literalCpp("valor_garantido", campo, modulo);
  }
  if (campo.opcional) {
    return tipoCampoCpp(campo).replace(/^std::optional<(.+)>$/, "$1") + "{}";
  }
  return undefined;
}

function valorParaComparacaoCpp(
  garantia: Extract<ExpressaoSemantica, { tipo: "comparacao" }>,
  campo: IrCampo,
  modulo: IrModulo,
): string | undefined {
  if (garantia.valorLiteral === false) return undefined;
  if (garantia.operador === "==") return literalCpp(garantia.valor, campo, modulo);
  const texto = removerAspas(garantia.valor);
  if (campo.tipoBase === "Booleano" && garantia.operador === "!=") {
    return ["verdadeiro", "true"].includes(texto) ? "false" : "true";
  }
  const numero = Number(texto);
  if (["Numero", "Inteiro", "Decimal"].includes(campo.tipoBase) && Number.isFinite(numero)) {
    const delta = garantia.operador === ">" || garantia.operador === "!=" ? 1 : garantia.operador === "<" ? -1 : 0;
    return String(numero + delta);
  }
  if (garantia.operador === "!=" && ["Texto", "Id", "Email", "Url"].includes(campo.tipoBase)) {
    return literalStringCpp(`${texto}_alternativo`);
  }
  return undefined;
}

function gerarAjustesSaida(task: IrTask, modulo: IrModulo): string[] {
  const campos = camposPorNome(task.output);
  const ajustes: string[] = [];
  const ajustar = (garantia: ExpressaoSemantica): void => {
    if (garantia.tipo === "composta") {
      const termos = garantia.operadorLogico === "e" ? garantia.termos : garantia.termos.slice(0, 1);
      termos.forEach(ajustar);
      return;
    }
    if (garantia.tipo === "negacao") return;
    const referencia = "alvo" in garantia
      ? resolverReferenciaCpp(garantia.alvo, campos, "saida", modulo)
      : undefined;
    if (!referencia) return;
    const campo = referencia.campo;
    const destino = referencia.codigo;
    if (garantia.tipo === "pertencimento" && garantia.valores[0] !== undefined) {
      ajustes.push(`    ${destino} = ${literalCpp(garantia.valores[0], campo, modulo)};`);
    }
    if (garantia.tipo === "predicado" && ["em", "um_de"].includes(garantia.predicadoCanonico ?? garantia.predicado)
      && garantia.argumentos) {
      const primeiro = dividirTipoNoNivelRaiz(garantia.argumentos.replace(/^\[|\]$/g, ""), ",")[0];
      if (primeiro) ajustes.push(`    ${destino} = ${literalCpp(primeiro, campo, modulo)};`);
    }
    if (garantia.tipo === "comparacao") {
      const valor = valorParaComparacaoCpp(garantia, campo, modulo);
      if (valor) ajustes.push(`    ${destino} = ${valor};`);
    }
    if (garantia.tipo === "existe" || (garantia.tipo === "predicado"
      && ["preenchido", "nao_vazio", "valido"].includes(garantia.predicadoCanonico ?? garantia.predicado))) {
      const valor = valorExistenteCpp(campo, modulo);
      if (valor) ajustes.push(`    ${destino} = ${valor};`);
    }
    if (garantia.tipo === "predicado" && garantia.predicadoCanonico === "positivo"
      && ["Numero", "Inteiro", "Decimal"].includes(campo.tipoBase)) {
      ajustes.push(`    ${destino} = 1;`);
    }
  };
  task.garantiasEstruturadas.forEach(ajustar);
  return ajustes;
}

function gerarImplementacaoTask(task: IrTask, modulo: IrModulo): string {
  const nome = identificadorCpp(task.nome);
  const entrada = paraPascalCase(`${task.nome}_entrada`);
  const saida = paraPascalCase(`${task.nome}_saida`);
  const erros = [...coletarErrosTask(task).keys()];
  const falhas = erros.map((codigo) =>
    `    if (contexto.erro_esperado == ${literalStringCpp(codigo)}) throw ${nomeClasseErro(task, codigo)}{};`).join("\n");
  const efeitos = task.efeitosEstruturados.length > 0
    ? task.efeitosEstruturados.map((efeito) =>
      `    // Efeito estruturado: categoria=${comentarioCpp(efeito.categoria)} alvo=${comentarioCpp(efeito.alvo)}${efeito.detalhe ? ` detalhe=${comentarioCpp(efeito.detalhe)}` : ""}${efeito.criticidade ? ` criticidade=${efeito.criticidade}` : ""}`).join("\n")
    : task.effects.map((efeito) => `    // Efeito declarado: ${comentarioCpp(efeito)}`).join("\n");
  const metadadosEfeitos = task.efeitosEstruturados.map((efeito) =>
    `${efeito.categoria}:${efeito.alvo}${efeito.detalhe ? `:${efeito.detalhe}` : ""}`);
  return `TaskContract contrato_${nome}() {
    return TaskContract{
        ${literalStringCpp(task.nome)},
        ${literalCamposContrato(task.input)},
        ${literalCamposContrato(task.output)},
        ${literalStringsCpp(task.rules)},
        ${literalStringsCpp(task.guarantees)},
        ${literalStringsCpp(metadadosEfeitos.length > 0 ? metadadosEfeitos : task.effects)}
    };
}

void validar_${nome}(const ${entrada}& entrada) {
${gerarValidacoes(task, modulo)}
}

void verificar_garantias_${nome}(const ${saida}& saida) {
${gerarGarantias(task, modulo)}
}

${saida} executar_${nome}(const ${entrada}& entrada, const ExecutionContext& contexto) {
    (void)contexto;
${falhas ? `${falhas}\n` : ""}    validar_${nome}(entrada);
${task.stateContract ? `    // Vínculo de estado: ${comentarioCpp(task.stateContract.nomeEstado ?? "não definido")}\n    // Transições: ${comentarioCpp(task.stateContract.transicoes.map((item) => `${item.origem}->${item.destino}`).join(", ") || "nenhuma")}\n` : ""}${task.implementacoesExternas.map((item) => `    // Implementação externa: origem=${item.origem} caminho=${comentarioCpp(item.caminho)} status=${item.statusImpl ?? "não verificado"}`).join("\n")}${task.implementacoesExternas.length > 0 ? "\n" : ""}${efeitos || "    // Nenhum efeito declarado."}
    ${saida} saida{};
${gerarAjustesSaida(task, modulo).join("\n")}${gerarAjustesSaida(task, modulo).length > 0 ? "\n" : ""}    verificar_garantias_${nome}(saida);
    return saida;
}`;
}

function formatarValorTesteCpp(valor: string, campo: IrCampo | undefined, modulo: IrModulo): string {
  return literalCpp(valor, campo, modulo);
}

function gerarAtribuicoesGiven(task: IrTask, given: IrBlocoDeclarativo, modulo: IrModulo): string {
  const campos = camposPorNome(task.input);
  return given.campos.flatMap((item) => {
    const campo = campos.get(item.nome);
    if (!campo) return [];
    return [`    entrada.${identificadorCpp(campo.nome)} = ${formatarValorTesteCpp(item.tipo, campo, modulo)};`];
  }).join("\n");
}

function gerarAssercoesExpect(task: IrTask, expect: IrBlocoDeclarativo, modulo: IrModulo): string {
  const campos = camposPorNome(task.output);
  return expect.campos.flatMap((item) => {
    if (item.nome === "sucesso") return [];
    const campo = campos.get(item.nome);
    if (!campo) return [];
    return [`    assert_sema(resultado.${identificadorCpp(campo.nome)} == ${formatarValorTesteCpp(item.tipo, campo, modulo)}, ${literalStringCpp(`Saída inesperada para ${item.nome}`)});`];
  }).join("\n");
}

function gerarFuncaoTeste(task: IrTask, indice: number, modulo: IrModulo): { nome: string; rotulo: string; conteudo: string } {
  const caso = task.tests[indice]!;
  const nome = `test_${identificadorCpp(task.nome)}_${indice + 1}`;
  const entrada = paraPascalCase(`${task.nome}_entrada`);
  const atribuicoes = gerarAtribuicoesGiven(task, caso.given, modulo);
  const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
  if (tipoErro) {
    return {
      nome,
      rotulo: caso.nome,
      conteudo: `// SEMA-TEST: ${comentarioCpp(task.nome)} :: ${comentarioCpp(caso.nome)}
void ${nome}() {
    ${entrada} entrada{};
${atribuicoes ? `${atribuicoes}\n` : ""}    ExecutionContext contexto{};
    contexto.erro_esperado = ${literalStringCpp(tipoErro)};
    try {
        (void)executar_${identificadorCpp(task.nome)}(entrada, contexto);
    } catch (const ${nomeClasseErro(task, tipoErro)}& erro) {
        assert_sema(erro.codigo == ${literalStringCpp(tipoErro)}, "Código de erro inesperado");
        return;
    }
    throw std::runtime_error(${literalStringCpp(`Caso ${caso.nome} deveria falhar com ${tipoErro}`)});
}`,
    };
  }
  const assercoes = gerarAssercoesExpect(task, caso.expect, modulo);
  const esperaFalha = caso.expect.campos.some((campo) =>
    campo.nome === "sucesso" && ["falso", "false"].includes(removerAspas(campo.tipo).toLowerCase()));
  if (esperaFalha) {
    return {
      nome,
      rotulo: caso.nome,
      conteudo: `// SEMA-TEST: ${comentarioCpp(task.nome)} :: ${comentarioCpp(caso.nome)}
void ${nome}() {
    ${entrada} entrada{};
${atribuicoes ? `${atribuicoes}\n` : ""}    try {
        (void)executar_${identificadorCpp(task.nome)}(entrada);
    } catch (const std::exception&) {
        return;
    }
    throw std::runtime_error(${literalStringCpp(`Caso ${caso.nome} esperava sucesso falso`)});
}`,
    };
  }
  return {
    nome,
    rotulo: caso.nome,
    conteudo: `// SEMA-TEST: ${comentarioCpp(task.nome)} :: ${comentarioCpp(caso.nome)}
void ${nome}() {
    ${entrada} entrada{};
${atribuicoes ? `${atribuicoes}\n` : ""}    const auto resultado = executar_${identificadorCpp(task.nome)}(entrada);
    (void)resultado;
${assercoes || `    assert_sema(true, ${literalStringCpp(`Caso ${caso.nome} executado`)});`}
}`,
  };
}

function gerarCabecalhoSemaCpp(modulo: IrModulo, tipo: TipoCabecalhoCpp): string {
  const descricoes: Record<TipoCabecalhoCpp, string> = {
    cabecalho: "tipos, entidades, enums e contratos de tasks C++ derivados do IR Sema.",
    implementacao: "implementação C++ das regras, garantias e tasks declaradas no contrato Sema.",
    teste: "runner C++ autocontido gerado a partir dos casos de teste do contrato Sema.",
    cmake: "build CMake autocontido do módulo e de seu runner de testes C++.",
  };
  const prefixo = tipo === "cmake" ? "#" : "//";
  return [
    `${prefixo} SEMA-GOVERNED`,
    `${prefixo} Módulo de origem: ${modulo.nome}`,
    `${prefixo} Consulte o contrato .sema aplicável antes de editar este arquivo.`,
    `${prefixo} Rastreabilidade: outros contratos .sema podem governar este mesmo arquivo via vínculos.`,
    `${prefixo} Para IA fraca/média/forte: chame Sema, rode docs-impacto e drift antes de alterar código.`,
    `${prefixo} Descrição: ${descricoes[tipo]}`,
    "",
  ].join("\n");
}

function gerarHeader(modulo: IrModulo): string {
  const namespace = nomeNamespace(modulo);
  const enums = modulo.enums.map((item) => gerarEnum(item.nome, item.valores));
  const externos = coletarTiposExternos(modulo).map((item) => `struct ${paraPascalCase(item)} final {
    bool operator==(const ${paraPascalCase(item)}&) const = default;
};`);
  const modelos = ordenarModelos(modulo).map((item) =>
    `${gerarStruct(item.nome, item.campos, modulo, "modelo")}\n// Origem Sema: ${item.origem} ${comentarioCpp(item.nome)}`);
  const tasks = modulo.tasks.map((task) => gerarDeclaracoesTask(task, modulo));
  const interops = modulo.interoperabilidades.map((item) => `// Interop externo ${item.origem}: ${comentarioCpp(item.caminho)}`);
  const estados = modulo.states.map((item) => `// State${item.nome ? ` ${comentarioCpp(item.nome)}` : ""}: campos=${item.campos.length} invariantes=${item.invariantes.length} transições=${item.transicoes.length}`);
  const flows = modulo.flows.map((item) => `// Flow ${comentarioCpp(item.nome)}: etapas=${item.etapasEstruturadas.length} tasks=${comentarioCpp(item.tasksReferenciadas.join(", ") || "nenhuma")}`);
  const routes = modulo.routes.map((item) => `// Route ${comentarioCpp(item.nome)}: método=${item.metodo ?? "não definido"} caminho=${comentarioCpp(item.caminho ?? "não definido")} task=${comentarioCpp(item.task ?? "não definida")}`);
  const secoes = [...interops, ...enums, ...externos, ...modelos, ...tasks, ...estados, ...flows, ...routes].filter(Boolean).join("\n\n");
  return `${gerarCabecalhoSemaCpp(modulo, "cabecalho")}#pragma once

#include <cmath>
#include <cstdint>
#include <map>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

namespace ${namespace} {

using JsonValue = std::string;

struct CampoContrato final {
    std::string_view nome;
    std::string_view tipo;
    bool obrigatorio;
};

struct TaskContract final {
    std::string_view nome;
    std::vector<CampoContrato> input;
    std::vector<CampoContrato> output;
    std::vector<std::string_view> regras;
    std::vector<std::string_view> garantias;
    std::vector<std::string_view> efeitos;
};

struct ExecutionContext final {
    std::string erro_esperado{};
};

${secoes}

} // namespace ${namespace}
`;
}

function gerarSource(modulo: IrModulo, arquivoHeader: string): string {
  const namespace = nomeNamespace(modulo);
  const implementacoes = modulo.tasks.map((task) => gerarImplementacaoTask(task, modulo)).join("\n\n");
  return `${gerarCabecalhoSemaCpp(modulo, "implementacao")}#include ${literalStringCpp(path.posix.basename(arquivoHeader))}

namespace ${namespace} {

${implementacoes || "// Nenhuma task declarada no módulo."}

} // namespace ${namespace}
`;
}

function gerarTestes(modulo: IrModulo, arquivoHeader: string): string {
  const namespace = nomeNamespace(modulo);
  const testes = modulo.tasks.flatMap((task) => task.tests.map((_, indice) => ({ task, indice })));
  const funcoesDeclaradas = testes.map(({ task, indice }) => gerarFuncaoTeste(task, indice, modulo));
  const funcoes = funcoesDeclaradas.length > 0 ? funcoesDeclaradas : [{
    nome: "test_smoke_modulo",
    rotulo: "smoke do módulo sem casos declarados",
    conteudo: `// SEMA-TEST: smoke :: módulo sem casos declarados
void test_smoke_modulo() {
    assert_sema(true, "Runner C++ autocontido disponível");
}`,
  }];
  const registros = funcoes.map((item) =>
    `        {${literalStringCpp(item.rotulo)}, &${item.nome}}`).join(",\n");
  return `${gerarCabecalhoSemaCpp(modulo, "teste")}#include ${literalStringCpp(path.posix.basename(arquivoHeader))}

#include <iostream>
#include <stdexcept>
#include <string_view>
#include <utility>
#include <vector>

using namespace ${namespace};

namespace {

void assert_sema(bool condicao, std::string_view mensagem) {
    if (!condicao) throw std::runtime_error(std::string{mensagem});
}

${funcoes.map((item) => item.conteudo).join("\n\n")}

} // namespace

int main() {
    const std::vector<std::pair<std::string_view, void (*)()>> testes{
${registros}
    };
    for (const auto& [nome, executar] : testes) {
        std::cout << "test " << nome << '\\n';
        executar();
    }
    std::cout << "ok " << testes.size() << " testes\\n";
    return 0;
}
`;
}

function gerarCmake(modulo: IrModulo, arquivoSource: string, arquivoTeste: string): string {
  const nomeProjeto = `sema_${identificadorCpp(normalizarNomeModulo(modulo.nome).replace(/\./g, "_").toLowerCase())}`;
  const alvoBiblioteca = `${nomeProjeto}_lib`;
  const alvoTeste = `test_${nomeProjeto}`;
  return `${gerarCabecalhoSemaCpp(modulo, "cmake")}cmake_minimum_required(VERSION 3.16)
project(${nomeProjeto} LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(${alvoBiblioteca} STATIC ${path.posix.basename(arquivoSource)})
target_include_directories(${alvoBiblioteca} PUBLIC "\${CMAKE_CURRENT_SOURCE_DIR}")
target_compile_features(${alvoBiblioteca} PUBLIC cxx_std_20)

add_executable(${alvoTeste} ${path.posix.basename(arquivoTeste)})
target_link_libraries(${alvoTeste} PRIVATE ${alvoBiblioteca})

if(MSVC)
  target_compile_options(${alvoBiblioteca} PRIVATE /W4 /permissive-)
  target_compile_options(${alvoTeste} PRIVATE /W4 /permissive-)
else()
  target_compile_options(${alvoBiblioteca} PRIVATE -Wall -Wextra -Wpedantic)
  target_compile_options(${alvoTeste} PRIVATE -Wall -Wextra -Wpedantic)
endif()

include(CTest)
if(BUILD_TESTING)
  add_test(NAME ${alvoTeste} COMMAND ${alvoTeste})
endif()
`;
}

export function gerarCpp(modulo: IrModulo): ArquivoGerado[] {
  const estrutura = descreverEstruturaModulo(modulo.nome);
  const nomeBase = estrutura.nomeArquivo || normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const arquivoHeader = `${nomeBase}.hpp`;
  const arquivoSource = `${nomeBase}.cpp`;
  const arquivoTeste = `test_${nomeBase}.cpp`;
  const arquivoCmake = "CMakeLists.txt";
  return [
    { caminhoRelativo: arquivoHeader, conteudo: gerarHeader(modulo) },
    { caminhoRelativo: arquivoSource, conteudo: gerarSource(modulo, arquivoHeader) },
    { caminhoRelativo: arquivoTeste, conteudo: gerarTestes(modulo, arquivoHeader) },
    { caminhoRelativo: arquivoCmake, conteudo: gerarCmake(modulo, arquivoSource, arquivoTeste) },
  ];
}
