import pdfParse from "pdf-parse";

const MAX_CHARS_PER_MANUAL = 20000;
const MAX_TOTAL_CHARS = 90000;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo non consentito" });
    return;
  }

  const { question, manuals } = req.body || {};
  if (!question || !Array.isArray(manuals) || manuals.length === 0) {
    res.status(400).json({ error: "Manca la domanda o non ci sono manuali caricati." });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "Manca la chiave ANTHROPIC_API_KEY sul server. Aggiungila nelle impostazioni del progetto su Vercel (Settings > Environment Variables) e rifai il deploy.",
    });
    return;
  }

  try {
    const texts = await Promise.all(
      manuals.slice(0, 6).map(async (m) => {
        try {
          const r = await fetch(m.url);
          if (!r.ok) throw new Error("download fallito");
          const arrayBuf = await r.arrayBuffer();
          const parsed = await pdfParse(Buffer.from(arrayBuf));
          return `--- Documento: "${m.name}" ---\n${parsed.text.slice(0, MAX_CHARS_PER_MANUAL)}`;
        } catch (e) {
          return `--- Documento: "${m.name}" ---\n(non è stato possibile leggere questo file)`;
        }
      })
    );

    const context = texts.join("\n\n").slice(0, MAX_TOTAL_CHARS);

    const prompt = `Sei un assistente che aiuta una famiglia a trovare informazioni pratiche nei manuali e negli schemi della loro barca a vela (manuale motore, schema elettrico, schema idraulico, ecc). Rispondi SOLO in base al contenuto dei documenti forniti qui sotto. Se l'informazione richiesta non è presente nei documenti, dillo chiaramente invece di inventare una risposta. Rispondi in italiano, in modo pratico, diretto e conciso, indicando se possibile da quale documento arriva l'informazione.

DOCUMENTI DISPONIBILI:
${context}

DOMANDA DELLA FAMIGLIA: ${question}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await aiRes.json();
    if (!aiRes.ok) {
      throw new Error(data?.error?.message || "Errore nella chiamata a Claude");
    }

    const answer =
      data.content?.map((c) => c.text || "").join("\n").trim() ||
      "Non sono riuscito a trovare una risposta nei documenti caricati.";

    res.status(200).json({ answer });
  } catch (e) {
    console.error("Errore ask-manual:", e);
    res.status(500).json({ error: "Non sono riuscito a leggere i manuali o a rispondere. Riprova." });
  }
}
