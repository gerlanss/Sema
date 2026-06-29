// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

export async function criarProjetoFlutterConsumer(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "lib", "screens"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./lib"],
      fontesLegado: ["flutter-consumer", "dart"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "pubspec.yaml",
    `name: fixture_flutter_consumer_sema
publish_to: "none"

environment:
  sdk: ">=3.3.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  go_router: ^14.0.0
`,
  );

  await escrever(
    base,
    "lib/sema_consumer_bridge.dart",
    `Future<Map<String, dynamic>> semaFetchShowroomRanking() async {
  return {
    "ranking": [
      {"clube": "Tigres do Norte", "pontos": 33},
      {"clube": "Porto Azul", "pontos": 31},
      {"clube": "Galo de Ouro", "pontos": 28},
    ],
  };
}

Future<Map<String, dynamic>> semaLoadRankingSummary() async {
  return {
    "totalClubes": 3,
    "atualizadoEm": "2026-03-31T12:00:00.000Z",
  };
}
`,
  );

  await escrever(
    base,
    "lib/router.dart",
    `import "package:go_router/go_router.dart";
import "package:flutter/widgets.dart";
import "screens/ranking_screen.dart";

final appRouter = GoRouter(
  routes: [
    GoRoute(
      path: "/ranking",
      builder: (BuildContext context, GoRouterState state) => const RankingScreen(),
    ),
  ],
);
`,
  );

  await escrever(
    base,
    "lib/screens/ranking_screen.dart",
    `import "package:flutter/widgets.dart";
import "../sema_consumer_bridge.dart";

class RankingScreen extends StatefulWidget {
  const RankingScreen({super.key});

  @override
  State<RankingScreen> createState() => _RankingScreenState();
}

class _RankingScreenState extends State<RankingScreen> {
  List<Map<String, dynamic>> ranking = const [];

  @override
  void initState() {
    super.initState();
    semaFetchShowroomRanking().then((payload) {
      final itens = (payload["ranking"] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (!mounted) return;
      setState(() {
        ranking = itens;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: ranking
          .map((item) => Text("\${item["clube"]} - \${item["pontos"]} pts"))
          .toList(),
    );
  }
}
`,
  );

  await escrever(
    base,
    "lib/main.dart",
    `import "package:flutter/material.dart";
import "router.dart";

void main() {
  runApp(const ShowroomApp());
}

class ShowroomApp extends StatelessWidget {
  const ShowroomApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      routerConfig: appRouter,
    );
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
      resultado: Json
    }
    impl {
      dart: lib.sema_consumer_bridge.semaFetchShowroomRanking
    }
    vinculos {
      arquivo: "lib/sema_consumer_bridge.dart"
      simbolo: lib.sema_consumer_bridge.semaFetchShowroomRanking
      superficie: "/ranking"
      arquivo: "lib/router.dart"
      arquivo: "lib/screens/ranking_screen.dart"
    }
    guarantees {
      resultado existe
    }
  }
}
`,
  );
}
