// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoFirebaseWorker(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "config"), { recursive: true }),
    mkdir(path.join(base, "src", "services"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "package.json",
    JSON.stringify({
      name: "fixture-firebase-worker-sema",
      private: true,
      dependencies: {
        "firebase-admin": "^13.0.0",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "firebase.json",
    JSON.stringify({
      functions: { source: "src" },
    }, null, 2),
  );

  await escrever(
    base,
    "src/config/collections.ts",
    `export const COLLECTIONS = {
  telegram_sessions: "telegram_sessions",
  worker_status: "worker_status",
} as const;
`,
  );

  await escrever(
    base,
    "src/services/health-check.ts",
    `import http from "node:http";

export type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy" | "initializing";
  timestamp: string;
};

export type HealthProvider = () => HealthStatus;

export function startHealthCheckServer(port: number, provider: HealthProvider) {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(provider()));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port);
  return server;
}
`,
  );

  await escrever(
    base,
    "src/sema_contract_bridge.ts",
    `import { COLLECTIONS } from "./config/collections";
import { startHealthCheckServer, type HealthProvider, type HealthStatus } from "./services/health-check";

export function semaStartWorkerHealthServer(port: number, provider: HealthProvider) {
  return startHealthCheckServer(port, provider);
}

export function semaWorkerHealthPayload(payload: HealthStatus): HealthStatus {
  return payload;
}

export function semaTelegramSessionRecord(payload: { sessionId: string }) {
  return payload;
}

export function semaCollectionNames() {
  return COLLECTIONS;
}
`,
  );

  await escrever(
    base,
    "contratos/monitoring_pipeline.sema",
    `module legado.firebase.monitoring {
  task inventariar_colecoes_monitoramento {
    output {
      collections: Json
    }
    effects {
      consulta runtime criticidade = baixa
    }
    impl {
      ts: src.sema_contract_bridge.semaCollectionNames
    }
    guarantees {
      collections existe
    }
  }

  task registrar_sessao_telegram {
    input {
      registro: Json required
    }
    output {
      registro: Json
    }
    effects {
      persiste telegram_sessions criticidade = alta
      evento telegram_auth criticidade = alta
    }
    impl {
      ts: src.sema_contract_bridge.semaTelegramSessionRecord
    }
    guarantees {
      registro existe
    }
  }
}
`,
  );

  await escrever(
    base,
    "contratos/worker_runtime.sema",
    `module legado.firebase.worker_runtime {
  task publicar_payload_health {
    output {
      status: Texto
      timestamp: Texto
    }
    effects {
      evento payload_health criticidade = alta
    }
    impl {
      ts: src.sema_contract_bridge.semaWorkerHealthPayload
    }
    guarantees {
      status existe
      timestamp existe
    }
  }

  route get_health_worker {
    metodo: GET
    caminho: /health
    task: publicar_payload_health
  }
}
`,
  );
}
