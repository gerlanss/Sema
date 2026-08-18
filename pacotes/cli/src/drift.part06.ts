// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: indexa TypeScript com catalogo e AST compartilhados pelo drift.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import type {
  EngineBanco,
  IrBancoDados,
  IrFlow,
  IrModulo,
  IrRecursoPersistencia,
  IrRoute,
  IrSuperficie,
  IrTask,
  IrVinculo,
  NivelConfiancaSemantica,
  NivelRiscoSemantico,
  TipoRecursoPersistencia,
} from "@sema/nucleo";
import type { ContextoProjetoCarregado } from "./projeto.js";
import type { FonteLegado } from "./tipos.js";
import { coletarSuperficiesAngularStandaloneConsumer } from "./angular-consumer-standalone.js";
import { extrairSimbolosCpp } from "./cpp-symbols.js";
import { extrairRotasDotnet, extrairSimbolosDotnet } from "./dotnet-http.js";
import { extrairRotasGo, extrairSimbolosGo } from "./go-http.js";
import { extrairRotasJava, extrairSimbolosJava } from "./java-http.js";
import { extrairSimbolosLua } from "./lua-symbols.js";
import { contarIndentacaoPython, extrairRotasFlaskDecoradas, normalizarCaminhoFlask } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import { extrairRotasTypeScriptHttp } from "./typescript-http.js";
import { emitirDiagnosticosArquivosOrcamento } from "./driftOrcamento.js";

import { ConsumerFramework, RecursoResolvido, RegistroConsumerBridgeDrift, RegistroConsumerSurfaceDrift, RotaResolvida, SimboloResolvido } from "./drift.part01.js";
import { arquivoEhRotasAngularConsumer, arquivoEhRotasAngularConsumerRaiz, arquivoEhRotasReactViteConsumer, arquivoEhSuperficieNextJsConsumer, arquivoEhSuperficieNuxtConsumer, arquivoEhSuperficieReactViteConsumer, arquivoEhSuperficieSvelteKitConsumer, extrairRotasAngularConsumer, extrairRotasReactViteConsumer, inferirRotaNextJsConsumer, inferirRotaNuxtConsumer, inferirRotaReactViteConsumer, inferirRotaSvelteKitConsumer, normalizarRelacaoConsumer, registrarAtribuicaoPrototypeTypeScript, registrarMetodosObjectAssignTypeScript } from "./drift.part05.js";
import {
  caminhosSimbolicos,
  chaveCaminhoCanonicoDrift,
  deduplicarRaizesSobrepostasDrift,
  desembrulharExpressaoTypeScript,
  extrairNomeClassePrototypeTypeScript,
  extrairTextoLiteral,
  juntarCaminhoHttp,
  lerDecorator,
  listarArquivosRecursivos,
  registrarSimboloTypeScript,
  type AdaptadorLeituraCompartilhadaDrift,
} from "./drift.part04.js";
import { extrairRecursosPersistenciaCodigoVivo, registrarRecursoDrift } from "./drift.part03.js";

