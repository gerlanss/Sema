import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type { IrFlow, IrModulo, IrRoute, IrSuperficie, IrTask, IrVinculo, NivelConfiancaSemantica, NivelRiscoSemantico } from "@sema/nucleo";
import type { ContextoProjetoCarregado } from "./projeto.js";
import type { FonteLegado } from "./tipos.js";
import { extrairSimbolosCpp } from "./cpp-symbols.js";
import { extrairRotasDotnet, extrairSimbolosDotnet } from "./dotnet-http.js";
import { extrairRotasGo, extrairSimbolosGo } from "./go-http.js";
import { extrairRotasJava, extrairSimbolosJava } from "./java-http.js";
import { contarIndentacaoPython, extrairRotasFlaskDecoradas, normalizarCaminhoFlask } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import { extrairRotasTypeScriptHttp } from "./typescript-http.js";

interface SimboloResolvido {
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
  arquivo: string;
  simbolo: string;
}

interface RotaResolvida {
  origem: "nestjs" | "fastapi" | "flask" | "nextjs" | "firebase" | "dotnet" | "java" | "go" | "rust";
  metodo: string;
  caminho: string;
  arquivo: string;
  simbolo: string;
}

export interface DiagnosticoDrift {
  tipo: "impl_quebrado" | "task_sem_impl" | "rota_divergente" | "recurso_divergente" | "vinculo_quebrado";
  modulo: string;
  task?: string;
  route?: string;
  mensagem: string;
}

interface RegistroImplDrift {
  modulo: string;
  task: string;
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
  arquivo?: string;
  simbolo?: string;
  caminhoResolvido?: string;
  status: "resolvido" | "quebrado";
  candidatos?: SimboloCandidatoDrift[];
}

interface RegistroRotaDivergente {
  modulo: string;
  route: string;
  metodo?: string;
  caminho?: string;
  motivo: string;
}

interface RecursoResolvido {
  origem: "firebase";
  nome: string;
  arquivo: string;
  simbolo?: string;
  tipo: "colecao";
}

interface RegistroRecursoDrift {
  modulo: string;
  task: string;
  categoria: "persistencia";
  alvo: string;
  arquivo: string;
  origem: "firebase";
  tipo: "colecao";
  status: "resolvido" | "divergente";
}

interface SimboloCandidatoDrift {
  origem: "ts" | "py" | "dart" | "cs" | "java" | "go" | "rust" | "cpp";
  caminho: string;
  arquivo: string;
  simbolo: string;
  confianca: "alta" | "media";
  motivo: string;
}

interface ResumoTaskDrift {
  modulo: string;
  task: string;
  impls: number;
  implsValidos: number;
  implsQuebrados: number;
  semImplementacao: boolean;
  scoreSemantico: number;
  confiancaVinculo: NivelConfiancaSemantica;
  riscoOperacional: NivelRiscoSemantico;
  lacunas: string[];
  arquivosReferenciados: string[];
  arquivosProvaveisEditar: string[];
  simbolosReferenciados: string[];
  candidatosImpl: SimboloCandidatoDrift[];
  checksSugeridos: string[];
}

interface RegistroVinculoDrift {
  modulo: string;
  donoTipo: "modulo" | "task" | "flow" | "route" | "superficie";
  dono: string;
  tipo: string;
  valor: string;
  arquivo?: string;
  simbolo?: string;
  status: "resolvido" | "parcial" | "nao_encontrado";
  confianca: NivelConfiancaSemantica;
}

export interface ResultadoDrift {
  comando: "drift";
  sucesso: boolean;
  modulos: Array<{
    caminho: string;
    modulo: string | null;
    tasks: number;
    routes: number;
  }>;
  tasks: ResumoTaskDrift[];
  impls_validos: RegistroImplDrift[];
  impls_quebrados: RegistroImplDrift[];
  vinculos_validos: RegistroVinculoDrift[];
  vinculos_quebrados: RegistroVinculoDrift[];
  rotas_divergentes: RegistroRotaDivergente[];
  recursos_validos: RegistroRecursoDrift[];
  recursos_divergentes: RegistroRecursoDrift[];
  resumo_operacional: {
    scoreMedio: number;
    confiancaGeral: NivelConfiancaSemantica;
    riscosPrincipais: string[];
    oQueTocar: string[];
    oQueValidar: string[];
    oQueEstaFrouxo: string[];
    oQueFoiInferido: string[];
  };
  diagnosticos: DiagnosticoDrift[];
}

const DIRETORIOS_IGNORADOS = new Set([
  ".git",
  ".hg",
  ".svn",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".dart_tool",
  "__pycache__",
  ".venv",
  "venv",
  "coverage",
  ".tmp",
  "generated",
]);

