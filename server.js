
const express = require("express");

const app = express();

app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;

// Google की आधिकारिक सूची में मौजूद Stable मॉडल
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Health check
app.get("/", (req, res) => {
  res.json({
    status: "AI Super Assistant Backend Running",
    model: MODEL
  });
});

// Chat API
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

    let lastError = "Gemini API request failed";

    // Maximum 3 attempts
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          30000
        );

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
                    { text: message.trim() }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048
              }
            }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeout);
        }

        const data = await response.json();

        if (!response.ok) {
          const apiMessage =
            data.error?.message || "Gemini API error";

          lastError = apiMessage;

          // Retry only temporary overload/rate-limit errors
          const retryable =
            response.status === 503 ||
            response.status === 502 ||
            response.status === 504 ||
            (
              response.status === 429 &&
              !/quota_exceeded|daily quota/i.test(apiMessage)
            );

          if (retryable && attempt < 2) {
            const retryAfter = Number(
              response.headers.get("retry-after")
            );

            const delay = Number.isFinite(retryAfter) &&
              retryAfter > 0
              ? Math.min(retryAfter * 1000, 5000)
              : 1000 * (attempt + 1);

            await sleep(delay);
            continue;
          }

          return res.status(response.status).json({
            error: apiMessage,
            code: response.status
          });
        }

        const reply = data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("")
          .trim();

        if (!reply) {
          return res.status(502).json({
            error: "Gemini returned an empty response"
          });
        }

        return res.json({ reply });

      } catch (error) {
        lastError = error.name === "AbortError"
          ? "Gemini request timed out"
          : error.message;

        if (attempt < 2) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
      }
    }

    return res.status(503).json({
      error: "AI service temporarily unavailable",
      details: lastError
    });

  } catch (error) {
    console.error("Backend error:", error);

    return res.status(500).json({
      error: "Backend error",
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log("AI Super Assistant running on port " + PORT);
  console.log("Selected Gemini model: " + MODEL);
});
