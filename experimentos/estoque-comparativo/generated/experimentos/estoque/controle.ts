// Arquivo gerado automaticamente pela Sema.
// Modulo de origem: experimentos.estoque.controle


export interface ListaProdutos {
  items?: Lista<Produto>;
  total?: number;
}

export interface ValorInventario {
  total_geral?: number;
  valor_por_categoria?: Mapa<Texto,Decimal>;
}

export interface Produto {
  id?: string;
  nome?: string;
  preco?: number;
  quantidade?: number;
  estoque_minimo?: number;
  categoria?: CategoriaProduto;
}

export type CategoriaProduto = "ELETRONICOS" | "ALIMENTOS" | "LIMPEZA" | "ESCRITORIO" | "OUTROS";



// Route criar_produto_publico: metodo=POST caminho=/produtos task=criar_produto input_publico=nome, preco, quantidade, estoque_minimo, categoria output_publico=produto erros_publicos=padrao_task effects_publicos=nenhum garantias_publicas=1
// Route listar_produtos_publico: metodo=GET caminho=/produtos task=listar_produtos input_publico=categoria, apenas_estoque_baixo output_publico=resultado erros_publicos=padrao_task effects_publicos=nenhum garantias_publicas=1
// Route obter_produto_publico: metodo=GET caminho=/produtos/{id} task=obter_produto input_publico=id output_publico=produto erros_publicos=padrao_task effects_publicos=nenhum garantias_publicas=1
// Route atualizar_produto_publico: metodo=PUT caminho=/produtos/{id} task=atualizar_produto input_publico=id, nome, preco, quantidade, estoque_minimo, categoria output_publico=produto erros_publicos=padrao_task effects_publicos=nenhum garantias_publicas=1
// Route remover_produto_publico: metodo=DELETE caminho=/produtos/{id} task=remover_produto input_publico=id output_publico=removido, id erros_publicos=padrao_task effects_publicos=nenhum garantias_publicas=2
// Route calcular_valor_total_inventario_publico: metodo=GET caminho=/produtos/inventario/valor-total task=calcular_valor_total_inventario input_publico=padrao_task output_publico=resultado erros_publicos=padrao_task effects_publicos=nenhum garantias_publicas=2

export interface criar_produtoEntrada {
  nome: string;
  preco: number;
  quantidade: number;
  estoque_minimo: number;
  categoria: CategoriaProduto;
}

export interface criar_produtoSaida {
  produto?: Produto;
}

export type criar_produtoErro = never;

export const contrato_criar_produto = {
  nome: "criar_produto",
  input: [
  { nome: "nome", tipo: "Texto", obrigatorio: true },
  { nome: "preco", tipo: "Decimal", obrigatorio: true },
  { nome: "quantidade", tipo: "Inteiro", obrigatorio: true },
  { nome: "estoque_minimo", tipo: "Inteiro", obrigatorio: true },
  { nome: "categoria", tipo: "CategoriaProduto", obrigatorio: true },
],
  output: [
  { nome: "produto", tipo: "Produto", obrigatorio: false },
],
  effects: [
  { categoria: "persistencia", alvo: "estoque", criticidade: "alta" },
  { categoria: "auditoria", alvo: "produto_criado", criticidade: "media" },
],
  impl: [],
  errors: {},
  guarantees: [
  "produto existe"
],
} as const;


export function validar_criar_produto(entrada: criar_produtoEntrada): void {
  if (entrada.nome === undefined || entrada.nome === null) throw new Error("Campo obrigatorio ausente: nome");
  if (entrada.preco === undefined || entrada.preco === null) throw new Error("Campo obrigatorio ausente: preco");
  if (entrada.quantidade === undefined || entrada.quantidade === null) throw new Error("Campo obrigatorio ausente: quantidade");
  if (entrada.estoque_minimo === undefined || entrada.estoque_minimo === null) throw new Error("Campo obrigatorio ausente: estoque_minimo");
  if (entrada.categoria === undefined || entrada.categoria === null) throw new Error("Campo obrigatorio ausente: categoria");
  if (!(entrada.nome !== undefined && entrada.nome !== null)) throw new Error("Regra violada: nome existe");
  if (!(entrada.preco > 0)) throw new Error("Regra violada: preco > 0");
  if (!(entrada.quantidade >= 0)) throw new Error("Regra violada: quantidade >= 0");
  if (!(entrada.estoque_minimo >= 0)) throw new Error("Regra violada: estoque_minimo >= 0");
  if (!(["ELETRONICOS", "ALIMENTOS", "LIMPEZA", "ESCRITORIO", "OUTROS"].includes(entrada.categoria))) throw new Error("Regra violada: categoria em [ ELETRONICOS , ALIMENTOS , LIMPEZA , ESCRITORIO , OUTROS ]");
}

