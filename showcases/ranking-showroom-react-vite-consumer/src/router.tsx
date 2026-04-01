import { createBrowserRouter } from "react-router-dom";
import { RankingPage } from "./pages/ranking";

export const appRouter = createBrowserRouter([
  {
    path: "/ranking",
    Component: RankingPage,
  },
]);
