// SEMA-GOVERNED: sema.produto.gerador_python_verificacao
// Contrato: contratos/sema/gerador_python_verificacao.sema
// Descrição: prepara entidades e restrições por caminho, sem consultar expectativas de testes.
import type { ExpressaoSemantica, IrTask } from "@sema/nucleo";
import { formatarValorPython } from "./index.part01.js";

export function acessoPython(variavel: string, caminho: string): string {
  return `sema_get(${variavel}, ${JSON.stringify(caminho.split("."))})`;
}

export function valorCompostoPython(tipo: string, tipos: Map<string, Map<string, string>>, vistos = new Set<string>()): string {
  if (/^(Lista|Mapa)</u.test(tipo) || /\[\]$/u.test(tipo)) return tipo.startsWith("Mapa") ? "{}" : "[]";
  if (tipo.startsWith("Opcional<") || tipo.endsWith("?")) return "None";
  if (["Numero", "Inteiro", "Decimal"].includes(tipo)) return "1";
  if (tipo === "Booleano") return "False";
  if (["Json", "Objeto"].includes(tipo)) return "{}";
  if (!tipos.has(tipo)) return ["Texto", "Id", "Email", "Url", "Data", "DataHora", "Timestamp"].includes(tipo) ? '"valor_garantido"' : "SimpleNamespace()";
  if (vistos.has(tipo)) return "None";
  const proximos = new Set(vistos).add(tipo);
  return `${tipo}(${[...tipos.get(tipo)!].map(([nome, filho]) => `${nome}=${valorCompostoPython(filho, tipos, proximos)}`).join(", ")})`;
}

function termosConjuntos(expressao: ExpressaoSemantica): ExpressaoSemantica[] {
  return expressao.tipo === "composta" && expressao.operadorLogico === "e"
    ? expressao.termos.flatMap(termosConjuntos) : [expressao];
}

export function prepararSaidaPython(task: IrTask, tipos: Map<string, Map<string, string>>): string {
  const campos = new Set(task.output.map(campo => campo.nome));
  const grupos = new Map<string, ExpressaoSemantica[]>();
  for (const regra of task.garantiasEstruturadas.flatMap(termosConjuntos)) {
    if (!("alvo" in regra) || !campos.has(regra.alvo.split(".")[0]!)) continue;
    if (!["comparacao", "pertencimento", "existe"].includes(regra.tipo)) continue;
    grupos.set(regra.alvo, [...(grupos.get(regra.alvo) ?? []), regra]);
  }
  const argumentos = task.output.map(campo => `${campo.nome}=${campo.opcional ? "None" : valorCompostoPython(campo.tipo, tipos)}`);
  const linhas = [`    # Andaime demonstrativo; não executa a implementação externa vinculada.`, `    saida = ${task.nome}Saida(${argumentos.join(", ")})`];
  // Inicialize folhas antes de suas referências e preserve nós que são pais.
  const referencias = new Set<string>();
  for (const regras of grupos.values()) for (const regra of regras) {
    if (regra.tipo === "comparacao" && campos.has(regra.valor.split(".")[0]!)) referencias.add(regra.valor);
  }
  for (const referencia of referencias) {
    if (!grupos.has(referencia)) grupos.set(referencia, [{ tipo: "existe", alvo: referencia, textoOriginal: `${referencia} existe` }]);
  }
  const caminhos = [...grupos.keys()].sort((a, b) => Number(referencias.has(b)) - Number(referencias.has(a)) || a.split(".").length - b.split(".").length);
  for (const caminho of caminhos) {
    const regras = grupos.get(caminho)!;
    let tipo = task.output.find(campo => campo.nome === caminho.split(".")[0])?.tipo ?? "Json";
    for (const segmento of caminho.split(".").slice(1)) tipo = tipos.get(tipo)?.get(segmento) ?? "Json";
    const restricoes = regras.map(regra => {
      if (regra.tipo === "comparacao") return `(${JSON.stringify(regra.operador)}, ${formatarValorPython(regra.valor, campos, "saida")})`;
      if (regra.tipo === "pertencimento") return `("in", [${(regra.valores ?? []).map(valor => formatarValorPython(valor, campos, "saida")).join(", ")}])`;
      return '("existe", None)';
    });
    if (regras.every(regra => regra.tipo === "existe") && caminhos.some(outro => outro.startsWith(`${caminho}.`))) {
      linhas.push(`    if ${acessoPython("saida", caminho)} is None:`, `        sema_set(saida, ${JSON.stringify(caminho.split("."))}, ${valorCompostoPython(tipo, tipos) === "None" ? "SimpleNamespace()" : valorCompostoPython(tipo, tipos)})`);
    } else {
      linhas.push(`    sema_set(saida, ${JSON.stringify(caminho.split("."))}, sema_sintetizar(${acessoPython("saida", caminho)}, [${restricoes.join(", ")}], inteiro=${tipo === "Inteiro" ? "True" : "False"}))`);
    }
  }
  return linhas.join("\n");
}
