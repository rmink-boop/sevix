export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query } = req.body;
  if (!query) return res.status(400).json({ error: "Mangler søkeord" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API-nøkkel mangler i miljøvariabler" });

  const prompt = `Du er en ekspert på norske streamingtjenester. Brukeren søker etter: "${query}"

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
    "poster": null,
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
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const raw = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: `Anthropic feil: ${raw?.error?.message || JSON.stringify(raw)}` });
    }

    const text = raw.content?.map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
    const results = JSON.parse(text);
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: `Serverfeil: ${err.message}` });
  }
}