function normalizarFragmentoArquivo(valor: string): string {
  return valor.replace(/\\/g, "/").replace(/^\.?\//, "").trim().toLowerCase();
}

function escolherArquivoPorVinculo(arquivos: string[], valor: string): { arquivo?: string; confianca: NivelConfiancaSemantica; status: RegistroVinculoDrift["status"] } {
  const normalizado = normalizarFragmentoArquivo(valor);
  const exato = arquivos.find((arquivo) => normalizarFragmentoArquivo(arquivo) === normalizado);
  if (exato) {
    return { arquivo: exato, confianca: "alta", status: "resolvido" };
  }

  const porSufixo = arquivos.find((arquivo) => normalizarFragmentoArquivo(arquivo).endsWith(normalizado));
  if (porSufixo) {
    return { arquivo: porSufixo, confianca: "media", status: "parcial" };
  }

  return { confianca: "baixa", status: "nao_encontrado" };
}

function escolherSimboloPorVinculo(
  simbolos: SimboloResolvido[],
  mapaImpl: Map<string, SimboloResolvido>,
  valor: string,
): { simbolo?: SimboloResolvido; confianca: NivelConfiancaSemantica; status: RegistroVinculoDrift["status"] } {
  const exato = mapaImpl.get(valor);
  if (exato) {
    return { simbolo: exato, confianca: "alta", status: "resolvido" };
  }

  const ultimoSegmento = valor.split(".").at(-1)?.toLowerCase();
  const aproximado = simbolos.find((simbolo) =>
    simbolo.caminho.toLowerCase() === valor.toLowerCase()
    || simbolo.simbolo.toLowerCase() === ultimoSegmento
    || simbolo.caminho.toLowerCase().endsWith(`.${ultimoSegmento}`));

  if (aproximado) {
    return { simbolo: aproximado, confianca: "media", status: "parcial" };
  }

  return { confianca: "baixa", status: "nao_encontrado" };
}

function resolverArquivoOuSimboloAncora(
  vinculos: IrVinculo[],
  simbolos: SimboloResolvido[],
  mapaImpl: Map<string, SimboloResolvido>,
  arquivos: string[],
): { arquivo?: string; simbolo?: string; confianca: NivelConfiancaSemantica } | undefined {
  for (const vinculo of vinculos) {
    if (vinculo.simbolo) {
      const resolucaoSimbolo = escolherSimboloPorVinculo(simbolos, mapaImpl, vinculo.simbolo);
      if (resolucaoSimbolo.status !== "nao_encontrado") {
        return {
          arquivo: resolucaoSimbolo.simbolo?.arquivo,
          simbolo: resolucaoSimbolo.simbolo?.simbolo,
          confianca: resolucaoSimbolo.confianca,
        };
      }
    }

    if (vinculo.arquivo) {
      const resolucaoArquivo = escolherArquivoPorVinculo(arquivos, vinculo.arquivo);
      if (resolucaoArquivo.status !== "nao_encontrado") {
        return {
          arquivo: resolucaoArquivo.arquivo,
          confianca: resolucaoArquivo.confianca,
        };
      }
    }
  }

  return undefined;
}

function encontrarAncoraSuperficie(
  ir: IrModulo,
  superficie: IrSuperficie,
  simbolos: SimboloResolvido[],
  mapaImpl: Map<string, SimboloResolvido>,
  arquivos: string[],
): { arquivo?: string; simbolo?: string; confianca: NivelConfiancaSemantica } | undefined {
  const ancoraDireta = resolverArquivoOuSimboloAncora(superficie.vinculos, simbolos, mapaImpl, arquivos);
  if (ancoraDireta) {
    return ancoraDireta;
  }

  for (const impl of superficie.implementacoesExternas) {
    const resolvido = mapaImpl.get(impl.caminho);
    if (resolvido) {
      return {
        arquivo: resolvido.arquivo,
        simbolo: resolvido.simbolo,
        confianca: "alta",
      };
    }
  }

  if (!superficie.task) {
    return undefined;
  }

  const taskAssociada = ir.tasks.find((task) => task.nome === superficie.task);
  if (!taskAssociada) {
    return undefined;
  }

  const ancoraTask = resolverArquivoOuSimboloAncora(taskAssociada.vinculos, simbolos, mapaImpl, arquivos);
  if (ancoraTask) {
    return ancoraTask;
  }

  for (const impl of taskAssociada.implementacoesExternas) {
    const resolvido = mapaImpl.get(impl.caminho);
    if (resolvido) {
      return {
        arquivo: resolvido.arquivo,
        simbolo: resolvido.simbolo,
        confianca: "alta",
      };
    }
  }

  return undefined;
}

function calcularRiscoOperacional(task: IrTask): NivelRiscoSemantico {
  if (
    task.execucao.criticidadeOperacional === "alta"
    || task.execucao.criticidadeOperacional === "critica"
    || task.efeitosEstruturados.some((efeito) => efeito.categoria === "persistencia" || efeito.criticidade === "critica")
  ) {
    return "alto";
  }

  if (task.efeitosEstruturados.length > 0 || task.vinculos.length > 0 || task.errosDetalhados.length > 0) {
    return "medio";
  }

  return "baixo";
}

function calcularConfiancaTask(
  task: IrTask,
  implsValidos: number,
  implsQuebrados: number,
  vinculosValidos: number,
  vinculosQuebrados: number,
): NivelConfiancaSemantica {
  if ((implsValidos > 0 || vinculosValidos > 0) && implsQuebrados === 0 && vinculosQuebrados === 0) {
    return "alta";
  }
  if (implsValidos > 0 || vinculosValidos > 0 || task.implementacoesExternas.length > 0 || task.vinculos.length > 0) {
    return "media";
  }
  return "baixa";
}

function calcularScoreTask(
  task: IrTask,
  implsValidos: number,
  implsQuebrados: number,
  vinculosValidos: number,
  vinculosQuebrados: number,
  semImplementacao: boolean,
): number {
  let score = 45;
  if (!semImplementacao && task.implementacoesExternas.length > 0) {
    score += 15;
  }
  score += Math.min(implsValidos * 10, 20);
  score -= Math.min(implsQuebrados * 20, 30);
  score += Math.min(vinculosValidos * 5, 15);
  score -= Math.min(vinculosQuebrados * 10, 20);
  if (task.guarantees.length > 0) {
    score += 5;
  }
  if (task.execucao.explicita) {
    score += 5;
  }
  return Math.max(0, Math.min(100, score));
}

function resumirLacunasTask(
  task: IrTask,
  semImplementacao: boolean,
  implsQuebrados: number,
  vinculosQuebrados: number,
): string[] {
  const lacunas: string[] = [];
  if (semImplementacao) {
    lacunas.push("sem_impl");
  }
  if (implsQuebrados > 0) {
    lacunas.push("impl_quebrado");
  }
  if (task.vinculos.length === 0) {
    lacunas.push("sem_vinculos");
  }
  if (vinculosQuebrados > 0) {
    lacunas.push("vinculo_quebrado");
  }
  if (!task.execucao.explicita) {
    lacunas.push("execucao_implicita");
  }
  return lacunas;
}

function resumirOperacional(resultado: Omit<ResultadoDrift, "comando" | "sucesso">): ResultadoDrift["resumo_operacional"] {
  const scoreMedio = resultado.tasks.length > 0
    ? Math.round(resultado.tasks.reduce((total, task) => total + task.scoreSemantico, 0) / resultado.tasks.length)
    : 0;
  const confiancaGeral: NivelConfiancaSemantica = scoreMedio >= 80 ? "alta" : scoreMedio >= 55 ? "media" : "baixa";
  const riscosPrincipais = [...new Set(resultado.tasks.filter((task) => task.riscoOperacional !== "baixo").map((task) => `${task.task}:${task.riscoOperacional}`))];
  const oQueTocar = [...new Set(resultado.tasks.flatMap((task) => task.arquivosProvaveisEditar))].slice(0, 20);
  const oQueValidar = [...new Set(resultado.tasks.flatMap((task) => task.checksSugeridos))];
  const oQueEstaFrouxo = [...new Set(resultado.tasks.flatMap((task) => task.lacunas))];
  const oQueFoiInferido = [
    ...new Set([
      ...resultado.impls_quebrados.flatMap((impl) => impl.candidatos?.map((candidato) => candidato.caminho) ?? []),
      ...resultado.vinculos_quebrados.filter((vinculo) => vinculo.status === "parcial").map((vinculo) => `${vinculo.dono}:${vinculo.valor}`),
    ]),
  ];

  return {
    scoreMedio,
    confiancaGeral,
    riscosPrincipais,
    oQueTocar,
    oQueValidar,
    oQueEstaFrouxo,
    oQueFoiInferido,
  };
}

function paraIdentificadorModulo(valor: string): string {
  return valor
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function extrairTextoLiteral(expr?: ts.Expression): string | undefined {
  if (!expr) {
    return undefined;
  }
  if (ts.isStringLiteralLike(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  if (ts.isNumericLiteral(expr)) {
    return expr.text;
  }
  return undefined;
}

function listarDecoradores(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
}

function lerDecorator(node: ts.Node, nomes: string[]): { nome: string; argumentos: ts.NodeArray<ts.Expression> } | undefined {
  for (const decorator of listarDecoradores(node)) {
    const expressao = decorator.expression;
    if (ts.isCallExpression(expressao)) {
      const alvo = expressao.expression;
      if (ts.isIdentifier(alvo) && nomes.includes(alvo.text)) {
        return { nome: alvo.text, argumentos: expressao.arguments };
      }
    } else if (ts.isIdentifier(expressao) && nomes.includes(expressao.text)) {
      return { nome: expressao.text, argumentos: ts.factory.createNodeArray() };
    }
  }
  return undefined;
}

function juntarCaminhoHttp(base: string | undefined, sufixo: string | undefined): string {
  const partes = [base ?? "", sufixo ?? ""]
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^\/+|\/+$/g, ""));

  const caminho = `/${partes.join("/")}`.replace(/\/+/g, "/");
  return caminho === "//" ? "/" : caminho;
}

async function listarArquivosRecursivos(diretorio: string, extensoes: string[]): Promise<string[]> {
  let entradas;
  try {
    entradas = await readdir(diretorio, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return [];
  }

  const encontrados: string[] = [];
  for (const entrada of entradas) {
    if (DIRETORIOS_IGNORADOS.has(entrada.name)) {
      continue;
    }
    const caminhoAtual = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...await listarArquivosRecursivos(caminhoAtual, extensoes));
      continue;
    }
    if (extensoes.some((extensao) => entrada.name.endsWith(extensao))) {
      encontrados.push(caminhoAtual);
    }
  }

  return encontrados.sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function caminhosSimbolicos(baseDiretorio: string, arquivo: string): string[] {
  const relativo = path.relative(baseDiretorio, arquivo).replace(/\.[^.]+$/, "");
  const semPrefixo = relativo
    .split(path.sep)
    .map((segmento) => paraIdentificadorModulo(segmento))
    .filter(Boolean)
    .join(".");
  const prefixo = paraIdentificadorModulo(path.basename(baseDiretorio));
  const comPrefixo = prefixo ? [prefixo, semPrefixo].filter(Boolean).join(".") : semPrefixo;
  return [...new Set([semPrefixo, comPrefixo].filter(Boolean))];
}

function registrarSimboloTypeScript(
  simbolos: Map<string, SimboloResolvido>,
  basesSimbolicas: string[],
  arquivo: string,
  nome: string,
  nomeClasse?: string,
): void {
  for (const baseSimbolica of basesSimbolicas) {
    const caminho = nomeClasse
      ? `${baseSimbolica}.${nomeClasse}.${nome}`
      : `${baseSimbolica}.${nome}`;
    simbolos.set(caminho, {
      origem: "ts",
      caminho,
      arquivo,
      simbolo: nomeClasse ? `${nomeClasse}.${nome}` : nome,
    });
  }
}

function extrairColecoesFirebase(arquivo: string, codigo: string): RecursoResolvido[] {
  const recursos = new Map<string, RecursoResolvido>();
  const registrar = (nome: string) => {
    if (!nome) {
      return;
    }
    recursos.set(`${nome}:${arquivo}`, {
      origem: "firebase",
      nome,
      arquivo,
      tipo: "colecao",
    });
  };

  for (const match of codigo.matchAll(/\b(?:export\s+)?const\s+\w*COLLECTIONS?\w*\s*=\s*\{([\s\S]*?)\n\}/g)) {
    const corpo = match[1] ?? "";
    for (const valor of corpo.matchAll(/:\s*["'`]([^"'`]+)["'`]/g)) {
      registrar(valor[1]!);
    }
  }

  for (const match of codigo.matchAll(/\b(?:db\.)?collection\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
    registrar(match[1]!);
  }

  for (const match of codigo.matchAll(/\bdoc\s*\(\s*[^,]+,\s*["'`]([^"'`]+)["'`]/g)) {
    registrar(match[1]!);
  }

  return [...recursos.values()];
}

async function indexarTypeScript(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]))
      .filter((arquivo) =>
        !arquivo.endsWith(".d.ts")
        && !arquivo.endsWith(".spec.ts")
        && !arquivo.endsWith(".test.ts"),
      );

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const scriptKind = arquivo.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      const sourceFile = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKind);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      const relacao = path.relative(diretorio, arquivo);

      for (const recurso of extrairColecoesFirebase(arquivo, codigo)) {
        recursos.set(`${recurso.nome}:${recurso.arquivo}:${recurso.tipo}`, recurso);
      }

      for (const rota of extrairRotasTypeScriptHttp(sourceFile, relacao)) {
        rotas.push({
          origem: rota.origem,
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.simbolo,
        });
      }

      for (const node of sourceFile.statements) {
        if (ts.isFunctionDeclaration(node) && node.name) {
          registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, node.name.text);
        }

        if (ts.isVariableStatement(node)) {
          for (const declaracao of node.declarationList.declarations) {
            if (!ts.isIdentifier(declaracao.name) || !declaracao.initializer) {
              continue;
            }
            if (ts.isArrowFunction(declaracao.initializer) || ts.isFunctionExpression(declaracao.initializer)) {
              registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, declaracao.name.text);
            }
          }
        }

        if (!ts.isClassDeclaration(node) || !node.name) {
          continue;
        }

        const controllerDecorator = lerDecorator(node, ["Controller"]);
        const basePath = extrairTextoLiteral(controllerDecorator?.argumentos[0]);

        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member) || !member.name) {
            continue;
          }

          const nomeMetodo = member.name.getText(sourceFile);
          if (nomeMetodo === "constructor") {
            continue;
          }

          registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, nomeMetodo, node.name.text);
          const metodoEhInterno = member.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword);
          for (const baseSimbolica of basesSimbolicas) {
            const caminhoMetodoDireto = `${baseSimbolica}.${nomeMetodo}`;
            if (!simbolos.has(caminhoMetodoDireto)) {
              simbolos.set(caminhoMetodoDireto, { origem: "ts", caminho: caminhoMetodoDireto, arquivo, simbolo: nomeMetodo });
            }
          }

          if (controllerDecorator && !metodoEhInterno) {
            const httpDecorator = lerDecorator(member, ["Get", "Post", "Put", "Patch", "Delete"]);
            if (httpDecorator) {
              rotas.push({
                origem: "nestjs",
                metodo: httpDecorator.nome.toUpperCase(),
                caminho: juntarCaminhoHttp(basePath, extrairTextoLiteral(httpDecorator.argumentos[0])),
                arquivo,
                simbolo: `${node.name.text}.${nomeMetodo}`,
              });
            }
          }
        }
      }
    }
  }

  return { simbolos: [...simbolos.values()], rotas, recursos: [...recursos.values()] };
}

