// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: testes particionados; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { extrairPayloadResultadoCliV1 } from "../helpers/resultado-cli-v1.ts";
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
const CLI = path.resolve("pacotes/cli/dist/bin.js");
const SEMA_SMOKE_REAL = process.env.SEMA_SMOKE_REAL === "1";
function executarImportacao(args: string[], cwd?: string) {
  const resultado = spawnSync(process.execPath, [CLI, ...args], {
    stdio: "pipe",
    encoding: "utf8",
    cwd,
  });
  return Object.assign(resultado, {
    comandoResultadoCli: args[0] ?? "",
    exitCodeResultadoCli: resultado.status,
  });
}
function extrairPayloadExecucaoCli<T = any>(execucao: {
  stdout: string;
  comandoResultadoCli: string;
  exitCodeResultadoCli: number | null;
}): T {
  return extrairPayloadResultadoCliV1<T>(execucao.stdout, {
    command: execucao.comandoResultadoCli,
    exitCode: execucao.exitCodeResultadoCli,
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

      const json = extrairPayloadExecucaoCli(execucao);
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
      const jsonRaiz = extrairPayloadExecucaoCli(execucaoRaiz);
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
      const jsonApi = extrairPayloadExecucaoCli(execucaoApi);
      assert.equal(jsonApi.resumo.sucesso, true);
      assert.equal(jsonApi.resumo.modulos >= 1, true);
      assert.equal(jsonApi.resumo.rotas >= 1, true);

      const execucaoSubpasta = executarImportacao(["importar", "nextjs", diretorioSubpasta, "--saida", baseSubpasta, "--json"], path.resolve("."));
      assert.equal(execucaoSubpasta.status, 0, execucaoSubpasta.stderr || execucaoSubpasta.stdout);
      const jsonSubpasta = extrairPayloadExecucaoCli(execucaoSubpasta);
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
      const jsonValidacao = extrairPayloadExecucaoCli(validacaoSubpasta);
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

        const json = extrairPayloadExecucaoCli(execucao);
        assert.equal(json.resumo.sucesso, true);
        assert.equal(json.resumo.modulos >= 1, true);
        assert.equal(json.resumo.tarefas >= 1, true);
      } finally {
        await rm(baseSaida, { recursive: true, force: true });
      }
    });
}

