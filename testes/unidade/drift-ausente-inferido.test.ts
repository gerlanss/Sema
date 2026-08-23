// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: cobre planejamento fisico honesto — candidato derivado de simbolo de impl ausente
// e informacao de ancoragem, nunca vinculo_quebrado bloqueante.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { planejarEscopoDrift } from "../../pacotes/cli/src/driftEscopo.js";
import { carregarProjeto } from "../../pacotes/cli/src/projetoCarregar.js";

const CONTRATO = `module app.pedidos {
  entity Pedido {
    fields {
      id: Id
    }
  }
  task criar_pedido {
    input {
      dados: Texto required
    }
    output {
      pedido: Pedido
    }
    guarantees {
      pedido existe
    }
    impl {
      py: pedidos.criar_pedido
    }
    vinculos {
      arquivo: "app/mod/pedidos.py"
      simbolo: pedidos.criar_pedido
    }
  }
}
`;

async function criarWorkspace(): Promise<string> {
  const base = await mkdtemp(path.join(os.tmpdir(), "sema-drift-ausente-inferido-"));
  await mkdir(path.join(base, "contratos"), { recursive: true });
  await mkdir(path.join(base, "app", "mod"), { recursive: true });
  await writeFile(path.join(base, "contratos", "pedidos.sema"), CONTRATO, "utf8");
  await writeFile(
    path.join(base, "app", "mod", "pedidos.py"),
    "def criar_pedido(dados):\n    return {'id': 1}\n",
    "utf8",
  );
  await writeFile(path.join(base, "sema.config.json"), JSON.stringify({
    origens: ["./contratos"],
    diretoriosCodigo: ["./app"],
  }), "utf8");
  return base;
}

test("candidato de arquivo derivado de simbolo de impl ausente vira informativo, nao bloqueio", async (t) => {
  const base = await criarWorkspace();
  t.after(async () => {
    await rm(base, { recursive: true, force: true });
  });

  const contexto = await carregarProjeto(path.join(base, "contratos", "pedidos.sema"), base);
  const plano = await planejarEscopoDrift(contexto, {
    escopo: "modulo",
    ignorarWorktrees: true,
    ignorarConsumidoresLaterais: true,
    termosEscopo: ["pedidos"],
  });

  // O arquivo declarado existe e ancora o escopo.
  assert.ok(
    plano.arquivosDeclarados.some((arquivo) => arquivo.replaceAll("\\", "/").endsWith("app/mod/pedidos.py")),
    "o vinculo declarado deve ancorar o escopo",
  );
  // O candidato derivado do simbolo (pedidos.py na raiz) nao existe em lugar nenhum:
  // deve aparecer como ausente INFERIDO e nao como ausente bloqueante.
  assert.deepEqual(plano.arquivosAusentes, [], "ausente inventado nao pode bloquear cobertura");
  assert.ok(
    plano.arquivosAusentesInferidos.some((arquivo) => arquivo.replaceAll("\\", "/").endsWith("pedidos.py")),
    "o candidato derivado deve ficar visivel como informativo",
  );
  assert.equal(plano.cobertura, "completa");
  assert.deepEqual(plano.bloqueios, []);
});

test("vinculo declarado ausente continua bloqueante", async (t) => {
  const base = await criarWorkspace();
  t.after(async () => {
    await rm(base, { recursive: true, force: true });
  });

  const contratoComVinculoAusente = CONTRATO.replace(
    'arquivo: "app/mod/pedidos.py"',
    'arquivo: "app/mod/inexistente.py"',
  );
  await writeFile(path.join(base, "contratos", "pedidos.sema"), contratoComVinculoAusente, "utf8");

  const contexto = await carregarProjeto(path.join(base, "contratos", "pedidos.sema"), base);
  const plano = await planejarEscopoDrift(contexto, {
    escopo: "modulo",
    ignorarWorktrees: true,
    ignorarConsumidoresLaterais: true,
    termosEscopo: ["pedidos"],
  });

  // Promessa explicita do contrato quebrada continua sendo erro honesto.
  assert.ok(
    plano.arquivosAusentes.some((arquivo) => arquivo.replaceAll("\\", "/").endsWith("inexistente.py")),
    "vinculo declarado ausente deve permanecer bloqueante",
  );
  assert.equal(plano.cobertura, "parcial");
});
