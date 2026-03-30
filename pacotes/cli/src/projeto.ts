import { stat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  compilarProjeto,
  lerArquivoTexto,
  listarArquivosSema,
  type ResultadoCompilacaoProjetoModulo,
} from "@sema/nucleo";
import type { EstruturaSaida, FonteLegado, ModoAdocao } from "./tipos.js";
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
  diretoriosCodigo?: string[];
  fontesLegado?: FonteLegado[];
  modoAdocao?: ModoAdocao;
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
  diretoriosCodigo: string[];
  fontesLegado: FonteLegado[];
  modoAdocao: ModoAdocao;
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

function normalizarFonteLegado(valor: string): FonteLegado | undefined {
  if (valor === "nestjs" || valor === "fastapi" || valor === "typescript" || valor === "python" || valor === "dart") {
    return valor;
  }
  return undefined;
}

function normalizarModoAdocao(valor?: string): ModoAdocao {
  return valor === "incremental" ? valor : "incremental";
}

async function lerConteudoSeExistir(caminhoAlvo: string): Promise<string | undefined> {
  try {
    return await readFile(caminhoAlvo, "utf8");
  } catch {
    return undefined;
  }
}

async function listarDiretoriosFilhos(diretorioBase: string): Promise<string[]> {
  try {
    const entradas = await readdir(diretorioBase, { withFileTypes: true });
    return entradas
      .filter((entrada) => entrada.isDirectory())
      .map((entrada) => path.join(diretorioBase, entrada.name));
  } catch {
    return [];
  }
}

async function inferirDiretoriosCodigo(
  entradaResolvida: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<string[]> {
  const infoEntrada = await stat(entradaResolvida);
  const baseProjeto = configCarregada?.baseDiretorio
    ?? (infoEntrada.isDirectory() ? entradaResolvida : path.dirname(entradaResolvida));

  if (configCarregada?.config.diretoriosCodigo?.length) {
    return [...new Set(configCarregada.config.diretoriosCodigo
      .map((diretorio) => path.resolve(configCarregada.baseDiretorio, diretorio))
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  const candidatosFixos = ["src", "app", "backend", "lib"]
    .map((segmento) => path.join(baseProjeto, segmento));
  const existentes = [];
  for (const candidato of candidatosFixos) {
    if (await caminhoExiste(candidato)) {
      existentes.push(path.resolve(candidato));
    }
  }

  if (existentes.length > 0) {
    return [...new Set(existentes)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  const filhos = await listarDiretoriosFilhos(baseProjeto);
  const uteis = filhos.filter((diretorio) => ![".git", "node_modules", "dist", "build", ".tmp", "generated"].includes(path.basename(diretorio).toLowerCase()));
  return uteis.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function inferirFontesLegado(
  diretoriosCodigo: string[],
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<FonteLegado[]> {
  if (configCarregada?.config.fontesLegado?.length) {
    return [...new Set(configCarregada.config.fontesLegado
      .map((fonte) => normalizarFonteLegado(fonte))
      .filter((fonte): fonte is FonteLegado => Boolean(fonte)))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  const encontrados = new Set<FonteLegado>();
  const baseProjeto = configCarregada?.baseDiretorio;
  const packageJson = baseProjeto ? await lerConteudoSeExistir(path.join(baseProjeto, "package.json")) : undefined;
  if (packageJson) {
    if (/@nestjs\/common|@nestjs\/core/.test(packageJson)) {
      encontrados.add("nestjs");
    }
    if (/typescript/.test(packageJson)) {
      encontrados.add("typescript");
    }
  }

  for (const diretorio of diretoriosCodigo) {
    const arquivos = await readdir(diretorio, { withFileTypes: true }).catch(() => []);
    const nomes = arquivos.map((arquivo) => arquivo.name.toLowerCase());
    if (nomes.some((nome) => nome.endsWith(".ts"))) {
      encontrados.add(packageJson && /@nestjs\/common|@nestjs\/core/.test(packageJson) ? "nestjs" : "typescript");
    }
    if (nomes.some((nome) => nome.endsWith(".py"))) {
      const algumPy = await Promise.all(
        arquivos
          .filter((arquivo) => arquivo.isFile() && arquivo.name.toLowerCase().endsWith(".py"))
          .slice(0, 5)
          .map((arquivo) => lerConteudoSeExistir(path.join(diretorio, arquivo.name))),
      );
      if (algumPy.some((texto) => /from\s+fastapi\s+import|APIRouter|FastAPI/.test(texto ?? ""))) {
        encontrados.add("fastapi");
      } else {
        encontrados.add("python");
      }
    }
    if (nomes.some((nome) => nome.endsWith(".dart"))) {
      encontrados.add("dart");
    }
  }

  return [...encontrados].sort((a, b) => a.localeCompare(b, "pt-BR"));
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
  const diretoriosCodigo = await inferirDiretoriosCodigo(entradaResolvida, configCarregada);
  const fontesLegado = await inferirFontesLegado(diretoriosCodigo, configCarregada);
  const modoAdocao = normalizarModoAdocao(configCarregada?.config.modoAdocao);

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
