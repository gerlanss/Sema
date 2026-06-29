// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoNextJsConsumer(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "lib"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "ranking"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["nextjs-consumer", "typescript"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "package.json",
    JSON.stringify({
      name: "fixture-nextjs-consumer-sema",
      private: true,
      dependencies: {
        next: "15.0.0",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "src/lib/sema_consumer_bridge.ts",
    `export async function semaFetchShowroomRanking() {
  return {
    ranking: [
      { clube: "Tigres do Norte", pontos: 33 },
      { clube: "Porto Azul", pontos: 31 },
      { clube: "Galo de Ouro", pontos: 28 },
    ],
  };
}

export async function semaLoadRankingSummary() {
  return {
    totalClubes: 3,
    atualizadoEm: "2026-03-31T12:00:00.000Z",
  };
}
`,
  );

  await escrever(
    base,
    "src/app/ranking/page.tsx",
    `import { semaFetchShowroomRanking } from "../../lib/sema_consumer_bridge";

export default async function RankingPage() {
  const { ranking } = await semaFetchShowroomRanking();

  return (
    <main>
      <h1>Ranking showroom</h1>
      <ul>
        {ranking.map((item) => (
          <li key={item.clube}>
            {item.clube} - {item.pontos} pts
          </li>
        ))}
      </ul>
    </main>
  );
}
`,
  );

  await escrever(
    base,
    "src/app/ranking/loading.tsx",
    `export default function Loading() {
  return <p>Carregando ranking...</p>;
}
`,
  );

  await escrever(
    base,
    "src/app/ranking/error.tsx",
    `"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main>
      <h1>Falha ao carregar ranking</h1>
      <p>{error.message}</p>
      <button type="button" onClick={reset}>Tentar novamente</button>
    </main>
  );
}
`,
  );

  await escrever(
    base,
    "contratos/showroom_consumer.sema",
    `module showroom.consumer {
  task fetch_showroom_ranking {
    input {
    }
    output {
      ranking: Json
    }
    impl {
      ts: src.lib.sema_consumer_bridge.semaFetchShowroomRanking
    }
    vinculos {
      arquivo: "src/lib/sema_consumer_bridge.ts"
      simbolo: src.lib.sema_consumer_bridge.semaFetchShowroomRanking
      superficie: "/ranking"
      arquivo: "src/app/ranking/page.tsx"
      arquivo: "src/app/ranking/loading.tsx"
      arquivo: "src/app/ranking/error.tsx"
    }
    guarantees {
      ranking existe
    }
  }
}
`,
  );
}
