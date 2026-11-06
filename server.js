
const express = require("express");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-3.5-flash-lite";

app.get("/", (req, res) => {
  res.json({
    status: "AI Super Assistant Backend Running",
    model: MODEL,
    googleSearch: "Disabled",
    mode: "Normal AI Chat"
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
              "You are AI Super Assistant. Reply in simple Hindi " +
              "unless the user uses another language. Be helpful, " +
              "accurate and clear. Do not pretend to have live " +
              "internet access.\n\n" + message.trim()
          }]
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
        error: data.error?.message || "Gemini API error",
        code: response.status
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini returned an empty response"
      });
    }

    return res.json({ reply });

  } catch (error) {
    console.error("Backend error:", error);

    return res.status(500).json({
      error: "Backend error",
      details: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("AI Super Assistant running on port " + PORT);
  console.log("Model: " + MODEL);
  console.log("Normal AI Chat Enabled");
});
