// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descrição: resolve base, origens de contratos e diret?rios de c?digo do projeto.

import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { listarArquivosSema } from '@sema/nucleo';
import type { ConfiguracaoProjetoCarregada } from './projetoTipos.js';
import {
  caminhoExiste,
  DIRETORIOS_CODIGO_IGNORADOS,
  EXTENSOES_CODIGO,
  listarDiretoriosFilhos,
} from './projetoBusca.js';

const NOMES_ORIGEM_CONTRATO = new Set(["sema", "contratos", "contracts"]);

const DIRETORIOS_CODIGO_FIXOS = [
  "src",
  "app",
  "apps",
  "backend",
  "frontend",
  "client",
  "web",
  "lib",
  "packages",
  "pacotes",
  "api",
  "server",
  "services",
  "models",
  "data",
  "pipeline",
  "workers",
  "functions",
  "scripts",
];

export function resolverRaizesLogicasCodigoSemCaminhada(baseProjeto: string): string[] {
  return [path.resolve(baseProjeto), ...DIRETORIOS_CODIGO_FIXOS
    .map((segmento) => path.resolve(baseProjeto, segmento))];
}

function caminhoEstaDentro(raiz: string, alvo: string): boolean {
  const relativo = path.relative(path.resolve(raiz), path.resolve(alvo));
  return relativo === "" || (
    relativo !== ".."
    && !relativo.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativo)
  );
}

function erroEhAusencia(erro: unknown): boolean {
  return ["ENOENT", "ENOTDIR"].includes((erro as NodeJS.ErrnoException).code ?? "");
}

