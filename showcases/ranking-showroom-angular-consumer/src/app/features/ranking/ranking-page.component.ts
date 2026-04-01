import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { semaFetchShowroomRanking } from "../../sema_consumer_bridge";

@Component({
  selector: "app-ranking-page",
  standalone: true,
  imports: [CommonModule],
  template: `
    <main>
      <h1>Ranking showroom</h1>
      <ul>
        <li *ngFor="let item of ranking">
          {{ item.clube || item.nome || "clube" }} - {{ item.pontos || item.score || 0 }}
        </li>
      </ul>
    </main>
  `,
})
export class RankingPageComponent implements OnInit {
  ranking: Array<{ clube?: string; nome?: string; pontos?: number; score?: number }> = [];

  async ngOnInit() {
    const payload = await semaFetchShowroomRanking();
    this.ranking = payload.ranking ?? [];
  }
}
