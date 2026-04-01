import {
  type AtualizarProdutoInput,
  type CriarProdutoInput,
  type EstoqueApi,
  type FabricaApi,
  gerarId,
  type ListarProdutosInput,
  type Produto,
} from "./comum.js";

class ErroEstoque extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
    this.name = "ErroEstoque";
  }
}

type ProdutoLivre = Produto & {
  criadoEm: string;
  atualizadoEm: string;
};

class EstoqueSemSema implements EstoqueApi {
  private produtos = new Map<string, ProdutoLivre>();
  private sequencia = 1;

  criarProduto(input: CriarProdutoInput): Produto {
    if (!input.nome || input.nome.trim() === "") {
      throw new ErroEstoque("dados_invalidos", "Nome obrigatorio.");
    }
    if (typeof input.preco !== "number" || input.preco <= 0) {
      throw new ErroEstoque("dados_invalidos", "Preco invalido.");
    }

    const agora = new Date().toISOString();
    const produto: ProdutoLivre = {
      id: gerarId(this.sequencia++),
      nome: input.nome,
      preco: input.preco,
      quantidade: typeof input.quantidade === "number" ? input.quantidade : 0,
      estoque_minimo: typeof input.estoque_minimo === "number" ? input.estoque_minimo : 5,
      categoria: input.categoria ?? "GERAL",
      criadoEm: agora,
      atualizadoEm: agora,
    };

    this.produtos.set(produto.id, produto);
    return { ...produto };
  }

  listarProdutos(input: ListarProdutosInput = {}) {
    let items = [...this.produtos.values()];

    if (input.categoria) {
      items = items.filter((produto) => produto.categoria === input.categoria);
    }

    if (input.apenas_estoque_baixo) {
      items = items.filter((produto) => produto.quantidade < produto.estoque_minimo);
    }

    return { items: items.map((produto) => ({ ...produto })), total: items.length };
  }

  obterProduto(id: string): Produto {
    const produto = this.produtos.get(id);
    if (!produto) {
      throw new ErroEstoque("nao_encontrado", "Produto nao localizado.");
    }
    return { ...produto };
  }

  atualizarProduto(id: string, input: AtualizarProdutoInput): Produto {
    const atual = this.produtos.get(id);
    if (!atual) {
      throw new ErroEstoque("nao_encontrado", "Produto nao localizado.");
    }

    const produto = {
      ...atual,
      ...input,
      estoque_minimo: input.estoque_minimo ?? atual.estoque_minimo ?? 5,
      atualizadoEm: new Date().toISOString(),
    };

    this.produtos.set(id, produto);
    return { ...produto };
  }

  removerProduto(id: string) {
    if (!this.produtos.has(id)) {
      throw new ErroEstoque("nao_encontrado", "Produto nao localizado.");
    }
    this.produtos.delete(id);
    return { removido: true, id };
  }

  calcularValorTotalInventario() {
    const total_geral = [...this.produtos.values()].reduce((acc, produto) => acc + produto.preco * produto.quantidade, 0);
    const valor_por_categoria: Record<string, number> = {};

    for (const produto of this.produtos.values()) {
      const chave = produto.categoria.toLowerCase();
      valor_por_categoria[chave] = (valor_por_categoria[chave] ?? 0) + (produto.preco * produto.quantidade);
    }

    return { total_geral, valor_por_categoria };
  }
}

export const semSemaFactory: FabricaApi = {
  nome: "SEM SEMA",
  criar() {
    return new EstoqueSemSema();
  },
};