export function verificar_garantias_criar_produto(saida: criar_produtoSaida): void {
  if (!(saida.produto !== undefined && saida.produto !== null)) throw new Error("Garantia violada: produto existe");
}


export async function executar_criar_produto(entrada: criar_produtoEntrada): Promise<criar_produtoSaida> {
  validar_criar_produto(entrada);



  // Efeitos declarados:
  // - categoria=persistencia alvo=estoque criticidade=alta
  // - categoria=auditoria alvo=produto_criado criticidade=media
  const saida = {
    produto: {} as any,
  } as criar_produtoSaida;

  verificar_garantias_criar_produto(saida);
  return saida;
}

export const criar_produto_entrada = {} as criar_produtoEntrada;
export const criar_produto_saida = {} as criar_produtoSaida;


export interface listar_produtosEntrada {
  categoria?: CategoriaProduto;
  apenas_estoque_baixo?: boolean;
}

export interface listar_produtosSaida {
  resultado?: ListaProdutos;
}

export type listar_produtosErro = never;

export const contrato_listar_produtos = {
  nome: "listar_produtos",
  input: [
  { nome: "categoria", tipo: "CategoriaProduto", obrigatorio: false },
  { nome: "apenas_estoque_baixo", tipo: "Booleano", obrigatorio: false },
],
  output: [
  { nome: "resultado", tipo: "ListaProdutos", obrigatorio: false },
],
  effects: [
  { categoria: "consulta", alvo: "estoque", criticidade: "baixa" },
],
  impl: [],
  errors: {},
  guarantees: [
  "resultado existe"
],
} as const;


export function validar_listar_produtos(entrada: listar_produtosEntrada): void {

}

export function verificar_garantias_listar_produtos(saida: listar_produtosSaida): void {
  if (!(saida.resultado !== undefined && saida.resultado !== null)) throw new Error("Garantia violada: resultado existe");
}


export async function executar_listar_produtos(entrada: listar_produtosEntrada): Promise<listar_produtosSaida> {
  validar_listar_produtos(entrada);



  // Efeitos declarados:
  // - categoria=consulta alvo=estoque criticidade=baixa
  const saida = {
    resultado: {} as any,
  } as listar_produtosSaida;

  verificar_garantias_listar_produtos(saida);
  return saida;
}

export const listar_produtos_entrada = {} as listar_produtosEntrada;
export const listar_produtos_saida = {} as listar_produtosSaida;


export interface obter_produtoEntrada {
  id: string;
}

export interface obter_produtoSaida {
  produto?: Produto;
}

export type obter_produtoErro = never;

export const contrato_obter_produto = {
  nome: "obter_produto",
  input: [
  { nome: "id", tipo: "Id", obrigatorio: true },
],
  output: [
  { nome: "produto", tipo: "Produto", obrigatorio: false },
],
  effects: [],
  impl: [],
  errors: {},
  guarantees: [
  "produto existe"
],
} as const;


export function validar_obter_produto(entrada: obter_produtoEntrada): void {
  if (entrada.id === undefined || entrada.id === null) throw new Error("Campo obrigatorio ausente: id");
}

export function verificar_garantias_obter_produto(saida: obter_produtoSaida): void {
  if (!(saida.produto !== undefined && saida.produto !== null)) throw new Error("Garantia violada: produto existe");
}


export async function executar_obter_produto(entrada: obter_produtoEntrada): Promise<obter_produtoSaida> {
  validar_obter_produto(entrada);



  // Efeitos declarados:
  // - Nenhum efeito declarado.
  const saida = {
    produto: {} as any,
  } as obter_produtoSaida;

  verificar_garantias_obter_produto(saida);
  return saida;
}

export const obter_produto_entrada = {} as obter_produtoEntrada;
export const obter_produto_saida = {} as obter_produtoSaida;


