import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { compilarProjeto, formatarCodigo, temErros, type Diagnostico } from "@sema/nucleo";
import { normalizarSegmentoModulo } from "@sema/padroes";

export type FonteImportacao = "nestjs" | "fastapi" | "typescript" | "python" | "dart";

interface CampoImportado {
  nome: string;
  tipo: string;
  obrigatorio: boolean;
}

interface ErroImportado {
  nome: string;
  mensagem: string;
}

interface EfeitoImportado {
  categoria: "persistencia" | "consulta" | "evento" | "notificacao" | "auditoria";
  alvo: string;
  criticidade?: "baixa" | "media" | "alta";
}

interface EnumImportado {
  nome: string;
  valores: string[];
}

interface EntidadeImportada {
  nome: string;
  campos: CampoImportado[];
}

interface TarefaImportada {
  nome: string;
  resumo: string;
  input: CampoImportado[];
  output: CampoImportado[];
  errors: ErroImportado[];
  effects: EfeitoImportado[];
  impl?: Partial<Record<"ts" | "py" | "dart", string>>;
  origemArquivo: string;
  origemSimbolo: string;
}

interface RotaImportada {
  nome: string;
  resumo: string;
  metodo: string;
  caminho: string;
  task: string;
  input: CampoImportado[];
  output: CampoImportado[];
  errors: ErroImportado[];
}

interface ModuloImportado {
  nome: string;
  resumo: string;
  enums: EnumImportado[];
  entities: EntidadeImportada[];
  tasks: TarefaImportada[];
  routes: RotaImportada[];
}

export interface ArquivoImportado {
  caminhoRelativo: string;
  conteudo: string;
  modulo: string;
  tarefas: number;
  rotas: number;
  entidades: number;
  enums: number;
}

export interface ResultadoImportacao {
  fonte: FonteImportacao;
  diretorio: string;
  namespaceBase: string;
  arquivos: ArquivoImportado[];
  diagnosticos: Diagnostico[];
}

interface TipoObjetoDescoberto {
  tipo: "objeto";
  nome: string;
  campos: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
}

interface TipoEnumDescoberto {
  tipo: "enum";
  nome: string;
  valores: string[];
}

type TipoDescoberto = TipoObjetoDescoberto | TipoEnumDescoberto;

interface ContextoTsArquivo {
  sourceFile: ts.SourceFile;
  texto: string;
  relacao: string;
}

