// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: gera um pacote local de contexto Sema sem depender de servico externo.

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type FormatoSaidaContexto = "inline" | "arquivo" | "ambos";

export interface PacoteContextoChat {
  contratos: string[];
  resumo: string;
  irResumida: string;
  driftResumido: string;
  impactMap: string[];
  docsRelevantes: string[];
  checksum: string;
}

export interface ContextoChatEntrada {
  contratos: string[];
  codigoSelecionado?: string[];
  incluirDrift?: boolean;
  incluirImpacto?: boolean;
  formatoSaida: FormatoSaidaContexto;
}

export interface ContextoChatResultado {
  pacote: PacoteContextoChat;
  prontoParaChat: boolean;
  tamanhoBytes: number;
  arquivosGerados: string[];
  inlineTexto?: string;
}

const LIMITE_TAMANHO_INLINE = 100_000;
const PADROES_SEGREDO = [
  /(?:api[_-]?key|secret|token|password|senha)\s*[:=]\s*["']?[A-Za-z0-9_-]{16,}/gi,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

export async function gerarPacoteContextoChat(
  entrada: ContextoChatEntrada,
  cwd = process.cwd(),
): Promise<ContextoChatResultado> {
  if (!entrada.contratos || entrada.contratos.length === 0) {
    throw new Error("No contract was provided. Use --contratos <file1.sema> <file2.sema>.");
  }

  const contratosConteudo: Array<{ caminho: string; conteudo: string }> = [];
  for (const contrato of entrada.contratos) {
    const absoluto = path.resolve(cwd, contrato);
    const conteudo = await readFile(absoluto, "utf8");
    contratosConteudo.push({ caminho: contrato, conteudo });
  }

  const codigoConteudo: Array<{ caminho: string; conteudo: string }> = [];
  for (const arquivo of entrada.codigoSelecionado ?? []) {
    try {
      const absoluto = path.resolve(cwd, arquivo);
      const conteudo = sanitizarConteudo(await readFile(absoluto, "utf8"));
      codigoConteudo.push({ caminho: arquivo, conteudo });
    } catch {
      // Missing selected files are ignored because this helper is best-effort context assembly.
    }
  }

  const modulos = contratosConteudo.map((contrato) => extrairModulo(contrato.conteudo)).filter(Boolean);
  const tarefas = contratosConteudo.flatMap((contrato) => extrairTarefas(contrato.conteudo));
  const rotas = contratosConteudo.flatMap((contrato) => extrairRotas(contrato.conteudo));

  const resumo = [
    "# Sema Local Context",
    "",
    `Modules: ${modulos.join(", ") || "none"}`,
    `Tasks: ${tarefas.length}`,
    `Routes: ${rotas.length}`,
    `Selected code files: ${codigoConteudo.length}`,
    "",
    "## Contracts",
    ...contratosConteudo.map((contrato) => `### ${contrato.caminho}\n\`\`\`sema\n${contrato.conteudo}\n\`\`\``),
    "",
  ].join("\n");

  const codigoResumido = codigoConteudo.length > 0
    ? [
        "## Selected Code",
        ...codigoConteudo.map((arquivo) => {
          const ext = path.extname(arquivo.caminho).slice(1) || "txt";
          return `### ${arquivo.caminho}\n\`\`\`${ext}\n${arquivo.conteudo}\n\`\`\``;
        }),
        "",
      ].join("\n")
    : "";

  const irResumida = [
    "## IR Summary",
    `- Modules: ${modulos.join(", ") || "none"}`,
    `- Tasks: ${tarefas.map((tarefa) => `\`${tarefa}\``).join(", ") || "none"}`,
    `- Routes: ${rotas.map((rota) => `\`${rota}\``).join(", ") || "none"}`,
    "",
  ].join("\n");

  const driftResumido = entrada.incluirDrift
    ? "## Drift\nRun `sema drift` locally for the authoritative drift result.\n"
    : "## Drift\nNot included. Run `sema drift` locally when drift evidence is required.\n";

  const impactMap = entrada.incluirImpacto
    ? tarefas.map((tarefa) => `- \`${tarefa}\`: local contract and linked implementation must be inspected with \`sema impacto\`.`)
    : [];

  const docsRelevantes = [
    "AGENTS.md",
    "docs/cli.md",
    "docs/syntax.md",
    "docs/documentation.md",
  ];

  const checksum = checksumSimples(contratosConteudo.map((contrato) => contrato.conteudo).join(""));
  const pacote: PacoteContextoChat = {
    contratos: entrada.contratos,
    resumo,
    irResumida,
    driftResumido,
    impactMap,
    docsRelevantes,
    checksum,
  };

  const inlineTexto = [
    `<!-- SEMA_CONTEXT_PACK v1 checksum=${checksum} -->`,
    resumo,
    codigoResumido,
    irResumida,
    driftResumido,
    impactMap.length > 0 ? `## Impact Map\n${impactMap.join("\n")}\n` : "",
    "## Relevant Docs",
    "Read these files before acting:",
    ...docsRelevantes.map((doc) => `- \`${doc}\``),
    "",
    "## Agent Instructions",
    "1. Read the contracts above. They are the source of truth.",
    "2. Treat selected code as context, not as a substitute for the contract.",
    "3. Run `sema docs-impacto` with the declared intention before changing files.",
    "4. Run `sema drift` and `sema impacto` locally before editing governed code.",
    "5. Close with `sema finalizar-mudanca` and concrete evidence.",
  ].join("\n");

  const tamanhoBytes = Buffer.byteLength(inlineTexto, "utf8");
  const prontoParaChat = tamanhoBytes <= LIMITE_TAMANHO_INLINE;
  const arquivosGerados: string[] = [];

  if (entrada.formatoSaida === "arquivo" || entrada.formatoSaida === "ambos") {
    const pastaSaida = path.resolve(cwd, ".tmp", "sema-contexto-chat");
    await mkdir(pastaSaida, { recursive: true });

    const arquivoContexto = path.join(pastaSaida, "SEMA_CONTEXT_CHAT.md");
    await writeFile(arquivoContexto, inlineTexto, "utf8");
    arquivosGerados.push(arquivoContexto);

    const arquivoJson = path.join(pastaSaida, "contexto-chat.json");
    await writeFile(arquivoJson, JSON.stringify({ pacote, tamanhoBytes, prontoParaChat }, null, 2), "utf8");
    arquivosGerados.push(arquivoJson);
  }

  return {
    pacote,
    prontoParaChat,
    tamanhoBytes,
    arquivosGerados,
    inlineTexto: entrada.formatoSaida === "inline" || entrada.formatoSaida === "ambos" ? inlineTexto : undefined,
  };
}

function extrairModulo(conteudo: string): string | null {
  const match = conteudo.match(/^module\s+([\w.]+)\s*\{/m);
  return match ? match[1] : null;
}

function extrairTarefas(conteudo: string): string[] {
  return [...conteudo.matchAll(/^\s*task\s+(\w+)\s*\{/gm)].map((match) => match[1]);
}

function extrairRotas(conteudo: string): string[] {
  return [...conteudo.matchAll(/^\s*route\s+(\w+)\s*\{/gm)].map((match) => match[1]);
}

function sanitizarConteudo(conteudo: string): string {
  let sanitizado = conteudo;
  for (const padrao of PADROES_SEGREDO) {
    sanitizado = sanitizado.replace(padrao, "[REDACTED]");
  }
  return sanitizado;
}

function checksumSimples(texto: string): string {
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash = ((hash << 5) - hash + texto.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}
