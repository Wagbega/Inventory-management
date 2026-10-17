import React, { useState } from 'react';
import {
  Barcode,
  Printer,
  QrCode,
  Download,
  Boxes,
  Layers,
  Copy,
  Check,
  Tag,
} from 'lucide-react';
import { InventoryItem, AppSettings } from '../types';
import { generateBarcodeBars, generateQrMatrix } from '../utils/barcode';
import { printElementById } from '../utils/print';

interface BarcodeStudioViewProps {
  items: InventoryItem[];
  settings: AppSettings;
  selectedItemForBarcode?: InventoryItem | null;
}

export const BarcodeStudioView: React.FC<BarcodeStudioViewProps> = ({
  items,
  settings,
  selectedItemForBarcode,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(
    selectedItemForBarcode?.id || items[0]?.id || ''
  );
  const [codeType, setCodeType] = useState<'barcode' | 'qr'>('barcode');
  const [labelSize, setLabelSize] = useState<'standard' | 'compact' | 'thermal'>('standard');
  const [printCopies, setPrintCopies] = useState<number>(12);
  const [copied, setCopied] = useState(false);

  const currentItem = items.find((i) => i.id === selectedItemId) || items[0];

  const barcodeValue = currentItem?.barcode || currentItem?.sku || 'SKU-001';
  const bars = generateBarcodeBars(barcodeValue);
  const qrMatrix = generateQrMatrix(barcodeValue, 21);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(barcodeValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintLabels = async () => {
    try {
      await printElementById('barcode-printable-sheet', `Labels-${barcodeValue}`, 'a4');
    } catch {
      window.print();
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto flex flex-col h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 no-print">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Barcode & QR Studio</span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
              Vector Generator
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generate high-resolution printable labels, bin tags, and 2D QR codes for optical scanners.
          </p>
        </div>

        <button
          onClick={handlePrintLabels}
          className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print {printCopies} Labels</span>
        </button>
      </div>

      {/* Main Studio Area */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        {/* Left: Configuration Controls */}
        <div className="lg:col-span-5 bg-white dark:bg-[#252525] rounded-xl border border-black/[0.08] dark:border-white/[0.08] p-5 shadow-xs space-y-4 overflow-y-auto">
          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
            Label Configuration
          </h3>

          {/* Select Item */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Inventory Item
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-2 text-xs outline-none"
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.sku} — {item.name} ({item.quantity} {item.unit})
                </option>
              ))}
            </select>
          </div>

          {/* Code Format */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Symbology Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCodeType('barcode')}
                className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-xs font-medium border cursor-pointer ${
                  codeType === 'barcode'
                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800 border-black/[0.06] dark:border-white/[0.06]'
                }`}
              >
                <Barcode className="w-4 h-4" />
                <span>1D Barcode (Code128)</span>
              </button>

              <button
                type="button"
                onClick={() => setCodeType('qr')}
                className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-md text-xs font-medium border cursor-pointer ${
                  codeType === 'qr'
                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'bg-slate-50 dark:bg-slate-800 border-black/[0.06] dark:border-white/[0.06]'
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>2D Matrix (QR Code)</span>
              </button>
            </div>
          </div>

          {/* Label Dimension */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sticker & Label Layout
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'standard', label: 'Standard (2"x1")' },
                { id: 'compact', label: 'Compact Bin Tag' },
                { id: 'thermal', label: 'Thermal Roll (4"x2")' },
              ].map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => setLabelSize(sz.id as any)}
                  className={`py-2 px-2 text-center rounded-md text-xs border cursor-pointer ${
                    labelSize === sz.id
                      ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'bg-slate-50 dark:bg-slate-800 border-black/[0.06] dark:border-white/[0.06]'
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          {/* Number of print copies */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Print Sheet Copies (Grid count)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max="60"
                value={printCopies}
                onChange={(e) => setPrintCopies(Math.max(1, Math.min(60, Number(e.target.value))))}
                className="w-24 bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs font-mono"
              />
              <span className="text-xs text-slate-400">stickers per printable job</span>
            </div>
          </div>

          {/* Item Meta Summary */}
          {currentItem && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs space-y-1.5 border border-black/[0.04] dark:border-white/[0.04]">
              <div className="flex justify-between">
                <span className="text-slate-400">Barcode / SKU Value:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                  {barcodeValue}
                  <button onClick={handleCopyCode} title="Copy Code" className="cursor-pointer text-slate-400 hover:text-blue-600">
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </button>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Retail Price:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {settings.currencySymbol}{currentItem.retailPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Warehouse Bin:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">{currentItem.location}</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Preview Panel */}
        <div className="lg:col-span-7 bg-white dark:bg-[#252525] rounded-xl border border-black/[0.08] dark:border-white/[0.08] p-6 shadow-xs flex flex-col items-center justify-center space-y-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Interactive Label Preview
          </span>

          {/* Physical Label Simulation Card */}
          <div className="w-80 bg-white text-slate-900 p-5 rounded-lg border-2 border-dashed border-slate-300 shadow-md flex flex-col items-center space-y-2 select-all">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-500 text-center w-full truncate">
              {settings.companyName}
            </div>

            <div className="font-bold text-sm text-center text-slate-900 line-clamp-1 w-full">
              {currentItem?.name || 'Sample Product Name'}
            </div>

            {/* Vector Rendered Barcode or QR */}
            <div className="py-2 flex items-center justify-center w-full bg-white">
              {codeType === 'barcode' ? (
                <div className="flex flex-col items-center">
                  <svg className="h-16 w-64" viewBox={`0 0 ${bars.length * 3} 60`}>
                    {bars.map((isBar, idx) =>
                      isBar ? (
                        <rect
                          key={idx}
                          x={idx * 3}
                          y="0"
                          width="2.6"
                          height="60"
                          fill="#000000"
                        />
                      ) : null
                    )}
                  </svg>
                  <span className="font-mono text-xs tracking-widest font-bold mt-1 text-slate-800">
                    *{barcodeValue}*
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <svg className="w-28 h-28" viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}>
                    {qrMatrix.map((row, r) =>
                      row.map((val, c) =>
                        val ? (
                          <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#000000" />
                        ) : null
                      )
                    )}
                  </svg>
                  <span className="font-mono text-[10px] tracking-wider text-slate-600 mt-1">
                    {barcodeValue}
                  </span>
                </div>
              )}
            </div>

            {/* Price & Location Bottom */}
            <div className="w-full flex items-center justify-between text-xs pt-1 border-t border-slate-200">
              <span className="font-mono text-[11px] text-slate-600">Bin: {currentItem?.location || 'A-01'}</span>
              <span className="font-bold font-mono text-sm text-slate-950">
                {settings.currencySymbol}
                {currentItem?.retailPrice.toFixed(2) || '0.00'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 text-center max-w-sm">
            High precision vector SVG elements scale cleanly on 203 DPI and 300 DPI thermal barcode printers (Zebra, Brother, Dymo) and standard laser sheets.
          </div>
        </div>
      </div>

      {/* Printable Sheet (Visible only when Print command triggered) */}
      <div id="barcode-printable-sheet" className="printable-area hidden">
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: printCopies }).map((_, i) => (
            <div
              key={i}
              className="border border-slate-400 p-3 rounded flex flex-col items-center space-y-1 bg-white text-black text-center page-break-inside-avoid"
            >
              <div className="text-[9px] font-bold uppercase">{settings.companyName}</div>
              <div className="text-[11px] font-bold truncate max-w-[180px]">{currentItem?.name}</div>
              {codeType === 'barcode' ? (
                <div className="flex flex-col items-center my-1">
                  <svg className="h-10 w-44" viewBox={`0 0 ${bars.length * 3} 60`}>
                    {bars.map((isBar, idx) =>
                      isBar ? <rect key={idx} x={idx * 3} y="0" width="2.6" height="60" fill="#000" /> : null
                    )}
                  </svg>
                  <span className="font-mono text-[10px] tracking-wider font-bold">*{barcodeValue}*</span>
                </div>
              ) : (
                <div className="flex flex-col items-center my-1">
                  <svg className="w-16 h-16" viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}>
                    {qrMatrix.map((row, r) =>
                      row.map((val, c) => (val ? <rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" fill="#000" /> : null))
                    )}
                  </svg>
                  <span className="font-mono text-[9px]">{barcodeValue}</span>
                </div>
              )}
              <div className="w-full flex justify-between text-[10px] pt-1 border-t border-slate-300">
                <span>{currentItem?.location}</span>
                <span className="font-bold">{settings.currencySymbol}{currentItem?.retailPrice.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