export interface atualizar_produtoEntrada {
  id: string;
  nome?: string;
  preco?: number;
  quantidade?: number;
  estoque_minimo?: number;
  categoria?: CategoriaProduto;
}

export interface atualizar_produtoSaida {
  produto?: Produto;
}

export type atualizar_produtoErro = never;

export const contrato_atualizar_produto = {
  nome: "atualizar_produto",
  input: [
  { nome: "id", tipo: "Id", obrigatorio: true },
  { nome: "nome", tipo: "Texto", obrigatorio: false },
  { nome: "preco", tipo: "Decimal", obrigatorio: false },
  { nome: "quantidade", tipo: "Inteiro", obrigatorio: false },
  { nome: "estoque_minimo", tipo: "Inteiro", obrigatorio: false },
  { nome: "categoria", tipo: "CategoriaProduto", obrigatorio: false },
],
  output: [
  { nome: "produto", tipo: "Produto", obrigatorio: false },
],
  effects: [
  { categoria: "persistencia", alvo: "estoque", criticidade: "alta" },
  { categoria: "auditoria", alvo: "produto_atualizado", criticidade: "media" },
],
  impl: [],
  errors: {},
  guarantees: [
  "produto existe"
],
} as const;


export function validar_atualizar_produto(entrada: atualizar_produtoEntrada): void {
  if (entrada.id === undefined || entrada.id === null) throw new Error("Campo obrigatorio ausente: id");
  if (!(entrada.id !== undefined && entrada.id !== null)) throw new Error("Regra violada: id existe");
}

export function verificar_garantias_atualizar_produto(saida: atualizar_produtoSaida): void {
  if (!(saida.produto !== undefined && saida.produto !== null)) throw new Error("Garantia violada: produto existe");
}


export async function executar_atualizar_produto(entrada: atualizar_produtoEntrada): Promise<atualizar_produtoSaida> {
  validar_atualizar_produto(entrada);



  // Efeitos declarados:
  // - categoria=persistencia alvo=estoque criticidade=alta
  // - categoria=auditoria alvo=produto_atualizado criticidade=media
  const saida = {
    produto: {} as any,
  } as atualizar_produtoSaida;

  verificar_garantias_atualizar_produto(saida);
  return saida;
}

export const atualizar_produto_entrada = {} as atualizar_produtoEntrada;
export const atualizar_produto_saida = {} as atualizar_produtoSaida;


export interface remover_produtoEntrada {
  id: string;
}

export interface remover_produtoSaida {
  removido?: boolean;
  id?: string;
}

export type remover_produtoErro = never;

export const contrato_remover_produto = {
  nome: "remover_produto",
  input: [
  { nome: "id", tipo: "Id", obrigatorio: true },
],
  output: [
  { nome: "removido", tipo: "Booleano", obrigatorio: false },
  { nome: "id", tipo: "Id", obrigatorio: false },
],
  effects: [
  { categoria: "persistencia", alvo: "estoque", criticidade: "alta" },
  { categoria: "auditoria", alvo: "produto_removido", criticidade: "media" },
],
  impl: [],
  errors: {},
  guarantees: [
  "removido == verdadeiro",
  "id existe"
],
} as const;


export function validar_remover_produto(entrada: remover_produtoEntrada): void {
  if (entrada.id === undefined || entrada.id === null) throw new Error("Campo obrigatorio ausente: id");
}

export function verificar_garantias_remover_produto(saida: remover_produtoSaida): void {
  if (!(saida.removido == true)) throw new Error("Garantia violada: removido == verdadeiro");
  if (!(saida.id !== undefined && saida.id !== null)) throw new Error("Garantia violada: id existe");
}


export async function executar_remover_produto(entrada: remover_produtoEntrada): Promise<remover_produtoSaida> {
  validar_remover_produto(entrada);



  // Efeitos declarados:
  // - categoria=persistencia alvo=estoque criticidade=alta
  // - categoria=auditoria alvo=produto_removido criticidade=media
  const saida = {
    removido: false,
    id: "id_exemplo",
  } as remover_produtoSaida;
  saida.removido = true as any;
  verificar_garantias_remover_produto(saida);
  return saida;
}

export const remover_produto_entrada = {} as remover_produtoEntrada;
export const remover_produto_saida = {} as remover_produtoSaida;


export interface calcular_valor_total_inventarioEntrada {
  // Sem campos declarados.

}

