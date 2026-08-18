// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: cobre planejamento automatico de rotas Next.js (App e Pages Router) a partir dos blocos route.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { planejarEscopoDrift } from "../../pacotes/cli/src/driftEscopo.js";
import { carregarProjeto } from "../../pacotes/cli/src/projetoCarregar.js";

const CONTRATO = `module app.pix {
  task criar_cobranca {
    input { valor: Decimal required }
    output { cobranca: Texto }
    guarantees { cobranca existe }
    impl { ts: src.server.pix_service.criarCobranca }
  }
  route cobranca_api {
    metodo: POST
    caminho: /api/pix/charges
    task: criar_cobranca
    finalidade: cobranca
  }
  route webhook_api {
    metodo: POST
    caminho: "/api/webhooks/pix/{tenantId}"
    task: criar_cobranca
    finalidade: webhook
  }
}
`;

async function criarWorkspace(): Promise<string> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-rotas-next-"));
  await mkdir(path.join(base, "contratos"), { recursive: true });
  await writeFile(path.join(base, "contratos", "pix.sema"), CONTRATO, "utf8");
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
    origens: ["./contratos"],
    diretoriosCodigo: ["./src"],
    fontesLegado: ["nextjs", "typescript"],
  }, null, 2), "utf8");

  await mkdir(path.join(base, "src", "app", "api", "pix", "charges"), { recursive: true });
  await mkdir(path.join(base, "src", "app", "api", "webhooks", "pix", "[tenantId]"), { recursive: true });
  await mkdir(path.join(base, "src", "server"), { recursive: true });
  await writeFile(path.join(base, "src", "app", "api", "pix", "charges", "route.ts"),
    'export async function POST(request: Request) { return Response.json({}); }\n', "utf8");
  await writeFile(path.join(base, "src", "app", "api", "webhooks", "pix", "[tenantId]", "route.ts"),
    'export async function POST(request: Request) { return Response.json({}); }\n', "utf8");
  await writeFile(path.join(base, "src", "server", "pix-service.ts"),
    'export function criarCobranca(valor: number) { return valor.toString(); }\n', "utf8");
  return base;
}

test("escopo modulo planeja route.ts do App Router a partir dos blocos route", async () => {
  const base = await criarWorkspace();
  try {
    const contexto = await carregarProjeto(path.join(base, "contratos", "pix.sema"), base);
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "modulo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });

    const planejados = plano.arquivos.map((arquivo) => arquivo.replace(/\\/g, "/"));
    assert.ok(
      planejados.some((arquivo) => arquivo.endsWith("src/app/api/pix/charges/route.ts")),
      `rota direta nao planejada: ${planejados.join(", ")}`,
    );
    assert.ok(
      planejados.some((arquivo) => arquivo.endsWith("src/app/api/webhooks/pix/[tenantId]/route.ts")),
      `rota parametrizada nao planejada: ${planejados.join(", ")}`,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("escopo modulo planeja rota do Pages Router quando e o layout existente", async () => {
  const base = await criarWorkspace();
  try {
    await mkdir(path.join(base, "src", "pages", "api", "pix"), { recursive: true });
    await rm(path.join(base, "src", "app"), { recursive: true, force: true });
    await writeFile(path.join(base, "src", "pages", "api", "pix", "charges.ts"),
      'export default function handler(req: any, res: any) { res.json({}); }\n', "utf8");

    const contexto = await carregarProjeto(path.join(base, "contratos", "pix.sema"), base);
    const plano = await planejarEscopoDrift(contexto, {
      escopo: "modulo",
      ignorarWorktrees: true,
      ignorarConsumidoresLaterais: true,
      termosEscopo: [],
    });

    const planejados = plano.arquivos.map((arquivo) => arquivo.replace(/\\/g, "/"));
    assert.ok(
      planejados.some((arquivo) => arquivo.endsWith("src/pages/api/pix/charges.ts")),
      `rota pages nao planejada: ${planejados.join(", ")}`,
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
