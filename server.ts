import express from "express";
import path from "path";
import cors from "cors";
import axios from "axios";
import nodemailer from "nodemailer";
import { sendBalanceEmail } from "./services/emailService.ts";

// Allow fetching from sites with self-signed or incomplete certificates (like the BCV site)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Habilitar CORS para permitir peticiones desde cualquier origen (necesario para apps móviles)
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  }));
  app.use(express.json());

  // Logging middleware for API diagnosis
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API Request] ${req.method} ${req.path} - Origin: ${req.get('origin') || 'no-origin'}`);
    }
    next();
  });

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
        const response = await axios.get(url, { 
          timeout: 8000,
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
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
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          }
        });
        
        let rate = 0;
        const data = response.data;
        if (data && data.monitors) {
          // Intentar encontrar el monitor específico o el primero disponible
          const monitor = data.monitors[pyDolarTarget] || data.monitors.usd || Object.values(data.monitors)[0];
          rate = monitor?.price || 0;
        } else if (data && data.price) {
          rate = data.price;
        }
        
        if (rate > 0) return res.json({ rate: parseFloat(String(rate)), source: 'pydolar' });
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

  // Health check y Diagnóstico
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      environment: process.env.NODE_ENV,
      time: new Date().toISOString(),
      headers: req.headers
    });
  });

  app.get("/api/test-connectivity", async (req, res) => {
    const results: any = {};
    const targets = [
      { name: 'DolarAPI', url: 'https://ve.dolarapi.com/v1/dolares/bcv' },
      { name: 'PyDolar', url: 'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv' },
      { name: 'Supabase', url: 'https://usntjpbyfzrnyksuqqut.supabase.co/rest/v1/' }
    ];

    for (const target of targets) {
      try {
        const start = Date.now();
        await axios.get(target.url, { timeout: 5000, headers: { 'apikey': 'test' } }).catch(e => {
          // Supabase will 401/400 but that means it's reachable
          if (e.response) return e.response;
          throw e;
        });
        results[target.name] = { status: 'reachable', latency: `${Date.now() - start}ms` };
      } catch (e) {
        results[target.name] = { status: 'failed', error: e instanceof Error ? e.message : String(e) };
      }
    }
    res.json(results);
  });

  // Route to send PDF report via email
  app.post("/api/send-report", async (req, res) => {
    const { email, pdfBase64, businessName, period } = req.body;

    if (!email || !pdfBase64) {
      return res.status(400).json({ error: "Email and PDF data are required" });
    }

    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_PORT === "465", // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: `Balance Operativo - ${businessName} (${period})`,
        text: `Hola,\n\nAdjuntamos el balance operativo de ${businessName} correspondiente al período: ${period}.\n\nGenerado el: ${new Date().toLocaleString()}\n\nSaludos,\nEquipo Caja Pro`,
        attachments: [
          {
            filename: `Balance_${businessName}_${period}.pdf`,
            content: pdfBase64.split("base64,")[1] || pdfBase64,
            encoding: "base64",
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: "Email sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Endpoint para enviar reporte profesional vía JSON
  app.post("/api/send-balance-pro", async (req, res) => {
    try {
      const { balanceData } = req.body;
      
      if (!balanceData || !balanceData.email) {
        return res.status(400).json({ error: "Datos del balance incompletos" });
      }

      await sendBalanceEmail(balanceData);
      res.json({ success: true, message: "Reporte enviado profesionalmente" });
    } catch (error) {
      console.error("Error en el servidor de correo:", error);
      res.status(500).json({ 
        error: "Error interno al enviar el correo",
        details: error instanceof Error ? error.message : "Error desconocido"
      });
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
