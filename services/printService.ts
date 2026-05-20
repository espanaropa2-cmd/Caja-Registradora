import { Sale, UserProfile, PaymentMethod } from '../types';

interface RateDetails {
  rate: number;
  useParallelRate?: boolean;
  showTriplePrice?: boolean;
  officialRate?: number;
  parallelRate?: number;
}

export const printThermalReceipt = (
  sale: Sale,
  clientName: string,
  profile: UserProfile | null,
  rates: RateDetails
) => {
  // Prevent run on non-browser environments just in case
  if (typeof window === 'undefined') return;

  const businessName = profile?.businessName || 'Caja Registradora';
  const alias = profile?.alias || '';
  const contactPhone = profile?.contactPhone || '';
  const email = profile?.email || '';

  // Get invoice number/id
  const shortId = sale.id.slice(0, 8).toUpperCase();
  const dateStr = new Date(sale.date).toLocaleDateString();
  const timeStr = new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Exhange conversions
  const conversionRate = rates.rate || 1;
  const totalVES = sale.total * conversionRate;

  // Payments details
  const primaryPayment = sale.payments && sale.payments.length > 0 ? sale.payments[0] : null;
  const paymentMethodStr = primaryPayment ? primaryPayment.method : (sale.payments && sale.payments[1]?.method || 'EFECTIVO');
  const paymentRefStr = primaryPayment?.reference ? `#${primaryPayment.reference}` : '';

  // Determine currency based on payment method
  const isBsOnly = paymentMethodStr === PaymentMethod.PUNTO || paymentMethodStr === PaymentMethod.PAGOMOVIL;

  // Calculate items details HTML literal
  const itemsHTML = sale.items.map(item => {
    const priceToShow = isBsOnly ? item.price * conversionRate : item.price;
    const subtotalToShow = isBsOnly ? (item.price * item.quantity) * conversionRate : item.price * item.quantity;
    const currencySign = isBsOnly ? 'Bs. ' : '$';
    return `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #444; margin-top: 2px;">
          <span>${item.quantity} x ${currencySign}${priceToShow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span style="font-weight: bold; color: #000;">${currencySign}${subtotalToShow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    `;
  }).join('');

  // Create document body for the printable iframe
  const receiptHTML = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Factura Nº ${shortId}</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0;
            padding: 0;
            width: 80mm;
          }
          /* Hide non-printable items */
          .no-print {
            display: none !important;
          }
        }
        body {
          width: 72mm; /* standard printer printable area for 80mm paper */
          margin: 0 auto;
          padding: 10px 2px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          color: #000;
          background-color: #fff;
          line-height: 1.3;
        }
        .text-center {
          text-align: center;
        }
        .text-right {
          text-align: right;
        }
        .header {
          margin-bottom: 12px;
          border-bottom: 1px dashed #000;
          padding-bottom: 10px;
        }
        .store-name {
          font-size: 16px;
          font-weight: bold;
          text-transform: uppercase;
          margin: 0 0 4px 0;
          letter-spacing: 0.5px;
        }
        .store-info {
          font-size: 11px;
          color: #333;
          margin: 2px 0;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 8px 0;
        }
        .double-divider {
          border-top: 2px double #000;
          margin: 10px 0;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 3px;
        }
        .info-label {
          color: #555;
        }
        .items-header {
          font-weight: bold;
          font-size: 11px;
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          border-bottom: 1px dashed #000;
          padding-bottom: 4px;
        }
        .totals-section {
          margin-top: 10px;
          font-size: 12px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .grand-total {
          font-size: 14px;
          font-weight: bold;
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 6px 0;
          margin: 6px 0;
        }
        .footer {
          margin-top: 20px;
          font-size: 10px;
          color: #444;
          text-align: center;
          border-top: 1px dashed #000;
          padding-top: 10px;
        }
        .watermark {
          font-size: 9px;
          letter-spacing: 1px;
          opacity: 0.5;
          margin-top: 8px;
        }
      </style>
    </head>
    <body>
      <div class="header text-center">
        <h1 class="store-name">${businessName}</h1>
        ${alias ? `<div class="store-info">Alias/Rif: ${alias}</div>` : ''}
        ${contactPhone ? `<div class="store-info">Telf: ${contactPhone}</div>` : ''}
        ${email ? `<div class="store-info">Email: ${email}</div>` : ''}
        <div style="font-size: 10px; margin-top: 6px; font-weight: bold;">-- COMPROBANTE DE COMPRA --</div>
      </div>

      <div class="info-section">
        <div class="info-row">
          <span class="info-label">FACTURA Nº:</span>
          <span style="font-weight: bold;">${shortId}</span>
        </div>
        <div class="info-row">
          <span class="info-label">FECHA:</span>
          <span>${dateStr} ${timeStr}</span>
        </div>
        <div class="info-row">
          <span class="info-label">CLIENTE:</span>
          <span style="font-weight: bold; text-transform: uppercase;">${clientName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">ESTADO:</span>
          <span>${sale.status === 'COMPLETED' ? 'PAGADO(CONTADO)' : 'VENTA A CRÉDITO'}</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="items-section">
        <div class="items-header">
          <span>DESCRIPCIÓN / CANT x PRECIO</span>
          <span>TOTAL</span>
        </div>
        
        ${itemsHTML}
      </div>

      <div class="double-divider"></div>

      <div class="totals-section">
        ${isBsOnly ? `
          <div class="total-row">
            <span>SUBTOTAL BS:</span>
            <span>Bs. ${totalVES.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          
          <div class="grand-total total-row">
            <span>TOTAL BS:</span>
            <span>Bs. ${totalVES.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div class="info-row" style="margin-top: 4px;">
            <span class="info-label">MÉT. PAGO:</span>
            <span style="font-weight: bold;">${paymentMethodStr} ${paymentRefStr}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">MONTO PAGADO BS:</span>
            <span>Bs. ${(sale.amountPaid * conversionRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          ${sale.status === 'CREDIT' ? `
            <div class="info-row" style="color: #ff0000; font-weight: bold;">
              <span class="info-label">SALDO DEUDOR BS:</span>
              <span>Bs. ${((sale.total - sale.amountPaid) * conversionRate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ` : ''}
        ` : `
          <div class="total-row">
            <span>SUBTOTAL USD:</span>
            <span>$${sale.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div class="grand-total total-row">
            <span>TOTAL USD:</span>
            <span>$${sale.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div class="info-row" style="margin-top: 4px;">
            <span class="info-label">MÉT. PAGO:</span>
            <span style="font-weight: bold;">${paymentMethodStr} ${paymentRefStr}</span>
          </div>
          
          <div class="info-row">
            <span class="info-label">MONTO PAGADO:</span>
            <span>$${sale.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          ${sale.status === 'CREDIT' ? `
            <div class="info-row" style="color: #ff0000; font-weight: bold;">
              <span class="info-label">SALDO DEUDOR:</span>
              <span>$${(sale.total - sale.amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ` : ''}
        `}
      </div>

      <div class="footer">
        <p>*** GRACIAS POR SU COMPRA ***</p>
        <p style="margin-top: 4px;">Este documento es un comprobante de control interno sin validez legal fiscal directa.</p>
        <div class="watermark text-center">TECNOLOGÍA CAJA REGISTRADORA</div>
      </div>
    </body>
    </html>
  `;

  // Create temporary hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(receiptHTML);
    iframeDoc.close();

    // Small delay to allow CSS & DOM rendering before printing
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Clean up the iframe after triggering print (give standard buffer)
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 60000); // long buffer to prevent issues during slow print queues
    }, 500);
  }
};
