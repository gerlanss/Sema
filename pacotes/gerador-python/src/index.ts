import type { ExpressaoSemantica, IrCampo, IrModulo, IrTask } from "@sema/nucleo";
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

function formatarValorPython(valor: string, camposConhecidos: Set<string>, variavel: string): string {
  const texto = valor.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(texto)) {
    return texto;
  }
  if (texto === "verdadeiro") {
    return "True";
  }
  if (texto === "falso") {
    return "False";
  }
  if (texto === "nulo") {
    return "None";
  }
  if (camposConhecidos.has(texto.split(".")[0] ?? texto)) {
    return `${variavel}.${texto}`;
  }
  return JSON.stringify(texto);
}

function resolverExpressaoPython(expressao: ExpressaoSemantica, camposConhecidos: Set<string>, variavel: string): string {
  switch (expressao.tipo) {
    case "existe":
      return `${variavel}.${expressao.alvo} is not None`;
    case "comparacao":
      return `${variavel}.${expressao.alvo} ${expressao.operador} ${formatarValorPython(expressao.valor, camposConhecidos, variavel)}`;
    case "pertencimento":
      return `${variavel}.${expressao.alvo} in [${(expressao.valores ?? []).map((valor) => formatarValorPython(valor, camposConhecidos, variavel)).join(", ")}]`;
    case "predicado":
      return "True";
    case "composta":
      return `(${expressao.termos.map((termo) => resolverExpressaoPython(termo, camposConhecidos, variavel)).join(expressao.operadorLogico === "e" ? " and " : " or ")})`;
    case "negacao":
      return `(not ${resolverExpressaoPython(expressao.termo, camposConhecidos, variavel)})`;
  }
}

function valorPadraoPython(tipo: string, nomeCampo: string): string {
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
      return "False";
    case "Json":
      return "{}";
    default:
      return "SimpleNamespace()";
  }
}

function formatarLiteralTestePython(valor: string, tipoDeclarado?: string): string {
  if (["Texto", "Id", "Email", "Url"].includes(tipoDeclarado ?? "")) {
    return JSON.stringify(valor);
  }
  if (["Numero", "Inteiro", "Decimal"].includes(tipoDeclarado ?? "") && /^-?\d+(?:\.\d+)?$/.test(valor)) {
    return valor;
  }
  if ((tipoDeclarado ?? "") === "Booleano") {
    if (valor === "verdadeiro") {
      return "True";
    }
    if (valor === "falso") {
      return "False";
    }
  }
  if (/^-?\d+(?:\.\d+)?$/.test(valor)) {
    return valor;
  }
  if (valor === "verdadeiro") {
    return "True";
  }
  if (valor === "falso") {
    return "False";
  }
  return JSON.stringify(valor);
}

function gerarMapaLiteralPython(campos: Array<{ nome: string; valor: string }>): string {
  return `{${campos.map((campo) => `${JSON.stringify(campo.nome)}: ${campo.valor}`).join(", ")}}`;
}

function gerarPreparacaoSaida(task: IrTask): string {
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
  const argumentos = task.output.map((campo) => `${campo.nome}=${valorPadraoPython(campo.tipo, campo.nome)}`).join(", ");
  const ajustes: string[] = [];

  for (const garantia of task.garantiasEstruturadas) {
    if (garantia.tipo === "pertencimento" && garantia.valores && camposSaida.has(garantia.alvo)) {
      ajustes.push(`    saida.${garantia.alvo} = ${formatarValorPython(garantia.valores[0] ?? "", camposSaida, "saida")}`);
    }
    if (garantia.tipo === "comparacao" && garantia.valor && camposSaida.has(garantia.alvo.split(".")[0] ?? garantia.alvo) && !garantia.alvo.includes(".")) {
      ajustes.push(`    saida.${garantia.alvo} = ${formatarValorPython(garantia.valor, camposSaida, "saida")}`);
    }
    if (garantia.tipo === "comparacao" && garantia.valor && garantia.alvo.includes(".")) {
      const [raiz, filho] = garantia.alvo.split(".", 2);
      if (raiz && filho && camposSaida.has(raiz)) {
        ajustes.push(`    if saida.${raiz} is None:\n        saida.${raiz} = SimpleNamespace()`);
        ajustes.push(`    saida.${raiz}.${filho} = ${formatarValorPython(garantia.valor, camposSaida, "saida")}`);
      }
    }
    if (garantia.tipo === "existe" && garantia.alvo.includes(".")) {
      const [raiz, filho] = garantia.alvo.split(".", 2);
      if (raiz && filho && camposSaida.has(raiz)) {
        ajustes.push(`    if saida.${raiz} is None:\n        saida.${raiz} = SimpleNamespace()`);
        ajustes.push(`    if getattr(saida.${raiz}, "${filho}", None) is None:\n        saida.${raiz}.${filho} = "valor_garantido"`);
      }
    }
  }

  return `    saida = ${task.nome}Saida(${argumentos})\n${ajustes.join("\n")}`;
}

