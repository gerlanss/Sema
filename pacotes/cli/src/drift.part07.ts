// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: indexa linguagens legadas sem reabrir fontes fora do catalogo do drift.

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
import { extrairRotasPhp, extrairSimbolosPhp } from "./php-http.js";
import { contarIndentacaoPython, extrairRotasFlaskDecoradas, normalizarCaminhoFlask } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import { extrairRotasTypeScriptHttp } from "./typescript-http.js";
import { emitirDiagnosticosArquivosOrcamento } from "./driftOrcamento.js";

import { OrigemRecursoDrift, RecursoResolvido, RegistroColunaPersistenciaDrift, RegistroConsumerSurfaceDrift, RotaResolvida, SimboloResolvido, categorizarPersistenciaPorOrigem } from "./drift.part01.js";
import {
  caminhosSimbolicos,
  chaveCaminhoCanonicoDrift,
  deduplicarRaizesSobrepostasDrift,
  listarArquivosRecursivos,
  type AdaptadorLeituraCompartilhadaDrift,
} from "./drift.part04.js";
import { extrairRecursosPersistenciaCodigoVivo, extrairRecursosPrisma, extrairSimbolosSqlDeclarativos, recursoEhIgnorado, registrarRecursoDrift } from "./drift.part03.js";
import { BlocoPython, registrarRotasPython, registrarSimboloPython } from "./drift.part06.js";
import { arquivoEhRotasFlutterConsumer, extrairRotasFlutterConsumer, inferirRotaFlutterConsumer } from "./drift.part05.js";
import { fecharPrefixoRecurso, limparLiteralRecurso, normalizarNomeRecursoDrift } from "./drift.part02.js";

interface ArquivoIndexacaoCompartilhadaDrift {
  diretorio: string;
  arquivo: string;
}

