// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoGoHttp(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "internal"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./internal"],
      fontesLegado: ["go"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "internal/routes.go",
    `package internal

import "github.com/gin-gonic/gin"

func register(router *gin.Engine) {
    router.GET("/health/:id", getHealth)
    router.POST("/health/refresh", refreshHealth)
}

func getHealth(ctx *gin.Context) {
    ctx.JSON(200, gin.H{"status": "ok"})
}

func refreshHealth(ctx *gin.Context) {
    ctx.JSON(200, gin.H{"status": "refreshed"})
}
`,
  );

  await escrever(
    base,
    "contratos/http.sema",
    `module legado.go.http {
  task get_health {
    input {
      id: Texto required
    }
    output {
      resultado: Json
    }
    impl {
      go: internal.routes.getHealth
    }
    guarantees {
      resultado existe
    }
  }

  task refresh_health {
    output {
      resultado: Json
    }
    impl {
      go: internal.routes.refreshHealth
    }
    guarantees {
      resultado existe
    }
  }

  route get_health_publico {
    metodo: GET
    caminho: "/health/{id}"
    task: get_health
  }

  route refresh_health_publico {
    metodo: POST
    caminho: /health/refresh
    task: refresh_health
  }
}
`,
  );
}
