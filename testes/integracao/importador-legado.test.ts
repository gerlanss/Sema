import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

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
