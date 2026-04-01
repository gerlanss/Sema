import "package:flutter/widgets.dart";
import "package:go_router/go_router.dart";

import "screens/ranking_screen.dart";

final appRouter = GoRouter(
  routes: [
    GoRoute(
      path: "/ranking",
      builder: (BuildContext context, GoRouterState state) => const RankingScreen(),
    ),
  ],
);
