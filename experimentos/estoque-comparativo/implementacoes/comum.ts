export const CATEGORIAS = ["ELETRONICOS", "ALIMENTOS", "LIMPEZA", "ESCRITORIO", "OUTROS"] as const;

export type CategoriaProduto = typeof CATEGORIAS[number];

export interface Produto {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  estoque_minimo: number;
  categoria: string;
}

export interface CriarProdutoInput {
  nome?: string;
  preco?: number;
  quantidade?: number;
  estoque_minimo?: number;
  categoria?: string;
}

export interface AtualizarProdutoInput {
  nome?: string;
  preco?: number;
  quantidade?: number;
  estoque_minimo?: number;
  categoria?: string;
}

export interface ListarProdutosInput {
  categoria?: string;
  apenas_estoque_baixo?: boolean;
}

export interface ListaProdutosResultado {
  items: Produto[];
  total: number;
}

export interface ValorInventarioResultado {
  total_geral: number;
  valor_por_categoria: Record<string, number>;
}

export interface EstoqueApi {
  criarProduto(input: CriarProdutoInput): Produto;
  listarProdutos(input?: ListarProdutosInput): ListaProdutosResultado;
  obterProduto(id: string): Produto;
  atualizarProduto(id: string, input: AtualizarProdutoInput): Produto;
  removerProduto(id: string): { removido: boolean; id: string };
  calcularValorTotalInventario(): ValorInventarioResultado;
}

export interface FabricaApi {
  nome: string;
  criar(): EstoqueApi;
}

export class CodigoErro extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
    this.name = "CodigoErro";
  }
}

export function gerarId(indice: number): string {
  return `prod_${String(indice).padStart(3, "0")}`;
}

export function copiarProduto(produto: Produto): Produto {
  return { ...produto };
}

export function ordenarProdutos(produtos: Produto[]): Produto[] {
  return [...produtos].sort((a, b) => a.id.localeCompare(b.id, "pt-BR"));
}
