// SEMA-GOVERNED: sema.produto.distribuicao_global, sema.produto.distribuicao_global.transacao
// Descrição: propaga o fencing token ativo da transação sem criar ciclo com primitivas de filesystem.

import { AsyncLocalStorage } from "node:async_hooks";

export interface TokenLockDistribuicaoGlobal {
  homeReal: string;
  nonce: string;
  ativo: boolean;
  encerrado: boolean;
  confirmar: (homeReal: string) => Promise<void>;
}

const contexto = new AsyncLocalStorage<TokenLockDistribuicaoGlobal>();

export function tokenLockDistribuicaoGlobalAtual(): TokenLockDistribuicaoGlobal | undefined {
  return contexto.getStore();
}

export function executarComTokenLockDistribuicaoGlobal<T>(
  token: TokenLockDistribuicaoGlobal,
  operacao: () => Promise<T>,
): Promise<T> {
  return contexto.run(token, operacao);
}

export async function confirmarFencingLockDistribuicaoGlobal(homeReal: string): Promise<void> {
  const token = contexto.getStore();
  if (!token) return;
  await token.confirmar(homeReal);
}
