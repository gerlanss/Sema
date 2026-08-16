// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: extrai e resolve candidatos exatos de dependencias locais sem caminhada de filesystem.

import path from "node:path";
import ts from "typescript";
import type { ContextoProjetoCarregado } from "./projeto.js";

const EXTENSOES_DEPENDENCIA_CODIGO = [
  ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".py", ".dart", ".lua", ".cs", ".java",
  ".go", ".rs", ".php", ".cpp", ".cc", ".cxx", ".hpp", ".h",
  ".sql", ".psql", ".ddl", ".prisma", ".html", ".htm", ".css",
];
const EXTENSOES_TYPESCRIPT_DEPENDENCIA = [
  ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".html", ".htm", ".css",
];
const PREFIXO_REFERENCIA_PYTHON = "python:";
const PREFIXO_REFERENCIA_RUST_MODULO = "rust-mod:";
const PREFIXO_REFERENCIA_RUST_CAMINHO = "rust-path:";
const REFERENCIA_ALIAS_CONFIG_INCOMPLETA = "alias-config:nao_resolvida";

export interface OpcoesExtracaoReferenciasDrift {
  contexto?: ContextoProjetoCarregado;
  arquivoOrigem?: string;
}

interface RegraAliasTypeScriptDrift {
  padrao: string;
  alvos: string[];
  base: string;
}

interface ConfiguracaoAliasesTypeScriptDrift {
  regras: RegraAliasTypeScriptDrift[];
  incompleta: boolean;
}

function chaveCaminho(caminho: string): string {
  const absoluto = path.normalize(path.resolve(caminho));
  return process.platform === "win32" ? absoluto.toLowerCase() : absoluto;
}

function caminhoEstaDentro(raiz: string, alvo: string): boolean {
  const relativo = path.relative(path.resolve(raiz), path.resolve(alvo));
  return relativo === "" || (
    relativo !== ".."
    && !relativo.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativo)
  );
}

function encontrarConfiguracaoTypeScript(
  contexto: ContextoProjetoCarregado,
  arquivoOrigem: string,
): string | undefined {
  const baseProjeto = path.resolve(contexto.baseProjeto);
  let diretorio = path.dirname(path.resolve(arquivoOrigem));
  if (!caminhoEstaDentro(baseProjeto, diretorio)) {
    return undefined;
  }

  for (;;) {
    for (const nome of ["tsconfig.json", "jsconfig.json"]) {
      const candidato = path.join(diretorio, nome);
      if (ts.sys.fileExists(candidato)) {
        return candidato;
      }
    }
    if (chaveCaminho(diretorio) === chaveCaminho(baseProjeto)) {
      return undefined;
    }
    const pai = path.dirname(diretorio);
    if (pai === diretorio || !caminhoEstaDentro(baseProjeto, pai)) {
      return undefined;
    }
    diretorio = pai;
  }
}

function resolverExtendsTypeScript(configuracao: string, valor: string): string | undefined {
  if (!valor.startsWith(".") && !path.isAbsolute(valor)) {
    return undefined;
  }
  const base = path.resolve(path.dirname(configuracao), valor);
  for (const candidato of [base, `${base}.json`, path.join(base, "tsconfig.json")]) {
    if (ts.sys.fileExists(candidato)) {
      return candidato;
    }
  }
  return undefined;
}

