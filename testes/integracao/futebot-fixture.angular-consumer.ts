// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoAngularConsumer(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "features", "ranking"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["angular-consumer", "typescript"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "package.json",
    JSON.stringify({
      name: "fixture-angular-consumer-sema",
      private: true,
      dependencies: {
        "@angular/core": "19.0.0",
        "@angular/router": "19.0.0",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "src/app/sema_consumer_bridge.ts",
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
    "src/app/app.routes.ts",
    `import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "ranking",
    loadChildren: () => import("./features/ranking/ranking.routes").then((m) => m.RANKING_ROUTES),
  },
];
`,
  );

  await escrever(
    base,
    "src/app/features/ranking/ranking.routes.ts",
    `import { Routes } from "@angular/router";

export const RANKING_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () => import("./ranking-page.component").then((m) => m.RankingPageComponent),
  },
];
`,
  );

  await escrever(
    base,
    "src/app/features/ranking/ranking-page.component.ts",
    `import { Component, OnInit } from "@angular/core";
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
  );
}