async function resolverDiretoriosConfiguradosConfinados(
  baseProjeto: string,
  baseConfiguracao: string,
  declarados: string[],
  campo: "diretoriosCodigo" | "origens",
): Promise<string[]> {
  const baseLogica = path.resolve(baseProjeto);
  const baseReal = await realpath(baseLogica);
  const resolvidos = new Map<string, string>();

  for (const [indice, declarado] of declarados.entries()) {
    const identificadorSeguro = `${campo}[${indice}]`;
    const absoluto = path.resolve(baseConfiguracao, declarado);
    if (!caminhoEstaDentro(baseLogica, absoluto)) {
      throw new Error(`${identificadorSeguro} aponta para fora da base do projeto`);
    }

    let canonico = absoluto;
    try {
      const [real, informacao] = await Promise.all([realpath(absoluto), stat(absoluto)]);
      if (!informacao.isDirectory()) {
        throw new Error(`${identificadorSeguro} nao e diretorio`);
      }
      if (!caminhoEstaDentro(baseReal, real)) {
        throw new Error(`${identificadorSeguro} resolve fora da base do projeto`);
      }
      canonico = real;
    } catch (erro) {
      if (!erroEhAusencia(erro)) {
        throw erro;
      }
    }

    const chave = process.platform === "win32" ? canonico.toLowerCase() : canonico;
    if (!resolvidos.has(chave)) {
      resolvidos.set(chave, canonico);
    }
  }

  return [...resolvidos.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function resolverDiretoriosCodigoConfigurados(
  baseProjeto: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<string[]> {
  const declarados = configCarregada?.config.diretoriosCodigo ?? [];
  if (declarados.length === 0) {
    return [];
  }

  return resolverDiretoriosConfiguradosConfinados(
    baseProjeto,
    configCarregada!.baseDiretorio,
    declarados,
    "diretoriosCodigo",
  );
}

export async function resolverEntradaPadrao(
  cwd: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<string> {
  if (configCarregada) {
    return configCarregada.baseDiretorio;
  }

  for (const nomeOrigem of NOMES_ORIGEM_CONTRATO) {
    const origem = path.join(cwd, nomeOrigem);
    if (await caminhoExiste(origem)) {
      return path.resolve(origem);
    }
  }

  try {
    const entradas = await readdir(cwd, { withFileTypes: true });
    if (entradas.some((entradaAtual) => entradaAtual.isFile() && entradaAtual.name.endsWith(".sema"))) {
      return path.resolve(cwd);
    }
  } catch {
    // Se o cwd nao puder ser lido, seguimos para os fallbacks.
  }

  const exemplos = path.resolve(cwd, "exemplos");
  if (await caminhoExiste(exemplos)) {
    return exemplos;
  }

  return path.resolve(cwd);
}

export async function listarArquivosDeOrigens(origens: string[]): Promise<string[]> {
  const encontrados = new Set<string>();
  for (const origem of origens) {
    if (!(await caminhoExiste(origem))) {
      continue;
    }
    const arquivos = await listarArquivosSema(origem);
    for (const arquivo of arquivos) {
      encontrados.add(path.resolve(arquivo));
    }
  }
  return [...encontrados].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function resolverBaseProjeto(
  entradaResolvida: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<string> {
  if (configCarregada) {
    return configCarregada.baseDiretorio;
  }

  const infoEntrada = await stat(entradaResolvida);
  const pontoPartida = path.resolve(infoEntrada.isDirectory() ? entradaResolvida : path.dirname(entradaResolvida));

  let atual = pontoPartida;
  for (;;) {
    if (NOMES_ORIGEM_CONTRATO.has(path.basename(atual).toLowerCase())) {
      const contemMarcadorRaiz = await caminhoExiste(path.join(atual, "package.json"))
        || await caminhoExiste(path.join(atual, "sema.config.json"));
      if (!contemMarcadorRaiz) {
        const pai = path.dirname(atual);
        if (pai !== atual) {
          return pai;
        }
      }
    }

    const pai = path.dirname(atual);
    if (pai === atual) {
      break;
    }
    atual = pai;
  }

  return pontoPartida;
}

async function descobrirOrigemPadrao(baseProjeto: string, entradaResolvida: string): Promise<string> {
  for (const nomeOrigem of NOMES_ORIGEM_CONTRATO) {
    const origemContratos = path.join(baseProjeto, nomeOrigem);
    if (await caminhoExiste(origemContratos)) {
      return path.resolve(origemContratos);
    }
  }

  const infoEntrada = await stat(entradaResolvida);
  if (infoEntrada.isFile()) {
    return path.resolve(path.dirname(entradaResolvida));
  }

  return path.resolve(baseProjeto);
}

export async function resolverOrigensProjeto(
  baseProjeto: string,
  entradaResolvida: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<string[]> {
  if (configCarregada) {
    const confinar = (origens: string[]): Promise<string[]> =>
      resolverDiretoriosConfiguradosConfinados(
        baseProjeto,
        configCarregada.baseDiretorio,
        origens,
        "origens",
      );
    const infoEntrada = await stat(entradaResolvida);
    if (infoEntrada.isFile()) {
      return confinar([path.dirname(entradaResolvida)]);
    }

    if (path.resolve(entradaResolvida) !== path.resolve(configCarregada.baseDiretorio)) {
      return confinar([entradaResolvida]);
    }

    const declaradas = configCarregada.config.origens ?? (configCarregada.config.origem ? [configCarregada.config.origem] : []);
    if (declaradas.length > 0) {
      return confinar(declaradas);
    }
    return confinar([configCarregada.baseDiretorio]);
  }

  const infoEntrada = await stat(entradaResolvida);
  if (infoEntrada.isFile()) {
    return [path.resolve(path.dirname(entradaResolvida))];
  }

  if (path.resolve(entradaResolvida) !== path.resolve(baseProjeto)) {
    return [path.resolve(entradaResolvida)];
  }

  return [await descobrirOrigemPadrao(baseProjeto, entradaResolvida)];
}

async function diretorioTemArquivosCodigo(diretorioBase: string, profundidadeMaxima = 4): Promise<boolean> {
  let entradas;
  try {
    entradas = await readdir(diretorioBase, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const entrada of entradas) {
    const caminhoEntrada = path.join(diretorioBase, entrada.name);
    if (entrada.isDirectory()) {
      if (profundidadeMaxima <= 0 || DIRETORIOS_CODIGO_IGNORADOS.has(entrada.name.toLowerCase())) {
        continue;
      }
      if (await diretorioTemArquivosCodigo(caminhoEntrada, profundidadeMaxima - 1)) {
        return true;
      }
      continue;
    }

    if (EXTENSOES_CODIGO.some((extensao) => entrada.name.toLowerCase().endsWith(extensao))) {
      return true;
    }
  }

  return false;
}

export async function inferirDiretoriosCodigo(
  baseProjeto: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<string[]> {

  if (configCarregada?.config.diretoriosCodigo?.length) {
    return resolverDiretoriosCodigoConfigurados(baseProjeto, configCarregada);
  }

  const candidatosFixos = DIRETORIOS_CODIGO_FIXOS
    .map((segmento) => path.join(baseProjeto, segmento));
  const existentes: string[] = [];
  for (const candidato of candidatosFixos) {
    if (await caminhoExiste(candidato) && await diretorioTemArquivosCodigo(candidato)) {
      existentes.push(path.resolve(candidato));
    }
  }

  const filhos = await listarDiretoriosFilhos(baseProjeto);
  const uteis: string[] = [];
  for (const diretorio of filhos) {
    const nome = path.basename(diretorio).toLowerCase();
    if (DIRETORIOS_CODIGO_IGNORADOS.has(nome)) {
      continue;
    }
    if (await diretorioTemArquivosCodigo(diretorio)) {
      uteis.push(path.resolve(diretorio));
    }
  }

  const combinados = [...new Set([...existentes, ...uteis])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (combinados.length > 0) {
    return combinados;
  }

  if (await diretorioTemArquivosCodigo(baseProjeto, 0)) {
    return [path.resolve(baseProjeto)];
  }

  return [];
}
