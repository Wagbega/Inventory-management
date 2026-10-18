import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  Copy,
  Check,
  FileText,
  CreditCard,
  Building2,
  Phone,
  User,
  Plus,
  Trash2,
  DollarSign,
  QrCode,
  Barcode,
  Calendar,
  Percent,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Edit3,
  Eye,
  Download,
  Loader2,
} from 'lucide-react';
import { ReceiptData, AppSettings, ReceiptLineItem, PaymentMethod } from '../types';
import { generateBarcodeBars, generateQrMatrix } from '../utils/barcode';
import { printElementById, downloadReceiptHtml } from '../utils/print';
import { AppLogo } from './AppLogo';

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: ReceiptData | null;
  settings: AppSettings;
  onSaveReceipt?: (receipt: ReceiptData) => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  isOpen,
  onClose,
  receiptData,
  settings,
  onSaveReceipt,
}) => {
  const [receipt, setReceipt] = useState<ReceiptData | null>(() => {
    if (!receiptData) return null;
    return {
      ...receiptData,
      showMemo: receiptData.showMemo !== undefined ? receiptData.showMemo : (settings.showReceiptMemo ?? true),
    };
  });
  const [receiptFormat, setReceiptFormat] = useState<'thermal80' | 'a4'>('thermal80');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [previewScale, setPreviewScale] = useState<number>(100);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccess, setPrintSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (receiptData) {
      setReceipt({
        ...receiptData,
        showMemo: receiptData.showMemo !== undefined ? receiptData.showMemo : (settings.showReceiptMemo ?? true),
      });
    }
  }, [receiptData, settings.showReceiptMemo]);

  if (!isOpen || !receipt) return null;

  const currencySymbol = settings.currencySymbol || '₦';

  // Helper recalculations
  const updateReceiptTotals = (updatedItems: ReceiptLineItem[], discountVal = receipt.discount, taxRateVal = receipt.taxRate) => {
    const subtotal = updatedItems.reduce((sum, item) => sum + (item.total || item.unitPrice * item.quantity), 0);
    const taxAmount = (subtotal - discountVal) * (taxRateVal / 100);
    const grandTotal = Math.max(0, subtotal - discountVal + taxAmount);
    const changeDue = Math.max(0, receipt.amountPaid - grandTotal);

    setReceipt((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        items: updatedItems,
        subtotal,
        discount: discountVal,
        taxRate: taxRateVal,
        taxAmount,
        grandTotal,
        changeDue,
      };
    });
  };

  const handleItemChange = (index: number, field: keyof ReceiptLineItem, value: any) => {
    const updated = [...receipt.items];
    const current = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      current.total = Number(current.quantity) * Number(current.unitPrice);
    }
    updated[index] = current;
    updateReceiptTotals(updated);
  };

  const handleAddItem = () => {
    const newItem: ReceiptLineItem = {
      sku: 'CUSTOM-ITEM',
      name: 'Custom Product / Service',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    updateReceiptTotals([...receipt.items, newItem]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = receipt.items.filter((_, i) => i !== index);
    updateReceiptTotals(updated);
  };

  const handlePrint = async () => {
    if (onSaveReceipt && receipt) {
      onSaveReceipt(receipt);
    }
    setIsPrinting(true);
    try {
      await printElementById('printable-receipt-container', `Receipt-${receipt.receiptNumber}`, receiptFormat);
      setPrintSuccess(true);
      setTimeout(() => setPrintSuccess(false), 2500);
    } catch (err) {
      console.warn('[Print] Print failed, invoking direct fallback', err);
      window.print();
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadSlip = () => {
    if (!receipt) return;
    if (onSaveReceipt) {
      onSaveReceipt(receipt);
    }
    downloadReceiptHtml(receipt, settings, receiptFormat);
  };

  const generatePlainTextReceipt = (): string => {
    const divider = '========================================';
    const subDivider = '----------------------------------------';
    const lines = [
      divider,
      `      ${receipt.companyName.toUpperCase()}`,
      receipt.companyAddress ? `      ${receipt.companyAddress}` : '',
      receipt.companyPhone ? `      TEL: ${receipt.companyPhone}` : '',
      receipt.taxId ? `      TAX/TIN: ${receipt.taxId}` : '',
      divider,
      `RECEIPT NO : ${receipt.receiptNumber}`,
      `DATE/TIME  : ${new Date(receipt.date).toLocaleString()}`,
      `CASHIER    : ${receipt.operator}`,
      receipt.customerName ? `CUSTOMER   : ${receipt.customerName}` : '',
      receipt.customerPhone ? `PHONE      : ${receipt.customerPhone}` : '',
      `PAYMENT    : ${receipt.paymentMethod}`,
      subDivider,
      'ITEM                       QTY   TOTAL',
      subDivider,
    ];

    receipt.items.forEach((it) => {
      const nameCol = it.name.substring(0, 24).padEnd(24, ' ');
      const qtyCol = `${it.quantity}`.padStart(3, ' ');
      const totalCol = `${currencySymbol}${it.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.padStart(11, ' ');
      lines.push(`${nameCol} ${qtyCol} ${totalCol}`);
    });

    lines.push(
      subDivider,
      `SUBTOTAL:            ${currencySymbol}${receipt.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      receipt.discount > 0 ? `DISCOUNT:           -${currencySymbol}${receipt.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
      receipt.taxAmount > 0 ? `VAT/TAX (${receipt.taxRate}%):     ${currencySymbol}${receipt.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
      `TOTAL AMOUNT:        ${currencySymbol}${receipt.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `AMOUNT PAID:         ${currencySymbol}${receipt.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      `CHANGE DUE:          ${currencySymbol}${receipt.changeDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      divider,
      ...(receipt.showMemo !== false
        ? [receipt.notes || settings.receiptFooterNote || 'Thank you for your patronage! Goods sold in good condition are covered by standard warranty.']
        : []),
      '     Powered by Windows Inventory App',
      divider,
    );

    return lines.filter(Boolean).join('\n');
  };

  const handleCopyText = () => {
    const text = generatePlainTextReceipt();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const barcodeBars = generateBarcodeBars(receipt.receiptNumber || 'REC-001');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-3 md:p-6 z-50 animate-fade-in select-none" data-print-modal="true">
      <div className="bg-white dark:bg-[#202020] rounded-none sm:rounded-xl border-0 sm:border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-4xl w-full h-full sm:h-[94vh] flex flex-col overflow-hidden">
        
        {/* Title Bar - Fully Responsive */}
        <div className="p-3 sm:p-4 border-b border-black/[0.08] dark:border-white/[0.08] bg-slate-50 dark:bg-slate-800/80 shrink-0 no-print">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
                <Printer className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                    Receipt & Sales Slip Printer
                  </h2>
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-semibold truncate">
                    {receipt.receiptNumber}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block truncate">
                  80mm thermal roll, standard A4 invoice format, and instant WhatsApp/Text copy
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <button
                onClick={onClose}
                className="p-1.5 sm:p-1 rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Format Switcher (80mm vs A4) on mobile/desktop */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="grid grid-cols-2 sm:flex p-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setReceiptFormat('thermal80')}
                className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer text-center ${
                  receiptFormat === 'thermal80'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                80mm Thermal POS
              </button>
              <button
                type="button"
                onClick={() => setReceiptFormat('a4')}
                className={`px-3 py-1.5 rounded font-medium transition-colors cursor-pointer text-center ${
                  receiptFormat === 'a4'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                A4 / Tax Invoice
              </button>
            </div>

            {receiptFormat === 'a4' && activeTab === 'preview' && (
              <div className="hidden sm:flex items-center space-x-1 text-xs text-slate-500 bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2 py-1">
                <span className="text-[11px]">Zoom:</span>
                <button
                  type="button"
                  onClick={() => setPreviewScale((s) => Math.max(50, s - 15))}
                  className="p-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] w-9 text-center">{previewScale}%</span>
                <button
                  type="button"
                  onClick={() => setPreviewScale((s) => Math.min(130, s + 15))}
                  className="p-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewScale(100)}
                  className="p-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  title="Reset 100%"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Toolbar & Subheader */}
        <div className="px-3 sm:px-4 py-2 bg-slate-100 dark:bg-slate-800/40 border-b border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs shrink-0 no-print">
          <div className="grid grid-cols-2 sm:flex items-center gap-1">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md font-semibold cursor-pointer transition-colors ${
                activeTab === 'preview'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-black/[0.04]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Preview</span>
            </button>
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-md font-semibold cursor-pointer transition-colors ${
                activeTab === 'edit'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-black/[0.04]'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Details</span>
            </button>

            {/* Quick Toggle for Memo & Warranty Terms */}
            <button
              type="button"
              id="btn-toggle-receipt-memo"
              onClick={() => {
                const current = receipt.showMemo !== false;
                const updated = { ...receipt, showMemo: !current };
                setReceipt(updated);
                if (onSaveReceipt) onSaveReceipt(updated);
              }}
              className={`flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-md font-semibold cursor-pointer transition-colors border shadow-xs ${
                receipt.showMemo !== false
                  ? 'bg-purple-50 hover:bg-purple-100/80 text-purple-700 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800'
                  : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
              title="Toggle whether custom memo & warranty policy appear on printed slip"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Memo / Warranty:</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  receipt.showMemo !== false
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {receipt.showMemo !== false ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyText}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-black/[0.08] dark:border-white/[0.08] rounded-md font-medium text-slate-700 dark:text-slate-300 cursor-pointer shadow-xs min-h-[36px]"
              title="Copy plain-text receipt for WhatsApp or SMS dispatch"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="truncate">{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>

            <button
              onClick={handleDownloadSlip}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-black/[0.08] dark:border-white/[0.08] rounded-md font-medium text-slate-700 dark:text-slate-300 cursor-pointer shadow-xs min-h-[36px]"
              title="Download standalone printable HTML receipt voucher"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="truncate">Download Slip</span>
            </button>

            <button
              id="btn-print-slip-action"
              onClick={handlePrint}
              disabled={isPrinting}
              className={`flex-1 sm:flex-none flex items-center justify-center space-x-1.5 px-4 py-1.5 rounded-md font-semibold cursor-pointer shadow-xs min-h-[36px] transition-colors ${
                printSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
              }`}
              title="Print transaction receipt slip (Thermal or Standard)"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : printSuccess ? (
                <Check className="w-4 h-4" />
              ) : (
                <Printer className="w-4 h-4" />
              )}
              <span>{isPrinting ? 'Preparing...' : printSuccess ? 'Slip Printed!' : 'Print Slip'}</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-slate-200/90 dark:bg-[#141414] p-3 sm:p-4 md:p-6 flex justify-center items-start">
          {activeTab === 'preview' ? (
            /* --- PREVIEW MODE --- */
            receiptFormat === 'thermal80' ? (
              /* Thermal 80mm Roll View */
              <div
                id="printable-receipt-container"
                className="printable-receipt bg-white text-black p-4 sm:p-6 w-full max-w-[340px] shadow-2xl rounded-sm border border-slate-300 font-mono text-[11px] leading-relaxed self-start space-y-3 relative mx-auto my-0"
              >
                {/* Header */}
                <div className="text-center space-y-1 pb-2 border-b border-dashed border-black flex flex-col items-center">
                  <AppLogo
                    customLogoUrl={settings.customLogoUrl}
                    className="w-10 h-10 mb-1"
                    alt={receipt.companyName || settings.companyName}
                  />
                  <h3 className="text-base font-extrabold tracking-tight uppercase break-words">
                    {receipt.companyName || settings.companyName}
                  </h3>
                  {receipt.companyAddress && (
                    <p className="text-[10px] text-gray-700 break-words">{receipt.companyAddress}</p>
                  )}
                  <div className="text-[10px] text-gray-700 flex flex-wrap justify-center gap-x-2">
                    {receipt.companyPhone && <span>TEL: {receipt.companyPhone}</span>}
                    {receipt.taxId && <span>TIN: {receipt.taxId}</span>}
                  </div>
                </div>

                {/* Metadata */}
                <div className="space-y-0.5 text-[10.5px] pb-2 border-b border-dashed border-black">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold shrink-0">RECEIPT NO:</span>
                    <span className="font-bold truncate">{receipt.receiptNumber}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="shrink-0">DATE:</span>
                    <span className="text-right">{new Date(receipt.date).toLocaleDateString()} {new Date(receipt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="shrink-0">CASHIER/OP:</span>
                    <span className="truncate">{receipt.operator}</span>
                  </div>
                  {receipt.customerName && (
                    <div className="flex justify-between gap-2">
                      <span className="shrink-0">CUSTOMER:</span>
                      <span className="font-semibold truncate text-right">{receipt.customerName}</span>
                    </div>
                  )}
                  {receipt.customerPhone && (
                    <div className="flex justify-between gap-2">
                      <span className="shrink-0">PHONE:</span>
                      <span className="truncate text-right">{receipt.customerPhone}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="shrink-0">PAYMENT:</span>
                    <span className="font-bold text-right">{receipt.paymentMethod}</span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-1.5 pb-2 border-b border-dashed border-black">
                  <div className="grid grid-cols-12 font-bold text-[10px] uppercase border-b border-black pb-1">
                    <span className="col-span-6">Item Description</span>
                    <span className="col-span-2 text-center">Qty</span>
                    <span className="col-span-4 text-right">Price ({currencySymbol})</span>
                  </div>

                  {receipt.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 text-[10.5px] items-baseline">
                      <div className="col-span-6 pr-1">
                        <div className="font-semibold break-words">
                          {item.name}
                          {item.isPromo && (
                            <span className="ml-1 text-[9px] font-bold">[PROMO]</span>
                          )}
                        </div>
                        <div className="text-[9px] text-gray-500 font-mono truncate">{item.sku}</div>
                      </div>
                      <div className="col-span-2 text-center font-bold">{item.quantity}</div>
                      <div className="col-span-4 text-right font-bold font-mono">
                        {currencySymbol}
                        {item.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-black">
                  <div className="flex justify-between">
                    <span>SUBTOTAL:</span>
                    <span className="font-mono">{currencySymbol}{receipt.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  {receipt.discount > 0 && (
                    <div className="flex justify-between text-gray-800">
                      <span>DISCOUNT:</span>
                      <span className="font-mono">-{currencySymbol}{receipt.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  {receipt.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span>VAT / TAX ({receipt.taxRate}%):</span>
                      <span className="font-mono">{currencySymbol}{receipt.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}

                  <div className="flex justify-between font-extrabold text-sm border-t border-black pt-1">
                    <span>TOTAL:</span>
                    <span className="font-mono">{currencySymbol}{receipt.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between pt-0.5">
                    <span>AMOUNT TENDERED:</span>
                    <span className="font-mono">{currencySymbol}{receipt.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>

                  <div className="flex justify-between font-bold">
                    <span>CHANGE DUE:</span>
                    <span className="font-mono">{currencySymbol}{receipt.changeDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Barcode */}
                <div className="text-center space-y-2 pt-1 pb-1">
                  <div className="flex justify-center overflow-hidden">
                    <svg className="h-9 w-44 max-w-full" viewBox={`0 0 ${barcodeBars.length * 2} 40`}>
                      {barcodeBars.map((isBar, idx) =>
                        isBar ? <rect key={idx} x={idx * 2} y="0" width="2" height="40" fill="black" /> : null
                      )}
                    </svg>
                  </div>
                  <div className="font-mono text-[9px] tracking-widest">{receipt.receiptNumber}</div>
                </div>

                {/* Footer Notes & Warranty Policy */}
                {receipt.showMemo !== false ? (
                  <div className="text-center text-[9.5px] text-gray-700 space-y-1 pt-1 border-t border-dashed border-black">
                    <p className="font-medium break-words">
                      {receipt.notes || settings.receiptFooterNote || 'Thank you for your patronage! Goods sold in good condition are covered by standard warranty.'}
                    </p>
                    <p className="text-[8px] text-gray-500">
                      Validated • Windows Inventory Management POS
                    </p>
                  </div>
                ) : (
                  <div className="text-center text-[8.5px] text-gray-500 pt-1 border-t border-dashed border-black">
                    <p>Validated • Windows Inventory Management POS</p>
                    {/* Visual notice in preview mode only - omitted when printed */}
                    <div className="no-print mt-1 p-1 bg-amber-50 text-amber-800 rounded text-[9px] font-sans flex items-center justify-center gap-1 border border-amber-200">
                      <span>Memo &amp; warranty terms omitted from print</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...receipt, showMemo: true };
                          setReceipt(updated);
                          if (onSaveReceipt) onSaveReceipt(updated);
                        }}
                        className="underline font-bold hover:text-amber-950 cursor-pointer"
                      >
                        (Show)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* A4 Full Tax Invoice View with Scale & Overflow container */
              <div
                className="w-full flex justify-center overflow-x-auto pb-4"
                style={{
                  transform: previewScale !== 100 ? `scale(${previewScale / 100})` : undefined,
                  transformOrigin: 'top center',
                }}
              >
                <div
                  id="printable-receipt-container"
                  className="printable-receipt receipt-format-a4 bg-white text-black p-6 sm:p-10 w-full max-w-[700px] shadow-2xl rounded-sm border border-slate-300 font-sans text-xs leading-relaxed self-start space-y-6 mx-auto my-0"
                >
                  {/* A4 Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start border-b border-black/20 pb-4 sm:pb-6 gap-4">
                    <div className="flex items-start gap-3.5">
                      <AppLogo
                        customLogoUrl={settings.customLogoUrl}
                        className="w-14 h-14 shrink-0 rounded"
                        alt={receipt.companyName || settings.companyName}
                      />
                      <div>
                        <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight text-blue-900 break-words">
                          {receipt.companyName || settings.companyName}
                        </h1>
                        {receipt.companyAddress && <p className="text-xs text-gray-600 mt-1 max-w-sm">{receipt.companyAddress}</p>}
                        <p className="text-xs text-gray-600 mt-0.5">
                          {receipt.companyPhone && <span>Tel: {receipt.companyPhone}</span>}
                          {receipt.companyEmail && <span className="ml-3">Email: {receipt.companyEmail}</span>}
                        </p>
                        {receipt.taxId && <p className="text-xs text-gray-600 font-mono">Tax / TIN: {receipt.taxId}</p>}
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 font-bold uppercase text-xs rounded mb-2">
                        Official Tax Invoice
                      </span>
                      <h3 className="font-mono text-base font-bold">{receipt.receiptNumber}</h3>
                      <p className="text-gray-500 text-xs mt-1">Date: {new Date(receipt.date).toLocaleDateString()}</p>
                      <p className="text-gray-500 text-xs">Operator: {receipt.operator}</p>
                    </div>
                  </div>

                  {/* Customer Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-slate-50 border border-slate-200 rounded">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-400">Bill To / Customer:</span>
                      <h4 className="font-bold text-sm text-gray-900">{receipt.customerName || 'Walk-in Customer'}</h4>
                      {receipt.customerPhone && <p className="text-xs text-gray-600">Phone: {receipt.customerPhone}</p>}
                      {receipt.customerAddress && <p className="text-xs text-gray-600">{receipt.customerAddress}</p>}
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-gray-400">Payment Summary:</span>
                      <p className="text-xs font-semibold text-gray-800">Method: {receipt.paymentMethod}</p>
                      <p className="text-xs text-gray-600">Status: Fully Paid</p>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs min-w-[500px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                          <th className="p-2">#</th>
                          <th className="p-2">SKU</th>
                          <th className="p-2">Description</th>
                          <th className="p-2 text-center">Qty</th>
                          <th className="p-2 text-right">Unit Price ({currencySymbol})</th>
                          <th className="p-2 text-right">Total ({currencySymbol})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {receipt.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="p-2 text-gray-400">{idx + 1}</td>
                            <td className="p-2 font-mono text-[11px]">{it.sku}</td>
                            <td className="p-2 font-semibold">
                              {it.name}
                              {it.isPromo && (
                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-bold">
                                  PROMO
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">{it.quantity} {it.unit || ''}</td>
                            <td className="p-2 text-right font-mono">{currencySymbol}{it.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td className="p-2 text-right font-mono font-bold">{currencySymbol}{it.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Calculation Summary */}
                  <div className="flex justify-end pt-4 border-t border-slate-200">
                    <div className="w-full sm:w-72 space-y-2 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal:</span>
                        <span className="font-mono">{currencySymbol}{receipt.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      {receipt.discount > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span>Discount:</span>
                          <span className="font-mono">-{currencySymbol}{receipt.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      {receipt.taxAmount > 0 && (
                        <div className="flex justify-between text-gray-600">
                          <span>VAT / Tax ({receipt.taxRate}%):</span>
                          <span className="font-mono">{currencySymbol}{receipt.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-sm font-bold border-t border-slate-300 pt-2 text-gray-900">
                        <span>Grand Total:</span>
                        <span className="font-mono">{currencySymbol}{receipt.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between text-xs text-gray-600 pt-1">
                        <span>Amount Paid:</span>
                        <span className="font-mono">{currencySymbol}{receipt.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between text-xs font-semibold text-emerald-700">
                        <span>Change:</span>
                        <span className="font-mono">{currencySymbol}{receipt.changeDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Signatures & Footer */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10 pt-6 sm:pt-10 border-t border-slate-200 text-xs">
                    <div>
                      <p className="text-gray-500 mb-6 sm:mb-8">Authorized Signature / Stamp</p>
                      <div className="border-b border-black w-40 sm:w-48" />
                    </div>
                    <div>
                      <p className="text-gray-500 mb-6 sm:mb-8">Customer Acceptance Signature</p>
                      <div className="border-b border-black w-40 sm:w-48" />
                    </div>
                  </div>

                  {receipt.showMemo !== false ? (
                    <div className="text-center text-xs text-gray-600 pt-4 border-t border-slate-200">
                      <p className="font-medium">{receipt.notes || settings.receiptFooterNote || 'Thank you for doing business with us! Goods sold in good condition are covered by standard warranty.'}</p>
                    </div>
                  ) : (
                    <div className="no-print text-center text-[11px] text-amber-700 pt-3 border-t border-dashed border-slate-200">
                      <span>(Memo &amp; warranty terms omitted from printed invoice — </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = { ...receipt, showMemo: true };
                          setReceipt(updated);
                          if (onSaveReceipt) onSaveReceipt(updated);
                        }}
                        className="underline font-bold hover:text-amber-900 cursor-pointer"
                      >
                        Click to Show
                      </button>
                      <span>)</span>
                    </div>
                  )}
                </div>
              </div>
            )
          ) : (
            /* --- EDIT DETAILS MODE --- */
            <div className="w-full max-w-2xl bg-white dark:bg-[#252525] rounded-xl p-4 sm:p-6 shadow-sm border border-black/[0.08] dark:border-white/[0.08] space-y-4 text-xs mx-auto">
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
                Customize Receipt Information
              </h3>

              {/* Company and Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Receipt / Invoice #</label>
                  <input
                    type="text"
                    value={receipt.receiptNumber}
                    onChange={(e) => setReceipt((r) => r && { ...r, receiptNumber: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Payment Method</label>
                  <select
                    value={receipt.paymentMethod}
                    onChange={(e) => setReceipt((r) => r && { ...r, paymentMethod: e.target.value as PaymentMethod })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="POS / Card">POS / Card Terminal</option>
                    <option value="Bank Transfer">Bank Transfer (NIBSS / Instant)</option>
                    <option value="USSD">USSD</option>
                    <option value="Credit / On Account">Credit / On Account</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Customer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={receipt.customerName || ''}
                    onChange={(e) => setReceipt((r) => r && { ...r, customerName: e.target.value })}
                    placeholder="e.g. Chief Emeka Okafor / Jane Doe"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Customer Phone / Contact</label>
                  <input
                    type="text"
                    value={receipt.customerPhone || ''}
                    onChange={(e) => setReceipt((r) => r && { ...r, customerPhone: e.target.value })}
                    placeholder="e.g. +234 802 345 6789"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none"
                  />
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">Itemized Breakdown</h4>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold cursor-pointer hover:bg-blue-700"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {receipt.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-black/[0.04] dark:border-white/[0.04]">
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] text-slate-400 block sm:hidden">Item Name</label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                          placeholder="Item name"
                          className="w-full bg-white dark:bg-slate-700 border border-black/[0.08] dark:border-white/[0.08] rounded px-2 py-1.5 outline-none text-xs"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block sm:hidden">Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', Number(e.target.value))}
                            className="w-16 bg-white dark:bg-slate-700 border border-black/[0.08] dark:border-white/[0.08] rounded px-2 py-1.5 font-mono text-center outline-none text-xs"
                          />
                        </div>

                        <div className="flex-1 sm:flex-none">
                          <label className="text-[10px] text-slate-400 block sm:hidden">Price ({currencySymbol})</label>
                          <div className="flex items-center space-x-1">
                            <span className="font-mono text-slate-400">{currencySymbol}</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleItemChange(idx, 'unitPrice', Number(e.target.value))}
                              className="w-24 bg-white dark:bg-slate-700 border border-black/[0.08] dark:border-white/[0.08] rounded px-2 py-1.5 font-mono outline-none text-xs"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded cursor-pointer self-end sm:self-center"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax & Discount & Tender */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                <div>
                  <label className="block font-semibold mb-1">Discount ({currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    value={receipt.discount}
                    onChange={(e) => updateReceiptTotals(receipt.items, Number(e.target.value), receipt.taxRate)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">VAT / Tax Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={receipt.taxRate}
                    onChange={(e) => updateReceiptTotals(receipt.items, receipt.discount, Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 font-mono outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Amount Tendered / Paid</label>
                  <input
                    type="number"
                    min="0"
                    value={receipt.amountPaid}
                    onChange={(e) => {
                      const paid = Number(e.target.value);
                      setReceipt((r) => r && { ...r, amountPaid: paid, changeDue: Math.max(0, paid - r.grandTotal) });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 font-mono outline-none"
                  />
                </div>
              </div>

              {/* Receipt Memo & Warranty Terms Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-black/[0.08] dark:border-white/[0.08] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200">
                        Receipt Memo &amp; Warranty Policy
                      </h4>
                      <p className="text-[10px] text-slate-400">
                        Choose whether terms and memo appear on the printed slip.
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <label className="inline-flex items-center space-x-2 cursor-pointer select-none bg-white dark:bg-slate-700 px-2.5 py-1 rounded-md border border-black/[0.08] dark:border-white/[0.08] shadow-2xs">
                    <input
                      type="checkbox"
                      checked={receipt.showMemo !== false}
                      onChange={(e) => {
                        const updated = { ...receipt, showMemo: e.target.checked };
                        setReceipt(updated);
                        if (onSaveReceipt) onSaveReceipt(updated);
                      }}
                      className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      {receipt.showMemo !== false ? 'Print Memo / Terms' : 'Do Not Print Memo'}
                    </span>
                  </label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Memo / Return &amp; Warranty Terms Text
                    </label>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      receipt.showMemo !== false
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}>
                      {receipt.showMemo !== false ? 'Will appear on receipt' : 'Hidden from print'}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={receipt.notes ?? (settings.receiptFooterNote || '')}
                    onChange={(e) => setReceipt((r) => r && { ...r, notes: e.target.value })}
                    placeholder="e.g. Return valid within 7 days with original receipt and intact tags. Goods sold in good condition are covered by standard warranty."
                    className="w-full bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 text-xs outline-none focus:border-purple-500 font-sans"
                  />
                </div>

                {/* Quick Presets */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Quick Preset Clauses:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      'Goods sold in good condition are covered by standard 14-day warranty.',
                      'Return / exchange accepted within 7 days with original receipt and intact packaging.',
                      'No cash refunds. Exchange or store credit valid for 30 days.',
                      'Official payment confirmed. Thank you for your valued patronage!',
                    ].map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setReceipt((r) => r && { ...r, notes: preset, showMemo: true })}
                        className="px-2 py-1 rounded bg-white dark:bg-slate-750 hover:bg-purple-100 dark:hover:bg-purple-950/60 text-slate-700 dark:text-slate-300 hover:text-purple-700 dark:hover:text-purple-300 text-[10.5px] transition-colors border border-black/[0.08] dark:border-white/[0.08] cursor-pointer text-left"
                      >
                        {preset.length > 40 ? preset.substring(0, 38) + '...' : preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold cursor-pointer text-center"
                >
                  Apply & View Preview
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

