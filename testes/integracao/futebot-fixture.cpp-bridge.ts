// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoCppBridge(base: string): Promise<void> {
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
      fontesLegado: ["cpp"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "src/runtime.cpp",
    `class RuntimeBridge {
public:
    int processSnapshot(int payload) {
        return payload;
    }
};

int emitSignal(int code) {
    return code;
}
`,
  );

  await escrever(
    base,
    "contratos/runtime_bridge.sema",
    `module legado.cpp.bridge {
  task process_snapshot {
    input {
      payload: Inteiro required
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

  task emit_signal {
    input {
      code: Inteiro required
    }
    output {
      resultado: Json
    }
    impl {
      cpp: src.runtime.emitSignal
    }
    guarantees {
      resultado existe
    }
  }
}
`,
  );
}
