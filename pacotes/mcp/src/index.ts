#!/usr/bin/env node
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { spawnSync } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import pacoteMcp from "../package.json" with { type: "json" };

function resolverSema(): { cmd: string; prefixArgs: string[] } {
  if (process.platform === "win32") {
    return { cmd: "cmd.exe", prefixArgs: ["/c", "sema"] };
  }
  // Tenta caminhos comuns em Linux/Mac onde npm global instala
  const candidatos = [
    "/usr/bin/sema",
    "/usr/local/bin/sema",
    "/usr/lib/node_modules/.bin/sema",
  ];
  for (const c of candidatos) {
    try {
      accessSync(c, fsConstants.X_OK);
      return { cmd: c, prefixArgs: [] };
    } catch {}
  }
  return { cmd: "sema", prefixArgs: [] };
}

const { cmd: SEMA_CMD, prefixArgs: SEMA_PREFIX } = resolverSema();
const VERSAO_MCP = pacoteMcp.version;

function resolverCwd(cwd?: string): string {
  if (!cwd) return process.cwd();
  try {
    accessSync(cwd, fsConstants.F_OK);
    return cwd;
  } catch {
    return process.cwd();
  }
}

function chamarSema(args: string[], cwd?: string): string {
  const resultado = spawnSync(SEMA_CMD, [...SEMA_PREFIX, ...args], {
    encoding: "utf-8",
    cwd: resolverCwd(cwd),
    env: process.env,
    shell: false,
  });
  const saida = (resultado.stdout ?? "").trim();
  const erro = (resultado.stderr ?? "").trim();
  if (resultado.error) {
    return `Erro ao chamar sema: ${resultado.error.message}`;
  }
  return [saida, erro].filter(Boolean).join("\n");
}

function registrarFerramentas(s: McpServer): void {
  s.tool(
    "sema_validar",
    "Valida um arquivo .sema e retorna diagnosticos de erro ou sucesso.",
    { arquivo: z.string().describe("Caminho absoluto ou relativo para o arquivo .sema") },
    async ({ arquivo }) => ({
      content: [{ type: "text", text: chamarSema(["validar", arquivo]) }],
    })
  );

  s.tool(
    "sema_ir",
    "Compila um arquivo .sema e retorna a representacao intermediaria (IR) em JSON.",
    { arquivo: z.string().describe("Caminho para o arquivo .sema") },
    async ({ arquivo }) => ({
      content: [{ type: "text", text: chamarSema(["ir", arquivo, "--json"]) }],
    })
  );

  s.tool(
    "sema_drift",
    "Analisa o drift entre o contrato .sema e o codigo do projeto. Retorna divergencias encontradas.",
    {
      projeto: z.string().optional().describe("Caminho do projeto (padrao: diretorio atual)"),
      json: z.boolean().optional().describe("Retornar saida em JSON"),
    },
    async ({ projeto, json }) => {
      const args = ["drift", ...(projeto ? [projeto] : []), ...(json ? ["--json"] : [])];
      return { content: [{ type: "text", text: chamarSema(args, projeto) }] };
    }
  );

  s.tool(
    "sema_resumo",
    "Gera um resumo IA-first do projeto Sema com modulos, riscos e lacunas.",
    {
      projeto: z.string().optional().describe("Caminho do projeto (padrao: diretorio atual)"),
      tamanho: z.enum(["micro", "curto", "medio"]).optional().describe("Tamanho do resumo (padrao: curto)"),
    },
    async ({ projeto, tamanho }) => {
      const args = ["resumo", ...(tamanho ? [`--tamanho=${tamanho}`] : [])];
      return { content: [{ type: "text", text: chamarSema(args, projeto) }] };
    }
  );

  s.tool(
    "sema_prompt_ia",
    "Gera o prompt-curto IA-first do projeto para briefar um agente sobre o estado atual.",
    { projeto: z.string().optional().describe("Caminho do projeto") },
    async ({ projeto }) => ({
      content: [{ type: "text", text: chamarSema(["prompt-curto"], projeto) }],
    })
  );

  s.tool(
    "sema_contexto_ia",
    "Gera o pacote completo de contexto IA para um modulo ou projeto (briefing, drift, IR, artefatos).",
    { arquivo: z.string().describe("Caminho para o arquivo .sema do modulo") },
    async ({ arquivo }) => ({
      content: [{ type: "text", text: chamarSema(["contexto-ia", arquivo]) }],
    })
  );

  s.tool(
    "sema_verificar",
    "Verifica todos os alvos de geracao de um projeto Sema (compila, gera e testa cada alvo).",
    {
      projeto: z.string().describe("Caminho do projeto a verificar"),
      saida: z.string().optional().describe("Pasta de saida dos artefatos gerados"),
    },
    async ({ projeto, saida }) => {
      const args = ["verificar", projeto, ...(saida ? ["--saida", saida] : [])];
      return { content: [{ type: "text", text: chamarSema(args, projeto) }] };
    }
  );

  s.tool(
    "sema_inspecionar",
    "Inspeciona um arquivo .sema e mostra detalhes do modulo: rotas, tarefas, eventos, politicas.",
    { arquivo: z.string().describe("Caminho para o arquivo .sema") },
    async ({ arquivo }) => ({
      content: [{ type: "text", text: chamarSema(["inspecionar", arquivo]) }],
    })
  );
}

