// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoBridgeDart(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "lib", "api"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./lib"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "lib/api/sema_contract_bridge.dart",
    `Future<Map<String, dynamic>> semaFetchShowroomRanking() async {
  return {"status": "ok"};
}

Future<Map<String, dynamic>> semaCheckForUpdate() async {
  return {"version": "1.0.0"};
}
`,
  );

  await escrever(
    base,
    "contratos/consumer_bridge.sema",
    `module legado.dart.consumer {
  task fetch_showroom_ranking {
    output {
      resultado: Json
    }
    impl {
      dart: lib.api.sema_contract_bridge.semaFetchShowroomRanking
    }
    guarantees {
      resultado existe
    }
  }

  task check_for_update {
    output {
      resultado: Json
    }
    impl {
      dart: lib.api.sema_contract_bridge.semaCheckForUpdate
    }
    guarantees {
      resultado existe
    }
  }
}
`,
  );
}
