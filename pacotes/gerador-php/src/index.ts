// SEMA-GOVERNED: sema.geradores_codigo_governado
// Descricao: gerador PHP governado; consulte contratos/sema/geradores_codigo_governado.sema antes de editar.

import path from "node:path";
import type { ExpressaoSemantica, IrBlocoDeclarativo, IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import {
  descreverEstruturaModulo,
  extrairTiposNomeados,
  mapearTipoParaPhp,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
} from "@sema/padroes";

const TIPOS_PRIMITIVOS_SEMA = new Set(["Texto", "Numero", "Inteiro", "Decimal", "Booleano", "Data", "DataHora", "Id", "Email", "Url", "Json", "Vazio"]);

function paraPascalCase(valor: string): string {
  const normalizado = normalizarNomeParaSimbolo(valor);
  const partes = normalizado.split(/_+/).filter(Boolean);
  const nome = partes.map((parte) => parte[0]!.toUpperCase() + parte.slice(1)).join("");
  return nome || "Contrato";
}

function paraConstantePhp(valor: string): string {
  const simbolo = normalizarNomeParaSimbolo(valor).toUpperCase();
  return /^[A-Z_]/.test(simbolo) ? simbolo : `VALOR_${simbolo}`;
}

function literalPhp(valor: string | number | boolean | null): string {
  if (valor === null) {
    return "null";
  }
  if (typeof valor === "boolean") {
    return valor ? "true" : "false";
  }
  if (typeof valor === "number") {
    return Number.isInteger(valor) ? String(valor) : String(valor);
  }
  return JSON.stringify(valor);
}

function tipoPropriedadePhp(campo: IrCampo): string {
  if (campo.cardinalidade === "lista" || campo.cardinalidade === "mapa") {
    return "array";
  }
  if (campo.cardinalidade === "uniao") {
    const tipos = [...new Set(campo.tiposAlternativos.map(mapearTipoParaPhp).filter((tipo) => tipo !== "void"))];
    return tipos.length === 1 ? tipos[0]! : "mixed";
  }
  return mapearTipoParaPhp(campo.tipoBase);
}

function tipoParametroPhp(campo: IrCampo): string {
  const tipo = tipoPropriedadePhp(campo);
  if (tipo === "void") {
    return "mixed";
  }
  if (campo.opcional && tipo !== "mixed" && !tipo.includes("|null")) {
    return `?${tipo}`;
  }
  return tipo;
}

function tipoDocPhp(campo: IrCampo): string {
  if (campo.cardinalidade === "lista") {
    return `array<int, ${mapearTipoParaPhp(campo.tipoItem ?? campo.tipoBase)}>`;
  }
  if (campo.cardinalidade === "mapa") {
    return `array<${mapearTipoParaPhp(campo.chaveMapa ?? "Texto")}, ${mapearTipoParaPhp(campo.valorMapa ?? "Json")}>`;
  }
  if (campo.cardinalidade === "uniao") {
    return campo.tiposAlternativos.map(mapearTipoParaPhp).join("|") || "mixed";
  }
  return mapearTipoParaPhp(campo.tipoBase);
}

function ordenarCamposConstrutor(campos: IrCampo[]): IrCampo[] {
  return [...campos].sort((a, b) => {
    const obrigatorioA = a.modificadores.includes("required") ? 0 : 1;
    const obrigatorioB = b.modificadores.includes("required") ? 0 : 1;
    return obrigatorioA - obrigatorioB;
  });
}

function valorPadraoPhp(campo: IrCampo): string {
  if (campo.cardinalidade === "lista" || campo.cardinalidade === "mapa") {
    return "[]";
  }
  if (campo.opcional) {
    return "null";
  }
  switch (campo.tipoBase) {
    case "Texto":
    case "Id":
    case "Email":
    case "Url":
    case "Data":
    case "DataHora":
      return literalPhp(`${campo.nome}_exemplo`);
    case "Numero":
    case "Decimal":
      return "1.0";
    case "Inteiro":
      return "1";
    case "Booleano":
      return "false";
    case "Json":
      return "[]";
    case "Vazio":
      return "null";
    default:
      return "[]";
  }
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
    ...modulo.types.flatMap((tipo) => tipo.definicao.campos),
    ...modulo.tasks.flatMap((task) => [...task.input, ...task.output]),
    ...modulo.routes.flatMap((route) => [...route.inputPublico, ...route.outputPublico]),
    ...modulo.states.flatMap((state) => state.campos),
  ];

  for (const campo of campos) {
    for (const tipo of extrairTiposNomeados(campo.tipo)) {
      if (!locais.has(tipo) && !TIPOS_PRIMITIVOS_SEMA.has(tipo)) {
        referenciados.add(tipo);
      }
    }
  }

  return [...referenciados].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function gerarClasseDados(nome: string, campos: IrCampo[]): string {
  const classe = paraPascalCase(nome);
  if (campos.length === 0) {
    return `final class ${classe}
{
    public function __construct()
    {
    }
}
`;
  }

  const parametros = ordenarCamposConstrutor(campos).map((campo) => {
    const tipo = tipoParametroPhp(campo);
    const padrao = campo.modificadores.includes("required") ? "" : ` = ${valorPadraoPhp(campo)}`;
    return `        /** @var ${tipoDocPhp(campo)} */
        public ${tipo} $${campo.nome}${padrao}`;
  }).join(",\n");

  return `final class ${classe}
{
    public function __construct(
${parametros}
    ) {
    }
}
`;
}

function gerarEnum(enumeracao: { nome: string; valores: string[] }): string {
  const constantes = enumeracao.valores.map((valor) => `    public const ${paraConstantePhp(valor)} = ${literalPhp(valor)};`).join("\n");
  return `final class ${paraPascalCase(enumeracao.nome)}
{
${constantes || "    public const VAZIO = \"\";"}
}
`;
}

function gerarLiteralCamposPhp(campos: IrCampo[]): string {
  if (campos.length === 0) {
    return "[]";
  }
  return `[
${campos.map((campo) => `        ["nome" => ${literalPhp(campo.nome)}, "tipo" => ${literalPhp(campo.tipo)}, "obrigatorio" => ${campo.modificadores.includes("required") ? "true" : "false"}],`).join("\n")}
    ]`;
}

function gerarArrayStringsPhp(valores: string[]): string {
  if (valores.length === 0) {
    return "[]";
  }
  return `[${valores.map(literalPhp).join(", ")}]`;
}

function gerarMapaErrosPhp(erros: Record<string, string>): string {
  const entradas = Object.entries(erros);
  if (entradas.length === 0) {
    return "[]";
  }
  return `[
${entradas.map(([codigo, mensagem]) => `        ${literalPhp(codigo)} => ${literalPhp(mensagem)},`).join("\n")}
    ]`;
}

function resolverReferenciaPhp(referencia: string, variavel: string): string {
  const partes = referencia.split(".").filter(Boolean);
  if (partes.length === 0) {
    return `$${variavel}`;
  }
  if (partes.length === 1) {
    return `$${variavel}->${partes[0]}`;
  }
  const [primeiro, ...resto] = partes;
  return `$${variavel}->${primeiro}${resto.map((parte) => `?->${parte}`).join("")}`;
}

function formatarValorPhp(valor: string, camposConhecidos: Set<string>, variavel: string): string {
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
    return resolverReferenciaPhp(texto, variavel);
  }
  return literalPhp(texto);
}