interface BlocoPython {
  tipo: "class" | "def";
  nome: string;
  indentacao: number;
}

function registrarSimboloPython(
  simbolos: Map<string, SimboloResolvido>,
  basesSimbolicas: string[],
  arquivo: string,
  nome: string,
  nomeClasse?: string,
): void {
  for (const baseSimbolica of basesSimbolicas) {
    const caminho = nomeClasse
      ? `${baseSimbolica}.${nomeClasse}.${nome}`
      : `${baseSimbolica}.${nome}`;
    simbolos.set(caminho, {
      origem: "py",
      caminho,
      arquivo,
      simbolo: nomeClasse ? `${nomeClasse}.${nome}` : nome,
    });
  }
}

function registrarRotasPython(
  rotas: RotaResolvida[],
  decoratorsPendentes: string[],
  prefixo: string | undefined,
  arquivo: string,
  nomeFuncao: string,
): void {
  for (const decorator of decoratorsPendentes) {
    const match = decorator.match(/^@(router|app)\.(get|post|put|patch|delete)\((.*)\)\s*$/);
    if (!match) {
      continue;
    }
    const metodo = match[2]!.toUpperCase();
    const sufixo = match[3]?.match(/["']([^"']+)["']/)?.[1];
    rotas.push({
      origem: "fastapi",
      metodo,
      caminho: juntarCaminhoHttp(prefixo, sufixo),
      arquivo,
      simbolo: nomeFuncao,
    });
  }
}