async function listarArquivosIndexacaoCompartilhada(
  diretorios: string[],
  extensoes: string[],
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<ArquivoIndexacaoCompartilhadaDrift[]> {
  const arquivos = new Map<string, ArquivoIndexacaoCompartilhadaDrift>();
  for (const diretorio of deduplicarRaizesSobrepostasDrift(diretorios)) {
    for (const arquivo of await listarArquivosRecursivos(diretorio, extensoes, adaptadorLeitura)) {
      const chave = chaveCaminhoCanonicoDrift(arquivo);
      if (!arquivos.has(chave)) {
        arquivos.set(chave, { diretorio, arquivo });
      }
    }
  }
  return [...arquivos.values()];
}

async function lerTextoIndexacaoCompartilhada(
  arquivo: string,
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<string> {
  return adaptadorLeitura
    ? adaptadorLeitura.lerTexto(arquivo)
    : readFile(arquivo, "utf8");
}

export async function indexarPython(
  diretorios: string[],
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  adaptadorLeitura?.emitir?.("extractor.run");
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  const arquivos = (await listarArquivosIndexacaoCompartilhada(diretorios, [".py"], adaptadorLeitura))
    .filter(({ arquivo }) => !arquivo.endsWith("__init__.py") && !/tests?[\\/]/i.test(arquivo));
  for (const { diretorio, arquivo } of arquivos) {
      const texto = await lerTextoIndexacaoCompartilhada(arquivo, adaptadorLeitura);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      const prefixo = texto.match(/APIRouter\s*\(\s*prefix\s*=\s*["']([^"']+)["']/)?.[1];
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, texto)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
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

  return { simbolos: [...simbolos.values()], rotas, recursos: [...recursos.values()] };
}

export async function indexarDart(
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

  const arquivos = (await listarArquivosIndexacaoCompartilhada(diretorios, [".dart"], adaptadorLeitura))
    .filter(({ arquivo }) => !arquivo.endsWith(".g.dart") && !arquivo.endsWith(".freezed.dart"));
  for (const { diretorio, arquivo } of arquivos) {
      const texto = await lerTextoIndexacaoCompartilhada(arquivo, adaptadorLeitura);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      const relacao = path.relative(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, texto)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }

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

      const superficieFlutter = inferirRotaFlutterConsumer(relacao);
      if (superficieFlutter) {
        consumerSurfaces.set(`${superficieFlutter.rota}:${arquivo}:${superficieFlutter.tipoArquivo}`, {
          rota: superficieFlutter.rota,
          arquivo,
          tipoArquivo: superficieFlutter.tipoArquivo,
        });
        rotas.push({
          origem: "flutter-consumer",
          metodo: "VIEW",
          caminho: superficieFlutter.rota,
          arquivo,
          simbolo: superficieFlutter.tipoArquivo,
        });
      }

      if (arquivoEhRotasFlutterConsumer(relacao, texto)) {
        for (const rotaFlutter of extrairRotasFlutterConsumer(relacao, texto)) {
          consumerSurfaces.set(`${rotaFlutter.rota}:${arquivo}:router`, {
            rota: rotaFlutter.rota,
            arquivo,
            tipoArquivo: "router",
          });
          rotas.push({
            origem: "flutter-consumer",
            metodo: "VIEW",
            caminho: rotaFlutter.rota,
            arquivo,
            simbolo: "router",
          });
        }
      }
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

export function registrarSimboloGenerico(
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

export async function indexarDotnet(
  diretorios: string[],
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  adaptadorLeitura?.emitir?.("extractor.run");
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  const arquivos = (await listarArquivosIndexacaoCompartilhada(diretorios, [".cs"], adaptadorLeitura))
    .filter(({ arquivo }) => !/(^|[\\/])(bin|obj|Test[s]?)([\\/]|$)/i.test(arquivo));
  for (const { diretorio, arquivo } of arquivos) {
      const codigo = await lerTextoIndexacaoCompartilhada(arquivo, adaptadorLeitura);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
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

  return { simbolos: [...simbolos.values()], rotas, recursos: [...recursos.values()] };
}

export async function indexarJava(
  diretorios: string[],
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  adaptadorLeitura?.emitir?.("extractor.run");
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  const arquivos = (await listarArquivosIndexacaoCompartilhada(diretorios, [".java"], adaptadorLeitura))
    .filter(({ arquivo }) => !/(^|[\\/])(target|build|out|Test[s]?)([\\/]|$)/i.test(arquivo));
  for (const { diretorio, arquivo } of arquivos) {
      const codigo = await lerTextoIndexacaoCompartilhada(arquivo, adaptadorLeitura);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
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

  return { simbolos: [...simbolos.values()], rotas, recursos: [...recursos.values()] };
}

export async function indexarGo(
  diretorios: string[],
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  adaptadorLeitura?.emitir?.("extractor.run");
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  const arquivos = await listarArquivosIndexacaoCompartilhada(diretorios, [".go"], adaptadorLeitura);
  for (const { diretorio, arquivo } of arquivos) {
      const codigo = await lerTextoIndexacaoCompartilhada(arquivo, adaptadorLeitura);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
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

  return { simbolos: [...simbolos.values()], rotas, recursos: [...recursos.values()] };
}

export async function indexarRust(
  diretorios: string[],
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  adaptadorLeitura?.emitir?.("extractor.run");
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  const arquivos = await listarArquivosIndexacaoCompartilhada(diretorios, [".rs"], adaptadorLeitura);
  for (const { diretorio, arquivo } of arquivos) {
      const codigo = await lerTextoIndexacaoCompartilhada(arquivo, adaptadorLeitura);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
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

  return { simbolos: [...simbolos.values()], rotas, recursos: [...recursos.values()] };
}

export async function indexarCpp(
  diretorios: string[],
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<{ simbolos: SimboloResolvido[]; recursos: RecursoResolvido[] }> {
  adaptadorLeitura?.emitir?.("extractor.run");
  const simbolos = new Map<string, SimboloResolvido>();
  const recursos = new Map<string, RecursoResolvido>();

  const arquivos = (await listarArquivosIndexacaoCompartilhada(
    diretorios,
    [".cpp", ".cc", ".cxx", ".hpp", ".h"],
    adaptadorLeitura,
  )).filter(({ arquivo }) => !/(^|[\\/])(windows|linux|macos|runner|flutter|ephemeral|build|vendor)([\\/]|$)/i.test(arquivo));
  for (const { diretorio, arquivo } of arquivos) {
      const codigo = await lerTextoIndexacaoCompartilhada(arquivo, adaptadorLeitura);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
      for (const simbolo of extrairSimbolosCpp(codigo)) {
        registrarSimboloGenerico(simbolos, "cpp", basesSimbolicas, arquivo, simbolo.simbolo);
      }
  }

  return {
    simbolos: [...simbolos.values()],
    recursos: [...recursos.values()],
  };
}

export async function indexarPhp(
  diretorios: string[],
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<{ simbolos: SimboloResolvido[]; rotas: RotaResolvida[]; recursos: RecursoResolvido[] }> {
  adaptadorLeitura?.emitir?.("extractor.run");
  const simbolos = new Map<string, SimboloResolvido>();
  const rotas: RotaResolvida[] = [];
  const recursos = new Map<string, RecursoResolvido>();

  const arquivos = (await listarArquivosIndexacaoCompartilhada(diretorios, [".php"], adaptadorLeitura))
    .filter(({ arquivo }) => !/(^|[\\/])(vendor|storage|bootstrap[\\/]cache|cache|tests?)([\\/]|$)/i.test(arquivo));
  for (const { diretorio, arquivo } of arquivos) {
      const codigo = await lerTextoIndexacaoCompartilhada(arquivo, adaptadorLeitura);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
      for (const simbolo of extrairSimbolosPhp(codigo)) {
        registrarSimboloGenerico(simbolos, "php", basesSimbolicas, arquivo, simbolo.simbolo);
        for (const alias of simbolo.aliases ?? []) {
          simbolos.set(alias, {
            origem: "php",
            caminho: alias,
            arquivo,
            simbolo: simbolo.simbolo,
          });
        }
      }
      for (const rota of extrairRotasPhp(codigo)) {
        rotas.push({
          origem: "php",
          metodo: rota.metodo,
          caminho: rota.caminho,
          arquivo,
          simbolo: rota.simbolo,
        });
      }
  }

  return {
    simbolos: [...simbolos.values()],
    rotas,
    recursos: [...recursos.values()],
  };
}

export async function indexarLua(
  diretorios: string[],
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<{ simbolos: SimboloResolvido[]; recursos: RecursoResolvido[] }> {
  adaptadorLeitura?.emitir?.("extractor.run");
  const simbolos = new Map<string, SimboloResolvido>();
  const recursos = new Map<string, RecursoResolvido>();

  const arquivos = (await listarArquivosIndexacaoCompartilhada(diretorios, [".lua"], adaptadorLeitura))
    .filter(({ arquivo }) => !/(^|[\\/])(vendor|build|dist|generated|tests?)([\\/]|$)/i.test(arquivo));
  for (const { diretorio, arquivo } of arquivos) {
      const codigo = await lerTextoIndexacaoCompartilhada(arquivo, adaptadorLeitura);
      const basesSimbolicas = caminhosSimbolicos(diretorio, arquivo);
      for (const recurso of extrairRecursosPersistenciaCodigoVivo(arquivo, codigo)) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
      for (const simbolo of extrairSimbolosLua(codigo)) {
        registrarSimboloGenerico(simbolos, "lua", basesSimbolicas, arquivo, simbolo.simbolo);
      }
  }

  return {
    simbolos: [...simbolos.values()],
    recursos: [...recursos.values()],
  };
}

export async function indexarPersistenciaDeclarativa(
  diretorios: string[],
  adaptadorLeitura?: AdaptadorLeituraCompartilhadaDrift,
): Promise<{ recursos: RecursoResolvido[]; simbolos: SimboloResolvido[] }> {
  adaptadorLeitura?.emitir?.("extractor.run");
  const recursos = new Map<string, RecursoResolvido>();
  const simbolos = new Map<string, SimboloResolvido>();

  const arquivos = await listarArquivosIndexacaoCompartilhada(diretorios, [
      ".sql", ".psql", ".ddl", ".prisma",
      ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
      ".py", ".dart", ".lua", ".cs", ".java", ".go", ".rs", ".cpp", ".cc", ".cxx", ".hpp", ".h", ".php",
    ], adaptadorLeitura);
  for (const { arquivo } of arquivos) {
      const codigo = await lerTextoIndexacaoCompartilhada(arquivo, adaptadorLeitura);
      const extracoes = arquivo.endsWith(".prisma")
        ? extrairRecursosPrisma(arquivo, codigo)
        : extrairRecursosPersistenciaCodigoVivo(arquivo, codigo);
      for (const recurso of extracoes) {
        registrarRecursoDrift(recursos, recurso.origem, recurso.tipo, recurso.nome, recurso.arquivo, recurso.simbolo);
      }
      for (const simbolo of extrairSimbolosSqlDeclarativos(arquivo, codigo)) {
        simbolos.set(`${simbolo.caminho}:${simbolo.arquivo}`, simbolo);
      }
  }

  return { recursos: [...recursos.values()], simbolos: [...simbolos.values()] };
}

export function normalizarOrigemParaEngine(origem?: OrigemRecursoDrift): EngineBanco | undefined {
  return origem && origem !== "firebase" && origem !== "arquivo" ? origem : undefined;
}

export function registrarColunaPersistenciaDrift(
  colunas: Map<string, RegistroColunaPersistenciaDrift>,
  origem: OrigemRecursoDrift,
  recurso: string,
  coluna: string,
  arquivo: string,
): void {
  const recursoNormalizado = fecharPrefixoRecurso(limparLiteralRecurso(recurso));
  const colunaNormalizada = fecharPrefixoRecurso(limparLiteralRecurso(coluna));
  if (!recursoNormalizado || !colunaNormalizada || recursoEhIgnorado(colunaNormalizada)) {
    return;
  }
  const chave = `${origem}:${normalizarNomeRecursoDrift(recursoNormalizado)}:${normalizarNomeRecursoDrift(colunaNormalizada)}:${arquivo}`;
  if (!colunas.has(chave)) {
    colunas.set(chave, {
      origem,
      categoriaPersistencia: categorizarPersistenciaPorOrigem(origem),
      recurso: recursoNormalizado,
      coluna: colunaNormalizada,
      arquivo,
    });
  }
}
