// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoDotnetAspNet(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "Controllers"), { recursive: true }),
    mkdir(path.join(base, "src", "Minimal"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["dotnet"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "src/Controllers/HealthController.cs",
    `using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    [HttpGet("{id:int}")]
    public HealthPayload Get(int id)
    {
        return new HealthPayload { Status = "ok", Runtime = "aspnet" };
    }
}

public class HealthPayload
{
    public string Status { get; set; } = "";
    public string Runtime { get; set; } = "";
}
`,
  );

  await escrever(
    base,
    "src/Minimal/Program.cs",
    `var app = WebApplication.CreateBuilder(args).Build();
app.MapPost("/api/minimal/ping", Ping);

static object Ping()
{
    return new { status = "pong" };
}
`,
  );

  await escrever(
    base,
    "contratos/http.sema",
    `module legado.dotnet.http {
  task get_health {
    input {
      id: Inteiro required
    }
    output {
      resultado: Json
    }
    impl {
      cs: src.controllers.health_controller.HealthController.Get
    }
    guarantees {
      resultado existe
    }
  }

  task ping {
    output {
      resultado: Json
    }
    impl {
      cs: src.minimal.program.Ping
    }
    guarantees {
      resultado existe
    }
  }

  route get_health_publico {
    metodo: GET
    caminho: "/api/health/{id}"
    task: get_health
  }

  route ping_publico {
    metodo: POST
    caminho: /api/minimal/ping
    task: ping
  }
}
`,
  );
}
