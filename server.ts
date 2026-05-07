import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Allow fetching from sites with self-signed or incomplete certificates (like the BCV site)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Proxy route for BCV Exchange Rate (Scraping from official site)
  app.get("/api/tasa-bcv", async (req, res) => {
    try {
      const response = await fetch('https://www.bcv.org.ve/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      if (!response.ok) throw new Error(`BCV returned status: ${response.status}`);
      const html = await response.text();
      
      // Regex para buscar el valor dentro de <div id="dolar"><strong>
      const match = html.match(/<div id="dolar"[^>]*>.*?<strong>\s*([\d,.]+)\s*<\/strong>/s);
      
      if (match && match[1]) {
        const rate = parseFloat(match[1].replace(',', '.'));
        res.json({ rate: rate });
      } else {
        // Fallback to the other API if scraping fails
        console.warn("Scraping failed, falling back to backup API");
        const fallbackResponse = await fetch('https://bcv-api.rafnixg.dev/rates/');
        const data = await fallbackResponse.json();
        const rate = data.Dollar || data.USD || (data.rates && (data.rates.Dollar || data.rates.USD));
        if (rate) {
           res.json({ rate: typeof rate === 'string' ? parseFloat(rate.replace(',', '.')) : rate });
        } else {
           throw new Error("Could not find rate in html or fallback API");
        }
      }
    } catch (error) {
      console.error('Error in /api/tasa-bcv:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch rate' });
    }
  });

  // Proxy route for the backup API (keeping it as legacy/fallback if needed)
  app.get("/api/exchange-rate", async (req, res) => {
    try {
      const response = await fetch('https://bcv-api.rafnixg.dev/rates/');
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching exchange rate from proxy:', error);
      res.status(500).json({ error: 'Failed to fetch exchange rate' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
