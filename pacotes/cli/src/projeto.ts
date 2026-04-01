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
  if (
    valor === "nestjs"
    || valor === "fastapi"
    || valor === "flask"
    || valor === "nextjs"
    || valor === "nextjs-consumer"
    || valor === "react-vite-consumer"
    || valor === "angular-consumer"
    || valor === "flutter-consumer"
    || valor === "firebase"
    || valor === "typescript"
    || valor === "python"
    || valor === "dart"
    || valor === "dotnet"
    || valor === "java"
    || valor === "go"
    || valor === "rust"
    || valor === "cpp"
  ) {
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

async function listarArquivosRecursivosLimitado(
  diretorioBase: string,
  extensoes: string[],
  profundidadeMaxima = 4,
  limite = 40,
): Promise<string[]> {
  const encontrados: string[] = [];

  const visitar = async (diretorioAtual: string, profundidadeAtual: number): Promise<void> => {
    if (encontrados.length >= limite) {
      return;
    }

    let entradas;
    try {
      entradas = await readdir(diretorioAtual, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entrada of entradas) {
      if (encontrados.length >= limite) {
        return;
      }

      const caminhoAtual = path.join(diretorioAtual, entrada.name);
      if (entrada.isDirectory()) {
        if (profundidadeAtual <= 0 || DIRETORIOS_CODIGO_IGNORADOS.has(entrada.name.toLowerCase())) {
          continue;
        }
        await visitar(caminhoAtual, profundidadeAtual - 1);
        continue;
      }

      if (extensoes.some((extensao) => entrada.name.toLowerCase().endsWith(extensao))) {
        encontrados.push(caminhoAtual);
      }
    }
  };

  await visitar(diretorioBase, profundidadeMaxima);
  return encontrados;
}

async function procurarArquivosPorNome(
  diretorioBase: string,
  nomes: string[],
  profundidadeMaxima = 4,
): Promise<string[]> {
  const nomesNormalizados = new Set(nomes.map((nome) => nome.toLowerCase()));
  const encontrados: string[] = [];

  const visitar = async (diretorioAtual: string, profundidadeAtual: number): Promise<void> => {
    let entradas;
    try {
      entradas = await readdir(diretorioAtual, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entrada of entradas) {
      const caminhoAtual = path.join(diretorioAtual, entrada.name);
      if (entrada.isDirectory()) {
        if (profundidadeAtual <= 0 || DIRETORIOS_CODIGO_IGNORADOS.has(entrada.name.toLowerCase())) {
          continue;
        }
        await visitar(caminhoAtual, profundidadeAtual - 1);
        continue;
      }

      if (nomesNormalizados.has(entrada.name.toLowerCase())) {
        encontrados.push(caminhoAtual);
      }
    }
  };

  await visitar(diretorioBase, profundidadeMaxima);
  return encontrados;
}

const DIRETORIOS_CODIGO_FIXOS = [
  "src",
  "app",
  "apps",
  "backend",
  "lib",
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

const DIRETORIOS_CODIGO_IGNORADOS = new Set([
  ".git",
  ".github",
  ".pytest_cache",
  ".tmp",
  ".turbo",
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
  "ephemeral",
  "sema",
  "test",
  "tests",
  "vendor",
  "venv",
]);

const EXTENSOES_CODIGO = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".dart",
  ".cs",
  ".java",
  ".go",
  ".rs",
  ".cpp",
  ".cc",
  ".cxx",
  ".hpp",
  ".h",
];
const NOMES_ORIGEM_CONTRATO = new Set(["sema", "contratos", "contracts"]);

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

async function resolverOrigensProjeto(
  baseProjeto: string,
  entradaResolvida: string,
  configCarregada?: ConfiguracaoProjetoCarregada,
): Promise<string[]> {
  if (configCarregada) {
    const infoEntrada = await stat(entradaResolvida);
    if (infoEntrada.isFile()) {
      return [path.resolve(path.dirname(entradaResolvida))];
    }

    if (path.resolve(entradaResolvida) !== path.resolve(configCarregada.baseDiretorio)) {
      return [path.resolve(entradaResolvida)];
    }

    const declaradas = configCarregada.config.origens ?? (configCarregada.config.origem ? [configCarregada.config.origem] : []);
    if (declaradas.length > 0) {
      return declaradas.map((origem) => path.resolve(configCarregada.baseDiretorio, origem));
    }
    return [configCarregada.baseDiretorio];
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
  const packageJsonRaiz = await lerConteudoSeExistir(path.join(baseProjeto, "package.json"));
  const marcadoresFirebaseProjeto = await procurarArquivosPorNome(baseProjeto, ["firebase.json", "firestore.rules"], 3);

  if (packageJsonRaiz) {
    if (/@nestjs\/common|@nestjs\/core/.test(packageJsonRaiz)) {
      encontrados.add("nestjs");
    }
    if (/typescript/.test(packageJsonRaiz)) {
      encontrados.add("typescript");
    }
    if (/"next"\s*:/.test(packageJsonRaiz)) {
      encontrados.add("nextjs");
      encontrados.add("typescript");
    }
    if (/firebase-admin|firebase-functions|firebase\b/.test(packageJsonRaiz)) {
      encontrados.add("firebase");
      encontrados.add("typescript");
    }
  }

  if (marcadoresFirebaseProjeto.length > 0) {
    encontrados.add("firebase");
  }

  for (const diretorio of diretoriosCodigo) {
    const arquivosTs = await listarArquivosRecursivosLimitado(diretorio, [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"], 5, 40);
    const arquivosPy = await listarArquivosRecursivosLimitado(diretorio, [".py"], 5, 20);
    const arquivosDart = await listarArquivosRecursivosLimitado(diretorio, [".dart"], 5, 20);
    const arquivosCs = await listarArquivosRecursivosLimitado(diretorio, [".cs"], 5, 20);
    const arquivosJava = await listarArquivosRecursivosLimitado(diretorio, [".java"], 5, 20);
    const arquivosGo = await listarArquivosRecursivosLimitado(diretorio, [".go"], 5, 20);
    const arquivosRust = await listarArquivosRecursivosLimitado(diretorio, [".rs"], 5, 20);
    const arquivosCppBrutos = await listarArquivosRecursivosLimitado(diretorio, [".cpp", ".cc", ".cxx", ".hpp", ".h"], 5, 30);
    const arquivosCpp = arquivosCppBrutos.filter((arquivo) => !/(^|[\\/])(windows|linux|macos|runner|flutter|ephemeral|build|vendor)([\\/]|$)/i.test(arquivo));

    if (arquivosTs.length > 0) {
      encontrados.add("typescript");

      const packageJsons = await procurarArquivosPorNome(diretorio, ["package.json"], 3);
      const nextConfigs = await procurarArquivosPorNome(diretorio, ["next.config.js", "next.config.ts", "next.config.mjs"], 3);
      const viteConfigs = await procurarArquivosPorNome(diretorio, ["vite.config.ts", "vite.config.js", "vite.config.mjs"], 3);
      const angularConfigs = await procurarArquivosPorNome(diretorio, ["angular.json"], 3);
      const firebaseLocais = await procurarArquivosPorNome(diretorio, ["firebase.json", "firestore.rules"], 3);
      const textosPackage = await Promise.all(packageJsons.slice(0, 8).map((arquivo) => lerConteudoSeExistir(arquivo)));
      const amostrasTs = await Promise.all(arquivosTs.slice(0, 10).map((arquivo) => lerConteudoSeExistir(arquivo)));
      const relacoesTs = arquivosTs.map((arquivo) => path.relative(diretorio, arquivo).replace(/\\/g, "/"));

      const temNest = textosPackage.some((texto) => /@nestjs\/common|@nestjs\/core/.test(texto ?? ""))
        || amostrasTs.some((texto) => /@nestjs\/common|@nestjs\/core|@Controller\(|@Get\(|@Post\(|@Put\(|@Patch\(|@Delete\(/.test(texto ?? ""));
      const temNext = textosPackage.some((texto) => /"next"\s*:/.test(texto ?? ""))
        || nextConfigs.length > 0
        || relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?app\/api\/.+\/route\.(?:ts|tsx|js|jsx)$/.test(relacao));
      const temNextConsumer = textosPackage.some((texto) => /"next"\s*:/.test(texto ?? ""))
        || nextConfigs.length > 0
        || relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?app\/(?:(?!api\/).)*?(?:page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/.test(relacao));
      const temSuperficieReactViteConsumer = relacoesTs.some((relacao) => /^(?:src\/)?pages\/.+\.(?:ts|tsx|js|jsx)$/.test(relacao))
        || relacoesTs.some((relacao) => /^(?:src\/)?App\.(?:ts|tsx|js|jsx)$/.test(relacao))
        || relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?(?:app\/)?(?:router|routes)\.(?:ts|tsx|js|jsx)$/.test(relacao));
      const temBridgeReactViteConsumer = relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?lib\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|tsx|js|jsx)$/.test(relacao));
      const temReactViteConsumer = temSuperficieReactViteConsumer
        || ((textosPackage.some((texto) => /"react"\s*:|"vite"\s*:|react-router-dom/.test(texto ?? "")) || viteConfigs.length > 0) && temBridgeReactViteConsumer);
      const temSuperficieAngularConsumer = relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?app\/.+\.component\.(?:ts|js)$/.test(relacao))
        || relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?app(?:\/.+)?\/[^/]+\.routes\.(?:ts|js)$/.test(relacao));
      const temBridgeAngularConsumer = relacoesTs.some((relacao) => /(?:^|\/)(?:src\/)?app\/(?:sema_consumer_bridge|sema\/.+)\.(?:ts|js)$/.test(relacao));
      const temAngularConsumer = temSuperficieAngularConsumer
        || ((textosPackage.some((texto) => /@angular\/core|@angular\/router/.test(texto ?? "")) || angularConfigs.length > 0) && temBridgeAngularConsumer);
      const temFirebase = marcadoresFirebaseProjeto.length > 0
        || firebaseLocais.length > 0
        || textosPackage.some((texto) => /firebase-admin|firebase-functions/.test(texto ?? ""))
        || amostrasTs.some((texto) => /firebase-admin|getFirestore|initializeApp|from\s+["']firebase-admin["']/.test(texto ?? ""));

      if (temNest) {
        encontrados.add("nestjs");
      }
      if (temNext) {
        encontrados.add("nextjs");
      }
      if (temNextConsumer) {
        encontrados.add("nextjs-consumer");
      }
      if (temReactViteConsumer) {
        encontrados.add("react-vite-consumer");
      }
      if (temAngularConsumer) {
        encontrados.add("angular-consumer");
      }
      if (temFirebase) {
        encontrados.add("firebase");
      }
    }

    if (arquivosPy.length > 0) {
      encontrados.add("python");
      const amostrasPython = await Promise.all(
        arquivosPy
          .slice(0, 8)
          .map((arquivo) => lerConteudoSeExistir(arquivo)),
      );

      const temFastapi = amostrasPython.some((texto) => /from\s+fastapi\s+import|APIRouter|FastAPI/.test(texto ?? ""));
      const temFlask = amostrasPython.some((texto) => /from\s+flask\s+import|import\s+flask\b|Blueprint\s*\(|Flask\s*\(|@\w+\.route\s*\(/.test(texto ?? ""));

      if (temFastapi) {
        encontrados.add("fastapi");
      }
      if (temFlask) {
        encontrados.add("flask");
      }
    }

    if (arquivosDart.length > 0) {
      encontrados.add("dart");
      const pubspecs = await procurarArquivosPorNome(diretorio, ["pubspec.yaml"], 3);
      const textosPubspec = await Promise.all(pubspecs.slice(0, 4).map((arquivo) => lerConteudoSeExistir(arquivo)));
      const amostrasDart = await Promise.all(arquivosDart.slice(0, 10).map((arquivo) => lerConteudoSeExistir(arquivo)));
      const relacoesDart = arquivosDart.map((arquivo) => path.relative(diretorio, arquivo).replace(/\\/g, "/"));
      const temBridgeFlutterConsumer = relacoesDart.some((relacao) =>
        /(?:^|\/)(?:lib\/)?(?:sema_consumer_bridge|api\/sema_contract_bridge|sema\/.+)\.dart$/i.test(relacao));
      const temSuperficieFlutterConsumer = relacoesDart.some((relacao) =>
        /(?:^|\/)(?:lib\/)?(?:screens|pages)\/.+\.dart$/i.test(relacao)
        || /(?:^|\/)(?:lib\/)?(?:router|app_router|routes|main)\.dart$/i.test(relacao));
      const temFlutterRuntime = textosPubspec.some((texto) => /\nflutter:\s*$|sdk:\s*flutter|dependencies:\s*[\s\S]*\bflutter:\s*$/m.test(texto ?? ""))
        || amostrasDart.some((texto) => /MaterialApp(?:\.router)?\s*\(|CupertinoApp(?:\.router)?\s*\(|GoRouter\s*\(/.test(texto ?? ""));
      const temFlutterConsumer = temSuperficieFlutterConsumer
        || (temFlutterRuntime && temBridgeFlutterConsumer);

      if (temFlutterConsumer) {
        encontrados.add("flutter-consumer");
      }
    }
    if (arquivosDart.length > 0) {
      encontrados.add("dart");
    }

    if (arquivosCs.length > 0) {
      encontrados.add("dotnet");
      const marcadores = await procurarArquivosPorNome(diretorio, ["appsettings.json", "Program.cs"], 4);
      const amostrasCs = await Promise.all(arquivosCs.slice(0, 8).map((arquivo) => lerConteudoSeExistir(arquivo)));
      if (
        marcadores.length > 0
        || amostrasCs.some((texto) => /\bWebApplication\.CreateBuilder\b|\[ApiController\]|\[Http(Get|Post|Put|Patch|Delete)\]|\bMap(Get|Post|Put|Patch|Delete)\(/.test(texto ?? ""))
      ) {
        encontrados.add("dotnet");
      }
    }

    if (arquivosJava.length > 0) {
      encontrados.add("java");
      const marcadoresJava = await procurarArquivosPorNome(diretorio, ["pom.xml", "build.gradle", "build.gradle.kts"], 4);
      const amostrasJava = await Promise.all(arquivosJava.slice(0, 8).map((arquivo) => lerConteudoSeExistir(arquivo)));
      if (
        marcadoresJava.length > 0
        || amostrasJava.some((texto) => /@RestController|@GetMapping|@PostMapping|@RequestMapping/.test(texto ?? ""))
      ) {
        encontrados.add("java");
      }
    }

    if (arquivosGo.length > 0) {
      encontrados.add("go");
      const goMod = await procurarArquivosPorNome(diretorio, ["go.mod"], 3);
      const amostrasGo = await Promise.all(arquivosGo.slice(0, 8).map((arquivo) => lerConteudoSeExistir(arquivo)));
      if (
        goMod.length > 0
        || amostrasGo.some((texto) => /\bhttp\.HandleFunc\b|\bNewServeMux\b|\.GET\(|\.POST\(|gin\.Default\(/.test(texto ?? ""))
      ) {
        encontrados.add("go");
      }
    }

    if (arquivosRust.length > 0) {
      encontrados.add("rust");
      const cargo = await procurarArquivosPorNome(diretorio, ["Cargo.toml"], 3);
      const amostrasRust = await Promise.all(arquivosRust.slice(0, 8).map((arquivo) => lerConteudoSeExistir(arquivo)));
      if (
        cargo.length > 0
        || amostrasRust.some((texto) => /\bRouter::new\b|\.route\(|\bnest\(/.test(texto ?? ""))
      ) {
        encontrados.add("rust");
      }
    }

    if (arquivosCpp.length > 0) {
      encontrados.add("cpp");
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
