import express from "express";
import path from "path";
import cors from "cors";
import axios from "axios";
import nodemailer from "nodemailer";
import { sendBalanceEmail, getSMTPConfig } from "./services/emailService.ts";
import { GoogleGenAI, Type } from "@google/genai";

// Allow fetching from sites with self-signed or incomplete certificates (like the BCV site)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

function getFriendlySMTPErrMsg(error: any): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) {
    const hostVal = process.env.SMTP_HOST || '';
    return `Error de conexión: El Host SMTP no pudo ser resuelto. Verifica el valor de 'SMTP_HOST' en los Ajustes de la plataforma (por ejemplo, debe ser 'smtp.gmail.com' en lugar de una dirección de correo como '${hostVal}').`;
  }
  if (msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
    return `Error de red: No se pudo conectar al servidor SMTP en el puerto ${process.env.SMTP_PORT || '587'}. Verifica si el puerto es el correcto.`;
  }
  if (msg.includes('Invalid login') || msg.includes('Authentication failed') || msg.includes('535')) {
    return "Error de credenciales: Nombre de usuario o contraseña incorrectos. Si usas Gmail u Outlook, recuerda que debes generar una 'Contraseña de Aplicación' (App Password) en la configuración de tu cuenta en lugar de ingresar tu contraseña personal habitual.";
  }
  return msg;
}

  // Route to send PDF report via email
  app.post("/api/send-report", async (req, res) => {
    const { email, pdfBase64, businessName, period } = req.body;

    if (!email || !pdfBase64) {
      return res.status(400).json({ error: "Email and PDF data are required" });
    }

    try {
      const { host, port, user, pass, from } = getSMTPConfig();
      
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });

      const mailOptions = {
        from: from || user,
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
      const friendlyDetails = getFriendlySMTPErrMsg(error);
      res.status(500).json({ error: "Failed to send email", details: friendlyDetails });
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
      const friendlyDetails = getFriendlySMTPErrMsg(error);
      res.status(500).json({ 
        error: friendlyDetails,
        details: friendlyDetails
      });
    }
  });

  // Lazy initialize Gemini client inside route handler to prevent startup crashes if key is missing
  let aiClient: any = null;
  function getGeminiClient() {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("No se ha configurado la variable de entorno GEMINI_API_KEY en la plataforma.");
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return aiClient;
  }

  // API Endpoint for AI Business Audits
  app.post("/api/analyze-business", async (req, res) => {
    try {
      const { products = [], sales = [], expenses = [] } = req.body;
      const client = getGeminiClient();

      const userPrompt = `Analiza los siguientes datos de un negocio en busca de errores en el registro de datos (ej. costos/precios en negativo, ventas con pérdidas involuntarias) e inconsistencias financieras, además de brindar sugerencias estratégicas.

PRODUCTOS REGISTRADOS EN INVENTARIO:
${JSON.stringify(products.map((p: any) => ({ name: p.name, price: p.price, cost: p.cost, stock: p.stock, category: p.category })), null, 2)}

VENTAS REGISTRADAS:
${JSON.stringify(sales.map((s: any) => ({ date: s.date, total: s.total, status: s.status, items: s.items?.map((it: any) => ({ name: it.name, price: it.price, quantity: it.quantity, cost: it.cost })) })), null, 2)}

EGRESOS (Gastos tradicionales registrados):
${JSON.stringify(expenses.map((e: any) => ({ description: e.description, amount: e.amount, category: e.category, date: e.date })), null, 2)}

Objetivos del análisis:
1. Errores de datos en el sistema:
   - Precios negativos o costos negativos.
   - Cantidades o existencias de stock sustancialmente incoherentes (como artículos con existencias en negativo, ej. -5, de forma prolongada).
   - Gastos tradicionales con importes negativos.
2. Incoherencias de margen y pérdidas:
   - Productos vendidos por un monto de venta inferior al costo unitario de compra guardado en la venta o en su ficha actual. Registra exactamente cuál producto y en qué venta.
   - Productos en el catálogo cuyo precio de venta al público (PVP) sea menor que su costo de compra unitario.
3. Descontrol u optimización:
   - Productos populares sin existencias (stock agotado).
   - Gastos duplicados o excesivos en el mismo mes.

Por favor, estructura la respuesta de acuerdo a la clase y esquema JSON provistos. Sé explícito al indicar en qué producto, qué fecha de venta o qué descripción de gasto se encuentra el error para que el usuario pueda localizarlo y corregirlo rápidamente.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: "Resumen general explicando detalladamente la sanidad y coherencia de los datos del negocio."
          },
          inconsistencies: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                type: { type: Type.STRING, description: "Puede ser: 'error' (datos inválidos como valores negativos) o 'warning' (potencial problema de rentabilidad)." },
                source: { type: Type.STRING, description: "Faro del dato: 'productos', 'ventas', o 'gastos'." },
                location: { type: Type.STRING, description: "Especifica exactamente dónde localizarlo. Ej: Producto 'Refresco', Gasto 'Flete de abril', Venta del '21/05/2026'." },
                description: { type: Type.STRING, description: "Descripción completa y detallada de la incoherencia encontrada." },
                suggestion: { type: Type.STRING, description: "Sugerencia específica de cómo puede solventar este error." }
              },
              required: ["id", "type", "source", "location", "description", "suggestion"]
            }
          },
          tips: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING, description: "Categoría de optimización: 'inventario', 'ventas', 'gastos', u 'otros'." },
                title: { type: Type.STRING, description: "Título directo y accionable." },
                text: { type: Type.STRING, description: "Explicación de la recomendación para el negocio." }
              },
              required: ["category", "title", "text"]
            }
          }
        },
        required: ["summary", "inconsistencies", "tips"]
      };

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: userPrompt,
        config: {
          systemInstruction: "Eres un Auditor Financiero y Asesor de Negocios experto en Pymes. Analizas bases de datos para encontrar errores de inserción de datos (como precios inválidos) y dar recomendaciones de rentabilidad.",
          responseMimeType: "application/json",
          responseSchema,
        }
      });

      const text = response.text || "{}";
      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("Error in AI analysis:", error);
      res.status(500).json({ 
        error: error.message || "No se pudo completar el análisis del negocio por inteligencia artificial. Verifica tus claves de API." 
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