async function indexarPython(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".py"]))
      .filter((arquivo) => !arquivo.endsWith("__init__.py") && !/tests?[\\/]/i.test(arquivo));

    for (const arquivo of arquivos) {
      const texto = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      const prefixo = texto.match(/APIRouter\s*\(\s*prefix\s*=\s*["']([^"']+)["']/)?.[1];
      for (const rota of extrairRotasFlaskDecoradas(texto)) {
        rotas.push({
          origem: "flask",
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.nomeFuncao,
        });
      }
      const blocos: BlocoPython[] = [];
      let decoratorsPendentes: string[] = [];

      for (const linha of texto.split(/\r?\n/)) {
        const trim = linha.trim();
        if (trim === "" || trim.startsWith("#")) {
          decoratorsPendentes = [];
          continue;
        }

        const indentacao = contarIndentacaoPython(linha);
        while (blocos.length > 0 && indentacao <= blocos[blocos.length - 1]!.indentacao) {
          blocos.pop();
        }

        if (trim.startsWith("@")) {
          decoratorsPendentes.push(trim);
          continue;
        }

        const classe = trim.match(/^class\s+([A-Za-z_]\w*)(?:\([^)]*\))?:\s*(?:#.*)?$/);
        if (classe) {
          blocos.push({ tipo: "class", nome: classe[1]!, indentacao });
          decoratorsPendentes = [];
          continue;
        }

        const definicao = trim.match(/^(?:async\s+def|def)\s+([A-Za-z_]\w*)\s*\(/);
        if (definicao) {
          const nomeFuncao = definicao[1]!;
          const existeDefPai = blocos.some((bloco) => bloco.tipo === "def");
          const classeAtual = [...blocos].reverse().find((bloco) => bloco.tipo === "class");

          if (!existeDefPai && classeAtual) {
            registrarSimboloPython(simbolos, basesSimbolicas, arquivo, nomeFuncao, classeAtual.nome);
          } else if (!existeDefPai) {
            registrarSimboloPython(simbolos, basesSimbolicas, arquivo, nomeFuncao);
            registrarRotasPython(rotas, decoratorsPendentes, prefixo, arquivo, nomeFuncao);
          }

          blocos.push({ tipo: "def", nome: nomeFuncao, indentacao });
          decoratorsPendentes = [];
          continue;
        }

        decoratorsPendentes = [];
      }
    }
  }

  return { simbolos: [...simbolos.values()], rotas };
}

async function indexarDart(diretorios: string[]): Promise<SimboloResolvido[]> {
  const simbolos = new Map<string, SimboloResolvido>();

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".dart"]))
      .filter((arquivo) => !arquivo.endsWith(".g.dart") && !arquivo.endsWith(".freezed.dart"));

    for (const arquivo of arquivos) {
      const texto = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);

      for (const match of texto.matchAll(/(?:Future<[^\n]+>|[\w?<>.,\s]+)\s+(\w+)\(([^)]*)\)\s*(?:async\s*)?\{/g)) {
        const nome = match[1]!;
        if (["build", "toString"].includes(nome)) {
          continue;
        }
        for (const baseSimbolica of basesSimbolicas) {
          const caminho = `${baseSimbolica}.${nome}`;
          simbolos.set(caminho, { origem: "dart", caminho, arquivo, simbolo: nome });
        }
      }
    }
  }

  return [...simbolos.values()];
}

function registrarSimboloGenerico(
  simbolos: Map<string, SimboloResolvido>,
  origem: SimboloResolvido["origem"],
  basesSimbolicas: string[],
  arquivo: string,
  simbolo: string,
): void {
  for (const baseSimbolica of basesSimbolicas) {
    const caminho = `${baseSimbolica}.${simbolo}`;
    simbolos.set(caminho, {
      origem,
      caminho,
      arquivo,
      simbolo,
    });

    const ultimo = simbolo.split(".").at(-1);
    if (ultimo) {
      const caminhoDireto = `${baseSimbolica}.${ultimo}`;
      if (!simbolos.has(caminhoDireto)) {
        simbolos.set(caminhoDireto, {
          origem,
          caminho: caminhoDireto,
          arquivo,
          simbolo: ultimo,
        });
      }
    }
  }
}

async function indexarDotnet(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".cs"]))
      .filter((arquivo) => !/(^|[\\/])(bin|obj|Test[s]?)([\\/]|$)/i.test(arquivo));

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const simbolo of extrairSimbolosDotnet(codigo)) {
        registrarSimboloGenerico(simbolos, "cs", basesSimbolicas, arquivo, simbolo.simbolo);
      }
      for (const rota of extrairRotasDotnet(codigo)) {
        rotas.push({
          origem: "dotnet",
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.simbolo,
        });
      }
    }
  }

  return { simbolos: [...simbolos.values()], rotas };
}

async function indexarJava(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".java"]))
      .filter((arquivo) => !/(^|[\\/])(target|build|out|Test[s]?)([\\/]|$)/i.test(arquivo));

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const simbolo of extrairSimbolosJava(codigo)) {
        registrarSimboloGenerico(simbolos, "java", basesSimbolicas, arquivo, simbolo.simbolo);
      }
      for (const rota of extrairRotasJava(codigo)) {
        rotas.push({
          origem: "java",
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.simbolo,
        });
      }
    }
  }

  return { simbolos: [...simbolos.values()], rotas };
}

async function indexarGo(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];

  for (const diretorio of diretorios) {
    const arquivos = await listarArquivosRecursivos(diretorio, [".go"]);

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const simbolo of extrairSimbolosGo(codigo)) {
        registrarSimboloGenerico(simbolos, "go", basesSimbolicas, arquivo, simbolo.simbolo);
      }
      for (const rota of extrairRotasGo(codigo)) {
        rotas.push({
          origem: "go",
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.simbolo,
        });
      }
    }
  }

  return { simbolos: [...simbolos.values()], rotas };
}

async function indexarRust(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];

  for (const diretorio of diretorios) {
    const arquivos = await listarArquivosRecursivos(diretorio, [".rs"]);

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const simbolo of extrairSimbolosRust(codigo)) {
        registrarSimboloGenerico(simbolos, "rust", basesSimbolicas, arquivo, simbolo.simbolo);
      }
      for (const rota of extrairRotasRust(codigo)) {
        rotas.push({
          origem: "rust",
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.simbolo,
        });
      }
    }
  }

  return { simbolos: [...simbolos.values()], rotas };
}

