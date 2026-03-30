import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type { IrRoute, IrTask } from "@sema/nucleo";
import type { ContextoProjetoCarregado } from "./projeto.js";
import type { FonteLegado } from "./tipos.js";

interface SimboloResolvido {
  origem: FonteLegado | "ts" | "py" | "dart";
  caminho: string;
  arquivo: string;
  simbolo: string;
}

interface RotaResolvida {
  origem: "nestjs" | "fastapi";
  metodo: string;
  caminho: string;
  arquivo: string;
  simbolo: string;
}

export interface DiagnosticoDrift {
  tipo: "impl_quebrado" | "task_sem_impl" | "rota_divergente";
  modulo: string;
  task?: string;
  route?: string;
  mensagem: string;
}

interface RegistroImplDrift {
  modulo: string;
  task: string;
  origem: "ts" | "py" | "dart";
  caminho: string;
  arquivo?: string;
  simbolo?: string;
  status: "resolvido" | "quebrado";
}

interface RegistroRotaDivergente {
  modulo: string;
  route: string;
  metodo?: string;
  caminho?: string;
  motivo: string;
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
  tasks: Array<{
    modulo: string;
    task: string;
    impls: number;
    implsValidos: number;
    implsQuebrados: number;
    semImplementacao: boolean;
  }>;
  impls_validos: RegistroImplDrift[];
  impls_quebrados: RegistroImplDrift[];
  rotas_divergentes: RegistroRotaDivergente[];
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

async function indexarTypeScript(diretorios: string[]): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[] }> {
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];

  for (const diretorio of diretorios) {
    const arquivos = (await listarArquivosRecursivos(diretorio, [".ts"]))
      .filter((arquivo) => !arquivo.endsWith(".d.ts") && !arquivo.endsWith(".spec.ts") && !arquivo.endsWith(".test.ts"));

    for (const arquivo of arquivos) {
      const codigo = await readFile(arquivo, "utf8");
      const sourceFile = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);

      for (const node of sourceFile.statements) {
        if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
          for (const baseSimbolica of basesSimbolicas) {
            const caminho = `${baseSimbolica}.${node.name.text}`;
            simbolos.set(caminho, { origem: "ts", caminho, arquivo, simbolo: node.name.text });
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

          for (const baseSimbolica of basesSimbolicas) {
            const caminhoClasse = `${baseSimbolica}.${node.name.text}.${nomeMetodo}`;
            simbolos.set(caminhoClasse, { origem: "ts", caminho: caminhoClasse, arquivo, simbolo: `${node.name.text}.${nomeMetodo}` });

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

  return { simbolos: [...simbolos.values()], rotas };
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

      for (const match of texto.matchAll(/^(?:async\s+def|def)\s+(\w+)\(([^)]*)\)(?:\s*->\s*([^:]+))?:/gm)) {
        const nomeFuncao = match[1]!;
        if (nomeFuncao.startsWith("_")) {
          continue;
        }
        for (const baseSimbolica of basesSimbolicas) {
          const caminho = `${baseSimbolica}.${nomeFuncao}`;
          simbolos.set(caminho, { origem: "py", caminho, arquivo, simbolo: nomeFuncao });
        }
      }

      for (const classe of texto.matchAll(/^class\s+(\w+)(?:\(([^)]*)\))?:\n((?:^[ \t].*(?:\n|$))*)/gm)) {
        const nomeClasse = classe[1]!;
        const corpo = classe[3] ?? "";
        for (const metodo of corpo.matchAll(/^\s{4}(?:async\s+def|def)\s+(\w+)\(([^)]*)\)(?:\s*->\s*([^:]+))?:/gm)) {
          const nomeMetodo = metodo[1]!;
          if (nomeMetodo.startsWith("_")) {
            continue;
          }
          for (const baseSimbolica of basesSimbolicas) {
            const caminho = `${baseSimbolica}.${nomeClasse}.${nomeMetodo}`;
            simbolos.set(caminho, { origem: "py", caminho, arquivo, simbolo: `${nomeClasse}.${nomeMetodo}` });
          }
        }
      }

      const prefixo = texto.match(/APIRouter\s*\(\s*prefix\s*=\s*["']([^"']+)["']/)?.[1];
      const routeRegex = /@(?:router|app)\.(get|post|put|patch|delete)\(([^)]*)\)\s*\n(?:async\s+)?def\s+(\w+)\(/g;
      for (const match of texto.matchAll(routeRegex)) {
        const metodo = match[1]!.toUpperCase();
        const argumentoDecorator = match[2] ?? "";
        const sufixo = argumentoDecorator.match(/["']([^"']+)["']/)?.[1];
        const nomeFuncao = match[3]!;
        rotas.push({
          origem: "fastapi",
          metodo,
          caminho: juntarCaminhoHttp(prefixo, sufixo),
          arquivo,
          simbolo: nomeFuncao,
        });
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

      for (const match of texto.matchAll(/(?:Future<[^>]+>|[\w?<>]+)\s+(\w+)\(([^)]*)\)\s*\{/g)) {
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

function normalizarCaminhoRota(caminho?: string): string {
  if (!caminho) {
    return "/";
  }
  const limpo = caminho.trim();
  const comBarra = limpo.startsWith("/") ? limpo : `/${limpo}`;
  const normalizado = comBarra.replace(/\/+/g, "/");
  return normalizado.endsWith("/") && normalizado !== "/" ? normalizado.slice(0, -1) : normalizado;
}

function escolherRotasEsperadas(task: IrTask, fontesLegado: FonteLegado[]): Array<"nestjs" | "fastapi"> {
  if (fontesLegado.includes("nestjs")) {
    return ["nestjs"];
  }
  if (fontesLegado.includes("fastapi")) {
    return ["fastapi"];
  }
  if (task.implementacoesExternas.some((impl) => impl.origem === "ts")) {
    return ["nestjs"];
  }
  if (task.implementacoesExternas.some((impl) => impl.origem === "py")) {
    return ["fastapi"];
  }
  return [];
}

export async function analisarDriftLegado(contexto: ContextoProjetoCarregado): Promise<ResultadoDrift> {
  const indexTs = await indexarTypeScript(contexto.diretoriosCodigo);
  const indexPy = await indexarPython(contexto.diretoriosCodigo);
  const indexDart = await indexarDart(contexto.diretoriosCodigo);
  const mapaImpl = new Map<string, SimboloResolvido>([
    ...indexTs.simbolos.map((item) => [item.caminho, item] as const),
    ...indexPy.simbolos.map((item) => [item.caminho, item] as const),
    ...indexDart.map((item) => [item.caminho, item] as const),
  ]);

  const implsValidos: RegistroImplDrift[] = [];
  const implsQuebrados: RegistroImplDrift[] = [];
  const rotasDivergentes: RegistroRotaDivergente[] = [];
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

      if (task.implementacoesExternas.length === 0) {
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
          status: resolvido ? "resolvido" : "quebrado",
        };

        if (resolvido) {
          implsValidos.push(registro);
          validos += 1;
        } else {
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
      });
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

      const encontradas = [...indexTs.rotas, ...indexPy.rotas].filter((rotaResolvida) => esperadas.includes(rotaResolvida.origem));
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
    sucesso: implsQuebrados.length === 0 && rotasDivergentes.length === 0,
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
    diagnosticos,
  };
}
