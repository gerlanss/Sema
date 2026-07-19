// SEMA-GOVERNED: sema.produto.geradores_nativos
// Contrato: contratos/sema/geradores_nativos.sema
// Descrição: gera projetos C#/.NET autocontidos e testes executáveis sem dependências NuGet externas.

import type { ExpressaoSemantica, IrCampo, IrCasoTeste, IrModulo, IrTask } from "@sema/nucleo";
import {
  extrairTiposNomeados,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
} from "@sema/padroes";

interface ContextoTipos {
  enums: Set<string>;
  valoresEnums: Map<string, string[]>;
  tiposLocais: Set<string>;
}

const PALAVRAS_RESERVADAS_CSHARP = new Set([
  "abstract", "as", "base", "bool", "break", "byte", "case", "catch", "char", "checked",
  "class", "const", "continue", "decimal", "default", "delegate", "do", "double", "else",
  "enum", "event", "explicit", "extern", "false", "finally", "fixed", "float", "for", "foreach",
  "goto", "if", "implicit", "in", "int", "interface", "internal", "is", "lock", "long",
  "namespace", "new", "null", "object", "operator", "out", "override", "params", "private",
  "protected", "public", "readonly", "ref", "return", "sbyte", "sealed", "short", "sizeof",
  "stackalloc", "static", "string", "struct", "switch", "this", "throw", "true", "try",
  "typeof", "uint", "ulong", "unchecked", "unsafe", "ushort", "using", "virtual", "void",
  "volatile", "while",
]);

const TIPOS_VALOR_CSHARP = new Set([
  "bool", "byte", "decimal", "double", "float", "int", "long", "sbyte", "short", "uint", "ulong",
  "ushort", "DateOnly", "DateTimeOffset", "Guid",
]);

