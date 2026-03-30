import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type { IrRoute, IrTask } from "@sema/nucleo";
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
  tipo: "impl_quebrado" | "task_sem_impl" | "rota_divergente" | "recurso_divergente";
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
  arquivosReferenciados: string[];
  simbolosReferenciados: string[];
  candidatosImpl: SimboloCandidatoDrift[];
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
  rotas_divergentes: RegistroRotaDivergente[];
  recursos_validos: RegistroRecursoDrift[];
  recursos_divergentes: RegistroRecursoDrift[];
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
        if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, node.name.text);
        }

        if (ts.isVariableStatement(node) && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
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
          if (member.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword)) {
            continue;
          }

          const nomeMetodo = member.name.getText(sourceFile);
          if (nomeMetodo === "constructor") {
            continue;
          }

          registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, nomeMetodo, node.name.text);
          for (const baseSimbolica of basesSimbolicas) {
            const caminhoMetodoDireto = `${baseSimbolica}.${nomeMetodo}`;
            if (!simbolos.has(caminhoMetodoDireto)) {
              simbolos.set(caminhoMetodoDireto, { origem: "ts", caminho: caminhoMetodoDireto, arquivo, simbolo: nomeMetodo });
            }
          }

          if (controllerDecorator) {
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
  const limpo = normalizarCaminhoFlask(caminho.trim());
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

  const implsValidos: RegistroImplDrift[] = [];
  const implsQuebrados: RegistroImplDrift[] = [];
  const rotasDivergentes: RegistroRotaDivergente[] = [];
  const recursosValidos: RegistroRecursoDrift[] = [];
  const recursosDivergentes: RegistroRecursoDrift[] = [];
  const diagnosticos: DiagnosticoDrift[] = [];
  const tasksResumo: ResultadoDrift["tasks"] = [];

  for (const item of contexto.modulosSelecionados) {
    const ir = item.resultado.ir;
    if (!ir) {
      continue;
    }

    for (const task of ir.tasks) {
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
        arquivosReferenciados: [...arquivosReferenciados].sort((a, b) => a.localeCompare(b, "pt-BR")),
        simbolosReferenciados: [...simbolosReferenciados].sort((a, b) => a.localeCompare(b, "pt-BR")),
        candidatosImpl: ordenarCandidatos([...candidatosTask.values()]).slice(0, 5),
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
        guarantees: [],
        garantiasEstruturadas: [],
        errors: {},
        tests: [],
      }, contexto.fontesLegado);

      if (!esperadas.length || !route.metodo || !route.caminho) {
        continue;
      }

      const encontradas = [
        ...indexTs.rotas,
        ...indexPy.rotas,
        ...indexDotnet.rotas,
        ...indexJava.rotas,
        ...indexGo.rotas,
        ...indexRust.rotas,
      ].filter((rotaResolvida) => esperadas.includes(rotaResolvida.origem));
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
  }

  return {
    comando: "drift",
    sucesso: implsQuebrados.length === 0 && rotasDivergentes.length === 0 && recursosDivergentes.length === 0,
    modulos: contexto.modulosSelecionados.map((item) => ({
      caminho: item.caminho,
      modulo: item.resultado.ir?.nome ?? item.resultado.modulo?.nome ?? null,
      tasks: item.resultado.ir?.tasks.length ?? 0,
      routes: item.resultado.ir?.routes.length ?? 0,
    })),
    tasks: tasksResumo,
    impls_validos: implsValidos,
    impls_quebrados: implsQuebrados,
    rotas_divergentes: rotasDivergentes,
    recursos_validos: recursosValidos,
    recursos_divergentes: recursosDivergentes,
    diagnosticos,
  };
}