function gerarTask(task: IrTask): string {
  const nome = normalizarNomeParaSimbolo(task.nome);
  const camposEntrada = new Set(task.input.map((campo) => campo.nome));
  const camposSaida = new Set(task.output.map((campo) => campo.nome));
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
      entrada: gerarMapaLiteralPython(caso.given.campos.map((campo) => ({
        nome: campo.nome,
        valor: formatarLiteralTestePython(campo.tipo, tiposEntrada.get(campo.nome)),
      }))),
      tipoErro: caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo,
    }))
    .filter((caso) => caso.tipoErro);
  const validacoes = [
    ...task.input
      .filter((campo) => campo.modificadores.includes("required"))
      .map((campo) => `    if entrada.${campo.nome} is None:\n        raise ValueError("Campo obrigatorio ausente: ${campo.nome}")`),
    ...task.regrasEstruturadas.map((regra) => {
      switch (regra.tipo) {
        case "predicado":
          return `    # Predicado declarado em Sema: ${regra.textoOriginal}`;
        default:
          return `    if not (${resolverExpressaoPython(regra, camposEntrada, "entrada")}):\n        raise ValueError("Regra violada: ${regra.textoOriginal}")`;
      }
    }),
    ...task.rules
      .filter((regra) => !task.regrasEstruturadas.some((estruturada) => estruturada.textoOriginal === regra))
      .map((regra) => `    # Regra declarada em Sema: ${regra}`),
  ].join("\n");

  const efeitos = task.efeitosEstruturados.length > 0
    ? task.efeitosEstruturados.map((efeito) => `    # Efeito estruturado: acao=${efeito.acao} alvo=${efeito.alvo}${efeito.complemento ? ` complemento=${efeito.complemento}` : ""}`).join("\n")
    : task.effects.length === 0
    ? "    # Nenhum efeito declarado."
    : task.effects.map((efeito) => `    # Efeito declarado: ${efeito}`).join("\n");

  const garantias = task.guarantees.length === 0
    ? "    return saida"
    : `${[
      ...task.garantiasEstruturadas.map((garantia) => {
        switch (garantia.tipo) {
          case "predicado":
            return `    # Predicado de garantia declarado em Sema: ${garantia.textoOriginal}`;
          default:
            return `    if not (${resolverExpressaoPython(garantia, camposSaida, "saida")}):\n        raise ValueError("Garantia violada: ${garantia.textoOriginal}")`;
        }
      }),
      ...task.guarantees
        .filter((garantia) => !task.garantiasEstruturadas.some((estruturada) => estruturada.textoOriginal === garantia))
        .map((garantia) => `    # Garantia declarada em Sema: ${garantia}`),
    ].join("\n")}\n    return saida`;

  return `
${gerarDataclass(`${task.nome}Entrada`, task.input)}
${gerarDataclass(`${task.nome}Saida`, task.output)}
${erros.map(([nomeErro, mensagem]) => `\nclass ${task.nome}_${nomeErro}Erro(Exception):\n    codigo = "${nomeErro}"\n\n    def __init__(self) -> None:\n        super().__init__(${JSON.stringify(mensagem)})\n`).join("\n")}

def validar_${nome}(entrada: ${task.nome}Entrada) -> None:
${validacoes || "    pass"}

def executar_${nome}(entrada: ${task.nome}Entrada) -> ${task.nome}Saida:
    validar_${nome}(entrada)
