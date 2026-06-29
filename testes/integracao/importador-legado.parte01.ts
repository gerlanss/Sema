// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import {
  criarProjetoAngularConsumer,
  criarProjetoAngularStandaloneConsumer,
  criarProjetoCppBridge,
  criarProjetoDotnetAspNet,
  criarProjetoFirebaseWorker,
  criarProjetoFlaskEstiloGestech,
  criarProjetoFlutterConsumer,
  criarProjetoGoHttp,
  criarProjetoNextJsAppRouter,
  criarProjetoNextJsConsumer,
  criarProjetoNextJsAppRouterSemantico,
  criarProjetoReactViteConsumer,
  criarProjetoRustAxum,
  criarProjetoSpringBoot,
} from "./futebot-fixture.ts";
const CLI = path.resolve("pacotes/cli/dist/index.js");
const SEMA_SMOKE_REAL = process.env.SEMA_SMOKE_REAL === "1";
function executarImportacao(args: string[], cwd?: string) {
  return spawnSync("node", [CLI, ...args], {
    stdio: "pipe",
    encoding: "utf8",
    cwd,
  });
}
function registrarSmokeReal(condicao: boolean, nome: string, corpo: () => Promise<void> | void) {
  if (!condicao) {
    return;
  }

  if (!SEMA_SMOKE_REAL) {
    test(nome, { skip: "Defina SEMA_SMOKE_REAL=1 para rodar smoke real externo e instavel." }, () => {});
    return;
  }

  test(nome, corpo);
}
registrarSmokeReal(existsSync("C:\\GitHub\\Teste2\\backend"), "smoke real: importa backend NestJS do Teste2 com sucesso", async () => {
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
registrarSmokeReal(existsSync("C:\\GitHub\\Gestech\\Lothar.io\\apps\\dashboard"), "smoke real: importa Next.js do Gestech pela raiz, pelo api root e por subpasta concreta", async () => {
    const baseRaiz = await mkdtemp(path.join(os.tmpdir(), "sema-import-real-next-root-"));
    const baseApi = await mkdtemp(path.join(os.tmpdir(), "sema-import-real-next-api-"));
    const baseSubpasta = await mkdtemp(path.join(os.tmpdir(), "sema-import-real-next-sub-"));

    try {
      const diretorioRaiz = "C:\\GitHub\\Gestech\\Lothar.io\\apps\\dashboard";
      const diretorioApi = path.join(diretorioRaiz, "src", "app", "api");
      const diretorioSubpasta = path.join(diretorioApi, "auth", "login");

      const execucaoRaiz = executarImportacao(["importar", "nextjs", diretorioRaiz, "--saida", baseRaiz, "--json"], path.resolve("."));
      assert.equal(execucaoRaiz.status, 0, execucaoRaiz.stderr || execucaoRaiz.stdout);
      const jsonRaiz = JSON.parse(execucaoRaiz.stdout);
      assert.equal(jsonRaiz.resumo.sucesso, true);
      assert.equal(jsonRaiz.resumo.modulos >= 1, true);
      assert.equal(jsonRaiz.resumo.rotas >= 1, true);
      const arquivoQuery = path.join(baseRaiz, "api", "local_firestore", "query.sema");
      if (existsSync(arquivoQuery)) {
        const conteudoQuery = await readFile(arquivoQuery, "utf8");
        assert.match(conteudoQuery, /collection: Texto/);
      }

      const execucaoApi = executarImportacao(["importar", "nextjs", diretorioApi, "--saida", baseApi, "--json"], path.resolve("."));
      assert.equal(execucaoApi.status, 0, execucaoApi.stderr || execucaoApi.stdout);
      const jsonApi = JSON.parse(execucaoApi.stdout);
      assert.equal(jsonApi.resumo.sucesso, true);
      assert.equal(jsonApi.resumo.modulos >= 1, true);
      assert.equal(jsonApi.resumo.rotas >= 1, true);

      const execucaoSubpasta = executarImportacao(["importar", "nextjs", diretorioSubpasta, "--saida", baseSubpasta, "--json"], path.resolve("."));
      assert.equal(execucaoSubpasta.status, 0, execucaoSubpasta.stderr || execucaoSubpasta.stdout);
      const jsonSubpasta = JSON.parse(execucaoSubpasta.stdout);
      assert.equal(jsonSubpasta.resumo.sucesso, true);
      assert.equal(jsonSubpasta.resumo.modulos, 1);
      assert.equal(jsonSubpasta.resumo.rotas >= 1, true);

      const arquivoLogin = path.join(baseSubpasta, "api", "auth", "login.sema");
      assert.equal(existsSync(arquivoLogin), true);
      const conteudoLogin = await readFile(arquivoLogin, "utf8");
      assert.match(conteudoLogin, /email: Texto/);
      assert.match(conteudoLogin, /password: Texto/);

      const validacaoSubpasta = executarImportacao(["validar", baseSubpasta, "--json"], path.resolve("."));
      assert.equal(validacaoSubpasta.status, 0, validacaoSubpasta.stderr || validacaoSubpasta.stdout);
      const jsonValidacao = JSON.parse(validacaoSubpasta.stdout);
      assert.equal(jsonValidacao.sucesso, true);
    } finally {
      await rm(baseRaiz, { recursive: true, force: true });
      await rm(baseApi, { recursive: true, force: true });
      await rm(baseSubpasta, { recursive: true, force: true });
    }
});
for (const projetoPython of ["C:\\GitHub\\BotSauro", "C:\\GitHub\\FuteBot"]) {
  registrarSmokeReal(existsSync(projetoPython), `smoke real: importa projeto Python legado ${path.basename(projetoPython)} com sucesso`, async () => {
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

test("cli importa projeto Next.js App Router legado com bootstrap semantico mais forte", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-nextjs-"));

  try {
    await criarProjetoNextJsAppRouterSemantico(base);

    const execucao = executarImportacao(["importar", "nextjs", base, "--saida", path.join(base, "sema"), "--json"]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.fonte, "nextjs");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.rotas >= 6, true);
    assert.equal(json.resumo.tarefas >= 6, true);

    const arquivoSessao = await readFile(path.join(base, "sema", "api", "auth", "session.sema"), "utf8");
    assert.match(arquivoSessao, /route api_auth_session_get_publico/);
    assert.match(arquivoSessao, /expand: Texto/);
    assert.match(arquivoSessao, /refresh_id: Id/);
    assert.match(arquivoSessao, /email: Texto required/);
    assert.match(arquivoSessao, /password: Texto required/);
    assert.match(arquivoSessao, /remember: Booleano/);
    assert.match(arquivoSessao, /session_id: Id/);
    assert.match(arquivoSessao, /user_id: Id/);
    assert.match(arquivoSessao, /nao_autorizado/);
    assert.match(arquivoSessao, /entrada_invalida/);
    assert.match(arquivoSessao, /acesso_negado/);
    assert.match(arquivoSessao, /ts: src\.app\.api\.auth\.session\.route\.POST/);

    const arquivoBusca = await readFile(path.join(base, "sema", "api", "catalogo", "busca.sema"), "utf8");
    assert.match(arquivoBusca, /termo: Texto/);
    assert.match(arquivoBusca, /limite: Decimal/);
    assert.match(arquivoBusca, /total: Decimal/);

    const arquivoLogin = await readFile(path.join(base, "sema", "api", "auth", "login.sema"), "utf8");
    assert.match(arquivoLogin, /email: Texto/);
    assert.match(arquivoLogin, /password: Texto/);
    assert.match(arquivoLogin, /remember_me: Booleano/);
    assert.match(arquivoLogin, /ok: Booleano required/);
    assert.match(arquivoLogin, /user: Json required/);
    assert.match(arquivoLogin, /nao_autorizado/);
    assert.match(arquivoLogin, /erro_interno/);

    const arquivoQuery = await readFile(path.join(base, "sema", "api", "local_firestore", "query.sema"), "utf8");
    assert.match(arquivoQuery, /collection: Texto/);
    assert.match(arquivoQuery, /filters: Json/);
    assert.match(arquivoQuery, /order_by: Json/);
    assert.match(arquivoQuery, /limit: Decimal/);
    assert.match(arquivoQuery, /docs_campo: Json required/);

    const arquivoDinamico = await readFile(path.join(base, "sema", "api", "reposicao", "itemid.sema"), "utf8");
    assert.match(arquivoDinamico, /caminho: "\/api\/reposicao\/\{itemId\}"/);
    assert.match(arquivoDinamico, /item_id: Id required/);

    const arquivoFallback = await readFile(path.join(base, "sema", "api", "fallback.sema"), "utf8");
    assert.match(arquivoFallback, /resultado: Json/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Next.js App Router a partir de app, api e subpasta concreta", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-nextjs-scope-"));

  try {
    await criarProjetoNextJsAppRouterSemantico(base);

    const saidaApp = path.join(base, "sema-app");
    const execucaoApp = executarImportacao(["importar", "nextjs", path.join(base, "src", "app"), "--saida", saidaApp, "--json"]);
    assert.equal(execucaoApp.status, 0, execucaoApp.stderr || execucaoApp.stdout);
    const jsonApp = JSON.parse(execucaoApp.stdout);
    assert.equal(jsonApp.resumo.sucesso, true);
    assert.equal(jsonApp.resumo.modulos >= 6, true);

    const saidaApi = path.join(base, "sema-api");
    const execucaoApi = executarImportacao(["importar", "nextjs", path.join(base, "src", "app", "api"), "--saida", saidaApi, "--json"]);
    assert.equal(execucaoApi.status, 0, execucaoApi.stderr || execucaoApi.stdout);
    const jsonApi = JSON.parse(execucaoApi.stdout);
    assert.equal(jsonApi.resumo.sucesso, true);
    assert.equal(jsonApi.resumo.modulos >= 6, true);

    const saidaSubpasta = path.join(base, "sema-subpasta");
    const execucaoSubpasta = executarImportacao([
      "importar",
      "nextjs",
      path.join(base, "src", "app", "api", "auth", "session"),
      "--saida",
      saidaSubpasta,
      "--json",
    ]);
    assert.equal(execucaoSubpasta.status, 0, execucaoSubpasta.stderr || execucaoSubpasta.stdout);
    const jsonSubpasta = JSON.parse(execucaoSubpasta.stdout);
    assert.equal(jsonSubpasta.resumo.sucesso, true);
    assert.equal(jsonSubpasta.resumo.modulos, 1);
    assert.equal(jsonSubpasta.resumo.rotas, 2);
    assert.equal(jsonSubpasta.resumo.tarefas, 2);

    const arquivoSessao = await readFile(path.join(saidaSubpasta, "api", "auth", "session.sema"), "utf8");
    assert.match(arquivoSessao, /route api_auth_session_get_publico/);
    assert.doesNotMatch(arquivoSessao, /route api_catalogo_busca_get_publico/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
