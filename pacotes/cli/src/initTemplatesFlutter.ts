// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: template de inicializa??o Flutter consumer.


import type { ArquivosTemplateIniciar, TemplateIniciar } from "./initTemplatesBase.js";

export function arquivosInitTemplatesFlutter(template: TemplateIniciar, arquivosBase: ArquivosTemplateIniciar): ArquivosTemplateIniciar | null {
  let arquivos = arquivosBase;
if (template === "flutter-consumer") {
      arquivos = [
        {
          caminhoRelativo: "sema.config.json",
          conteudo: `{
    "origens": ["./contratos"],
    "saida": "./generated",
    "alvos": ["dart"],
    "alvoPadrao": "dart",
    "estruturaSaida": "modulos",
    "framework": "base",
    "modoEstrito": true,
    "diretoriosCodigo": ["./lib"],
    "fontesLegado": ["flutter-consumer", "dart"],
    "diretoriosSaidaPorAlvo": {
      "dart": "./generated/dart"
    },
    "convencoesGeracaoPorProjeto": "base"
  }
  `,
        },
        {
          caminhoRelativo: "pubspec.yaml",
          conteudo: `name: sema_flutter_consumer
  description: Starter Flutter consumer IA-first com Sema
  publish_to: "none"

  environment:
    sdk: ">=3.3.0 <4.0.0"

  dependencies:
    flutter:
      sdk: flutter
    go_router: ^14.0.0
  `,
        },
        {
          caminhoRelativo: "contratos/showroom_consumer.sema",
          conteudo: `module showroom.consumer {
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
        },
        {
          caminhoRelativo: "lib/sema_consumer_bridge.dart",
          conteudo: `Future<Map<String, dynamic>> semaFetchShowroomRanking() async {
    return {
      "ranking": [
        {"clube": "Tigres do Norte", "pontos": 33},
        {"clube": "Porto Azul", "pontos": 31},
        {"clube": "Galo de Ouro", "pontos": 28},
      ],
    };
  }
  `,
        },
        {
          caminhoRelativo: "lib/router.dart",
          conteudo: `import "package:go_router/go_router.dart";
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
        },
        {
          caminhoRelativo: "lib/screens/ranking_screen.dart",
          conteudo: `import "package:flutter/widgets.dart";
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
        children: [
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text("Ranking showroom"),
          ),
          ...ranking.map((item) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text("\${item["clube"]} - \${item["pontos"]} pts"),
          )),
        ],
      );
    }
  }
  `,
        },
        {
          caminhoRelativo: "lib/main.dart",
          conteudo: `import "package:flutter/material.dart";
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
        },
        {
          caminhoRelativo: "README.md",
          conteudo: `# Starter Flutter Consumer + Sema

  - Contratos em \`contratos/\`
  - Bridge consumer canonico em \`lib/sema_consumer_bridge.dart\`
  - Rotas consumer em \`lib/router.dart\`
  - Superficies consumer em \`lib/screens/\`
  - O slice oficial desta fase e \`consumer bridge + router/screen surfaces\`
  - \`drift\` valida \`impl\`, \`vinculos\`, bridge e superficies, sem prometer visual diff
  `,
        },
      ];
    }
  else {
    return null;
  }
  return arquivos;
}
