// SEMA-GOVERNED
// Módulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descrição: centraliza os gates de linhas e cabeçalho Sema para drift, finalização e snapshots.

import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

export const LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO = 1000;
export const LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO = 2000;
export const LIMITE_AVISO_LINHAS_CONTRATO_SEMA = 300;
export const LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA = 500;
export const LIMITE_AVISO_LINHAS_ORCAMENTO_SEMANTICO = LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO;
export const LIMITE_BLOQUEIO_LINHAS_ORCAMENTO_SEMANTICO = LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO;

export async function workspaceExigeCabecalhoCodigoGovernado(
  baseProjeto: string,
  modoEstrito: boolean,
): Promise<boolean> {
  if (!modoEstrito) {
    return false;
  }
  try {
    return (await lstat(path.resolve(baseProjeto, "AGENTS.md"))).isFile();
  } catch {
    return false;
  }
}

export type TipoArquivoOrcamento = "contrato" | "codigo" | "documentacao" | "gerado" | "migracao_historica";
export type SeveridadeOrcamentoSemantico = "ok" | "aviso" | "erro";
export type TipoDiagnosticoOrcamento =
  | "contrato_monolitico"
  | "codigo_monolitico"
  | "codigo_governado_sem_cabecalho";

export interface ResultadoValidacaoArquivoTocado {
  permitido: boolean;
  severidade: SeveridadeOrcamentoSemantico;
  limite_aviso_linhas: number;
  limite_bloqueio_linhas: number;
  mensagem: string;
}

export interface ResultadoDiagnosticoCodigoMonolitico extends ResultadoValidacaoArquivoTocado {
  diagnostico_emitido: boolean;
  precisa_refatorar_codigo: boolean;
  precisa_revisar_contrato_vinculado: boolean;
}

export interface ResultadoCabecalhoCodigoGovernado {
  permitido: boolean;
  mensagem: string;
  exemplo_cabecalho: string;
  cobertura_ia_fraca_media_forte: boolean;
}

export interface DiagnosticoOrcamentoArquivo {
  tipo: TipoDiagnosticoOrcamento;
  arquivo: string;
  linhas: number;
  severidade: Exclude<SeveridadeOrcamentoSemantico, "ok">;
  bloqueia: boolean;
  mensagem: string;
  limite_aviso_linhas: number;
  limite_bloqueio_linhas: number;
}

export interface LeitorArquivosOrcamento {
  contem(caminho: string): boolean;
  lerTexto(caminho: string): Promise<string>;
}

export interface LimitesOrcamentoSemantico {
  aviso: number;
  bloqueio: number;
}

const EXTENSOES_CODIGO_GOVERNAVEL = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".dart",
  ".lua",
  ".java",
  ".go",
  ".rs",
  ".cs",
  ".php",
  ".rb",
  ".kt",
  ".kts",
  ".swift",
  ".vue",
  ".svelte",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sql",
  ".psql",
  ".ddl",
  ".prisma",
  ".cpp",
  ".cc",
  ".cxx",
  ".hpp",
  ".h",
]);

const NOMES_ARTEFATOS_GERADOS_DETERMINISTICOS = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "deno.lock",
]);

const DIRETORIOS_ARTEFATOS_GERADOS = new Set([
  "dist",
  "build",
  "coverage",
  "generated",
]);

export function contarLinhasConteudo(conteudo: string): number {
  if (!conteudo) {
    return 0;
  }
  const normalizado = conteudo.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalizado.endsWith("\n")
    ? normalizado.slice(0, -1).split("\n").length
    : normalizado.split("\n").length;
}

export function limitesOrcamentoSemantico(tipo?: TipoArquivoOrcamento | string): LimitesOrcamentoSemantico {
  if (tipo === "contrato") {
    return {
      aviso: LIMITE_AVISO_LINHAS_CONTRATO_SEMA,
      bloqueio: LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA,
    };
  }
  return {
    aviso: LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO,
    bloqueio: LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO,
  };
}

export function classificarLinhasOrcamentoSemantico(
  linhas: number,
  tipo?: TipoArquivoOrcamento | string,
): SeveridadeOrcamentoSemantico {
  const limites = limitesOrcamentoSemantico(tipo);
  if (linhas > limites.bloqueio) {
    return "erro";
  }
  if (linhas > limites.aviso) {
    return "aviso";
  }
  return "ok";
}

