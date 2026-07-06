// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture PHP Laravel; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoPhpLaravel(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "app", "Http", "Controllers"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./app"],
      fontesLegado: ["php"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "composer.json",
    JSON.stringify({
      require: {
        "laravel/framework": "^11.0",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "app/Http/Controllers/HealthController.php",
    `<?php

namespace App\\Http\\Controllers;

use Illuminate\\Support\\Facades\\Route;

Route::get('/api/health/{id}', [HealthController::class, 'show']);
Route::post('/api/health/refresh', [HealthController::class, 'refresh']);

class HealthController
{
    public function show(int $id): array
    {
        return ['status' => 'ok', 'id' => $id];
    }

    public function refresh(): array
    {
        return ['status' => 'refreshed'];
    }
}
`,
  );

  await escrever(
    base,
    "contratos/http.sema",
    `module legado.php.http {
  task show {
    input {
      id: Inteiro required
    }
    output {
      resultado: Json
    }
    impl {
      php: app.Http.Controllers.HealthController.show
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
      php: app.Http.Controllers.HealthController.refresh
    }
    guarantees {
      resultado existe
    }
  }

  route show_publico {
    metodo: GET
    caminho: "/api/health/{id}"
    task: show
  }

  route refresh_publico {
    metodo: POST
    caminho: /api/health/refresh
    task: refresh
  }
}
`,
  );
}