const porta = process.env["MCP_PORT"] ? parseInt(process.env["MCP_PORT"]) : null;

if (porta) {
  // Modo HTTP remoto — suporta Streamable HTTP (/mcp) e SSE legado (/sse)
  const httpTransportes = new Map<string, StreamableHTTPServerTransport>();
  const sseTransportes = new Map<string, SSEServerTransport>();

  const http = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";

    // Streamable HTTP — protocolo MCP moderno
    if (url === "/mcp") {
      if (req.method === "POST") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        let transport = sessionId ? httpTransportes.get(sessionId) : undefined;

        if (!transport) {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => crypto.randomUUID(),
            onsessioninitialized: (id) => { httpTransportes.set(id, transport!); },
          });
          transport.onclose = () => {
            if (transport!.sessionId) httpTransportes.delete(transport!.sessionId);
          };
          const s = new McpServer({ name: "sema", version: VERSAO_MCP });
          registrarFerramentas(s);
          await s.connect(transport);
        }

        await transport.handleRequest(req, res);
        return;
      }

      if (req.method === "GET" || req.method === "DELETE") {
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        const transport = sessionId ? httpTransportes.get(sessionId) : undefined;
        if (!transport) { res.writeHead(404).end("Sessao nao encontrada"); return; }
        await transport.handleRequest(req, res);
        return;
      }
    }

    // SSE legado — compatibilidade com GPT e clientes antigos
    if (req.method === "GET" && url === "/sse") {
      const sseTransport = new SSEServerTransport("/message", res);
      sseTransportes.set(sseTransport.sessionId, sseTransport);
      res.on("close", () => sseTransportes.delete(sseTransport.sessionId));
      const s = new McpServer({ name: "sema", version: VERSAO_MCP });
      registrarFerramentas(s);
      await s.connect(sseTransport);
      return;
    }

    if (req.method === "POST" && url.startsWith("/message")) {
      const sessionId = new URL(url, "http://localhost").searchParams.get("sessionId") ?? "";
      const sseTransport = sseTransportes.get(sessionId);
      if (!sseTransport) { res.writeHead(404).end("Sessao nao encontrada"); return; }
      await sseTransport.handlePostMessage(req, res);
      return;
    }

    res.writeHead(404).end();
  });

  http.listen(porta, () => {
    process.stderr.write(`sema-mcp rodando na porta ${porta} (HTTP: /mcp | SSE: /sse)\n`);
  });
} else {
  // Modo stdio — uso local com Claude Code, Cursor, VS Code
  const server = new McpServer({ name: "sema", version: VERSAO_MCP });
  registrarFerramentas(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