export function arquivoContratoSemaTemNomeArtificial(caminho: string): boolean {
  const nome = path.basename(caminho, ".sema").toLowerCase();
  return /(^|[_-])(parte|part|p)[_-]?\d+($|[_-])/.test(nome)
    || /(^|[_-])\d+_de_\d+($|[_-])/.test(nome);
}

export function arquivoEhArtefatoGeradoDeterministico(caminho: string): boolean {
  const normalizado = caminho.replace(/\\/g, "/").toLowerCase();
  const partes = normalizado.split("/").filter(Boolean);
  const nome = partes.at(-1) ?? "";
  if (NOMES_ARTEFATOS_GERADOS_DETERMINISTICOS.has(nome)) {
    return true;
  }
  if (nome.endsWith(".map")) {
    return true;
  }
  return partes.some((parte) => DIRETORIOS_ARTEFATOS_GERADOS.has(parte));
}

export function arquivoEhMigracaoHistoricaImutavel(caminho: string): boolean {
  const normalizado = caminho.replace(/\\/g, "/").toLowerCase();
  const partes = normalizado.split("/").filter(Boolean);
  const nome = partes.at(-1) ?? "";
  return partes.includes("migrations")
    && /^\d{14}_.+\.sql$/.test(nome);
}

export function tipoArquivoOrcamento(caminho: string): TipoArquivoOrcamento {
  if (arquivoEhArtefatoGeradoDeterministico(caminho)) {
    return "gerado";
  }
  if (arquivoEhMigracaoHistoricaImutavel(caminho)) {
    return "migracao_historica";
  }
  const ext = path.extname(caminho).toLowerCase();
  if (ext === ".sema") {
    return "contrato";
  }
  if (EXTENSOES_CODIGO_GOVERNAVEL.has(ext)) {
    return "codigo";
  }
  return "documentacao";
}

export function conteudoTemCabecalhoSemaGoverned(conteudo: string): boolean {
  return /\bSEMA-GOVERNED\b/.test(conteudo);
}

