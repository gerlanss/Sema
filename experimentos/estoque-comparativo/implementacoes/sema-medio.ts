import {
  CATEGORIAS,
  type AtualizarProdutoInput,
  CodigoErro,
  copiarProduto,
  type CriarProdutoInput,
  type EstoqueApi,
  type FabricaApi,
  gerarId,
  type ListarProdutosInput,
  ordenarProdutos,
  type Produto,
} from "./comum.js";

function validarCategoria(categoria: string | undefined): asserts categoria is string {
  if (!categoria || !CATEGORIAS.includes(categoria as (typeof CATEGORIAS)[number])) {
    throw new CodigoErro("entrada_invalida", "Categoria invalida.");
  }
}

function validarCriacao(input: CriarProdutoInput): void {
  if (!input.nome || input.nome.trim() === "") {
    throw new CodigoErro("entrada_invalida", "Nome obrigatorio.");
  }
  if (typeof input.preco !== "number" || input.preco <= 0) {
    throw new CodigoErro("entrada_invalida", "Preco deve ser positivo.");
  }
  if (typeof input.quantidade !== "number" || input.quantidade < 0) {
    throw new CodigoErro("entrada_invalida", "Quantidade invalida.");
  }
  if (typeof input.estoque_minimo !== "number" || input.estoque_minimo < 0) {
    throw new CodigoErro("entrada_invalida", "Estoque minimo invalido.");
  }
  validarCategoria(input.categoria);
}

function aplicarAtualizacao(atual: Produto, input: AtualizarProdutoInput): Produto {
  if (input.nome !== undefined && input.nome.trim() === "") {
    throw new CodigoErro("entrada_invalida", "Nome obrigatorio.");
  }
  if (input.preco !== undefined && input.preco <= 0) {
    throw new CodigoErro("entrada_invalida", "Preco deve ser positivo.");
  }
  if (input.quantidade !== undefined && input.quantidade < 0) {
    throw new CodigoErro("entrada_invalida", "Quantidade invalida.");
  }
  if (input.estoque_minimo !== undefined && input.estoque_minimo < 0) {
    throw new CodigoErro("entrada_invalida", "Estoque minimo invalido.");
  }
  if (input.categoria !== undefined) {
    validarCategoria(input.categoria);
  }

  return {
    ...atual,
    ...input,
  };
}

class EstoqueSemaMedio implements EstoqueApi {
  private produtos = new Map<string, Produto>();
  private sequencia = 1;

  criarProduto(input: CriarProdutoInput): Produto {
    validarCriacao(input);

    const produto: Produto = {
      id: gerarId(this.sequencia++),
      nome: input.nome!,
      preco: input.preco!,
      quantidade: input.quantidade!,
      estoque_minimo: input.estoque_minimo!,
      categoria: input.categoria!,
    };

    this.produtos.set(produto.id, produto);
    return copiarProduto(produto);
  }

  listarProdutos(input: ListarProdutosInput = {}) {
    let items = ordenarProdutos([...this.produtos.values()]);

    if (input.categoria) {
      items = items.filter((produto) => produto.categoria === input.categoria);
    }

    if (input.apenas_estoque_baixo) {
      items = items.filter((produto) => produto.quantidade <= produto.estoque_minimo);
    }

    return { items: items.map(copiarProduto), total: items.length };
  }

  obterProduto(id: string): Produto {
    const produto = this.produtos.get(id);
    if (!produto) {
      throw new CodigoErro("produto_nao_encontrado", "Produto nao encontrado.");
    }
    return copiarProduto(produto);
  }

  atualizarProduto(id: string, input: AtualizarProdutoInput): Produto {
    const atual = this.produtos.get(id);
    if (!atual) {
      throw new CodigoErro("produto_nao_encontrado", "Produto nao encontrado.");
    }

    const produto = aplicarAtualizacao(atual, input);
    this.produtos.set(id, produto);
    return copiarProduto(produto);
  }

  removerProduto(id: string) {
    if (!this.produtos.has(id)) {
      throw new CodigoErro("produto_nao_encontrado", "Produto nao encontrado.");
    }
    this.produtos.delete(id);
    return { removido: true, id };
  }

  calcularValorTotalInventario() {
    const valor_por_categoria: Record<string, number> = {};

    for (const produto of this.produtos.values()) {
      valor_por_categoria[produto.categoria] = (valor_por_categoria[produto.categoria] ?? 0) + (produto.preco * produto.quantidade);
    }

    const total_geral = Object.values(valor_por_categoria).reduce((acc, valor) => acc + valor, 0);
    return { total_geral, valor_por_categoria };
  }
}

export const semaMedioFactory: FabricaApi = {
  nome: "SEMA MEDIO",
  criar() {
    return new EstoqueSemaMedio();
  },
};
