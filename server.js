require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const puppeteer = require("puppeteer");

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;

// Fetch rendered page content using Puppeteer
async function fetchPageHTML(url) {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    const html = await page.content();
    return html.slice(0, 15000);
  } catch (e) {
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

app.post("/api/messages", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: { message: "ANTHROPIC_API_KEY not set in environment." } });
  }
  try {
    // Extract the URL from the user message so we can fetch it
    const userMessage = req.body.messages?.[0]?.content || "";
    const urlMatch = userMessage.match(/URL:\s*(https?:\/\/\S+)/);
    const targetUrl = urlMatch?.[1];

    let body = req.body;

    if (targetUrl) {
      const html = await fetchPageHTML(targetUrl);
      if (html) {
        // Inject the HTML into the prompt
        const updatedContent = userMessage + `\n\nHere is the actual HTML of the page:\n\`\`\`html\n${html}\n\`\`\``;
        body = {
          ...req.body,
          tools: undefined, // remove web_search, we have the real HTML now
          messages: [{ role: "user", content: updatedContent }],
        };
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: { message: e.message } });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy running on http://localhost:${PORT}`));
