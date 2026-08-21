// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: CLI particionada; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { emitirDiagnosticosArquivosOrcamento } from "./driftOrcamento.js";

export const LIMITE_CONTEUDO_DOC = 16_000;

export type TipoDocumentoMudanca = "raiz" | "documentacao" | "runbook" | "pacote" | "contrato";

export interface DocumentoPlanejado {
  relativo: string;
  tipo: TipoDocumentoMudanca;
  motivo: string;
  permitirCriacao: boolean;
  obrigatoriedade?: "bloqueante" | "recomendada";
}

export interface DocumentoObrigatorioMudanca {
  caminho: string;
  relativo: string;
  tipo: TipoDocumentoMudanca;
  motivo: string;
  existe: boolean;
  criado: boolean;
  criacaoAutomatica: boolean;
  obrigatorio: boolean;
  conteudo?: string;
  truncado?: boolean;
  template?: string;
  templatePendente?: boolean;
  substancia?: boolean;
  obrigatoriedade: "bloqueante" | "recomendada";
}

export interface BloqueioDocumentacaoMudanca {
  tipo:
    | "documentacao_ausente"
    | "leitura_obrigatoria_nao_comprovada"
    | "documentacao_template_cru"
    | "documentacao_sem_substancia"
    | "arquivo_monolitico"
    | "codigo_governado_sem_cabecalho";
  severidade: 4 | 5;
  caminho: string;
  mensagem: string;
  linhas?: number;
  limite_bloqueio_linhas?: number;
}

export interface ResultadoDocumentacaoObrigatoria {
  sucesso: boolean;
  baseProjeto: string;
  intencao: string;
  categorias: string[];
  arquivosAlvo: string[];
  leituraObrigatoria: DocumentoObrigatorioMudanca[];
  docsAusentes: DocumentoObrigatorioMudanca[];
  docsCriadas: DocumentoObrigatorioMudanca[];
  leituraRecomendada: DocumentoObrigatorioMudanca[];
  bloqueios: BloqueioDocumentacaoMudanca[];
  instrucoes: string[];
}

export interface ResultadoVerificacaoDocumentacaoMudanca {
  sucesso: boolean;
  baseProjeto: string;
  intencao: string;
  leituraRecomendada: DocumentoObrigatorioMudanca[];
  categorias: string[];
  docsLidas: string[];
  leituraObrigatoria: DocumentoObrigatorioMudanca[];
  docsNaoLidas: DocumentoObrigatorioMudanca[];
  docsAusentes: DocumentoObrigatorioMudanca[];
  docsTemplatePendentes: DocumentoObrigatorioMudanca[];
  diagnosticos: BloqueioDocumentacaoMudanca[];
  instrucoes: string[];
}

export interface RegraDocumentacao {
  categoria: string;
  padroes: RegExp[];
  docs: DocumentoPlanejado[];
}