function resolverExpressaoPhp(expressao: ExpressaoSemantica, camposConhecidos: Set<string>, variavel: string): string {
  switch (expressao.tipo) {
    case "existe":
      return `${resolverReferenciaPhp(expressao.alvo, variavel)} !== null`;
    case "comparacao":
      return `${resolverReferenciaPhp(expressao.alvo, variavel)} ${expressao.operador} ${formatarValorPhp(expressao.valor, camposConhecidos, variavel)}`;
    case "pertencimento":
      return `in_array(${resolverReferenciaPhp(expressao.alvo, variavel)}, [${(expressao.valores ?? []).map((valor) => formatarValorPhp(valor, camposConhecidos, variavel)).join(", ")}], true)`;
    case "predicado":
      return "true";
    case "composta":
      return `(${expressao.termos.map((termo) => resolverExpressaoPhp(termo, camposConhecidos, variavel)).join(expressao.operadorLogico === "e" ? " && " : " || ")})`;
    case "negacao":
      return `!(${resolverExpressaoPhp(expressao.termo, camposConhecidos, variavel)})`;
  }
}

function garantiaComparacaoExecutavel(expressao: ExpressaoSemantica, campos: Map<string, IrCampo>): boolean {
  if (expressao.tipo !== "comparacao") {
    return true;
  }
  if (/\squando\s/u.test(expressao.valor)) {
    return false;
  }
  const raiz = expressao.alvo.split(".")[0] ?? expressao.alvo;
  const campo = campos.get(raiz);
  if (!campo) {
    return true;
  }
  if (campo.tipoBase === "Booleano") {
    return expressao.valor === "verdadeiro" || expressao.valor === "falso";
  }
  if (campo.tipoBase === "Numero" || campo.tipoBase === "Inteiro" || campo.tipoBase === "Decimal") {
    return /^-?\d+(?:\.\d+)?$/u.test(expressao.valor);
  }
  return true;
}

