// SEMA-GOVERNED: sema.produto.gerador_python_verificacao
// Contrato: contratos/sema/gerador_python_verificacao.sema
// Descrição: rejeita literais escalares onde o teste exige entidade ou type estruturado.
import type { BlocoGenericoAst, CampoAst, ModuloAst } from "../ast/tipos.js";
import { criarDiagnostico, type Diagnostico } from "../diagnosticos/index.js";

export function validarTiposEstruturadosTestes(modulo: ModuloAst, diagnosticos: Diagnostico[]): void {
  const tipos = new Map<string, CampoAst[]>();
  for (const item of [...modulo.types, ...modulo.entities]) {
    const fields = item.corpo.blocos.find(bloco => bloco.tipo === "bloco_generico" && bloco.palavraChave === "fields");
    tipos.set(item.nome, fields?.tipo === "bloco_generico" ? fields.campos : item.corpo.campos);
  }
  function conferir(bloco: BlocoGenericoAst, campos: CampoAst[], contexto: string): void {
    for (const valor of bloco.campos) {
      const declarado = campos.find(campo => campo.nome === valor.nome);
      if (!declarado || !tipos.has(declarado.valor)) continue;
      if (valor.valor === "nulo" && !declarado.modificadores.includes("required")) continue;
      diagnosticos.push(criarDiagnostico("SEM125", `${contexto}: "${valor.nome}" exige ${declarado.valor}, mas recebeu literal escalar; caso não executável.`, "aviso", valor.intervalo,
        `Use ${valor.nome} { ... } com os campos de ${declarado.valor}; texto descritivo não é uma entidade.`));
    }
    for (const filho of bloco.blocos) {
      if (filho.tipo !== "bloco_generico") continue;
      const tipo = campos.find(campo => campo.nome === filho.nome)?.valor;
      if (tipo && tipos.has(tipo)) conferir(filho, tipos.get(tipo)!, `${contexto}.${filho.nome}`);
    }
  }
  for (const task of modulo.tasks) for (const caso of task.tests?.blocos ?? []) {
    if (caso.tipo !== "caso_teste") continue;
    if (caso.given) conferir(caso.given, task.input?.campos ?? [], `given do caso "${caso.nome}" da task "${task.nome}"`);
    if (caso.expect) conferir(caso.expect, task.output?.campos ?? [], `expect do caso "${caso.nome}" da task "${task.nome}"`);
  }
}
