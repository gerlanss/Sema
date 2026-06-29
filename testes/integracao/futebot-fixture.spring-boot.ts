// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoSpringBoot(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "main", "java", "com", "acme", "health"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["java"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "src/main/java/com/acme/health/HealthController.java",
    `package com.acme.health;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {
    @GetMapping("/{id}")
    public Map<String, String> show(@PathVariable Integer id) {
        return Map.of("status", "ok", "runtime", "spring");
    }

    @PostMapping("/refresh")
    public Map<String, String> refresh() {
        return Map.of("status", "refreshed");
    }
}
`,
  );

  await escrever(
    base,
    "contratos/http.sema",
    `module legado.java.http {
  task show {
    input {
      id: Inteiro required
    }
    output {
      resultado: Json
    }
    impl {
      java: src.main.java.com.acme.health.health_controller.HealthController.show
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
      java: src.main.java.com.acme.health.health_controller.HealthController.refresh
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
