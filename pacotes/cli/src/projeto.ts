import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import {
  compilarProjeto,
  lerArquivoTexto,
  listarArquivosSema,
  type ResultadoCompilacaoProjetoModulo,
} from "@sema/nucleo";
import type { EstruturaSaida } from "./tipos.js";
import type { AlvoGeracao, FrameworkGeracao } from "@sema/padroes";

export interface SemaConfigProjeto {
  origem?: string;
  origens?: string[];
  saida?: string;
  alvos?: AlvoGeracao[];
  alvoPadrao?: AlvoGeracao;
  modoEstrito?: boolean;
  estruturaSaida?: EstruturaSaida;
  framework?: FrameworkGeracao;
  diretoriosSaidaPorAlvo?: Partial<Record<AlvoGeracao, string>>;
  convencoesGeracaoPorProjeto?: "base" | "backend";
}

export interface ConfiguracaoProjetoCarregada {
  caminho: string;
  baseDiretorio: string;
  config: SemaConfigProjeto;
}

export interface ContextoProjetoCarregado {
  entradaResolvida: string;
  configCarregada?: ConfiguracaoProjetoCarregada;
  arquivosProjeto: string[];
  origensProjeto: string[];
  modulosSelecionados: Array<{
    caminho: string;
    codigo: string;
    resultado: ResultadoCompilacaoProjetoModulo;
  }>;
}

async function caminhoExiste(caminhoAlvo: string): Promise<boolean> {
  try {
    await stat(caminhoAlvo);
    return true;
  } catch {
    return false;
  }
}

export async function localizarConfiguracaoProjeto(entradaInicial: string): Promise<string | undefined> {
  let atual = path.resolve(entradaInicial);
  try {
    const info = await stat(atual);
    if (info.isFile()) {
      atual = path.dirname(atual);
    }
  } catch {
    atual = path.dirname(atual);
  }

  for (;;) {
    const candidato = path.join(atual, "sema.config.json");
    if (await caminhoExiste(candidato)) {
      return candidato;
    }
    const pai = path.dirname(atual);
    if (pai === atual) {
      return undefined;
    }
    atual = pai;
  }
}

export async function carregarConfiguracaoProjeto(entradaInicial: string): Promise<ConfiguracaoProjetoCarregada | undefined> {
  const caminhoConfig = await localizarConfiguracaoProjeto(entradaInicial);
  if (!caminhoConfig) {
    return undefined;
  }

  const conteudo = await readFile(caminhoConfig, "utf8");
  const config = JSON.parse(conteudo) as SemaConfigProjeto;
  return {
    caminho: caminhoConfig,
    baseDiretorio: path.dirname(caminhoConfig),
    config,
  };
}

export function normalizarEstruturaSaida(valor?: string): EstruturaSaida {
  if (valor === "modulos" || valor === "backend") {
    return valor;
  }
  return "flat";
}

export function normalizarFrameworkGeracao(valor?: string): FrameworkGeracao {
  if (valor === "nestjs" || valor === "fastapi") {
    return valor;
  }
  return "base";
}

function normalizarAlvo(valor?: string): AlvoGeracao | undefined {
  if (valor === "typescript" || valor === "python" || valor === "dart") {
    return valor;
  }
  return undefined;
}

function resolverEntradaPadrao(
  cwd: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): string {
  if (configCarregada) {
    return configCarregada.baseDiretorio;
  }
  return path.resolve(cwd, "exemplos");
}

async function listarArquivosDeOrigens(origens: string[]): Promise<string[]> {
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

function resolverOrigensProjeto(
  entradaResolvida: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): string[] {
  if (configCarregada) {
    const declaradas = configCarregada.config.origens ?? (configCarregada.config.origem ? [configCarregada.config.origem] : []);
    if (declaradas.length > 0) {
      return declaradas.map((origem) => path.resolve(configCarregada.baseDiretorio, origem));
    }
    return [configCarregada.baseDiretorio];
  }

  return [path.dirname(entradaResolvida)];
}

export async function carregarProjeto(
  entrada: string | undefined,
  cwd: string,
): Promise<ContextoProjetoCarregado> {
  const entradaBase = entrada ? path.resolve(cwd, entrada) : cwd;
  const configCarregada = await carregarConfiguracaoProjeto(entradaBase);
  const entradaResolvida = entrada ? path.resolve(cwd, entrada) : resolverEntradaPadrao(cwd, configCarregada);
  const infoEntrada = await stat(entradaResolvida);
  const origensProjeto = resolverOrigensProjeto(entradaResolvida, configCarregada);
  const arquivosProjeto = await listarArquivosDeOrigens(origensProjeto);

  const arquivosSelecionados = infoEntrada.isFile()
    ? new Set([path.resolve(entradaResolvida)])
    : new Set((await listarArquivosSema(entradaResolvida)).map((arquivo) => path.resolve(arquivo)));

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
    configCarregada,
    arquivosProjeto,
    origensProjeto,
    modulosSelecionados: fontes
      .filter((fonte) => arquivosSelecionados.has(path.resolve(fonte.caminho)))
      .map((fonte) => ({
        caminho: fonte.caminho,
        codigo: fonte.codigo,
        resultado: resultados.get(path.resolve(fonte.caminho))!,
      })),
  };
}

export function resolverAlvoPadrao(
  alvoExplicito: string | undefined,
  configCarregada?: ConfiguracaoProjetoCarregada,
): AlvoGeracao {
  return normalizarAlvo(alvoExplicito)
    ?? configCarregada?.config.alvoPadrao
    ?? configCarregada?.config.alvos?.[0]
    ?? "typescript";
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
  const alvos: AlvoGeracao[] = configCarregada?.config.alvos?.length
    ? configCarregada.config.alvos
    : ["typescript", "python"];
  return [...new Set(alvos)];
}
