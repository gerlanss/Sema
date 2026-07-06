// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { compilarProjeto, formatarCodigo, temErros, type Diagnostico } from "@sema/nucleo";
import { normalizarSegmentoModulo } from "@sema/padroes";
import { extrairSimbolosCpp } from "./cpp-symbols.js";
import { extrairRotasDotnet, extrairSimbolosDotnet } from "./dotnet-http.js";
import { extrairRotasGo, extrairSimbolosGo } from "./go-http.js";
import { extrairRotasJava, extrairSimbolosJava } from "./java-http.js";
import { extrairRotasPhp, extrairSimbolosPhp } from "./php-http.js";
import { extrairParametrosCaminhoFlask, extrairRotasFlaskDecoradas } from "./python-http.js";
import { extrairRotasRust, extrairSimbolosRust } from "./rust-http.js";
import {
  extrairRotasTypeScriptHttp,
  inferirSemanticaHandlerTypeScriptHttp,
  localizarExportacaoTypeScriptHttp,
  type CampoInferidoTypeScriptHttp,
} from "./typescript-http.js";
import { coletarSuperficiesAngularStandaloneConsumer } from "./angular-consumer-standalone.js";

import { ArquivoImportado, CampoImportado, ContextoTsArquivo, DatabaseImportado, EfeitoImportado, EntidadeImportada, EnumImportado, ErroImportado, ModuloImportado, OrigemInteropImportada, RecursoDatabaseImportado, RotaImportada, TarefaImportada, TipoDescoberto, VinculoImportado, escaparTexto, normalizarNomeCampoImportado } from "./importador.part01.js";
import { deduplicarCampos } from "./importador.part04.js";
import { extrairTiposTs } from "./importador.part02.js";

export function deduplicarErros(errors: ErroImportado[]): ErroImportado[] {
  const mapa = new Map<string, ErroImportado>();
  for (const erro of errors) {
    if (!mapa.has(erro.nome)) {
      mapa.set(erro.nome, erro);
    }
  }
  return [...mapa.values()];
}

export function deduplicarEfeitos(effects: EfeitoImportado[]): EfeitoImportado[] {
  const mapa = new Map<string, EfeitoImportado>();
  for (const effect of effects) {
    const chave = `${effect.categoria}:${effect.alvo}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, effect);
    }
  }
  return [...mapa.values()];
}

export function deduplicarVinculos(vinculos: VinculoImportado[]): VinculoImportado[] {
  const mapa = new Map<string, VinculoImportado>();
  for (const vinculo of vinculos) {
    const chave = `${vinculo.tipo}:${vinculo.valor}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, vinculo);
    }
  }
  return [...mapa.values()];
}

export function deduplicarEntidades(entities: EntidadeImportada[]): EntidadeImportada[] {
  const mapa = new Map<string, EntidadeImportada>();
  for (const entity of entities) {
    if (!mapa.has(entity.nome)) {
      mapa.set(entity.nome, entity);
    }
  }
  return [...mapa.values()];
}

export function deduplicarEnums(enums: EnumImportado[]): EnumImportado[] {
  const mapa = new Map<string, EnumImportado>();
  for (const enumItem of enums) {
    if (!mapa.has(enumItem.nome)) {
      mapa.set(enumItem.nome, enumItem);
    }
  }
  return [...mapa.values()];
}

export function deduplicarTarefas(tasks: TarefaImportada[]): TarefaImportada[] {
  const mapa = new Map<string, TarefaImportada>();
  for (const task of tasks) {
    if (!mapa.has(task.nome)) {
      mapa.set(task.nome, task);
      continue;
    }
    const existente = mapa.get(task.nome)!;
    existente.input = deduplicarCampos([...existente.input, ...task.input]);
    existente.output = deduplicarCampos([...existente.output, ...task.output]);
    existente.errors = deduplicarErros([...existente.errors, ...task.errors]);
    existente.effects = deduplicarEfeitos([...existente.effects, ...task.effects]);
    existente.vinculos = deduplicarVinculos([...(existente.vinculos ?? []), ...(task.vinculos ?? [])]);
  }
  return [...mapa.values()];
}

