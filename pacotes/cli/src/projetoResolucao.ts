// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descrição: resolve alvo, framework, estrutura e diret?rios de sa?da para gera??o/verifica??o.

import path from 'node:path';
import type { AlvoGeracao, FrameworkGeracao } from '@sema/padroes';
import type { EstruturaSaida } from './tipos.js';
import type { ConfiguracaoProjetoCarregada } from './projetoTipos.js';
import { normalizarAlvo, normalizarEstruturaSaida, normalizarFrameworkGeracao } from './projetoConfig.js';

function normalizarAlvoObrigatorio(valor: string, origem: string): AlvoGeracao {
  const normalizado = normalizarAlvo(valor);
  if (!normalizado) {
    throw new Error(`Alvo de geração inválido em ${origem}: ${valor}`);
  }
  return normalizado;
}

export function resolverAlvoPadrao(
  alvoExplicito: string | undefined,
  configCarregada?: ConfiguracaoProjetoCarregada,
): AlvoGeracao {
  if (alvoExplicito !== undefined) {
    return normalizarAlvoObrigatorio(alvoExplicito, "--alvo");
  }
  if (configCarregada?.config.alvoPadrao !== undefined) {
    return normalizarAlvoObrigatorio(configCarregada.config.alvoPadrao, `alvoPadrao de ${configCarregada.caminho}`);
  }
  const primeiroAlvo = configCarregada?.config.alvos?.[0];
  return primeiroAlvo !== undefined
    ? normalizarAlvoObrigatorio(primeiroAlvo, `alvos[0] de ${configCarregada!.caminho}`)
    : "typescript";
}

export function resolverFrameworkPadrao(
  frameworkExplicito: string | undefined,
  configCarregada?: ConfiguracaoProjetoCarregada,
): FrameworkGeracao {
  return normalizarFrameworkGeracao(frameworkExplicito ?? configCarregada?.config.framework);
}

export function resolverEstruturaSaidaPadrao(
  estruturaExplicita: string | undefined,
  framework: FrameworkGeracao,
  configCarregada?: ConfiguracaoProjetoCarregada,
): EstruturaSaida {
  const estrutura = normalizarEstruturaSaida(estruturaExplicita ?? configCarregada?.config.estruturaSaida);
  if (!estruturaExplicita && !configCarregada?.config.estruturaSaida && framework !== "base") {
    return "backend";
  }
  if (estrutura === "backend" && framework === "base") {
    return "modulos";
  }
  return estrutura;
}

export function resolverSaidaPadrao(
  saidaExplicita: string | undefined,
  alvo: AlvoGeracao,
  configCarregada?: ConfiguracaoProjetoCarregada,
): string {
  if (saidaExplicita) {
    return path.resolve(saidaExplicita);
  }

  const diretorioPorAlvo = configCarregada?.config.diretoriosSaidaPorAlvo?.[alvo];
  if (diretorioPorAlvo && configCarregada) {
    return path.resolve(configCarregada.baseDiretorio, diretorioPorAlvo);
  }

  if (configCarregada?.config.saida) {
    return path.resolve(configCarregada.baseDiretorio, configCarregada.config.saida);
  }

  return path.resolve("./saida");
}

export function resolverAlvosVerificacao(configCarregada?: ConfiguracaoProjetoCarregada): AlvoGeracao[] {
  const configurados = configCarregada?.config.alvos;
  const origemConfig = configCarregada?.caminho ?? "sema.config.json";
  const alvos: AlvoGeracao[] = configurados?.length
    ? configurados.map((alvo, indice) => normalizarAlvoObrigatorio(alvo, `alvos[${indice}] de ${origemConfig}`))
    : ["typescript", "python"];
  return [...new Set(alvos)];
}