async function indexarCpp(diretorios: string[]): Promise<SimboloResolvido[]> {
  const simbolos = new Map<string, SimboloResolvido>();

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".cpp", ".cc", ".cxx", ".hpp", ".h"]))
      .filter((arquivo) => !/(^|[\\/])(windows|linux|macos|runner|flutter|ephemeral|build|vendor)([\\/]|$)/i.test(arquivo));

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const simbolo of extrairSimbolosCpp(codigo)) {
        registrarSimboloGenerico(simbolos, "cpp", basesSimbolicas, arquivo, simbolo.simbolo);
      }
    }
  }

  return [...simbolos.values()];
}

function normalizarCaminhoRota(caminho?: string): string {
  if (!caminho) {
    return "/";
  }
  const limpo = normalizarCaminhoFlask(caminho.trim().replace(/\s*\/\s*/g, "/"));
  const comBarra = limpo.startsWith("/") ? limpo : `/${limpo}`;
  const normalizado = comBarra.replace(/\/+/g, "/");
  return normalizado.endsWith("/") && normalizado !== "/" ? normalizado.slice(0, -1) : normalizado;
}

function extrairFontesHttpTypeScript(fontesLegado: FonteLegado[]): Array<"nestjs" | "nextjs" | "firebase"> {
  return fontesLegado.filter((fonte): fonte is "nestjs" | "nextjs" | "firebase" =>
    fonte === "nestjs" || fonte === "nextjs" || fonte === "firebase");
}

function extrairFontesHttpBackend(fontesLegado: FonteLegado[]): Array<"dotnet" | "java" | "go" | "rust"> {
  return fontesLegado.filter((fonte): fonte is "dotnet" | "java" | "go" | "rust" =>
    fonte === "dotnet" || fonte === "java" || fonte === "go" || fonte === "rust");
}

function ultimoSegmentoSimbolico(caminho: string): string {
  const partes = caminho.split(".").filter(Boolean);
  return paraIdentificadorModulo(partes[partes.length - 1] ?? caminho);
}

function pontuarCandidatoDeclarado(candidato: SimboloResolvido, origem: SimboloResolvido["origem"], caminhoDeclarado: string): SimboloCandidatoDrift | undefined {
  if (candidato.origem !== origem) {
    return undefined;
  }

  const caminhoNormalizado = paraIdentificadorModulo(caminhoDeclarado.replace(/\./g, "_"));
  const candidatoNormalizado = paraIdentificadorModulo(candidato.caminho.replace(/\./g, "_"));
  const ultimoDeclarado = ultimoSegmentoSimbolico(caminhoDeclarado);
  const ultimoCandidato = ultimoSegmentoSimbolico(candidato.caminho);
  const prefixoDeclarado = caminhoDeclarado.split(".").slice(0, -1).join(".");
  const prefixoCandidato = candidato.caminho.split(".").slice(0, -1).join(".");

  if (candidato.caminho === caminhoDeclarado) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "alta",
      motivo: "Caminho simbolico bate exatamente com o declarado.",
    };
  }

  if (ultimoDeclarado && ultimoDeclarado === ultimoCandidato) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "alta",
      motivo: "Ultimo simbolo bate com a implementacao declarada.",
    };
  }

  if (ultimoDeclarado && (candidatoNormalizado.includes(ultimoDeclarado) || caminhoNormalizado.includes(ultimoCandidato))) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "media",
      motivo: "Trecho relevante do caminho simbolico parece compativel com o declarado.",
    };
  }

  if (prefixoDeclarado && prefixoDeclarado === prefixoCandidato) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "media",
      motivo: "Prefixo do caminho simbolico bate com a implementacao declarada; o simbolo final pode ter mudado.",
    };
  }

  return undefined;
}

function pontuarCandidatoPorTask(candidato: SimboloResolvido, task: string): SimboloCandidatoDrift | undefined {
  const taskNormalizada = paraIdentificadorModulo(task);
  const simboloNormalizado = paraIdentificadorModulo(candidato.simbolo.replace(/\./g, "_"));
  const caminhoNormalizado = paraIdentificadorModulo(candidato.caminho.replace(/\./g, "_"));

  if (!taskNormalizada) {
    return undefined;
  }

  if (simboloNormalizado === taskNormalizada || ultimoSegmentoSimbolico(candidato.caminho) === taskNormalizada) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "alta",
      motivo: "Nome da task bate com o simbolo encontrado no codigo vivo.",
    };
  }

  if (simboloNormalizado.includes(taskNormalizada) || taskNormalizada.includes(simboloNormalizado) || caminhoNormalizado.includes(taskNormalizada)) {
    return {
      origem: candidato.origem,
      caminho: candidato.caminho,
      arquivo: candidato.arquivo,
      simbolo: candidato.simbolo,
      confianca: "media",
      motivo: "Nome da task parece compativel com o simbolo encontrado no codigo vivo.",
    };
  }

  return undefined;
}

function deduplicarCandidatos(candidatos: SimboloCandidatoDrift[]): SimboloCandidatoDrift[] {
  const mapa = new Map<string, SimboloCandidatoDrift>();
  for (const candidato of candidatos) {
    const chave = `${candidato.origem}:${candidato.caminho}:${candidato.arquivo}:${candidato.simbolo}`;
    const anterior = mapa.get(chave);
    if (!anterior || (anterior.confianca === "media" && candidato.confianca === "alta")) {
      mapa.set(chave, candidato);
    }
  }
  return [...mapa.values()];
}

function ordenarCandidatos(candidatos: SimboloCandidatoDrift[]): SimboloCandidatoDrift[] {
  return [...candidatos].sort((a, b) => {
    if (a.confianca !== b.confianca) {
      return a.confianca === "alta" ? -1 : 1;
    }
    return a.caminho.localeCompare(b.caminho, "pt-BR");
  });
}

function sugerirCandidatosParaImpl(
  simbolos: SimboloResolvido[],
  origem: SimboloResolvido["origem"],
  caminhoDeclarado: string,
): SimboloCandidatoDrift[] {
  return ordenarCandidatos(deduplicarCandidatos(
    simbolos
      .map((candidato) => pontuarCandidatoDeclarado(candidato, origem, caminhoDeclarado))
      .filter((item): item is SimboloCandidatoDrift => Boolean(item)),
  )).slice(0, 5);
}

function sugerirCandidatosParaTaskSemImpl(simbolos: SimboloResolvido[], nomeTask: string): SimboloCandidatoDrift[] {
  return ordenarCandidatos(deduplicarCandidatos(
    simbolos
      .map((candidato) => pontuarCandidatoPorTask(candidato, nomeTask))
      .filter((item): item is SimboloCandidatoDrift => Boolean(item)),
  )).slice(0, 5);
}

