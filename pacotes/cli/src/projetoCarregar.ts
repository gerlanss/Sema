// SEMA-GOVERNED: sema.produto.governanca_ia.contexto, sema.produto.governanca_ia.drift.cache.modos
// Descrição: orquestra leitura de contratos, compilação e seleção de módulos do projeto.

import { stat } from 'node:fs/promises';
import path from 'node:path';
import { compilarProjeto, listarArquivosSema, type ResultadoCompilacaoProjetoModulo } from '@sema/nucleo';
import {
  canonicalizarContratosNoProjeto,
  carregarFechamentoContratosSema,
  carregarFontesContratos,
} from './projetoCatalogo.js';
import type {
  ConfiguracaoProjetoCarregada,
  ContextoProjetoCarregado,
  ModuloProjetoCarregado,
  OpcoesCarregarProjeto,
} from './projetoTipos.js';
import { carregarConfiguracaoProjeto, normalizarFonteLegado, normalizarModoAdocao } from './projetoConfig.js';
import { inferirFontesLegado } from './projetoLegado.js';
import type { FonteLegado } from './tipos.js';
import {
  inferirDiretoriosCodigo,
  listarArquivosDeOrigens,
  resolverBaseProjeto,
  resolverDiretoriosCodigoConfigurados,
  resolverEntradaPadrao,
  resolverOrigensProjeto,
  resolverRaizesLogicasCodigoSemCaminhada,
} from './projetoOrigens.js';

async function resolverDiretoriosCodigoSemCaminhada(
  baseProjeto: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<string[]> {
  const declarados = await resolverDiretoriosCodigoConfigurados(baseProjeto, configCarregada);
  return declarados.length > 0
    ? declarados
    : resolverRaizesLogicasCodigoSemCaminhada(baseProjeto);
}

function resolverFontesLegadoDeclaradas(
  configCarregada?: ConfiguracaoProjetoCarregada,
): FonteLegado[] {
  return [...new Set((configCarregada?.config.fontesLegado ?? [])
    .map((fonte) => normalizarFonteLegado(fonte))
    .filter((fonte): fonte is FonteLegado => Boolean(fonte)))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function carregarProjeto(
  entrada: string | undefined,
  cwd: string,
  opcoes: OpcoesCarregarProjeto = {},
): Promise<ContextoProjetoCarregado> {
  const entradaBase = entrada ? path.resolve(cwd, entrada) : cwd;
  const configCarregada = await carregarConfiguracaoProjeto(entradaBase);
  const entradaResolvida = entrada ? path.resolve(cwd, entrada) : await resolverEntradaPadrao(cwd, configCarregada);
  const baseProjeto = await resolverBaseProjeto(entradaResolvida, configCarregada);
  const infoEntrada = await stat(entradaResolvida);
  if (infoEntrada.isFile() && path.extname(entradaResolvida).toLowerCase() !== ".sema") {
    throw new Error(`Entrada de contrato precisa terminar em .sema: ${entradaResolvida}`);
  }
  const escopo = opcoes.escopo ?? (infoEntrada.isFile() ? "modulo" : "projeto");
  const carregarProjetoCompleto = !infoEntrada.isFile() || escopo === "projeto";
  const origensBase = infoEntrada.isFile()
    ? await resolverOrigensProjeto(baseProjeto, baseProjeto, configCarregada)
    : await resolverOrigensProjeto(baseProjeto, entradaResolvida, configCarregada);
  const origensProjeto = [...new Set([
    ...origensBase,
    ...(infoEntrada.isFile() ? [path.dirname(entradaResolvida)] : []),
  ].map((origem) => path.resolve(origem)))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const arquivosDescobertosSet = new Set(await listarArquivosDeOrigens(origensProjeto));
  if (infoEntrada.isFile()) {
    arquivosDescobertosSet.add(path.resolve(entradaResolvida));
  }
  const arquivosDescobertos = await canonicalizarContratosNoProjeto(
    baseProjeto,
    [...arquivosDescobertosSet],
  );
  const entradaContrato = infoEntrada.isFile()
    ? (await canonicalizarContratosNoProjeto(baseProjeto, [entradaResolvida]))[0]
    : undefined;
  // Escopos estreitos recebem apenas raizes logicas declaradas (ou a raiz local)
  // para que o planner decida o que pode ser tocado antes de qualquer caminhada.
  const adiarDescobertaCodigo = opcoes.adiarDescobertaCodigo === true;
  const diretoriosCodigo = adiarDescobertaCodigo
    ? await resolverDiretoriosCodigoSemCaminhada(baseProjeto, configCarregada)
    : await inferirDiretoriosCodigo(baseProjeto, configCarregada);
  const fontesLegado = adiarDescobertaCodigo
    ? resolverFontesLegadoDeclaradas(configCarregada)
    : await inferirFontesLegado(diretoriosCodigo, baseProjeto, configCarregada);
  const modoAdocao = normalizarModoAdocao(configCarregada?.config.modoAdocao);

  const arquivosSelecionados = carregarProjetoCompleto && escopo === "projeto"
    ? new Set(arquivosDescobertos.map((arquivo) => path.resolve(arquivo)))
    : infoEntrada.isFile()
    ? new Set([entradaContrato!])
    : new Set((
      configCarregada && path.resolve(entradaResolvida) === path.resolve(configCarregada.baseDiretorio)
        ? arquivosDescobertos
        : await listarArquivosSema(entradaResolvida)
    ).map((arquivo) => path.resolve(arquivo)));

  const fontes = carregarProjetoCompleto
    ? await carregarFontesContratos(arquivosDescobertos)
    : (await carregarFechamentoContratosSema([entradaContrato!], arquivosDescobertos)).fontes;

  const resultadoProjeto = compilarProjeto(fontes);
  const resultados = new Map<string, ResultadoCompilacaoProjetoModulo>(
    resultadoProjeto.modulos.map((modulo) => [path.resolve(modulo.caminho), modulo]),
  );
  const modulosCarregados: ModuloProjetoCarregado[] = fontes.map((fonte) => ({
    caminho: fonte.caminho,
    codigo: fonte.codigo,
    resultado: resultados.get(path.resolve(fonte.caminho))!,
  }));

  return {
    entradaResolvida,
    baseProjeto,
    configCarregada,
    arquivosProjeto: fontes.map((fonte) => fonte.caminho),
    arquivosDescobertos,
    origensProjeto,
    diretoriosCodigo,
    fontesLegado,
    modoAdocao,
    modulosCarregados,
    modulosSelecionados: modulosCarregados
      .filter((modulo) => arquivosSelecionados.has(path.resolve(modulo.caminho))),
  };
}