interface TipoPythonDescoberto {
  tipo: "objeto" | "enum";
  nome: string;
  campos?: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>;
  valores?: string[];
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

const SUFIXOS_WRAPPER = ["Entrada", "Saida", "Dto", "Request", "Response", "Payload", "Body", "Input", "Output"];

function escaparTexto(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function paraSnakeCase(valor: string): string {
  return valor
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function paraIdentificadorModulo(valor: string): string {
  return normalizarSegmentoModulo(valor).replace(/_+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function nomeProjetoPadrao(diretorio: string): string {
  const base = path.basename(diretorio);
  if (["src", "app", "api", "backend", "server"].includes(base.toLowerCase())) {
    return `${path.basename(path.dirname(diretorio))}.${base}`;
  }
  return base;
}

export function inferirNamespaceBase(diretorio: string, namespaceExplicito?: string): string {
  if (namespaceExplicito) {
    return namespaceExplicito
      .split(".")
      .map((segmento) => paraIdentificadorModulo(segmento))
      .filter(Boolean)
      .join(".");
  }

  return ["legado", ...nomeProjetoPadrao(diretorio).split(/[\\/._-]+/g)]
    .map((segmento) => paraIdentificadorModulo(segmento))
    .filter(Boolean)
    .join(".");
}

async function listarArquivosRecursivos(
  diretorio: string,
  extensoes: string[],
): Promise<string[]> {
  const entradas = await readdir(diretorio, { withFileTypes: true });
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

function inferirContextoPorArquivo(relacao: string): string[] {
  const semExtensao = relacao.replace(/\.[^.]+$/, "");
  const segmentos = semExtensao.split(path.sep).map((segmento) => paraIdentificadorModulo(segmento)).filter(Boolean);
  if (segmentos[0] === "src" || segmentos[0] === "app") {
    segmentos.shift();
  }

  const ultimo = segmentos.at(-1) ?? "";
  const semSufixo = ultimo
    .replace(/(\.controller|\.service|\.module|_router|_service|_schemas|_contract)$/g, "")
    .replace(/(controller|service|module|router|schemas|contract)$/g, "")
    .replace(/_+$/g, "");

  if (segmentos.length === 0) {
    return ["importado"];
  }

  if (semSufixo && semSufixo !== ultimo) {
    segmentos[segmentos.length - 1] = semSufixo;
  }

  if (segmentos.length > 1 && segmentos[segmentos.length - 1] === segmentos[segmentos.length - 2]) {
    segmentos.pop();
  }

  return segmentos;
}

function juntarCaminhoHttp(base: string | undefined, sufixo: string | undefined): string {
  const partes = [base ?? "", sufixo ?? ""]
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^\/+|\/+$/g, ""));

  const caminho = `/${partes.join("/")}`.replace(/\/+/g, "/");
  return caminho === "//" ? "/" : caminho;
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

function mapearTipoPrimitivo(tipo: string): string {
  const limpo = tipo.trim().replace(/\s+/g, "");
  const base = limpo
    .replace(/^Promise<(.*)>$/, "$1")
    .replace(/\|undefined/g, "")
    .replace(/\|null/g, "")
    .replace(/\bundefined\|/g, "")
    .replace(/\bnull\|/g, "")
    .trim();

  const minusculo = base.toLowerCase();
  if (minusculo === "string" || minusculo === "texto") {
    return "Texto";
  }
  if (minusculo === "number" || minusculo === "float" || minusculo === "double") {
    return "Decimal";
  }
  if (minusculo === "int" || minusculo === "integer" || minusculo === "inteiro") {
    return "Inteiro";
  }
  if (minusculo === "boolean" || minusculo === "bool") {
    return "Booleano";
  }
  if (minusculo === "date") {
    return "Data";
  }
  if (minusculo === "datetime" || minusculo === "timestamp") {
    return "DataHora";
  }
  if (minusculo === "id" || minusculo.endsWith("id")) {
    return "Id";
  }
  if (minusculo.includes("[]") || minusculo.startsWith("array<") || minusculo.startsWith("record<") || minusculo.startsWith("list[") || minusculo.startsWith("dict[")) {
    return "Json";
  }
  if (minusculo === "json" || minusculo === "object" || minusculo === "unknown" || minusculo === "any" || minusculo === "void" || minusculo === "none") {
    return minusculo === "void" || minusculo === "none" ? "Vazio" : "Json";
  }
  return tipo.trim();
}

function pareceWrapperTipo(nome: string): boolean {
  return SUFIXOS_WRAPPER.some((sufixo) => nome.endsWith(sufixo)) || /(entrada|saida|dto|request|response|payload|body|input|output)/i.test(nome);
}

function descreverEfeitosPorHeuristica(codigo: string): EfeitoImportado[] {
  const texto = codigo.toLowerCase();
  const efeitos: EfeitoImportado[] = [];

  const adicionar = (categoria: EfeitoImportado["categoria"], alvo: string, criticidade?: EfeitoImportado["criticidade"]) => {
    if (!efeitos.some((efeito) => efeito.categoria === categoria && efeito.alvo === alvo)) {
      efeitos.push({ categoria, alvo, criticidade });
    }
  };

  if (/(prisma\.|repository\.|\.create\(|\.update\(|\.delete\(|\.save\()/i.test(codigo)) {
    adicionar("persistencia", "banco", "alta");
  }
  if (/(findmany|findunique|findfirst|\.find\(|\.select\(|\.query\(|\.get\()/i.test(texto)) {
    adicionar("consulta", "dados", "media");
  }
  if (/(emit\(|publish\(|dispatch\(|eventbus|event_emitter)/i.test(texto)) {
    adicionar("evento", "dominio", "media");
  }
  if (/(notify|notification|sendmessage|send_email|telegram|smtp|mail)/i.test(texto)) {
    adicionar("notificacao", "usuarios", "media");
  }
  if (/(audit|logger|logging|log\.|trace|observability)/i.test(texto)) {
    adicionar("auditoria", "operacao", "baixa");
  }

  return efeitos;
}

function normalizarNomeErroBruto(nome: string): string {
  return paraSnakeCase(nome.replace(/(Error|Erro|Exception)$/i, "")) || "erro_importado";
}

function extrairErrosTs(node: ts.Node, sourceFile: ts.SourceFile): ErroImportado[] {
  const encontrados = new Map<string, string>();

  const visitar = (atual: ts.Node): void => {
    if (ts.isThrowStatement(atual) && atual.expression) {
      const expressao = atual.expression;
      if (ts.isNewExpression(expressao)) {
        const nomeErro = expressao.expression.getText(sourceFile);
        const mensagem = extrairTextoLiteral(expressao.arguments?.[0]) ?? `Erro importado automaticamente de ${nomeErro}.`;
        encontrados.set(normalizarNomeErroBruto(nomeErro), mensagem);
      }
    }
    atual.forEachChild(visitar);
  };

  node.forEachChild(visitar);
  return [...encontrados.entries()].map(([nome, mensagem]) => ({ nome, mensagem }));
}

function extrairTiposTs(sourceFile: ts.SourceFile): Map<string, TipoDescoberto> {
  const tipos = new Map<string, TipoDescoberto>();

  const adicionarObjeto = (nome: string, campos: Array<{ nome: string; tipoTexto?: string; obrigatorio: boolean }>) => {
    if (!campos.length || tipos.has(nome)) {
      return;
    }
    tipos.set(nome, { tipo: "objeto", nome, campos });
  };

  const adicionarEnum = (nome: string, valores: string[]) => {
    if (!valores.length || tipos.has(nome)) {
      return;
    }
    tipos.set(nome, { tipo: "enum", nome, valores });
  };

  sourceFile.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const campos = node.members
        .filter(ts.isPropertySignature)
        .map((member) => ({
          nome: member.name.getText(sourceFile),
          tipoTexto: member.type?.getText(sourceFile),
          obrigatorio: !member.questionToken,
        }));
      adicionarObjeto(node.name.text, campos);
      return;
    }

    if (ts.isClassDeclaration(node) && node.name) {
      const campos = node.members
        .filter((member): member is ts.PropertyDeclaration => ts.isPropertyDeclaration(member) && Boolean(member.name))
        .map((member) => ({
          nome: member.name.getText(sourceFile),
          tipoTexto: member.type?.getText(sourceFile),
          obrigatorio: !member.questionToken,
        }));
      adicionarObjeto(node.name.text, campos);
      return;
    }

    if (ts.isTypeAliasDeclaration(node) && node.name) {
      if (ts.isUnionTypeNode(node.type) && node.type.types.every((tipo) => ts.isLiteralTypeNode(tipo) && ts.isStringLiteralLike(tipo.literal))) {
        adicionarEnum(
          node.name.text,
          node.type.types
            .map((tipo) => ts.isLiteralTypeNode(tipo) && ts.isStringLiteralLike(tipo.literal) ? tipo.literal.text : undefined)
            .filter((valor): valor is string => Boolean(valor)),
        );
        return;
      }
      if (ts.isTypeLiteralNode(node.type)) {
        const campos = node.type.members
          .filter(ts.isPropertySignature)
          .map((member) => ({
            nome: member.name.getText(sourceFile),
            tipoTexto: member.type?.getText(sourceFile),
            obrigatorio: !member.questionToken,
          }));
        adicionarObjeto(node.name.text, campos);
      }
    }
  });

  return tipos;
}

function mapearTipoTsParaSema(
  tipoTexto: string | undefined,
  tipos: Map<string, TipoDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): string {
  if (!tipoTexto) {
    return "Json";
  }

  const basico = mapearTipoPrimitivo(tipoTexto);
  if (basico !== tipoTexto.trim()) {
    return basico;
  }

  const limpo = tipoTexto
    .trim()
    .replace(/^Promise<(.*)>$/, "$1")
    .replace(/\| undefined/g, "")
    .replace(/\| null/g, "")
    .replace(/Readonly<(.+)>/, "$1")
    .replace(/Partial<(.+)>/, "$1")
    .trim();

  if (tipos.has(limpo)) {
    const encontrado = tipos.get(limpo)!;
    if (encontrado.tipo === "enum") {
      enumsReferenciados.add(encontrado.nome);
      return encontrado.nome;
    }

    if (!pareceWrapperTipo(encontrado.nome)) {
      entidadesReferenciadas.add(encontrado.nome);
      return encontrado.nome;
    }
  }

  return "Json";
}

function expandirCamposTs(
  nomeParametro: string,
  tipoTexto: string | undefined,
  tipos: Map<string, TipoDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
  obrigatorio: boolean,
): CampoImportado[] {
  if (!tipoTexto) {
    return [{ nome: paraSnakeCase(nomeParametro), tipo: "Json", obrigatorio }];
  }

  const limpo = tipoTexto
    .trim()
    .replace(/^Promise<(.*)>$/, "$1")
    .replace(/\| undefined/g, "")
    .replace(/\| null/g, "")
    .replace(/Readonly<(.+)>/, "$1")
    .replace(/Partial<(.+)>/, "$1")
    .trim();

  const descoberto = tipos.get(limpo);
  if (descoberto?.tipo === "objeto" && pareceWrapperTipo(descoberto.nome)) {
    return descoberto.campos.map((campo) => ({
      nome: paraSnakeCase(campo.nome),
      tipo: mapearTipoTsParaSema(campo.tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
      obrigatorio: campo.obrigatorio,
    }));
  }

  return [{
    nome: paraSnakeCase(nomeParametro),
    tipo: mapearTipoTsParaSema(tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
    obrigatorio,
  }];
}

function criarEntidadesReferenciadas(
  tipos: Map<string, TipoDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): { entities: EntidadeImportada[]; enums: EnumImportado[] } {
  const fila = [...entidadesReferenciadas];
  const processadas = new Set<string>();
  const entities: EntidadeImportada[] = [];

  while (fila.length > 0) {
    const nomeAtual = fila.shift()!;
    if (processadas.has(nomeAtual)) {
      continue;
    }
    processadas.add(nomeAtual);
    const tipo = tipos.get(nomeAtual);
    if (!tipo || tipo.tipo !== "objeto") {
      continue;
    }

    const entidade: EntidadeImportada = {
      nome: tipo.nome,
      campos: tipo.campos.map((campo) => ({
        nome: paraSnakeCase(campo.nome),
        tipo: mapearTipoTsParaSema(campo.tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
        obrigatorio: campo.obrigatorio,
      })),
    };
    entities.push(entidade);

    for (const referenciado of entidadesReferenciadas) {
      if (!processadas.has(referenciado) && !fila.includes(referenciado)) {
        fila.push(referenciado);
      }
    }
  }

  const enums = [...enumsReferenciados]
    .map((nome) => tipos.get(nome))
    .filter((item): item is TipoEnumDescoberto => Boolean(item && item.tipo === "enum"))
    .map((tipo) => ({
      nome: tipo.nome,
      valores: tipo.valores,
    }))
    .filter((enumItem, indice, lista) => lista.findIndex((item) => item.nome === enumItem.nome) === indice);

  return { entities: deduplicarEntidades(entities), enums };
}

function caminhoImplTs(diretorioBase: string, arquivo: string, simbolo: string): string {
  const relativo = path.relative(diretorioBase, arquivo).replace(/\.[^.]+$/, "");
  const segmentos = relativo.split(path.sep).map((segmento) => paraIdentificadorModulo(segmento)).filter(Boolean);
  return [...segmentos, simbolo].join(".");
}

function extrairChamadaServiceTs(node: ts.Node): string | undefined {
  let encontrado: string | undefined;
  const visitar = (atual: ts.Node): void => {
    if (encontrado) {
      return;
    }
    if (ts.isCallExpression(atual) && ts.isPropertyAccessExpression(atual.expression)) {
      const alvo = atual.expression.expression;
      if (ts.isPropertyAccessExpression(alvo) && alvo.expression.kind === ts.SyntaxKind.ThisKeyword && alvo.name.text.endsWith("Service")) {
        encontrado = atual.expression.name.text;
        return;
      }
    }
    atual.forEachChild(visitar);
  };
  node.forEachChild(visitar);
  return encontrado;
}

function deduplicarCampos(campos: CampoImportado[]): CampoImportado[] {
  const mapa = new Map<string, CampoImportado>();
  for (const campo of campos) {
    if (!mapa.has(campo.nome)) {
      mapa.set(campo.nome, campo);
    }
  }
  return [...mapa.values()];
}

function deduplicarErros(errors: ErroImportado[]): ErroImportado[] {
  const mapa = new Map<string, ErroImportado>();
  for (const erro of errors) {
    if (!mapa.has(erro.nome)) {
      mapa.set(erro.nome, erro);
    }
  }
  return [...mapa.values()];
}

function deduplicarEfeitos(effects: EfeitoImportado[]): EfeitoImportado[] {
  const mapa = new Map<string, EfeitoImportado>();
  for (const effect of effects) {
    const chave = `${effect.categoria}:${effect.alvo}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, effect);
    }
  }
  return [...mapa.values()];
}

function deduplicarEntidades(entities: EntidadeImportada[]): EntidadeImportada[] {
  const mapa = new Map<string, EntidadeImportada>();
  for (const entity of entities) {
    if (!mapa.has(entity.nome)) {
      mapa.set(entity.nome, entity);
    }
  }
  return [...mapa.values()];
}

function deduplicarEnums(enums: EnumImportado[]): EnumImportado[] {
  const mapa = new Map<string, EnumImportado>();
  for (const enumItem of enums) {
    if (!mapa.has(enumItem.nome)) {
      mapa.set(enumItem.nome, enumItem);
    }
  }
  return [...mapa.values()];
}

function deduplicarTarefas(tasks: TarefaImportada[]): TarefaImportada[] {
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
  }
  return [...mapa.values()];
}

function deduplicarRotas(routes: RotaImportada[]): RotaImportada[] {
  const mapa = new Map<string, RotaImportada>();
  for (const route of routes) {
    const chave = `${route.metodo}:${route.caminho}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, route);
    }
  }
  return [...mapa.values()];
}

function sincronizarRotasComTasks(routes: RotaImportada[], tasks: TarefaImportada[]): void {
  const mapaTasks = new Map(tasks.map((task) => [task.nome, task]));
  for (const route of routes) {
    const task = mapaTasks.get(route.task);
    if (!task) {
      continue;
    }
    if (route.output.length === 0) {
      route.output = task.output.map((campo) => ({ ...campo, obrigatorio: true }));
    }
    if (route.errors.length === 0) {
      route.errors = task.errors;
    }
  }
}

function renderizarCampos(bloco: string, campos: CampoImportado[], indentacao = "  ", sempre = false): string[] {
  if (campos.length === 0 && !sempre) {
    return [];
  }
  return [
    `${indentacao}${bloco} {`,
    ...campos.map((campo) => `${indentacao}  ${campo.nome}: ${campo.tipo}${campo.obrigatorio ? " required" : ""}`),
    `${indentacao}}`,
    "",
  ];
}

function renderizarErrors(erros: ErroImportado[], indentacao = "  "): string[] {
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

function renderizarEffects(effects: EfeitoImportado[], indentacao = "  "): string[] {
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

function renderizarImpl(impl: Partial<Record<"ts" | "py" | "dart", string>> | undefined, indentacao = "  "): string[] {
  if (!impl || Object.keys(impl).length === 0) {
    return [];
  }
  return [
    `${indentacao}impl {`,
    ...(impl.ts ? [`${indentacao}  ts: ${impl.ts}`] : []),
    ...(impl.py ? [`${indentacao}  py: ${impl.py}`] : []),
    ...(impl.dart ? [`${indentacao}  dart: ${impl.dart}`] : []),
    `${indentacao}}`,
    "",
  ];
}

function renderizarTask(task: TarefaImportada): string[] {
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
    ...renderizarErrors(task.errors, "    "),
  ];

  linhas.push("    guarantees {");
  for (const campo of task.output) {
    linhas.push(`      ${campo.nome} existe`);
  }
  linhas.push("    }");
  linhas.push("");

  linhas.push("  }");
  linhas.push("");
  return linhas;
}

function renderizarRoute(route: RotaImportada): string[] {
  return [
    `  route ${route.nome} {`,
    "    docs {",
    `      resumo: "${escaparTexto(route.resumo)}"`,
    "    }",
    "",
    `    metodo: ${route.metodo}`,
    `    caminho: ${route.caminho}`,
    `    task: ${route.task}`,
    ...renderizarCampos("input", route.input, "    "),
    ...renderizarCampos("output", route.output, "    "),
    ...renderizarErrors(route.errors, "    "),
    "  }",
    "",
  ];
}

function renderizarEnum(enumItem: EnumImportado): string[] {
  return [
    `  enum ${enumItem.nome} {`,
    `    ${enumItem.valores.join(",\n    ")}`,
    "  }",
    "",
  ];
}

function renderizarEntidade(entity: EntidadeImportada): string[] {
  return [
    `  entity ${entity.nome} {`,
    "    fields {",
    ...entity.campos.map((campo) => `      ${campo.nome}: ${campo.tipo}`),
    "    }",
    "  }",
    "",
  ];
}

function moduloParaCodigo(modulo: ModuloImportado): string {
  const linhas = [
    `module ${modulo.nome} {`,
    "  docs {",
    `    resumo: "${escaparTexto(modulo.resumo)}"`,
    "  }",
    "",
    ...modulo.enums.flatMap(renderizarEnum),
    ...modulo.entities.flatMap(renderizarEntidade),
    ...modulo.tasks.flatMap(renderizarTask),
    ...modulo.routes.flatMap(renderizarRoute),
    "}",
    "",
  ];

  return linhas.join("\n");
}

async function formatarModuloImportado(codigo: string, caminhoVirtual: string): Promise<string> {
  const formatado = formatarCodigo(codigo, caminhoVirtual);
  return formatado.codigoFormatado ?? codigo;
}

function nomeArquivoModulo(modulo: string): string {
  const segmentos = modulo.split(".");
  return `${segmentos.at(-1) ?? "modulo"}.sema`;
}

function contextoArquivoModulo(modulo: string, namespaceBase: string): string {
  const prefixo = namespaceBase.split(".");
  const segmentos = modulo.split(".");
  const relativos = segmentos.slice(prefixo.length, -1);
  return relativos.length ? path.join(...relativos) : "";
}

function montarArquivoImportado(modulo: ModuloImportado, namespaceBase: string, conteudo: string): ArquivoImportado {
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
  };
}

function consolidarTiposTs(contextos: ContextoTsArquivo[]): Map<string, TipoDescoberto> {
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

function importarNestJsDeArquivo(
  diretorioBase: string,
  arquivo: string,
  namespaceBase: string,
  tiposGlobais: Map<string, TipoDescoberto>,
): ModuloImportado[] {
  const relacao = path.relative(diretorioBase, arquivo);
  const codigo = ts.sys.readFile(arquivo, "utf8") ?? "";
  const sourceFile = ts.createSourceFile(arquivo, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const contextoSegmentos = inferirContextoPorArquivo(relacao);
  const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
  const entitiesRef = new Set<string>();
  const enumsRef = new Set<string>();
  const tasks: TarefaImportada[] = [];
  const routes: RotaImportada[] = [];

  for (const node of sourceFile.statements) {
    if (!ts.isClassDeclaration(node)) {
      continue;
    }

    const controllerDecorator = lerDecorator(node, ["Controller"]);
    if (controllerDecorator) {
      const basePath = extrairTextoLiteral(controllerDecorator.argumentos[0]);
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !member.body) {
          continue;
        }
        const httpDecorator = lerDecorator(member, ["Get", "Post", "Put", "Patch", "Delete"]);
        if (!httpDecorator) {
          continue;
        }
        const taskOriginal = extrairChamadaServiceTs(member.body) ?? member.name.getText(sourceFile);
        const taskNome = paraSnakeCase(taskOriginal);
        const routeInput = member.parameters.flatMap((parametro) =>
          expandirCamposTs(
            parametro.name.getText(sourceFile),
            parametro.type?.getText(sourceFile),
            tiposGlobais,
            entitiesRef,
            enumsRef,
            !parametro.questionToken,
          ));
        const routeOutputTipo = member.type?.getText(sourceFile);
        const routeOutput = !routeOutputTipo || mapearTipoPrimitivo(routeOutputTipo) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposTs("resultado", routeOutputTipo, tiposGlobais, entitiesRef, enumsRef, false));

        routes.push({
          nome: `${taskNome}_publico`,
          resumo: `Rota importada automaticamente de ${relacao}#${member.name.getText(sourceFile)}.`,
          metodo: httpDecorator.nome.toUpperCase(),
          caminho: juntarCaminhoHttp(basePath, extrairTextoLiteral(httpDecorator.argumentos[0])),
          task: taskNome,
          input: deduplicarCampos(routeInput),
          output: routeOutput,
          errors: [],
        });
      }
    }

    if (!node.name?.text.endsWith("Service")) {
      continue;
    }
    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member) || !member.body || !member.name) {
        continue;
      }
      if (member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
        continue;
      }
      const nomeMetodo = member.name.getText(sourceFile);
      if (nomeMetodo === "constructor") {
        continue;
      }
      const input = member.parameters.flatMap((parametro) =>
        expandirCamposTs(
          parametro.name.getText(sourceFile),
          parametro.type?.getText(sourceFile),
          tiposGlobais,
          entitiesRef,
          enumsRef,
          !parametro.questionToken,
        ));
      const output = member.type?.getText(sourceFile) && mapearTipoPrimitivo(member.type.getText(sourceFile)) === "Vazio"
        ? []
        : deduplicarCampos(expandirCamposTs("resultado", member.type?.getText(sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
      tasks.push({
        nome: paraSnakeCase(nomeMetodo),
        resumo: `Task importada automaticamente de ${relacao}#${nomeMetodo}.`,
        input: deduplicarCampos(input),
        output,
        errors: extrairErrosTs(member.body, sourceFile),
        effects: descreverEfeitosPorHeuristica(member.body.getText(sourceFile)),
        impl: { ts: caminhoImplTs(diretorioBase, arquivo, nomeMetodo) },
        origemArquivo: relacao,
        origemSimbolo: nomeMetodo,
      });
    }
  }

  if (!tasks.length && !routes.length) {
    return [];
  }

  const { entities, enums } = criarEntidadesReferenciadas(tiposGlobais, entitiesRef, enumsRef);
  sincronizarRotasComTasks(routes, tasks);

  return [{
    nome: nomeModulo,
    resumo: `Rascunho Sema importado de um contexto NestJS legado em ${contextoSegmentos.join("/")}.`,
    entities,
    enums,
    tasks: deduplicarTarefas(tasks),
    routes: deduplicarRotas(routes),
  }];
}

async function importarTypeScriptBase(
  diretorio: string,
  namespaceBase: string,
  modoNestjs = false,
): Promise<ModuloImportado[]> {
  const arquivos = await listarArquivosRecursivos(diretorio, [".ts"]);
  const uteis = arquivos.filter((arquivo) =>
    !arquivo.endsWith(".spec.ts")
    && !arquivo.endsWith(".test.ts")
    && !arquivo.endsWith(".d.ts")
    && !(modoNestjs && !arquivo.endsWith(".controller.ts") && !arquivo.endsWith(".service.ts")),
  );
  const contextosTodos = await Promise.all(arquivos
    .filter((arquivo) => !arquivo.endsWith(".spec.ts") && !arquivo.endsWith(".test.ts") && !arquivo.endsWith(".d.ts"))
    .map(async (arquivo) => {
      const texto = await readFile(arquivo, "utf8");
      return {
        sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
        texto,
        relacao: path.relative(diretorio, arquivo),
      };
    }));
  const contextos = await Promise.all(uteis.map(async (arquivo) => {
    const texto = await readFile(arquivo, "utf8");
    return {
      sourceFile: ts.createSourceFile(arquivo, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
      texto,
      relacao: path.relative(diretorio, arquivo),
    };
  }));
  const tiposGlobais = consolidarTiposTs(contextosTodos);
  const modulos = new Map<string, ModuloImportado>();

  if (modoNestjs) {
    for (const contexto of contextos) {
      for (const modulo of importarNestJsDeArquivo(diretorio, path.join(diretorio, contexto.relacao), namespaceBase, tiposGlobais)) {
        const existente = modulos.get(modulo.nome);
        if (!existente) {
          modulos.set(modulo.nome, modulo);
          continue;
        }
        existente.tasks = deduplicarTarefas([...existente.tasks, ...modulo.tasks]);
        existente.routes = deduplicarRotas([...existente.routes, ...modulo.routes]);
        existente.entities = deduplicarEntidades([...existente.entities, ...modulo.entities]);
        existente.enums = deduplicarEnums([...existente.enums, ...modulo.enums]);
      }
    }
    return [...modulos.values()];
  }

  for (const contexto of contextos) {
    const entitiesRef = new Set<string>();
    const enumsRef = new Set<string>();
    const contextoSegmentos = inferirContextoPorArquivo(contexto.relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];

    contexto.sourceFile.forEachChild((node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const nome = node.name.text;
        const input = node.parameters.flatMap((parametro) =>
          expandirCamposTs(parametro.name.getText(contexto.sourceFile), parametro.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, !parametro.questionToken));
        const output = node.type?.getText(contexto.sourceFile) && mapearTipoPrimitivo(node.type.getText(contexto.sourceFile)) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposTs("resultado", node.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
        const errors = node.body ? extrairErrosTs(node.body, contexto.sourceFile) : [];
        const effects = node.body ? descreverEfeitosPorHeuristica(node.body.getText(contexto.sourceFile)) : [];
        tasks.push({
          nome: paraSnakeCase(nome),
          resumo: `Task importada automaticamente de ${contexto.relacao}#${nome}.`,
          input: deduplicarCampos(input),
          output,
          errors,
          effects,
          impl: { ts: caminhoImplTs(diretorio, path.join(diretorio, contexto.relacao), nome) },
          origemArquivo: contexto.relacao,
          origemSimbolo: nome,
        });
      }

      if (ts.isClassDeclaration(node) && node.name && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
        const nomeClasse = node.name.text;
        for (const member of node.members) {
          if (!ts.isMethodDeclaration(member) || !member.name || !member.body) {
            continue;
          }
          if (member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword || modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
            continue;
          }
          const nomeMetodo = member.name.getText(contexto.sourceFile);
          if (nomeMetodo === "constructor") {
            continue;
          }
          const input = member.parameters.flatMap((parametro) =>
            expandirCamposTs(parametro.name.getText(contexto.sourceFile), parametro.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, !parametro.questionToken));
          const output = member.type?.getText(contexto.sourceFile) && mapearTipoPrimitivo(member.type.getText(contexto.sourceFile)) === "Vazio"
            ? []
            : deduplicarCampos(expandirCamposTs("resultado", member.type?.getText(contexto.sourceFile), tiposGlobais, entitiesRef, enumsRef, false));
          tasks.push({
            nome: paraSnakeCase(nomeMetodo),
            resumo: `Task importada automaticamente de ${contexto.relacao}#${nomeClasse}.${nomeMetodo}.`,
            input: deduplicarCampos(input),
            output,
            errors: extrairErrosTs(member.body, contexto.sourceFile),
            effects: descreverEfeitosPorHeuristica(member.body.getText(contexto.sourceFile)),
            impl: { ts: caminhoImplTs(diretorio, path.join(diretorio, contexto.relacao), `${nomeClasse}.${nomeMetodo}`) },
            origemArquivo: contexto.relacao,
            origemSimbolo: `${nomeClasse}.${nomeMetodo}`,
          });
        }
      }
    });

    if (tasks.length === 0) {
      continue;
    }

    const { entities, enums } = criarEntidadesReferenciadas(tiposGlobais, entitiesRef, enumsRef);
    modulos.set(nomeModulo, {
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${contexto.relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: [],
      entities,
      enums,
    });
  }

  return [...modulos.values()];
}

function extrairTiposPython(texto: string): Map<string, TipoPythonDescoberto> {
  const encontrados = new Map<string, TipoPythonDescoberto>();

  const regexBaseModel = /^class\s+(\w+)(?:\(([^)]*)\))?:\n((?:^[ \t].*(?:\n|$))*)/gm;
  for (const match of texto.matchAll(regexBaseModel)) {
    const [, nome, bases = "", corpo] = match;
    if (!bases.includes("BaseModel")) {
      continue;
    }
    const campos = [...corpo.matchAll(/^\s{4}(\w+)\s*:\s*([^\n=]+)(?:\s*=.+)?$/gm)].map((campo) => ({
      nome: campo[1]!,
      tipoTexto: campo[2]!.trim(),
      obrigatorio: !/=/.test(campo[0]!),
    }));
    encontrados.set(nome!, { tipo: "objeto", nome: nome!, campos });
  }

  const regexEnum = /^class\s+(\w+)(?:\(([^)]*)\))?:\n((?:^[ \t].*(?:\n|$))*)/gm;
  for (const match of texto.matchAll(regexEnum)) {
    const [, nome, bases = "", corpo] = match;
    if (!/(Enum|StrEnum)/.test(bases)) {
      continue;
    }
    const valores = [...corpo.matchAll(/^\s{4}(\w+)\s*=\s*["']([^"']+)["']$/gm)].map((valor) => valor[1]!).filter(Boolean);
    if (valores.length) {
      encontrados.set(nome!, { tipo: "enum", nome: nome!, valores });
    }
  }

  return encontrados;
}

function mapearTipoPythonParaSema(
  tipoTexto: string | undefined,
  tipos: Map<string, TipoPythonDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): string {
  if (!tipoTexto) {
    return "Json";
  }

  const limpo = tipoTexto.replace(/\s+/g, "");
  const basico = mapearTipoPrimitivo(limpo);
  if (basico !== limpo) {
    return basico;
  }

  const simples = limpo.replace(/Optional\[(.+)\]/, "$1").replace(/list\[(.+)\]/i, "Json").replace(/dict\[(.+)\]/i, "Json");
  if (tipos.has(simples)) {
    const encontrado = tipos.get(simples)!;
    if (encontrado.tipo === "enum") {
      enumsReferenciados.add(encontrado.nome);
      return encontrado.nome;
    }
    if (!pareceWrapperTipo(encontrado.nome)) {
      entidadesReferenciadas.add(encontrado.nome);
      return encontrado.nome;
    }
  }

  return "Json";
}

function expandirCamposPython(
  nomeParametro: string,
  tipoTexto: string | undefined,
  tipos: Map<string, TipoPythonDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
  obrigatorio: boolean,
): CampoImportado[] {
  if (!tipoTexto) {
    return [{ nome: paraSnakeCase(nomeParametro), tipo: "Json", obrigatorio }];
  }
  const limpo = tipoTexto.replace(/\s+/g, "").replace(/Optional\[(.+)\]/, "$1");
  const descoberto = tipos.get(limpo);
  if (descoberto?.tipo === "objeto" && pareceWrapperTipo(descoberto.nome) && descoberto.campos) {
    return descoberto.campos.map((campo) => ({
      nome: paraSnakeCase(campo.nome),
      tipo: mapearTipoPythonParaSema(campo.tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
      obrigatorio: campo.obrigatorio,
    }));
  }
  return [{
    nome: paraSnakeCase(nomeParametro),
    tipo: mapearTipoPythonParaSema(tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
    obrigatorio,
  }];
}

function criarEntidadesPython(
  tipos: Map<string, TipoPythonDescoberto>,
  entidadesReferenciadas: Set<string>,
  enumsReferenciados: Set<string>,
): { entities: EntidadeImportada[]; enums: EnumImportado[] } {
  const entities = [...entidadesReferenciadas]
    .map((nome) => tipos.get(nome))
    .filter((item): item is TipoPythonDescoberto => Boolean(item?.tipo === "objeto" && item.campos))
    .map((item) => ({
      nome: item.nome,
      campos: item.campos!.map((campo) => ({
        nome: paraSnakeCase(campo.nome),
        tipo: mapearTipoPythonParaSema(campo.tipoTexto, tipos, entidadesReferenciadas, enumsReferenciados),
        obrigatorio: campo.obrigatorio,
      })),
    }));

  const enums = [...enumsReferenciados]
    .map((nome) => tipos.get(nome))
    .filter((item): item is TipoPythonDescoberto => Boolean(item?.tipo === "enum" && item.valores))
    .map((item) => ({
      nome: item.nome,
      valores: item.valores!,
    }));

  return { entities: deduplicarEntidades(entities), enums: deduplicarEnums(enums) };
}

function extrairErrosPython(texto: string): ErroImportado[] {
  const erros = new Map<string, string>();
  for (const match of texto.matchAll(/raise\s+(\w+)(?:\(([^)]*)\))?/g)) {
    const nomeBruto = match[1]!;
    const mensagem = (match[2] ?? "").match(/["']([^"']+)["']/)?.[1] ?? `Erro importado automaticamente de ${nomeBruto}.`;
    erros.set(normalizarNomeErroBruto(nomeBruto), mensagem);
  }
  return [...erros.entries()].map(([nome, mensagem]) => ({ nome, mensagem }));
}

function caminhoImplPython(diretorioBase: string, arquivo: string, simbolo: string): string {
  const relativo = path.relative(diretorioBase, arquivo).replace(/\.[^.]+$/, "");
  return [...relativo.split(path.sep).map((segmento) => paraIdentificadorModulo(segmento)).filter(Boolean), simbolo].join(".");
}

function caminhoImplDart(diretorioBase: string, arquivo: string, simbolo: string): string {
  const relativo = path.relative(diretorioBase, arquivo).replace(/\.[^.]+$/, "");
  return [...relativo.split(path.sep).map((segmento) => paraIdentificadorModulo(segmento)).filter(Boolean), simbolo].join(".");
}

async function importarPythonBase(
  diretorio: string,
  namespaceBase: string,
  modoFastapi = false,
): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".py"]))
    .filter((arquivo) => !arquivo.endsWith("__init__.py") && !/tests?[\\/]/i.test(arquivo));

  const textos = new Map<string, string>();
  const tiposGlobais = new Map<string, TipoPythonDescoberto>();
  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    textos.set(arquivo, texto);
    for (const [nome, tipo] of extrairTiposPython(texto)) {
      if (!tiposGlobais.has(nome)) {
        tiposGlobais.set(nome, tipo);
      }
    }
  }

  const modulos = new Map<string, ModuloImportado>();

  for (const arquivo of arquivos) {
    const texto = textos.get(arquivo)!;
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const entitiesRef = new Set<string>();
    const enumsRef = new Set<string>();
    const tasks: TarefaImportada[] = [];
    const routes: RotaImportada[] = [];

    if (modoFastapi) {
      const prefixo = texto.match(/APIRouter\s*\(\s*prefix\s*=\s*["']([^"']+)["']/)?.[1];
      const routeRegex = /@(?:router|app)\.(get|post|put|patch|delete)\(([^)]*)\)\s*\n(?:async\s+)?def\s+(\w+)\(([^)]*)\)(?:\s*->\s*([^:]+))?:/g;
      for (const match of texto.matchAll(routeRegex)) {
        const metodo = match[1]!.toUpperCase();
        const argumentoDecorator = match[2] ?? "";
        const sufixo = argumentoDecorator.match(/["']([^"']+)["']/)?.[1];
        const nomeFuncao = match[3]!;
        const parametros = match[4]!;
        const retorno = match[5]?.trim();
        const routeInput = parametros
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .filter((item) => !item.startsWith("self") && !item.startsWith("cls"))
          .flatMap((item) => {
            const [nome, tipo] = item.split(":").map((parte) => parte.trim());
            const obrigatorio = !item.includes("=");
            return expandirCamposPython(nome, tipo, tiposGlobais, entitiesRef, enumsRef, obrigatorio);
          });
        const routeOutput = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposPython("resultado", retorno, tiposGlobais, entitiesRef, enumsRef, false));
        const taskNome = paraSnakeCase(nomeFuncao);
        routes.push({
          nome: `${taskNome}_publico`,
          resumo: `Rota FastAPI importada automaticamente de ${relacao}#${nomeFuncao}.`,
          metodo,
          caminho: juntarCaminhoHttp(prefixo, sufixo),
          task: taskNome,
          input: deduplicarCampos(routeInput),
          output: routeOutput,
          errors: [],
        });
      }
    }

    const funcRegex = /^(async\s+def|def)\s+(\w+)\(([^)]*)\)(?:\s*->\s*([^:]+))?:/gm;
    for (const match of texto.matchAll(funcRegex)) {
      const nomeFuncao = match[2]!;
      if (nomeFuncao.startsWith("_")) {
        continue;
      }
      const parametros = match[3]!;
      const retorno = match[4]?.trim();
      const inicioCorpo = match.index ?? 0;
      const trecho = texto.slice(inicioCorpo, Math.min(texto.length, inicioCorpo + 1500));
      const input = parametros
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => !item.startsWith("self") && !item.startsWith("cls"))
        .flatMap((item) => {
          const [nome, tipo] = item.split(":").map((parte) => parte.trim());
          const obrigatorio = !item.includes("=");
          return expandirCamposPython(nome, tipo, tiposGlobais, entitiesRef, enumsRef, obrigatorio);
        });
      const output = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
        ? []
        : deduplicarCampos(expandirCamposPython("resultado", retorno, tiposGlobais, entitiesRef, enumsRef, false));
      tasks.push({
        nome: paraSnakeCase(nomeFuncao),
        resumo: `Task importada automaticamente de ${relacao}#${nomeFuncao}.`,
        input: deduplicarCampos(input),
        output,
        errors: extrairErrosPython(trecho),
        effects: descreverEfeitosPorHeuristica(trecho),
        impl: { py: caminhoImplPython(diretorio, arquivo, nomeFuncao) },
        origemArquivo: relacao,
        origemSimbolo: nomeFuncao,
      });
    }

    const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?:\n((?:^[ \t].*(?:\n|$))*)/gm;
    for (const match of texto.matchAll(classRegex)) {
      const nomeClasse = match[1]!;
      const bases = match[2] ?? "";
      const corpo = match[3]!;
      if (/(BaseModel|Enum|StrEnum)/.test(bases)) {
        continue;
      }
      for (const metodo of corpo.matchAll(/^\s{4}(?:async\s+def|def)\s+(\w+)\(([^)]*)\)(?:\s*->\s*([^:]+))?:/gm)) {
        const nomeMetodo = metodo[1]!;
        if (nomeMetodo.startsWith("_")) {
          continue;
        }
        const parametros = metodo[2]!;
        const retorno = metodo[3]?.trim();
        const input = parametros
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .filter((item) => !item.startsWith("self") && !item.startsWith("cls"))
          .flatMap((item) => {
            const [nome, tipo] = item.split(":").map((parte) => parte.trim());
            const obrigatorio = !item.includes("=");
            return expandirCamposPython(nome, tipo, tiposGlobais, entitiesRef, enumsRef, obrigatorio);
          });
        const output = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
          ? []
          : deduplicarCampos(expandirCamposPython("resultado", retorno, tiposGlobais, entitiesRef, enumsRef, false));
        tasks.push({
          nome: paraSnakeCase(nomeMetodo),
          resumo: `Task importada automaticamente de ${relacao}#${nomeClasse}.${nomeMetodo}.`,
          input: deduplicarCampos(input),
          output,
          errors: extrairErrosPython(corpo),
          effects: descreverEfeitosPorHeuristica(corpo),
          impl: { py: caminhoImplPython(diretorio, arquivo, `${nomeClasse}.${nomeMetodo}`) },
          origemArquivo: relacao,
          origemSimbolo: `${nomeClasse}.${nomeMetodo}`,
        });
      }
    }

    if (!tasks.length && !routes.length) {
      continue;
    }

    const { entities, enums } = criarEntidadesPython(tiposGlobais, entitiesRef, enumsRef);
    sincronizarRotasComTasks(routes, tasks);
    modulos.set(nomeModulo, {
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: deduplicarRotas(routes),
      entities,
      enums,
    });
  }

  return [...modulos.values()];
}

async function importarDartBase(diretorio: string, namespaceBase: string): Promise<ModuloImportado[]> {
  const arquivos = (await listarArquivosRecursivos(diretorio, [".dart"]))
    .filter((arquivo) => !arquivo.endsWith(".g.dart") && !arquivo.endsWith(".freezed.dart"));
  const modulos: ModuloImportado[] = [];

  for (const arquivo of arquivos) {
    const texto = await readFile(arquivo, "utf8");
    const relacao = path.relative(diretorio, arquivo);
    const contextoSegmentos = inferirContextoPorArquivo(relacao);
    const nomeModulo = [namespaceBase, ...contextoSegmentos].join(".");
    const tasks: TarefaImportada[] = [];

    for (const match of texto.matchAll(/(?:Future<([^>]+)>|(\w+))\s+(\w+)\(([^)]*)\)\s*\{/g)) {
      const retorno = (match[1] ?? match[2] ?? "").trim();
      const nome = match[3]!;
      if (["build", "toString", "hashCode"].includes(nome)) {
        continue;
      }
      const parametros = match[4]!;
      const input = parametros
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.replace(/^(required|final)\s+/g, ""))
        .map((item) => {
          const partes = item.split(/\s+/);
          const nomeParametro = partes.at(-1) ?? "param";
          const tipoParametro = partes.length > 1 ? partes.slice(0, -1).join(" ") : undefined;
          return {
            nome: paraSnakeCase(nomeParametro),
            tipo: mapearTipoPrimitivo(tipoParametro ?? "Json"),
            obrigatorio: item.includes("required"),
          };
        });
      const output = retorno && mapearTipoPrimitivo(retorno) === "Vazio"
        ? []
        : [{ nome: "resultado", tipo: mapearTipoPrimitivo(retorno || "Json"), obrigatorio: false }];
      tasks.push({
        nome: paraSnakeCase(nome),
        resumo: `Task importada automaticamente de ${relacao}#${nome}.`,
        input,
        output,
        errors: [],
        effects: descreverEfeitosPorHeuristica(texto),
        impl: { dart: caminhoImplDart(diretorio, arquivo, nome) },
        origemArquivo: relacao,
        origemSimbolo: nome,
      });
    }

    if (tasks.length === 0) {
      continue;
    }

    modulos.push({
      nome: nomeModulo,
      resumo: `Rascunho Sema importado automaticamente de ${relacao}.`,
      tasks: deduplicarTarefas(tasks),
      routes: [],
      entities: [],
      enums: [],
    });
  }

  return modulos;
}

export async function importarProjetoLegado(
  fonte: FonteImportacao,
  diretorio: string,
  namespaceBase?: string,
): Promise<ResultadoImportacao> {
  const base = path.resolve(diretorio);
  const namespace = inferirNamespaceBase(base, namespaceBase);

  let modulos: ModuloImportado[] = [];
  if (fonte === "nestjs") {
    modulos = await importarTypeScriptBase(base, namespace, true);
  } else if (fonte === "typescript") {
    modulos = await importarTypeScriptBase(base, namespace, false);
  } else if (fonte === "fastapi") {
    modulos = await importarPythonBase(base, namespace, true);
  } else if (fonte === "python") {
    modulos = await importarPythonBase(base, namespace, false);
  } else if (fonte === "dart") {
    modulos = await importarDartBase(base, namespace);
  }

  const arquivos: ArquivoImportado[] = [];
  for (const modulo of modulos) {
    const bruto = moduloParaCodigo(modulo);
    const formatado = await formatarModuloImportado(bruto, `${modulo.nome}.sema`);
    arquivos.push(montarArquivoImportado(modulo, namespace, formatado));
  }

  const diagnosticos = compilarProjeto(
    arquivos.map((arquivo) => ({
      caminho: path.join(base, ".tmp", "importado", arquivo.caminhoRelativo),
      codigo: arquivo.conteudo,
    })),
  ).diagnosticos;

  return {
    fonte,
    diretorio: base,
    namespaceBase: namespace,
    arquivos,
    diagnosticos,
  };
}

export function resumoImportacao(resultado: ResultadoImportacao): {
  modulos: number;
  tarefas: number;
  rotas: number;
  entidades: number;
  enums: number;
  diagnosticos: number;
  sucesso: boolean;
} {
  return {
    modulos: resultado.arquivos.length,
    tarefas: resultado.arquivos.reduce((total, arquivo) => total + arquivo.tarefas, 0),
    rotas: resultado.arquivos.reduce((total, arquivo) => total + arquivo.rotas, 0),
    entidades: resultado.arquivos.reduce((total, arquivo) => total + arquivo.entidades, 0),
    enums: resultado.arquivos.reduce((total, arquivo) => total + arquivo.enums, 0),
    diagnosticos: resultado.diagnosticos.length,
    sucesso: !temErros(resultado.diagnosticos),
  };
}
