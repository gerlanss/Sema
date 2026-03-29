import type { IrCampo, IrModulo, IrTask } from "@sema/nucleo";
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

function formatarLiteralTestePython(valor: string): string {
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
  const validacoes = [
    ...task.input
      .filter((campo) => campo.modificadores.includes("required"))
      .map((campo) => `    if entrada.${campo.nome} is None:\n        raise ValueError("Campo obrigatorio ausente: ${campo.nome}")`),
    ...task.regrasEstruturadas.map((regra) => {
      switch (regra.tipo) {
        case "existe":
          return `    if entrada.${regra.alvo} is None:\n        raise ValueError("Regra violada: ${regra.textoOriginal}")`;
        case "comparacao":
          return `    if not (entrada.${regra.alvo} ${regra.operador} ${formatarValorPython(regra.valor ?? "", camposEntrada, "entrada")}):\n        raise ValueError("Regra violada: ${regra.textoOriginal}")`;
        case "pertencimento":
          return `    if entrada.${regra.alvo} not in [${(regra.valores ?? []).map((valor) => formatarValorPython(valor, camposEntrada, "entrada")).join(", ")}]:\n        raise ValueError("Regra violada: ${regra.textoOriginal}")`;
        case "predicado":
          return `    # Predicado declarado em Sema: ${regra.textoOriginal}`;
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
          case "existe":
            return `    if saida.${garantia.alvo} is None:\n        raise ValueError("Garantia violada: ${garantia.textoOriginal}")`;
          case "comparacao":
            return `    if not (saida.${garantia.alvo} ${garantia.operador} ${formatarValorPython(garantia.valor ?? "", camposSaida, "saida")}):\n        raise ValueError("Garantia violada: ${garantia.textoOriginal}")`;
          case "pertencimento":
            return `    if saida.${garantia.alvo} not in [${(garantia.valores ?? []).map((valor) => formatarValorPython(valor, camposSaida, "saida")).join(", ")}]:\n        raise ValueError("Garantia violada: ${garantia.textoOriginal}")`;
          case "predicado":
            return `    # Predicado de garantia declarado em Sema: ${garantia.textoOriginal}`;
        }
      }),
      ...task.guarantees
        .filter((garantia) => !task.garantiasEstruturadas.some((estruturada) => estruturada.textoOriginal === garantia))
        .map((garantia) => `    # Garantia declarada em Sema: ${garantia}`),
    ].join("\n")}\n    return saida`;

  return `
${gerarDataclass(`${task.nome}Entrada`, task.input)}
${gerarDataclass(`${task.nome}Saida`, task.output)}

def validar_${nome}(entrada: ${task.nome}Entrada) -> None:
${validacoes || "    pass"}

def executar_${nome}(entrada: ${task.nome}Entrada) -> ${task.nome}Saida:
    validar_${nome}(entrada)
${efeitos}
${gerarPreparacaoSaida(task)}
${garantias}
`;
}

function gerarTestes(modulo: IrModulo): string {
  const linhas = ["import pytest", `from ${normalizarNomeModulo(modulo.nome).replace(/\./g, "_")} import *`, ""];
  for (const task of modulo.tasks) {
    const nomeFuncao = `executar_${normalizarNomeParaSimbolo(task.nome)}`;
    for (const caso of task.tests) {
      const argumentos = caso.given.campos.map((campo) => `${campo.nome}=${formatarLiteralTestePython(campo.tipo)}`).join(", ");
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
  const flows = modulo.flows.map((flow) => `# Flow ${flow.nome}: etapas=${flow.linhas.length} tasks=${flow.tasksReferenciadas.join(", ") || "nenhuma"}`).join("\n");
  const routes = modulo.routes.map((route) => `# Route ${route.nome}: metodo=${route.metodo ?? "nao_definido"} caminho=${route.caminho ?? "nao_definido"} task=${route.task ?? "nao_definida"}`).join("\n");
  const tasks = modulo.tasks.map(gerarTask).join("\n");

  const codigo = `# Arquivo gerado automaticamente pela Sema.\n# Modulo de origem: ${modulo.nome}\n\nfrom dataclasses import dataclass\nfrom types import SimpleNamespace\n\n${enums}\n${entidades}\n${states}\n${flows}\n${routes}\n${tasks}\n`;
  const testes = gerarTestes(modulo);

  return [
    { caminhoRelativo: `${nomeBase}.py`, conteudo: codigo },
    { caminhoRelativo: `test_${nomeBase}.py`, conteudo: testes },
  ];
}
