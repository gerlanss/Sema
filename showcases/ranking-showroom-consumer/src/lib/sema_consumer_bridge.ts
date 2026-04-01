const SHOWROOM_API_URL = process.env.SHOWROOM_API_URL ?? "http://127.0.0.1:5000/api/ranking-showroom";

export async function semaFetchShowroomRanking() {
  const response = await fetch(SHOWROOM_API_URL, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Falha ao carregar ranking showroom: ${response.status}`);
  }

  return response.json();
}