function carregarConfiguracaoAliasesTypeScript(
  contexto: ContextoProjetoCarregado,
  arquivoOrigem: string,
): ConfiguracaoAliasesTypeScriptDrift {
  const configuracaoInicial = encontrarConfiguracaoTypeScript(contexto, arquivoOrigem);
  if (!configuracaoInicial) {
    return { regras: [], incompleta: false };
  }

  const visitadas = new Set<string>();
  const carregar = (configuracao: string): ConfiguracaoAliasesTypeScriptDrift => {
    const chave = chaveCaminho(configuracao);
    if (visitadas.has(chave) || visitadas.size >= 8) {
      return { regras: [], incompleta: true };
    }
    visitadas.add(chave);

    const leitura = ts.readConfigFile(configuracao, ts.sys.readFile);
    if (leitura.error || !leitura.config || typeof leitura.config !== "object") {
      return { regras: [], incompleta: true };
    }
    const config = leitura.config as {
      extends?: string | string[];
      compilerOptions?: {
        baseUrl?: string;
        paths?: Record<string, unknown>;
      };
    };
    const opcoes = config.compilerOptions ?? {};
    const base = path.resolve(path.dirname(configuracao), opcoes.baseUrl ?? ".");
    const regrasAtuais = Object.entries(opcoes.paths ?? {})
      .map(([padrao, alvos]): RegraAliasTypeScriptDrift | undefined => {
        if (!Array.isArray(alvos)) {
          return undefined;
        }
        const alvosValidos = alvos.filter((alvo): alvo is string => typeof alvo === "string" && alvo.length > 0);
        return alvosValidos.length > 0 ? { padrao, alvos: alvosValidos, base } : undefined;
      })
      .filter((regra): regra is RegraAliasTypeScriptDrift => Boolean(regra));

    let incompleta = false;
    const herdadas: RegraAliasTypeScriptDrift[] = [];
    const extensoes = Array.isArray(config.extends)
      ? config.extends
      : config.extends ? [config.extends] : [];
    for (const extensao of extensoes) {
      const caminhoBase = resolverExtendsTypeScript(configuracao, extensao);
      if (!caminhoBase || !caminhoEstaDentro(contexto.baseProjeto, caminhoBase)) {
        incompleta = true;
        continue;
      }
      const resultadoBase = carregar(caminhoBase);
      herdadas.push(...resultadoBase.regras);
      incompleta = incompleta || resultadoBase.incompleta;
    }
    const padroesAtuais = new Set(regrasAtuais.map((regra) => regra.padrao));
    return {
      regras: [...regrasAtuais, ...herdadas.filter((regra) => !padroesAtuais.has(regra.padrao))],
      incompleta,
    };
  };

  return carregar(configuracaoInicial);
}

function capturarAliasTypeScript(padrao: string, referencia: string): string | undefined {
  const indiceCoringa = padrao.indexOf("*");
  if (indiceCoringa < 0) {
    return padrao === referencia ? "" : undefined;
  }
  const prefixo = padrao.slice(0, indiceCoringa);
  const sufixo = padrao.slice(indiceCoringa + 1);
  if (!referencia.startsWith(prefixo) || !referencia.endsWith(sufixo)) {
    return undefined;
  }
  return referencia.slice(prefixo.length, referencia.length - sufixo.length);
}

function referenciaCorrespondeAliasTypeScript(
  referencia: string,
  configuracao: ConfiguracaoAliasesTypeScriptDrift | undefined,
): boolean {
  return configuracao?.regras.some((regra) =>
    capturarAliasTypeScript(regra.padrao, referencia) !== undefined,
  ) ?? false;
}

function mascararIntervalo(codigo: string, saida: string[], inicio: number, fim: number): void {
  for (let indice = inicio; indice < fim; indice += 1) {
    if (codigo[indice] !== "\n" && codigo[indice] !== "\r") {
      saida[indice] = " ";
    }
  }
}

interface ResultadoTemplateLiteral {
  fim: number;
  fechado: boolean;
  interpolado: boolean;
}

function avancarStringEmExpressao(codigo: string, inicio: number): number {
  const delimitador = codigo[inicio];
  let indice = inicio + 1;
  while (indice < codigo.length) {
    if (codigo[indice] === "\\") {
      indice += 2;
      continue;
    }
    if (codigo[indice] === delimitador) {
      return indice + 1;
    }
    indice += 1;
  }
  return codigo.length;
}

function avancarRegexEmExpressao(codigo: string, inicio: number): number {
  let indice = inicio + 1;
  let classe = false;
  while (indice < codigo.length) {
    if (codigo[indice] === "\\") {
      indice += 2;
      continue;
    }
    if (codigo[indice] === "[") {
      classe = true;
    } else if (codigo[indice] === "]") {
      classe = false;
    } else if (codigo[indice] === "/" && !classe) {
      indice += 1;
      while (/[A-Za-z]/u.test(codigo[indice] ?? "")) {
        indice += 1;
      }
      return indice;
    }
    indice += 1;
  }
  return codigo.length;
}

