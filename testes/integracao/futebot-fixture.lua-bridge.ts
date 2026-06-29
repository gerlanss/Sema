// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoLuaBridge(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "app"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./app"],
      fontesLegado: ["lua"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "app/social.lua",
    `local social = {}

function social.publicar(mensagem)
    return { ok = true, mensagem = mensagem }
end

local function preparar_payload(mensagem)
    return { mensagem = mensagem }
end

return {
    publicar = social.publicar,
    preparar_payload = preparar_payload,
}
`,
  );

  await escrever(
    base,
    "contratos/social.sema",
    `module legado.lua.social {
  task publicar {
    input {
      mensagem: Texto required
    }
    output {
      resultado: Json
    }
    impl {
      lua: app.social.publicar
    }
    guarantees {
      resultado existe
    }
  }

  task preparar_payload {
    input {
      mensagem: Texto required
    }
    output {
      resultado: Json
    }
    impl {
      lua: app.social.preparar_payload
    }
    guarantees {
      resultado existe
    }
  }
}
`,
  );
}