function escolherRotasEsperadas(task: IrTask, fontesLegado: FonteLegado[]): Array<"nestjs" | "fastapi" | "flask" | "nextjs" | "firebase" | "dotnet" | "java" | "go" | "rust"> {
  const fontesTs = extrairFontesHttpTypeScript(fontesLegado);
  const fontesBackend = extrairFontesHttpBackend(fontesLegado);
  const implTs = task.implementacoesExternas.find((impl) => impl.origem === "ts");
  if (implTs) {
    const esperadas = new Set<"nestjs" | "nextjs" | "firebase">();
    if (/\.route\.(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/i.test(implTs.caminho) || /\.route\./i.test(implTs.caminho)) {
      esperadas.add("nextjs");
    }
    if (/\bcontroller\b/i.test(implTs.caminho) && fontesTs.includes("nestjs")) {
      esperadas.add("nestjs");
    }
    if (fontesTs.includes("firebase") && /(apps\.worker|worker|sema_contract_bridge|health)/i.test(implTs.caminho)) {
      esperadas.add("firebase");
    }
    if (esperadas.size > 0) {
      return [...esperadas];
    }
    if (fontesTs.length > 0) {
      return fontesTs;
    }
    return ["nestjs", "nextjs", "firebase"];
  }
  if (task.implementacoesExternas.some((impl) => impl.origem === "py")) {
    const fontesPython = fontesLegado.filter((fonte): fonte is "fastapi" | "flask" => fonte === "fastapi" || fonte === "flask");
    if (fontesPython.length > 0) {
      return fontesPython;
    }
    return ["fastapi", "flask"];
  }
  const implCs = task.implementacoesExternas.find((impl) => impl.origem === "cs");
  if (implCs) {
    return fontesBackend.includes("dotnet") ? ["dotnet"] : ["dotnet"];
  }
  const implJava = task.implementacoesExternas.find((impl) => impl.origem === "java");
  if (implJava) {
    return fontesBackend.includes("java") ? ["java"] : ["java"];
  }
  const implGo = task.implementacoesExternas.find((impl) => impl.origem === "go");
  if (implGo) {
    return fontesBackend.includes("go") ? ["go"] : ["go"];
  }
  const implRust = task.implementacoesExternas.find((impl) => impl.origem === "rust");
  if (implRust) {
    return fontesBackend.includes("rust") ? ["rust"] : ["rust"];
  }
  if (fontesTs.length > 0) {
    return fontesTs;
  }
  const fontesPython = fontesLegado.filter((fonte): fonte is "fastapi" | "flask" => fonte === "fastapi" || fonte === "flask");
  if (fontesPython.length > 0) {
    return fontesPython;
  }
  if (fontesBackend.length > 0) {
    return fontesBackend;
  }
  return [];
}

function taskEhBridgeFirebase(task: IrTask): boolean {
  return task.implementacoesExternas.some((impl) =>
    impl.origem === "ts" && /sema_contract_bridge|collections?|apps\.worker/i.test(impl.caminho));
}

function extrairRecursosEsperados(task: IrTask): Array<{ categoria: "persistencia"; alvo: string }> {
  if (!taskEhBridgeFirebase(task)) {
    return [];
  }

  return task.efeitosEstruturados
    .filter((efeito) => efeito.categoria === "persistencia" && Boolean(efeito.alvo))
    .map((efeito) => ({
      categoria: "persistencia" as const,
      alvo: efeito.alvo,
    }));
}

function coletarVinculosIr(ir: IrModulo): Array<{ donoTipo: RegistroVinculoDrift["donoTipo"]; dono: string; vinculo: IrVinculo }> {
  return [
    ...ir.vinculos.map((vinculo) => ({ donoTipo: "modulo" as const, dono: ir.nome, vinculo })),
    ...ir.tasks.flatMap((task) => task.vinculos.map((vinculo) => ({ donoTipo: "task" as const, dono: task.nome, vinculo }))),
    ...ir.flows.flatMap((flow: IrFlow) => flow.vinculos.map((vinculo) => ({ donoTipo: "flow" as const, dono: flow.nome, vinculo }))),
    ...ir.routes.flatMap((route: IrRoute) => route.vinculos.map((vinculo) => ({ donoTipo: "route" as const, dono: route.nome, vinculo }))),
    ...ir.superficies.flatMap((superficie: IrSuperficie) => superficie.vinculos.map((vinculo) => ({ donoTipo: "superficie" as const, dono: `${superficie.tipo}:${superficie.nome}`, vinculo }))),
  ];
}

export async function analisarDriftLegado(contexto: ContextoProjetoCarregado): Promise<ResultadoDrift> {
  const indexTs = await indexarTypeScript(contexto.diretoriosCodigo);
  const indexPy = await indexarPython(contexto.diretoriosCodigo);
  const indexDart = await indexarDart(contexto.diretoriosCodigo);
  const indexDotnet = await indexarDotnet(contexto.diretoriosCodigo);
  const indexJava = await indexarJava(contexto.diretoriosCodigo);
  const indexGo = await indexarGo(contexto.diretoriosCodigo);
  const indexRust = await indexarRust(contexto.diretoriosCodigo);
  const indexCpp = await indexarCpp(contexto.diretoriosCodigo);
  const todosSimbolos = [
    ...indexTs.simbolos,
    ...indexPy.simbolos,
    ...indexDart,
    ...indexDotnet.simbolos,
    ...indexJava.simbolos,
    ...indexGo.simbolos,
    ...indexRust.simbolos,
    ...indexCpp,
  ];
  const mapaImpl = new Map<string, SimboloResolvido>([
    ...indexTs.simbolos.map((item) => [item.caminho, item] as const),
    ...indexPy.simbolos.map((item) => [item.caminho, item] as const),
    ...indexDart.map((item) => [item.caminho, item] as const),
    ...indexDotnet.simbolos.map((item) => [item.caminho, item] as const),
    ...indexJava.simbolos.map((item) => [item.caminho, item] as const),
    ...indexGo.simbolos.map((item) => [item.caminho, item] as const),
    ...indexRust.simbolos.map((item) => [item.caminho, item] as const),
    ...indexCpp.map((item) => [item.caminho, item] as const),
  ]);
  const mapaRecursos = new Map<string, RecursoResolvido>(
    indexTs.recursos.map((item) => [item.nome, item] as const),
  );
  const todasRotasIndexadas = [
    ...indexTs.rotas,
    ...indexPy.rotas,
    ...indexDotnet.rotas,
    ...indexJava.rotas,
    ...indexGo.rotas,
    ...indexRust.rotas,
  ];
  const todosArquivosConhecidos = [...new Set([
    ...todosSimbolos.map((item) => item.arquivo),
    ...todasRotasIndexadas.map((item) => item.arquivo),
    ...indexTs.recursos.map((item) => item.arquivo),
  ])].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const implsValidos: RegistroImplDrift[] = [];
  const implsQuebrados: RegistroImplDrift[] = [];
  const vinculosValidos: RegistroVinculoDrift[] = [];
  const vinculosQuebrados: RegistroVinculoDrift[] = [];
  const rotasDivergentes: RegistroRotaDivergente[] = [];
  const recursosValidos: RegistroRecursoDrift[] = [];
  const recursosDivergentes: RegistroRecursoDrift[] = [];
  const diagnosticos: DiagnosticoDrift[] = [];
  const tasksResumo: ResultadoDrift["tasks"] = [];
  const taskPorChave = new Map<string, IrTask>();
  const resumoVinculosPorTask = new Map<string, { validos: number; quebrados: number; arquivos: Set<string> }>();

  for (const item of contexto.modulosSelecionados) {
    const ir = item.resultado.ir;
    if (!ir) {
      continue;
    }
    const superficiesPorChave = new Map<string, IrSuperficie>(
      ir.superficies.map((superficie) => [`${superficie.tipo}:${superficie.nome}`, superficie]),
    );

    for (const task of ir.tasks) {
      taskPorChave.set(`${ir.nome}:${task.nome}`, task);
      let validos = 0;
      let quebrados = 0;
      const arquivosReferenciados = new Set<string>();
      const simbolosReferenciados = new Set<string>();
      const candidatosTask = new Map<string, SimboloCandidatoDrift>();

      if (task.implementacoesExternas.length === 0) {
        for (const candidato of sugerirCandidatosParaTaskSemImpl(todosSimbolos, task.nome)) {
          candidatosTask.set(`${candidato.origem}:${candidato.caminho}:${candidato.arquivo}:${candidato.simbolo}`, candidato);
        }
        diagnosticos.push({
          tipo: "task_sem_impl",
          modulo: ir.nome,
          task: task.nome,
          mensagem: `Task "${task.nome}" ainda nao foi ligada a nenhuma implementacao externa.`,
        });
      }

      for (const impl of task.implementacoesExternas) {
        const resolvido = mapaImpl.get(impl.caminho);
        const registro: RegistroImplDrift = {
          modulo: ir.nome,
          task: task.nome,
          origem: impl.origem,
          caminho: impl.caminho,
          arquivo: resolvido?.arquivo,
          simbolo: resolvido?.simbolo,
          caminhoResolvido: resolvido?.caminho,
          status: resolvido ? "resolvido" : "quebrado",
        };

        if (resolvido) {
          arquivosReferenciados.add(resolvido.arquivo);
          simbolosReferenciados.add(resolvido.simbolo);
          implsValidos.push(registro);
          validos += 1;
        } else {
          registro.candidatos = sugerirCandidatosParaImpl(todosSimbolos, impl.origem, impl.caminho);
          for (const candidato of registro.candidatos) {
            candidatosTask.set(`${candidato.origem}:${candidato.caminho}:${candidato.arquivo}:${candidato.simbolo}`, candidato);
          }
          implsQuebrados.push(registro);
          quebrados += 1;
          diagnosticos.push({
            tipo: "impl_quebrado",
            modulo: ir.nome,
            task: task.nome,
            mensagem: `Implementacao externa "${impl.origem}:${impl.caminho}" nao foi encontrada nos diretorios de codigo vivos.`,
          });
        }
      }

      tasksResumo.push({
        modulo: ir.nome,
        task: task.nome,
        impls: task.implementacoesExternas.length,
        implsValidos: validos,
        implsQuebrados: quebrados,
        semImplementacao: task.implementacoesExternas.length === 0,
        scoreSemantico: 0,
        confiancaVinculo: "baixa",
        riscoOperacional: "baixo",
        lacunas: [],
        arquivosReferenciados: [...arquivosReferenciados].sort((a, b) => a.localeCompare(b, "pt-BR")),
        arquivosProvaveisEditar: [],
        simbolosReferenciados: [...simbolosReferenciados].sort((a, b) => a.localeCompare(b, "pt-BR")),
        candidatosImpl: ordenarCandidatos([...candidatosTask.values()]).slice(0, 5),
        checksSugeridos: [],
      });

      for (const recursoEsperado of extrairRecursosEsperados(task)) {
        const resolvido = mapaRecursos.get(recursoEsperado.alvo);
        const registro: RegistroRecursoDrift = {
          modulo: ir.nome,
          task: task.nome,
          categoria: recursoEsperado.categoria,
          alvo: recursoEsperado.alvo,
          arquivo: resolvido?.arquivo ?? "",
          origem: "firebase",
          tipo: "colecao",
          status: resolvido ? "resolvido" : "divergente",
        };

        if (resolvido) {
          registro.arquivo = resolvido.arquivo;
          recursosValidos.push(registro);
        } else {
          recursosDivergentes.push(registro);
          diagnosticos.push({
            tipo: "recurso_divergente",
            modulo: ir.nome,
            task: task.nome,
            mensagem: `Recurso vivo "${recursoEsperado.alvo}" nao foi encontrado nos bridges/configuracoes Firebase do codigo legado.`,
          });
        }
      }
    }

    for (const route of ir.routes) {
      const taskAssociada = ir.tasks.find((task) => task.nome === route.task);
      const esperadas = escolherRotasEsperadas(taskAssociada ?? {
        nome: "",
        input: [],
        output: [],
        rules: [],
        regrasEstruturadas: [],
        effects: [],
        efeitosEstruturados: [],
        implementacoesExternas: [],
        vinculos: [],
        execucao: {
          idempotencia: false,
          timeout: "padrao",
          retry: "nenhum",
          compensacao: "nenhuma",
          criticidadeOperacional: "media",
          explicita: false,
        },
        guarantees: [],
        garantiasEstruturadas: [],
        errors: {},
        errosDetalhados: [],
        perfilCompatibilidade: "interno",
        resumoAgente: {
          riscos: [],
          checks: [],
          entidadesAfetadas: [],
          superficiesPublicas: [],
          mutacoesPrevistas: [],
        },
        tests: [],
      }, contexto.fontesLegado);

      if (!esperadas.length || !route.metodo || !route.caminho) {
        continue;
      }

      const encontradas = todasRotasIndexadas.filter((rotaResolvida) => esperadas.includes(rotaResolvida.origem));
      const combina = encontradas.some((rotaResolvida) =>
        rotaResolvida.metodo === route.metodo
        && normalizarCaminhoRota(rotaResolvida.caminho) === normalizarCaminhoRota(route.caminho));

      if (!combina) {
        const registro = {
          modulo: ir.nome,
          route: route.nome,
          metodo: route.metodo,
          caminho: route.caminho,
          motivo: `Nenhuma rota publica ${route.metodo} ${route.caminho} foi encontrada no codigo legado para o framework esperado.`,
        };
        rotasDivergentes.push(registro);
        diagnosticos.push({
          tipo: "rota_divergente",
          modulo: ir.nome,
          route: route.nome,
          mensagem: registro.motivo,
        });
      }
    }

    for (const itemVinculo of coletarVinculosIr(ir)) {
      const registro: RegistroVinculoDrift = {
        modulo: ir.nome,
        donoTipo: itemVinculo.donoTipo,
        dono: itemVinculo.dono,
        tipo: itemVinculo.vinculo.tipo,
        valor: itemVinculo.vinculo.valor,
        status: "nao_encontrado",
        confianca: "baixa",
      };

      const arquivoDeclarado = itemVinculo.vinculo.arquivo ?? (itemVinculo.vinculo.tipo === "arquivo" ? itemVinculo.vinculo.valor : undefined);
      const simboloDeclarado = itemVinculo.vinculo.simbolo ?? (itemVinculo.vinculo.tipo === "simbolo" ? itemVinculo.vinculo.valor : undefined);
      const recursoDeclarado = itemVinculo.vinculo.recurso ?? (["recurso", "tabela", "fila", "cache", "storage"].includes(itemVinculo.vinculo.tipo) ? itemVinculo.vinculo.valor : undefined);
      const superficieDeclarada = itemVinculo.vinculo.superficie ?? (["superficie", "rota", "worker", "cron", "webhook", "evento", "policy", "fila", "cache", "storage"].includes(itemVinculo.vinculo.tipo) ? itemVinculo.vinculo.valor : undefined);

      if (simboloDeclarado) {
        const resolucaoSimbolo = escolherSimboloPorVinculo(todosSimbolos, mapaImpl, simboloDeclarado);
        registro.status = resolucaoSimbolo.status;
        registro.confianca = resolucaoSimbolo.confianca;
        registro.arquivo = resolucaoSimbolo.simbolo?.arquivo;
        registro.simbolo = resolucaoSimbolo.simbolo?.simbolo;
      } else if (arquivoDeclarado) {
        const resolucaoArquivo = escolherArquivoPorVinculo(todosArquivosConhecidos, arquivoDeclarado);
        registro.status = resolucaoArquivo.status;
        registro.confianca = resolucaoArquivo.confianca;
        registro.arquivo = resolucaoArquivo.arquivo;
      } else if (recursoDeclarado) {
        const recurso = mapaRecursos.get(recursoDeclarado);
        if (recurso) {
          registro.status = "resolvido";
          registro.confianca = "alta";
          registro.arquivo = recurso.arquivo;
        }
      } else if (superficieDeclarada) {
        const rota = todasRotasIndexadas.find((rotaResolvida) =>
          normalizarCaminhoRota(rotaResolvida.caminho) === normalizarCaminhoRota(superficieDeclarada));
        if (rota) {
          registro.status = "resolvido";
          registro.confianca = "alta";
          registro.arquivo = rota.arquivo;
          registro.simbolo = rota.simbolo;
        } else {
          const resolucaoArquivo = escolherArquivoPorVinculo(todosArquivosConhecidos, superficieDeclarada);
          registro.status = resolucaoArquivo.status;
          registro.confianca = resolucaoArquivo.confianca;
          registro.arquivo = resolucaoArquivo.arquivo;
        }
      } else {
        const resolucaoArquivo = escolherArquivoPorVinculo(todosArquivosConhecidos, itemVinculo.vinculo.valor);
        registro.status = resolucaoArquivo.status;
        registro.confianca = resolucaoArquivo.confianca;
        registro.arquivo = resolucaoArquivo.arquivo;
      }

      if (registro.status === "nao_encontrado" && itemVinculo.donoTipo === "superficie") {
        const superficie = superficiesPorChave.get(itemVinculo.dono);
        const ancora = superficie
          ? encontrarAncoraSuperficie(ir, superficie, todosSimbolos, mapaImpl, todosArquivosConhecidos)
          : undefined;
        if (ancora) {
          registro.status = "parcial";
          registro.confianca = ancora.confianca === "alta" ? "media" : ancora.confianca;
          registro.arquivo = registro.arquivo ?? ancora.arquivo;
          registro.simbolo = registro.simbolo ?? ancora.simbolo;
        }
      }

      if (registro.status === "nao_encontrado") {
        vinculosQuebrados.push(registro);
        diagnosticos.push({
          tipo: "vinculo_quebrado",
          modulo: ir.nome,
          mensagem: `Vinculo ${registro.tipo}="${registro.valor}" de ${registro.donoTipo} "${registro.dono}" nao foi resolvido no codigo vivo.`,
          ...(itemVinculo.donoTipo === "task" ? { task: itemVinculo.dono } : itemVinculo.donoTipo === "route" ? { route: itemVinculo.dono } : {}),
        });
      } else {
        vinculosValidos.push(registro);
      }

      if (itemVinculo.donoTipo === "task") {
        const chaveTask = `${ir.nome}:${itemVinculo.dono}`;
        const resumo = resumoVinculosPorTask.get(chaveTask) ?? {
          validos: 0,
          quebrados: 0,
          arquivos: new Set<string>(),
        };
        if (registro.status === "nao_encontrado") {
          resumo.quebrados += 1;
        } else {
          resumo.validos += 1;
        }
        if (registro.arquivo) {
          resumo.arquivos.add(registro.arquivo);
        }
        resumoVinculosPorTask.set(chaveTask, resumo);
      }
    }
  }

  for (const resumo of tasksResumo) {
    const chaveTask = `${resumo.modulo}:${resumo.task}`;
    const task = taskPorChave.get(chaveTask);
    const resumoVinculos = resumoVinculosPorTask.get(chaveTask) ?? {
      validos: 0,
      quebrados: 0,
      arquivos: new Set<string>(),
    };
    if (!task) {
      continue;
    }

    resumo.confiancaVinculo = calcularConfiancaTask(task, resumo.implsValidos, resumo.implsQuebrados, resumoVinculos.validos, resumoVinculos.quebrados);
    resumo.riscoOperacional = calcularRiscoOperacional(task);
    resumo.lacunas = resumirLacunasTask(task, resumo.semImplementacao, resumo.implsQuebrados, resumoVinculos.quebrados);
    resumo.scoreSemantico = calcularScoreTask(task, resumo.implsValidos, resumo.implsQuebrados, resumoVinculos.validos, resumoVinculos.quebrados, resumo.semImplementacao);
    resumo.arquivosProvaveisEditar = [...new Set([
      ...resumo.arquivosReferenciados,
      ...resumo.candidatosImpl.map((candidato) => candidato.arquivo),
      ...resumoVinculos.arquivos,
    ])].sort((a, b) => a.localeCompare(b, "pt-BR"));
    resumo.checksSugeridos = [...new Set([
      ...task.resumoAgente.checks,
      resumo.riscoOperacional !== "baixo" ? "revisar efeitos operacionais" : "",
      resumo.lacunas.includes("vinculo_quebrado") ? "corrigir vinculos rastreaveis" : "",
    ].filter(Boolean))];
  }

  const payloadBase: ResultadoDrift = {
    comando: "drift",
    sucesso: implsQuebrados.length === 0 && rotasDivergentes.length === 0 && recursosDivergentes.length === 0 && vinculosQuebrados.length === 0,
    modulos: contexto.modulosSelecionados.map((item) => ({
      caminho: item.caminho,
      modulo: item.resultado.ir?.nome ?? item.resultado.modulo?.nome ?? null,
      tasks: item.resultado.ir?.tasks.length ?? 0,
      routes: item.resultado.ir?.routes.length ?? 0,
    })),
    tasks: tasksResumo,
    impls_validos: implsValidos,
    impls_quebrados: implsQuebrados,
    vinculos_validos: vinculosValidos,
    vinculos_quebrados: vinculosQuebrados,
    rotas_divergentes: rotasDivergentes,
    recursos_validos: recursosValidos,
    recursos_divergentes: recursosDivergentes,
    diagnosticos,
    resumo_operacional: {
      scoreMedio: 0,
      confiancaGeral: "baixa" as const,
      riscosPrincipais: [],
      oQueTocar: [],
      oQueValidar: [],
      oQueEstaFrouxo: [],
      oQueFoiInferido: [],
    },
  };
  const resumoOperacional = resumirOperacional(payloadBase);

  return {
    ...payloadBase,
    resumo_operacional: resumoOperacional,
  };
}
