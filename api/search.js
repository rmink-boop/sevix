export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Mangler søkeord" });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const tmdbKey = process.env.TMDB_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: "API-nøkkel mangler" });

  const isRec = query.startsWith('__recommendations__');
  const cleanQuery = isRec ? query.replace('__recommendations__', '') : query;

  const prompt = isRec
    ? `Du er en ekspert på film og serier. Brukeren har nettopp søkt etter: ${cleanQuery}

Foreslå 6 andre titler de vil like basert på dette. Velg titler som faktisk finnes på norske strømmetjenester.

Svar KUN med et JSON-array. Format:
[
  {
    "title": "Tittel",
    "originalTitle": "Original hvis ulik",
    "type": "film" eller "show",
    "year": 2023,
    "imdb": 8.1,
    "genres": "Drama · Thriller",
    "reason": "Kort begrunnelse på maks 5 ord",
    "services": [{ "key": "netflix", "type": "flatrate" }]
  }
]

Gyldige service-nøkler: netflix, hbo, disney, apple, viaplay, tv2, nrk, prime, paramount, skyshowtime
Gyldige tilgangstyper: flatrate, free, ads, rent, buy
Svar kun med JSON.`
    : `Du er en ekspert på norske streamingtjenester. Brukeren søker etter: "${cleanQuery}"

Svar KUN med et JSON-array (ingen forklaring, ingen markdown). Finn de beste treffene (maks 4 resultater).

Format:
[
  {
    "title": "Tittel på norsk",
    "originalTitle": "Originaltittel hvis annerledes",
    "type": "film" eller "show",
    "year": 2023,
    "imdb": 8.2,
    "runtime": "2t 15min",
    "genres": "Drama · Thriller",
    "services": [
      { "key": "netflix", "type": "flatrate" },
      { "key": "prime", "type": "rent", "price": "49 NOK" }
    ]
  }
]

Gyldige service-nøkler: netflix, hbo, disney, apple, viaplay, tv2, nrk, prime, paramount, skyshowtime
Gyldige tilgangstyper: flatrate (inkludert i abo), free, ads, rent, buy

Bruk din kunnskap om hvilke norske streamingtjenester som faktisk har innholdet. Svar kun med JSON.`;

  try {
    // 1. Hent resultater fra Claude
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) return res.status(500).json({ error: aiData?.error?.message || "AI-feil" });

    const text = aiData.content?.map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
    const results = JSON.parse(text);

    // 2. Hent plakater fra TMDB for hvert resultat
    if (tmdbKey) {
      await Promise.all(results.map(async (item) => {
        try {
          const searchTitle = item.originalTitle || item.title;
          const mediaType = item.type === "show" ? "tv" : "movie";
          const tmdbRes = await fetch(
            `https://api.themoviedb.org/3/search/${mediaType}?query=${encodeURIComponent(searchTitle)}&language=no-NO&page=1`,
            { headers: { Authorization: `Bearer ${tmdbKey}`, "Content-Type": "application/json" } }
          );
          const tmdbData = await tmdbRes.json();
          const match = tmdbData.results?.[0];
          if (match?.poster_path) {
            item.poster = `https://image.tmdb.org/t/p/w300${match.poster_path}`;
          }
          // Hent også IMDB-score fra TMDB hvis vi ikke har den
          if (!item.imdb && match?.vote_average && match.vote_average > 0) {
            item.imdb = Math.round(match.vote_average * 10) / 10;
          }
        } catch (e) {
          // Plakat-henting feilet – fortsett uten plakat
        }
      }));
    }

    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: `Serverfeil: ${err.message}` });
  }
}
