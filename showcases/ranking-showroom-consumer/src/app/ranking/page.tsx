import { semaFetchShowroomRanking } from "../../lib/sema_consumer_bridge";

export default async function RankingPage() {
  const payload = await semaFetchShowroomRanking();
  const ranking = Array.isArray(payload?.ranking) ? payload.ranking : [];

  return (
    <main>
      <h1>Ranking showroom</h1>
      <p>Consumer Next.js ligado ao showroom Flask via bridge semantico.</p>
      <ul>
        {ranking.map((item: { clube?: string; nome?: string; pontos?: number; score?: number }, indice: number) => (
          <li key={item.clube ?? item.nome ?? `ranking-${indice}`}>
            {item.clube ?? item.nome ?? "clube"} - {item.pontos ?? item.score ?? 0}
          </li>
        ))}
      </ul>
    </main>
  );
}
