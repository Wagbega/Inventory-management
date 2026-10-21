import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  X,
  Maximize2,
  Minimize2,
  Tag,
  Boxes,
  User,
  CreditCard,
  Banknote,
  Building2,
  Smartphone,
  CheckCircle2,
  Percent,
  Sparkles,
  Barcode,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react';
import { InventoryItem, AppSettings, ReceiptData, PaymentMethod, AppUser } from '../types';
import { sound } from '../utils/audio';
import { getItemPricing } from '../utils/pricing';

interface POSRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  settings: AppSettings;
  currentUser?: AppUser | null;
  onCreateNewReceipt: (receipt: ReceiptData) => void;
  onOpenReceiptModal?: (receipt: ReceiptData) => void;
  onOpenScanner?: () => void;
}

interface CartEntry {
  item: InventoryItem;
  quantity: number;
  customPrice?: number;
  discountPercent?: number;
}

export const POSRegisterModal: React.FC<POSRegisterModalProps> = ({
  isOpen,
  onClose,
  items,
  settings,
  currentUser,
  onCreateNewReceipt,
  onOpenReceiptModal,
  onOpenScanner,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [stockWarning, setStockWarning] = useState<string | null>(null);
  const [confirmClearCart, setConfirmClearCart] = useState(false);
  const [mobileTab, setMobileTab] = useState<'catalog' | 'cart'>('catalog');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [amountTendered, setAmountTendered] = useState<number>(0);
  const [orderNotes, setOrderNotes] = useState('');
  const [showMemoOnReceipt, setShowMemoOnReceipt] = useState<boolean>(() => settings.showReceiptMemo ?? true);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto reset clear confirmation timer on unmount or cart empty
  useEffect(() => {
    return () => {
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (cart.length === 0 && confirmClearCart) {
      setConfirmClearCart(false);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    }
  }, [cart.length, confirmClearCart]);

  useEffect(() => {
    if (settings.showReceiptMemo !== undefined) {
      setShowMemoOnReceipt(settings.showReceiptMemo);
    }
  }, [settings.showReceiptMemo]);

  const currencySymbol = settings.currencySymbol || '$';
  const vatRate = settings.defaultVatRate ?? 7.5;

  // Derive categories
  const categories = useMemo(() => {
    const list = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));
    return ['all', ...list];
  }, [items]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return items.filter((item) => {
      if (onlyInStock && item.quantity <= 0) return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchBarcode = item.barcode?.toLowerCase().includes(q) || false;
        const matchLoc = item.location?.toLowerCase().includes(q) || false;
        if (!matchName && !matchSku && !matchBarcode && !matchLoc) return false;
      }
      return true;
    });
  }, [items, selectedCategory, searchQuery, onlyInStock]);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Keyboard shortcut listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleCompleteSale();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, cart, customerName, customerPhone, paymentMethod, amountTendered, overallDiscount]);

  // Cart operations
  const handleAddToCart = (item: InventoryItem) => {
    // 1. Guard against completely out-of-stock items
    if (item.quantity <= 0) {
      setStockWarning(`Cannot add "${item.name}" to cart: Item is completely out of stock.`);
      if (settings.enableSoundEffects) sound.playScanBeep();
      setTimeout(() => setStockWarning(null), 3500);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((entry) => entry.item.id === item.id);
      if (existing) {
        // 2. Guard against adding more than available in stock
        if (existing.quantity >= item.quantity) {
          setStockWarning(
            `Cannot add more "${item.name}". Only ${item.quantity} ${item.unit || 'units'} in stock.`
          );
          if (settings.enableSoundEffects) sound.playScanBeep();
          setTimeout(() => setStockWarning(null), 3500);
          return prev; // Do not increment
        }

        return prev.map((entry) =>
          entry.item.id === item.id
            ? { ...entry, quantity: Math.min(item.quantity, entry.quantity + 1) }
            : entry
        );
      } else {
        return [...prev, { item, quantity: 1 }];
      }
    });
  };

  const handleAddHalfToCart = (item: InventoryItem) => {
    if (item.quantity <= 0) {
      setStockWarning(`Cannot add "${item.name}" to cart: Item is completely out of stock.`);
      if (settings.enableSoundEffects) sound.playScanBeep();
      setTimeout(() => setStockWarning(null), 3500);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((entry) => entry.item.id === item.id);
      if (existing) {
        if (existing.quantity + 0.5 > item.quantity) {
          setStockWarning(
            `Cannot add more "${item.name}". Only ${item.quantity} ${item.unit || 'units'} in stock.`
          );
          if (settings.enableSoundEffects) sound.playScanBeep();
          setTimeout(() => setStockWarning(null), 3500);
          return prev;
        }

        return prev.map((entry) =>
          entry.item.id === item.id
            ? { ...entry, quantity: Math.min(item.quantity, +(entry.quantity + 0.5).toFixed(2)) }
            : entry
        );
      } else {
        return [...prev, { item, quantity: 0.5 }];
      }
    });
  };

  const handleUpdateQty = (itemId: string, newQty: number) => {
    const roundedQty = Math.round(newQty * 100) / 100;
    if (roundedQty <= 0) {
      setCart((prev) => prev.filter((entry) => entry.item.id !== itemId));
    } else {
      setCart((prev) =>
        prev.map((entry) => {
          if (entry.item.id !== itemId) return entry;
          // Guard: Cap quantity strictly to available stock
          if (roundedQty > entry.item.quantity) {
            setStockWarning(
              `Cannot exceed available stock for "${entry.item.name}". Capped at ${entry.item.quantity} ${entry.item.unit || 'units'}.`
            );
            if (settings.enableSoundEffects) sound.playScanBeep();
            setTimeout(() => setStockWarning(null), 3500);
            return { ...entry, quantity: entry.item.quantity };
          }
          return { ...entry, quantity: roundedQty };
        })
      );
    }
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((entry) => entry.item.id !== itemId));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    if (!confirmClearCart) {
      setConfirmClearCart(true);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => {
        setConfirmClearCart(false);
      }, 4000);
      return;
    }

    // Confirmed clear action (no blocking window.confirm)
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setCart([]);
    setAmountTendered(0);
    setOverallDiscount(0);
    setStockWarning(null);
    setConfirmClearCart(false);
  };

  const handleCancelClear = () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setConfirmClearCart(false);
  };

  // Quick add from exact SKU / barcode match when pressing Enter in search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const q = searchQuery.trim().toLowerCase();
    const exactMatch = items.find(
      (i) => i.sku.toLowerCase() === q || i.barcode?.toLowerCase() === q
    );

    if (exactMatch) {
      handleAddToCart(exactMatch);
      setSearchQuery('');
    } else if (filteredProducts.length === 1) {
      handleAddToCart(filteredProducts[0]);
      setSearchQuery('');
    }
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, entry) => {
      const pricing = getItemPricing(entry.item);
      const price = entry.customPrice !== undefined ? entry.customPrice : pricing.effectivePrice;
      const lineTotal = price * entry.quantity;
      const lineDisc = entry.discountPercent ? lineTotal * (entry.discountPercent / 100) : 0;
      return sum + (lineTotal - lineDisc);
    }, 0);
  }, [cart]);

  const taxAmount = useMemo(() => {
    const discountedSubtotal = Math.max(0, subtotal - overallDiscount);
    return discountedSubtotal * (vatRate / 100);
  }, [subtotal, overallDiscount, vatRate]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - overallDiscount + taxAmount);
  }, [subtotal, overallDiscount, taxAmount]);

  const changeDue = useMemo(() => {
    if (amountTendered > 0 && amountTendered >= grandTotal) {
      return amountTendered - grandTotal;
    }
    return 0;
  }, [amountTendered, grandTotal]);

  const totalItemsCount = useMemo(() => {
    return cart.reduce((sum, entry) => sum + entry.quantity, 0);
  }, [cart]);

  // Complete checkout
  const handleCompleteSale = () => {
    if (cart.length === 0) {
      setStockWarning('Your cart is currently empty. Add inventory items before completing checkout.');
      return;
    }

    const generatedReceipt: ReceiptData = {
      id: 'rec_' + Math.random().toString(36).substring(2, 9),
      receiptNumber: `REC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
      date: new Date().toISOString(),
      type: 'sale',
      companyName: settings.companyName,
      companyAddress: settings.companyAddress,
      companyPhone: settings.companyPhone,
      companyEmail: settings.companyEmail,
      taxId: settings.taxId,
      customerName: customerName.trim() || 'Walk-in Customer',
      customerPhone: customerPhone.trim() || undefined,
      operator: currentUser?.name || 'POS Cashier',
      paymentMethod: paymentMethod,
      items: cart.map((c) => {
        const pricing = getItemPricing(c.item);
        const unitPrice = c.customPrice !== undefined ? c.customPrice : pricing.effectivePrice;
        return {
          itemId: c.item.id,
          sku: c.item.sku,
          name: c.item.name,
          quantity: c.quantity,
          unitPrice,
          regularPrice: pricing.wholesalePrice,
          isPromo: pricing.isPromoActive && c.customPrice === undefined,
          unit: c.item.unit,
          total: unitPrice * c.quantity,
        };
      }),
      subtotal: subtotal,
      taxRate: vatRate,
      taxAmount: taxAmount,
      discount: overallDiscount,
      grandTotal: grandTotal,
      amountPaid: paymentMethod === 'Credit / On Account' ? 0 : (amountTendered > 0 ? amountTendered : grandTotal),
      changeDue: paymentMethod === 'Credit / On Account' ? 0 : changeDue,
      balanceDue: paymentMethod === 'Credit / On Account' ? grandTotal : 0,
      notes: orderNotes.trim() || settings.receiptFooterNote || 'Thank you for your purchase!',
      showMemo: showMemoOnReceipt,
    };

    onCreateNewReceipt(generatedReceipt);
    if (onOpenReceiptModal) {
      onOpenReceiptModal(generatedReceipt);
    }

    // Reset Form
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setOverallDiscount(0);
    setAmountTendered(0);
    setOrderNotes('');
    setConfirmClearCart(false);
    setMobileTab('catalog');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      id="pos-register-modal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-2 select-none overflow-hidden animate-fade-in"
    >
      <div
        className={`bg-slate-100 dark:bg-[#1c1c1c] text-slate-900 dark:text-slate-100 flex flex-col transition-all duration-200 border border-black/[0.1] dark:border-white/[0.1] shadow-2xl overflow-hidden ${
          isFullscreen
            ? 'w-full h-full sm:rounded-none'
            : 'w-full max-w-6xl h-[92vh] max-h-[900px] rounded-xl'
        }`}
      >
        {/* TOP BAR / HEADER */}
        <div className="h-12 bg-white dark:bg-[#252525] border-b border-black/[0.08] dark:border-white/[0.08] px-3 sm:px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h2 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                  POS Sales Register
                </h2>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 shrink-0">
                  {currencySymbol} ({settings.currency})
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 truncate">
                Cashier: <strong>{currentUser?.name || 'Cashier'}</strong> • Station: {settings.warehouseName}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Open Camera / Barcode Gun Scanner"
              >
                <Barcode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Barcode Scanner</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-2 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
              title={isFullscreen ? 'Restore Window' : 'Full Screen Mode'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-600 hover:text-rose-600 dark:text-slate-400 transition-colors cursor-pointer"
              title="Close POS Register (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MOBILE & TABLET TAB SWITCHER (VISIBLE ON SCREENS < LG) */}
        <div className="lg:hidden flex items-center border-b border-black/[0.08] dark:border-white/[0.08] bg-slate-100 dark:bg-[#252525] shrink-0 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setMobileTab('catalog')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              mobileTab === 'catalog'
                ? 'bg-white dark:bg-[#1f1f1f] text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Catalog ({filteredProducts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
              mobileTab === 'cart'
                ? 'bg-white dark:bg-[#1f1f1f] text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Cart ({totalItemsCount})</span>
            {cart.length > 0 && (
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                • {currencySymbol}{grandTotal.toFixed(2)}
              </span>
            )}
          </button>
        </div>

        {/* MAIN BODY: 2 COLUMN RESPONSIVE GRID */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* LEFT COLUMN: PRODUCT CATALOG & SEARCH */}
          <div
            className={`flex-1 flex flex-col min-w-0 bg-white dark:bg-[#202020] border-r border-black/[0.08] dark:border-white/[0.08] ${
              mobileTab === 'catalog' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {/* Search & Category Filter Bar */}
            <div className="p-3 bg-slate-50 dark:bg-[#232323] border-b border-black/[0.06] dark:border-white/[0.06] space-y-2.5 shrink-0">
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search product name, SKU, barcode, location... (Press Enter to quick-add)"
                    className="w-full bg-white dark:bg-slate-800 border border-black/[0.1] dark:border-white/[0.1] rounded-lg pl-9 pr-7 sm:pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 shadow-xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer shadow-xs transition-colors"
                >
                  Find / Add
                </button>
              </form>

              {/* Category Pills & Stock Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar flex-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors cursor-pointer shrink-0 ${
                        selectedCategory === cat
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-black/[0.04] dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-black/[0.08]'
                      }`}
                    >
                      {cat === 'all' ? 'All Items' : cat}
                    </button>
                  ))}
                </div>

                <label className="flex items-center space-x-1.5 text-xs text-slate-600 dark:text-slate-400 shrink-0 cursor-pointer self-start sm:self-auto pl-1 sm:pl-2">
                  <input
                    type="checkbox"
                    checked={onlyInStock}
                    onChange={(e) => setOnlyInStock(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[11px]">In Stock Only</span>
                </label>
              </div>
            </div>

            {/* Product Cards Grid - SCROLLABLE CONTAINER WITH RESPONSIVE COLUMNS */}
            <div className="flex-1 p-3 sm:p-3.5 overflow-y-auto min-h-0">
              {filteredProducts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400">
                  <Boxes className="w-12 h-12 mb-3 opacity-40 text-slate-400" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No matching inventory items</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Try searching by another keyword, SKU code, or switch category filters.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-3">
                  {filteredProducts.map((item) => {
                    const cartEntry = cart.find((c) => c.item.id === item.id);
                    const isInCart = Boolean(cartEntry);
                    const isOutOfStock = item.quantity <= 0;
                    const isStockCapped = Boolean(cartEntry && cartEntry.quantity >= item.quantity);
                    const pricing = getItemPricing(item);

                    return (
                      <div
                        key={item.id}
                        className={`group relative flex flex-col justify-between p-3 rounded-xl border transition-all ${
                          isStockCapped
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-xs'
                            : isInCart
                            ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-400 dark:border-blue-700 shadow-xs'
                            : 'bg-white dark:bg-[#282828] border-black/[0.08] dark:border-white/[0.08] hover:border-blue-300 dark:hover:border-blue-800 hover:shadow-sm'
                        }`}
                      >
                        {/* Top Info */}
                        <div className="space-y-1">
                          <div className="flex items-start justify-between gap-1.5 flex-wrap min-[380px]:flex-nowrap">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate max-w-[110px]">
                              {item.sku}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                item.quantity <= 0
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : item.quantity <= item.minQuantity
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {item.quantity} {item.unit || 'pcs'} in stock
                            </span>
                          </div>

                          <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 line-clamp-2 min-h-[32px] pt-1 leading-snug">
                            {item.name}
                          </h4>

                          {item.category && (
                            <p className="text-[10px] text-slate-400 capitalize truncate">
                              {item.category} • Loc: {item.location || 'Warehouse'}
                            </p>
                          )}
                        </div>

                        {/* Price & ALWAYS VISIBLE Responsive Add to Cart Buttons */}
                        <div className="pt-2.5 mt-2 border-t border-black/[0.05] dark:border-white/[0.05] flex items-end justify-between gap-1.5">
                          <div className="min-w-0 flex-1 pr-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold truncate">
                                {pricing.isPromoActive ? 'Promo Price' : 'Retail Price'}
                              </span>
                              {pricing.isPromoActive && (
                                <span className="px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[9px] font-bold shrink-0">
                                  PROMO
                                </span>
                              )}
                            </div>
                            <div className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 flex items-baseline gap-1">
                              <span className={pricing.isPromoActive ? 'text-amber-600 dark:text-amber-400' : 'text-blue-700 dark:text-blue-300'}>
                                {currencySymbol}{pricing.effectivePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                              Wholesale: {currencySymbol}{pricing.wholesalePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </div>
                          </div>

                          {/* ACTION BUTTONS: +½ and +1 ADD BUTTON (RESPONSIVE) */}
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleAddHalfToCart(item)}
                              disabled={isOutOfStock || (cartEntry !== undefined && cartEntry.quantity + 0.5 > item.quantity)}
                              className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all border whitespace-nowrap ${
                                isOutOfStock || (cartEntry !== undefined && cartEntry.quantity + 0.5 > item.quantity)
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-transparent cursor-not-allowed'
                                  : 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 cursor-pointer shadow-xs active:scale-95'
                              }`}
                              title={`Add 0.5 ${item.unit || 'unit'} (Half crate/pack/carton) to cart`}
                            >
                              +½
                            </button>

                            <button
                              type="button"
                              id={`pos-add-btn-${item.id}`}
                              onClick={() => handleAddToCart(item)}
                              disabled={isOutOfStock || isStockCapped}
                              className={`flex items-center justify-center space-x-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs whitespace-nowrap ${
                                isOutOfStock
                                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                  : isStockCapped
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 cursor-not-allowed text-[11px]'
                                  : isInCart
                                  ? 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-400/50 cursor-pointer'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 cursor-pointer'
                              }`}
                              title={
                                isOutOfStock
                                  ? 'Out of Stock'
                                  : isStockCapped
                                  ? `Stock limit reached in cart (${item.quantity} available)`
                                  : `Add ${item.name} to Cart`
                              }
                            >
                              {isOutOfStock ? (
                                <span>Out of Stock</span>
                              ) : isStockCapped ? (
                                <span>Max ({cartEntry?.quantity})</span>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>{isInCart ? `+ Add (${cartEntry?.quantity})` : '+ Add'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mobile Quick Cart Bar when viewing Catalog on narrow screens and cart has items */}
            {cart.length > 0 && (
              <div className="lg:hidden p-2.5 bg-blue-600 dark:bg-blue-700 text-white shrink-0 flex items-center justify-between shadow-lg border-t border-blue-500/30 animate-in slide-in-from-bottom-2">
                <div className="flex items-center space-x-2 text-xs min-w-0">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold font-mono text-[11px] shrink-0">
                    {totalItemsCount}
                  </div>
                  <span className="font-semibold text-xs truncate">
                    {cart.length} item{cart.length > 1 ? 's' : ''} in cart
                  </span>
                  <span className="font-mono font-bold text-xs sm:text-sm shrink-0">
                    • {currencySymbol}{grandTotal.toFixed(2)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileTab('cart')}
                  className="px-3 py-1.5 bg-white text-blue-700 font-bold rounded-lg text-xs flex items-center space-x-1 cursor-pointer active:scale-95 shadow-sm shrink-0"
                >
                  <span>View Cart</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Bottom Catalog Status Bar */}
            <div className="h-8 bg-slate-50 dark:bg-[#232323] border-t border-black/[0.06] dark:border-white/[0.06] px-4 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
              <span>Showing {filteredProducts.length} of {items.length} items</span>
              <span>Click item or <strong>+ Add</strong> / <strong>+½</strong></span>
            </div>
          </div>

          {/* RIGHT COLUMN: CART, CUSTOMER & CHECKOUT PANEL */}
          <div
            className={`w-full lg:w-[390px] xl:w-[440px] 2xl:w-[480px] flex flex-col bg-slate-50 dark:bg-[#1e1e1e] shrink-0 border-t lg:border-t-0 border-black/[0.08] dark:border-white/[0.08] ${
              mobileTab === 'cart' ? 'flex flex-1 min-h-0' : 'hidden lg:flex'
            }`}
          >
            {/* Cart Header */}
            <div className="p-3.5 bg-white dark:bg-[#252525] border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setMobileTab('catalog')}
                  className="lg:hidden p-1 -ml-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded cursor-pointer"
                  title="Back to products catalog"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <ShoppingBag className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                  Sale Cart ({totalItemsCount} items)
                </span>
              </div>

              {cart.length > 0 && (
                <div className="flex items-center space-x-1 shrink-0">
                  {confirmClearCart ? (
                    <div className="flex items-center space-x-1 animate-in fade-in duration-150">
                      <button
                        type="button"
                        onClick={handleClearCart}
                        className="text-[11px] font-bold px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white flex items-center space-x-1 cursor-pointer shadow-xs transition-colors"
                        title="Click to confirm clearing cart"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Confirm Clear?</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelClear}
                        className="text-[10px] font-medium px-1.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        title="Cancel"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleClearCart}
                      className="text-[11px] font-semibold text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 py-1 rounded dark:text-rose-400 flex items-center space-x-1 cursor-pointer transition-colors"
                      title="Clear all items in current cart"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Stock Limit Warning Notification Banner */}
            {stockWarning && (
              <div
                id="pos-stock-warning-banner"
                className="mx-3 mt-2.5 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg flex items-start justify-between gap-2 text-amber-800 dark:text-amber-300 text-xs shadow-xs animate-in fade-in slide-in-from-top-1 shrink-0"
              >
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span className="font-medium text-[11px] leading-tight">{stockWarning}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStockWarning(null)}
                  className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 text-xs px-1 cursor-pointer"
                >
                  ×
                </button>
              </div>
            )}

            {/* Customer Inputs */}
            <div className="p-3 bg-white/70 dark:bg-[#242424] border-b border-black/[0.06] dark:border-white/[0.06] space-y-2 shrink-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. John Doe / Walk-in"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-0.5">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 (555) 0192"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Order Memo / Warranty & Print Toggle */}
              <div className="pt-1.5 border-t border-black/[0.05] dark:border-white/[0.05] space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                    Receipt Memo / Warranty Terms:
                  </label>
                  <label className="inline-flex items-center space-x-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showMemoOnReceipt}
                      onChange={(e) => setShowMemoOnReceipt(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                      {showMemoOnReceipt ? 'Print on slip' : 'Do not print'}
                    </span>
                  </label>
                </div>
                <input
                  type="text"
                  placeholder={settings.receiptFooterNote || "e.g. 14-day warranty with original receipt"}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Cart Items List - SCROLLABLE CONTAINER */}
            <div className="flex-1 p-3 overflow-y-auto min-h-0 divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <div className="w-12 h-12 rounded-full bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center mb-2">
                    <ShoppingBag className="w-6 h-6 opacity-40 text-slate-400" />
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300 text-xs">Your sale cart is empty</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                    Click on product cards or the <strong>+ Add to Cart</strong> button on the left to start billing.
                  </p>
                </div>
              ) : (
                cart.map((entry) => {
                  const pricing = getItemPricing(entry.item);
                  const linePrice = entry.customPrice !== undefined ? entry.customPrice : pricing.effectivePrice;
                  const lineTotal = linePrice * entry.quantity;

                  const isAtMaxStock = entry.quantity >= entry.item.quantity;

                  return (
                    <div key={entry.item.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                          <span className="truncate">{entry.item.name}</span>
                          {pricing.isPromoActive && entry.customPrice === undefined && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[9px] font-bold shrink-0">
                              PROMO
                            </span>
                          )}
                        </div>
                        <div className="flex items-center flex-wrap gap-x-1.5 text-[10px] text-slate-500 font-mono">
                          <span>{entry.item.sku}</span>
                          <span>•</span>
                          <span className={pricing.isPromoActive ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>
                            {currencySymbol}{linePrice.toLocaleString()} / {entry.item.unit || 'ea'}
                          </span>
                          {pricing.isPromoActive && (
                            <span className="line-through text-slate-400">
                              {currencySymbol}{pricing.wholesalePrice.toLocaleString()}
                            </span>
                          )}
                          <span>•</span>
                          <span className={isAtMaxStock ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-500'}>
                            Stock: {entry.item.quantity} {isAtMaxStock && '(Max reached)'}
                          </span>
                        </div>
                      </div>

                      {/* Quantity Stepper Controls with Stock Capping and Half Crate/Pack/Carton */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(entry.item.id, +(entry.quantity - 0.5).toFixed(2))}
                          className="px-1.5 h-6 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 text-[10px] font-bold cursor-pointer"
                          title="Decrease by half (0.5)"
                        >
                          -½
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(entry.item.id, entry.quantity - 1)}
                          className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                          title="Decrease quantity by 1"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="any"
                          min="0.5"
                          max={entry.item.quantity}
                          value={entry.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (isNaN(val)) return;
                            handleUpdateQty(entry.item.id, val);
                          }}
                          className={`w-12 text-center bg-white dark:bg-slate-800 border rounded py-0.5 text-xs font-mono font-bold ${
                            isAtMaxStock
                              ? 'border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/40'
                              : 'border-black/[0.1] dark:border-white/[0.1]'
                          }`}
                          title={`Available in stock: ${entry.item.quantity} ${entry.item.unit || ''}`}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(entry.item.id, entry.quantity + 1)}
                          disabled={isAtMaxStock}
                          className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all ${
                            isAtMaxStock
                              ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60'
                              : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 cursor-pointer'
                          }`}
                          title={
                            isAtMaxStock
                              ? `Cannot add more: Max available stock reached (${entry.item.quantity} in stock)`
                              : 'Add 1 more'
                          }
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(entry.item.id, +(entry.quantity + 0.5).toFixed(2))}
                          disabled={entry.quantity + 0.5 > entry.item.quantity}
                          className={`px-1.5 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all ${
                            entry.quantity + 0.5 > entry.item.quantity
                              ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-60'
                              : 'bg-blue-100 dark:bg-blue-950/60 hover:bg-blue-200 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 cursor-pointer'
                          }`}
                          title="Add half (0.5) crate/pack/carton"
                        >
                          +½
                        </button>
                      </div>

                      <div className="min-w-[65px] text-right font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                        {currencySymbol}{lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(entry.item.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Payment Method Selector & Tender Bar */}
            <div className="p-3 bg-white dark:bg-[#252525] border-t border-black/[0.08] dark:border-white/[0.08] space-y-2.5 shrink-0">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {(['Cash', 'POS / Card', 'Bank Transfer', 'USSD', 'Credit / On Account'] as PaymentMethod[]).map(
                    (method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => {
                          setPaymentMethod(method);
                          if (method === 'Credit / On Account') {
                            setAmountTendered(0);
                          }
                        }}
                        className={`py-1.5 px-2 rounded-md text-[11px] font-semibold border transition-all cursor-pointer truncate ${
                          paymentMethod === method
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-800 border-black/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {method}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Tendered Cash & Discount Grid or Credit Notice */}
              {paymentMethod === 'Credit / On Account' ? (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold">
                    <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Credit / On Account (Unpaid Sale)</span>
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                    No payment collected upfront. Amount paid is <strong>{currencySymbol}0.00</strong>. Full balance of <strong>{currencySymbol}{grandTotal.toFixed(2)}</strong> will be charged to the customer's credit balance.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                      Amount Tendered ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder={`e.g. ${grandTotal.toFixed(0)}`}
                      value={amountTendered || ''}
                      onChange={(e) => setAmountTendered(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2.5 py-1 font-mono text-xs font-bold outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">
                      Order Discount ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0.00"
                      value={overallDiscount || ''}
                      onChange={(e) => setOverallDiscount(Number(e.target.value))}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2.5 py-1 font-mono text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Quick Cash Buttons */}
              {paymentMethod === 'Cash' && grandTotal > 0 && (
                <div className="flex items-center space-x-1 overflow-x-auto text-[10px] font-mono no-scrollbar">
                  <span className="text-slate-400 text-[9px] uppercase tracking-wider shrink-0">Exact:</span>
                  <button
                    type="button"
                    onClick={() => setAmountTendered(grandTotal)}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded font-semibold text-slate-700 dark:text-slate-300 shrink-0 cursor-pointer"
                  >
                    {currencySymbol}{grandTotal.toFixed(0)}
                  </button>
                  {[50, 100, 200, 500, 1000, 5000].map((amt) => {
                    if (amt < grandTotal) return null;
                    return (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setAmountTendered(amt)}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded font-semibold text-slate-700 dark:text-slate-300 shrink-0 cursor-pointer"
                      >
                        {currencySymbol}{amt}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* BILL TOTALS & ALWAYS VISIBLE CHECKOUT ACTION FOOTER */}
            <div className="p-4 bg-slate-100 dark:bg-[#1a1a1a] border-t border-black/[0.1] dark:border-white/[0.1] space-y-3 shrink-0">
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Subtotal:</span>
                  <span className="font-mono">{currencySymbol}{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                {overallDiscount > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>Discount:</span>
                    <span className="font-mono">-{currencySymbol}{overallDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>VAT / Sales Tax ({vatRate}%):</span>
                  <span className="font-mono">+{currencySymbol}{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between items-baseline pt-2 border-t border-black/[0.08] dark:border-white/[0.08]">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Grand Total:</span>
                  <span className="font-mono font-extrabold text-lg text-blue-600 dark:text-blue-400">
                    {currencySymbol}{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {paymentMethod === 'Credit / On Account' ? (
                  <div className="pt-2 border-t border-black/[0.08] dark:border-white/[0.08] space-y-1">
                    <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                      <span>Amount Paid Upfront:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{currencySymbol}0.00</span>
                    </div>
                    <div className="flex justify-between items-center text-xs font-bold text-rose-600 dark:text-rose-400">
                      <span>Balance Due (On Account):</span>
                      <span className="font-mono text-sm">
                        {currencySymbol}{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ) : (
                  amountTendered > 0 && (
                    <div className="flex justify-between items-center pt-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span>Change Due:</span>
                      <span className="font-mono font-bold text-sm">
                        {currencySymbol}{changeDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )
                )}
              </div>

              {/* ALWAYS PROMINENT CHECKOUT BUTTON */}
              <button
                type="button"
                id="pos-complete-checkout-btn"
                disabled={cart.length === 0}
                onClick={handleCompleteSale}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer ${
                  cart.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-emerald-600/20'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>Complete Sale & Print Receipt (F9)</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
