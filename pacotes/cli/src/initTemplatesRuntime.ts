// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: templates de inicializa??o para workers, APIs runtime e bridges de servi?o.


import type { ArquivosTemplateIniciar, TemplateIniciar } from "./initTemplatesBase.js";

export function arquivosInitTemplatesRuntime(template: TemplateIniciar, arquivosBase: ArquivosTemplateIniciar): ArquivosTemplateIniciar | null {
  let arquivos = arquivosBase;
if (template === "node-firebase-worker") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated",
    "alvos": ["typescript"],
    "alvoPadrao": "typescript",
    "estruturaSaida": "modulos",
    "framework": "base",
    "modoEstrito": true,
    "diretoriosCodigo": ["./src"],
    "fontesLegado": ["firebase", "typescript"],
    "diretoriosSaidaPorAlvo": {
      "typescript": "./generated/typescript"
    },
    "convencoesGeracaoPorProjeto": "base"
  }
  `,
        },
        {
          caminhoRelativo: "contratos/worker_runtime.sema",
          conteudo: `module worker.runtime {
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

    task inventariar_colecoes {
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

    route get_health_worker {
      metodo: GET
      caminho: /health
      task: publicar_payload_health
    }
  }
  `,
        },
        {
          caminhoRelativo: "src/config/collections.ts",
          conteudo: `export const COLLECTIONS = {
    worker_status: "worker_status",
    audit_log: "audit_log",
  } as const;
  `,
        },
        {
          caminhoRelativo: "src/services/health-check.ts",
          conteudo: `import http from "node:http";

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
        },
        {
          caminhoRelativo: "src/sema_contract_bridge.ts",
          conteudo: `import { COLLECTIONS } from "./config/collections";
  import { startHealthCheckServer, type HealthProvider, type HealthStatus } from "./services/health-check";

  export function semaStartWorkerHealthServer(port: number, provider: HealthProvider) {
    return startHealthCheckServer(port, provider);
  }

  export function semaWorkerHealthPayload(payload: HealthStatus): HealthStatus {
    return payload;
  }

  export function semaCollectionNames() {
    return COLLECTIONS;
  }
  `,
        },
        {
          caminhoRelativo: "README.md",
          conteudo: `# Starter Node Firebase Worker + Sema

  - Contratos em \`contratos/\`
  - Worker e bridges em \`src/\`
  - \`drift\` valida impl, endpoint de health e recursos Firestore declarados
  `,
        },
      ];
    } else if (template === "aspnet-api") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated",
    "alvos": ["typescript"],
    "alvoPadrao": "typescript",
    "estruturaSaida": "modulos",
    "framework": "base",
    "modoEstrito": true,
    "diretoriosCodigo": ["./src"],
    "fontesLegado": ["dotnet"],
    "diretoriosSaidaPorAlvo": {
      "typescript": "./generated/typescript"
    },
    "convencoesGeracaoPorProjeto": "base"
  }
  `,
        },
        {
          caminhoRelativo: "contratos/health.sema",
          conteudo: `module app.health {
    task get_health {
      output {
        status: Texto
        runtime: Texto
      }
      impl {
        cs: src.Controllers.HealthController.Get
      }
      guarantees {
        status existe
        runtime existe
      }
    }

    route get_health_publico {
      metodo: GET
      caminho: /api/health
      task: get_health
    }
  }
  `,
        },
        {
          caminhoRelativo: "src/Controllers/HealthController.cs",
          conteudo: `using Microsoft.AspNetCore.Mvc;

  [ApiController]
  [Route("api/health")]
  public class HealthController : ControllerBase
  {
      [HttpGet]
      public object Get()
      {
          return new { status = "ok", runtime = "aspnet" };
      }
  }
  `,
        },
        {
          caminhoRelativo: "README.md",
          conteudo: `# Starter ASP.NET Core API + Sema

  - Contratos em \`contratos/\`
  - Controllers/Minimal API em \`src/\`
  - \`drift\` valida impl e rota publica
  `,
        },
      ];
    } else if (template === "springboot-api") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated",
    "alvos": ["typescript"],
    "alvoPadrao": "typescript",
    "estruturaSaida": "modulos",
    "framework": "base",
    "modoEstrito": true,
    "diretoriosCodigo": ["./src"],
    "fontesLegado": ["java"],
    "diretoriosSaidaPorAlvo": {
      "typescript": "./generated/typescript"
    },
    "convencoesGeracaoPorProjeto": "base"
  }
  `,
        },
        {
          caminhoRelativo: "contratos/health.sema",
          conteudo: `module app.health {
    task get_health {
      output {
        status: Texto
        runtime: Texto
      }
      impl {
        java: src.main.java.com.acme.health.HealthController.health
      }
      guarantees {
        status existe
        runtime existe
      }
    }

    route get_health_publico {
      metodo: GET
      caminho: /api/health
      task: get_health
    }
  }
  `,
        },
        {
          caminhoRelativo: "src/main/java/com/acme/health/HealthController.java",
          conteudo: `package com.acme.health;

  import java.util.Map;
  import org.springframework.web.bind.annotation.GetMapping;
  import org.springframework.web.bind.annotation.RequestMapping;
  import org.springframework.web.bind.annotation.RestController;

  @RestController
  @RequestMapping("/api/health")
  public class HealthController {
      @GetMapping
      public Map<String, String> health() {
          return Map.of("status", "ok", "runtime", "spring");
      }
  }
  `,
        },
        {
          caminhoRelativo: "README.md",
          conteudo: `# Starter Spring Boot API + Sema

  - Contratos em \`contratos/\`
  - Controllers REST em \`src/main/java/\`
  - \`drift\` valida impl e rota publica
  `,
        },
      ];
    } else if (template === "go-http-api") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated",
    "alvos": ["typescript"],
    "alvoPadrao": "typescript",
    "estruturaSaida": "modulos",
    "framework": "base",
    "modoEstrito": true,
    "diretoriosCodigo": ["./internal"],
    "fontesLegado": ["go"],
    "diretoriosSaidaPorAlvo": {
      "typescript": "./generated/typescript"
    },
    "convencoesGeracaoPorProjeto": "base"
  }
  `,
        },
        {
          caminhoRelativo: "contratos/health.sema",
          conteudo: `module app.health {
    task get_health {
      output {
        resultado: Json
      }
      impl {
        go: internal.health.getHealth
      }
      guarantees {
        resultado existe
      }
    }

    route get_health_publico {
      metodo: GET
      caminho: /health
      task: get_health
    }
  }
  `,
        },
        {
          caminhoRelativo: "internal/health.go",
          conteudo: `package internal

  import "github.com/gin-gonic/gin"

  func registerRoutes(router *gin.Engine) {
      router.GET("/health", getHealth)
  }

  func getHealth(ctx *gin.Context) {
      ctx.JSON(200, gin.H{"status": "ok", "runtime": "go"})
  }
  `,
        },
        {
          caminhoRelativo: "README.md",
          conteudo: `# Starter Go HTTP API + Sema

  - Contratos em \`contratos/\`
  - Handlers em \`internal/\`
  - \`drift\` valida impl e rota publica
  `,
        },
      ];
    } else if (template === "rust-axum-api") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated",
    "alvos": ["typescript"],
    "alvoPadrao": "typescript",
    "estruturaSaida": "modulos",
    "framework": "base",
    "modoEstrito": true,
    "diretoriosCodigo": ["./src"],
    "fontesLegado": ["rust"],
    "diretoriosSaidaPorAlvo": {
      "typescript": "./generated/typescript"
    },
    "convencoesGeracaoPorProjeto": "base"
  }
  `,
        },
        {
          caminhoRelativo: "contratos/health.sema",
          conteudo: `module app.health {
    task get_health {
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

    route get_health_publico {
      metodo: GET
      caminho: /health
      task: get_health
    }
  }
  `,
        },
        {
          caminhoRelativo: "src/main.rs",
          conteudo: `use axum::{routing::get, Router};

  mod handlers;

  fn app() -> Router {
      Router::new().route("/health", get(handlers::health))
  }
  `,
        },
        {
          caminhoRelativo: "src/handlers.rs",
          conteudo: `pub async fn health() -> &'static str {
      "ok"
  }
  `,
        },
        {
          caminhoRelativo: "README.md",
          conteudo: `# Starter Rust Axum API + Sema

  - Contratos em \`contratos/\`
  - Handlers em \`src/\`
  - \`drift\` valida impl e rota publica
  `,
        },
      ];
    } else if (template === "cpp-service-bridge") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated",
    "alvos": ["typescript"],
    "alvoPadrao": "typescript",
    "estruturaSaida": "modulos",
    "framework": "base",
    "modoEstrito": true,
    "diretoriosCodigo": ["./src"],
    "fontesLegado": ["cpp"],
    "diretoriosSaidaPorAlvo": {
      "typescript": "./generated/typescript"
    },
    "convencoesGeracaoPorProjeto": "base"
  }
  `,
        },
        {
          caminhoRelativo: "contratos/runtime_bridge.sema",
          conteudo: `module app.runtime_bridge {
    task processar_snapshot {
      input {
        payload: Json required
      }
      output {
        resultado: Json
      }
      impl {
        cpp: src.runtime.RuntimeBridge.processSnapshot
      }
      guarantees {
        resultado existe
      }
    }
  }
  `,
        },
        {
          caminhoRelativo: "src/runtime.cpp",
          conteudo: `class RuntimeBridge {
  public:
      int processSnapshot(int payload) {
          return payload;
      }
  };
  `,
        },
        {
          caminhoRelativo: "README.md",
          conteudo: `# Starter C++ Service Bridge + Sema

  - Contratos em \`contratos/\`
  - Symbols e bridges em \`src/\`
  - \`drift\` valida impl de simbolos, sem prometer rota HTTP
  `,
        },
      ];
    }
  else {
    return null;
  }
  return arquivos;
}
