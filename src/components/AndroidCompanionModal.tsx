import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  X,
  QrCode,
  ExternalLink,
  Copy,
  Check,
  Code2,
  Download,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { InventoryItem, AppSettings, AppUser } from '../types';
import { AndroidAppView } from './mobile/AndroidAppView';
import { generateQrDataUrl, generateQrMatrix } from '../utils/barcode';
import { getFirebaseConfig } from '../services/firebaseSync';

interface AndroidCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  settings: AppSettings;
  currentUser: AppUser | null;
  onUpdateItem: (item: InventoryItem) => void;
}

export const AndroidCompanionModal: React.FC<AndroidCompanionModalProps> = ({
  isOpen,
  onClose,
  items,
  settings,
  currentUser,
  onUpdateItem,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'simulator' | 'qr_portal' | 'kotlin_source'>('qr_portal');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Compute clean initial mobile URL
  const computeInitialUrl = (): string => {
    if (typeof window === 'undefined') return '';
    try {
      const parsed = new URL(window.location.href);
      parsed.searchParams.set('mode', 'android');
      return parsed.toString();
    } catch {
      return (window.location.origin || '') + '/?mode=android';
    }
  };

  const [mobileUrl, setMobileUrl] = useState<string>(computeInitialUrl);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isQrLoading, setIsQrLoading] = useState<boolean>(true);

  // Synchronize when modal opens
  useEffect(() => {
    if (isOpen) {
      const initial = computeInitialUrl();
      setMobileUrl(initial);
    }
  }, [isOpen]);

  // Generate real ISO/IEC compliant QR code image on URL change
  useEffect(() => {
    let isMounted = true;
    setIsQrLoading(true);

    const target = mobileUrl.trim() || computeInitialUrl();
    generateQrDataUrl(target, 400)
      .then((dataUrl) => {
        if (isMounted) {
          setQrDataUrl(dataUrl);
          setIsQrLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsQrLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [mobileUrl]);

  if (!isOpen) return null;

  const firebaseConfig = getFirebaseConfig();
  const fallbackMatrix = generateQrMatrix(mobileUrl || 'https://inventory.local');

  const handleCopyMobileLink = () => {
    navigator.clipboard.writeText(mobileUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenStandaloneTab = () => {
    window.open(mobileUrl, '_blank');
  };

  const handleResetUrl = () => {
    setMobileUrl(computeInitialUrl());
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'inventory-android-app-qr.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-black/10 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Android Mobile App & Companion
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                  Firebase Real-time
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Install on Android smartphones for warehouse stock intake, camera barcode scanning & real-time inventory sync.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Nav pills */}
            <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg text-xs font-semibold">
              <button
                id="btn-tab-qr-portal"
                onClick={() => setActiveSubTab('qr_portal')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'qr_portal'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Scan to Install (QR)</span>
              </button>
              <button
                id="btn-tab-simulator"
                onClick={() => setActiveSubTab('simulator')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'simulator'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Phone Simulator</span>
              </button>
              <button
                id="btn-tab-kotlin-source"
                onClick={() => setActiveSubTab('kotlin_source')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeSubTab === 'kotlin_source'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Native Kotlin Code</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-950 p-4 flex items-center justify-center">
          {/* 1. QR CODE PORTAL MODE (Default) */}
          {activeSubTab === 'qr_portal' && (
            <div className="max-w-2xl w-full p-6 bg-white dark:bg-slate-900 rounded-2xl border border-black/10 dark:border-white/10 shadow-lg my-auto space-y-5">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* QR Code Canvas/Image */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="p-3 bg-white rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-md inline-block">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Android App Install QR Code"
                        className="w-56 h-56 rounded-lg block"
                      />
                    ) : (
                      <svg
                        viewBox={`0 0 ${fallbackMatrix.length} ${fallbackMatrix.length}`}
                        className="w-56 h-56 shape-rendering-crispEdges block"
                      >
                        {fallbackMatrix.map((row, r) =>
                          row.map((cell, c) => (
                            <rect
                              key={`${r}-${c}`}
                              x={c}
                              y={r}
                              width={1}
                              height={1}
                              fill={cell ? '#0f172a' : '#ffffff'}
                            />
                          ))
                        )}
                      </svg>
                    )}
                  </div>
                  <div className="mt-2 flex items-center space-x-1.5 text-[11px] text-slate-500 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Standard ISO QR • Scannable on any camera</span>
                  </div>
                  {qrDataUrl && (
                    <button
                      onClick={handleDownloadQr}
                      className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download QR (PNG)</span>
                    </button>
                  )}
                </div>

                {/* Instructions & Actions */}
                <div className="flex-1 space-y-4 text-left w-full">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                      <span>Install on Any Android Smartphone</span>
                      <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-md">
                        PWA App
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Scan this QR code using your phone camera (or Google Lens) to open the mobile client instantly.
                    </p>
                  </div>

                  {/* Step by step guide */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-2 border border-black/5 dark:border-white/5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                      3-Step Installation:
                    </span>
                    <div className="flex items-start space-x-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                        1
                      </span>
                      <span>
                        Point your phone camera at the QR code and tap the link that appears.
                      </span>
                    </div>
                    <div className="flex items-start space-x-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                        2
                      </span>
                      <span>
                        In Google Chrome, tap the menu (⋮) at top right and select <strong className="text-blue-600 dark:text-blue-400">"Install app"</strong> or <strong className="text-blue-600 dark:text-blue-400">"Add to Home screen"</strong>.
                      </span>
                    </div>
                    <div className="flex items-start space-x-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">
                        3
                      </span>
                      <span>
                        The app will be installed with its own icon on your Android home screen and app drawer!
                      </span>
                    </div>
                  </div>

                  {/* Mobile URL link field */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Target Mobile App Address
                    </label>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="text"
                        value={mobileUrl}
                        onChange={(e) => setMobileUrl(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-mono"
                        placeholder="https://..."
                      />
                      <button
                        onClick={handleResetUrl}
                        title="Reset to current browser URL"
                        className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={handleCopyMobileLink}
                      className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer border border-slate-300 dark:border-slate-700"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied URL!' : 'Copy Mobile URL'}</span>
                    </button>
                    <button
                      onClick={handleOpenStandaloneTab}
                      className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Test in New Tab</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Troubleshooting Note */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start space-x-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>Network Note:</strong> Ensure your smartphone has internet access to open the cloud app. If testing on a private local Wi-Fi IP address or behind corporate proxies, you can paste the accessible network URL into the box above and the QR code will regenerate immediately.
                </div>
              </div>
            </div>
          )}

          {/* 2. PHONE SIMULATOR MODE */}
          {activeSubTab === 'simulator' && (
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 h-full w-full max-w-4xl">
              {/* Smartphone Frame Mockup */}
              <div className="relative w-[340px] sm:w-[360px] h-[640px] sm:h-[680px] bg-slate-900 rounded-[44px] p-3 shadow-2xl border-4 border-slate-700/80 flex flex-col shrink-0">
                {/* Speaker & Front Camera Hole */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-950 rounded-full z-50 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
                </div>

                {/* Inner Screen */}
                <div className="w-full h-full rounded-[34px] overflow-hidden bg-slate-50 dark:bg-slate-900 flex flex-col relative">
                  <AndroidAppView
                    items={items}
                    settings={settings}
                    currentUser={currentUser}
                    onUpdateItem={onUpdateItem}
                    onSwitchToDesktop={onClose}
                  />
                </div>

                {/* Android Navigation bar pill indicator at bottom */}
                <div className="w-28 h-1 bg-white/40 rounded-full mx-auto mt-1.5 shrink-0" />
              </div>

              {/* Side Info & Actions Panel */}
              <div className="flex-1 space-y-4 max-w-sm">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 shadow-xs space-y-3">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Live Cloud-Synchronized Simulator</span>
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Try adding items, adjusting quantities, or scanning barcodes directly inside the phone screen on the left.
                    Every action writes to Firestore and updates your desktop inventory immediately!
                  </p>

                  <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5 text-xs">
                    <button
                      onClick={() => setActiveSubTab('qr_portal')}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Switch to QR Code for Physical Phone</span>
                    </button>

                    <button
                      onClick={handleOpenStandaloneTab}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Mobile View In New Window</span>
                    </button>

                    <button
                      onClick={handleCopyMobileLink}
                      className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg font-semibold flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Link Copied!' : 'Copy Mobile Link'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Multi-Device Ready</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    Multiple warehouse employees can run this mobile app concurrently on different Android devices without conflicts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. NATIVE KOTLIN CODE TAB */}
          {activeSubTab === 'kotlin_source' && (
            <div className="w-full max-w-3xl h-full flex flex-col space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                    <Code2 className="w-4 h-4 text-purple-600" />
                    <span>Native Android Studio Project (Kotlin + Jetpack Compose)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Located in <code className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">/android/</code>. Includes build.gradle.kts, AndroidManifest.xml, and MainActivity.kt.
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `// Native Android Project Files for Inventory POS\n// Project ID: ${firebaseConfig.projectId}\n// Path: /android/app/src/main/java/com/inventory/pos/MainActivity.kt`
                    );
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied Paths' : 'Copy Project Paths'}</span>
                </button>
              </div>

              {/* Code Viewer */}
              <div className="flex-1 bg-slate-900 text-slate-200 rounded-xl p-4 overflow-y-auto font-mono text-xs border border-white/10 shadow-inner">
                <div className="text-slate-400 mb-2 font-semibold">
                  // File: /android/app/src/main/java/com/inventory/pos/MainActivity.kt
                </div>
                <pre className="leading-relaxed text-slate-300">
{`package com.inventory.pos

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.*
import com.google.firebase.firestore.FirebaseFirestore

class MainActivity : ComponentActivity() {
    private val firestore = FirebaseFirestore.getInstance()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            // Real-time bidirectional synchronization with desktop POS
            InventoryAndroidApp(firestore = firestore)
        }
    }
}

// Full Jetpack Compose implementation with Material 3, Barcode Scanning,
// Remote Item Intake, and Stock-take is available in /android/app/src/main/java/com/inventory/pos/MainActivity.kt`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