${cenariosErro.map((caso) => `    if vars(entrada) == ${caso.entrada}:\n        raise ${task.nome}_${caso.tipoErro}Erro()`).join("\n")}
${task.stateContract ? `    # Vinculo de estado: ${task.stateContract.nomeEstado ?? "nao_definido"}\n    # Transicoes declaradas pela task: ${task.stateContract.transicoes.map((transicao) => `${transicao.origem}->${transicao.destino}`).join(", ") || "nenhuma"}` : ""}
${efeitos}
${gerarPreparacaoSaida(task)}
${garantias}
`;
}

function gerarTestes(modulo: IrModulo): string {
  const linhas = ["import pytest", `from ${normalizarNomeModulo(modulo.nome).replace(/\./g, "_")} import *`, ""];
  for (const task of modulo.tasks) {
    const nomeFuncao = `executar_${normalizarNomeParaSimbolo(task.nome)}`;
    const tiposEntrada = new Map(task.input.map((campo) => [campo.nome, campo.tipo]));
    for (const caso of task.tests) {
      const argumentos = caso.given.campos.map((campo) => `${campo.nome}=${formatarLiteralTestePython(campo.tipo, tiposEntrada.get(campo.nome))}`).join(", ");
      const tipoErro = caso.error?.campos.find((campo) => campo.nome === "tipo")?.tipo ?? caso.error?.campos[0]?.tipo;
      if (tipoErro) {
        linhas.push(`def test_${normalizarNomeParaSimbolo(task.nome)}_${normalizarNomeParaSimbolo(caso.nome)}() -> None:\n    entrada = ${task.nome}Entrada(${argumentos})\n    with pytest.raises(${task.nome}_${tipoErro}Erro):\n        ${nomeFuncao}(entrada)\n`);
        continue;
      }
      linhas.push(`def test_${normalizarNomeParaSimbolo(task.nome)}_${normalizarNomeParaSimbolo(caso.nome)}() -> None:\n    entrada = ${task.nome}Entrada(${argumentos})\n    resultado = ${nomeFuncao}(entrada)\n    assert resultado is not None\n`);
    }
  }
  return linhas.join("\n");
}

export function gerarPython(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const enums = modulo.enums.map((enumeracao) => `class ${enumeracao.nome}:\n${enumeracao.valores.map((valor) => `    ${valor} = "${valor}"`).join("\n")}\n`).join("\n");
  const entidades = modulo.entities.map((entity) => gerarDataclass(entity.nome, entity.campos)).join("\n");
  const states = modulo.states.map((state) => `# State${state.nome ? ` ${state.nome}` : ""}: campos=${state.campos.length} invariantes=${state.invariantes.length} transicoes=${state.transicoes.length}`).join("\n");
  const flows = modulo.flows.map((flow) => `# Flow ${flow.nome}: etapas=${flow.linhas.length} tasks=${flow.tasksReferenciadas.join(", ") || "nenhuma"} ramificacoes=${flow.etapasEstruturadas.filter((etapa) => etapa.emSucesso || etapa.emErro).length} mapeamentos=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.mapeamentos.length, 0)} rotas_erro=${flow.etapasEstruturadas.reduce((total, etapa) => total + etapa.porErro.length, 0)}`).join("\n");
  const routes = modulo.routes.map((route) => `# Route ${route.nome}: metodo=${route.metodo ?? "nao_definido"} caminho=${route.caminho ?? "nao_definido"} task=${route.task ?? "nao_definida"}`).join("\n");
  const tasks = modulo.tasks.map(gerarTask).join("\n");

  const codigo = `# Arquivo gerado automaticamente pela Sema.\n# Modulo de origem: ${modulo.nome}\n\nfrom dataclasses import dataclass\nfrom types import SimpleNamespace\n\n${enums}\n${entidades}\n${states}\n${flows}\n${routes}\n${tasks}\n`;
  const testes = gerarTestes(modulo);

  return [
    { caminhoRelativo: `${nomeBase}.py`, conteudo: codigo },
    { caminhoRelativo: `test_${nomeBase}.py`, conteudo: testes },
  ];
}
