import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  criarProjetoCppBridge,
  criarProjetoDotnetAspNet,
  criarProjetoFirebaseWorker,
  criarProjetoFlaskEstiloGestech,
  criarProjetoGoHttp,
  criarProjetoNextJsAppRouter,
  criarProjetoRustAxum,
  criarProjetoSpringBoot,
} from "./futebot-fixture.ts";

const CLI = path.resolve("pacotes/cli/dist/index.js");

function executarImportacao(args: string[], cwd?: string) {
  return spawnSync("node", [CLI, ...args], {
    stdio: "pipe",
    encoding: "utf8",
    cwd,
  });
}

test("cli importa projeto NestJS legado e gera rascunho Sema valido", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-nest-"));

  try {
    await mkdir(path.join(base, "src", "pedidos"), { recursive: true });
    await mkdir(path.join(base, "src", "contracts"), { recursive: true });
    await writeFile(
      path.join(base, "src", "pedidos", "pedidos.controller.ts"),
      `import { Controller, Post, Body } from "@nestjs/common";
import { PedidosService } from "./pedidos.service";
import type { CriarPedidoEntradaPublica, CriarPedidoSaidaPublica } from "../contracts/pedidos";

@Controller("pedidos")
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  async criar(@Body() body: CriarPedidoEntradaPublica): Promise<CriarPedidoSaidaPublica> {
    return this.pedidosService.criar(body);
  }
}
`,
      "utf8",
    );
    await writeFile(
      path.join(base, "src", "pedidos", "pedidos.service.ts"),
      `import { Injectable, BadRequestException } from "@nestjs/common";
import type { CriarPedidoEntrada, CriarPedidoSaida } from "../contracts/pedidos";

@Injectable()
export class PedidosService {
  async criar(entrada: CriarPedidoEntrada): Promise<CriarPedidoSaida> {
    if (entrada.total <= 0) {
      throw new BadRequestException("total invalido");
    }

    return {
      pedido: {
        id: "ped_1",
        total: entrada.total,
        status: "PENDENTE",
      },
    };
  }
}
`,
      "utf8",
    );
    await writeFile(
      path.join(base, "src", "contracts", "pedidos.ts"),
      `export interface Pedido {
  id: string;
  total: number;
  status: StatusPedido;
}

export type StatusPedido = "PENDENTE" | "CONFIRMADO";

export interface CriarPedidoEntrada {
  total: number;
  comprador_id: string;
}

export interface CriarPedidoSaida {
  pedido: Pedido;
}

export interface CriarPedidoEntradaPublica {
  total: number;
  comprador_id: string;
}

export interface CriarPedidoSaidaPublica {
  pedido: Pedido;
}
`,
      "utf8",
    );

    const execucao = executarImportacao(["importar", "nestjs", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.comando, "importar");
    assert.equal(json.fonte, "nestjs");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas, 1);
    assert.equal(json.resumo.tarefas, 1);
    assert.equal(json.resumo.entidades, 1);
    assert.equal(json.resumo.enums, 1);

    const arquivo = await readFile(path.join(base, "sema", "pedidos.sema"), "utf8");
    assert.match(arquivo, /module legado\./);
    assert.match(arquivo, /entity Pedido/);
    assert.match(arquivo, /enum StatusPedido/);
    assert.match(arquivo, /task criar/);
    assert.match(arquivo, /route criar_publico/);
    assert.match(arquivo, /impl \{/);
    assert.match(arquivo, /ts: src\.pedidos\.pedidos_service\.criar/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto FastAPI legado e gera rascunho Sema valido", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-fastapi-"));

  try {
    await mkdir(path.join(base, "app"), { recursive: true });
    await writeFile(
      path.join(base, "app", "pedidos_router.py"),
      `from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/pedidos")

class Pedido(BaseModel):
    id: str
    total: float

class CriarPedidoInput(BaseModel):
    total: float
    comprador_id: str

class CriarPedidoOutput(BaseModel):
    pedido: Pedido

@router.post("/")
async def criar_pedido(payload: CriarPedidoInput) -> CriarPedidoOutput:
    if payload.total <= 0:
        raise HTTPException(status_code=400, detail="total invalido")
    return CriarPedidoOutput(pedido=Pedido(id="ped_1", total=payload.total))
`,
      "utf8",
    );

    const execucao = executarImportacao(["importar", "fastapi", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "fastapi");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas, 1);
    assert.equal(json.resumo.tarefas >= 1, true);

    const arquivo = await readFile(path.join(base, "sema", "pedidos.sema"), "utf8");
    assert.match(arquivo, /route criar_pedido_publico/);
    assert.match(arquivo, /caminho: \/pedidos/);
    assert.match(arquivo, /py: app\.pedidos_router\.criar_pedido/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Flask legado e gera rascunho Sema valido", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-flask-"));

  try {
    await criarProjetoFlaskEstiloGestech(base);

    const execucao = executarImportacao(["importar", "flask", path.join(base, "Gestech"), "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "flask");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas >= 6, true);
    assert.equal(json.resumo.tarefas >= 6, true);

    const arquivoRanking = await readFile(path.join(base, "sema", "routes", "api_ranking.sema"), "utf8");
    assert.match(arquivoRanking, /route app_version_publico/);
    assert.match(arquivoRanking, /caminho: \/api\/ranking-showroom/);
    assert.match(arquivoRanking, /py: routes\.api_ranking\.ranking_showroom/);

    const arquivoFerramentas = await readFile(path.join(base, "sema", "routes", "api_ferramentas.sema"), "utf8");
    assert.match(arquivoFerramentas, /route api_admin_item_publico/);
    assert.match(arquivoFerramentas, /route api_admin_item_delete_publico/);
    assert.match(arquivoFerramentas, /caminho: "\/api\/ferramentas\/admin\/\{ferramenta_id\}"/);
    assert.match(arquivoFerramentas, /ferramenta_id: Inteiro required/);

    const arquivoApp = await readFile(path.join(base, "sema", "importado.sema"), "utf8");
    assert.match(arquivoApp, /route status_publico/);
    assert.match(arquivoApp, /route sync_store_publico/);
    assert.match(arquivoApp, /route sync_store_post_publico/);
    assert.match(arquivoApp, /metodo: POST/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Next.js App Router legado e gera route + task com impl ts", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-nextjs-"));

  try {
    await criarProjetoNextJsAppRouter(base);

    const execucao = executarImportacao(["importar", "nextjs", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "nextjs");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas >= 4, true);
    assert.equal(json.resumo.tarefas >= 4, true);

    const arquivo = await readFile(path.join(base, "sema", "api", "reposicao.sema"), "utf8");
    assert.match(arquivo, /route api_reposicao_get_publico/);
    assert.match(arquivo, /caminho: \/api\/reposicao/);
    assert.match(arquivo, /ts: src\.app\.api\.reposicao\.route\.GET/);

    const arquivoDinamico = await readFile(path.join(base, "sema", "api", "reposicao", "itemid.sema"), "utf8");
    assert.match(arquivoDinamico, /caminho: "\/api\/reposicao\/\{itemId\}"/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Firebase worker legado e gera rascunho com impl ts e health route", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-firebase-"));

  try {
    await criarProjetoFirebaseWorker(base);

    const execucao = executarImportacao(["importar", "firebase", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "firebase");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.tarefas >= 3, true);
    assert.equal(json.resumo.rotas >= 1, true);

    const arquivoBridge = await readFile(path.join(base, "sema", "sema_contract_bridge.sema"), "utf8").catch(() => "");
    const arquivoHealth = await readFile(path.join(base, "sema", "services", "health_check.sema"), "utf8").catch(() => "");
    const combinado = `${arquivoBridge}\n${arquivoHealth}`;
    assert.match(combinado, /ts: src\.sema_contract_bridge\.semaWorkerHealthPayload|ts: src\.sema_contract_bridge\.semaCollectionNames/);
    assert.match(combinado, /route health_get_publico/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto TypeScript generico e gera task com impl ts", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-ts-"));

  try {
    await mkdir(path.join(base, "src", "core"), { recursive: true });
    await writeFile(
      path.join(base, "src", "core", "pagamentos.ts"),
      `export interface CapturaEntrada {
  transacao_id: string;
  valor: number;
}

export interface CapturaSaida {
  protocolo: string;
}

export async function capturarPagamento(entrada: CapturaEntrada): Promise<CapturaSaida> {
  return { protocolo: entrada.transacao_id };
}

export class PagamentosService {
  async estornar(transacao_id: string): Promise<boolean> {
    return true;
  }
}
`,
      "utf8",
    );

    const execucao = executarImportacao(["importar", "typescript", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "typescript");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.tarefas, 2);

    const arquivo = await readFile(path.join(base, "sema", "core", "pagamentos.sema"), "utf8");
    assert.match(arquivo, /task capturar_pagamento/);
    assert.match(arquivo, /task estornar/);
    assert.match(arquivo, /ts: src\.core\.pagamentos\.capturarPagamento/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Python generico e gera task com impl py", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-py-"));

  try {
    await mkdir(path.join(base, "services"), { recursive: true });
    await writeFile(
      path.join(base, "services", "escrow.py"),
      `class EscrowService:
    def reter(self, transacao_id: str, valor: float) -> bool:
        return True

def liberar(transacao_id: str) -> bool:
    return True
`,
      "utf8",
    );

    const execucao = executarImportacao(["importar", "python", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "python");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.tarefas, 2);

    const arquivo = await readFile(path.join(base, "sema", "services", "escrow.sema"), "utf8");
    assert.match(arquivo, /task reter/);
    assert.match(arquivo, /task liberar/);
    assert.match(arquivo, /py: services\.escrow\.liberar/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Dart generico e gera task com impl dart", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-dart-"));

  try {
    await mkdir(path.join(base, "lib"), { recursive: true });
    await writeFile(
      path.join(base, "lib", "payments_service.dart"),
      `Future<String> processarPagamento(String transacaoId, double valor) {
  return Future.value(transacaoId);
}
`,
      "utf8",
    );

    const execucao = executarImportacao(["importar", "dart", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "dart");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.tarefas, 1);

    const arquivo = await readFile(path.join(base, "sema", "lib", "payments.sema"), "utf8");
    assert.match(arquivo, /task processar_pagamento/);
    assert.match(arquivo, /dart: lib\.payments_service\.processarPagamento/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto ASP.NET Core legado e gera route + task com impl cs", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-dotnet-"));

  try {
    await criarProjetoDotnetAspNet(base);

    const execucao = executarImportacao(["importar", "dotnet", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "dotnet");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas >= 2, true);
    assert.equal(json.resumo.tarefas >= 2, true);

    const arquivo = await readFile(path.join(base, "sema", "controllers", "health_controller.sema"), "utf8");
    assert.match(arquivo, /route get_publico/);
    assert.match(arquivo, /caminho: "\/api\/health\/\{id\}"/);
    assert.match(arquivo, /cs: src\.controllers\.health_controller\.HealthController\.Get/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Spring Boot legado e gera route + task com impl java", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-java-"));

  try {
    await criarProjetoSpringBoot(base);

    const execucao = executarImportacao(["importar", "java", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "java");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas >= 2, true);

    const arquivo = await readFile(path.join(base, "sema", "main", "java", "com", "acme", "health", "health_controller.sema"), "utf8");
    assert.match(arquivo, /route show_publico/);
    assert.match(arquivo, /java: src\.main\.java\.com\.acme\.health\.health_controller\.HealthController\.show/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Go legado e gera route + task com impl go", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-go-"));

  try {
    await criarProjetoGoHttp(base);

    const execucao = executarImportacao(["importar", "go", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "go");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas >= 2, true);

    const arquivo = await readFile(path.join(base, "sema", "internal", "routes.sema"), "utf8");
    assert.match(arquivo, /route get_health_publico/);
    assert.match(arquivo, /go: internal\.routes\.getHealth/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Rust Axum legado e gera route + task com impl rust", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-rust-"));

  try {
    await criarProjetoRustAxum(base);

    const execucao = executarImportacao(["importar", "rust", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "rust");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas >= 2, true);

    const arquivo = await readFile(path.join(base, "sema", "handlers.sema"), "utf8");
    assert.match(arquivo, /route health_publico/);
    assert.match(arquivo, /rust: src\.handlers\.health/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto C++ bridge legado e gera task com impl cpp", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-cpp-"));

  try {
    await criarProjetoCppBridge(base);

    const execucao = executarImportacao(["importar", "cpp", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "cpp");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.tarefas >= 2, true);
    assert.equal(json.resumo.rotas, 0);

    const arquivo = await readFile(path.join(base, "sema", "runtime.sema"), "utf8");
    assert.match(arquivo, /task process_snapshot/);
    assert.match(arquivo, /cpp: src\.runtime\.RuntimeBridge\.processSnapshot/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

if (existsSync("C:\\GitHub\\Teste2\\backend")) {
  test("smoke real: importa backend NestJS do Teste2 com sucesso", async () => {
    const baseSaida = await mkdtemp(path.join(os.tmpdir(), "sema-import-real-nest-"));

    try {
      const execucao = executarImportacao(["importar", "nestjs", "C:\\GitHub\\Teste2\\backend", "--saida", baseSaida, "--json"], path.resolve("."));
      assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

      const json = JSON.parse(execucao.stdout);
      assert.equal(json.resumo.sucesso, true);
      assert.equal(json.resumo.modulos >= 1, true);
      assert.equal(json.resumo.rotas >= 1, true);
      assert.equal(json.resumo.tarefas >= 1, true);
    } finally {
      await rm(baseSaida, { recursive: true, force: true });
    }
  });
}

for (const projetoPython of ["C:\\GitHub\\BotSauro", "C:\\GitHub\\FuteBot"]) {
  if (existsSync(projetoPython)) {
    test(`smoke real: importa projeto Python legado ${path.basename(projetoPython)} com sucesso`, async () => {
      const baseSaida = await mkdtemp(path.join(os.tmpdir(), "sema-import-real-python-"));

      try {
        const execucao = executarImportacao(["importar", "python", projetoPython, "--saida", baseSaida, "--json"], path.resolve("."));
        assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

        const json = JSON.parse(execucao.stdout);
        assert.equal(json.resumo.sucesso, true);
        assert.equal(json.resumo.modulos >= 1, true);
        assert.equal(json.resumo.tarefas >= 1, true);
      } finally {
        await rm(baseSaida, { recursive: true, force: true });
      }
    });
  }
}