function finalizarBlocoPhp(linhas: string[]): string {
  return linhas.length > 0 ? linhas.join("\n") : "    // Nenhuma regra executavel declarada.";
}

function gerarValidacoes(task: IrTask): string {
  const camposEntrada = new Set(task.input.map((campo) => campo.nome));
  const linhas = [
    ...task.input
      .filter((campo) => campo.modificadores.includes("required"))
      .map((campo) => `    if ($entrada->${campo.nome} === null) {
        throw new \\InvalidArgumentException(${literalPhp(`Campo obrigatorio ausente: ${campo.nome}`)});
    }`),
    ...task.regrasEstruturadas.map((regra) => {
      if (regra.tipo === "predicado") {
        return `    // Predicado declarado em Sema: ${regra.textoOriginal}`;
      }
      return `    if (!(${resolverExpressaoPhp(regra, camposEntrada, "entrada")})) {
        throw new \\InvalidArgumentException(${literalPhp(`Regra violada: ${regra.textoOriginal}`)});
    }`;
    }),
    ...task.rules
      .filter((regra) => !task.regrasEstruturadas.some((estruturada) => estruturada.textoOriginal === regra))
      .map((regra) => `    // Regra declarada em Sema: ${regra}`),
  ];
  return finalizarBlocoPhp(linhas);
}

function gerarGarantias(task: IrTask): string {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const camposSaidaMap = new Map(task.output.map((campo) => [campo.nome, campo]));
  const linhas = [
    ...task.garantiasEstruturadas.map((garantia) => {
      if (garantia.tipo === "predicado") {
        return `    // Predicado de garantia declarado em Sema: ${garantia.textoOriginal}`;
      }
      if (!garantiaComparacaoExecutavel(garantia, camposSaidaMap)) {
        return `    // Garantia condicional declarada em Sema: ${garantia.textoOriginal}`;
      }
      return `    if (!(${resolverExpressaoPhp(garantia, camposSaida, "saida")})) {
        throw new \\RuntimeException(${literalPhp(`Garantia violada: ${garantia.textoOriginal}`)});
    }`;
    }),
    ...task.guarantees
      .filter((garantia) => !task.garantiasEstruturadas.some((estruturada) => estruturada.textoOriginal === garantia))
      .map((garantia) => `    // Garantia declarada em Sema: ${garantia}`),
  ];
  return finalizarBlocoPhp(linhas);
}

function coletarErrosTask(task: IrTask): Map<string, string> {
  const erros = new Map(Object.entries(task.errors));
  for (const caso of task.tests) {
    const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
    if (tipoErro && !erros.has(tipoErro)) {
      erros.set(tipoErro, `Erro sintetico gerado a partir do caso de teste "${caso.nome}".`);
    }
  }
  return erros;
}

function classeErroTask(task: IrTask, codigo: string): string {
  return `${paraPascalCase(task.nome)}${paraPascalCase(codigo)}Erro`;
}

function gerarClassesErro(task: IrTask): string {
  return [...coletarErrosTask(task).entries()].map(([codigo, mensagem]) => `final class ${classeErroTask(task, codigo)} extends \\RuntimeException
{
    public string $codigo = ${literalPhp(codigo)};

    public function __construct()
    {
        parent::__construct(${literalPhp(mensagem)});
    }
}
`).join("\n");
}

