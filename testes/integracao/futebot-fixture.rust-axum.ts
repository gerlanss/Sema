// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoRustAxum(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["rust"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "src/main.rs",
    `use axum::{routing::{get, post}, Router};

mod handlers;

fn app() -> Router {
    Router::new()
        .route("/health/{id}", get(handlers::health))
        .route("/health/refresh", post(handlers::refresh))
}
`,
  );

  await escrever(
    base,
    "src/handlers.rs",
    `pub async fn health() -> &'static str {
    "ok"
}

pub async fn refresh() -> &'static str {
    "refreshed"
}
`,
  );

  await escrever(
    base,
    "contratos/http.sema",
    `module legado.rust.http {
  task health {
    input {
      id: Texto required
    }
    output {
      resultado: Json
    }
    impl {
      rust: src.handlers.health
    }
    guarantees {
      resultado existe
    }
  }

  task refresh {
    output {
      resultado: Json
    }
    impl {
      rust: src.handlers.refresh
    }
    guarantees {
      resultado existe
    }
  }

  route health_publico {
    metodo: GET
    caminho: "/health/{id}"
    task: health
  }

  route refresh_publico {
    metodo: POST
    caminho: /health/refresh
    task: refresh
  }
}
`,
  );
}