const PADRAO_DESCRICAO_HUMANA_GOVERNADA = /(?:descri(?:c|ç|Ã§)[aãÃ£]o|description)["']?\s*:/i;

export function conteudoTemDescricaoHumanaGovernada(conteudo: string): boolean {
  return PADRAO_DESCRICAO_HUMANA_GOVERNADA.test(conteudo);
}

export function exemploCabecalhoCodigoGovernado(arquivo?: string): string {
  const ext = path.extname(arquivo ?? "").toLowerCase();
  if (ext === ".html" || ext === ".htm" || ext === ".xml" || ext === ".vue" || ext === ".svelte") {
    return [
      "<!--",
      "SEMA-GOVERNED: modulo.ou.contrato",
      "Descrição: arquivo HTML governado; consulte contratos/... antes de editar.",
      "-->",
    ].join("\n");
  }
  if (ext === ".css" || ext === ".scss") {
    return [
      "/*",
      "SEMA-GOVERNED: modulo.ou.contrato",
      "Descrição: folha de estilo governada; consulte contratos/... antes de editar.",
      "*/",
    ].join("\n");
  }
  if (ext === ".py" || ext === ".rb") {
    return [
      "# SEMA-GOVERNED: modulo.ou.contrato",
      "# Descrição: código governado; consulte contratos/... antes de editar.",
    ].join("\n");
  }
  if (ext === ".lua" || ext === ".sql" || ext === ".psql" || ext === ".ddl") {
    return [
      "-- SEMA-GOVERNED: modulo.ou.contrato",
      "-- Descrição: código governado; consulte contratos/... antes de editar.",
    ].join("\n");
  }
  if (ext === ".json" || ext === ".jsonl") {
    return [
      "{",
      '  "SEMA-GOVERNED": "modulo.ou.contrato",',
      '  "Descrição": "JSON governado; consulte contratos/... antes de editar."',
      "}",
    ].join("\n");
  }
  return [
    "// SEMA-GOVERNED: modulo.ou.contrato",
    "// Descrição: código governado; consulte contratos/... antes de editar.",
  ].join("\n");
}

export function validarArquivoTocado(entrada: {
  arquivo?: string;
  linhas?: number;
  tipo?: TipoArquivoOrcamento | string;
}): ResultadoValidacaoArquivoTocado {
  const linhas = Number(entrada.linhas ?? 0);
  const tipo = (entrada.tipo as TipoArquivoOrcamento | undefined) ?? tipoArquivoOrcamento(entrada.arquivo ?? "");
  const arquivo = entrada.arquivo ?? "arquivo";
  const limites = limitesOrcamentoSemantico(tipo);
  const nomeContratoArtificial = tipo === "contrato" && arquivoContratoSemaTemNomeArtificial(arquivo);
  const severidade = nomeContratoArtificial ? "erro" : classificarLinhasOrcamentoSemantico(linhas, tipo);
  const tipoSemOrcamentoDeCodigo = tipo === "documentacao" || tipo === "gerado" || tipo === "migracao_historica";
  const permitido = tipoSemOrcamentoDeCodigo || severidade !== "erro";

  return {
    permitido,
    severidade: tipoSemOrcamentoDeCodigo ? "ok" : severidade,
    limite_aviso_linhas: limites.aviso,
    limite_bloqueio_linhas: limites.bloqueio,
    mensagem: tipo === "gerado"
      ? `${arquivo} e artefato gerado deterministico; valide a fonte humana governada em vez de dividir o artefato.`
      : tipo === "migracao_historica"
        ? `${arquivo} e migracao historica imutavel; novas migrations continuam obrigadas a passar pelo gate antes de serem criadas.`
      : tipo === "documentacao"
        ? `${arquivo} e documentacao; nao entra no limite de codigo, mas continua governado por docs-impacto, limite de bytes e verificacao de segredos.`
      : nomeContratoArtificial
        ? `${arquivo} usa nome artificial de parte numerada. Contratos .sema devem ser pequenos por dominio/capacidade, nunca parte_1/parte_2. Um mesmo arquivo de codigo pode ser governado por varios .sema via vinculos.`
      : tipo === "contrato" && severidade === "erro"
        ? `${arquivo} (${tipo}) tem ${linhas} linhas; limite bloqueante para .sema e ${limites.bloqueio}. Divida por dominio/capacidade real, nunca em parte_1/parte_2. Preserve guarantees, tests, authz, dados e vinculos; varios .sema podem governar o mesmo arquivo de codigo.`
      : tipo === "contrato" && severidade === "aviso"
        ? `${arquivo} (${tipo}) tem ${linhas} linhas; contrato .sema saudavel fica ate ${limites.aviso} linhas e bloqueia acima de ${limites.bloqueio}. Planeje split por capacidade antes de editar mais.`
      : severidade === "erro"
      ? `${arquivo} (${tipo}) tem ${linhas} linhas; reorganize em arquivos com responsabilidade unica antes de concluir. Exemplo web: index.html, styles/*.css, js/state.js, js/render/*.js e data/*.json. Nao fatie em _p1/_p2 sem fronteira semantica.`
      : severidade === "aviso"
        ? `${arquivo} (${tipo}) tem ${linhas} linhas; planeje modularizacao por responsabilidade antes de passar de ${limites.bloqueio}.`
        : `${arquivo} (${tipo}) esta dentro do orcamento semantico.`,
  };
}

export function emitirDiagnosticosCodigoMonolitico(entrada: {
  arquivo_codigo?: string;
  arquivo?: string;
  linhas?: number;
  simbolos?: number;
  conteudo?: string;
}): ResultadoDiagnosticoCodigoMonolitico {
  const arquivo = entrada.arquivo_codigo ?? entrada.arquivo ?? "arquivo_codigo";
  const linhas = Number(entrada.linhas ?? (entrada.conteudo ? contarLinhasConteudo(entrada.conteudo) : 0));
  const validacao = validarArquivoTocado({ arquivo, linhas, tipo: "codigo" });

  return {
    ...validacao,
    diagnostico_emitido: validacao.severidade !== "ok",
    precisa_refatorar_codigo: validacao.severidade === "erro",
    precisa_revisar_contrato_vinculado: validacao.severidade === "erro",
  };
}

export function validarCabecalhoCodigoGovernado(entrada: {
  arquivo_codigo?: string;
  possui_cabecalho_sema?: boolean;
  possui_descricao_humana?: boolean;
  conteudo?: string;
}): ResultadoCabecalhoCodigoGovernado {
  const conteudo = entrada.conteudo ?? "";
  const possuiCabecalho = entrada.possui_cabecalho_sema ?? conteudoTemCabecalhoSemaGoverned(conteudo);
  const possuiDescricao = entrada.possui_descricao_humana ?? conteudoTemDescricaoHumanaGovernada(conteudo);
  const permitido = Boolean(possuiCabecalho && possuiDescricao);
  const arquivo = entrada.arquivo_codigo ?? "codigo governado";
  const exemploCabecalho = exemploCabecalhoCodigoGovernado(arquivo);

  return {
    permitido,
    mensagem: permitido
      ? `${arquivo} possui SEMA-GOVERNED e descrição humana curta.`
      : `${arquivo} precisa de SEMA-GOVERNED e descrição humana curta antes de concluir. Exemplo:\n${exemploCabecalho}`,
    exemplo_cabecalho: exemploCabecalho,
    cobertura_ia_fraca_media_forte: true,
  };
}

export function avaliarOrcamentoArquivo(opcoes: {
  arquivo: string;
  conteudo: string;
  exigirCabecalhoCodigoGovernado?: boolean;
}): DiagnosticoOrcamentoArquivo[] {
  const tipoArquivo = tipoArquivoOrcamento(opcoes.arquivo);
  if (tipoArquivo === "documentacao" || tipoArquivo === "gerado" || tipoArquivo === "migracao_historica") {
    return [];
  }
  const linhas = contarLinhasConteudo(opcoes.conteudo);
  const validacao = validarArquivoTocado({ arquivo: opcoes.arquivo, linhas, tipo: tipoArquivo });
  const diagnosticos: DiagnosticoOrcamentoArquivo[] = [];

  if (validacao.severidade !== "ok") {
    diagnosticos.push({
      tipo: tipoArquivo === "contrato" ? "contrato_monolitico" : "codigo_monolitico",
      arquivo: opcoes.arquivo,
      linhas,
      severidade: validacao.severidade,
      bloqueia: validacao.severidade === "erro",
      mensagem: validacao.mensagem,
      limite_aviso_linhas: validacao.limite_aviso_linhas,
      limite_bloqueio_linhas: validacao.limite_bloqueio_linhas,
    });
  }

  if (tipoArquivo === "codigo" && opcoes.exigirCabecalhoCodigoGovernado) {
    const cabecalho = validarCabecalhoCodigoGovernado({
      arquivo_codigo: opcoes.arquivo,
      conteudo: opcoes.conteudo,
    });
    if (!cabecalho.permitido) {
      diagnosticos.push({
        tipo: "codigo_governado_sem_cabecalho",
        arquivo: opcoes.arquivo,
        linhas,
        severidade: "erro",
        bloqueia: true,
        mensagem: cabecalho.mensagem,
        limite_aviso_linhas: validacao.limite_aviso_linhas,
        limite_bloqueio_linhas: validacao.limite_bloqueio_linhas,
      });
    }
  }

  return diagnosticos;
}

export async function emitirDiagnosticosArquivosOrcamento(opcoes: {
  arquivos: string[];
  baseProjeto?: string;
  exigirCabecalhoCodigoGovernado?: boolean;
  leitorArquivos?: LeitorArquivosOrcamento;
}): Promise<DiagnosticoOrcamentoArquivo[]> {
  const baseProjeto = path.resolve(opcoes.baseProjeto ?? process.cwd());
  const diagnosticos: DiagnosticoOrcamentoArquivo[] = [];
  const vistos = new Set<string>();

  for (const arquivoInformado of opcoes.arquivos) {
    const absoluto = path.isAbsolute(arquivoInformado)
      ? arquivoInformado
      : path.resolve(baseProjeto, arquivoInformado);
    const resolvido = path.resolve(absoluto);
    const chave = process.platform === "win32" ? resolvido.toLowerCase() : resolvido;
    if (vistos.has(chave)) {
      continue;
    }
    vistos.add(chave);

    if (opcoes.leitorArquivos && !opcoes.leitorArquivos.contem(absoluto)) {
      continue;
    }

    try {
      const conteudo = opcoes.leitorArquivos
        ? await opcoes.leitorArquivos.lerTexto(absoluto)
        : await readFile(absoluto, "utf8");
      const relativo = path.relative(baseProjeto, absoluto).replace(/\\/g, "/") || arquivoInformado.replace(/\\/g, "/");
      diagnosticos.push(...avaliarOrcamentoArquivo({
        arquivo: relativo,
        conteudo,
        exigirCabecalhoCodigoGovernado: opcoes.exigirCabecalhoCodigoGovernado,
      }));
    } catch {
      continue;
    }
  }

  return diagnosticos;
}
