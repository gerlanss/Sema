// SEMA-GOVERNED: sema.produto.gerador_python_verificacao
// Contrato: contratos/sema/gerador_python_verificacao.sema
// Descrição: emite assertivas para expectativas reais, inclusive folhas aninhadas.
import type { IrBlocoDeclarativo, IrTask } from "@sema/nucleo";
import { formatarLiteralTestePython } from "./index.part01.js";
import { acessoPython } from "./valores.js";

export function validarEntradasTestePython(bloco: IrBlocoDeclarativo, campos: Map<string, string>, tipos: Map<string, Map<string, string>>, contexto: string): void {
  for (const campo of bloco.campos) {
    const tipo = campos.get(campo.nome);
    if (tipo && tipos.has(tipo) && campo.tipo !== "nulo") {
      throw new Error(`SEM125: ${contexto}.${campo.nome} exige ${tipo}; forneça bloco estruturado, não texto descritivo.`);
    }
  }
  for (const filho of bloco.blocos) {
    const tipo = campos.get(filho.nome);
    if (tipo && tipos.has(tipo)) validarEntradasTestePython(filho.conteudo, tipos.get(tipo)!, tipos, `${contexto}.${filho.nome}`);
  }
}

export function gerarExpectativasPython(task: IrTask, bloco: IrBlocoDeclarativo, tipos: Map<string, Map<string, string>>, prefixo = ""): string[] {
  const linhas: string[] = [];
  for (const campo of bloco.campos) {
    const caminho = prefixo ? `${prefixo}.${campo.nome}` : campo.nome;
    const raiz = caminho.split(".")[0]!;
    const saida = task.output.find(item => item.nome === raiz);
    if (!saida && caminho === "sucesso") {
      linhas.push(`    assert (resultado is not None) == ${formatarLiteralTestePython(campo.tipo, "Booleano")}, "Expectativa de sucesso divergente"`);
      continue;
    }
    if (!saida) throw new Error(`Expectativa "${caminho}" da task "${task.nome}" não corresponde a campo do output.`);
    let tipo = saida.tipo;
    for (const filho of caminho.split(".").slice(1)) tipo = tipos.get(tipo)?.get(filho) ?? "Json";
    linhas.push(`    assert ${acessoPython("resultado", caminho)} == ${formatarLiteralTestePython(campo.tipo, tipo)}, ${JSON.stringify(`Expectativa divergente: ${caminho}`)}`);
  }
  for (const filho of bloco.blocos) linhas.push(...gerarExpectativasPython(task, filho.conteudo, tipos, prefixo ? `${prefixo}.${filho.nome}` : filho.nome));
  return linhas;
}
