// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descrição: orquestra leitura de contratos, compila??o e sele??o de m?dulos do projeto.

import { stat } from 'node:fs/promises';
import path from 'node:path';
import { compilarProjeto, lerArquivoTexto, listarArquivosSema, type ResultadoCompilacaoProjetoModulo } from '@sema/nucleo';
import type { ContextoProjetoCarregado } from './projetoTipos.js';
import { carregarConfiguracaoProjeto, normalizarModoAdocao } from './projetoConfig.js';
import { inferirFontesLegado } from './projetoLegado.js';
import {
  inferirDiretoriosCodigo,
  listarArquivosDeOrigens,
  resolverBaseProjeto,
  resolverEntradaPadrao,
  resolverOrigensProjeto,
} from './projetoOrigens.js';

export async function carregarProjeto(
  entrada: string | undefined,
  cwd: string,
): Promise<ContextoProjetoCarregado> {
  const entradaBase = entrada ? path.resolve(cwd, entrada) : cwd;
  const configCarregada = await carregarConfiguracaoProjeto(entradaBase);
  const entradaResolvida = entrada ? path.resolve(cwd, entrada) : await resolverEntradaPadrao(cwd, configCarregada);
  const baseProjeto = await resolverBaseProjeto(entradaResolvida, configCarregada);
  const infoEntrada = await stat(entradaResolvida);
  const origensProjeto = await resolverOrigensProjeto(baseProjeto, entradaResolvida, configCarregada);
  const arquivosProjeto = await listarArquivosDeOrigens(origensProjeto);
  const diretoriosCodigo = await inferirDiretoriosCodigo(baseProjeto, configCarregada);
  const fontesLegado = await inferirFontesLegado(diretoriosCodigo, baseProjeto, configCarregada);
  const modoAdocao = normalizarModoAdocao(configCarregada?.config.modoAdocao);

  const arquivosSelecionados = infoEntrada.isFile()
    ? new Set([path.resolve(entradaResolvida)])
    : new Set((
      configCarregada && path.resolve(entradaResolvida) === path.resolve(configCarregada.baseDiretorio)
        ? arquivosProjeto
        : await listarArquivosSema(entradaResolvida)
    ).map((arquivo) => path.resolve(arquivo)));

  const fontes = [];
  for (const arquivo of arquivosProjeto) {
    const codigo = await lerArquivoTexto(arquivo);
    fontes.push({ caminho: arquivo, codigo });
  }

  const resultadoProjeto = compilarProjeto(fontes);
  const resultados = new Map<string, ResultadoCompilacaoProjetoModulo>(
    resultadoProjeto.modulos.map((modulo) => [path.resolve(modulo.caminho), modulo]),
  );

  return {
    entradaResolvida,
    baseProjeto,
    configCarregada,
    arquivosProjeto,
    origensProjeto,
    diretoriosCodigo,
    fontesLegado,
    modoAdocao,
    modulosSelecionados: fontes
      .filter((fonte) => arquivosSelecionados.has(path.resolve(fonte.caminho)))
      .map((fonte) => ({
        caminho: fonte.caminho,
        codigo: fonte.codigo,
        resultado: resultados.get(path.resolve(fonte.caminho))!,
      })),
  };
}