export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizarRelativo(valor: string): string {
  return valor.replace(/\\/g, "/").replace(/^\.\//, "");
}

export const TERMOS_RELACAO_CONTRATO_IGNORADOS = new Set([
  "acao",
  "acoes",
  "agente",
  "agentes",
  "alvo",
  "alvos",
  "arquivo",
  "arquivos",
  "codigo",
  "contrato",
  "contratos",
  "docs",
  "documentacao",
  "fluxo",
  "fluxos",
  "governanca",
  "mudanca",
  "pacote",
  "pacotes",
  "para",
  "pratica",
  "pratico",
  "projeto",
  "readme",
  "sema",
  "src",
]);

export function separarTermosBusca(valor: string): string[] {
  return normalizarTexto(valor)
    .split(/[^a-z0-9_]+/g)
    .map((parte) => parte.trim())
    .filter(Boolean);
}

export function termoContratoRelevante(termo: string): boolean {
  return termo.length >= 4 && !TERMOS_RELACAO_CONTRATO_IGNORADOS.has(termo);
}

export function nomeArquivoSemExtensao(relativo: string): string {
  const nome = normalizarRelativo(relativo).split("/").pop() ?? relativo;
  return nome.replace(/\.[^.]+$/, "");
}

export function termosArquivoAlvoParaContrato(relativo: string): string[] {
  const nomeBase = normalizarTexto(nomeArquivoSemExtensao(relativo));
  const termos = new Set<string>();

  if (termoContratoRelevante(nomeBase)) {
    termos.add(nomeBase);
  }

  for (const parte of separarTermosBusca(nomeBase.replace(/_/g, " "))) {
    if (termoContratoRelevante(parte)) {
      termos.add(parte);
    }
  }

  return [...termos];
}

export function termosRelacionamentoContratos(intencao: string, arquivosAlvo: string[]): string[] {
  const termos = new Set<string>();

  for (const termo of separarTermosBusca(intencao)) {
    if (termoContratoRelevante(termo)) {
      termos.add(termo);
    }
  }

  for (const arquivo of arquivosAlvo) {
    for (const termo of termosArquivoAlvoParaContrato(arquivo)) {
      termos.add(termo);
    }
  }

  return [...termos];
}

export function tituloDeRelativo(relativo: string): string {
  const base = path.basename(relativo, path.extname(relativo));
  return base
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((parte) => `${parte.charAt(0).toUpperCase()}${parte.slice(1)}`)
    .join(" ");
}

export async function caminhoExiste(caminho: string): Promise<boolean> {
  try {
    await stat(caminho);
    return true;
  } catch {
    return false;
  }
}

export function caminhoEstaDentro(base: string, alvo: string): boolean {
  const relativo = path.relative(base, alvo);
  return relativo === "" || (!relativo.startsWith("..") && !path.isAbsolute(relativo));
}

export async function listarArquivosRecursivo(base: string, limite = 80): Promise<string[]> {
  const encontrados: string[] = [];

  async function visitar(pasta: string): Promise<void> {
    if (encontrados.length >= limite || !(await caminhoExiste(pasta))) {
      return;
    }

    const entradas = await readdir(pasta, { withFileTypes: true });
    for (const entrada of entradas.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) {
      if (encontrados.length >= limite) {
        return;
      }
      const caminho = path.join(pasta, entrada.name);
      if (entrada.isDirectory()) {
        if (!["node_modules", ".git", ".tmp", "dist"].includes(entrada.name)) {
          await visitar(caminho);
        }
        continue;
      }
      encontrados.push(caminho);
    }
  }

  await visitar(base);
  return encontrados;
}

export const REGRAS_DOCUMENTACAO: RegraDocumentacao[] = [
  {
    categoria: "deploy",
    padroes: [/deploy/, /publicar/, /producao/, /release/, /pipeline/, /\bci\b/, /\bcd\b/, /vercel/, /cloudflare/, /docker/, /edge.?function/i, /\bruntime\b/i, /\blambda\b/i, /\bworker\b/i, /\bserverless\b/i],
    docs: [
      { relativo: "docs/deploy.md", tipo: "runbook", motivo: "runbook de deploy antes de publicar ou alterar pipeline", permitirCriacao: true },
      { relativo: "docs/env.md", tipo: "runbook", motivo: "variaveis, secrets e ambientes usados no deploy", permitirCriacao: true },
      { relativo: "docs/rollback.md", tipo: "runbook", motivo: "plano de rollback obrigatorio antes de deploy", permitirCriacao: true },
    ],
  },
  {
    categoria: "api",
    padroes: [/rota/, /endpoint/, /\bapi\b/, /controller/, /webhook/, /http/],
    docs: [
      { relativo: "docs/api.md", tipo: "documentacao", motivo: "contrato operacional de rotas e endpoints", permitirCriacao: true },
    ],
  },
  {
    categoria: "author",
    padroes: [/\bauthor\b/, /autoral/, /obra/, /cliche/, /estilo/, /personagem/, /narrativa/, /sensibility/, /sensitivity/],
    docs: [
      { relativo: "docs/profiles.md", tipo: "documentacao", motivo: "Author profile and local validation guardrails", permitirCriacao: false },
    ],
  },
  {
    categoria: "profile",
    padroes: [/\bprofiles\b/, /\bworkflow\b/, /\bn8n\b/, /\bops\b/, /\bgame\b/, /\blegal\b/, /\bresearch\b/, /pesquisa/, /juridic/, /orquestracao/, /automacao/],
    docs: [
      { relativo: "docs/profiles.md", tipo: "documentacao", motivo: "profiles oficiais, gates e fronteiras de adapter", permitirCriacao: false },
    ],
  },
  {
    categoria: "auth",
    padroes: [/(^|[^a-z0-9])auth([^a-z0-9]|$)/, /autentic/, /login/, /permiss/, /autoriz/, /token/, /oauth/, /seguranca/],
    docs: [
      { relativo: "docs/auth.md", tipo: "documentacao", motivo: "regras de autenticacao, autorizacao e tokens", permitirCriacao: true },
      { relativo: "docs/security.md", tipo: "documentacao", motivo: "politicas de seguranca afetadas pela mudanca", permitirCriacao: true },
    ],
  },
  {
    categoria: "persistencia",
    padroes: [/banco/, /database/, /persist/, /migration/, /migracao/, /prisma/, /postgres/, /redis/, /mongodb/],
    docs: [
      { relativo: "docs/database.md", tipo: "runbook", motivo: "operacao de banco, migracoes e validacao de dados", permitirCriacao: true },
    ],
  },
  {
    categoria: "integracao_ia",
    padroes: [/codex/, /agent/, /agente/, /tool/, /ferramenta/],
    docs: [
      { relativo: "docs/ai-integration.md", tipo: "documentacao", motivo: "integracao do Sema com agentes IA", permitirCriacao: false },
    ],
  },
  {
    categoria: "cli",
    padroes: [/\bcli\b/, /comando/, /terminal/],
    docs: [
      { relativo: "pacotes/cli/README.md", tipo: "pacote", motivo: "documentacao publica da CLI", permitirCriacao: false },
      { relativo: "docs/cli.md", tipo: "documentacao", motivo: "guia operacional dos comandos da CLI", permitirCriacao: false },
    ],
  },
  {
    categoria: "contrato",
    padroes: [/contrato/, /\.sema/, /semant/, /\bsema\b/, /drift/, /governanca/],
    docs: [
      { relativo: "docs/syntax.md", tipo: "documentacao", motivo: "sintaxe e blocos de contrato Sema", permitirCriacao: false },
      { relativo: "docs/ai-workflow.md", tipo: "documentacao", motivo: "fluxo IA-first antes de editar contratos", permitirCriacao: false },
    ],
  },
  {
    categoria: "frontend",
    padroes: [/frontend/, /\bui\b/, /react/, /vite/, /next/, /css/, /html/, /pagina/],
    docs: [
      { relativo: "docs/frontend.md", tipo: "documentacao", motivo: "decisoes e validacoes de interface", permitirCriacao: true },
    ],
  },
  {
    categoria: "testes",
    padroes: [/teste/, /testar/, /qa/, /validacao/, /regressao/],
    docs: [
      { relativo: "docs/testing.md", tipo: "runbook", motivo: "estrategia de testes e regressao", permitirCriacao: true },
    ],
  },
  {
    categoria: "documentacao",
    padroes: [/doc/, /readme/, /manual/, /runbook/, /onboarding/],
    docs: [
      { relativo: "docs/README.md", tipo: "documentacao", motivo: "indice de documentacao do projeto", permitirCriacao: false },
      { relativo: "docs/documentation.md", tipo: "documentacao", motivo: "politica de atualizacao documental", permitirCriacao: true },
    ],
  },
];

export function inferirCategorias(intencao: string, arquivosAlvo: string[]): string[] {
  const texto = normalizarTexto(`${intencao} ${arquivosAlvo.join(" ")}`);
  const categorias = REGRAS_DOCUMENTACAO
    .filter((regra) => regra.padroes.some((padrao) => padrao.test(texto)))
    .map((regra) => regra.categoria);
  return categorias.length > 0 ? [...new Set(categorias)] : ["mudanca"];
}

export function criarTemplateDoc(doc: DocumentoPlanejado, intencao: string, categorias: string[], arquivosAlvo: string[]): string {
  const titulo = tituloDeRelativo(doc.relativo);
  const linhas = [
    `# ${titulo}`,
    "",
    "This document was created by Sema because an AI declared an intention that requires operational reading before action.",
    "",
    "## Intention",
    "",
    intencao || "Describe the operational intention before making the change.",
    "",
    "## Scope",
    "",
    arquivosAlvo.length > 0
      ? arquivosAlvo.map((arquivo) => `- ${arquivo}`).join("\n")
      : "- Declare the affected files, services, or contracts.",
    "",
    "## Required Reading Before Action",
    "",
    "- Read this whole document.",
    "- Read related `.sema` contracts before editing code.",
    "- Read the involved README, runbooks, and package docs.",
    "",
    "## Procedure",
    "",
    "- Describe the safe commands or steps.",
    "- Declare preconditions, variables, and dependencies.",
    "- Record how success will be validated.",
    "",
    "## Validation",
    "",
    "- List build, test, verification, or smoke-check commands.",
    "- Record expected evidence.",
    "",
    "## Rollback",
    "",
    "- Describe how to undo the change.",
    "- Declare signals that require rollback.",
    "",
    "## Documentation Update",
    "",
    "- Update this file when the operational flow changes.",
    "- Update related docs and contracts in the same change.",
    "",
    `Inferred categories: ${categorias.join(", ")}`,
    "",
  ];

  return `${linhas.join("\n")}\n`;
}

export function documentoPareceTemplateCriadoPelaSema(conteudo: string): boolean {
  const texto = normalizarTexto(conteudo);
  const criadoPelaSema = [
    "documento criado pela sema porque uma ia declarou",
    "this document was created by sema because an ai declared",
    "documento creado por sema porque una ia declaro",
  ].some((marcador) => texto.includes(marcador));
  const placeholderPendente = [
    "descrever os comandos ou passos seguros",
    "declarar pre-condicoes",
    "registrar como validar sucesso",
    "listar comandos de build",
    "descrever como desfazer a mudanca",
  ].some((placeholder) => texto.includes(placeholder));

  return criadoPelaSema && placeholderPendente;
}

export const MINIMO_CARACTERES_SUBSTANCIA_DOC = 120;

export function documentoTemSubstancia(conteudo: string): boolean {
  const texto = normalizarTexto(conteudo)
    .replace(/[#*_>`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return texto.length >= MINIMO_CARACTERES_SUBSTANCIA_DOC;
}

export function resumoConteudo(conteudo: string): { conteudo: string; truncado: boolean } {
  if (conteudo.length <= LIMITE_CONTEUDO_DOC) {
    return { conteudo, truncado: false };
  }

  return {
    conteudo: `${conteudo.slice(0, LIMITE_CONTEUDO_DOC)}\n\n[TRUNCADO PELO SEMA: leia o arquivo completo antes de agir.]`,
    truncado: true,
  };
}

export async function adicionarDocsRaizExistentes(baseProjeto: string, registrar: (doc: DocumentoPlanejado) => void): Promise<void> {
  const docsRaiz = [
    { relativo: "AGENTS.md", tipo: "raiz" as const, motivo: "regras obrigatorias do agente no projeto" },
    { relativo: "SEMA_INDEX.json", tipo: "raiz" as const, motivo: "indice IA-first do projeto" },
    { relativo: "README.md", tipo: "raiz" as const, motivo: "visao geral publica do projeto" },
    { relativo: "docs/README.md", tipo: "documentacao" as const, motivo: "indice de documentacao" },
  ];

  for (const doc of docsRaiz) {
    if (await caminhoExiste(path.join(baseProjeto, doc.relativo))) {
      registrar({ ...doc, permitirCriacao: false });
    }
  }
}

export async function adicionarReadmesDeArquivos(
  baseProjeto: string,
  arquivosAlvo: string[],
  registrar: (doc: DocumentoPlanejado) => void,
): Promise<void> {
  for (const arquivo of arquivosAlvo) {
    const absoluto = path.resolve(baseProjeto, arquivo);
    if (!caminhoEstaDentro(baseProjeto, absoluto)) {
      continue;
    }

    let pasta = (await caminhoExiste(absoluto)) && (await stat(absoluto)).isDirectory()
      ? absoluto
      : path.dirname(absoluto);

    while (caminhoEstaDentro(baseProjeto, pasta)) {
      const readme = path.join(pasta, "README.md");
      if (await caminhoExiste(readme)) {
        registrar({
          relativo: normalizarRelativo(path.relative(baseProjeto, readme)),
          tipo: "pacote",
          motivo: `README mais proximo de ${normalizarRelativo(arquivo)}`,
          permitirCriacao: false,
        });
        break;
      }

      const proxima = path.dirname(pasta);
      if (proxima === pasta) {
        break;
      }
      pasta = proxima;
    }
  }
}
