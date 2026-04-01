const String showroomApiUrl = String.fromEnvironment(
  "SHOWROOM_API_URL",
  defaultValue: "http://127.0.0.1:5000/api/ranking-showroom",
);

Future<Map<String, dynamic>> semaFetchShowroomRanking() async {
  return {
    "ranking": [
      {"clube": "Tigres do Norte", "pontos": 33},
      {"clube": "Porto Azul", "pontos": 31},
      {"clube": "Galo de Ouro", "pontos": 28},
    ],
    "fonte": showroomApiUrl,
  };
}