export function deduplicarRotas(routes: RotaImportada[]): RotaImportada[] {
  const mapa = new Map<string, RotaImportada>();
  for (const route of routes) {
    const chave = `${route.metodo}:${route.caminho}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, route);
    }
  }
  return [...mapa.values()];
}

export function sincronizarRotasComTasks(routes: RotaImportada[], tasks: TarefaImportada[]): void {
  const mapaTasks = new Map(tasks.map((task) => [task.nome, task]));
  for (const route of routes) {
    const task = mapaTasks.get(route.task);
    if (!task) {
      continue;
    }
    if (route.output.length === 0) {
      route.output = task.output.map((campo) => ({ ...campo, obrigatorio: true }));
    }
    if (route.input.length > 0 && task.input.length > 0) {
      const camposTask = new Map(task.input.map((campo) => [normalizarNomeCampoImportado(campo.nome), campo]));
      route.input = route.input.map((campo) => {
        const correspondente = camposTask.get(normalizarNomeCampoImportado(campo.nome));
        return correspondente
          ? { ...campo, tipo: correspondente.tipo, obrigatorio: correspondente.obrigatorio }
          : campo;
      });
    }
    if (route.errors.length === 0) {
      route.errors = task.errors;
    }
  }
}

export function renderizarCampos(bloco: string, campos: CampoImportado[], indentacao = "  ", sempre = false): string[] {
  if (campos.length === 0 && !sempre) {
    return [];
  }
  return [
    `${indentacao}${bloco} {`,
    ...campos.map((campo) => `${indentacao}  ${normalizarNomeCampoImportado(campo.nome)}: ${campo.tipo}${campo.obrigatorio ? " required" : ""}`),
    `${indentacao}}`,
    "",
  ];
}

export function renderizarErrors(erros: ErroImportado[], indentacao = "  "): string[] {
  if (erros.length === 0) {
    return [];
  }
  return [
    `${indentacao}error {`,
    ...erros.map((erro) => `${indentacao}  ${erro.nome}: "${escaparTexto(erro.mensagem)}"`),
    `${indentacao}}`,
    "",
  ];
}

export function renderizarEffects(effects: EfeitoImportado[], indentacao = "  "): string[] {
  if (effects.length === 0) {
    return [];
  }
  return [
    `${indentacao}effects {`,
    ...effects.map((effect) => `${indentacao}  ${effect.categoria} ${effect.alvo}${effect.criticidade ? ` criticidade = ${effect.criticidade}` : ""}`),
    `${indentacao}}`,
    "",
  ];
}

export function renderizarImpl(impl: Partial<Record<OrigemInteropImportada, string>> | undefined, indentacao = "  "): string[] {
  if (!impl || Object.keys(impl).length === 0) {
    return [];
  }
  return [
    `${indentacao}impl {`,
    ...(impl.ts ? [`${indentacao}  ts: ${impl.ts}`] : []),
    ...(impl.py ? [`${indentacao}  py: ${impl.py}`] : []),
    ...(impl.dart ? [`${indentacao}  dart: ${impl.dart}`] : []),
    ...(impl.cs ? [`${indentacao}  cs: ${impl.cs}`] : []),
    ...(impl.java ? [`${indentacao}  java: ${impl.java}`] : []),
    ...(impl.go ? [`${indentacao}  go: ${impl.go}`] : []),
    ...(impl.rust ? [`${indentacao}  rust: ${impl.rust}`] : []),
    ...(impl.cpp ? [`${indentacao}  cpp: ${impl.cpp}`] : []),
    ...(impl.php ? [`${indentacao}  php: ${impl.php}`] : []),
    `${indentacao}}`,
    "",
  ];
}

export function renderizarValorVinculo(vinculo: VinculoImportado): string {
  if (vinculo.tipo === "simbolo") {
    return vinculo.valor;
  }
  if (vinculo.tipo === "arquivo" || vinculo.valor.includes("/") || vinculo.valor.includes("\\") || vinculo.valor.includes("{")) {
    return `"${escaparTexto(vinculo.valor)}"`;
  }
  return vinculo.valor;
}

export function renderizarVinculos(vinculos: VinculoImportado[] | undefined, indentacao = "  "): string[] {
  if (!vinculos || vinculos.length === 0) {
    return [];
  }
  return [
    `${indentacao}vinculos {`,
    ...vinculos.map((vinculo) => `${indentacao}  ${vinculo.tipo}: ${renderizarValorVinculo(vinculo)}`),
    `${indentacao}}`,
    "",
  ];
}

export function renderizarTask(task: TarefaImportada): string[] {
  const linhas = [
    `  task ${task.nome} {`,
    "    docs {",
    `      resumo: "${escaparTexto(task.resumo)}"`,
    "    }",
    "",
    ...renderizarCampos("input", task.input, "    ", true),
    ...renderizarCampos("output", task.output, "    ", true),
    ...renderizarEffects(task.effects, "    "),
    ...renderizarImpl(task.impl, "    "),
    ...renderizarVinculos(task.vinculos, "    "),
    ...renderizarErrors(task.errors, "    "),
  ];

  linhas.push("    guarantees {");
  for (const campo of task.output) {
    linhas.push(`      ${normalizarNomeCampoImportado(campo.nome)} existe`);
  }
  linhas.push("    }");
  linhas.push("");

  linhas.push("  }");
  linhas.push("");
  return linhas;
}

export function renderizarRoute(route: RotaImportada): string[] {
  const caminhoRenderizado = /[{}]/.test(route.caminho)
    ? `"${escaparTexto(route.caminho)}"`
    : route.caminho;
  return [
    `  route ${route.nome} {`,
    "    docs {",
    `      resumo: "${escaparTexto(route.resumo)}"`,
    "    }",
    "",
    `    metodo: ${route.metodo}`,
    `    caminho: ${caminhoRenderizado}`,
    `    task: ${route.task}`,
    ...renderizarCampos("input", route.input, "    "),
    ...renderizarCampos("output", route.output, "    "),
    ...renderizarErrors(route.errors, "    "),
    "  }",
    "",
  ];
}

export function renderizarEnum(enumItem: EnumImportado): string[] {
  return [
    `  enum ${enumItem.nome} {`,
    `    ${enumItem.valores.join(",\n    ")}`,
    "  }",
    "",
  ];
}

export function renderizarEntidade(entity: EntidadeImportada): string[] {
  return [
    `  entity ${entity.nome} {`,
    "    fields {",
    ...entity.campos.map((campo) => `      ${normalizarNomeCampoImportado(campo.nome)}: ${campo.tipo}`),
    "    }",
    "  }",
    "",
  ];
}

export function renderizarValorDatabase(valor?: string): string | undefined {
  if (!valor) {
    return undefined;
  }
  return /[\s/{}"]/u.test(valor)
    ? `"${escaparTexto(valor)}"`
    : valor;
}

export function renderizarRecursoDatabase(recurso: RecursoDatabaseImportado): string[] {
  const linhas = [`    ${recurso.tipo} ${recurso.nome} {`];
  const mode = renderizarValorDatabase(recurso.mode);
  const table = renderizarValorDatabase(recurso.table);
  const collection = renderizarValorDatabase(recurso.collection);
  const ttl = renderizarValorDatabase(recurso.ttl);
  const surface = renderizarValorDatabase(recurso.surface);

  if (mode) {
    linhas.push(`      mode: ${mode}`);
  }
  if (table) {
    linhas.push(`      table: ${table}`);
  }
  if (collection) {
    linhas.push(`      collection: ${collection}`);
  }
  if (ttl) {
    linhas.push(`      ttl: ${ttl}`);
  }
  if (surface) {
    linhas.push(`      surface: ${surface}`);
  }
  linhas.push("    }");
  linhas.push("");
  return linhas;
}

export function renderizarDatabase(database: DatabaseImportado): string[] {
  const queryModel = renderizarValorDatabase(database.queryModel);
  const transactionModel = renderizarValorDatabase(database.transactionModel);
  return [
    `  database ${database.nome} {`,
    `    engine: ${database.engine}`,
    ...(queryModel ? [`    query_model: ${queryModel}`] : []),
    ...(transactionModel ? [`    transaction_model: ${transactionModel}`] : []),
    ...(database.diagnostics?.length
      ? [
        "    diagnostics {",
        ...database.diagnostics.map((diagnostico) => `      ${diagnostico}`),
        "    }",
      ]
      : []),
    ...database.resources.flatMap(renderizarRecursoDatabase),
    "  }",
    "",
  ];
}

export function moduloParaCodigo(modulo: ModuloImportado): string {
  const linhas = [
    `module ${modulo.nome} {`,
    "  docs {",
    `    resumo: "${escaparTexto(modulo.resumo)}"`,
    "  }",
    "",
    ...renderizarVinculos(modulo.vinculos, "  "),
    ...(modulo.databases ?? []).flatMap(renderizarDatabase),
    ...modulo.enums.flatMap(renderizarEnum),
    ...modulo.entities.flatMap(renderizarEntidade),
    ...modulo.tasks.flatMap(renderizarTask),
    ...modulo.routes.flatMap(renderizarRoute),
    "}",
    "",
  ];

  return linhas.join("\n");
}

export async function formatarModuloImportado(codigo: string, caminhoVirtual: string): Promise<string> {
  const formatado = formatarCodigo(codigo, caminhoVirtual);
  return formatado.codigoFormatado ?? codigo;
}

export function nomeArquivoModulo(modulo: string): string {
  const segmentos = modulo.split(".");
  return `${segmentos.at(-1) ?? "modulo"}.sema`;
}

export function contextoArquivoModulo(modulo: string, namespaceBase: string): string {
  const prefixo = namespaceBase.split(".");
  const segmentos = modulo.split(".");
  const relativos = segmentos.slice(prefixo.length, -1);
  return relativos.length ? path.join(...relativos) : "";
}

export function montarArquivoImportado(modulo: ModuloImportado, namespaceBase: string, conteudo: string): ArquivoImportado {
  const pasta = contextoArquivoModulo(modulo.nome, namespaceBase);
  const caminhoRelativo = pasta ? path.join(pasta, nomeArquivoModulo(modulo.nome)) : nomeArquivoModulo(modulo.nome);
  return {
    caminhoRelativo,
    conteudo,
    modulo: modulo.nome,
    tarefas: modulo.tasks.length,
    rotas: modulo.routes.length,
    entidades: modulo.entities.length,
    enums: modulo.enums.length,
    databases: modulo.databases?.length ?? 0,
  };
}

export function consolidarTiposTs(contextos: ContextoTsArquivo[]): Map<string, TipoDescoberto> {
  const tipos = new Map<string, TipoDescoberto>();
  for (const contexto of contextos) {
    for (const [nome, tipo] of extrairTiposTs(contexto.sourceFile)) {
      if (!tipos.has(nome)) {
        tipos.set(nome, tipo);
      }
    }
  }
  return tipos;
}
