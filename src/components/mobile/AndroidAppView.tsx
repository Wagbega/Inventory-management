import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Layers,
  PlusCircle,
  QrCode,
  ClipboardCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  ArrowLeft,
  X,
  Plus,
  Minus,
  Flashlight,
  Camera,
  Check,
  Download,
  Share2,
  ExternalLink,
  Sliders,
  DollarSign,
  Package,
  Boxes,
  Database,
  Volume2,
  VolumeX,
  Monitor,
} from 'lucide-react';
import { InventoryItem, StockMovement, AppSettings, AppUser } from '../../types';
import {
  saveItemToFirestore,
  testFirestoreConnection,
  getFirebaseConfig,
} from '../../services/firebaseSync';
import { sound } from '../../utils/audio';
import { getItemPricing } from '../../utils/pricing';

interface AndroidAppViewProps {
  items: InventoryItem[];
  settings: AppSettings;
  currentUser: AppUser | null;
  onUpdateItem: (item: InventoryItem) => void;
  onDeleteItem?: (id: string) => void;
  onSwitchToDesktop: () => void;
}

export const AndroidAppView: React.FC<AndroidAppViewProps> = ({
  items,
  settings,
  currentUser,
  onUpdateItem,
  onDeleteItem,
  onSwitchToDesktop,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'intake' | 'scanner' | 'audit' | 'sync'>('catalog');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [isCheckingCloud, setIsCheckingCloud] = useState<boolean>(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<string>('Connected to Cloud');

  // Intake Form State
  const [intakeName, setIntakeName] = useState('');
  const [intakeSku, setIntakeSku] = useState('');
  const [intakeCategory, setIntakeCategory] = useState('General');
  const [intakeQty, setIntakeQty] = useState(10);
  const [intakeMinQty, setIntakeMinQty] = useState(5);
  const [intakeCost, setIntakeCost] = useState(12.5);
  const [intakeWholesale, setIntakeWholesale] = useState(20.0);
  const [intakeRetail, setIntakeRetail] = useState(25.0);
  const [intakeHasPromo, setIntakeHasPromo] = useState(false);
  const [intakePromoPrice, setIntakePromoPrice] = useState<string>('');
  const [intakePromoStart, setIntakePromoStart] = useState('');
  const [intakePromoEnd, setIntakePromoEnd] = useState('');
  const [intakeBarcode, setIntakeBarcode] = useState('');
  const [intakeUnit, setIntakeUnit] = useState('pcs');
  const [intakeLocation, setIntakeLocation] = useState('Shelf A-1');
  const [isIntakeSubmitting, setIsIntakeSubmitting] = useState(false);
  const [intakeSuccessToast, setIntakeSuccessToast] = useState<string | null>(null);

  // Scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [manualBarcodeScan, setManualBarcodeScan] = useState('');
  const [scannedItemMatch, setScannedItemMatch] = useState<InventoryItem | null>(null);
  const [scannedNotFoundCode, setScannedNotFoundCode] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Stock Audit State
  const [auditCounts, setAuditCounts] = useState<{ [itemId: string]: number }>({});
  const [auditFilter, setAuditFilter] = useState('');
  const [auditSuccessToast, setAuditSuccessToast] = useState<string | null>(null);

  // PWA Install state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const firebaseConfig = getFirebaseConfig();

  // Android Status bar clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Listen for PWA beforeinstallprompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Check Firestore connection
  useEffect(() => {
    verifyCloud();
  }, []);

  const verifyCloud = async () => {
    setIsCheckingCloud(true);
    const res = await testFirestoreConnection();
    setIsCloudConnected(res.success);
    setCloudStatusMsg(res.success ? 'Firebase Firestore Live' : 'Offline / Reconnecting');
    setIsCheckingCloud(false);
  };

  // Camera start/stop for scanner tab
  useEffect(() => {
    if (activeTab === 'scanner') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        mediaStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraActive(true);
      } else {
        setCameraError('Camera not supported in this browser. Use manual barcode input.');
      }
    } catch (err: any) {
      setCameraError('Camera access denied or unavailable. Using manual barcode input.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleBarcodeEntered = (barcodeVal: string) => {
    const val = barcodeVal.trim();
    if (!val) return;

    sound.playBeep();
    const found = items.find(
      (i) => (i.barcode && i.barcode.toLowerCase() === val.toLowerCase()) ||
             i.sku.toLowerCase() === val.toLowerCase()
    );

    if (found) {
      setScannedItemMatch(found);
      setScannedNotFoundCode(null);
    } else {
      setScannedItemMatch(null);
      setScannedNotFoundCode(val);
    }
  };

  // Rapid Quick Stock Adjustment (+/-)
  const handleQuickAdjustStock = async (item: InventoryItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    const updated: InventoryItem = {
      ...item,
      quantity: newQty,
      updatedAt: new Date().toISOString(),
    };
    onUpdateItem(updated);
    sound.playClick();
    try {
      await saveItemToFirestore(updated);
    } catch (err) {
      console.warn('Error syncing stock adjustment to Firestore:', err);
    }
  };

  // Submit new item via Remote Intake
  const handleSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intakeName.trim()) {
      alert('Product name is required');
      return;
    }

    setIsIntakeSubmitting(true);
    const now = new Date().toISOString();
    const id = 'item_' + Math.random().toString(36).substring(2, 9);
    const sku = intakeSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

    const enablePromo = Boolean(intakeHasPromo && Number(intakePromoPrice) > 0);

    const newItem: InventoryItem = {
      id,
      sku,
      name: intakeName.trim(),
      category: intakeCategory.trim() || 'General',
      quantity: Number(intakeQty) || 0,
      minQuantity: Number(intakeMinQty) || 5,
      unitCost: Number(intakeCost) || 0,
      wholesalePrice: Number(intakeWholesale) || Number(intakeRetail) || 0,
      retailPrice: Number(intakeRetail) || 0,
      hasPromo: enablePromo,
      promoPrice: enablePromo ? Number(intakePromoPrice) : undefined,
      promoStartDate: enablePromo && intakePromoStart ? intakePromoStart : undefined,
      promoEndDate: enablePromo && intakePromoEnd ? intakePromoEnd : undefined,
      unit: intakeUnit.trim() || 'pcs',
      barcode: intakeBarcode.trim() || undefined,
      location: intakeLocation.trim() || 'Floor A',
      notes: 'Added via Android Mobile App',
      createdAt: now,
      updatedAt: now,
      lastRestocked: now,
    };

    try {
      await saveItemToFirestore(newItem);
      onUpdateItem(newItem);
      sound.playSuccessChime();
      setIntakeSuccessToast(`Uploaded "${newItem.name}" to Cloud!`);

      // Reset form
      setIntakeName('');
      setIntakeSku('');
      setIntakeBarcode('');
      setIntakeHasPromo(false);
      setIntakePromoPrice('');
      setIntakePromoStart('');
      setIntakePromoEnd('');
      setTimeout(() => setIntakeSuccessToast(null), 3500);
      setActiveTab('catalog');
    } catch (err: any) {
      alert(`Failed to save to cloud: ${err?.message || 'Network error'}`);
    } finally {
      setIsIntakeSubmitting(false);
    }
  };

  // Install PWA button handler
  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert(
        'To install on Android:\n1. Tap the three dots (⋮) in Chrome\n2. Tap "Install app" or "Add to Home Screen"'
      );
    }
  };

  // Categories list
  const categories = ['All', ...Array.from(new Set(items.map((i) => i.category || 'General')))];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.barcode && item.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-2xl relative select-none font-sans overflow-hidden border-x border-black/10 dark:border-white/10">
      {/* 1. ANDROID STATUS BAR */}
      <div className="h-7 px-4 bg-slate-900 text-white flex items-center justify-between text-[11px] font-medium shrink-0 tracking-wider">
        <span className="font-bold">{currentTime || '09:41'}</span>
        <div className="flex items-center space-x-2 text-[10px]">
          <span className="flex items-center space-x-0.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isCloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span className="text-slate-300">5G</span>
          </span>
          <span className="text-slate-300">LTE</span>
          <span className="font-semibold text-emerald-400">98%</span>
        </div>
      </div>

      {/* 2. TOP APP BAR (Material 3 Style) */}
      <div className="px-3.5 py-2.5 bg-blue-600 text-white flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight leading-none">Inventory POS</h1>
            <div className="flex items-center space-x-1 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isCloudConnected ? 'bg-emerald-300' : 'bg-rose-300'
                }`}
              />
              <span className="text-[10px] text-blue-100 font-medium truncate max-w-[140px]">
                {firebaseConfig.projectId.split('-')[0] || 'Firestore Live'}
              </span>
            </div>
          </div>
        </div>

        {/* Right action icons */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={verifyCloud}
            disabled={isCheckingCloud}
            title="Refresh Cloud Sync"
            className="p-1.5 rounded-full hover:bg-white/15 active:bg-white/25 text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingCloud ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onSwitchToDesktop}
            title="Switch back to Windows Desktop POS"
            className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold transition-colors cursor-pointer"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Desktop</span>
          </button>
        </div>
      </div>

      {/* 3. INSTALL AS ANDROID APP BANNER (PWA) */}
      {!isInstalled && (
        <div className="bg-slate-900 text-slate-200 px-3 py-1.5 text-[11px] flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Install as Android APK / PWA</span>
          </div>
          <button
            onClick={handleInstallPwa}
            className="px-2.5 py-0.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded font-semibold text-[10px] cursor-pointer"
          >
            Install
          </button>
        </div>
      )}

      {/* 4. SUCCESS TOAST */}
      {(intakeSuccessToast || auditSuccessToast) && (
        <div className="absolute top-20 left-4 right-4 z-50 bg-emerald-600 text-white px-3.5 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{intakeSuccessToast || auditSuccessToast}</span>
        </div>
      )}

      {/* 5. MAIN SCROLLABLE CONTENT AREA */}
      <div className="flex-1 overflow-y-auto pb-16">
        {/* TAB 1: CATALOG SCREEN */}
        {activeTab === 'catalog' && (
          <div className="p-3 space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU, name, barcode..."
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex space-x-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px]">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap font-medium transition-colors cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Total items stats pill */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>{filteredItems.length} Products</span>
              <span className="text-emerald-600 font-semibold">Real-time Cloud Synced</span>
            </div>

            {/* Items List */}
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Package className="w-10 h-10 mx-auto text-slate-300" />
                <p className="text-xs font-semibold">No items match your search.</p>
                <button
                  onClick={() => setActiveTab('intake')}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold"
                >
                  Tap to Add New Item
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => {
                  const isLow = item.quantity <= item.minQuantity;
                  const pricing = getItemPricing(item);
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 shadow-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {item.name}
                          </h3>
                          {pricing.isPromoActive && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[9px] font-bold">
                              PROMO
                            </span>
                          )}
                          {isLow && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[9px] font-bold">
                              LOW
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
                          <span className="font-mono">{item.sku}</span>
                          <span>•</span>
                          <span>{item.category}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] mt-1">
                          <span className={`font-bold ${pricing.isPromoActive ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                            {settings.currencySymbol}{Number(pricing.effectivePrice || 0).toFixed(2)}
                          </span>
                          {pricing.isPromoActive && (
                            <span className="text-[10px] text-slate-400 line-through">
                              {settings.currencySymbol}{Number(pricing.wholesalePrice || 0).toFixed(2)}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            Ex Brew: {settings.currencySymbol}{Number(item.unitCost || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Rapid +/- stock controls */}
                      <div className="flex items-center space-x-1 shrink-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        <button
                          onClick={() => handleQuickAdjustStock(item, -1)}
                          className="w-7 h-7 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm active:scale-95 shadow-2xs cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="px-2 text-center min-w-[32px]">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                            {item.quantity}
                          </span>
                        </div>
                        <button
                          onClick={() => handleQuickAdjustStock(item, 1)}
                          className="w-7 h-7 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-sm active:scale-95 shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: REMOTE INTAKE FORM */}
        {activeTab === 'intake' && (
          <div className="p-4 space-y-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                <PlusCircle className="w-5 h-5 text-blue-600" />
                <span>Remote Stock Intake</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Add products from your phone. Items sync instantly to the desktop system.
              </p>
            </div>

            <form onSubmit={handleSubmitIntake} className="space-y-3.5">
              {/* Product Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wireless Laser Barcode Scanner"
                  value={intakeName}
                  onChange={(e) => setIntakeName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* SKU & Category */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      SKU
                    </label>
                    <button
                      type="button"
                      onClick={() => setIntakeSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`)}
                      className="text-[10px] text-blue-600 font-semibold cursor-pointer"
                    >
                      Auto
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="SKU-8821"
                    value={intakeSku}
                    onChange={(e) => setIntakeSku(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={intakeCategory}
                    onChange={(e) => setIntakeCategory(e.target.value)}
                    className="w-full px-2 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="General">General</option>
                    <option value="Electronics">Electronics</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Hardware">Hardware</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Apparel">Apparel</option>
                  </select>
                </div>
              </div>

              {/* Quantity & Min Stock */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={intakeQty}
                    onChange={(e) => setIntakeQty(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-mono text-center focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Min Alert
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={intakeMinQty}
                    onChange={(e) => setIntakeMinQty(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-mono text-center focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={intakeUnit}
                    onChange={(e) => setIntakeUnit(e.target.value)}
                    placeholder="crate"
                    className="w-full px-2 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs text-center focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['crate', 'half crate', 'pack', 'half pack', 'carton', 'half carton'].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setIntakeUnit(u)}
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono border ${
                          intakeUnit === u
                            ? 'bg-blue-600 text-white border-blue-600 font-bold'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-black/5 dark:border-white/5'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Ex Brew Cost, Whole Sale Price & Retail Price */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ex Brew ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={intakeCost}
                    onChange={(e) => setIntakeCost(Number(e.target.value))}
                    className="w-full px-2 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Whole Sale ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={intakeWholesale}
                    onChange={(e) => setIntakeWholesale(Number(e.target.value))}
                    className="w-full px-2 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-blue-600 dark:text-blue-400 mb-1">
                    Retail ({settings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={intakeRetail}
                    onChange={(e) => setIntakeRetail(Number(e.target.value))}
                    className="w-full px-2 py-2 rounded-xl border border-blue-400 dark:border-blue-500 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Optional Promo Price */}
              <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 space-y-2">
                <label className="flex items-center space-x-2 text-xs font-semibold text-amber-900 dark:text-amber-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={intakeHasPromo}
                    onChange={(e) => setIntakeHasPromo(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Enable Promo Price (Promo Week / Month)</span>
                </label>

                {intakeHasPromo && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-800 dark:text-amber-300 mb-0.5">
                        Promo Price
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={intakePromoPrice}
                        onChange={(e) => setIntakePromoPrice(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={intakePromoStart}
                        onChange={(e) => setIntakePromoStart(e.target.value)}
                        className="w-full px-1.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-[10px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={intakePromoEnd}
                        onChange={(e) => setIntakePromoEnd(e.target.value)}
                        className="w-full px-1.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-[10px]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Margin helper indicator */}
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[11px] text-blue-900 dark:text-blue-300 flex justify-between">
                <span>Profit per unit:</span>
                <span className="font-bold">
                  {settings.currencySymbol}{Math.max(0, intakeRetail - intakeCost).toFixed(2)} (
                  {intakeCost > 0
                    ? `${Math.round(((intakeRetail - intakeCost) / intakeCost) * 100)}% markup`
                    : '100%'}
                  )
                </span>
              </div>

              {/* Barcode & Camera Scan Helper */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Barcode / UPC (Optional)
                </label>
                <div className="flex space-x-1.5">
                  <input
                    type="text"
                    placeholder="Scan or type barcode..."
                    value={intakeBarcode}
                    onChange={(e) => setIntakeBarcode(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveTab('scanner')}
                    className="px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan</span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isIntakeSubmitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                <Zap className="w-4 h-4" />
                <span>{isIntakeSubmitting ? 'Syncing to Cloud...' : 'Upload Item to Inventory'}</span>
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: OPTICAL CAMERA SCANNER */}
        {activeTab === 'scanner' && (
          <div className="p-4 space-y-3">
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                <QrCode className="w-5 h-5 text-blue-600" />
                <span>Mobile Barcode & QR Scanner</span>
              </h2>
              <p className="text-xs text-slate-500">
                Point your Android camera at any product barcode or SKU.
              </p>
            </div>

            {/* Video preview / Viewfinder */}
            <div className="relative w-full aspect-4/3 rounded-2xl overflow-hidden bg-black border border-white/10 shadow-lg flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
              />

              {/* Viewfinder reticle overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-28 border-2 border-dashed border-emerald-400 rounded-lg relative">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
                  <div className="w-full h-0.5 bg-rose-500/80 absolute top-1/2 -translate-y-1/2 animate-pulse" />
                </div>
              </div>

              {!cameraActive && (
                <div className="text-center p-4 text-slate-400 space-y-2">
                  <Camera className="w-8 h-8 mx-auto text-slate-500" />
                  <p className="text-[11px] max-w-[200px]">{cameraError || 'Initializing Camera...'}</p>
                </div>
              )}
            </div>

            {/* Manual Barcode entry fallback */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 space-y-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Manual Barcode / SKU Entry
              </label>
              <div className="flex space-x-1.5">
                <input
                  type="text"
                  placeholder="Type barcode or SKU..."
                  value={manualBarcodeScan}
                  onChange={(e) => setManualBarcodeScan(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleBarcodeEntered(manualBarcodeScan);
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-xs font-mono outline-none"
                />
                <button
                  onClick={() => handleBarcodeEntered(manualBarcodeScan)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Lookup
                </button>
              </div>
            </div>

            {/* Scanned Result Match Card */}
            {scannedItemMatch && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ITEM FOUND IN INVENTORY</span>
                  </span>
                  <button
                    onClick={() => setScannedItemMatch(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {scannedItemMatch.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">{scannedItemMatch.sku}</p>
                    <p className="text-xs font-bold text-blue-600 mt-1">
                      ${scannedItemMatch.retailPrice.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500">In Stock:</span>
                    <p className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100">
                      {scannedItemMatch.quantity} {scannedItemMatch.unit}
                    </p>
                  </div>
                </div>

                {/* Quick actions for scanned item */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleQuickAdjustStock(scannedItemMatch, 1)}
                    className="py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add 1 Unit</span>
                  </button>
                  <button
                    onClick={() => handleQuickAdjustStock(scannedItemMatch, -1)}
                    className="py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Deduct 1</span>
                  </button>
                </div>
              </div>
            )}

            {/* Unrecognized Barcode Card -> Quick Add */}
            {scannedNotFoundCode && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>NEW UNREGISTERED BARCODE</span>
                  </span>
                  <button
                    onClick={() => setScannedNotFoundCode(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                  Code: <span className="font-bold">{scannedNotFoundCode}</span>
                </p>
                <button
                  onClick={() => {
                    setIntakeBarcode(scannedNotFoundCode);
                    setIntakeSku(`SKU-${scannedNotFoundCode.slice(-4)}`);
                    setActiveTab('intake');
                  }}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Register As New Product</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STOCK AUDIT (STOCK-TAKE) */}
        {activeTab === 'audit' && (
          <div className="p-3 space-y-3">
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                <ClipboardCheck className="w-5 h-5 text-purple-600" />
                <span>Warehouse Stock-Take</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical audit tool. Verify on-shelf quantities and reconcile directly to cloud.
              </p>
            </div>

            <input
              type="text"
              placeholder="Filter items to audit..."
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <div className="space-y-2">
              {items
                .filter(
                  (it) =>
                    it.name.toLowerCase().includes(auditFilter.toLowerCase()) ||
                    it.sku.toLowerCase().includes(auditFilter.toLowerCase())
                )
                .map((item) => {
                  const counted = auditCounts[item.id] ?? item.quantity;
                  const variance = counted - item.quantity;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 shadow-xs space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {item.name}
                          </h4>
                          <p className="text-[10px] text-slate-400 font-mono">{item.sku}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400">Ledger:</span>
                          <span className="font-mono font-bold text-xs ml-1">{item.quantity}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5">
                        <div className="flex items-center space-x-1 text-xs">
                          <span className="text-slate-500">Counted:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {counted}
                          </span>
                          {variance !== 0 && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ml-1 ${
                                variance > 0
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {variance > 0 ? `+${variance}` : variance}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() =>
                              setAuditCounts((prev) => ({
                                ...prev,
                                [item.id]: Math.max(0, (prev[item.id] ?? item.quantity) - 1),
                              }))
                            }
                            className="w-7 h-7 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center cursor-pointer"
                          >
                            -1
                          </button>
                          <button
                            onClick={() =>
                              setAuditCounts((prev) => ({
                                ...prev,
                                [item.id]: (prev[item.id] ?? item.quantity) + 1,
                              }))
                            }
                            className="w-7 h-7 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center cursor-pointer"
                          >
                            +1
                          </button>
                          <button
                            onClick={async () => {
                              const updated: InventoryItem = {
                                ...item,
                                quantity: counted,
                                updatedAt: new Date().toISOString(),
                              };
                              onUpdateItem(updated);
                              await saveItemToFirestore(updated);
                              sound.playClick();
                              setAuditSuccessToast(`Reconciled ${item.name} to ${counted}`);
                              setTimeout(() => setAuditSuccessToast(null), 2500);
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer ml-1"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 5: CLOUD & APK EXPORT */}
        {activeTab === 'sync' && (
          <div className="p-4 space-y-4">
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                <Database className="w-5 h-5 text-blue-600" />
                <span>Android App & Cloud Info</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Firebase Firestore credentials and native Android Studio specs.
              </p>
            </div>

            {/* Cloud Status Card */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Firebase Database
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
                  {isCloudConnected ? 'Connected (Free Tier)' : 'Offline'}
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 space-y-1">
                <p>Project: {firebaseConfig.projectId}</p>
                <p>Database: {firebaseConfig.firestoreDatabaseId || '(default)'}</p>
                <p>Total Items: {items.length}</p>
              </div>
            </div>

            {/* Install on Android Device (PWA) */}
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 space-y-2">
              <h4 className="font-bold text-xs text-blue-900 dark:text-blue-200 flex items-center space-x-1.5">
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>Run Directly On Your Android Smartphone</span>
              </h4>
              <p className="text-[11px] text-blue-800 dark:text-blue-300">
                You can install this mobile app directly from Android Chrome without downloading an APK file:
              </p>
              <ol className="list-decimal pl-4 text-[11px] text-blue-900 dark:text-blue-300 space-y-1">
                <li>Open this URL on your phone's Chrome browser</li>
                <li>Tap the <strong>⋮</strong> menu in the upper right</li>
                <li>Select <strong>Add to Home Screen</strong> or <strong>Install App</strong></li>
              </ol>
              <button
                onClick={handleInstallPwa}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Launch Install Prompt
              </button>
            </div>

            {/* Native Android Studio Kotlin specs */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 space-y-2">
              <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                <Download className="w-4 h-4 text-purple-600" />
                <span>Native Android Kotlin Code</span>
              </h4>
              <p className="text-[11px] text-slate-500">
                A complete Jetpack Compose native project has been created in <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">/android/</code>.
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `// Android Project Directory: /android/\n// Main Activity: /android/app/src/main/java/com/inventory/pos/MainActivity.kt\n// Build file: /android/app/build.gradle.kts`
                  );
                  alert('Android Project path copied to clipboard!');
                }}
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Copy Android Project Paths
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 6. ANDROID MATERIAL 3 BOTTOM NAVIGATION BAR */}
      <div className="h-14 bg-white dark:bg-slate-900 border-t border-black/10 dark:border-white/10 flex items-center justify-around px-2 shrink-0 z-40">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activeTab === 'catalog'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Catalog</span>
        </button>

        <button
          onClick={() => setActiveTab('intake')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activeTab === 'intake'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Intake</span>
        </button>

        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activeTab === 'scanner'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Scanner</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activeTab === 'audit'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Audit</span>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activeTab === 'sync'
              ? 'text-blue-600 dark:text-blue-400 font-bold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Database className="w-4 h-4" />
          <span className="text-[10px] mt-0.5">Cloud</span>
        </button>
      </div>
    </div>
  );
};