export interface calcular_valor_total_inventarioSaida {
  resultado?: ValorInventario;
}

export type calcular_valor_total_inventarioErro = never;

export const contrato_calcular_valor_total_inventario = {
  nome: "calcular_valor_total_inventario",
  input: [],
  output: [
  { nome: "resultado", tipo: "ValorInventario", obrigatorio: false },
],
  effects: [
  { categoria: "consulta", alvo: "estoque", criticidade: "baixa" },
  { categoria: "auditoria", alvo: "valor_inventario_consultado", criticidade: "baixa" },
],
  impl: [],
  errors: {},
  guarantees: [
  "resultado existe",
  "resultado.total_geral >= 0"
],
} as const;


export function validar_calcular_valor_total_inventario(entrada: calcular_valor_total_inventarioEntrada): void {

}

export function verificar_garantias_calcular_valor_total_inventario(saida: calcular_valor_total_inventarioSaida): void {
  if (!(saida.resultado !== undefined && saida.resultado !== null)) throw new Error("Garantia violada: resultado existe");
  if (!(saida.resultado.total_geral >= 0)) throw new Error("Garantia violada: resultado.total_geral >= 0");
}


export async function executar_calcular_valor_total_inventario(entrada: calcular_valor_total_inventarioEntrada): Promise<calcular_valor_total_inventarioSaida> {
  validar_calcular_valor_total_inventario(entrada);



  // Efeitos declarados:
  // - categoria=consulta alvo=estoque criticidade=baixa
  // - categoria=auditoria alvo=valor_inventario_consultado criticidade=baixa
  const saida = {
    resultado: {} as any,
  } as calcular_valor_total_inventarioSaida;
  saida.resultado.total_geral = 0 as any;
  verificar_garantias_calcular_valor_total_inventario(saida);
  return saida;
}

export const calcular_valor_total_inventario_entrada = {} as calcular_valor_total_inventarioEntrada;
export const calcular_valor_total_inventario_saida = {} as calcular_valor_total_inventarioSaida;


export interface criar_produto_publicoEntradaPublica {
  nome: string;
  preco: number;
  quantidade: number;
  estoque_minimo: number;
  categoria: CategoriaProduto;
}

export interface criar_produto_publicoSaidaPublica {
  produto?: Produto;
}

export type criar_produto_publicoErroPublico = never;
export type criar_produto_publicoRespostaPublica =
  | { sucesso: true; dados: criar_produto_publicoSaidaPublica }
  | { sucesso: false; erro: { codigo: criar_produto_publicoErroPublico; mensagem: string } };

export const contrato_publico_criar_produto_publico = {
  nome: "criar_produto_publico",
  metodo: "POST",
  caminho: "/produtos",
  task: "criar_produto",
  input: [
  { nome: "nome", tipo: "Texto", obrigatorio: true },
  { nome: "preco", tipo: "Decimal", obrigatorio: true },
  { nome: "quantidade", tipo: "Inteiro", obrigatorio: true },
  { nome: "estoque_minimo", tipo: "Inteiro", obrigatorio: true },
  { nome: "categoria", tipo: "CategoriaProduto", obrigatorio: true },
],
  output: [
  { nome: "produto", tipo: "Produto", obrigatorio: false },
],
  effects: [],
  guarantees: [
  "produto existe"
],
  errors: [],
} as const;

export function verificar_resposta_publica_criar_produto_publico(dados: criar_produto_publicoSaidaPublica): void {
  // Campo publico opcional: produto
}

export async function adaptar_criar_produto_publico(requisicao: criar_produto_publicoEntradaPublica): Promise<criar_produto_publicoRespostaPublica> {
  try {
    const saida = await executar_criar_produto(requisicao as criar_produtoEntrada);
    const dados = {
      produto: saida.produto,
    } as criar_produto_publicoSaidaPublica;
    verificar_resposta_publica_criar_produto_publico(dados);
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
    throw erro;
    throw erro;
  }
}


export interface listar_produtos_publicoEntradaPublica {
  categoria?: CategoriaProduto;
  apenas_estoque_baixo?: boolean;
}

export interface listar_produtos_publicoSaidaPublica {
  resultado?: ListaProdutos;
}