function barraIniciaRegex(codigo: string, indice: number): boolean {
  let anterior = indice - 1;
  while (anterior >= 0 && /\s/u.test(codigo[anterior] ?? "")) {
    anterior -= 1;
  }
  return anterior < 0 || /[([{=,:;!?&|+\-*%^~<>]/u.test(codigo[anterior] ?? "");
}

function avancarExpressaoTemplate(codigo: string, inicio: number, profundidade: number): number {
  let indice = inicio;
  let nivelChaves = 1;
  while (indice < codigo.length) {
    const atual = codigo[indice];
    const proximo = codigo[indice + 1];
    if (atual === "'" || atual === '"') {
      indice = avancarStringEmExpressao(codigo, indice);
      continue;
    }
    if (atual === "`") {
      indice = avancarTemplateLiteral(codigo, indice, profundidade + 1).fim;
      continue;
    }
    if (atual === "/" && proximo === "/") {
      const fimLinha = codigo.indexOf("\n", indice + 2);
      indice = fimLinha < 0 ? codigo.length : fimLinha;
      continue;
    }
    if (atual === "/" && proximo === "*") {
      const fimComentario = codigo.indexOf("*/", indice + 2);
      indice = fimComentario < 0 ? codigo.length : fimComentario + 2;
      continue;
    }
    if (atual === "/" && barraIniciaRegex(codigo, indice)) {
      indice = avancarRegexEmExpressao(codigo, indice);
      continue;
    }
    if (atual === "{") {
      nivelChaves += 1;
    } else if (atual === "}") {
      nivelChaves -= 1;
      if (nivelChaves === 0) {
        return indice + 1;
      }
    }
    indice += 1;
  }
  return codigo.length;
}

function avancarTemplateLiteral(
  codigo: string,
  inicio: number,
  profundidade = 0,
): ResultadoTemplateLiteral {
  if (profundidade > 64) {
    return { fim: codigo.length, fechado: false, interpolado: true };
  }
  let indice = inicio + 1;
  let interpolado = false;
  while (indice < codigo.length) {
    if (codigo[indice] === "\\") {
      indice += 2;
      continue;
    }
    if (codigo[indice] === "`") {
      return { fim: indice + 1, fechado: true, interpolado };
    }
    if (codigo[indice] === "$" && codigo[indice + 1] === "{") {
      interpolado = true;
      indice = avancarExpressaoTemplate(codigo, indice + 2, profundidade);
      continue;
    }
    indice += 1;
  }
  return { fim: codigo.length, fechado: false, interpolado };
}

function literalEhReferenciaEstatica(
  codigo: string,
  inicio: number,
  fim: number,
  templateLiteral: boolean,
): boolean {
  const conteudo = codigo.slice(inicio + 1, Math.max(inicio + 1, fim - 1));
  if (templateLiteral && conteudo.includes("${")) {
    return false;
  }
  const prefixo = codigo.slice(Math.max(0, inicio - 4_096), inicio);
  const inicioLinha = prefixo.lastIndexOf("\n") + 1;
  const prefixoLinha = prefixo.slice(inicioLinha);
  return /\bstyleUrls\s*:\s*\[[^\]]*$/u.test(prefixo)
    || /\b(?:import|require)\s*\(\s*$/u.test(prefixoLinha)
    || /^\s*import\s*$/u.test(prefixoLinha)
    || /\b(?:import|export)\b[^;]*\bfrom\s*$/u.test(prefixo)
    || /\b(?:templateUrl|styleUrl)\s*:\s*$/u.test(prefixoLinha)
    || /^\s*@import\s+(?:url\(\s*)?$/u.test(prefixoLinha)
    || /^\s*#include\s*$/u.test(prefixoLinha)
    || /\b(?:require|include)(?:_once)?\s*\(?\s*$/u.test(prefixoLinha)
    || /\b(?:include|include_str|include_bytes)!\s*\(\s*$/u.test(prefixoLinha)
    || /^\s*#\[\s*path\s*=\s*$/u.test(prefixoLinha);
}

/** Remove comentarios/docstrings sem alterar offsets ou caminhos em imports reais. */
function removerComentariosDependencias(codigo: string): string {
  const saida = [...codigo];
  let indice = 0;
  while (indice < codigo.length) {
    const atual = codigo[indice];
    const proximo = codigo[indice + 1];

    if ((atual === "'" || atual === '"') && codigo.slice(indice, indice + 3) === atual.repeat(3)) {
      const delimitador = atual.repeat(3);
      const fimEncontrado = codigo.indexOf(delimitador, indice + 3);
      const fim = fimEncontrado < 0 ? codigo.length : fimEncontrado + 3;
      mascararIntervalo(codigo, saida, indice, fim);
      indice = fim;
      continue;
    }
    if (atual === "`") {
      const inicio = indice;
      const resultado = avancarTemplateLiteral(codigo, inicio);
      indice = resultado.fim;
      if (!resultado.fechado
        || resultado.interpolado
        || !literalEhReferenciaEstatica(codigo, inicio, indice, true)) {
        mascararIntervalo(codigo, saida, inicio, indice);
      }
      continue;
    }
    if (atual === "'" || atual === '"') {
      const inicio = indice;
      const delimitador = atual;
      let fechado = false;
      indice += 1;
      while (indice < codigo.length) {
        if (codigo[indice] === "\\") {
          indice += 2;
          continue;
        }
        if (codigo[indice] === delimitador) {
          indice += 1;
          fechado = true;
          break;
        }
        indice += 1;
      }
      if (!fechado || !literalEhReferenciaEstatica(codigo, inicio, indice, false)) {
        mascararIntervalo(codigo, saida, inicio, indice);
      }
      continue;
    }
    if (atual === "/" && proximo === "/") {
      const fimLinha = codigo.indexOf("\n", indice + 2);
      const fim = fimLinha < 0 ? codigo.length : fimLinha;
      mascararIntervalo(codigo, saida, indice, fim);
      indice = fim;
      continue;
    }
    if (atual === "/" && proximo === "*") {
      const fimEncontrado = codigo.indexOf("*/", indice + 2);
      const fim = fimEncontrado < 0 ? codigo.length : fimEncontrado + 2;
      mascararIntervalo(codigo, saida, indice, fim);
      indice = fim;
      continue;
    }
    if (atual === "#") {
      const inicioLinha = codigo.lastIndexOf("\n", indice - 1) + 1;
      const prefixoLinha = codigo.slice(inicioLinha, indice);
      if (/^\s*$/u.test(prefixoLinha)
        && (codigo.slice(indice).startsWith("#include") || codigo.slice(indice).startsWith("#[path"))) {
        indice += 1;
        continue;
      }
      const fimLinha = codigo.indexOf("\n", indice + 1);
      const fim = fimLinha < 0 ? codigo.length : fimLinha;
      mascararIntervalo(codigo, saida, indice, fim);
      indice = fim;
      continue;
    }
    indice += 1;
  }
  return saida.join("");
}

function referenciaTypescriptLocal(
  referencia: string,
  aliases?: ConfiguracaoAliasesTypeScriptDrift,
): boolean {
  return referencia.startsWith(".")
    || referencia.startsWith("@/")
    || referenciaCorrespondeAliasTypeScript(referencia, aliases);
}

function adicionarImportacoesPython(codigo: string, referencias: Set<string>): void {
  const adicionarModulo = (modulo: string): void => {
    const normalizado = modulo.trim();
    if (/^\.*[A-Za-z_][A-Za-z0-9_.]*$/u.test(normalizado)) {
      referencias.add(`${PREFIXO_REFERENCIA_PYTHON}${normalizado}`);
    }
  };

  for (const ocorrencia of codigo.matchAll(/^\s*import\s+([^\r\n;]+)$/gmu)) {
    for (const item of (ocorrencia[1] ?? "").split(",")) {
      adicionarModulo(item.trim().split(/\s+as\s+/iu)[0] ?? "");
    }
  }
  for (const ocorrencia of codigo.matchAll(/^\s*from\s+(\.*[A-Za-z_][A-Za-z0-9_.]*|\.+)\s+import\s+([^\r\n;]+)$/gmu)) {
    const modulo = ocorrencia[1] ?? "";
    adicionarModulo(modulo);
    const importados = (ocorrencia[2] ?? "").replace(/[()\\]/gu, "");
    for (const item of importados.split(",")) {
      const nome = item.trim().split(/\s+as\s+/iu)[0] ?? "";
      if (nome && nome !== "*" && /^[A-Za-z_][A-Za-z0-9_]*$/u.test(nome)) {
        adicionarModulo(`${modulo}${modulo.endsWith(".") ? "" : "."}${nome}`);
      }
    }
  }
}

function adicionarReferenciasRust(codigo: string, referencias: Set<string>): void {
  const padraoModulo = /(?:^\s*#\[\s*path\s*=\s*["'`]([^"'`\r\n]+)["'`]\s*\]\s*(?:\r?\n\s*)?)?^\s*(?:(?:pub(?:\([^)]*\))?)\s+)?mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/gmu;
  for (const ocorrencia of codigo.matchAll(padraoModulo)) {
    const caminhoExplicito = ocorrencia[1]?.trim();
    const modulo = ocorrencia[2]?.trim();
    if (caminhoExplicito) {
      const seguro = !path.posix.isAbsolute(caminhoExplicito)
        && !path.win32.isAbsolute(caminhoExplicito)
        && !caminhoExplicito.includes(":");
      referencias.add(`${PREFIXO_REFERENCIA_RUST_CAMINHO}${seguro ? caminhoExplicito : "nao_resolvida"}`);
    } else if (modulo) {
      referencias.add(`${PREFIXO_REFERENCIA_RUST_MODULO}${modulo}`);
    }
  }
  for (const ocorrencia of codigo.matchAll(/\b(?:include|include_str|include_bytes)!\s*\(\s*["'`]([^"'`\r\n]+)["'`]\s*\)/gu)) {
    const referencia = ocorrencia[1]?.trim();
    if (referencia && !referencia.includes(":")) {
      referencias.add(referencia);
    }
  }
}

export function extrairReferenciasLocaisDrift(
  codigo: string,
  opcoes: OpcoesExtracaoReferenciasDrift = {},
): string[] {
  const referencias = new Set<string>();
  const codigoExecutavel = removerComentariosDependencias(codigo);
  const aliases = opcoes.contexto && opcoes.arquivoOrigem
    ? carregarConfiguracaoAliasesTypeScript(opcoes.contexto, opcoes.arquivoOrigem)
    : undefined;
  let encontrouReferenciaNaoRelativa = false;
  const adicionarReferenciaTypescript = (referenciaBruta: string | undefined): void => {
    const referencia = referenciaBruta?.trim();
    if (!referencia) {
      return;
    }
    if (referenciaTypescriptLocal(referencia, aliases)) {
      referencias.add(referencia);
    } else if (!referencia.startsWith(".") && aliases?.incompleta) {
      encontrouReferenciaNaoRelativa = true;
    }
  };
  const padroesTypescript = [
    /^\s*(?:import|export)\s+(?:type\s+)?(?:[A-Za-z_$][\w$]*\s*,\s*)?\{[^}]*\}\s+from\s+["'`]([^"'`\r\n]+)["'`]/gmu,
    /^\s*(?:import|export)\s+(?:type\s+)?(?:[^;"'`\r\n]*?\s+from\s+)?["'`]([^"'`\r\n]+)["'`]/gmu,
    /\b(?:import|require)\s*\(\s*["'`]([^"'`\r\n]+)["'`]\s*\)/gu,
    /\b(?:templateUrl|styleUrl)\s*:\s*["'`]([^"'`\r\n]+)["'`]/gu,
    /^\s*@import\s+(?:url\(\s*)?["'`]([^"'`\r\n]+)["'`]/gmu,
  ];
  for (const padrao of padroesTypescript) {
    for (const ocorrencia of codigoExecutavel.matchAll(padrao)) {
      adicionarReferenciaTypescript(ocorrencia[1]);
    }
  }
  for (const ocorrencia of codigoExecutavel.matchAll(/\bstyleUrls\s*:\s*\[([^\]]*)\]/gu)) {
    for (const estilo of (ocorrencia[1] ?? "").matchAll(/["'`]([^"'`\r\n]+)["'`]/gu)) {
      adicionarReferenciaTypescript(estilo[1]);
    }
  }
  if (encontrouReferenciaNaoRelativa) {
    referencias.add(REFERENCIA_ALIAS_CONFIG_INCOMPLETA);
  }
  for (const ocorrencia of codigoExecutavel.matchAll(/^\s*#include\s+["']([^"'\r\n]+)["']/gmu)) {
    const referencia = ocorrencia[1]?.trim();
    if (referencia && !referencia.includes(":")) {
      referencias.add(referencia);
    }
  }
  for (const ocorrencia of codigoExecutavel.matchAll(/\b(?:require|include)(?:_once)?\s*\(?\s*["']([^"'\r\n]+)["']/gu)) {
    const referencia = ocorrencia[1]?.trim();
    const extensao = path.posix.extname(referencia ?? "").toLowerCase();
    if (referencia
      && !referencia.includes(":")
      && (referencia.startsWith(".") || EXTENSOES_DEPENDENCIA_CODIGO.includes(extensao))) {
      referencias.add(referencia);
    }
  }
  adicionarImportacoesPython(codigoExecutavel, referencias);
  adicionarReferenciasRust(codigoExecutavel, referencias);
  return [...referencias];
}

export function raizesCodigoLogicasDrift(contexto: ContextoProjetoCarregado): string[] {
  const candidatas = contexto.diretoriosCodigo.length > 0
    ? contexto.diretoriosCodigo
    : [contexto.baseProjeto];
  return [...new Map(
    candidatas
      .map((raiz) => path.resolve(raiz))
      .filter((raiz) => caminhoEstaDentro(contexto.baseProjeto, raiz))
      .map((raiz) => [chaveCaminho(raiz), raiz] as const),
  ).values()];
}

function adicionarVariantesArquivo(
  candidatos: Map<string, string>,
  base: string,
  extensoesPermitidas: readonly string[],
): void {
  const extensao = path.extname(base).toLowerCase();
  const extensaoConhecida = extensoesPermitidas.includes(extensao);
  const adicionar = (caminho: string): void => {
    const absoluto = path.resolve(caminho);
    const chave = chaveCaminho(absoluto);
    if (!candidatos.has(chave)) {
      candidatos.set(chave, absoluto);
    }
  };

  const substituicoesNodeNext: Partial<Record<string, string[]>> = {
    ".js": [".ts", ".tsx", ".d.ts", ".js", ".jsx"],
    ".jsx": [".tsx", ".jsx"],
    ".mjs": [".mts", ".d.mts", ".mjs"],
    ".cjs": [".cts", ".d.cts", ".cjs"],
  };
  const substituicoes = substituicoesNodeNext[extensao];
  if (substituicoes) {
    const semExtensao = base.slice(0, -extensao.length);
    for (const alternativa of substituicoes) {
      adicionar(`${semExtensao}${alternativa}`);
    }
    return;
  }

  adicionar(base);
  if (!extensaoConhecida) {
    for (const alternativa of extensoesPermitidas) {
      adicionar(`${base}${alternativa}`);
      adicionar(path.join(base, `index${alternativa}`));
    }
  }
}

function adicionarCandidatosAliasTypeScript(
  candidatos: Map<string, string>,
  contexto: ContextoProjetoCarregado,
  arquivoOrigem: string,
  referencia: string,
): boolean {
  const configuracao = carregarConfiguracaoAliasesTypeScript(contexto, arquivoOrigem);
  const regrasCorrespondentes = configuracao.regras
    .map((regra) => ({ regra, captura: capturarAliasTypeScript(regra.padrao, referencia) }))
    .filter((item): item is { regra: RegraAliasTypeScriptDrift; captura: string } => item.captura !== undefined)
    .sort((a, b) => {
      const especificidadeA = a.regra.padrao.replace("*", "").length;
      const especificidadeB = b.regra.padrao.replace("*", "").length;
      return especificidadeB - especificidadeA;
    });
  const melhorPadrao = regrasCorrespondentes[0]?.regra.padrao;
  if (!melhorPadrao) {
    return false;
  }

  for (const { regra, captura } of regrasCorrespondentes.filter((item) => item.regra.padrao === melhorPadrao)) {
    for (const alvo of regra.alvos) {
      adicionarVariantesArquivo(
        candidatos,
        path.resolve(regra.base, alvo.replace("*", captura)),
        EXTENSOES_TYPESCRIPT_DEPENDENCIA,
      );
    }
  }
  return true;
}

function adicionarCandidatosModuloRust(
  candidatos: Map<string, string>,
  arquivoOrigem: string,
  modulo: string,
): void {
  const nomeArquivo = path.basename(arquivoOrigem, path.extname(arquivoOrigem));
  const baseModulo = ["lib", "main", "mod"].includes(nomeArquivo)
    ? path.dirname(arquivoOrigem)
    : path.join(path.dirname(arquivoOrigem), nomeArquivo);
  for (const candidato of [
    path.join(baseModulo, `${modulo}.rs`),
    path.join(baseModulo, modulo, "mod.rs"),
  ]) {
    candidatos.set(chaveCaminho(candidato), path.resolve(candidato));
  }
}

function candidatosModuloPython(
  contexto: ContextoProjetoCarregado,
  arquivoOrigem: string,
  moduloDeclarado: string,
): string[] {
  const candidatos = new Map<string, string>();
  const correspondencia = /^(\.*)(.*)$/u.exec(moduloDeclarado);
  const prefixoRelativo = correspondencia?.[1] ?? "";
  const modulo = correspondencia?.[2] ?? "";
  const segmentos = modulo.split(".").filter(Boolean);
  const bases = new Map<string, string>();
  const adicionarBase = (base: string, segmentosBase: readonly string[]): void => {
    const caminhoModulo = path.resolve(base, ...segmentosBase);
    bases.set(chaveCaminho(caminhoModulo), caminhoModulo);
  };

  if (prefixoRelativo.length > 0) {
    let baseRelativa = path.dirname(arquivoOrigem);
    for (let nivel = 1; nivel < prefixoRelativo.length; nivel += 1) {
      baseRelativa = path.dirname(baseRelativa);
    }
    adicionarBase(baseRelativa, segmentos);
  } else {
    const raizes = raizesCodigoLogicasDrift(contexto);
    for (const base of [path.dirname(arquivoOrigem), contexto.baseProjeto, ...raizes]) {
      adicionarBase(base, segmentos);
      const nomeBase = path.basename(base).toLowerCase();
      if (segmentos[0]?.toLowerCase() === nomeBase) {
        adicionarBase(base, segmentos.slice(1));
      }
    }
  }

  for (const base of bases.values()) {
    const arquivoModulo = `${base}.py`;
    candidatos.set(chaveCaminho(arquivoModulo), arquivoModulo);
    const inicializador = path.join(base, "__init__.py");
    candidatos.set(chaveCaminho(inicializador), inicializador);
  }
  return [...candidatos.values()];
}

export function candidatosReferenciaLocalDrift(
  contexto: ContextoProjetoCarregado,
  arquivoOrigem: string,
  referencia: string,
): string[] {
  if (referencia === REFERENCIA_ALIAS_CONFIG_INCOMPLETA) {
    return [];
  }
  if (referencia.startsWith(PREFIXO_REFERENCIA_PYTHON)) {
    if (path.extname(arquivoOrigem).toLowerCase() !== ".py") {
      return [];
    }
    return candidatosModuloPython(
      contexto,
      arquivoOrigem,
      referencia.slice(PREFIXO_REFERENCIA_PYTHON.length),
    );
  }

  if (referencia.startsWith(PREFIXO_REFERENCIA_RUST_MODULO)) {
    if (path.extname(arquivoOrigem).toLowerCase() !== ".rs") {
      return [];
    }
    const candidatos = new Map<string, string>();
    adicionarCandidatosModuloRust(
      candidatos,
      arquivoOrigem,
      referencia.slice(PREFIXO_REFERENCIA_RUST_MODULO.length),
    );
    return [...candidatos.values()];
  }
  if (referencia.startsWith(PREFIXO_REFERENCIA_RUST_CAMINHO)) {
    if (path.extname(arquivoOrigem).toLowerCase() !== ".rs") {
      return [];
    }
    const declarado = referencia.slice(PREFIXO_REFERENCIA_RUST_CAMINHO.length);
    if (path.isAbsolute(declarado) || path.win32.isAbsolute(declarado) || declarado.includes(":")) {
      return [];
    }
    return [path.resolve(path.dirname(arquivoOrigem), declarado)];
  }

  const candidatos = new Map<string, string>();
  if (adicionarCandidatosAliasTypeScript(candidatos, contexto, arquivoOrigem, referencia)) {
    return [...candidatos.values()];
  }
  if (referencia.startsWith("@/")) {
    const relativoAlias = referencia.slice(2);
    const raizes = raizesCodigoLogicasDrift(contexto).sort((a, b) => {
      const aContemOrigem = caminhoEstaDentro(a, arquivoOrigem) ? 1 : 0;
      const bContemOrigem = caminhoEstaDentro(b, arquivoOrigem) ? 1 : 0;
      return bContemOrigem - aContemOrigem || b.length - a.length || a.localeCompare(b, "pt-BR");
    });
    for (const raiz of raizes) {
      adicionarVariantesArquivo(
        candidatos,
        path.resolve(raiz, relativoAlias),
        EXTENSOES_TYPESCRIPT_DEPENDENCIA,
      );
    }
  } else {
    adicionarVariantesArquivo(
      candidatos,
      path.resolve(path.dirname(arquivoOrigem), referencia),
      EXTENSOES_DEPENDENCIA_CODIGO,
    );
  }
  return [...candidatos.values()];
}
