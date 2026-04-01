import {
  type atualizar_produtoEntrada,
  type atualizar_produtoSaida,
  type calcular_valor_total_inventarioSaida,
  type criar_produtoEntrada,
  type criar_produtoSaida,
  type listar_produtosEntrada,
  type listar_produtosSaida,
  type obter_produtoSaida,
  type remover_produtoSaida,
  validar_atualizar_produto,
  validar_calcular_valor_total_inventario,
  validar_criar_produto,
  validar_listar_produtos,
  validar_obter_produto,
  validar_remover_produto,
  verificar_garantias_atualizar_produto,
  verificar_garantias_calcular_valor_total_inventario,
  verificar_garantias_criar_produto,
  verificar_garantias_listar_produtos,
  verificar_garantias_obter_produto,
  verificar_garantias_remover_produto,
} from "../generated/experimentos/estoque/controle.ts";
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

function validarCategoria(categoria: string | undefined): void {
  if (!categoria || !CATEGORIAS.includes(categoria as (typeof CATEGORIAS)[number])) {
    throw new CodigoErro("entrada_invalida", "Categoria invalida.");
  }
}

function validarAtualizacaoSemantica(input: AtualizarProdutoInput): void {
  if (input.nome !== undefined && input.nome.trim() === "") {
    throw new CodigoErro("entrada_invalida", "Nome invalido.");
  }
  if (input.preco !== undefined && input.preco <= 0) {
    throw new CodigoErro("entrada_invalida", "Preco invalido.");
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
}

class EstoqueSemaAlto implements EstoqueApi {
  private produtos = new Map<string, Produto>();
  private sequencia = 1;

  criarProduto(input: CriarProdutoInput): Produto {
    try {
      validar_criar_produto(input as criar_produtoEntrada);
    } catch (erro) {
      throw new CodigoErro("entrada_invalida", erro instanceof Error ? erro.message : "Entrada invalida.");
    }

    validarCategoria(input.categoria);

    const produto: Produto = {
      id: gerarId(this.sequencia++),
      nome: input.nome!,
      preco: input.preco!,
      quantidade: input.quantidade!,
      estoque_minimo: input.estoque_minimo!,
      categoria: input.categoria!,
    };

    this.produtos.set(produto.id, produto);

    const saida: criar_produtoSaida = { produto };
    verificar_garantias_criar_produto(saida);
    return copiarProduto(produto);
  }

  listarProdutos(input: ListarProdutosInput = {}) {
    validar_listar_produtos(input as listar_produtosEntrada);

    let items = ordenarProdutos([...this.produtos.values()]);

    if (input.categoria) {
      items = items.filter((produto) => produto.categoria === input.categoria);
    }

    if (input.apenas_estoque_baixo) {
      items = items.filter((produto) => produto.quantidade <= produto.estoque_minimo);
    }

    const saida: listar_produtosSaida = {
      resultado: {
        items,
        total: items.length,
      } as never,
    };

    verificar_garantias_listar_produtos(saida);
    return { items: items.map(copiarProduto), total: items.length };
  }

  obterProduto(id: string): Produto {
    try {
      validar_obter_produto({ id });
    } catch (erro) {
      throw new CodigoErro("entrada_invalida", erro instanceof Error ? erro.message : "Id invalido.");
    }

    const produto = this.produtos.get(id);
    if (!produto) {
      throw new CodigoErro("produto_nao_encontrado", "Produto nao encontrado.");
    }

    const saida: obter_produtoSaida = { produto };
    verificar_garantias_obter_produto(saida);
    return copiarProduto(produto);
  }

  atualizarProduto(id: string, input: AtualizarProdutoInput): Produto {
    try {
      validar_atualizar_produto({ id, ...input } as atualizar_produtoEntrada);
      validarAtualizacaoSemantica(input);
    } catch (erro) {
      if (erro instanceof CodigoErro) {
        throw erro;
      }
      throw new CodigoErro("entrada_invalida", erro instanceof Error ? erro.message : "Entrada invalida.");
    }

    const atual = this.produtos.get(id);
    if (!atual) {
      throw new CodigoErro("produto_nao_encontrado", "Produto nao encontrado.");
    }

    const produto: Produto = {
      ...atual,
      ...input,
    };

    this.produtos.set(id, produto);
    const saida: atualizar_produtoSaida = { produto };
    verificar_garantias_atualizar_produto(saida);
    return copiarProduto(produto);
  }

  removerProduto(id: string) {
    try {
      validar_remover_produto({ id });
    } catch (erro) {
      throw new CodigoErro("entrada_invalida", erro instanceof Error ? erro.message : "Id invalido.");
    }

    if (!this.produtos.has(id)) {
      throw new CodigoErro("produto_nao_encontrado", "Produto nao encontrado.");
    }

    this.produtos.delete(id);
    const saida: remover_produtoSaida = { removido: true, id };
    verificar_garantias_remover_produto(saida);
    return { removido: true, id };
  }

  calcularValorTotalInventario() {
    validar_calcular_valor_total_inventario({});

    const valor_por_categoria: Record<string, number> = {};
    for (const produto of this.produtos.values()) {
      valor_por_categoria[produto.categoria] = (valor_por_categoria[produto.categoria] ?? 0) + (produto.preco * produto.quantidade);
    }
    const total_geral = Object.values(valor_por_categoria).reduce((acc, valor) => acc + valor, 0);

    const saida: calcular_valor_total_inventarioSaida = {
      resultado: {
        total_geral,
        valor_por_categoria,
      } as never,
    };
    verificar_garantias_calcular_valor_total_inventario(saida);
    return { total_geral, valor_por_categoria };
  }
}

export const semaAltoFactory: FabricaApi = {
  nome: "SEMA ALTO",
  criar() {
    return new EstoqueSemaAlto();
  },
};
