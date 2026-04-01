import {
  type AtualizarProdutoInput,
  type CriarProdutoInput,
  type EstoqueApi,
  type FabricaApi,
  gerarId,
  type ListarProdutosInput,
  ordenarProdutos,
  type Produto,
} from "./comum.js";

class EstoqueSemaBaixo implements EstoqueApi {
  private produtos = new Map<string, Produto>();
  private sequencia = 1;

  criarProduto(input: CriarProdutoInput): Produto {
    if (!input.nome || !input.nome.trim()) {
      throw new Error("entrada_invalida");
    }
    if (typeof input.preco !== "number" || input.preco <= 0) {
      throw new Error("entrada_invalida");
    }

    const produto: Produto = {
      id: gerarId(this.sequencia++),
      nome: input.nome,
      preco: input.preco,
      quantidade: typeof input.quantidade === "number" ? input.quantidade : 0,
      estoque_minimo: typeof input.estoque_minimo === "number" ? input.estoque_minimo : 0,
      categoria: input.categoria ?? "OUTROS",
    };

    this.produtos.set(produto.id, produto);
    return { ...produto };
  }

  listarProdutos(input: ListarProdutosInput = {}) {
    let items = ordenarProdutos([...this.produtos.values()]);

    if (input.categoria) {
      items = items.filter((produto) => produto.categoria === input.categoria);
    }

    if (input.apenas_estoque_baixo) {
      items = items.filter((produto) => produto.quantidade < 10);
    }

    return { items, total: items.length };
  }

  obterProduto(id: string): Produto {
    const produto = this.produtos.get(id);
    if (!produto) {
      throw new Error("Nao encontrado");
    }
    return { ...produto };
  }

  atualizarProduto(id: string, input: AtualizarProdutoInput): Produto {
    const atual = this.produtos.get(id);
    if (!atual) {
      throw new Error("Nao encontrado");
    }

    const produto = {
      ...atual,
      ...input,
    };

    this.produtos.set(id, produto);
    return { ...produto };
  }

  removerProduto(id: string) {
    if (!this.produtos.has(id)) {
      throw new Error("Nao encontrado");
    }
    this.produtos.delete(id);
    return { removido: true, id };
  }

  calcularValorTotalInventario() {
    const total_geral = [...this.produtos.values()].reduce((acc, produto) => acc + produto.preco * produto.quantidade, 0);
    return { total_geral, valor_por_categoria: {} };
  }
}

export const semaBaixoFactory: FabricaApi = {
  nome: "SEMA BAIXO",
  criar() {
    return new EstoqueSemaBaixo();
  },
};