function gerarMetadadosTask(task: IrTask): string {
  const nome = normalizarNomeParaSimbolo(task.nome);
  const efeitos = task.efeitosEstruturados.map((efeito) => `${efeito.categoria}:${efeito.alvo}${efeito.detalhe ? `:${efeito.detalhe}` : ""}`);
  const impl = task.implementacoesExternas.map((item) => `${item.origem}:${item.caminho}[${item.statusImpl ?? "nao_verificado"}]`);
  return `function contrato_${nome}(): array
{
    return [
        "nome" => ${literalPhp(task.nome)},
        "input" => ${gerarLiteralCamposPhp(task.input)},
        "output" => ${gerarLiteralCamposPhp(task.output)},
        "effects" => ${gerarArrayStringsPhp(efeitos)},
        "impl" => ${gerarArrayStringsPhp(impl)},
        "errors" => ${gerarMapaErrosPhp(Object.fromEntries(coletarErrosTask(task)))},
        "guarantees" => ${gerarArrayStringsPhp(task.guarantees)},
    ];
}
`;
}

function gerarPreparacaoSaida(task: IrTask): string {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const camposSaidaMap = new Map(task.output.map((campo) => [campo.nome, campo]));
  const camposOrdenados = ordenarCamposConstrutor(task.output);
  const argumentos = camposOrdenados.map(valorPadraoPhp).join(", ");
  const ajustes: string[] = [];

  for (const garantia of task.garantiasEstruturadas) {
    if (garantia.tipo === "pertencimento" && garantia.valores && camposSaida.has(garantia.alvo)) {
      ajustes.push(`    $saida->${garantia.alvo} = ${formatarValorPhp(garantia.valores[0] ?? "", camposSaida, "saida")};`);
    }
    if (garantia.tipo === "comparacao" && garantia.valor && camposSaida.has(garantia.alvo.split(".")[0] ?? garantia.alvo) && !garantia.alvo.includes(".") && garantiaComparacaoExecutavel(garantia, camposSaidaMap)) {
      ajustes.push(`    $saida->${garantia.alvo} = ${formatarValorPhp(garantia.valor, camposSaida, "saida")};`);
    }
  }

  return `    $saida = new ${paraPascalCase(`${task.nome}_saida`)}(${argumentos});${ajustes.length ? `\n${ajustes.join("\n")}` : ""}`;
}

