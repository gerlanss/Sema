// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoAngularStandaloneConsumer(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "app"), { recursive: true }),
    mkdir(path.join(base, "src", "components"), { recursive: true }),
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
      name: "fixture-angular-standalone-consumer-sema",
      private: true,
      dependencies: {
        "@angular/common": "19.0.0",
        "@angular/core": "19.0.0",
        "@capacitor/preferences": "6.0.0",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "src/app/sema_consumer_bridge.ts",
    `import { Preferences } from "@capacitor/preferences";

export async function semaFetchShowroomRanking() {
  return {
    ranking: [
      { clube: "Tigres do Norte", pontos: 33 },
      { clube: "Porto Azul", pontos: 31 },
      { clube: "Galo de Ouro", pontos: 28 },
    ],
  };
}

export async function semaSaveRankingPreference(locale: string) {
  await Preferences.set({ key: "ranking_preference_locale", value: locale });
  localStorage.setItem("ranking_preference_theme", "classic");
  sessionStorage.setItem("ranking_preference_last_view", "shell");
  return { ok: true };
}

export async function semaLoadRankingPreference() {
  const payload = await Preferences.get({ key: "ranking_preference_locale" });
  const theme = localStorage.getItem("ranking_preference_theme");
  sessionStorage.removeItem("ranking_preference_last_view");
  return {
    idioma: payload.value ?? theme ?? "pt-BR",
  };
}
`,
  );

  await escrever(
    base,
    "src/app.component.ts",
    `import { Component } from "@angular/core";
import { RankingShellComponent } from "./components/ranking-shell.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RankingShellComponent],
  template: \`
    <main>
      <h1>Ranking root shell</h1>
      <app-ranking-shell></app-ranking-shell>
    </main>
  \`,
})
export class AppComponent {}
`,
  );

  await escrever(
    base,
    "src/components/ranking-shell.component.ts",
    `import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { semaFetchShowroomRanking, semaLoadRankingPreference } from "../app/sema_consumer_bridge";
import { RankingCardComponent } from "./ranking-card.component";

@Component({
  selector: "app-ranking-shell",
  standalone: true,
  imports: [CommonModule, RankingCardComponent],
  template: \`
    <section>
      <p>Idioma atual: {{ idioma }}</p>
      <ul>
        <li *ngFor="let item of ranking">
          {{ item.clube }} - {{ item.pontos }} pts
        </li>
      </ul>
      <app-ranking-card></app-ranking-card>
    </section>
  \`,
})
export class RankingShellComponent implements OnInit {
  idioma = "pt-BR";
  ranking: Array<{ clube: string; pontos: number }> = [];

  async ngOnInit() {
    const [payload, preferencia] = await Promise.all([
      semaFetchShowroomRanking(),
      semaLoadRankingPreference(),
    ]);
    this.ranking = payload.ranking ?? [];
    this.idioma = preferencia.idioma ?? "pt-BR";
  }
}
`,
  );

  await escrever(
    base,
    "src/components/ranking-card.component.ts",
    `import { Component } from "@angular/core";
import { semaSaveRankingPreference } from "../app/sema_consumer_bridge";

@Component({
  selector: "app-ranking-card",
  standalone: true,
  template: \`
    <article>
      <button type="button" (click)="salvar()">Salvar preferencia</button>
    </article>
  \`,
})
export class RankingCardComponent {
  async salvar() {
    await semaSaveRankingPreference("pt-BR");
  }
}
`,
  );

  await escrever(
    base,
    "contratos/showroom_consumer.sema",
    `module showroom.consumer {
  vinculos {
    superficie: "/"
    arquivo: "src/app.component.ts"
    arquivo: "src/components/ranking-shell.component.ts"
    arquivo: "src/components/ranking-card.component.ts"
  }

  task fetch_showroom_ranking {
    output {
      ranking: Json
    }
    impl {
      ts: src.app.sema_consumer_bridge.semaFetchShowroomRanking
    }
    guarantees {
      ranking existe
    }
  }

  task salvar_preferencia_ranking {
    input {
      locale: Texto required
    }
    output {
      ok: Booleano
    }
    effects {
      persiste ranking_preferences criticidade = media
    }
    impl {
      ts: src.app.sema_consumer_bridge.semaSaveRankingPreference
    }
    guarantees {
      ok existe
    }
  }

  task restaurar_preferencia_ranking {
    output {
      idioma: Texto
    }
    effects {
      db.read ranking_preferences criticidade = baixa
    }
    impl {
      ts: src.app.sema_consumer_bridge.semaLoadRankingPreference
    }
    guarantees {
      idioma existe
    }
  }
}
`,
  );
}
