// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoNextJsAppRouter(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "reposicao"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "pedido"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "reposicao", "[itemId]"), { recursive: true }),
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
      name: "fixture-nextjs-sema",
      private: true,
      dependencies: {
        next: "15.0.0",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "src/app/api/reposicao/route.ts",
    `export async function GET() {
  return Response.json({ produtos: [], total: 0 });
}
`,
  );

  await escrever(
    base,
    "src/app/api/pedido/route.ts",
    `export async function GET() {
  return Response.json({ pedido: null });
}

export async function POST() {
  return Response.json({ ok: true });
}
`,
  );

  await escrever(
    base,
    "src/app/api/reposicao/[itemId]/route.ts",
    `export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const resolved = await params;
  return Response.json({ itemId: resolved.itemId });
}
`,
  );

  await escrever(
    base,
    "contratos/next_http.sema",
    `module legado.next.http {
  task api_reposicao_get {
    output {
      resultado: Json
    }
    impl {
      ts: src.app.api.reposicao.route.GET
    }
    guarantees {
      resultado existe
    }
  }

  task api_pedido_get {
    output {
      resultado: Json
    }
    impl {
      ts: src.app.api.pedido.route.GET
    }
    guarantees {
      resultado existe
    }
  }

  task api_pedido_post {
    output {
      resultado: Json
    }
    impl {
      ts: src.app.api.pedido.route.POST
    }
    guarantees {
      resultado existe
    }
  }

  task api_reposicao_item_id_get {
    input {
      item_id: Id required
    }
    output {
      resultado: Json
    }
    impl {
      ts: src.app.api.reposicao.item_id.route.GET
    }
    guarantees {
      resultado existe
    }
  }

  route get_reposicao {
    metodo: GET
    caminho: /api/reposicao
    task: api_reposicao_get
  }

  route get_pedido {
    metodo: GET
    caminho: /api/pedido
    task: api_pedido_get
  }

  route post_pedido {
    metodo: POST
    caminho: /api/pedido
    task: api_pedido_post
  }

  route get_reposicao_item {
    metodo: GET
    caminho: "/api/reposicao/{itemId}"
    task: api_reposicao_item_id_get
  }
  }
`,
  );
}
