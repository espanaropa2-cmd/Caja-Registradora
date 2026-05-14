import express from "express";
import path from "path";
import cors from "cors";
import axios from "axios";

// Allow fetching from sites with self-signed or incomplete certificates (like the BCV site)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Habilitar CORS para permitir peticiones desde apps móviles o web compiladas
  app.use(cors());
  app.use(express.json());

  // Proxy route for BCV Exchange Rate
  app.get("/api/tasa-bcv", async (req, res) => {
    const type = req.query.type === 'paralelo' ? 'paralelo' : 'oficial';
    const forceFallback = req.query.fallback === 'true';

    if (forceFallback) {
      return res.json({ rate: type === 'paralelo' ? 44.50 : 36.55, source: 'manual-fallback' });
    }
    
    try {
      // 1. DolarAPI (Uso prioritario)
      try {
        const url = `https://ve.dolarapi.com/v1/dolares/${type}`;
        console.log(`Fetching ${type} from DolarAPI...`);
        const response = await axios.get(url, { timeout: 8000 });
        if (response.data && response.data.promedio) {
          return res.json({ rate: response.data.promedio, source: `dolarapi-${type}` });
        }
      } catch (e) {
        console.warn(`DolarAPI ${type} failed:`, e instanceof Error ? e.message : 'Unknown error');
      }

      // 2. PyDolar Venezuela (Excelente para Paralelo)
      try {
        const pyDolarTarget = type === 'paralelo' ? 'enparalelovzla' : 'bcv';
        const url = `https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=${pyDolarTarget}`;
        console.log(`Fetching ${type} from PyDolar...`);
        const response = await axios.get(url, { 
          timeout: 8000,
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const rate = response.data?.monitors?.usd?.price || 
                     response.data?.monitors?.bcv?.price || 
                     response.data?.monitors?.[pyDolarTarget]?.price;
        
        if (rate) return res.json({ rate: parseFloat(String(rate)), source: 'pydolar' });
      } catch (e) {
        console.warn("PyDolar API failed:", e instanceof Error ? e.message : 'Unknown error');
      }

      // 3. BCV Direct Scrape (Solo para oficial)
      if (type === 'oficial') {
        try {
          console.log("Attempting BCV direct scrape...");
          const response = await axios.get('https://www.bcv.org.ve/', {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
          });
          const html = response.data;
          const match = html.match(/id="dolar"[^>]*>.*?<strong>\s*([\d,.]+)\s*<\/strong>/s);
          if (match && match[1]) {
            const rate = parseFloat(match[1].replace(',', '.'));
            if (!isNaN(rate) && rate > 1) return res.json({ rate, source: 'bcv-direct' });
          }
        } catch (e) {
          console.warn("BCV Scrape failed");
        }
      }

      // Final fallback
      console.warn(`All live sources failed for ${type}. Using static fallback.`);
      return res.json({ 
        rate: type === 'paralelo' ? 44.50 : 36.55, 
        source: 'static-fallback', 
        warning: 'Live sources unavailable' 
      });

    } catch (globalError) {
      console.error('Critical failure in /api/tasa-bcv:', globalError);
      res.json({ rate: type === 'paralelo' ? 44.50 : 36.55, error: 'Internal fetch error' });
    }
  });

  // Proxy route for legacy support
  app.get("/api/exchange-rate", async (req, res) => {
    try {
      const response = await axios.get('https://ve.dolarapi.com/v1/dolares/bcv', { timeout: 8000 });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch exchange rate' });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", environment: process.env.NODE_ENV });
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
    // SPA catch-all (Express 5 compatible)
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical failure during server startup:", err);
  process.exit(1);
});
