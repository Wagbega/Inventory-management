/**
 * Utility for robust printing and receipt export across browsers and iframe environments.
 */
import { ReceiptData, AppSettings } from '../types';

/**
 * Robustly print a target DOM container using a dedicated isolated iframe,
 * with fallback to window.print() if iframe access is restricted.
 */
export async function printElementById(
  elementId: string,
  title: string = 'Print Slip',
  format: 'thermal80' | 'a4' = 'thermal80'
): Promise<boolean> {
  const targetElement = document.getElementById(elementId);
  if (!targetElement) {
    console.warn(`[Print] Target element #${elementId} not found. Falling back to window.print()`);
    window.print();
    return false;
  }

  try {
    // Remove existing print iframe if any
    const existingIframe = document.getElementById('app-print-frame');
    if (existingIframe) {
      existingIframe.remove();
    }

    // Create a hidden isolated iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'app-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      throw new Error('Unable to access print iframe document');
    }

    const isThermal = format === 'thermal80';

    const printStyles = `
      @page {
        margin: ${isThermal ? '2mm 1mm' : '10mm'};
        size: ${isThermal ? '80mm auto' : 'auto'};
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: ${isThermal ? 'monospace, "Courier New", Courier' : 'system-ui, -apple-system, sans-serif'};
        font-size: ${isThermal ? '11px' : '12px'};
        line-height: ${isThermal ? '1.35' : '1.5'};
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .printable-receipt {
        width: 100% !important;
        max-width: ${isThermal ? '76mm' : '100%'} !important;
        margin: 0 auto !important;
        padding: ${isThermal ? '2mm 1mm' : '8mm'} !important;
        background: #ffffff !important;
        color: #000000 !important;
        box-shadow: none !important;
        border: none !important;
      }
      .printable-receipt * {
        color: #000000 !important;
      }
      .no-print {
        display: none !important;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 3px 2px;
      }
      .font-mono {
        font-family: monospace, "Courier New", Courier !important;
      }
      .font-bold, .font-extrabold {
        font-weight: 700 !important;
      }
      .text-right {
        text-align: right !important;
      }
      .text-center {
        text-align: center !important;
      }
      .border-b {
        border-bottom: 1px solid #000 !important;
      }
      .border-dashed {
        border-style: dashed !important;
      }
      .border-double {
        border-bottom: 3px double #000 !important;
      }
      .flex {
        display: flex !important;
      }
      .justify-between {
        justify-content: space-between !important;
      }
      .items-center {
        align-items: center !important;
      }
      .gap-2 {
        gap: 8px !important;
      }
      .space-y-1 > * + * {
        margin-top: 4px !important;
      }
      .space-y-2 > * + * {
        margin-top: 8px !important;
      }
      .space-y-3 > * + * {
        margin-top: 12px !important;
      }
    `;

    // Clone target node to avoid altering source
    const clone = targetElement.cloneNode(true) as HTMLElement;
    clone.style.maxWidth = isThermal ? '76mm' : '100%';
    clone.style.margin = '0 auto';
    clone.style.boxShadow = 'none';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>${printStyles}</style>
        </head>
        <body>
          ${clone.outerHTML}
        </body>
      </html>
    `);
    doc.close();

    // Wait briefly for assets / styles to settle before invoking print
    await new Promise((resolve) => setTimeout(resolve, 250));

    if (iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } else {
      window.print();
    }

    // Clean up iframe after print dialog completes
    setTimeout(() => {
      iframe.remove();
    }, 2000);

    return true;
  } catch (err) {
    console.warn('[Print] Iframe print failed, falling back to window.print()', err);
    window.print();
    return false;
  }
}

/**
 * Downloads a standalone, self-contained HTML voucher that can be opened and printed in any browser or sent to customers.
 */
export function downloadReceiptHtml(
  receipt: ReceiptData,
  settings: AppSettings,
  format: 'thermal80' | 'a4' = 'thermal80'
): void {
  const isThermal = format === 'thermal80';
  const currencySymbol = settings.currencySymbol || '₦';

  const rows = receipt.items
    .map(
      (it) => `
      <tr>
        <td style="padding: 3px 0; text-align: left;">${it.name} <br/><small style="color:#555;">${it.sku}</small></td>
        <td style="padding: 3px 0; text-align: center;">${it.quantity}</td>
        <td style="padding: 3px 0; text-align: right;">${currencySymbol}${it.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        <td style="padding: 3px 0; text-align: right; font-weight: bold;">${currencySymbol}${it.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
      </tr>`
    )
    .join('');

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt-${receipt.receiptNumber}</title>
  <style>
    @page { margin: ${isThermal ? '2mm' : '10mm'}; size: ${isThermal ? '80mm auto' : 'auto'}; }
    body {
      font-family: ${isThermal ? 'monospace, "Courier New", Courier' : 'system-ui, -apple-system, sans-serif'};
      font-size: ${isThermal ? '11px' : '13px'};
      line-height: 1.4;
      background: #f4f4f4;
      padding: 20px;
      margin: 0;
      display: flex;
      justify-content: center;
    }
    .receipt-card {
      background: #fff;
      color: #000;
      width: 100%;
      max-width: ${isThermal ? '320px' : '700px'};
      padding: ${isThermal ? '16px' : '32px'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      border: 1px solid #ddd;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    .double-divider { border-top: 3px double #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: inherit; }
    th { border-bottom: 1px solid #000; padding: 4px 0; text-align: left; }
    .row-meta { display: flex; justify-content: space-between; margin-bottom: 3px; }
    .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 1.15em; margin-top: 4px; }
    @media print {
      body { background: #fff; padding: 0; }
      .receipt-card { box-shadow: none; border: none; max-width: 100%; padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="text-center">
      <h2 style="margin: 0; font-size: 1.3em; text-transform: uppercase;">${receipt.companyName || settings.companyName}</h2>
      ${receipt.companyAddress ? `<p style="margin: 2px 0;">${receipt.companyAddress}</p>` : ''}
      ${receipt.companyPhone ? `<p style="margin: 2px 0;">TEL: ${receipt.companyPhone}</p>` : ''}
      ${receipt.taxId ? `<p style="margin: 2px 0;">TIN: ${receipt.taxId}</p>` : ''}
    </div>

    <div class="divider"></div>

    <div class="row-meta"><span>RECEIPT NO:</span><strong>${receipt.receiptNumber}</strong></div>
    <div class="row-meta"><span>DATE:</span><span>${new Date(receipt.date).toLocaleString()}</span></div>
    <div class="row-meta"><span>CASHIER:</span><span>${receipt.operator}</span></div>
    ${receipt.customerName ? `<div class="row-meta"><span>CUSTOMER:</span><span>${receipt.customerName}</span></div>` : ''}
    <div class="row-meta"><span>PAYMENT:</span><strong>${receipt.paymentMethod}</strong></div>

    <div class="divider"></div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Price</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="divider"></div>

    <div class="row-meta"><span>Subtotal:</span><span>${currencySymbol}${receipt.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
    ${receipt.discount > 0 ? `<div class="row-meta"><span>Discount:</span><span>-${currencySymbol}${receipt.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>` : ''}
    ${receipt.taxAmount > 0 ? `<div class="row-meta"><span>VAT (${receipt.taxRate}%):</span><span>${currencySymbol}${receipt.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>` : ''}
    
    <div class="double-divider"></div>
    <div class="total-row"><span>GRAND TOTAL:</span><span>${currencySymbol}${receipt.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
    <div class="row-meta" style="margin-top: 4px;"><span>Amount Paid:</span><span>${currencySymbol}${receipt.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
    <div class="row-meta"><span>Change Due:</span><span>${currencySymbol}${receipt.changeDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>

    <div class="divider"></div>

    <div class="text-center" style="margin-top: 10px; font-size: 0.9em;">
      <p style="margin: 3px 0;">${receipt.notes || settings.receiptFooterNote || 'Thank you for your business!'}</p>
      <small style="color: #666;">Generated via Apex Dynamics Logistics</small>
    </div>

    <div class="no-print" style="margin-top: 20px; text-align: center;">
      <button onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
        Print this Slip
      </button>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Receipt_${receipt.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
