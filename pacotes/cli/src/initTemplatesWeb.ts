// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: templates de inicializa??o para consumers web Next, React Vite e Angular.


import type { ArquivosTemplateIniciar, TemplateIniciar } from "./initTemplatesBase.js";

export function arquivosInitTemplatesWeb(template: TemplateIniciar, arquivosBase: ArquivosTemplateIniciar): ArquivosTemplateIniciar | null {
  let arquivos = arquivosBase;
if (template === "nextjs-consumer") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated",
    "alvos": ["typescript"],
    "alvoPadrao": "typescript",
    "estruturaSaida": "modulos",
    "framework": "base",
    "modoEstrito": true,
    "diretoriosCodigo": ["./src"],
    "fontesLegado": ["nextjs-consumer", "typescript"],
    "diretoriosSaidaPorAlvo": {
      "typescript": "./generated/typescript"
    },
    "convencoesGeracaoPorProjeto": "base"
  }
  `,
        },
        {
          caminhoRelativo: "contratos/showroom_consumer.sema",
          conteudo: `module showroom.consumer {
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
        },
        {
          caminhoRelativo: "src/lib/sema_consumer_bridge.ts",
          conteudo: `export async function semaFetchShowroomRanking() {
    return {
      ranking: [
        { clube: "Tigres do Norte", pontos: 33 },
        { clube: "Porto Azul", pontos: 31 },
        { clube: "Galo de Ouro", pontos: 28 },
      ],
    };
  }
  `,
        },
        {
          caminhoRelativo: "src/app/ranking/page.tsx",
          conteudo: `import { semaFetchShowroomRanking } from "../../lib/sema_consumer_bridge";

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
        },
        {
          caminhoRelativo: "src/app/ranking/loading.tsx",
          conteudo: `export default function Loading() {
    return <p>Carregando ranking...</p>;
  }
  `,
        },
        {
          caminhoRelativo: "src/app/ranking/error.tsx",
          conteudo: `"use client";

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
        },
        {
          caminhoRelativo: "README.md",
          conteudo: `# Starter Next.js Consumer + Sema

  - Contratos em \`contratos/\`
  - Bridge consumer canonico em \`src/lib/sema_consumer_bridge.ts\`
  - Superficies App Router em \`src/app/\`
  - O slice oficial desta fase e \`consumer bridge + App Router surfaces\`
  - \`drift\` valida \`impl\`, \`vinculos\`, bridge e superficies, sem prometer visual drift
  `,
        },
      ];
    } else if (template === "react-vite-consumer") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated",
    "alvos": ["typescript"],
    "alvoPadrao": "typescript",
    "estruturaSaida": "modulos",
    "framework": "base",
    "modoEstrito": true,
    "diretoriosCodigo": ["./src"],
    "fontesLegado": ["react-vite-consumer", "typescript"],
    "diretoriosSaidaPorAlvo": {
      "typescript": "./generated/typescript"
    },
    "convencoesGeracaoPorProjeto": "base"
  }
  `,
        },
        {
          caminhoRelativo: "contratos/showroom_consumer.sema",
          conteudo: `module showroom.consumer {
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
        },
        {
          caminhoRelativo: "src/lib/sema_consumer_bridge.ts",
          conteudo: `export async function semaFetchShowroomRanking() {
    return {
      ranking: [
        { clube: "Tigres do Norte", pontos: 33 },
        { clube: "Porto Azul", pontos: 31 },
        { clube: "Galo de Ouro", pontos: 28 },
      ],
    };
  }
  `,
        },
        {
          caminhoRelativo: "src/pages/ranking.tsx",
          conteudo: `import { useEffect, useState } from "react";
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
        },
        {
          caminhoRelativo: "src/router.tsx",
          conteudo: `import { createBrowserRouter } from "react-router-dom";
  import { RankingPage } from "./pages/ranking";

  export const appRouter = createBrowserRouter([
    {
      path: "/ranking",
      Component: RankingPage,
    },
  ]);
  `,
        },
        {
          caminhoRelativo: "src/App.tsx",
          conteudo: `import { RouterProvider } from "react-router-dom";
  import { appRouter } from "./router";

  export default function App() {
    return <RouterProvider router={appRouter} />;
  }
  `,
        },
        {
          caminhoRelativo: "src/main.tsx",
          conteudo: `import React from "react";
  import ReactDOM from "react-dom/client";
  import App from "./App";

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  `,
        },
        {
          caminhoRelativo: "README.md",
          conteudo: `# Starter React Vite Consumer + Sema

  - Contratos em \`contratos/\`
  - Bridge consumer canonico em \`src/lib/sema_consumer_bridge.ts\`
  - Rotas explicitas em \`src/router.tsx\`
  - Superficies consumer em \`src/pages/\`
  - O slice oficial desta fase e \`consumer bridge + react-router surfaces\`
  - \`drift\` valida \`impl\`, \`vinculos\`, bridge e superficies, sem prometer visual drift
  `,
        },
      ];
    } else if (template === "angular-consumer") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated",
    "alvos": ["typescript"],
    "alvoPadrao": "typescript",
    "estruturaSaida": "modulos",
    "framework": "base",
    "modoEstrito": true,
    "diretoriosCodigo": ["./src"],
    "fontesLegado": ["angular-consumer", "typescript"],
    "diretoriosSaidaPorAlvo": {
      "typescript": "./generated/typescript"
    },
    "convencoesGeracaoPorProjeto": "base"
  }
  `,
        },
        {
          caminhoRelativo: "contratos/showroom_consumer.sema",
          conteudo: `module showroom.consumer {
    task fetch_showroom_ranking {
      input {
      }
      output {
        ranking: Json
      }
      impl {
        ts: src.app.sema_consumer_bridge.semaFetchShowroomRanking
      }
      vinculos {
        arquivo: "src/app/sema_consumer_bridge.ts"
        simbolo: src.app.sema_consumer_bridge.semaFetchShowroomRanking
        superficie: "/ranking"
        arquivo: "src/app/app.routes.ts"
        arquivo: "src/app/features/ranking/ranking.routes.ts"
        arquivo: "src/app/features/ranking/ranking-page.component.ts"
      }
      guarantees {
        ranking existe
      }
    }
  }
  `,
        },
        {
          caminhoRelativo: "src/app/sema_consumer_bridge.ts",
          conteudo: `export async function semaFetchShowroomRanking() {
    return {
      ranking: [
        { clube: "Tigres do Norte", pontos: 33 },
        { clube: "Porto Azul", pontos: 31 },
        { clube: "Galo de Ouro", pontos: 28 },
      ],
    };
  }
  `,
        },
        {
          caminhoRelativo: "src/app/app.routes.ts",
          conteudo: `import { Routes } from "@angular/router";

  export const routes: Routes = [
    {
      path: "ranking",
      loadChildren: () => import("./features/ranking/ranking.routes").then((m) => m.RANKING_ROUTES),
    },
  ];
  `,
        },
        {
          caminhoRelativo: "src/app/features/ranking/ranking.routes.ts",
          conteudo: `import { Routes } from "@angular/router";

  export const RANKING_ROUTES: Routes = [
    {
      path: "",
      loadComponent: () => import("./ranking-page.component").then((m) => m.RankingPageComponent),
    },
  ];
  `,
        },
        {
          caminhoRelativo: "src/app/features/ranking/ranking-page.component.ts",
          conteudo: `import { Component, OnInit } from "@angular/core";
  import { CommonModule } from "@angular/common";
  import { semaFetchShowroomRanking } from "../../sema_consumer_bridge";

  @Component({
    selector: "app-ranking-page",
    standalone: true,
    imports: [CommonModule],
    template: \`
      <main>
        <h1>Ranking showroom</h1>
        <ul>
          <li *ngFor="let item of ranking">
            {{ item.clube }} - {{ item.pontos }} pts
          </li>
        </ul>
      </main>
    \`,
  })
  export class RankingPageComponent implements OnInit {
    ranking: Array<{ clube: string; pontos: number }> = [];

    async ngOnInit() {
      const payload = await semaFetchShowroomRanking();
      this.ranking = payload.ranking ?? [];
    }
  }
  `,
        },
        {
          caminhoRelativo: "src/app/app.component.ts",
          conteudo: `import { Component } from "@angular/core";
  import { RouterOutlet } from "@angular/router";

  @Component({
    selector: "app-root",
    standalone: true,
    imports: [RouterOutlet],
    template: "<router-outlet />",
  })
  export class AppComponent {}
  `,
        },
        {
          caminhoRelativo: "src/main.ts",
          conteudo: `import { bootstrapApplication } from "@angular/platform-browser";
  import { provideRouter } from "@angular/router";
  import { AppComponent } from "./app/app.component";
  import { routes } from "./app/app.routes";

  void bootstrapApplication(AppComponent, {
    providers: [provideRouter(routes)],
  });
  `,
        },
        {
          caminhoRelativo: "README.md",
          conteudo: `# Starter Angular Consumer + Sema

  - Contratos em \`contratos/\`
  - Bridge consumer canonico em \`src/app/sema_consumer_bridge.ts\`
  - Rotas lazy em \`src/app/app.routes.ts\`
  - Feature folders em \`src/app/features/\`
  - O slice oficial desta fase e \`consumer bridge + route config surfaces\`
  - \`drift\` valida \`impl\`, \`vinculos\`, bridge e superficies, sem prometer visual drift
  `,
        },
      ];
    }
  else {
    return null;
  }
  return arquivos;
}
