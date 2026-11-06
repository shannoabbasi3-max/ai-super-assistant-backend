
const express = require("express");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash-lite";

app.get("/", (req, res) => {
  res.json({
    status: "AI Super Assistant Running",
    model: MODEL,
    googleSearch: "Enabled"
  });
});

app.post("/chat", async (req, res) => {
  try {
    const message = req.body?.message;

    if (!API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY missing in Render"
      });
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Please enter a message"
      });
    }

    if (message.length > 20000) {
      return res.status(400).json({
        error: "Message is too long"
      });
    }

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{
            text:
              "You are AI Super Assistant. Answer in simple Hindi or the user's language. " +
              "For current facts, news, prices, government schemes, technology, sports " +
              "and information that may have changed, use Google Search when useful. " +
              "Give accurate answers and do not invent facts or sources.\n\n" +
              message.trim()
          }]
        }],
        tools: [{
          google_search_retrieval: {
            dynamic_retrieval_config: {
              mode: "MODE_DYNAMIC",
              dynamic_threshold: 0.3
            }
          }
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Gemini API error"
      });
    }

    const candidate = data.candidates?.[0];

    let reply = candidate?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "AI returned an empty response"
      });
    }

    const chunks =
      candidate?.groundingMetadata?.groundingChunks || [];

    const sources = [];
    const seen = new Set();

    for (const chunk of chunks) {
      const web = chunk.web;

      if (web?.uri && !seen.has(web.uri)) {
        seen.add(web.uri);
        sources.push({
          title: web.title || "Source",
          url: web.uri
        });
      }
    }

    if (sources.length > 0) {
      reply += "\n\nGoogle Search Sources:\n";
      sources.forEach((source, index) => {
        reply += `${index + 1}. ${source.title}\n${source.url}\n`;
      });
    }

    return res.json({ reply });

  } catch (error) {
    console.error("Chat error:", error);

    return res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("AI Super Assistant running on port " + PORT);
  console.log("Model: " + MODEL);
  console.log("Google Search: Enabled");
});
