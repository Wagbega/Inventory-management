import React, { useState, useEffect } from 'react';
import {
  Boxes,
  X,
  Sparkles,
  Barcode,
  DollarSign,
  MapPin,
  Truck,
  Layers,
  AlertTriangle,
  Tag,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { InventoryItem, Supplier, AppSettings } from '../types';
import { getItemPricing } from '../utils/pricing';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit: InventoryItem | null;
  suppliers: Supplier[];
  categories: string[];
  settings: AppSettings;
  onSave: (item: InventoryItem) => void;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  itemToEdit,
  suppliers,
  categories,
  settings,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    sku: '',
    name: '',
    category: 'General',
    quantity: 0,
    minQuantity: 5,
    maxQuantity: 50,
    unitCost: 0,
    retailPrice: 0,
    hasPromo: false,
    promoPrice: undefined,
    promoStartDate: '',
    promoEndDate: '',
    location: 'Main Aisle - Bin 01',
    supplierId: suppliers[0]?.id || '',
    barcode: '',
    unit: 'units',
    description: '',
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setFormError(null);
    if (itemToEdit) {
      setFormData({
        ...itemToEdit,
        hasPromo: Boolean(itemToEdit.hasPromo && itemToEdit.promoPrice && itemToEdit.promoPrice > 0),
      });
    } else {
      // Auto-generate fresh SKU
      const randomSku = 'SKU-' + Math.floor(1000 + Math.random() * 9000);
      setFormData({
        sku: randomSku,
        name: '',
        category: categories[0] || 'Hardware',
        quantity: 10,
        minQuantity: 5,
        maxQuantity: 50,
        unitCost: 25.0,
        retailPrice: 45.0,
        hasPromo: false,
        promoPrice: undefined,
        promoStartDate: '',
        promoEndDate: '',
        location: 'Bay 1 - Shelf A1',
        supplierId: suppliers[0]?.id || '',
        barcode: randomSku,
        unit: 'units',
        description: '',
        notes: '',
      });
    }
  }, [itemToEdit, isOpen, categories, suppliers]);

  const generateNewSku = () => {
    const prefix = formData.category
      ? formData.category.substring(0, 3).toUpperCase()
      : 'SKU';
    const newSku = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData((prev) => ({ ...prev, sku: newSku, barcode: newSku }));
  };

  const handlePriceChange = (cost: number, wholesale: number) => {
    setFormData((prev) => ({
      ...prev,
      unitCost: cost,
      retailPrice: wholesale,
    }));
  };

  const applyPromoPreset = (preset: 'this_week' | 'next_7_days' | 'this_month' | 'next_30_days') => {
    const now = new Date();
    const fmtDate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'this_week') {
      const day = now.getDay(); // 0 Sun .. 6 Sat
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setFormData((prev) => ({
        ...prev,
        promoStartDate: fmtDate(monday),
        promoEndDate: fmtDate(sunday),
      }));
    } else if (preset === 'next_7_days') {
      const end = new Date(now);
      end.setDate(now.getDate() + 6);
      setFormData((prev) => ({
        ...prev,
        promoStartDate: fmtDate(now),
        promoEndDate: fmtDate(end),
      }));
    } else if (preset === 'this_month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setFormData((prev) => ({
        ...prev,
        promoStartDate: fmtDate(firstDay),
        promoEndDate: fmtDate(lastDay),
      }));
    } else if (preset === 'next_30_days') {
      const end = new Date(now);
      end.setDate(now.getDate() + 29);
      setFormData((prev) => ({
        ...prev,
        promoStartDate: fmtDate(now),
        promoEndDate: fmtDate(end),
      }));
    }
  };

  const margin =
    formData.retailPrice && formData.retailPrice > 0
      ? (((formData.retailPrice - (formData.unitCost || 0)) / formData.retailPrice) * 100).toFixed(1)
      : '0';

  const promoMargin =
    formData.hasPromo && formData.promoPrice && formData.promoPrice > 0
      ? (((formData.promoPrice - (formData.unitCost || 0)) / formData.promoPrice) * 100).toFixed(1)
      : null;

  const livePricingPreview = getItemPricing({
    id: 'preview',
    sku: formData.sku || 'SKU',
    name: formData.name || 'Item',
    category: formData.category || 'General',
    quantity: formData.quantity || 0,
    minQuantity: formData.minQuantity || 5,
    unitCost: Number(formData.unitCost) || 0,
    retailPrice: Number(formData.retailPrice) || 0,
    hasPromo: Boolean(formData.hasPromo),
    promoPrice: formData.hasPromo && formData.promoPrice ? Number(formData.promoPrice) : undefined,
    promoStartDate: formData.hasPromo ? formData.promoStartDate : undefined,
    promoEndDate: formData.hasPromo ? formData.promoEndDate : undefined,
    location: formData.location || 'Bay 1',
    unit: formData.unit || 'units',
    lastRestocked: '',
    createdAt: '',
    updatedAt: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.sku?.trim() || !formData.name?.trim()) {
      setFormError('Please provide both SKU and Product Name.');
      return;
    }

    if (formData.hasPromo) {
      if (!formData.promoPrice || Number(formData.promoPrice) <= 0) {
        setFormError('Please enter a valid Promo Price greater than 0, or turn off Promo Pricing.');
        return;
      }
      if (
        formData.promoStartDate &&
        formData.promoEndDate &&
        formData.promoEndDate < formData.promoStartDate
      ) {
        setFormError('Promo End Date cannot be earlier than Promo Start Date.');
        return;
      }
    }

    const enablePromo = Boolean(formData.hasPromo && formData.promoPrice && Number(formData.promoPrice) > 0);

    const item: InventoryItem = {
      id: itemToEdit ? itemToEdit.id : 'item_' + Math.random().toString(36).substring(2, 9),
      sku: formData.sku.trim(),
      name: formData.name.trim(),
      category: formData.category || 'General',
      quantity: Number(formData.quantity) || 0,
      minQuantity: Number(formData.minQuantity) || 5,
      maxQuantity: formData.maxQuantity ? Number(formData.maxQuantity) : undefined,
      unitCost: Number(formData.unitCost) || 0,
      retailPrice: Number(formData.retailPrice) || 0,
      hasPromo: enablePromo,
      promoPrice: enablePromo ? Number(formData.promoPrice) : undefined,
      promoStartDate: enablePromo && formData.promoStartDate ? formData.promoStartDate : undefined,
      promoEndDate: enablePromo && formData.promoEndDate ? formData.promoEndDate : undefined,
      location: formData.location || 'Bay 1',
      supplierId: formData.supplierId,
      barcode: formData.barcode || formData.sku,
      unit: formData.unit || 'units',
      description: formData.description,
      notes: formData.notes,
      lastRestocked: itemToEdit?.lastRestocked || new Date().toISOString().split('T')[0],
      createdAt: itemToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(item);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-[#222222] rounded-xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {itemToEdit ? 'Edit Inventory Item' : 'New Catalog SKU Item'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Configure item details, Ex Brew price, Whole Sale price, and optional Promo schedule
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Row 1: SKU & Generate Button & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  SKU Identifier *
                </label>
                <button
                  type="button"
                  onClick={generateNewSku}
                  className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Auto-generate</span>
                </button>
              </div>
              <input
                type="text"
                required
                value={formData.sku || ''}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-2 text-xs font-mono font-bold outline-none focus:border-blue-500"
                placeholder="e.g. BRW-LAGER-24"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Category *
              </label>
              <input
                type="text"
                list="category-suggestions"
                required
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-2 text-xs outline-none focus:border-blue-500"
                placeholder="Select or enter category..."
              />
              <datalist id="category-suggestions">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 2: Product Name */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Product / Item Name *
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-2 text-xs outline-none focus:border-blue-500 font-medium"
              placeholder="e.g. Premium Lager Crate (24x330ml)"
            />
          </div>

          {/* Row 3: Stock Quantity, Min Threshold, Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-black/[0.04] dark:border-white/[0.04]">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Current Stock Level
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.quantity ?? 0}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="w-full bg-white dark:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs font-mono font-bold outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-amber-700 dark:text-amber-400 mb-1">
                Min Stock Reorder Alert
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.minQuantity ?? 5}
                onChange={(e) => setFormData({ ...formData, minQuantity: Number(e.target.value) })}
                className="w-full bg-white dark:bg-[#2b2b2b] border border-amber-300/50 dark:border-amber-700/50 rounded-md px-3 py-1.5 text-xs font-mono outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Unit of Measure
              </label>
              <select
                value={formData.unit || 'units'}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full bg-white dark:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs outline-none"
              >
                <option value="units">units</option>
                <option value="pcs">pcs</option>
                <option value="crate">crate</option>
                <option value="crates">crates</option>
                <option value="boxes">boxes</option>
                <option value="cartons">cartons</option>
                <option value="packs">packs</option>
                <option value="kits">kits</option>
                <option value="kg">kg</option>
                <option value="bags">bags</option>
                <option value="rolls">rolls</option>
                {formData.unit && !['units', 'pcs', 'crate', 'crates', 'boxes', 'cartons', 'packs', 'kits', 'kg', 'bags', 'rolls'].includes(formData.unit) && (
                  <option value={formData.unit}>{formData.unit}</option>
                )}
              </select>
            </div>
          </div>

          {/* Row 4: Ex Brew Price, Whole Sale Price & Margin */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-black/[0.06] dark:border-white/[0.06] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ex Brew Price ({settings.currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.unitCost ?? 0}
                  onChange={(e) => handlePriceChange(Number(e.target.value), formData.retailPrice || 0)}
                  className="w-full bg-white dark:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs font-mono outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400">Direct Brewery / Cost Price</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Whole Sale Price ({settings.currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.retailPrice ?? 0}
                  onChange={(e) => handlePriceChange(formData.unitCost || 0, Number(e.target.value))}
                  className="w-full bg-white dark:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs font-mono font-bold outline-none focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-400">Standard Selling Price</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Standard Margin
                </label>
                <div className="h-8 flex items-center justify-between px-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-mono font-bold text-xs border border-emerald-200 dark:border-emerald-800">
                  <span>{margin}%</span>
                  <span className="text-[10px] font-normal">
                    +{settings.currencySymbol}
                    {Math.max(0, (formData.retailPrice || 0) - (formData.unitCost || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Promo Pricing Toggle & Schedule */}
            <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.hasPromo)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      const today = new Date().toISOString().split('T')[0];
                      setFormData((prev) => ({
                        ...prev,
                        hasPromo: checked,
                        promoPrice:
                          checked && (!prev.promoPrice || prev.promoPrice <= 0)
                            ? Math.max(0, Number(((prev.retailPrice || 0) * 0.95).toFixed(2)))
                            : prev.promoPrice,
                        promoStartDate: checked && !prev.promoStartDate ? today : prev.promoStartDate,
                      }));
                    }}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Enable Promo Price (Promo Week / Month)</span>
                  </span>
                </label>

                {formData.hasPromo && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      livePricingPreview.isPromoActive
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {livePricingPreview.isPromoActive
                      ? `ACTIVE AT CHECKOUT (${settings.currencySymbol}${livePricingPreview.effectivePrice.toLocaleString()})`
                      : livePricingPreview.promoStatus === 'upcoming'
                      ? `SCHEDULED (${livePricingPreview.promoLabel})`
                      : livePricingPreview.promoStatus === 'expired'
                      ? `EXPIRED (Uses Whole Sale ${settings.currencySymbol}${livePricingPreview.wholesalePrice.toLocaleString()})`
                      : 'INACTIVE'}
                  </span>
                )}
              </div>

              {formData.hasPromo && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 space-y-3 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-amber-900 dark:text-amber-300 mb-1">
                        Promo Price ({settings.currencySymbol}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required={Boolean(formData.hasPromo)}
                        value={formData.promoPrice ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            promoPrice: e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        placeholder="e.g. 40.00"
                        className="w-full bg-white dark:bg-[#2b2b2b] border border-amber-300 dark:border-amber-700 rounded-md px-3 py-1.5 text-xs font-mono font-bold text-amber-900 dark:text-amber-200 outline-none focus:border-amber-500"
                      />
                      {promoMargin !== null && (
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                          Promo Margin: {promoMargin}%
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Promo Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.promoStartDate || ''}
                        onChange={(e) => setFormData({ ...formData, promoStartDate: e.target.value })}
                        className="w-full bg-white dark:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs font-mono outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Promo End Date
                      </label>
                      <input
                        type="date"
                        value={formData.promoEndDate || ''}
                        onChange={(e) => setFormData({ ...formData, promoEndDate: e.target.value })}
                        className="w-full bg-white dark:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs font-mono outline-none"
                      />
                    </div>
                  </div>

                  {/* Quick Promo Week / Month Presets */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Quick Schedule:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => applyPromoPreset('this_week')}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-[10px] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                      >
                        Promo Week (Mon–Sun)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPromoPreset('next_7_days')}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-[10px] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                      >
                        7 Days from Today
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPromoPreset('this_month')}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-[10px] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                      >
                        Promo Month (This Month)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPromoPreset('next_30_days')}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-[10px] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                      >
                        30 Days
                      </button>
                    </div>

                    <span className="text-[10px] text-slate-500">
                      Auto-switches to Whole Sale price when promo ends
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 5: Location & Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Warehouse Bin / Location Coordinates
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md pl-8 pr-3 py-2 text-xs outline-none"
                  placeholder="e.g. Bay 3 - Shelf A2"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Primary Supplier / Vendor
              </label>
              <select
                value={formData.supplierId || ''}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-2 text-xs outline-none"
              >
                <option value="">No linked supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.leadTimeDays}d lead)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 6: Barcode String & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Optical Barcode String (Optional)
              </label>
              <div className="relative">
                <Barcode className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={formData.barcode || ''}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md pl-8 pr-3 py-2 text-xs font-mono outline-none"
                  placeholder="Defaults to SKU if blank"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Short Description / Specs
              </label>
              <input
                type="text"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-2 text-xs outline-none"
                placeholder="Key specifications or notes..."
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-black/[0.08] dark:border-white/[0.08] flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {itemToEdit ? 'Save Changes' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

