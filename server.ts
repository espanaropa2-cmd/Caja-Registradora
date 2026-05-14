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

  // Proxy route for BCV Exchange Rate
  app.get("/api/tasa-bcv", async (req, res) => {
    const type = req.query.type === 'paralelo' ? 'paralelo' : 'oficial';
    
    try {
      // 1. DolarAPI (Uso prioritario como pidió el usuario)
      try {
        console.warn(`Trying DolarAPI for ${type}...`);
        const response = await fetch(`https://ve.dolarapi.com/v1/dolares/${type}`, {
          signal: AbortSignal.timeout(12000)
        });
        if (response.ok) {
          const data = await response.json();
          // El usuario especificó usar "promedio"
          if (data && data.promedio) return res.json({ rate: data.promedio, source: `dolarapi-${type}` });
        }
      } catch (e) {
        console.warn(`DolarAPI ${type} failed:`, e instanceof Error ? e.message : e);
      }

      // Si falló DolarAPI y el usuario quería BCV, intentamos el raspado directo y otros fallbacks
      if (type === 'oficial') {
        try {
          const response = await fetch('https://www.bcv.org.ve/', {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
              'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3'
            },
            signal: AbortSignal.timeout(15000)
          });
          
          if (response.ok) {
            const html = await response.text();
            const match = html.match(/id="dolar"[^>]*>.*?<strong>\s*([\d,.]+)\s*<\/strong>/s);
            if (match && match[1]) {
              const rate = parseFloat(match[1].replace(',', '.'));
              if (!isNaN(rate) && rate > 1) return res.json({ rate, source: 'bcv-direct' });
            }
          }
        } catch (e) {
          console.warn("BCV Direct scrape failed:", e instanceof Error ? e.message : e);
        }

        // CriptoDolar API (Backup para oficial)
        try {
          const response = await fetch('https://criptodolar.com/api/v1/latest?type=bcv', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(12000)
          });
          if (response.ok) {
            const data = await response.json();
            const bcvData = Array.isArray(data) ? data.find((i: any) => i.symbol === 'USD') : data;
            if (bcvData && bcvData.price) return res.json({ rate: bcvData.price, source: 'criptodolar' });
          }
        } catch (e) {
          console.warn("CriptoDolar failed:", e instanceof Error ? e.message : e);
        }
      }

      // Si falló el paralelo en DolarAPI, intentamos PyDolar como backup para paralelo o oficial
      try {
        const pyDolarTarget = type === 'paralelo' ? 'enparalelovzla' : 'bcv';
        const response = await fetch(`https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=${pyDolarTarget}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(12000)
        });
        if (response.ok) {
          const data = await response.json();
          const rate = data?.monitors?.usd?.price || data?.monitors?.bcv?.price || data?.monitors?.[pyDolarTarget]?.price;
          if (rate) return res.json({ rate: parseFloat(String(rate)), source: 'pydolar' });
        }
      } catch (e) {
        console.warn("PyDolar fallback failed:", e instanceof Error ? e.message : e);
      }

      // Final fallback
      return res.json({ 
        rate: type === 'paralelo' ? 44.50 : 36.55, 
        source: 'static-fallback', 
        warning: 'Live sources unavailable' 
      });

    } catch (globalError) {
      console.error('Critical failure in /api/tasa-bcv:', globalError);
      res.json({ rate: 36.55, error: 'Internal fetch error' });
    }
  });

  // Proxy route for legacy support
  app.get("/api/exchange-rate", async (req, res) => {
    try {
      const response = await fetch('https://ve.dolarapi.com/v1/dolares/bcv');
      if (response.ok) {
        const data = await response.json();
        res.json(data);
      } else {
        res.status(502).json({ error: 'Source returned error' });
      }
    } catch (error) {
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
