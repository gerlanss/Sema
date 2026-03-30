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
  baseProjeto: string;
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

const DIRETORIOS_CODIGO_FIXOS = [
  "src",
  "app",
  "backend",
  "lib",
  "api",
  "server",
  "services",
  "models",
  "data",
  "pipeline",
  "scripts",
];

const DIRETORIOS_CODIGO_IGNORADOS = new Set([
  ".git",
  ".github",
  ".pytest_cache",
  ".tmp",
  ".venv",
  ".next",
  ".nuxt",
  ".dart_tool",
  "__pycache__",
  "build",
  "coverage",
  "deploy",
  "dist",
  "doc",
  "docs",
  "generated",
  "node_modules",
  "sema",
  "test",
  "tests",
  "venv",
]);

const EXTENSOES_CODIGO = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".dart"];

async function resolverBaseProjeto(
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
    if (path.basename(atual).toLowerCase() === "sema") {
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
  const origemContratos = path.join(baseProjeto, "sema");
  if (await caminhoExiste(origemContratos)) {
    return path.resolve(origemContratos);
  }

  const infoEntrada = await stat(entradaResolvida);
  if (infoEntrada.isFile()) {
    return path.resolve(path.dirname(entradaResolvida));
  }

  return path.resolve(baseProjeto);
}

async function resolverOrigensProjeto(
  baseProjeto: string,
  entradaResolvida: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<string[]> {
  if (configCarregada) {
    const declaradas = configCarregada.config.origens ?? (configCarregada.config.origem ? [configCarregada.config.origem] : []);
    if (declaradas.length > 0) {
      return declaradas.map((origem) => path.resolve(configCarregada.baseDiretorio, origem));
    }
    return [configCarregada.baseDiretorio];
  }

  return [await descobrirOrigemPadrao(baseProjeto, entradaResolvida)];
}

async function diretorioTemArquivosCodigo(diretorioBase: string, profundidadeMaxima = 2): Promise<boolean> {
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

async function inferirDiretoriosCodigo(
  baseProjeto: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<string[]> {

  if (configCarregada?.config.diretoriosCodigo?.length) {
    return [...new Set(configCarregada.config.diretoriosCodigo
      .map((diretorio) => path.resolve(configCarregada.baseDiretorio, diretorio))
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
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

async function inferirFontesLegado(
  diretoriosCodigo: string[],
  baseProjeto: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<FonteLegado[]> {
  if (configCarregada?.config.fontesLegado?.length) {
    return [...new Set(configCarregada.config.fontesLegado
      .map((fonte) => normalizarFonteLegado(fonte))
      .filter((fonte): fonte is FonteLegado => Boolean(fonte)))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  const encontrados = new Set<FonteLegado>();
  const packageJson = await lerConteudoSeExistir(path.join(baseProjeto, "package.json"));
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
  const baseProjeto = await resolverBaseProjeto(entradaResolvida, configCarregada);
  const infoEntrada = await stat(entradaResolvida);
  const origensProjeto = await resolverOrigensProjeto(baseProjeto, entradaResolvida, configCarregada);
  const arquivosProjeto = await listarArquivosDeOrigens(origensProjeto);
  const diretoriosCodigo = await inferirDiretoriosCodigo(baseProjeto, configCarregada);
  const fontesLegado = await inferirFontesLegado(diretoriosCodigo, baseProjeto, configCarregada);
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
