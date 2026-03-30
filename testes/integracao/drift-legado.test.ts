import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const CLI = path.resolve("pacotes/cli/dist/index.js");

function executar(args: string[], cwd?: string) {
  return spawnSync("node", [CLI, ...args], {
    stdio: "pipe",
    encoding: "utf8",
    cwd,
  });
}

test("cli drift detecta impl valido, impl quebrado, task sem impl e rota divergente", async () => {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-"));

  try {
    await mkdir(path.join(base, "src", "pedidos"), { recursive: true });
    await mkdir(path.join(base, "sema"), { recursive: true });

    await writeFile(
      path.join(base, "sema.config.json"),
      JSON.stringify({
        origens: ["./sema"],
        diretoriosCodigo: ["./src"],
        fontesLegado: ["nestjs"],
        modoAdocao: "incremental",
      }, null, 2),
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "pedidos", "pedidos.controller.ts"),
      `import { Body, Controller, Post } from "@nestjs/common";
import { PedidosService } from "./pedidos.service";

@Controller("pedidos")
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Post()
  async criar(@Body() body: { total: number; comprador_id: string }) {
    return this.pedidosService.criar(body);
  }
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "src", "pedidos", "pedidos.service.ts"),
      `export class PedidosService {
  async criar(entrada: { total: number; comprador_id: string }) {
    return { pedido_id: "ped_1" };
  }
}
`,
      "utf8",
    );

    await writeFile(
      path.join(base, "sema", "pedidos.sema"),
      `module app.pedidos {
  task criar_pedido {
    input {
      total: Decimal required
      comprador_id: Id required
    }
    output {
      pedido_id: Id
    }
    impl {
      ts: src.pedidos.pedidos_service.criar
    }
    guarantees {
      pedido_id existe
    }
    tests {
      caso "ok" {
        given {
          total: 10
          comprador_id: "cmp_1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task cancelar_pedido {
    input {
      pedido_id: Id required
    }
    output {
      cancelado: Booleano
    }
    impl {
      ts: src.pedidos.pedidos_service.cancelar
    }
    tests {
      caso "ok" {
        given {
          pedido_id: "ped_1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task revisar_manual {
    input {
      pedido_id: Id required
    }
    output {
      fila: Texto
    }
    tests {
      caso "ok" {
        given {
          pedido_id: "ped_1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route criar_pedido_publico {
    metodo: POST
    caminho: /pedidos
    task: criar_pedido
  }

  route cancelar_pedido_publico {
    metodo: DELETE
    caminho: /pedidos
    task: cancelar_pedido
  }
}
`,
      "utf8",
    );

    const execucao = executar(["drift", "--json"], base);
    assert.equal(execucao.status, 1, execucao.stderr || execucao.stdout);

    const json = JSON.parse(execucao.stdout);
    assert.equal(json.comando, "drift");
    assert.equal(json.modulos.length, 1);
    assert.equal(json.impls_validos.length, 1);
    assert.equal(json.impls_quebrados.length, 1);
    assert.equal(json.rotas_divergentes.length, 1);
    assert.equal(json.tasks.some((task: { task: string; semImplementacao: boolean }) => task.task === "revisar_manual" && task.semImplementacao), true);
    assert.equal(json.diagnosticos.some((diag: { tipo: string }) => diag.tipo === "task_sem_impl"), true);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
