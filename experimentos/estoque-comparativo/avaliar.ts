import path from "node:path";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { semaBaixoFactory } from "./implementacoes/sema-baixo.js";
import { semaMedioFactory } from "./implementacoes/sema-medio.js";
import { semSemaFactory } from "./implementacoes/sem-sema.js";
import type { FabricaApi } from "./implementacoes/comum.js";

type ResultadoCheck = {
  nome: string;
  passou: boolean;
  detalhe?: string;
};

type ResumoAbordagem = {
  nome: string;
  checks: ResultadoCheck[];
};

async function carregarFactorySemaAlto(): Promise<FabricaApi> {
  const caminho = path.resolve("experimentos/estoque-comparativo/implementacoes/sema-alto.ts");
  if (!existsSync(caminho)) {
    throw new Error("Implementacao SEMA ALTO ainda nao foi gerada.");
  }

  const modulo = await import(pathToFileURL(caminho).href);
  return modulo.semaAltoFactory as FabricaApi;
}

function capturarCodigo(erro: unknown): string | null {
  if (!erro || typeof erro !== "object") {
    return null;
  }
  if ("codigo" in erro && typeof erro.codigo === "string") {
    return erro.codigo;
  }
  if ("message" in erro && typeof erro.message === "string") {
    return erro.message;
  }
  return null;
}

async function avaliarFactory(factory: FabricaApi): Promise<ResumoAbordagem> {
  const api = factory.criar();
  const checks: ResultadoCheck[] = [];

  const notebook = api.criarProduto({
    nome: "Notebook",
    preco: 3500,
    quantidade: 3,
    estoque_minimo: 2,
    categoria: "ELETRONICOS",
  });

  const papel = api.criarProduto({
    nome: "Papel A4",
    preco: 29.9,
    quantidade: 2,
    estoque_minimo: 5,
    categoria: "ESCRITORIO",
  });

  checks.push({
    nome: "cria produto valido",
    passou: notebook.id.startsWith("prod_") && papel.id.startsWith("prod_"),
  });

  try {
    api.criarProduto({
      nome: "Categoria ruim",
      preco: 10,
      quantidade: 1,
      estoque_minimo: 0,
      categoria: "HOBBY",
    });
    checks.push({ nome: "rejeita categoria invalida", passou: false, detalhe: "aceitou categoria fora do contrato" });
  } catch (erro) {
    checks.push({ nome: "rejeita categoria invalida", passou: capturarCodigo(erro) === "entrada_invalida" });
  }

  try {
    api.criarProduto({
      nome: "Sem estoque minimo",
      preco: 10,
      quantidade: 1,
      categoria: "OUTROS",
    });
    checks.push({ nome: "rejeita estoque_minimo ausente", passou: false, detalhe: "aceitou default inventado" });
  } catch (erro) {
    checks.push({ nome: "rejeita estoque_minimo ausente", passou: capturarCodigo(erro) === "entrada_invalida" });
  }

  try {
    api.obterProduto("prod_999");
    checks.push({ nome: "erro semantico para produto ausente", passou: false });
  } catch (erro) {
    checks.push({ nome: "erro semantico para produto ausente", passou: capturarCodigo(erro) === "produto_nao_encontrado" });
  }

  const filtrados = api.listarProdutos({ apenas_estoque_baixo: true });
  checks.push({
    nome: "filtro de estoque baixo respeita estoque_minimo do produto",
    passou: filtrados.items.length === 1 && filtrados.items[0]?.id === papel.id,
    detalhe: `retornou ${filtrados.items.map((item) => item.id).join(", ")}`,
  });

  const total = api.calcularValorTotalInventario();
  checks.push({
    nome: "calcula valor total geral",
    passou: Math.abs(total.total_geral - 10559.8) < 0.0001,
    detalhe: String(total.total_geral),
  });

  checks.push({
    nome: "agrupa valor por categoria",
    passou: Math.abs((total.valor_por_categoria.ELETRONICOS ?? 0) - 10500) < 0.0001
      && Math.abs((total.valor_por_categoria.ESCRITORIO ?? 0) - 59.8) < 0.0001,
    detalhe: JSON.stringify(total.valor_por_categoria),
  });

  const atualizado = api.atualizarProduto(papel.id, {
    quantidade: 10,
    categoria: "LIMPEZA",
  });

  checks.push({
    nome: "atualiza produto existente",
    passou: atualizado.quantidade === 10 && atualizado.categoria === "LIMPEZA",
  });

  const removido = api.removerProduto(notebook.id);
  checks.push({
    nome: "remove produto existente",
    passou: removido.removido === true && removido.id === notebook.id,
  });

  const listagemFinal = api.listarProdutos();
  checks.push({
    nome: "listagem final consistente",
    passou: listagemFinal.total === 1 && listagemFinal.items[0]?.id === papel.id,
  });

  return { nome: factory.nome, checks };
}

function imprimirResumo(resumos: ResumoAbordagem[]): void {
  console.log("Experimento controlado: Sistema de Controle de Estoque");
  console.log("");

  for (const resumo of resumos) {
    const pontos = resumo.checks.filter((check) => check.passou).length;
    console.log(`${resumo.nome}: ${pontos}/${resumo.checks.length}`);
    for (const check of resumo.checks) {
      console.log(`- ${check.passou ? "OK" : "FALHA"} :: ${check.nome}${check.detalhe ? ` :: ${check.detalhe}` : ""}`);
    }
    console.log("");
  }
}

async function main(): Promise<void> {
  const factories = [
    semaBaixoFactory,
    semaMedioFactory,
    await carregarFactorySemaAlto(),
    semSemaFactory,
  ];

  const resumos = [];
  for (const factory of factories) {
    resumos.push(await avaliarFactory(factory));
  }

  imprimirResumo(resumos);
}

main().catch((erro) => {
  console.error("Falha ao avaliar experimento de estoque.");
  console.error(erro instanceof Error ? erro.stack ?? erro.message : erro);
  process.exit(1);
});
