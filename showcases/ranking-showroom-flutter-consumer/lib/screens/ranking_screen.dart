import "package:flutter/widgets.dart";

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
          .map((item) => Text("${item["clube"]} - ${item["pontos"]} pts"))
          .toList(),
    );
  }
}