export type listar_produtos_publicoErroPublico = never;
export type listar_produtos_publicoRespostaPublica =
  | { sucesso: true; dados: listar_produtos_publicoSaidaPublica }
  | { sucesso: false; erro: { codigo: listar_produtos_publicoErroPublico; mensagem: string } };

export const contrato_publico_listar_produtos_publico = {
  nome: "listar_produtos_publico",
  metodo: "GET",
  caminho: "/produtos",
  task: "listar_produtos",
  input: [
  { nome: "categoria", tipo: "CategoriaProduto", obrigatorio: false },
  { nome: "apenas_estoque_baixo", tipo: "Booleano", obrigatorio: false },
],
  output: [
  { nome: "resultado", tipo: "ListaProdutos", obrigatorio: false },
],
  effects: [],
  guarantees: [
  "resultado existe"
],
  errors: [],
} as const;

export function verificar_resposta_publica_listar_produtos_publico(dados: listar_produtos_publicoSaidaPublica): void {
  // Campo publico opcional: resultado
}

export async function adaptar_listar_produtos_publico(requisicao: listar_produtos_publicoEntradaPublica): Promise<listar_produtos_publicoRespostaPublica> {
  try {
    const saida = await executar_listar_produtos(requisicao as listar_produtosEntrada);
    const dados = {
      resultado: saida.resultado,
    } as listar_produtos_publicoSaidaPublica;
    verificar_resposta_publica_listar_produtos_publico(dados);
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
    throw erro;
    throw erro;
  }
}


export interface obter_produto_publicoEntradaPublica {
  id: string;
}

export interface obter_produto_publicoSaidaPublica {
  produto?: Produto;
}

export type obter_produto_publicoErroPublico = never;
export type obter_produto_publicoRespostaPublica =
  | { sucesso: true; dados: obter_produto_publicoSaidaPublica }
  | { sucesso: false; erro: { codigo: obter_produto_publicoErroPublico; mensagem: string } };

export const contrato_publico_obter_produto_publico = {
  nome: "obter_produto_publico",
  metodo: "GET",
  caminho: "/produtos/{id}",
  task: "obter_produto",
  input: [
  { nome: "id", tipo: "Id", obrigatorio: true },
],
  output: [
  { nome: "produto", tipo: "Produto", obrigatorio: false },
],
  effects: [],
  guarantees: [
  "produto existe"
],
  errors: [],
} as const;

export function verificar_resposta_publica_obter_produto_publico(dados: obter_produto_publicoSaidaPublica): void {
  // Campo publico opcional: produto
}

export async function adaptar_obter_produto_publico(requisicao: obter_produto_publicoEntradaPublica): Promise<obter_produto_publicoRespostaPublica> {
  try {
    const saida = await executar_obter_produto(requisicao as obter_produtoEntrada);
    const dados = {
      produto: saida.produto,
    } as obter_produto_publicoSaidaPublica;
    verificar_resposta_publica_obter_produto_publico(dados);
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
    throw erro;
    throw erro;
  }
}


export interface atualizar_produto_publicoEntradaPublica {
  id: string;
  nome?: string;
  preco?: number;
  quantidade?: number;
  estoque_minimo?: number;
  categoria?: CategoriaProduto;
}

export interface atualizar_produto_publicoSaidaPublica {
  produto?: Produto;
}

export type atualizar_produto_publicoErroPublico = never;
export type atualizar_produto_publicoRespostaPublica =
  | { sucesso: true; dados: atualizar_produto_publicoSaidaPublica }
  | { sucesso: false; erro: { codigo: atualizar_produto_publicoErroPublico; mensagem: string } };

export const contrato_publico_atualizar_produto_publico = {
  nome: "atualizar_produto_publico",
  metodo: "PUT",
  caminho: "/produtos/{id}",
  task: "atualizar_produto",
  input: [
  { nome: "id", tipo: "Id", obrigatorio: true },
  { nome: "nome", tipo: "Texto", obrigatorio: false },
  { nome: "preco", tipo: "Decimal", obrigatorio: false },
  { nome: "quantidade", tipo: "Inteiro", obrigatorio: false },
  { nome: "estoque_minimo", tipo: "Inteiro", obrigatorio: false },
  { nome: "categoria", tipo: "CategoriaProduto", obrigatorio: false },
],
  output: [
  { nome: "produto", tipo: "Produto", obrigatorio: false },
],
  effects: [],
  guarantees: [
  "produto existe"
],
  errors: [],
} as const;

