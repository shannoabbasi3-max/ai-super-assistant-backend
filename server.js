
const express = require("express");

const app = express();

app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

// Gemini model
const MODEL = "gemini-3.5-flash-lite";

const sleep = (ms) =>
  new Promise(resolve => setTimeout(resolve, ms));

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "AI Super Assistant Backend Running",
    model: MODEL,
    googleSearch: "Enabled"
  });
});

// AI Chat API
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

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 60000);

    let response;

    try {
      response = await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY
        },

        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    "You are AI Super Assistant. " +
                    "Reply in simple Hindi unless the user uses another language. " +
                    "Help with general knowledge, education, technology, coding, " +
                    "business, science and everyday questions. " +
                    "For latest news, current events, live information, prices, " +
                    "government updates and changing facts, use Google Search " +
                    "when useful. Never invent facts, links or sources. " +
                    "Clearly mention when information cannot be verified.\n\n" +
                    message.trim()
                }
              ]
            }
          ],

          tools: [
            {
              google_search: {}
            }
          ],

          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096
          }
        }),

        signal: controller.signal
      });

    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMessage =
        data.error?.message || "Gemini API request failed";

      console.error("Gemini API error:", errorMessage);

      return res.status(response.status).json({
        error: errorMessage,
        code: response.status
      });
    }

    const candidate = data.candidates?.[0];

    let reply = candidate?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini returned an empty response"
      });
    }

    // Google Search sources
    const chunks =
      candidate?.groundingMetadata?.groundingChunks || [];

    const sources = [];
    const seen = new Set();

    for (const chunk of chunks) {
      const web = chunk.web;

      if (web?.uri && !seen.has(web.uri)) {
        seen.add(web.uri);

        sources.push({
          title: web.title || "Google Search Source",
          url: web.uri
        });
      }
    }

    if (sources.length > 0) {
      reply += "\n\nGoogle Search Sources:\n";

      sources.forEach((source, index) => {
        reply +=
          `${index + 1}. ${source.title}\n${source.url}\n`;
      });
    }

    return res.json({
      reply: reply,
      model: MODEL,
      googleSearchUsed: sources.length > 0,
      sources: sources
    });

  } catch (error) {
    console.error("Backend error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "AI request timed out. Please try again."
      });
    }

    return res.status(500).json({
      error: "Backend server error",
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log("AI Super Assistant Backend Started");
  console.log("Model:", MODEL);
  console.log("Google Search: Enabled");
  console.log("Port:", PORT);
});