function gerarTask(task: IrTask): string {
  const nome = normalizarNomeParaSimbolo(task.nome);
  const erros = [...coletarErrosTask(task).keys()];
  const blocosErroContexto = erros.map((codigo) => `    if (($contexto["erro_esperado"] ?? null) === ${literalPhp(codigo)}) {
        throw new ${classeErroTask(task, codigo)}();
    }`).join("\n");
  const efeitos = task.efeitosEstruturados.length > 0
    ? task.efeitosEstruturados.map((efeito) => `    // Efeito estruturado: categoria=${efeito.categoria} alvo=${efeito.alvo}${efeito.detalhe ? ` detalhe=${efeito.detalhe}` : ""}${efeito.criticidade ? ` criticidade=${efeito.criticidade}` : ""}`).join("\n")
    : task.effects.map((efeito) => `    // Efeito declarado: ${efeito}`).join("\n") || "    // Nenhum efeito declarado.";

  return `
${gerarClasseDados(`${task.nome}_entrada`, task.input)}
${gerarClasseDados(`${task.nome}_saida`, task.output)}
${gerarClassesErro(task)}
${gerarMetadadosTask(task)}

function validar_${nome}(${paraPascalCase(`${task.nome}_entrada`)} $entrada): void
{
${gerarValidacoes(task)}
}

function verificar_garantias_${nome}(${paraPascalCase(`${task.nome}_saida`)} $saida): void
{
${gerarGarantias(task)}
}

function executar_${nome}(${paraPascalCase(`${task.nome}_entrada`)} $entrada, array $contexto = []): ${paraPascalCase(`${task.nome}_saida`)}
{
${blocosErroContexto ? `${blocosErroContexto}\n` : ""}    validar_${nome}($entrada);
${task.stateContract ? `    // Vinculo de estado: ${task.stateContract.nomeEstado ?? "nao_definido"}\n    // Transicoes declaradas: ${task.stateContract.transicoes.map((transicao) => `${transicao.origem}->${transicao.destino}`).join(", ") || "nenhuma"}\n` : ""}${task.implementacoesExternas.map((impl) => `    // Implementacao externa: origem=${impl.origem} caminho=${impl.caminho} status=${impl.statusImpl ?? "nao_verificado"}`).join("\n")}
${efeitos}
${gerarPreparacaoSaida(task)}
    verificar_garantias_${nome}($saida);
    return $saida;
}
`;
}

function formatarLiteralTestePhp(valor: string, tipoDeclarado?: string): string {
  const texto = valor.trim().replace(/^["']|["']$/g, "");
  if (["Texto", "Id", "Email", "Url", "Data", "DataHora"].includes(tipoDeclarado ?? "")) {
    return literalPhp(texto);
  }
  if (["Numero", "Inteiro", "Decimal"].includes(tipoDeclarado ?? "") && /^-?\d+(?:\.\d+)?$/.test(texto)) {
    return texto;
  }
  if ((tipoDeclarado ?? "") === "Booleano") {
    if (texto === "verdadeiro") {
      return "true";
    }
    if (texto === "falso") {
      return "false";
    }
  }
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
  return literalPhp(texto);
}

function literalBlocoPhp(bloco: IrBlocoDeclarativo): string {
  const pares = [
    ...bloco.campos.map((campo) => `${literalPhp(campo.nome)} => ${formatarLiteralTestePhp(campo.tipo)}`),
    ...bloco.blocos.map((subbloco) => `${literalPhp(subbloco.nome)} => ${literalBlocoPhp(subbloco.conteudo)}`),
  ];
  return `[${pares.join(", ")}]`;
}

function gerarInstanciaEntradaTeste(task: IrTask, given: IrBlocoDeclarativo): string {
  const camposGiven = new Map(given.campos.map((campo) => [campo.nome, campo.tipo]));
  const blocosGiven = new Map(given.blocos.map((bloco) => [bloco.nome, bloco.conteudo]));
  const tiposEntrada = new Map(task.input.map((campo) => [campo.nome, campo.tipo]));
  const argumentos = ordenarCamposConstrutor(task.input).map((campo) => {
    const valorCampo = camposGiven.get(campo.nome);
    if (valorCampo !== undefined) {
      return formatarLiteralTestePhp(valorCampo, tiposEntrada.get(campo.nome));
    }
    const bloco = blocosGiven.get(campo.nome);
    if (bloco) {
      return literalBlocoPhp(bloco);
    }
    return valorPadraoPhp(campo);
  });
  return `new ${paraPascalCase(`${task.nome}_entrada`)}(${argumentos.join(", ")})`;
}

function gerarTestesPhp(modulo: IrModulo, arquivoModulo: string): string | undefined {
  const testes = modulo.tasks.flatMap((task) => task.tests.map((caso, indice) => ({ task, caso, indice })));
  if (testes.length === 0) {
    return undefined;
  }

  const funcoes = testes.map(({ task, caso, indice }) => {
    const nomeTeste = `test_${normalizarNomeParaSimbolo(task.nome)}_${indice + 1}`;
    const entrada = gerarInstanciaEntradaTeste(task, caso.given);
    const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
    if (tipoErro) {
      return `function ${nomeTeste}(): void
{
    try {
        executar_${normalizarNomeParaSimbolo(task.nome)}(${entrada}, ["erro_esperado" => ${literalPhp(tipoErro)}]);
    } catch (${classeErroTask(task, tipoErro)} $erro) {
        assert_sema($erro->codigo === ${literalPhp(tipoErro)}, "codigo de erro inesperado");
        return;
    }
    throw new \\RuntimeException(${literalPhp(`Caso ${caso.nome} deveria falhar com ${tipoErro}`)});
}`;
    }
    return `function ${nomeTeste}(): void
{
    $resultado = executar_${normalizarNomeParaSimbolo(task.nome)}(${entrada});
    assert_sema($resultado !== null, ${literalPhp(`Caso ${caso.nome} nao retornou resultado`)});
}`;
  });
  const lista = testes.map(({ task, caso, indice }) => `    [${literalPhp(caso.nome)}, "test_${normalizarNomeParaSimbolo(task.nome)}_${indice + 1}"],`).join("\n");

  return `${gerarCabecalhoSemaPhp(modulo, "teste")}require_once __DIR__ . "/${path.posix.basename(arquivoModulo)}";