export function verificar_resposta_publica_atualizar_produto_publico(dados: atualizar_produto_publicoSaidaPublica): void {
  // Campo publico opcional: produto
}

export async function adaptar_atualizar_produto_publico(requisicao: atualizar_produto_publicoEntradaPublica): Promise<atualizar_produto_publicoRespostaPublica> {
  try {
    const saida = await executar_atualizar_produto(requisicao as atualizar_produtoEntrada);
    const dados = {
      produto: saida.produto,
    } as atualizar_produto_publicoSaidaPublica;
    verificar_resposta_publica_atualizar_produto_publico(dados);
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
    throw erro;
    throw erro;
  }
}


export interface remover_produto_publicoEntradaPublica {
  id: string;
}

export interface remover_produto_publicoSaidaPublica {
  removido?: boolean;
  id?: string;
}

export type remover_produto_publicoErroPublico = never;
export type remover_produto_publicoRespostaPublica =
  | { sucesso: true; dados: remover_produto_publicoSaidaPublica }
  | { sucesso: false; erro: { codigo: remover_produto_publicoErroPublico; mensagem: string } };

export const contrato_publico_remover_produto_publico = {
  nome: "remover_produto_publico",
  metodo: "DELETE",
  caminho: "/produtos/{id}",
  task: "remover_produto",
  input: [
  { nome: "id", tipo: "Id", obrigatorio: true },
],
  output: [
  { nome: "removido", tipo: "Booleano", obrigatorio: false },
  { nome: "id", tipo: "Id", obrigatorio: false },
],
  effects: [],
  guarantees: [
  "removido == verdadeiro",
  "id existe"
],
  errors: [],
} as const;

export function verificar_resposta_publica_remover_produto_publico(dados: remover_produto_publicoSaidaPublica): void {
  // Campo publico opcional: removido
  // Campo publico opcional: id
}

export async function adaptar_remover_produto_publico(requisicao: remover_produto_publicoEntradaPublica): Promise<remover_produto_publicoRespostaPublica> {
  try {
    const saida = await executar_remover_produto(requisicao as remover_produtoEntrada);
    const dados = {
      removido: saida.removido,
      id: saida.id,
    } as remover_produto_publicoSaidaPublica;
    verificar_resposta_publica_remover_produto_publico(dados);
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
    throw erro;
    throw erro;
  }
}


export interface calcular_valor_total_inventario_publicoEntradaPublica {
  // Sem campos declarados.

}

export interface calcular_valor_total_inventario_publicoSaidaPublica {
  resultado?: ValorInventario;
}

export type calcular_valor_total_inventario_publicoErroPublico = never;
export type calcular_valor_total_inventario_publicoRespostaPublica =
  | { sucesso: true; dados: calcular_valor_total_inventario_publicoSaidaPublica }
  | { sucesso: false; erro: { codigo: calcular_valor_total_inventario_publicoErroPublico; mensagem: string } };

export const contrato_publico_calcular_valor_total_inventario_publico = {
  nome: "calcular_valor_total_inventario_publico",
  metodo: "GET",
  caminho: "/produtos/inventario/valor-total",
  task: "calcular_valor_total_inventario",
  input: [],
  output: [
  { nome: "resultado", tipo: "ValorInventario", obrigatorio: false },
],
  effects: [],
  guarantees: [
  "resultado existe",
  "resultado.total_geral >= 0"
],
  errors: [],
} as const;

export function verificar_resposta_publica_calcular_valor_total_inventario_publico(dados: calcular_valor_total_inventario_publicoSaidaPublica): void {
  // Campo publico opcional: resultado
}

export async function adaptar_calcular_valor_total_inventario_publico(requisicao: calcular_valor_total_inventario_publicoEntradaPublica): Promise<calcular_valor_total_inventario_publicoRespostaPublica> {
  try {
    const saida = await executar_calcular_valor_total_inventario(requisicao as calcular_valor_total_inventarioEntrada);
    const dados = {
      resultado: saida.resultado,
    } as calcular_valor_total_inventario_publicoSaidaPublica;
    verificar_resposta_publica_calcular_valor_total_inventario_publico(dados);
    return {
      sucesso: true,
      dados,
    };
  } catch (erro) {
    throw erro;
    throw erro;
  }
}

