import React, { useState, useMemo } from 'react';
import {
  Printer,
  Receipt,
  Plus,
  Search,
  Calendar,
  CreditCard,
  User,
  ShoppingBag,
  DollarSign,
  Share2,
  FileSpreadsheet,
  CheckCircle2,
  Tag,
  Boxes,
  Percent,
  Trash2,
  Lock,
  Maximize2,
  AlertTriangle,
} from 'lucide-react';
import { ReceiptData, AppSettings, InventoryItem, PaymentMethod } from '../types';
import { sound } from '../utils/audio';
import { getItemPricing } from '../utils/pricing';

interface ReceiptsViewProps {
  receipts: ReceiptData[];
  items: InventoryItem[];
  settings: AppSettings;
  isAdmin?: boolean;
  onOpenReceiptModal: (receipt: ReceiptData) => void;
  onCreateNewReceipt: (receipt: ReceiptData) => void;
  onDeleteReceipt?: (receiptId: string) => void;
  onOpenPOSModal?: () => void;
}

export const ReceiptsView: React.FC<ReceiptsViewProps> = ({
  receipts,
  items,
  settings,
  isAdmin = true,
  onOpenReceiptModal,
  onCreateNewReceipt,
  onDeleteReceipt,
  onOpenPOSModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [isQuickPOSOpen, setIsQuickPOSOpen] = useState(false);
  const [deleteTargetReceipt, setDeleteTargetReceipt] = useState<ReceiptData | null>(null);

  // Quick POS State
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [quickPosWarning, setQuickPosWarning] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<{ item: InventoryItem; quantity: number }[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [amountTendered, setAmountTendered] = useState<number>(0);

  const currencySymbol = settings.currencySymbol || '$';

  const filteredReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = r.receiptNumber.toLowerCase().includes(q);
        const matchCust = (r.customerName || '').toLowerCase().includes(q);
        const matchOp = r.operator.toLowerCase().includes(q);
        const matchItem = r.items.some((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
        if (!matchNum && !matchCust && !matchOp && !matchItem) return false;
      }

      if (filterMethod !== 'all' && r.paymentMethod !== filterMethod) {
        return false;
      }

      return true;
    });
  }, [receipts, searchQuery, filterMethod]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((sum, entry) => {
      const pricing = getItemPricing(entry.item);
      return sum + pricing.effectivePrice * entry.quantity;
    }, 0);
  }, [cartItems]);

  const vatRate = settings.defaultVatRate ?? 7.5;
  const cartTax = (cartSubtotal - discountAmount) * (vatRate / 100);
  const cartGrandTotal = Math.max(0, cartSubtotal - discountAmount + cartTax);
  const changeDue = Math.max(0, amountTendered - cartGrandTotal);

  const handleAddToCart = () => {
    const itemToAdd = items.find((i) => i.id === selectedItemId);
    if (!itemToAdd) return;

    // 1. Check if completely out of stock
    if (itemToAdd.quantity <= 0) {
      setQuickPosWarning(`Cannot add "${itemToAdd.name}" to cart: Item is out of stock.`);
      if (settings.enableSoundEffects) sound.playScanBeep();
      setTimeout(() => setQuickPosWarning(null), 3500);
      return;
    }

    const existingIndex = cartItems.findIndex((c) => c.item.id === itemToAdd.id);
    if (existingIndex >= 0) {
      // 2. Check if already at maximum stock
      if (cartItems[existingIndex].quantity >= itemToAdd.quantity) {
        setQuickPosWarning(
          `Cannot add more "${itemToAdd.name}". Only ${itemToAdd.quantity} available in stock.`
        );
        if (settings.enableSoundEffects) sound.playScanBeep();
        setTimeout(() => setQuickPosWarning(null), 3500);
        return;
      }
      const updated = [...cartItems];
      updated[existingIndex].quantity = Math.min(
        itemToAdd.quantity,
        updated[existingIndex].quantity + 1
      );
      setCartItems(updated);
    } else {
      setCartItems([...cartItems, { item: itemToAdd, quantity: 1 }]);
    }
  };

  const handleUpdateCartQty = (itemId: string, qty: number) => {
    if (qty <= 0) {
      setCartItems(cartItems.filter((c) => c.item.id !== itemId));
    } else {
      setCartItems(
        cartItems.map((c) => {
          if (c.item.id !== itemId) return c;
          // Guard: Cap quantity strictly to available stock
          if (qty > c.item.quantity) {
            setQuickPosWarning(
              `Cannot exceed stock for "${c.item.name}". Capped at ${c.item.quantity} available in stock.`
            );
            if (settings.enableSoundEffects) sound.playScanBeep();
            setTimeout(() => setQuickPosWarning(null), 3500);
            return { ...c, quantity: c.item.quantity };
          }
          return { ...c, quantity: qty };
        })
      );
    }
  };

  const handleCheckoutAndPrint = () => {
    if (cartItems.length === 0) return;

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
      operator: 'POS Cashier',
      paymentMethod: paymentMethod,
      items: cartItems.map((c) => {
        const pricing = getItemPricing(c.item);
        return {
          itemId: c.item.id,
          sku: c.item.sku,
          name: c.item.name,
          quantity: c.quantity,
          unitPrice: pricing.effectivePrice,
          regularPrice: pricing.wholesalePrice,
          isPromo: pricing.isPromoActive,
          unit: c.item.unit,
          total: pricing.effectivePrice * c.quantity,
        };
      }),
      subtotal: cartSubtotal,
      taxRate: vatRate,
      taxAmount: cartTax,
      discount: discountAmount,
      grandTotal: cartGrandTotal,
      amountPaid: amountTendered > 0 ? amountTendered : cartGrandTotal,
      changeDue: amountTendered > 0 ? changeDue : 0,
      notes: settings.receiptFooterNote || 'Thank you for your purchase!',
    };

    onCreateNewReceipt(generatedReceipt);
    onOpenReceiptModal(generatedReceipt);

    // Reset Cart
    setCartItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountAmount(0);
    setAmountTendered(0);
    setIsQuickPOSOpen(false);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto flex flex-col h-[calc(100vh-2.5rem)] select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Receipts & Sales Slips</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              {filteredReceipts.length} records
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Print 80mm thermal receipts, tax invoices, and manage sales order transaction slips.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onOpenPOSModal && (
            <button
              id="receipts-btn-open-pos-modal"
              onClick={onOpenPOSModal}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              title="Open Fullscreen / Windowed POS Register (F3)"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>POS Register Terminal</span>
            </button>
          )}

          <button
            onClick={() => setIsQuickPOSOpen((prev) => !prev)}
            className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isQuickPOSOpen ? 'Hide Quick POS' : 'Quick POS'}</span>
          </button>
        </div>
      </div>

      {/* Quick POS Terminal Drawer */}
      {isQuickPOSOpen && (
        <div className="bg-white dark:bg-[#252525] rounded-xl border border-blue-200 dark:border-blue-900/40 p-3 sm:p-4 shadow-md space-y-3 shrink-0 animate-fade-in">
          <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06] pb-2">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                Quick POS Checkout & Receipt Generator
              </h3>
            </div>
            <div className="flex items-center space-x-3">
              {onOpenPOSModal && (
                <button
                  type="button"
                  onClick={onOpenPOSModal}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1 font-semibold cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Open Fullscreen POS Register</span>
                </button>
              )}
              <span className="text-[11px] text-slate-500 font-mono">
                Currency: <strong>{currencySymbol} ({settings.currency})</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
            {/* Left: Add items to Cart */}
            <div className="lg:col-span-6 space-y-3">
              {quickPosWarning && (
                <div
                  id="quick-pos-warning"
                  className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg flex items-start justify-between gap-2 text-amber-800 dark:text-amber-300 text-xs shadow-xs"
                >
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <span className="font-medium text-[11px] leading-tight">{quickPosWarning}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickPosWarning(null)}
                    className="text-amber-600 hover:text-amber-800 text-xs px-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}

              {(() => {
                const currentSelectedItem = items.find((i) => i.id === selectedItemId) || items[0];
                const currentCartEntry = cartItems.find((c) => c.item.id === currentSelectedItem?.id);
                const isSelectedOutOfStock = !currentSelectedItem || currentSelectedItem.quantity <= 0;
                const isSelectedAtMax = Boolean(
                  currentSelectedItem &&
                    currentCartEntry &&
                    currentCartEntry.quantity >= currentSelectedItem.quantity
                );

                return (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <select
                      value={selectedItemId}
                      onChange={(e) => setSelectedItemId(e.target.value)}
                      className="flex-1 min-w-0 bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2.5 py-2 text-xs outline-none focus:border-blue-500"
                    >
                      {items.map((i) => {
                        const inCartCount = cartItems.find((c) => c.item.id === i.id)?.quantity || 0;
                        const pricing = getItemPricing(i);
                        const stockLabel =
                          i.quantity <= 0
                            ? '[OUT OF STOCK]'
                            : inCartCount >= i.quantity
                            ? `[MAX IN CART: ${i.quantity}]`
                            : `[${i.quantity} in stock]`;

                        return (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.sku}) - {currencySymbol}{pricing.effectivePrice.toLocaleString()}{' '}
                            {pricing.isPromoActive ? '[PROMO] ' : ''}{stockLabel}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      id="quick-pos-add-btn"
                      onClick={handleAddToCart}
                      disabled={isSelectedOutOfStock || isSelectedAtMax}
                      className={`px-4 py-2 rounded-lg font-bold shrink-0 text-center flex items-center justify-center space-x-1 shadow-xs transition-colors ${
                        isSelectedOutOfStock
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : isSelectedAtMax
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white cursor-pointer'
                      }`}
                      title={
                        isSelectedOutOfStock
                          ? 'Item is out of stock'
                          : isSelectedAtMax
                          ? `Max stock reached in cart (${currentSelectedItem?.quantity} available)`
                          : 'Add to Cart'
                      }
                    >
                      {isSelectedOutOfStock ? (
                        <span>Out of Stock</span>
                      ) : isSelectedAtMax ? (
                        <span>Max in Cart ({currentCartEntry?.quantity})</span>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Cart</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })()}

              {/* Cart Items List */}
              <div className="border border-black/[0.08] dark:border-white/[0.08] rounded-lg max-h-48 overflow-y-auto divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {cartItems.length === 0 ? (
                  <p className="p-4 text-center text-slate-400 text-[11px]">Cart is empty. Select items to checkout.</p>
                ) : (
                  cartItems.map((entry) => {
                    const isAtMax = entry.quantity >= entry.item.quantity;
                    const pricing = getItemPricing(entry.item);

                    return (
                      <div key={entry.item.id} className="p-2.5 flex items-center justify-between gap-2">
                        <div className="truncate flex-1 min-w-0">
                          <div className="font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                            <span className="truncate">{entry.item.name}</span>
                            {pricing.isPromoActive && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[9px] font-bold shrink-0">
                                PROMO
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center space-x-2">
                            <span className={pricing.isPromoActive ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>
                              {currencySymbol}{pricing.effectivePrice.toLocaleString()} each
                            </span>
                            {pricing.isPromoActive && (
                              <span className="line-through opacity-70">
                                {currencySymbol}{pricing.wholesalePrice.toLocaleString()}
                              </span>
                            )}
                            <span>•</span>
                            <span className={isAtMax ? 'text-amber-600 dark:text-amber-400 font-bold' : ''}>
                              Stock: {entry.item.quantity} {isAtMax && '(Max reached)'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <input
                            type="number"
                            min="1"
                            max={entry.item.quantity}
                            value={entry.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (isNaN(val)) return;
                              handleUpdateCartQty(entry.item.id, val);
                            }}
                            className={`w-12 text-center bg-slate-100 dark:bg-slate-800 border rounded py-1 font-mono text-xs font-bold ${
                              isAtMax
                                ? 'border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/40'
                                : 'border-black/[0.08] dark:border-white/[0.08]'
                            }`}
                            title={`Available stock: ${entry.item.quantity}`}
                          />
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100 min-w-[60px] text-right text-xs">
                            {currencySymbol}{(pricing.effectivePrice * entry.quantity).toLocaleString()}
                          </span>
                          <button
                            onClick={() => handleUpdateCartQty(entry.item.id, 0)}
                            className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                            title="Remove from cart"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Payment & Checkout */}
            <div className="lg:col-span-6 space-y-2.5 bg-slate-50 dark:bg-slate-800/40 p-3 sm:p-4 rounded-lg border border-black/[0.04] dark:border-white/[0.04]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Customer Name (optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1.5 text-xs outline-none"
                />
                <input
                  type="text"
                  placeholder="Phone / WhatsApp"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1.5 text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1.5 text-xs outline-none cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="POS / Card">POS / Card Terminal</option>
                    <option value="Bank Transfer">Bank Transfer (NIBSS)</option>
                    <option value="USSD">USSD</option>
                    <option value="Credit / On Account">Credit</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Amount Tendered</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 5000"
                    value={amountTendered || ''}
                    onChange={(e) => setAmountTendered(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1.5 font-mono text-xs outline-none"
                  />
                </div>
              </div>

              {/* Totals Summary */}
              <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <div className="text-[11px] text-slate-500">
                    VAT ({vatRate}%): {currencySymbol}{cartTax.toFixed(2)}
                  </div>
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Total: {currencySymbol}{cartGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={cartItems.length === 0}
                  onClick={handleCheckoutAndPrint}
                  className={`flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-md font-semibold text-xs shadow-xs transition-all cursor-pointer w-full sm:w-auto ${
                    cartItems.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Printer className="w-4 h-4" />
                  <span>Checkout & Print Receipt</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-[#252525] border border-black/[0.08] dark:border-white/[0.08] text-xs shrink-0">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search receipt #, customer, cashier, product..."
            className="w-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] rounded-md pl-8 pr-3 py-1 text-xs outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] rounded-md px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="POS / Card">POS / Card Terminal</option>
            <option value="Bank Transfer">Bank Transfer (NIBSS)</option>
            <option value="USSD">USSD</option>
            <option value="Credit / On Account">Credit</option>
          </select>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="flex-1 min-h-0 bg-white dark:bg-[#252525] rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-xs flex flex-col overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#f8f9fa] dark:bg-[#1e1e1e] border-b border-black/[0.08] dark:border-white/[0.08] z-10 font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3">Receipt #</th>
                <th className="p-3">Date & Time</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Items Summary</th>
                <th className="p-3">Payment Method</th>
                <th className="p-3 text-right">Grand Total</th>
                <th className="p-3">Cashier / Staff</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-60 text-slate-400" />
                    <p className="font-medium text-slate-600 dark:text-slate-300">No receipts found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Complete sales in POS or print directly from the Stock Ledger.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((rec) => (
                  <tr key={rec.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {rec.receiptNumber}
                    </td>

                    <td className="p-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {new Date(rec.date).toLocaleDateString()} {new Date(rec.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                      {rec.customerName || 'Walk-in Customer'}
                      {rec.customerPhone && (
                        <span className="block text-[10px] text-slate-400">{rec.customerPhone}</span>
                      )}
                    </td>

                    <td className="p-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                      {rec.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                    </td>

                    <td className="p-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                        {rec.paymentMethod}
                      </span>
                    </td>

                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {currencySymbol}{rec.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="p-3 text-slate-600 dark:text-slate-400">
                      {rec.operator}
                    </td>

                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => onOpenReceiptModal(rec)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-300 rounded font-semibold text-xs transition-colors cursor-pointer"
                          title="Print / View Receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Receipt</span>
                        </button>

                        {isAdmin && onDeleteReceipt ? (
                          <button
                            onClick={() => setDeleteTargetReceipt(rec)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                            title="Delete Receipt Record (Admin Only)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* In-App Delete Receipt Confirmation Modal */}
      {deleteTargetReceipt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#222] rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-rose-950 dark:text-rose-100">
                    Delete Receipt Record
                  </h3>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                    Admin Transaction Audit Removal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTargetReceipt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Are you sure you want to permanently delete receipt <strong className="text-slate-900 dark:text-slate-100">{deleteTargetReceipt.receiptNumber}</strong>?
              </p>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] space-y-1">
                <div>Customer: {deleteTargetReceipt.customerName || 'Walk-in Customer'}</div>
                <div>Grand Total: <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{currencySymbol}{deleteTargetReceipt.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                <div>Payment Method: {deleteTargetReceipt.paymentMethod}</div>
                <div>Date: {new Date(deleteTargetReceipt.date).toLocaleString()}</div>
              </div>
            </div>

            <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteTargetReceipt(null)}
                className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] cursor-pointer font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteReceipt) {
                    onDeleteReceipt(deleteTargetReceipt.id);
                  }
                  setDeleteTargetReceipt(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-lg shadow-xs cursor-pointer text-xs flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