function assert_sema(bool $condicao, string $mensagem): void
{
    if (!$condicao) {
        throw new \\RuntimeException($mensagem);
    }
}

${funcoes.join("\n\n")}

$testes = [
${lista}
];

foreach ($testes as [$nome, $funcao]) {
    fwrite(STDOUT, "test " . $nome . PHP_EOL);
    $funcao();
}

fwrite(STDOUT, "ok " . count($testes) . " testes" . PHP_EOL);
`;
}

type TipoCabecalhoPhp = "contrato" | "teste";

function gerarCabecalhoSemaPhp(modulo: IrModulo, tipo: TipoCabecalhoPhp = "contrato"): string {
  const descricoes: Record<TipoCabecalhoPhp, string> = {
    contrato: "artefato PHP gerado para executar e revisar as regras declaradas no contrato Sema.",
    teste: "testes PHP gerados a partir dos casos do contrato Sema.",
  };
  return [
    "<?php",
    "// SEMA-GOVERNED",
    `// Modulo de origem: ${modulo.nome}`,
    "// Consulte o contrato .sema aplicavel antes de editar este arquivo.",
    "// Rastreabilidade: outros contratos .sema podem governar este mesmo arquivo via vinculos.",
    "// Para IA fraca/media/forte: chame Sema, rode docs-impacto e drift antes de alterar codigo.",
    `// Descricao: ${descricoes[tipo]}`,
    "",
    "declare(strict_types=1);",
    "",
  ].join("\n");
}

export function gerarPhp(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const estrutura = descreverEstruturaModulo(modulo.nome);
  const interops = modulo.interoperabilidades.map((interop) => `// Interop externo ${interop.origem}: ${interop.caminho}`).join("\n");
  const tiposExternos = coletarTiposExternos(modulo).map((tipo) => `final class ${paraPascalCase(tipo)}
{
}
`).join("\n");
  const tipos = modulo.types.map((tipo) => gerarClasseDados(tipo.nome, tipo.definicao.campos)).join("\n");
  const entidades = modulo.entities.map((entity) => gerarClasseDados(entity.nome, entity.campos)).join("\n");
  const enums = modulo.enums.map(gerarEnum).join("\n");
  const states = modulo.states.map((state) => `// State${state.nome ? ` ${state.nome}` : ""}: campos=${state.campos.length} invariantes=${state.invariantes.length} transicoes=${state.transicoes.length}`).join("\n");
  const flows = modulo.flows.map((flow) => `// Flow ${flow.nome}: etapas=${flow.etapasEstruturadas.length} tasks=${flow.tasksReferenciadas.join(", ") || "nenhuma"}`).join("\n");
  const routes = modulo.routes.map((route) => `// Route ${route.nome}: metodo=${route.metodo ?? "nao_definido"} caminho=${route.caminho ?? "nao_definido"} task=${route.task ?? "nao_definida"}`).join("\n");
  const tasks = modulo.tasks.map(gerarTask).join("\n");
  const codigo = `${gerarCabecalhoSemaPhp(modulo)}${interops ? `${interops}\n` : ""}${tiposExternos ? `${tiposExternos}\n` : ""}${tipos ? `${tipos}\n` : ""}${entidades ? `${entidades}\n` : ""}${enums ? `${enums}\n` : ""}${tasks}${states ? `\n${states}` : ""}${flows ? `\n${flows}` : ""}${routes ? `\n${routes}` : ""}\n`;
  const caminhoModulo = estrutura.contextoRelativo
    ? path.posix.join(estrutura.contextoRelativo, `${estrutura.nomeArquivo}.php`)
    : `${nomeBase}.php`;
  const arquivos: ArquivoGerado[] = [{ caminhoRelativo: caminhoModulo, conteudo: codigo }];
  const testes = gerarTestesPhp(modulo, caminhoModulo);
  if (testes) {
    arquivos.push({
      caminhoRelativo: estrutura.contextoRelativo
        ? path.posix.join(estrutura.contextoRelativo, `test_${estrutura.nomeArquivo}.php`)
        : `test_${nomeBase}.php`,
      conteudo: testes,
    });
  }
  return arquivos;
}
