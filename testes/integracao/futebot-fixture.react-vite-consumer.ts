// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoReactViteConsumer(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "lib"), { recursive: true }),
    mkdir(path.join(base, "src", "pages"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["react-vite-consumer", "typescript"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "package.json",
    JSON.stringify({
      name: "fixture-react-vite-consumer-sema",
      private: true,
      dependencies: {
        react: "19.0.0",
        "react-router-dom": "7.0.0",
        vite: "6.0.0",
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
    "src/pages/ranking.tsx",
    `import { useEffect, useState } from "react";
import { semaFetchShowroomRanking } from "../lib/sema_consumer_bridge";

export function RankingPage() {
  const [ranking, setRanking] = useState<Array<{ clube: string; pontos: number }>>([]);

  useEffect(() => {
    void semaFetchShowroomRanking().then((payload) => setRanking(payload.ranking ?? []));
  }, []);

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
    "src/router.tsx",
    `import { createBrowserRouter } from "react-router-dom";
import { RankingPage } from "./pages/ranking";

export const appRouter = createBrowserRouter([
  {
    path: "/ranking",
    Component: RankingPage,
  },
]);
`,
  );

  await escrever(
    base,
    "src/App.tsx",
    `import { RouterProvider } from "react-router-dom";
import { appRouter } from "./router";

export default function App() {
  return <RouterProvider router={appRouter} />;
}
`,
  );

  await escrever(
    base,
    "src/main.tsx",
    `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
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
      arquivo: "src/router.tsx"
      arquivo: "src/pages/ranking.tsx"
    }
    guarantees {
      ranking existe
    }
  }
}
`,
  );
}
