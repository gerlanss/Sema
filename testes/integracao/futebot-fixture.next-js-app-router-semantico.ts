// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoNextJsAppRouterSemantico(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "src", "app", "api", "auth", "session"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "auth", "login"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "catalogo", "busca"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "local-firestore", "query"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "reposicao", "[itemId]"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "fallback"), { recursive: true }),
  ]);

  await escrever(
    base,
    "package.json",
    JSON.stringify({
      name: "fixture-nextjs-semantico",
      private: true,
      dependencies: {
        next: "15.0.0",
        zod: "^3.23.8",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "src/app/api/auth/session/route.ts",
    `import { NextResponse } from "next/server";
import { z } from "zod";

interface CreateSessionBody {
  email: string;
  password: string;
  remember?: boolean;
}

interface SessionResponse {
  session_id: string;
  user_id: string;
}

const sessionSchema = z.object({
  email: z.string(),
  password: z.string(),
  remember: z.boolean().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expand = url.searchParams.get("expand");
  const refreshId = request.nextUrl.searchParams.get("refreshId");

  if (!refreshId) {
    return NextResponse.json({ error: "missing_refresh" }, { status: 401 });
  }

  const response: SessionResponse = {
    session_id: refreshId,
    user_id: expand ?? "usr_default",
  };

  return NextResponse.json<SessionResponse>(response, { status: 200 });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateSessionBody;
  const parsed = sessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  if (parsed.data.email === "blocked@example.com") {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }
  const response = NextResponse.json<SessionResponse>({
    session_id: parsed.data.email,
    user_id: parsed.data.email,
  }, { status: 201 });

  return response;
}
`,
  );

  await escrever(
    base,
    "src/app/api/auth/login/route.ts",
    `import { NextResponse } from "next/server";

interface LoginBody {
  email?: string;
  password?: string;
  rememberMe?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";
    const rememberMe = body.rememberMe ?? true;

    if (!email || !password) {
      return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
    }

    if (email === "blocked@example.com") {
      return NextResponse.json({ error: "blocked" }, { status: 401 });
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        email,
        remember_me: rememberMe,
      },
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unexpected_failure" },
      { status: 500 },
    );
  }
}
`,
  );

  await escrever(
    base,
    "src/app/api/catalogo/busca/route.ts",
    `import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const searchParams = request.nextUrl.searchParams;
  const termo = searchParams.get("termo");
  const limite = Number(searchParams.get("limite") ?? "10");

  return NextResponse.json({
    termo,
    limite,
    total: 0,
  });
}
`,
  );

  await escrever(
    base,
    "src/app/api/local-firestore/query/route.ts",
    `import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    collection?: string;
    filters?: Array<{ field: string; operator: string; value: string }>;
    orderBy?: { field: string; direction: "asc" | "desc" } | null;
    limit?: number | null;
  };

  if (!body.collection) {
    return NextResponse.json({ error: "missing_collection" }, { status: 400 });
  }

  return NextResponse.json({
    docs: [],
    total: body.limit ?? 0,
  });
}
`,
  );

  await escrever(
    base,
    "src/app/api/reposicao/[itemId]/route.ts",
    `import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const resolved = await params;

  return NextResponse.json({
    item_id: resolved.itemId,
    status: "ok",
  });
}
`,
  );

  await escrever(
    base,
    "src/app/api/fallback/route.ts",
    `export async function POST(request: Request) {
  const payload = await request.json();

  return Response.json(payload);
}
`,
  );
}
