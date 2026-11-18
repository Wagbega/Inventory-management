import React, { useState, useEffect, useRef } from 'react';
import {
  ScanLine,
  X,
  Camera,
  Keyboard,
  Boxes,
  PlusCircle,
  MinusCircle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { InventoryItem, AppSettings } from '../types';
import { sound } from '../utils/audio';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  settings: AppSettings;
  onQuickAdjust: (item: InventoryItem, type: 'in' | 'out') => void;
  onSelectItem: (item: InventoryItem) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  items,
  settings,
  onQuickAdjust,
  onSelectItem,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [matchedItem, setMatchedItem] = useState<InventoryItem | null>(null);
  const [scanMode, setScanMode] = useState<'keyboard' | 'camera'>('keyboard');
  const [cameraActive, setCameraActive] = useState(false);
  const [scanHistory, setScanHistory] = useState<InventoryItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      setInputCode('');
      setMatchedItem(null);
    } else {
      stopCamera();
    }
  }, [isOpen]);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setScanMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      alert('Camera access not available or blocked in this environment. Using high-speed keyboard/gun scanner mode.');
      setScanMode('keyboard');
    }
  };

  const handleScanLookup = (code: string) => {
    const clean = code.trim().toLowerCase();
    if (!clean) return;

    const found = items.find(
      (i) =>
        i.sku.toLowerCase() === clean ||
        (i.barcode && i.barcode.toLowerCase() === clean) ||
        i.name.toLowerCase().includes(clean)
    );

    if (found) {
      if (settings.enableSoundEffects) {
        sound.playScanBeep();
      }
      setMatchedItem(found);
      setScanHistory((prev) => [found, ...prev.filter((p) => p.id !== found.id)].slice(0, 5));
    } else {
      if (settings.enableSoundEffects) {
        sound.playAlertSound();
      }
      setMatchedItem(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleScanLookup(inputCode);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-[#222222] rounded-xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ScanLine className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Barcode & SKU Quick Scanner
              </h2>
              <p className="text-[11px] text-slate-500">
                Supports USB barcode guns, optical cameras, and manual SKU entry
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Mode Switcher */}
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={() => {
                stopCamera();
                setScanMode('keyboard');
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer ${
                scanMode === 'keyboard'
                  ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'bg-slate-50 dark:bg-slate-800 border-black/[0.06] dark:border-white/[0.06]'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span>Gun / Keyboard Mode</span>
            </button>

            <button
              onClick={startCamera}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer ${
                scanMode === 'camera'
                  ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'bg-slate-50 dark:bg-slate-800 border-black/[0.06] dark:border-white/[0.06]'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Camera Video Feed</span>
            </button>
          </div>

          {/* Camera Viewport (if active) */}
          {scanMode === 'camera' && (
            <div className="relative w-full h-48 bg-black rounded-lg overflow-hidden flex items-center justify-center border border-slate-700">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              {/* Laser Scan line overlay animation */}
              <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
              <div className="absolute bottom-2 inset-x-2 text-center text-[10px] text-white/80 bg-black/50 py-1 rounded">
                Align barcode or QR within camera frame
              </div>
            </div>
          )}

          {/* Input Form for Barcode Gun or Typing */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value);
                  handleScanLookup(e.target.value);
                }}
                placeholder="Scan barcode gun or type SKU..."
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-blue-500/50 focus:border-blue-600 rounded-lg px-4 py-2.5 text-sm font-mono outline-none shadow-inner"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer"
              >
                Scan
              </button>
            </div>
          </form>

          {/* Quick preset chips to test scan */}
          <div className="space-y-1">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Quick Test Barcodes:
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.slice(0, 4).map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => {
                    setInputCode(i.sku);
                    handleScanLookup(i.sku);
                  }}
                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 text-[11px] font-mono rounded text-slate-700 dark:text-slate-300 border border-black/[0.06] dark:border-white/[0.06] cursor-pointer"
                >
                  {i.sku}
                </button>
              ))}
            </div>
          </div>

          {/* Scan Result Card */}
          {matchedItem ? (
            <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 space-y-3 animate-fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-1.5 text-emerald-700 dark:text-emerald-300 font-semibold text-xs mb-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Product Verified</span>
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {matchedItem.name}
                  </div>
                  <div className="font-mono text-xs text-slate-500 mt-0.5">
                    SKU: {matchedItem.sku} • Bin: {matchedItem.location}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                    {matchedItem.quantity}{' '}
                    <span className="text-xs font-normal text-slate-400">{matchedItem.unit}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    {settings.currencySymbol}{matchedItem.retailPrice.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Instant Stock Actions */}
              <div className="flex items-center space-x-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/60">
                <button
                  type="button"
                  onClick={() => {
                    onQuickAdjust(matchedItem, 'in');
                    onClose();
                  }}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ Receive Stock In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onQuickAdjust(matchedItem, 'out');
                    onClose();
                  }}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>- Dispatch Stock Out</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectItem(matchedItem);
                    onClose();
                  }}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs font-medium hover:bg-slate-50 cursor-pointer"
                  title="Open in Details"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : inputCode.trim() ? (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 flex items-center space-x-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>No item matches barcode &quot;{inputCode}&quot;. Verify code or create new SKU.</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