export function inferirConsumerFrameworkPrincipal(
  fontesLegado: FonteLegado[],
  consumerSurfaces: RegistroConsumerSurfaceDrift[],
  consumerBridges: RegistroConsumerBridgeDrift[],
): ConsumerFramework | null {
  const arquivos = [
    ...consumerSurfaces.map((item) => item.arquivo),
    ...consumerBridges.map((item) => item.arquivo),
  ].map(normalizarRelacaoConsumer);
  if (arquivos.some((arquivo) => /(?:^|\/)(?:src\/)?app\/(?:(?!api\/).)*?(?:page|layout|loading|error)\.(?:ts|tsx|js|jsx)$/i.test(arquivo))) {
    return "nextjs-consumer";
  }
  if (arquivos.some((arquivo) =>
    /^(?:src\/)?pages\/.+\.(?:ts|tsx|js|jsx)$/i.test(arquivo)
    || /^(?:src\/)?App\.(?:ts|tsx|js|jsx)$/i.test(arquivo)
    || /(?:^|\/)(?:src\/)?(?:app\/)?(?:router|routes)\.(?:ts|tsx|js|jsx)$/i.test(arquivo))) {
    return "react-vite-consumer";
  }
  if (arquivos.some((arquivo) =>
    /(?:^|\/)(?:src\/)?app\.component\.(?:ts|js)$/i.test(arquivo)
    || /(?:^|\/)(?:src\/)?app\/.+\.component\.(?:ts|js)$/i.test(arquivo)
    || /(?:^|\/)(?:src\/)?components\/.+\.component\.(?:ts|js)$/i.test(arquivo)
    || arquivoEhRotasAngularConsumer(arquivo))) {
    return "angular-consumer";
  }
  if (arquivos.some((arquivo) =>
    /(?:^|\/)(?:lib\/)?(?:screens|pages)\/.+\.dart$/i.test(arquivo)
    || /(?:^|\/)(?:lib\/)?(?:router|app_router|routes|main)\.dart$/i.test(arquivo))) {
    return "flutter-consumer";
  }
  if (arquivos.some((arquivo) => /(?:^|\/)(?:src\/)?routes\/(?:[^/]+\/)*\+(?:page|layout|error|server)\.(?:svelte|ts|js)$/i.test(arquivo))) {
    return "sveltekit-consumer";
  }
  if (arquivos.some((arquivo) =>
    /^(?:app\/)?pages\/.+\.vue$/i.test(arquivo)
    || /(?:^|\/)server\/api\/.+\.(?:get|post|put|patch|delete|head)\.(?:ts|js)$/i.test(arquivo))) {
    return "nuxt-consumer";
  }
  for (const framework of ["nextjs-consumer", "react-vite-consumer", "angular-consumer", "flutter-consumer", "sveltekit-consumer", "nuxt-consumer"] as const) {
    if (fontesLegado.includes(framework)) {
      return framework;
    }
  }
  return null;
}

function fonteDeclaraRotasReactVite(
  relacaoArquivo: string,
  sourceFile: ts.SourceFile,
): boolean {
  if (arquivoEhRotasReactViteConsumer(relacaoArquivo)) {
    return true;
  }

  let encontrouDeclaracao = false;
  const nomeExpressao = (expressao: ts.Expression | ts.JsxTagNameExpression): string | undefined => {
    if (ts.isIdentifier(expressao)) return expressao.text;
    if (ts.isPropertyAccessExpression(expressao)) return expressao.name.text;
    return undefined;
  };
  const nomePropriedade = (elemento: ts.ObjectLiteralElementLike): string | undefined => {
    if (!("name" in elemento) || !elemento.name) return undefined;
    if (ts.isIdentifier(elemento.name) || ts.isStringLiteralLike(elemento.name)) {
      return elemento.name.text;
    }
    return undefined;
  };
  const visitar = (node: ts.Node): void => {
    if (encontrouDeclaracao) return;
    if (ts.isCallExpression(node)
      && ["createBrowserRouter", "createRoutesFromElements", "useRoutes"]
        .includes(nomeExpressao(node.expression) ?? "")) {
      encontrouDeclaracao = true;
      return;
    }
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      && ["Route", "Routes", "RouterProvider"].includes(nomeExpressao(node.tagName) ?? "")) {
      encontrouDeclaracao = true;
      return;
    }
    if (ts.isObjectLiteralExpression(node)) {
      const propriedades = new Set(node.properties.map(nomePropriedade).filter(Boolean));
      if ((propriedades.has("path") || propriedades.has("index"))
        && (propriedades.has("element") || propriedades.has("Component"))) {
        encontrouDeclaracao = true;
        return;
      }
    }
    ts.forEachChild(node, visitar);
  };
  visitar(sourceFile);
  return encontrouDeclaracao;
}

