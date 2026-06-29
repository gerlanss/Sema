// SEMA-GOVERNED: sema.geradores_codigo_governado
// Descricao: modulo particionado; consulte contratos/sema/geradores_codigo_governado.sema antes de editar.

import type { IrEntity, IrEnum, IrModulo, IrState, IrTask } from "@sema/nucleo";
import {
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
} from "@sema/padroes";

export function gerarEstilosEntity(entity: IrEntity): string {
  const nome = normalizarNomeParaSimbolo(entity.nome);
  return `.sema-entity[data-entity="${entity.nome}"] {
  border-left: 3px solid var(--sema-cor-entidade);
}
`;
}

export function gerarEstilosTask(task: IrTask): string {
  const erros = Object.keys(task.errors);
  const erroEstilos = erros.map((nomeErro) => `.sema-erro[data-erro="${nomeErro}"] {
  display: block;
  color: var(--sema-cor-erro-texto);
  background: var(--sema-cor-erro-fundo);
  border-left: 3px solid var(--sema-cor-erro);
  padding: 0.5rem 0.75rem;
  margin-top: 0.5rem;
  border-radius: var(--sema-raio);
  font-size: 0.875rem;
  animation: sema-surgir 0.3s ease;
}
`).join("\n");
  return erroEstilos;
}

export function gerarEstilosState(state: IrState): string {
  const estilos: string[] = [];
  for (const transicao of state.transicoes) {
    estilos.push(`.sema-estado-origem:has(+ .sema-estado-destino) { font-weight: 600; }`);
  }
  return estilos.join("\n");
}

export function gerarEstilosEnum(enumeracao: IrEnum): string {
  return enumeracao.valores.map((valor) => `.sema-select option[value="${valor}"] {
  color: var(--sema-cor-texto);
}
`).join("");
}

export function gerarCabecalhoSemaCss(modulo: IrModulo): string {
  return `/* SEMA-GOVERNED
 * Módulo de origem: ${modulo.nome}
 * Consulte o contrato .sema aplicável antes de editar este arquivo.
 * Rastreabilidade: outros contratos .sema podem governar este mesmo arquivo via vinculos.
 * Para IA fraca/média/forte: chame Sema, rode docs-impacto e drift antes de alterar código.
 * Descrição: CSS gerado para materializar o design system do contrato Sema.
 */
`;
}
