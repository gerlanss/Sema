import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "ranking",
    loadChildren: () => import("./features/ranking/ranking.routes").then((m) => m.RANKING_ROUTES),
  },
];
