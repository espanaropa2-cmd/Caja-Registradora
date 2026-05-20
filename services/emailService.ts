
import nodemailer from 'nodemailer';

interface BalanceData {
  businessName: string;
  email: string;
  period: string;
  stats: {
    revenue: number;
    totalExpenses: number;
    profit: number;
    pending: number;
    realCash?: number;
  };
  incomeRows: any[];
  expenseRows: any[];
}

export const generateBalanceHTML = (data: BalanceData) => {
  const { businessName, period, stats, incomeRows, expenseRows } = data;
  const dateStr = new Date().toLocaleString('es-VE', { dateStyle: 'full', timeStyle: 'short' });

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc; }
        .wrapper { max-width: 650px; margin: 20px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
        .header { background: #0f172a; color: #ffffff; padding: 40px; text-align: left; border-bottom: 4px solid #3b82f6; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; }
        .header p { margin: 8px 0 0; color: #3b82f6; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
        
        .content { padding: 40px; }
        
        .grid { display: table; width: 100%; border-spacing: 8px; margin-bottom: 30px; table-layout: fixed; }
        .grid-item { display: table-cell; background: #f1f5f9; padding: 12px 6px; border-radius: 12px; text-align: center; }
        .grid-label { font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 5px; white-space: nowrap; }
        .grid-value { font-size: 14px; font-weight: 900; }
 
        .section-title { font-size: 12px; font-weight: 900; text-transform: uppercase; color: #0f172a; border-left: 4px solid #3b82f6; padding-left: 10px; margin: 30px 0 15px; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
        th { text-align: left; padding: 12px; background: #f8fafc; color: #64748b; font-weight: 800; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
        
        .footer { padding: 30px; background: #f8fafc; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 900; }
        .badge-income { background: #dcfce7; color: #166534; }
        .badge-expense { background: #fee2e2; color: #991b1b; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <h1>${businessName}</h1>
          <p>Reporte de Balance Operativo - ${period.toUpperCase()}</p>
        </div>
        
        <div class="content">
          <div class="grid">
            <div class="grid-item">
              <div class="grid-label">Ingresos</div>
              <div class="grid-value" style="color: #2563eb;">$${stats.revenue.toLocaleString()}</div>
            </div>
            <div class="grid-item">
              <div class="grid-label">Egresos</div>
              <div class="grid-value" style="color: #dc2626;">$${stats.totalExpenses.toLocaleString()}</div>
            </div>
            <div class="grid-item" style="background: #ecfdf5; border: 1px solid #a7f3d0;">
              <div class="grid-label" style="color: #065f46;">Efec. Caja</div>
              <div class="grid-value" style="color: #047857;">$${(stats.realCash !== undefined ? stats.realCash : stats.profit).toLocaleString()}</div>
            </div>
            <div class="grid-item">
              <div class="grid-label">Utilidad</div>
              <div class="grid-value" style="color: #059669;">$${stats.profit.toLocaleString()}</div>
            </div>
            <div class="grid-item">
              <div class="grid-label">Por Cobrar</div>
              <div class="grid-value" style="color: #d97706;">$${stats.pending.toLocaleString()}</div>
            </div>
          </div>

          <div class="section-title">Últimas Ventas (Ingresos)</div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${incomeRows.length > 0 ? incomeRows.map(row => `
                <tr>
                  <td>${row.date}</td>
                  <td>${row.client}</td>
                  <td style="text-align: right; font-weight: bold;">$${row.total.toLocaleString()}</td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="text-align: center; color: #94a3b8;">No hay registros</td></tr>'}
            </tbody>
          </table>

          <div class="section-title">Últimos Gastos (Egresos)</div>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th style="text-align: right;">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${expenseRows.length > 0 ? expenseRows.map(row => `
                <tr>
                  <td>${row.date}</td>
                  <td>${row.description}</td>
                  <td style="text-align: right; color: #dc2626; font-weight: bold;">$${row.amount.toLocaleString()}</td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="text-align: center; color: #94a3b8;">No hay registros</td></tr>'}
            </tbody>
          </table>
        </div>
        
        <div class="footer">
          Este es un reporte automático generado por **Caja Pro**.<br>
          Generado el ${dateStr} para el negocio: ${businessName}
        </div>
      </div>
    </body>
    </html>
  `;
};

export function getSMTPConfig() {
  const cleanEnv = (val: string | undefined): string => {
    if (!val) return '';
    let s = val.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      s = s.slice(1, -1).trim();
    }
    if (s.startsWith("'") && s.endsWith("'")) {
      s = s.slice(1, -1).trim();
    }
    return s;
  };

  let host = cleanEnv(process.env.SMTP_HOST);
  let portStr = cleanEnv(process.env.SMTP_PORT);
  let port = parseInt(portStr || '587');
  let user = cleanEnv(process.env.SMTP_USER);
  let pass = cleanEnv(process.env.SMTP_PASS);
  let from = cleanEnv(process.env.SMTP_FROM || user);

  // Sanitize host if the user entered an email address as the host by mistake
  if (host.includes('@')) {
    const domain = host.split('@')[1];
    if (domain === 'gmail.com') {
      host = 'smtp.gmail.com';
    } else if (domain === 'hotmail.com' || domain === 'live.com') {
      host = 'smtp.office365.com';
    } else if (domain === 'outlook.com') {
      host = 'smtp-mail.outlook.com';
    } else if (domain === 'yahoo.com') {
      host = 'smtp.mail.yahoo.com';
    } else {
      host = `smtp.${domain}`;
    }
  }

  // Also verify user: if SMTP_HOST is totally empty but SMTP_USER is set to an email, fallback gracefully
  if (!host && user.includes('@')) {
    const domain = user.split('@')[1];
    if (domain === 'gmail.com') {
      host = 'smtp.gmail.com';
    } else if (domain === 'hotmail.com' || domain === 'live.com') {
      host = 'smtp.office365.com';
    } else if (domain === 'outlook.com') {
      host = 'smtp-mail.outlook.com';
    } else if (domain === 'yahoo.com') {
      host = 'smtp.mail.yahoo.com';
    } else {
      host = `smtp.${domain}`;
    }
  }

  // Default fallback if still empty
  if (!host) {
    host = 'smtp.gmail.com';
  }

  if (!port || isNaN(port)) {
    port = host === 'smtp.gmail.com' ? 587 : 587;
  }

  return { host, port, user, pass, from };
}

export const sendBalanceEmail = async (data: BalanceData) => {
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

  const html = generateBalanceHTML(data);

  return transporter.sendMail({
    from: from || user,
    to: data.email,
    subject: `Balance Operativo: ${data.businessName} - p. ${data.period}`,
    html: html,
  });
};
