/**
 * Utility for robust printing and receipt/voucher export across browsers and iframe environments.
 */
import { ReceiptData, AppSettings, SalesRepDispatch } from '../types';
import { generateBarcodeBars } from './barcode';

/**
 * Robustly print any HTML string in a hidden, non-zero iframe offscreen.
 * Avoids browser bugs where visibility: hidden or width: 0 produces blank pages in Chromium/Electron.
 */
export function printHtml(html: string, title: string = 'Print Slip'): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Remove any leftover print iframe
      const existingIframe = document.getElementById('app-print-frame');
      if (existingIframe) {
        existingIframe.remove();
      }

      // Create a hidden isolated iframe
      // CRITICAL FOR CHROMIUM / ELECTRON:
      // NEVER use visibility: hidden, display: none, or width/height: 0.
      // Chromium skips painting elements if the frame is marked hidden or zero-size.
      const iframe = document.createElement('iframe');
      iframe.id = 'app-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '-9999px';
      iframe.style.width = '1024px';
      iframe.style.height = '1400px';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      iframe.style.zIndex = '-9999';
      iframe.setAttribute('aria-hidden', 'true');
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        console.warn('[Print] Could not access iframe document, fallback to window.print()');
        window.print();
        resolve(false);
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      const doPrint = () => {
        try {
          if (iframe.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            resolve(true);
          } else {
            window.print();
            resolve(false);
          }
        } catch (err) {
          console.warn('[Print] Failed to trigger iframe.print(), fallback to window.print()', err);
          window.print();
          resolve(false);
        }
      };

      // Allow DOM, fonts, and images to layout
      setTimeout(doPrint, 350);

      const cleanup = () => {
        try {
          if (document.body.contains(iframe)) {
            iframe.remove();
          }
        } catch (_) {}
      };

      if (iframe.contentWindow) {
        iframe.contentWindow.onafterprint = cleanup;
      }
      setTimeout(cleanup, 120000); // 2 minutes safety fallback
    } catch (err) {
      console.warn('[Print] Exception during printHtml, falling back to window.print()', err);
      window.print();
      resolve(false);
    }
  });
}

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

  const isThermal = format === 'thermal80';

  // Inherit existing stylesheet tags from parent document so Tailwind/custom styles work
  const headStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join('\n');

  const printStyles = `
    @page {
      margin: ${isThermal ? '2mm 1mm' : '8mm'};
      size: ${isThermal ? '80mm auto' : 'auto'};
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: ${isThermal ? 'monospace, "Courier New", Courier' : 'system-ui, -apple-system, sans-serif'} !important;
      font-size: ${isThermal ? '11px' : '12px'};
      line-height: ${isThermal ? '1.35' : '1.5'};
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .printable-receipt,
    .printable-dispatch-slip,
    .printable-area,
    #printable-receipt-container,
    #printable-dispatch-slip {
      width: 100% !important;
      max-width: ${isThermal ? '76mm' : '100%'} !important;
      margin: 0 auto !important;
      padding: ${isThermal ? '2mm 1mm' : '8mm 6mm'} !important;
      background: #ffffff !important;
      color: #000000 !important;
      box-shadow: none !important;
      border: none !important;
      visibility: visible !important;
      display: block !important;
    }
    .printable-receipt *,
    .printable-dispatch-slip *,
    .printable-area *,
    #printable-receipt-container *,
    #printable-dispatch-slip * {
      color: #000000 !important;
      visibility: visible !important;
    }
    .no-print {
      display: none !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
    }
    th, td {
      padding: 3px 2px;
    }
    .font-mono {
      font-family: monospace, "Courier New", Courier !important;
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
  `;

  // Clone target node to avoid altering source
  const clone = targetElement.cloneNode(true) as HTMLElement;
  clone.style.maxWidth = isThermal ? '76mm' : '100%';
  clone.style.margin = '0 auto';
  clone.style.boxShadow = 'none';

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        ${headStyles}
        <style>${printStyles}</style>
      </head>
      <body>
        ${clone.outerHTML}
      </body>
    </html>
  `;

  return printHtml(fullHtml, title);
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
      color: #000;
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
      <h2 style="margin: 0; font-size: 1.3em; text-transform: uppercase;">${receipt.companyName || settings.companyName || 'INVENTORY MANAGEMENT'}</h2>
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
      ${receipt.showMemo !== false ? `<p style="margin: 3px 0; font-weight: 500;">${receipt.notes || settings.receiptFooterNote || 'Thank you for your business! Goods sold in good condition are covered by standard warranty.'}</p>` : ''}
      <small style="color: #666;">Validated &bull; Windows Inventory Management</small>
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

/**
 * Generates pristine, self-contained HTML for Field Sales Rep Dispatches and Return Settlement Vouchers.
 */
export function generateDispatchSlipHtml(
  dispatch: SalesRepDispatch,
  settings: AppSettings,
  format: 'thermal80' | 'a4' = 'a4'
): string {
  const isThermal = format === 'thermal80';
  const currency = settings.currencySymbol || '₦';
  const isActive = dispatch.status === 'active';

  // Generate vector SVG barcode
  const barcodeBars = generateBarcodeBars(dispatch.dispatchNumber || 'DSP-001');
  const barcodeRects = barcodeBars
    .map((isBar, idx) => (isBar ? `<rect x="${idx * 2}" y="0" width="2" height="34" fill="#000000" />` : ''))
    .join('');
  const barcodeSvg = `
    <div style="text-align: center; margin: 6px 0;">
      <svg style="display: inline-block; height: 32px; width: ${Math.min(barcodeBars.length * 2, 220)}px;" viewBox="0 0 ${barcodeBars.length * 2} 34">
        ${barcodeRects}
      </svg>
      <div style="font-family: monospace; font-size: 11px; font-weight: bold; letter-spacing: 2px;">
        ${dispatch.dispatchNumber}
      </div>
    </div>
  `;

  // Item table rows
  const itemRows = dispatch.items
    .map(
      (it) => `
      <tr>
        <td style="padding: 4px 2px; text-align: left; border-bottom: 1px solid #ddd;">
          <strong>${it.name}</strong><br/>
          <small style="color: #555; font-family: monospace;">${it.sku}</small>
        </td>
        <td style="padding: 4px 2px; text-align: center; border-bottom: 1px solid #ddd; font-weight: bold;">
          ${it.quantityTaken} ${it.unit}
        </td>
        <td style="padding: 4px 2px; text-align: right; border-bottom: 1px solid #ddd; font-family: monospace;">
          ${currency}${it.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </td>
        <td style="padding: 4px 2px; text-align: right; border-bottom: 1px solid #ddd; font-weight: bold; font-family: monospace;">
          ${currency}${it.totalValueTaken.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </td>
        ${
          !isActive
            ? `
          <td style="padding: 4px 2px; text-align: center; border-bottom: 1px solid #ddd; color: #dc2626; font-family: monospace; font-weight: bold;">
            ${it.quantityReturned || 0} ${it.unit}
          </td>
          <td style="padding: 4px 2px; text-align: center; border-bottom: 1px solid #ddd; color: #16a34a; font-family: monospace; font-weight: bold;">
            ${it.quantitySold || 0} ${it.unit}
          </td>
          <td style="padding: 4px 2px; text-align: right; border-bottom: 1px solid #ddd; color: #16a34a; font-family: monospace; font-weight: bold;">
            ${currency}${(it.totalValueSold || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </td>
        `
            : ''
        }
      </tr>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dispatch_${dispatch.dispatchNumber}</title>
  <style>
    @page {
      margin: ${isThermal ? '2mm 1mm' : '8mm'};
      size: ${isThermal ? '80mm auto' : 'auto'};
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: ${isThermal ? 'monospace, "Courier New", Courier' : 'system-ui, -apple-system, sans-serif'};
      font-size: ${isThermal ? '11px' : '12px'};
      line-height: 1.4;
      background: #f4f4f4;
      padding: ${isThermal ? '4px' : '20px'};
      margin: 0;
      display: flex;
      justify-content: center;
      color: #000000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .slip-card {
      background: #ffffff;
      color: #000000;
      width: 100%;
      max-width: ${isThermal ? '320px' : '720px'};
      padding: ${isThermal ? '12px 10px' : '28px'};
      box-shadow: 0 4px 14px rgba(0,0,0,0.08);
      border: 1px solid #ccc;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .divider { border-top: 1px dashed #000000; margin: 8px 0; }
    .double-divider { border-top: 3px double #000000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: inherit; }
    th { border-bottom: 2px solid #000000; padding: 4px 2px; text-align: left; }
    .row-meta { display: flex; justify-content: space-between; margin-bottom: 3.5px; font-size: 0.95em; }
    .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; margin-top: 4px; }
    @media print {
      body { background: #ffffff !important; padding: 0 !important; }
      .slip-card { box-shadow: none !important; border: none !important; max-width: 100% !important; padding: ${isThermal ? '2mm 1mm' : '4mm'} !important; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="slip-card">
    <div class="text-center">
      ${
        settings.customLogoUrl
          ? `<img src="${settings.customLogoUrl}" alt="Logo" style="max-height: 44px; max-width: 160px; object-fit: contain; margin-bottom: 4px;" />`
          : ''
      }
      <h2 style="margin: 0; font-size: 1.25em; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">
        ${settings.companyName || 'APEX LOGISTICS & INVENTORY'}
      </h2>
      ${settings.companyAddress ? `<p style="margin: 2px 0; font-size: 0.9em;">${settings.companyAddress}</p>` : ''}
      <p style="margin: 2px 0; font-size: 0.88em;">
        ${settings.companyPhone ? `Tel: ${settings.companyPhone}` : ''}
        ${settings.taxId ? ` • TIN: ${settings.taxId}` : ''}
      </p>
      <div style="display: inline-block; margin-top: 6px; padding: 3px 8px; background: #e5e7eb; border: 1px solid #000; font-weight: bold; font-size: 0.85em; text-transform: uppercase; border-radius: 4px;">
        ${isActive ? 'OFFICIAL GATE PASS / OUTWARD LOADING SLIP' : 'SALES REP RETURN & SETTLEMENT VOUCHER'}
      </div>
    </div>

    ${barcodeSvg}

    <div class="divider"></div>

    <div class="row-meta"><span>DISPATCH REF:</span><strong style="font-family: monospace;">${dispatch.dispatchNumber}</strong></div>
    <div class="row-meta"><span>DATE & TIME:</span><span>${dispatch.dateDispatched} ${dispatch.timeDispatched}</span></div>
    <div class="row-meta"><span>SALES REP:</span><strong>${dispatch.repName}</strong></div>
    ${dispatch.repPhone ? `<div class="row-meta"><span>PHONE:</span><span>${dispatch.repPhone}</span></div>` : ''}
    ${dispatch.vehicleOrRoute ? `<div class="row-meta"><span>ROUTE / VAN:</span><span>${dispatch.vehicleOrRoute}</span></div>` : ''}
    <div class="row-meta"><span>STATUS:</span><strong>${isActive ? 'OUT ON FIELD (ACTIVE)' : 'SETTLED & RECONCILED'}</strong></div>
    ${dispatch.dispatchedBy ? `<div class="row-meta"><span>DISPATCHED BY:</span><span>${dispatch.dispatchedBy}</span></div>` : ''}
    ${!isActive && dispatch.receivedAndAuditedBy ? `<div class="row-meta"><span>AUDITED BY:</span><span>${dispatch.receivedAndAuditedBy}</span></div>` : ''}

    <div class="divider"></div>

    <table>
      <thead>
        <tr>
          <th>Item Description</th>
          <th style="text-align: center;">Qty Taken</th>
          <th style="text-align: right;">Unit Price</th>
          <th style="text-align: right;">Sum Taken</th>
          ${
            !isActive
              ? `<th style="text-align: center; color: #dc2626;">Unsold</th><th style="text-align: center; color: #16a34a;">Sold</th><th style="text-align: right; color: #16a34a;">Net Sold</th>`
              : ''
          }
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div class="divider"></div>

    <div class="row-meta"><span>Total Value Dispatched:</span><strong>${currency}${dispatch.totalSumTaken.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
    ${
      !isActive
        ? `
      <div class="row-meta" style="color: #dc2626;"><span>Minus Unsold Returns (To Stock):</span><strong>-${currency}${dispatch.totalUnsoldReturnedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
      <div class="double-divider"></div>
      <div class="total-row" style="color: #16a34a;"><span>NET SALES DUE FROM REP:</span><span>${currency}${dispatch.netSalesDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
      <div class="row-meta" style="margin-top: 5px;"><span>Cash Remitted:</span><span>${currency}${dispatch.amountRemittedCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
      <div class="row-meta"><span>Bank Transfer Remitted:</span><span>${currency}${dispatch.amountRemittedTransfer.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
      ${dispatch.amountRemittedPOS > 0 ? `<div class="row-meta"><span>POS Remitted:</span><span>${currency}${dispatch.amountRemittedPOS.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>` : ''}
      <div class="row-meta" style="font-weight: bold; border-top: 1px solid #000; padding-top: 4px;"><span>Total Money Remitted:</span><span>${currency}${dispatch.totalAmountRemitted.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
      ${
        dispatch.shortageOrExcess !== 0
          ? `<div class="row-meta" style="font-weight: bold; color: ${dispatch.shortageOrExcess < 0 ? '#dc2626' : '#16a34a'};"><span>${dispatch.shortageOrExcess < 0 ? '⚠ SHORTAGE / REP OWES:' : 'SURPLUS / EXCESS PAYMENT:'}</span><span>${currency}${Math.abs(dispatch.shortageOrExcess).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>`
          : '<div class="row-meta" style="color: #16a34a; font-weight: bold;"><span>Settlement Audit:</span><span>Balanced (Zero Shortage)</span></div>'
      }
    `
        : ''
    }

    <div class="divider"></div>

    ${dispatch.notes ? `<p style="font-size: 0.9em; margin: 4px 0;"><strong>Remarks / Instructions:</strong> ${dispatch.notes}</p><div class="divider"></div>` : ''}

    <div style="display: flex; justify-content: space-between; margin-top: 24px; font-size: 0.85em; text-align: center;">
      <div style="width: 46%;">
        <div style="border-bottom: 1px solid #000; padding-bottom: 28px;"></div>
        <p style="margin: 4px 0 0 0; font-weight: bold;">Sales Rep Signature</p>
        <p style="margin: 0; color: #555;">(${dispatch.repName})</p>
      </div>
      <div style="width: 46%;">
        <div style="border-bottom: 1px solid #000; padding-bottom: 28px;"></div>
        <p style="margin: 4px 0 0 0; font-weight: bold;">Authorized Auditor / Dispatcher</p>
        <p style="margin: 0; color: #555;">(${dispatch.receivedAndAuditedBy || dispatch.dispatchedBy || 'Auditor'})</p>
      </div>
    </div>

    <div class="text-center" style="margin-top: 18px; font-size: 0.75em; color: #666;">
      Validated &bull; Windows Inventory Management &bull; ${new Date().toLocaleString()}
    </div>

    <div class="no-print" style="margin-top: 20px; text-align: center;">
      <button onclick="window.print()" style="padding: 8px 18px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
        Print this Slip
      </button>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Directly prints a Field Sales Rep dispatch slip or settlement voucher.
 */
export async function printDispatchSlip(
  dispatch: SalesRepDispatch,
  settings: AppSettings,
  format: 'thermal80' | 'a4' = 'a4'
): Promise<boolean> {
  const html = generateDispatchSlipHtml(dispatch, settings, format);
  return printHtml(html, `Dispatch-${dispatch.dispatchNumber}`);
}

/**
 * Downloads a standalone, offline HTML file of the Field Sales Rep dispatch slip.
 */
export function downloadDispatchSlipHtml(
  dispatch: SalesRepDispatch,
  settings: AppSettings,
  format: 'thermal80' | 'a4' = 'a4'
): void {
  const html = generateDispatchSlipHtml(dispatch, settings, format);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Dispatch_${dispatch.dispatchNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
