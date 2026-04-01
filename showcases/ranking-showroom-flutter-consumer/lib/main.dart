import "package:flutter/material.dart";

import "router.dart";

void main() {
  runApp(const RankingShowroomApp());
}

class RankingShowroomApp extends StatelessWidget {
  const RankingShowroomApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      routerConfig: appRouter,
    );
  }
}
