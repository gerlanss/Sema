import { useEffect, useState } from "react";
import { semaFetchShowroomRanking } from "../lib/sema_consumer_bridge";

export function RankingPage() {
  const [ranking, setRanking] = useState<Array<{ clube?: string; nome?: string; pontos?: number; score?: number }>>([]);

  useEffect(() => {
    void semaFetchShowroomRanking().then((payload) => setRanking(payload.ranking ?? []));
  }, []);

  return (
    <main>
      <h1>Ranking showroom</h1>
      <ul>
        {ranking.map((item, indice) => (
          <li key={item.clube ?? item.nome ?? `ranking-${indice}`}>
            {item.clube ?? item.nome ?? "clube"} - {item.pontos ?? item.score ?? 0}
          </li>
        ))}
      </ul>
    </main>
  );
}