test("cli importa projeto Next.js consumer a partir do bridge e inventaria superficies App Router", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-nextjs-consumer-"));

  try {
    await criarProjetoNextJsConsumer(base);

    const execucao = executarImportacao([
      "importar",
      "nextjs-consumer",
      base,
      "--namespace",
      "showroom",
      "--saida",
      path.join(base, "sema"),
      "--json",
    ]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = extrairPayloadExecucaoCli(execucao);
    assert.equal(json.fonte, "nextjs-consumer");
    assert.equal(json.resumo.sucesso, true);
    assert.equal(json.resumo.modulos, 1);
    assert.equal(json.resumo.tarefas >= 2, true);

    const arquivoConsumer = await readFile(path.join(base, "sema", "consumer.sema"), "utf8");
    assert.match(arquivoConsumer, /ts: src\.lib\.sema_consumer_bridge\.semaFetchShowroomRanking/);
    assert.match(arquivoConsumer, /ts: src\.lib\.sema_consumer_bridge\.semaLoadRankingSummary/);
    assert.match(arquivoConsumer, /vinculos \{/);
    assert.match(arquivoConsumer, /superficie: "?\/ranking"?/);
    assert.match(arquivoConsumer, /arquivo: "src\/app\/ranking\/page\.tsx"/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto React Vite consumer a partir do bridge e inventaria page surfaces", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-react-vite-consumer-"));

  try {
    await criarProjetoReactViteConsumer(base);

    const execucao = executarImportacao([
      "importar",
      "react-vite-consumer",
      base,
      "--namespace",
      "showroom",
      "--saida",
      path.join(base, "sema"),
      "--json",
    ]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = extrairPayloadExecucaoCli(execucao);
    assert.equal(json.fonte, "react-vite-consumer");
    assert.equal(json.resumo.sucesso, true);

    const arquivoConsumer = await readFile(path.join(base, "sema", "consumer.sema"), "utf8");
    assert.match(arquivoConsumer, /ts: src\.lib\.sema_consumer_bridge\.semaFetchShowroomRanking/);
    assert.match(arquivoConsumer, /superficie: "?\/ranking"?/);
    assert.match(arquivoConsumer, /arquivo: "src\/pages\/ranking\.tsx"/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Angular consumer a partir do bridge e inventaria route config + component", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-angular-consumer-"));

  try {
    await criarProjetoAngularConsumer(base);

    const execucao = executarImportacao([
      "importar",
      "angular-consumer",
      base,
      "--namespace",
      "showroom",
      "--saida",
      path.join(base, "sema"),
      "--json",
    ]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = extrairPayloadExecucaoCli(execucao);
    assert.equal(json.fonte, "angular-consumer");
    assert.equal(json.resumo.sucesso, true);

    const arquivoConsumer = await readFile(path.join(base, "sema", "consumer.sema"), "utf8");
    assert.match(arquivoConsumer, /ts: src\.app\.sema_consumer_bridge\.semaFetchShowroomRanking/);
    assert.match(arquivoConsumer, /superficie: "?\/ranking"?/);
    assert.match(arquivoConsumer, /arquivo: "src\/app\/app\.routes\.ts"/);
    assert.match(arquivoConsumer, /arquivo: "src\/app\/features\/ranking\/ranking-page\.component\.ts"/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Angular standalone consumer sem routes e inventaria shell slash", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-angular-standalone-consumer-"));

  try {
    await criarProjetoAngularStandaloneConsumer(base);

    const execucao = executarImportacao([
      "importar",
      "angular-consumer",
      base,
      "--namespace",
      "showroom",
      "--saida",
      path.join(base, "sema"),
      "--json",
    ]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = extrairPayloadExecucaoCli(execucao);
    assert.equal(json.fonte, "angular-consumer");
    assert.equal(json.resumo.sucesso, true);

    const arquivoConsumer = await readFile(path.join(base, "sema", "consumer.sema"), "utf8");
    assert.match(arquivoConsumer, /superficie: "?\/"?/);
    assert.match(arquivoConsumer, /arquivo: "src\/app\.component\.ts"/);
    assert.match(arquivoConsumer, /arquivo: "src\/components\/ranking-shell\.component\.ts"/);
    assert.match(arquivoConsumer, /ts: src\.app\.sema_consumer_bridge\.semaFetchShowroomRanking/);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cli importa projeto Flutter consumer a partir do bridge e inventaria router + screen", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-import-flutter-consumer-"));

  try {
    await criarProjetoFlutterConsumer(base);

    const execucao = executarImportacao([
      "importar",
      "flutter-consumer",
      base,
      "--namespace",
      "showroom",
      "--saida",
      path.join(base, "sema"),
      "--json",
    ]);
    assert.equal(execucao.status, 0, execucao.stderr || execucao.stdout);

    const json = extrairPayloadExecucaoCli(execucao);
    assert.equal(json.fonte, "flutter-consumer");
    assert.equal(json.resumo.sucesso, true);

    const arquivoConsumer = await readFile(path.join(base, "sema", "consumer.sema"), "utf8");
    assert.match(arquivoConsumer, /dart: lib\.sema_consumer_bridge\.semaFetchShowroomRanking/);
    assert.match(arquivoConsumer, /dart: lib\.sema_consumer_bridge\.semaLoadRankingSummary/);
    assert.match(arquivoConsumer, /superficie: "?\/ranking"?/);
    assert.match(arquivoConsumer, /arquivo: "lib\/router\.dart"/);
    assert.match(arquivoConsumer, /arquivo: "lib\/screens\/ranking_screen\.dart"/);
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

    const json = extrairPayloadExecucaoCli(execucao);
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

    const json = extrairPayloadExecucaoCli(execucao);
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

    const json = extrairPayloadExecucaoCli(execucao);
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

    const json = extrairPayloadExecucaoCli(execucao);
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

    const json = extrairPayloadExecucaoCli(execucao);
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