function escaparComentario(valor: string): string {
  return valor.replace(/\r?\n/g, " ").replace(/\*\//g, "* /").trim();
}

function literalString(valor: string): string {
  return JSON.stringify(valor)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function paraPascalCase(valor: string, fallback = "Contrato"): string {
  const normalizado = normalizarNomeParaSimbolo(valor);
  const partes = normalizado.split(/_+/).filter(Boolean);
  let resultado = partes
    .map((parte) => parte.length > 0 ? parte[0]!.toUpperCase() + parte.slice(1) : "")
    .join("");
  resultado = resultado.replace(/[^A-Za-z0-9_]/g, "");
  if (!resultado) {
    resultado = fallback;
  }
  if (/^[0-9]/.test(resultado)) {
    resultado = `N${resultado}`;
  }
  if (PALAVRAS_RESERVADAS_CSHARP.has(resultado.toLowerCase())) {
    resultado = `${resultado}Value`;
  }
  return resultado;
}

function nomePropriedade(valor: string): string {
  return paraPascalCase(valor, "Valor");
}

function nomeNamespace(nomeModulo: string): string {
  const segmentos = nomeModulo.split(".").map((segmento) => paraPascalCase(segmento, "Modulo"));
  return segmentos.length > 0 ? segmentos.join(".") : "Sema.Generated";
}

function nomeProjeto(nomeModulo: string): string {
  return nomeModulo.split(".").map((segmento) => paraPascalCase(segmento, "Modulo")).join(".") || "Sema.Generated";
}

function tipoCSharp(tipo: string, contexto: ContextoTipos): string {
  const limpo = tipo.trim();
  if (/^Opcional<.+>$/.test(limpo)) {
    return tornarOpcional(tipoCSharp(limpo.slice("Opcional<".length, -1), contexto), contexto);
  }

  const uniao = dividirTipoRaiz(limpo, "|");
  if (uniao.length > 1) {
    const tipos = [...new Set(uniao.map((item) => tipoCSharp(item, contexto)))];
    return tipos.length === 1 ? tipos[0]! : "object?";
  }

  if (limpo.endsWith("[]")) {
    return `List<${tipoCSharp(limpo.slice(0, -2), contexto)}>`;
  }
  if (/^Lista<.+>$/.test(limpo)) {
    return `List<${tipoCSharp(limpo.slice("Lista<".length, -1), contexto)}>`;
  }
  if (/^Mapa<.+>$/.test(limpo)) {
    const partes = dividirTipoRaiz(limpo.slice("Mapa<".length, -1), ",");
    const chave = tipoCSharp(partes[0] ?? "Texto", contexto);
    const valor = tipoCSharp(partes[1] ?? "Json", contexto);
    return `Dictionary<${chave}, ${valor}>`;
  }

  const primitivos: Record<string, string> = {
    Texto: "string",
    Numero: "decimal",
    Inteiro: "long",
    Decimal: "decimal",
    Booleano: "bool",
    Data: "DateOnly",
    DataHora: "DateTimeOffset",
    Id: "string",
    Email: "string",
    Url: "string",
    Json: "Dictionary<string, object?>",
    Vazio: "object?",
  };
  return primitivos[limpo] ?? paraPascalCase(limpo, "ExternalValue");
}

function dividirTipoRaiz(valor: string, separador: "|" | ","): string[] {
  const partes: string[] = [];
  let atual = "";
  let profundidade = 0;
  for (const caractere of valor) {
    if (caractere === "<") {
      profundidade += 1;
    } else if (caractere === ">") {
      profundidade = Math.max(0, profundidade - 1);
    }
    if (caractere === separador && profundidade === 0) {
      if (atual.trim()) {
        partes.push(atual.trim());
      }
      atual = "";
    } else {
      atual += caractere;
    }
  }
  if (atual.trim()) {
    partes.push(atual.trim());
  }
  return partes;
}

function tipoEhValor(tipo: string, contexto: ContextoTipos): boolean {
  const base = tipo.replace(/\?$/, "");
  return TIPOS_VALOR_CSHARP.has(base) || contexto.enums.has(base);
}

function tornarOpcional(tipo: string, contexto: ContextoTipos): string {
  if (tipo.endsWith("?") || tipo === "object?") {
    return tipo;
  }
  if (tipoEhValor(tipo, contexto) || tipo === "string" || tipo.startsWith("List<") || tipo.startsWith("Dictionary<") || contexto.tiposLocais.has(tipo)) {
    return `${tipo}?`;
  }
  return `${tipo}?`;
}

function tipoCampoCSharp(campo: IrCampo, contexto: ContextoTipos): string {
  let tipo = tipoCSharp(campo.tipoOriginal || campo.tipo, contexto);
  if (campo.opcional && !tipo.endsWith("?")) {
    tipo = tornarOpcional(tipo, contexto);
  }
  return tipo;
}

function valorPadraoTipo(tipo: string, contexto: ContextoTipos): string {
  if (tipo.endsWith("?")) {
    return "null";
  }
  if (tipo === "string") {
    return "string.Empty";
  }
  if (tipo === "bool") {
    return "false";
  }
  if (["byte", "decimal", "double", "float", "int", "long", "sbyte", "short", "uint", "ulong", "ushort"].includes(tipo)) {
    return "0";
  }
  if (tipo === "DateOnly" || tipo === "DateTimeOffset" || tipo === "Guid" || contexto.enums.has(tipo)) {
    return "default";
  }
  if (tipo.startsWith("List<") || tipo.startsWith("Dictionary<")) {
    return "new()";
  }
  if (tipo === "object?") {
    return "null";
  }
  return "new()";
}

function valorSaidaCampo(campo: IrCampo, contexto: ContextoTipos): string {
  const tipoDeclarado = tipoCampoCSharp(campo, contexto);
  const tipo = tipoDeclarado.replace(/\?$/, "");
  if (tipo === "string") {
    return literalString(`${campo.nome}_gerado`);
  }
  if (tipo === "object") {
    return "new object()";
  }
  if (tipo.startsWith("List<") || tipo.startsWith("Dictionary<")) {
    return "new()";
  }
  if (contexto.tiposLocais.has(tipo)) {
    return "new()";
  }
  return valorPadraoTipo(tipo, contexto);
}

function valorAlternativoComparacao(campo: IrCampo, literal: string, contexto: ContextoTipos): string | undefined {
  const tipo = tipoCampoCSharp(campo, contexto).replace(/\?$/, "");
  if (tipo === "bool") {
    return literal === "true" ? "false" : "true";
  }
  if (tipo === "string") {
    return literalString(`${campo.nome}_alternativo`);
  }
  if (["byte", "decimal", "double", "float", "int", "long", "sbyte", "short", "uint", "ulong", "ushort"].includes(tipo)) {
    const incremento = tipo === "decimal" ? "1m" : tipo === "float" ? "1f" : tipo === "double" ? "1d" : "1";
    return `(${literal} + ${incremento})`;
  }
  if (tipo === "DateOnly") {
    return `${literal}.AddDays(1)`;
  }
  if (tipo === "DateTimeOffset") {
    return `${literal}.AddTicks(1)`;
  }
  const valoresEnum = contexto.valoresEnums.get(tipo);
  if (valoresEnum) {
    const alternativo = valoresEnum
      .map((valor) => `${tipo}.${paraPascalCase(valor, "Desconhecido")}`)
      .find((valor) => valor !== literal);
    return alternativo;
  }
  return undefined;
}

function valorParaComparacaoGarantida(
  expressao: Extract<ExpressaoSemantica, { tipo: "comparacao" }>,
  campo: IrCampo,
  contexto: ContextoTipos,
): string | undefined {
  if (expressao.valorLiteral === false) {
    return undefined;
  }
  const literal = literalComparacao(expressao.valor, campo, contexto);
  if (["==", ">=", "<="].includes(expressao.operador)) {
    return literal;
  }
  if (expressao.operador === "!=") {
    return valorAlternativoComparacao(campo, literal, contexto);
  }

  const tipo = tipoCampoCSharp(campo, contexto).replace(/\?$/, "");
  if (["byte", "decimal", "double", "float", "int", "long", "sbyte", "short", "uint", "ulong", "ushort"].includes(tipo)) {
    const passo = tipo === "decimal" ? "1m" : tipo === "float" ? "1f" : tipo === "double" ? "1d" : "1";
    return `(${literal} ${expressao.operador === ">" ? "+" : "-"} ${passo})`;
  }
  if (tipo === "DateOnly") {
    return `${literal}.AddDays(${expressao.operador === ">" ? "1" : "-1"})`;
  }
  if (tipo === "DateTimeOffset") {
    return `${literal}.AddTicks(${expressao.operador === ">" ? "1" : "-1"})`;
  }
  return undefined;
}

function valorSaidaGarantido(task: IrTask, campo: IrCampo, contexto: ContextoTipos): string {
  const valoresEsperados = task.tests
    .filter((caso) => !caso.error)
    .flatMap((caso) => caso.expect.campos.filter((item) => item.nome === campo.nome))
    .map((item) => item.tipoOriginal || item.tipo);
  const valoresEsperadosUnicos = [...new Set(valoresEsperados)];
  if (valoresEsperadosUnicos.length === 1) {
    return literalCasoTeste(valoresEsperadosUnicos[0]!, campo, contexto);
  }

  for (const garantia of task.garantiasEstruturadas) {
    if (!("alvo" in garantia) || garantia.alvo !== campo.nome) {
      continue;
    }
    if (garantia.tipo === "pertencimento" && garantia.valores.length > 0) {
      return literalComparacao(garantia.valores[0]!, campo, contexto);
    }
    if (garantia.tipo === "comparacao") {
      const valor = valorParaComparacaoGarantida(garantia, campo, contexto);
      if (valor) {
        return valor;
      }
    }
    if (garantia.tipo === "predicado") {
      const predicado = garantia.predicadoCanonico ?? garantia.predicado;
      if (predicado === "positivo" || predicado === "diferente_de_zero") {
        return literalComparacao("1", campo, contexto);
      }
      if (predicado === "email_valido") {
        return literalString(`${campo.nome}@sema.local`);
      }
    }
  }
  return valorSaidaCampo(campo, contexto);
}

function gerarCabecalhoCSharp(modulo: IrModulo, descricao: string): string {
  return [
    "// SEMA-GOVERNED",
    `// Módulo de origem: ${modulo.nome}`,
    "// Contrato: consulte o arquivo .sema aplicável antes de editar este artefato.",
    "// Rastreabilidade: outros contratos .sema podem governar este mesmo arquivo via vinculos.",
    "// Para IA fraca/média/forte: chame Sema, rode docs-impacto e drift antes de alterar código.",
    `// Descrição: ${descricao}`,
    "",
  ].join("\n");
}

function gerarCabecalhoProjeto(modulo: IrModulo, descricao: string): string {
  return [
    "<!-- SEMA-GOVERNED -->",
    `<!-- Módulo de origem: ${modulo.nome} -->`,
    "<!-- Consulte o contrato .sema aplicável antes de editar este projeto. -->",
    `<!-- Descrição: ${descricao} -->`,
  ].join("\n");
}

function gerarPropriedades(campos: IrCampo[], contexto: ContextoTipos): string {
  if (campos.length === 0) {
    return "    // Sem campos declarados no contrato.";
  }
  return campos.map((campo) => {
    const tipo = tipoCampoCSharp(campo, contexto);
    const modificadores = campo.modificadores.join(", ") || "nenhum";
    return [
      `    // SEMA-FIELD: ${escaparComentario(campo.nome)} tipo=${escaparComentario(campo.tipoOriginal || campo.tipo)} modificadores=${escaparComentario(modificadores)}`,
      `    public ${tipo} ${nomePropriedade(campo.nome)} { get; init; } = ${valorPadraoTipo(tipo, contexto)};`,
    ].join("\n");
  }).join("\n\n");
}

function gerarModelo(nome: string, campos: IrCampo[], invariantes: ExpressaoSemantica[], contexto: ContextoTipos, categoria: string): string {
  const comentarios = invariantes.map((item) => `// SEMA-INVARIANT: ${escaparComentario(item.textoOriginal)}`).join("\n");
  return [
    `// SEMA-${categoria.toUpperCase()}: ${escaparComentario(nome)}`,
    comentarios,
    `public sealed record class ${paraPascalCase(nome)}`,
    "{",
    gerarPropriedades(campos, contexto),
    "}",
  ].filter(Boolean).join("\n");
}

function gerarEnum(nome: string, valores: string[]): string {
  const usados = new Map<string, number>();
  const membros = (valores.length > 0 ? valores : ["desconhecido"]).map((valor, indice) => {
    const base = paraPascalCase(valor, "Desconhecido");
    const ocorrencia = (usados.get(base) ?? 0) + 1;
    usados.set(base, ocorrencia);
    const membro = ocorrencia === 1 ? base : `${base}${ocorrencia}`;
    return `    ${membro} = ${indice},`;
  });
  return `// SEMA-ENUM: ${escaparComentario(nome)}\npublic enum ${paraPascalCase(nome)}\n{\n${membros.join("\n")}\n}`;
}

function coletarTiposExternos(modulo: IrModulo): string[] {
  const locaisOriginais = new Set([
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
    for (const tipo of extrairTiposNomeados(campo.tipoOriginal || campo.tipo)) {
      if (!locaisOriginais.has(tipo)) {
        externos.add(tipo);
      }
    }
  }
  return [...externos].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function acessoCampo(referencia: string, variavel: string, campos: IrCampo[]): string | undefined {
  const segmentos = referencia.split(".").map((item) => item.trim()).filter(Boolean);
  if (segmentos.length !== 1 || !campos.some((campo) => campo.nome === segmentos[0])) {
    return undefined;
  }
  return `${variavel}.${segmentos.map(nomePropriedade).join(".")}`;
}

function tipoAceitaLiteral(campo: IrCampo | undefined, contexto: ContextoTipos): boolean {
  if (!campo) {
    return false;
  }
  const tipo = tipoCampoCSharp(campo, contexto).replace(/\?$/, "");
  return tipo === "string"
    || tipo === "bool"
    || TIPOS_VALOR_CSHARP.has(tipo)
    || contexto.enums.has(tipo);
}

function condicaoExiste(acesso: string, campo: IrCampo | undefined, contexto: ContextoTipos): string {
  if (!campo) {
    return `${acesso} is not null`;
  }
  const tipo = tipoCampoCSharp(campo, contexto);
  if (tipo === "string" || tipo === "string?") {
    return `!string.IsNullOrWhiteSpace(${acesso})`;
  }
  if (tipo.startsWith("List<") || tipo.startsWith("Dictionary<")) {
    return `${acesso} is not null`;
  }
  if (tipoEhValor(tipo, contexto) && !tipo.endsWith("?")) {
    return "true";
  }
  return `${acesso} is not null`;
}

function literalComparacao(valor: string, campo: IrCampo | undefined, contexto: ContextoTipos): string {
  const limpo = valor.trim().replace(/^['\"]|['\"]$/g, "");
  if (/^(verdadeiro|true)$/i.test(limpo)) {
    return "true";
  }
  if (/^(falso|false)$/i.test(limpo)) {
    return "false";
  }
  if (/^(nulo|null)$/i.test(limpo)) {
    return "null";
  }
  const tipo = campo ? tipoCampoCSharp(campo, contexto).replace(/\?$/, "") : "";
  if (/^-?\d+(?:\.\d+)?$/.test(limpo)) {
    return tipo === "decimal" ? `${limpo}m` : limpo;
  }
  if (tipo === "DateOnly") {
    return `DateOnly.Parse(${literalString(limpo)}, CultureInfo.InvariantCulture)`;
  }
  if (tipo === "DateTimeOffset") {
    return `DateTimeOffset.Parse(${literalString(limpo)}, CultureInfo.InvariantCulture)`;
  }
  if (contexto.enums.has(tipo)) {
    return `${tipo}.${paraPascalCase(limpo, "Desconhecido")}`;
  }
  return literalString(limpo);
}

function traduzirExpressao(expressao: ExpressaoSemantica, variavel: string, campos: IrCampo[], contexto: ContextoTipos): string | undefined {
  if (expressao.tipo === "composta") {
    const termos = expressao.termos.map((termo) => traduzirExpressao(termo, variavel, campos, contexto));
    if (termos.some((termo) => !termo)) {
      return undefined;
    }
    return `(${termos.join(expressao.operadorLogico === "e" ? " && " : " || ")})`;
  }
  if (expressao.tipo === "negacao") {
    const termo = traduzirExpressao(expressao.termo, variavel, campos, contexto);
    return termo ? `!(${termo})` : undefined;
  }

  const alvo = acessoCampo(expressao.alvo, variavel, campos);
  const campo = campos.find((item) => item.nome === expressao.alvo.split(".")[0]);
  if (!alvo) {
    return undefined;
  }
  if (expressao.tipo === "existe") {
    return condicaoExiste(alvo, campo, contexto);
  }
  if (expressao.tipo === "comparacao") {
    if (expressao.valorLiteral === false) {
      const outraReferencia = acessoCampo(expressao.valor, variavel, campos);
      return outraReferencia ? `${alvo} ${expressao.operador} ${outraReferencia}` : undefined;
    }
    if (!tipoAceitaLiteral(campo, contexto)) {
      return undefined;
    }
    return `${alvo} ${expressao.operador} ${literalComparacao(expressao.valor, campo, contexto)}`;
  }
  if (expressao.tipo === "pertencimento") {
    if (!tipoAceitaLiteral(campo, contexto)) {
      return undefined;
    }
    const valores = expressao.valores.map((valor) => literalComparacao(valor, campo, contexto));
    if (valores.length === 0) {
      return undefined;
    }
    return `new[] { ${valores.join(", ")} }.Contains(${alvo})`;
  }

  const predicado = expressao.predicadoCanonico ?? expressao.predicado;
  const tipo = campo ? tipoCampoCSharp(campo, contexto).replace(/\?$/, "") : "";
  if (["preenchido", "nao_vazio", "valido"].includes(predicado)) {
    return condicaoExiste(alvo, campo, contexto);
  }
  if (predicado === "numero_valido") {
    return tipo === "double" || tipo === "float" ? `!double.IsNaN(${alvo}) && !double.IsInfinity(${alvo})` : "true";
  }
  if (predicado === "positivo") {
    return `${alvo} > 0`;
  }
  if (predicado === "diferente_de_zero") {
    return `${alvo} != 0`;
  }
  if (predicado === "email_valido") {
    return `!string.IsNullOrWhiteSpace(${alvo}) && ${alvo}.Contains('@', StringComparison.Ordinal)`;
  }
  return undefined;
}

function gerarValidacoes(task: IrTask, contexto: ContextoTipos): string {
  const linhas: string[] = [];
  for (let indice = 0; indice < task.rules.length; indice += 1) {
    const regra = task.rules[indice]!;
    const expressao = task.regrasEstruturadas.find((item) => item.textoOriginal === regra);
    linhas.push(`        // SEMA-RULE: ${escaparComentario(regra)}`);
    const condicao = expressao ? traduzirExpressao(expressao, "input", task.input, contexto) : undefined;
    if (condicao && condicao !== "true") {
      linhas.push(`        if (!(${condicao}))`);
      linhas.push("        {");
      linhas.push(`            throw new SemaValidationException(${literalString(regra)});`);
      linhas.push("        }");
    }
  }
  return linhas.length > 0 ? linhas.join("\n") : "        // Nenhuma regra declarada.";
}

function gerarVerificacaoGarantias(task: IrTask, contexto: ContextoTipos): string {
  const linhas: string[] = [];
  for (let indice = 0; indice < task.guarantees.length; indice += 1) {
    const garantia = task.guarantees[indice]!;
    const expressao = task.garantiasEstruturadas.find((item) => item.textoOriginal === garantia);
    linhas.push(`        // SEMA-GUARANTEE: ${escaparComentario(garantia)}`);
    const condicao = expressao ? traduzirExpressao(expressao, "output", task.output, contexto) : undefined;
    if (condicao && condicao !== "true") {
      linhas.push(`        if (!(${condicao}))`);
      linhas.push("        {");
      linhas.push(`            throw new SemaGuaranteeException(${literalString(garantia)});`);
      linhas.push("        }");
    }
  }
  return linhas.length > 0 ? linhas.join("\n") : "        // Nenhuma garantia declarada.";
}

function gerarInicializadorSaida(task: IrTask, contexto: ContextoTipos): string {
  if (task.output.length === 0) {
    return `new ${paraPascalCase(`${task.nome}_saida`)}()`;
  }
  const propriedades = task.output.map((campo) => {
    return `            ${nomePropriedade(campo.nome)} = ${valorSaidaGarantido(task, campo, contexto)},`;
  }).join("\n");
  return `new ${paraPascalCase(`${task.nome}_saida`)}\n        {\n${propriedades}\n        }`;
}

function gerarTask(task: IrTask, contexto: ContextoTipos): string {
  const nome = paraPascalCase(task.nome);
  const nomeEntrada = paraPascalCase(`${task.nome}_entrada`);
  const nomeSaida = paraPascalCase(`${task.nome}_saida`);
  const regras = task.rules.length > 0 ? `new[] { ${task.rules.map(literalString).join(", ")} }` : "Array.Empty<string>()";
  const garantias = task.guarantees.length > 0 ? `new[] { ${task.guarantees.map(literalString).join(", ")} }` : "Array.Empty<string>()";
  const efeitos = task.effects.length > 0 ? `new[] { ${task.effects.map(literalString).join(", ")} }` : "Array.Empty<string>()";
  const erros = Object.entries(task.errors)
    .map(([codigo, mensagem]) => `        [${literalString(codigo)}] = ${literalString(mensagem)},`)
    .join("\n");

  return `// SEMA-TASK: ${escaparComentario(task.nome)}
public sealed record class ${nomeEntrada}
{
${gerarPropriedades(task.input, contexto)}
}

public sealed record class ${nomeSaida}
{
${gerarPropriedades(task.output, contexto)}
}

public static class ${nome}Contract
{
    public static IReadOnlyList<string> Rules { get; } = ${regras};
    public static IReadOnlyList<string> Guarantees { get; } = ${garantias};
    public static IReadOnlyList<string> Effects { get; } = ${efeitos};
    public static IReadOnlyDictionary<string, string> Errors { get; } = new Dictionary<string, string>
    {
${erros}
    };

    public static void Validate(${nomeEntrada} input)
    {
        ArgumentNullException.ThrowIfNull(input);
${gerarValidacoes(task, contexto)}
    }

    public static ${nomeSaida} Execute(${nomeEntrada} input, string? expectedErrorCode = null)
    {
        Validate(input);
        if (!string.IsNullOrWhiteSpace(expectedErrorCode))
        {
            var message = Errors.TryGetValue(expectedErrorCode, out var declaredMessage)
                ? declaredMessage
                : "Erro esperado pelo caso Sema.";
            throw new SemaContractException(expectedErrorCode, message);
        }

        var output = ${gerarInicializadorSaida(task, contexto)};
        VerifyGuarantees(output);
        return output;
    }

    public static void VerifyGuarantees(${nomeSaida} output)
    {
        ArgumentNullException.ThrowIfNull(output);
${gerarVerificacaoGarantias(task, contexto)}
    }
}`;
}

function removerAspas(valor: string): string {
  const limpo = valor.trim();
  if ((limpo.startsWith("\"") && limpo.endsWith("\"")) || (limpo.startsWith("'") && limpo.endsWith("'"))) {
    return limpo.slice(1, -1);
  }
  return limpo;
}

function literalCasoTeste(valor: string, campo: IrCampo, contexto: ContextoTipos): string {
  const limpo = removerAspas(valor);
  const tipo = tipoCampoCSharp(campo, contexto).replace(/\?$/, "");
  if (/^(nulo|null)$/i.test(limpo)) {
    return "null";
  }
  if (tipo === "bool") {
    return /^(verdadeiro|true)$/i.test(limpo) ? "true" : "false";
  }
  if (["byte", "double", "float", "int", "long", "sbyte", "short", "uint", "ulong", "ushort"].includes(tipo) && /^-?\d+(?:\.\d+)?$/.test(limpo)) {
    return limpo;
  }
  if (tipo === "decimal" && /^-?\d+(?:\.\d+)?$/.test(limpo)) {
    return `${limpo}m`;
  }
  if (tipo === "DateOnly") {
    return `DateOnly.Parse(${literalString(limpo)}, CultureInfo.InvariantCulture)`;
  }
  if (tipo === "DateTimeOffset") {
    return `DateTimeOffset.Parse(${literalString(limpo)}, CultureInfo.InvariantCulture)`;
  }
  if (contexto.enums.has(tipo)) {
    return `${tipo}.${paraPascalCase(limpo, "Desconhecido")}`;
  }
  if (tipo.startsWith("List<") || tipo.startsWith("Dictionary<") || contexto.tiposLocais.has(tipo)) {
    return "new()";
  }
  return literalString(limpo);
}

function gerarAssercoesEsperadas(task: IrTask, caso: IrCasoTeste, contexto: ContextoTipos): string {
  const camposSaida = new Map(task.output.map((campo) => [campo.nome, campo]));
  return caso.expect.campos.flatMap((esperado) => {
    if (esperado.nome === "sucesso") {
      return [];
    }
    const campo = camposSaida.get(esperado.nome);
    if (!campo) {
      return [];
    }
    const literal = literalCasoTeste(esperado.tipoOriginal || esperado.tipo, campo, contexto);
    return [`        SemaAssert.Equal(${literal}, output.${nomePropriedade(campo.nome)}, ${literalString(`Saída inesperada para ${campo.nome}.`)});`];
  }).join("\n");
}

function gerarEntradaCaso(task: IrTask, caso: IrCasoTeste, contexto: ContextoTipos): string {
  const dados = new Map(caso.given.campos.map((campo) => [campo.nome, campo.tipoOriginal || campo.tipo]));
  if (task.input.length === 0) {
    return `new ${paraPascalCase(`${task.nome}_entrada`)}()`;
  }
  const propriedades = task.input.map((campo) => {
    const literal = dados.has(campo.nome)
      ? literalCasoTeste(dados.get(campo.nome)!, campo, contexto)
      : valorPadraoTipo(tipoCampoCSharp(campo, contexto), contexto);
    return `            ${nomePropriedade(campo.nome)} = ${literal},`;
  }).join("\n");
  return `new ${paraPascalCase(`${task.nome}_entrada`)}\n        {\n${propriedades}\n        }`;
}

function codigoErroEsperado(caso: IrCasoTeste): string | undefined {
  const campoTipo = caso.error?.campos.find((campo) => campo.nome === "tipo") ?? caso.error?.campos[0];
  return campoTipo ? removerAspas(campoTipo.tipoOriginal || campoTipo.tipo) : undefined;
}

function gerarMetodoTeste(task: IrTask, caso: IrCasoTeste, indice: number, contexto: ContextoTipos): { nome: string; codigo: string } {
  const nome = `Test${paraPascalCase(task.nome)}${indice + 1}`;
  const nomeTask = `${paraPascalCase(task.nome)}Contract`;
  const entrada = gerarEntradaCaso(task, caso, contexto);
  const erro = codigoErroEsperado(caso);
  const detalhesEsperados = caso.expect.campos
    .map((campo) => `${campo.nome}=${campo.tipoOriginal || campo.tipo}`)
    .join(", ");
  const assercoesEsperadas = gerarAssercoesEsperadas(task, caso, contexto);
  const corpo = erro
    ? `        try
        {
            ${nomeTask}.Execute(input, ${literalString(erro)});
            throw new InvalidOperationException(${literalString(`O caso ${caso.nome} deveria falhar.`)});
        }
        catch (SemaContractException exception) when (exception.Code == ${literalString(erro)})
        {
            // Erro declarado e observado conforme o contrato.
        }`
    : `        var output = ${nomeTask}.Execute(input);
        SemaAssert.NotNull(output, ${literalString(`O caso ${caso.nome} não retornou saída.`)});
        ${nomeTask}.VerifyGuarantees(output);
${assercoesEsperadas || "        // O caso não declarou campos de saída verificáveis."}`;
  return {
    nome,
    codigo: `    // SEMA-TEST: ${escaparComentario(task.nome)} :: ${escaparComentario(caso.nome)}
    private static void ${nome}()
    {
        // SEMA-EXPECT: ${escaparComentario(detalhesEsperados || "sucesso")}
        var input = ${entrada};
${corpo}
    }`,
  };
}

function gerarCodigoFonte(modulo: IrModulo, contexto: ContextoTipos): string {
  const namespace = nomeNamespace(modulo.nome);
  const externos = coletarTiposExternos(modulo).map((tipo) => `// SEMA-EXTERNAL-TYPE: ${escaparComentario(tipo)}\npublic sealed record class ${paraPascalCase(tipo)};`).join("\n\n");
  const tipos = modulo.types.map((tipo) => gerarModelo(tipo.nome, tipo.definicao.campos, tipo.invariantes, contexto, "type")).join("\n\n");
  const entidades = modulo.entities.map((entidade) => gerarModelo(entidade.nome, entidade.campos, entidade.invariantes, contexto, "entity")).join("\n\n");
  const enums = modulo.enums.map((item) => gerarEnum(item.nome, item.valores)).join("\n\n");
  const tasks = modulo.tasks.map((task) => gerarTask(task, contexto)).join("\n\n");
  const interops = modulo.interoperabilidades.map((item) => `// SEMA-INTEROP: ${item.origem}:${escaparComentario(item.caminho)}`).join("\n");
  const flows = modulo.flows.map((item) => `// SEMA-FLOW: ${escaparComentario(item.nome)} tasks=${escaparComentario(item.tasksReferenciadas.join(", ") || "nenhuma")}`).join("\n");
  const routes = modulo.routes.map((item) => `// SEMA-ROUTE: ${escaparComentario(item.nome)} metodo=${escaparComentario(item.metodo ?? "nao_definido")} caminho=${escaparComentario(item.caminho ?? "nao_definido")} task=${escaparComentario(item.task ?? "nao_definida")}`).join("\n");
  const states = modulo.states.map((item) => `// SEMA-STATE: ${escaparComentario(item.nome ?? "anonimo")} campos=${item.campos.length} invariantes=${item.invariantes.length} transicoes=${item.transicoes.length}`).join("\n");

  return `${gerarCabecalhoCSharp(modulo, "código C# gerado a partir do IR Sema, incluindo modelos, regras, garantias e metadados operacionais.")}using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace ${namespace};

public class SemaContractException : Exception
{
    public SemaContractException(string code, string message) : base(message) => Code = code;
    public string Code { get; }
}

public sealed class SemaValidationException : SemaContractException
{
    public SemaValidationException(string rule) : base("regra_invalida", $"Regra Sema violada: {rule}") { }
}

public sealed class SemaGuaranteeException : SemaContractException
{
    public SemaGuaranteeException(string guarantee) : base("garantia_violada", $"Garantia Sema violada: {guarantee}") { }
}

${interops ? `${interops}\n\n` : ""}${externos ? `${externos}\n\n` : ""}${enums ? `${enums}\n\n` : ""}${tipos ? `${tipos}\n\n` : ""}${entidades ? `${entidades}\n\n` : ""}${tasks}${states ? `\n\n${states}` : ""}${flows ? `\n${flows}` : ""}${routes ? `\n${routes}` : ""}
`;
}

function gerarCodigoTestes(modulo: IrModulo, contexto: ContextoTipos): string {
  const namespace = nomeNamespace(modulo.nome);
  const metodos = modulo.tasks.flatMap((task) => task.tests.map((caso, indice) => gerarMetodoTeste(task, caso, indice, contexto)));
  if (metodos.length === 0) {
    metodos.push({
      nome: "TestEstruturaGerada",
      codigo: `    // SEMA-TEST: estrutura gerada :: módulo sem casos declarados
    private static void TestEstruturaGerada()
    {
        SemaAssert.True(true, "A estrutura .NET gerada deve ser executavel.");
    }`,
    });
  }
  const registros = metodos.map((metodo) => `            (${literalString(metodo.nome)}, ${metodo.nome}),`).join("\n");
  return `${gerarCabecalhoCSharp(modulo, "runner de testes .NET gerado sem framework ou pacote NuGet externo.")}using System;
using System.Collections.Generic;
using System.Globalization;
using ${namespace};

internal static class SemaAssert
{
    public static void True(bool condition, string message)
    {
        if (!condition) throw new InvalidOperationException(message);
    }

    public static void NotNull(object? value, string message) => True(value is not null, message);

    public static void Equal<T>(T expected, T actual, string message)
    {
        if (!EqualityComparer<T>.Default.Equals(expected, actual))
        {
            throw new InvalidOperationException($"{message} Esperado={expected}; Atual={actual}.");
        }
    }
}

internal static class Program
{
    private static int Main()
    {
        var tests = new (string Name, Action Run)[]
        {
${registros}
        };

        foreach (var test in tests)
        {
            Console.WriteLine($"test {test.Name}");
            test.Run();
        }

        Console.WriteLine($"ok {tests.Length} testes");
        return 0;
    }

${metodos.map((metodo) => metodo.codigo).join("\n\n")}
}
`;
}

function gerarProjetoFonte(modulo: IrModulo, base: string, assemblyName: string): string {
  return `${gerarCabecalhoProjeto(modulo, "biblioteca .NET gerada sem dependências NuGet externas.")}
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
    <AssemblyName>${assemblyName}</AssemblyName>
    <RootNamespace>${assemblyName}</RootNamespace>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="${base}.cs" />
  </ItemGroup>
</Project>
`;
}

function gerarProjetoTestes(modulo: IrModulo, base: string, assemblyName: string): string {
  return `${gerarCabecalhoProjeto(modulo, "executavel de testes .NET autocontido, sem xUnit, MSTest, NUnit ou outro pacote NuGet.")}
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <LangVersion>latest</LangVersion>
    <AssemblyName>${assemblyName}.Tests</AssemblyName>
    <RootNamespace>${assemblyName}.Tests</RootNamespace>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="${base}.Tests.cs" />
    <ProjectReference Include="${base}.csproj" />
  </ItemGroup>
</Project>
`;
}

export function gerarDotNet(modulo: IrModulo): ArquivoGerado[] {
  const base = normalizarNomeModulo(modulo.nome).replace(/\./g, "_") || "sema_generated";
  const assemblyName = nomeProjeto(modulo.nome);
  const enums = new Set(modulo.enums.map((item) => paraPascalCase(item.nome)));
  const valoresEnums = new Map(modulo.enums.map((item) => [paraPascalCase(item.nome), item.valores]));
  const tiposLocais = new Set([
    ...modulo.types.map((item) => paraPascalCase(item.nome)),
    ...modulo.entities.map((item) => paraPascalCase(item.nome)),
    ...coletarTiposExternos(modulo).map((item) => paraPascalCase(item)),
  ]);
  const contexto: ContextoTipos = { enums, valoresEnums, tiposLocais };

  return [
    {
      caminhoRelativo: `${base}.csproj`,
      conteudo: gerarProjetoFonte(modulo, base, assemblyName),
    },
    {
      caminhoRelativo: `${base}.cs`,
      conteudo: gerarCodigoFonte(modulo, contexto),
    },
    {
      caminhoRelativo: `${base}.Tests.csproj`,
      conteudo: gerarProjetoTestes(modulo, base, assemblyName),
    },
    {
      caminhoRelativo: `${base}.Tests.cs`,
      conteudo: gerarCodigoTestes(modulo, contexto),
    },
  ];
}
