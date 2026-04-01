import { Routes } from "@angular/router";

export const RANKING_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () => import("./ranking-page.component").then((m) => m.RankingPageComponent),
  },
];