function resolverArquivoConsumerCatalogado(
  diretorio: string,
  caminhoRelativo: string,
  arquivosCatalogados: ReadonlyMap<string, string>,
): string | undefined {
  const normalizado = caminhoRelativo.replace(/\\/g, "/");
  const semExtensao = normalizado.replace(/\.(?:ts|tsx|js|jsx)$/i, "");
  const candidatos = [
    normalizado,
    `${semExtensao}.ts`,
    `${semExtensao}.tsx`,
    `${semExtensao}.js`,
    `${semExtensao}.jsx`,
    `${semExtensao}/index.ts`,
    `${semExtensao}/index.tsx`,
    `${semExtensao}/index.js`,
    `${semExtensao}/index.jsx`,
  ];
  for (const candidato of candidatos) {
    const absoluto = path.resolve(diretorio, ...candidato.split("/"));
    const catalogado = arquivosCatalogados.get(chaveCaminhoCanonicoDrift(absoluto));
    if (catalogado) return catalogado;
  }
  return undefined;
}

export function extrairColecoesFirebase(arquivo: string, codigo: string): RecursoResolvido[] {
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

interface ReexportacaoTypeScript {
  arquivoFacade: string;
  basesFacade: string[];
  basesDestino: string[];
  nomes?: Map<string, string>;
}

function destinoReexportacaoTypeScript(diretorio: string, arquivo: string, especificador: string): string | undefined {
  if (!especificador.startsWith(".")) {
    return undefined;
  }
  const resolvido = path.resolve(path.dirname(arquivo), especificador);
  const extensao = path.extname(resolvido);
  const destinoFonte = extensao
    ? `${resolvido.slice(0, -extensao.length)}.ts`
    : resolvido;
  return path.relative(diretorio, destinoFonte).startsWith("..")
    ? undefined
    : destinoFonte;
}

function extrairReexportacaoTypeScript(diretorio: string, arquivo: string, node: ts.Statement): ReexportacaoTypeScript | undefined {
  if (!ts.isExportDeclaration(node) || !node.moduleSpecifier || !ts.isStringLiteralLike(node.moduleSpecifier)) {
    return undefined;
  }
  const destino = destinoReexportacaoTypeScript(diretorio, arquivo, node.moduleSpecifier.text);
  if (!destino) {
    return undefined;
  }
  const nomes = new Map<string, string>();
  if (node.exportClause && ts.isNamedExports(node.exportClause)) {
    for (const elemento of node.exportClause.elements) {
      nomes.set(elemento.propertyName?.text ?? elemento.name.text, elemento.name.text);
    }
  }
  return {
    arquivoFacade: arquivo,
    basesFacade: caminhosSimbolicos(diretorio, arquivo),
    basesDestino: caminhosSimbolicos(diretorio, destino),
    nomes: nomes.size > 0 ? nomes : undefined,
  };
}

function aplicarReexportacoesTypeScript(simbolos: Map<string, SimboloResolvido>, reexportacoes: ReexportacaoTypeScript[]): void {
  for (const reexportacao of reexportacoes) {
    for (const simbolo of [...simbolos.values()]) {
      for (const baseDestino of reexportacao.basesDestino) {
        if (!simbolo.caminho.startsWith(`${baseDestino}.`)) {
          continue;
        }
        const sufixo = simbolo.caminho.slice(baseDestino.length + 1);
        const nomeExportado = reexportacao.nomes?.get(sufixo);
        if (reexportacao.nomes && !nomeExportado) {
          continue;
        }
        for (const baseFacade of reexportacao.basesFacade) {
          const caminho = `${baseFacade}.${nomeExportado ?? sufixo}`;
          if (!simbolos.has(caminho)) {
            simbolos.set(caminho, {
              origem: simbolo.origem,
              caminho,
              arquivo: simbolo.arquivo,
              simbolo: simbolo.simbolo,
            });
          }
        }
      }
    }
  }
}

export async function indexarTypeScript(
  diretorios: string[],
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<{
  simbolos: SimboloResolvido[];
  rotas: RotaResolvida[];
  recursos: RecursoResolvido[];
  consumerSurfaces: RegistroConsumerSurfaceDrift[];
}> {
  adaptadorLeitura?.emitir?.("extractor.run");
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();
  const consumerSurfaces = new Map<string, RegistroConsumerSurfaceDrift>();
  const sourceFiles = new Map<string, ts.SourceFile>();
  const arquivosProcessados = new Set<string>();

  const registrarSuperficieSvelteKitDrift = (relacao: string, arquivo: string): void => {
    const superficie = arquivoEhSuperficieSvelteKitConsumer(relacao)
      ? inferirRotaSvelteKitConsumer(relacao)
      : undefined;
    if (!superficie) {
      return;
    }
    consumerSurfaces.set(`${superficie.rota}:${arquivo}:${superficie.tipoArquivo}`, {
      rota: superficie.rota,
      arquivo,
      tipoArquivo: superficie.tipoArquivo,
    });
    rotas.push({
      origem: "sveltekit-consumer",
      metodo: superficie.tipoArquivo === "server" ? "GET" : "VIEW",
      caminho: superficie.rota,
      arquivo,
      simbolo: superficie.tipoArquivo,
    });
  };

  const registrarSuperficieNuxtDrift = (relacao: string, arquivo: string): void => {
    const superficie = arquivoEhSuperficieNuxtConsumer(relacao)
      ? inferirRotaNuxtConsumer(relacao)
      : undefined;
    if (!superficie) {
      return;
    }
    consumerSurfaces.set(`${superficie.rota}:${arquivo}:${superficie.tipoArquivo}`, {
      rota: superficie.rota,
      arquivo,
      tipoArquivo: superficie.tipoArquivo,
    });
    rotas.push({
      origem: "nuxt-consumer",
      metodo: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].includes(superficie.tipoArquivo)
        ? superficie.tipoArquivo
        : "VIEW",
      caminho: superficie.rota,
      arquivo,
      simbolo: superficie.tipoArquivo,
    });
  };

  for (const diretorio of deduplicarRaizesSobrepostasDrift(diretorios)) {
    const arquivos = (await listarArquivosRecursivos(
      diretorio,
      [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"],
      adaptadorLeitura,
    ))
      .filter((arquivo) =>
        !arquivo.endsWith(".d.ts")
        && !arquivo.endsWith(".spec.ts")
        && !arquivo.endsWith(".test.ts"),
      )
      .filter((arquivo) => {
        const chave = chaveCaminhoCanonicoDrift(arquivo);
        if (arquivosProcessados.has(chave)) {
          return false;
        }
        arquivosProcessados.add(chave);
        return true;
      });
    const arquivosRotasAngular = arquivos.filter((arquivo) => arquivoEhRotasAngularConsumer(path.relative(diretorio, arquivo)));
    const arquivosRotasAngularRaiz = new Set(
      arquivosRotasAngular
        .filter((arquivo) => arquivoEhRotasAngularConsumerRaiz(path.relative(diretorio, arquivo)))
        .map((arquivo) => path.resolve(arquivo)),
    );
    const arquivosCatalogadosRaiz = new Map(
      arquivos.map((arquivo) => [chaveCaminhoCanonicoDrift(arquivo), arquivo]),
    );
    const usarApenasRotasAngularRaiz = arquivosRotasAngularRaiz.size > 0;
    let encontrouSuperficieAngularPorRotas = false;
    const reexportacoes: ReexportacaoTypeScript[] = [];

    for (const arquivo of arquivos) {
      const codigo = adaptadorLeitura
        ? await adaptadorLeitura.lerTexto(arquivo)
        : await readFile(arquivo, "utf8");
      if (/\.(?:vue|svelte)$/i.test(arquivo)) {
        const relacaoSuperficie = path.relative(diretorio, arquivo);
        registrarSuperficieSvelteKitDrift(relacaoSuperficie, arquivo);
        registrarSuperficieNuxtDrift(relacaoSuperficie, arquivo);
        continue;
      }
      const origemArquivo = /\.(?:js|jsx|mjs|cjs)$/i.test(arquivo) ? "js" : "ts";
      const scriptKind = arquivo.endsWith(".tsx")
        ? ts.ScriptKind.TSX
        : arquivo.endsWith(".jsx")
          ? ts.ScriptKind.JSX
          : origemArquivo === "js"
            ? ts.ScriptKind.JS
            : ts.ScriptKind.TS;
      adaptadorLeitura?.emitir?.("ast.create", arquivo);
      const sourceFile = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, scriptKind);
      sourceFiles.set(path.resolve(arquivo), sourceFile);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      const relacao = path.relative(diretorio, arquivo);

      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
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

      const superficieNextJs = arquivoEhSuperficieNextJsConsumer(relacao)
        ? inferirRotaNextJsConsumer(relacao)
        : undefined;
      if (superficieNextJs) {
        consumerSurfaces.set(`${superficieNextJs.rota}:${arquivo}:${superficieNextJs.tipoArquivo}`, {
          rota: superficieNextJs.rota,
          arquivo,
          tipoArquivo: superficieNextJs.tipoArquivo,
        });
        rotas.push({
          origem: "nextjs-consumer",
          metodo: "VIEW",
          caminho: superficieNextJs.rota,
          arquivo,
          simbolo: superficieNextJs.tipoArquivo,
        });
      }

      const superficieReact = arquivoEhSuperficieReactViteConsumer(relacao)
        ? inferirRotaReactViteConsumer(relacao)
        : undefined;
      if (superficieReact) {
        consumerSurfaces.set(`${superficieReact.rota}:${arquivo}:${superficieReact.tipoArquivo}`, {
          rota: superficieReact.rota,
          arquivo,
          tipoArquivo: superficieReact.tipoArquivo,
        });
        rotas.push({
          origem: "react-vite-consumer",
          metodo: "VIEW",
          caminho: superficieReact.rota,
          arquivo,
          simbolo: superficieReact.tipoArquivo,
        });
      }

      registrarSuperficieSvelteKitDrift(relacao, arquivo);
      registrarSuperficieNuxtDrift(relacao, arquivo);

      if (fonteDeclaraRotasReactVite(relacao, sourceFile)) {
        for (const rotaReact of extrairRotasReactViteConsumer(relacao, codigo)) {
          consumerSurfaces.set(`${rotaReact.rota}:${arquivo}:router`, {
            rota: rotaReact.rota,
            arquivo,
            tipoArquivo: "router",
          });
          rotas.push({
            origem: "react-vite-consumer",
            metodo: "VIEW",
            caminho: rotaReact.rota,
            arquivo,
            simbolo: "router",
          });
          if (rotaReact.arquivoComponente) {
            const arquivoComponente = resolverArquivoConsumerCatalogado(
              diretorio,
              rotaReact.arquivoComponente,
              arquivosCatalogadosRaiz,
            );
            if (arquivoComponente) {
              consumerSurfaces.set(`${rotaReact.rota}:${arquivoComponente}:page`, {
                rota: rotaReact.rota,
                arquivo: arquivoComponente,
                tipoArquivo: "page",
              });
            }
          }
        }
      }

      if (arquivoEhRotasAngularConsumer(relacao) && (!usarApenasRotasAngularRaiz || arquivosRotasAngularRaiz.has(path.resolve(arquivo)))) {
        encontrouSuperficieAngularPorRotas = true;
        for (const rotaAngular of await extrairRotasAngularConsumer(
          diretorio,
          relacao,
          "/",
          new Set<string>(),
          adaptadorLeitura,
        )) {
          const arquivoRotasAngular = resolverArquivoConsumerCatalogado(
            diretorio,
            rotaAngular.arquivoRotas,
            arquivosCatalogadosRaiz,
          );
          if (!arquivoRotasAngular) continue;
          consumerSurfaces.set(`${rotaAngular.rota}:${arquivoRotasAngular}:routes`, {
            rota: rotaAngular.rota,
            arquivo: arquivoRotasAngular,
            tipoArquivo: "routes",
          });
          rotas.push({
            origem: "angular-consumer",
            metodo: "VIEW",
            caminho: rotaAngular.rota,
            arquivo: arquivoRotasAngular,
            simbolo: rotaAngular.componente ?? "routes",
          });
          if (rotaAngular.arquivoComponente) {
            const arquivoComponente = resolverArquivoConsumerCatalogado(
              diretorio,
              rotaAngular.arquivoComponente,
              arquivosCatalogadosRaiz,
            );
            if (arquivoComponente) {
              consumerSurfaces.set(`${rotaAngular.rota}:${arquivoComponente}:component`, {
                rota: rotaAngular.rota,
                arquivo: arquivoComponente,
                tipoArquivo: "component",
              });
            }
          }
        }
      }

      for (const node of sourceFile.statements) {
        const reexportacao = extrairReexportacaoTypeScript(diretorio, arquivo, node);
        if (reexportacao) {
          reexportacoes.push(reexportacao);
        }

        if (ts.isFunctionDeclaration(node) && node.name) {
          registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, node.name.text, undefined, origemArquivo);
        }

        if (ts.isVariableStatement(node)) {
          for (const declaracao of node.declarationList.declarations) {
            if (!ts.isIdentifier(declaracao.name) || !declaracao.initializer) {
              continue;
            }
            if (ts.isArrowFunction(declaracao.initializer) || ts.isFunctionExpression(declaracao.initializer)) {
              registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, declaracao.name.text, undefined, origemArquivo);
            }
          }
        }

        if (!ts.isClassDeclaration(node) || !node.name) {
          if (ts.isExpressionStatement(node)) {
            const expr = desembrulharExpressaoTypeScript(node.expression);
            if (ts.isCallExpression(expr)
              && ts.isPropertyAccessExpression(expr.expression)
              && ts.isIdentifier(expr.expression.expression)
              && expr.expression.expression.text === "Object"
              && expr.expression.name.text === "assign") {
              const nomeClasse = expr.arguments[0]
                ? extrairNomeClassePrototypeTypeScript(expr.arguments[0], sourceFile)
                : undefined;
              for (const argumento of expr.arguments.slice(1)) {
                const valor = desembrulharExpressaoTypeScript(argumento);
                if (ts.isObjectLiteralExpression(valor)) {
                  registrarMetodosObjectAssignTypeScript(simbolos, basesSimbolicas, arquivo, valor, sourceFile, nomeClasse, origemArquivo);
                }
              }
            } else if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
              registrarAtribuicaoPrototypeTypeScript(simbolos, basesSimbolicas, arquivo, sourceFile, expr.left, expr.right, origemArquivo);
            }
          }
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

          registrarSimboloTypeScript(simbolos, basesSimbolicas, arquivo, nomeMetodo, node.name.text, origemArquivo);
          const metodoEhInterno = member.modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword);
          for (const baseSimbolica of basesSimbolicas) {
            const caminhoMetodoDireto = `${baseSimbolica}.${nomeMetodo}`;
            if (!simbolos.has(caminhoMetodoDireto)) {
              simbolos.set(caminhoMetodoDireto, { origem: origemArquivo, caminho: caminhoMetodoDireto, arquivo, simbolo: nomeMetodo });
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

    if (!encontrouSuperficieAngularPorRotas) {
      for (const superficie of await coletarSuperficiesAngularStandaloneConsumer(
        diretorio,
        arquivos,
        adaptadorLeitura ? (arquivo) => adaptadorLeitura.lerTexto(arquivo) : undefined,
        sourceFiles,
      )) {
        const arquivoSuperficie = path.join(diretorio, superficie.arquivo);
        consumerSurfaces.set(`${superficie.rota}:${arquivoSuperficie}:${superficie.tipoArquivo}`, {
          rota: superficie.rota,
          arquivo: arquivoSuperficie,
          tipoArquivo: superficie.tipoArquivo,
        });
        rotas.push({
          origem: "angular-consumer",
          metodo: "VIEW",
          caminho: superficie.rota,
          arquivo: arquivoSuperficie,
          simbolo: superficie.tipoArquivo,
        });
      }
    }

    aplicarReexportacoesTypeScript(simbolos, reexportacoes);

  }

  return {
    simbolos: [...simbolos.values()],
    rotas,
    recursos: [...recursos.values()],
    consumerSurfaces: [...consumerSurfaces.values()].sort((a, b) =>
      a.rota.localeCompare(b.rota, "pt-BR")
      || a.tipoArquivo.localeCompare(b.tipoArquivo, "pt-BR")
      || a.arquivo.localeCompare(b.arquivo, "pt-BR")),
  };
}

export interface BlocoPython {
  tipo: "class" | "def";
  nome: string;
  indentacao: number;
}

export function registrarSimboloPython(
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

export function registrarRotasPython(
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
