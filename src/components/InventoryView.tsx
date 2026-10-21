import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  MoreHorizontal,
  Barcode,
  Edit2,
  Trash2,
  PlusCircle,
  MinusCircle,
  FileSpreadsheet,
  CheckSquare,
  Square,
  AlertTriangle,
  Boxes,
  MapPin,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingCart,
  Lock,
  X,
  AlertCircle,
} from 'lucide-react';
import { InventoryItem, AppSettings, StockStatus } from '../types';
import { getItemPricing } from '../utils/pricing';

interface InventoryViewProps {
  items: InventoryItem[];
  settings: AppSettings;
  isAdmin?: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddItem: () => void;
  onEditItem: (item: InventoryItem) => void;
  onDeleteItem: (itemId: string) => void;
  onBatchDelete: (itemIds: string[]) => void;
  onQuickStockAdjust: (item: InventoryItem, type: 'in' | 'out') => void;
  onViewBarcode: (item: InventoryItem) => void;
  onExportCSV: () => void;
  onCreatePOWithItem: (item: InventoryItem) => void;
}

type SortField = 'name' | 'sku' | 'category' | 'quantity' | 'unitCost' | 'wholesalePrice' | 'retailPrice' | 'value' | 'margin';

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  settings,
  isAdmin = true,
  searchQuery,
  onSearchChange,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onBatchDelete,
  onQuickStockAdjust,
  onViewBarcode,
  onExportCSV,
  onCreatePOWithItem,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [deleteTargetItem, setDeleteTargetItem] = useState<InventoryItem | null>(null);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState<boolean>(false);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtering & Sorting
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchSku = item.sku.toLowerCase().includes(q);
          const matchName = item.name.toLowerCase().includes(q);
          const matchCat = item.category.toLowerCase().includes(q);
          const matchLoc = item.location.toLowerCase().includes(q);
          const matchBar = (item.barcode || '').toLowerCase().includes(q);
          if (!matchSku && !matchName && !matchCat && !matchLoc && !matchBar) return false;
        }

        // Category filter
        if (selectedCategory !== 'all' && item.category !== selectedCategory) {
          return false;
        }

        // Stock status filter
        if (selectedStatus === 'low_stock') {
          if (item.quantity === 0 || item.quantity > item.minQuantity) return false;
        } else if (selectedStatus === 'out_of_stock') {
          if (item.quantity > 0) return false;
        } else if (selectedStatus === 'in_stock') {
          if (item.quantity <= item.minQuantity) return false;
        } else if (selectedStatus === 'critical') {
          if (item.quantity > item.minQuantity) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let valA: number | string = '';
        let valB: number | string = '';

        if (sortField === 'name') {
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
        } else if (sortField === 'sku') {
          valA = a.sku.toLowerCase();
          valB = b.sku.toLowerCase();
        } else if (sortField === 'category') {
          valA = a.category.toLowerCase();
          valB = b.category.toLowerCase();
        } else if (sortField === 'quantity') {
          valA = a.quantity;
          valB = b.quantity;
        } else if (sortField === 'unitCost') {
          valA = a.unitCost;
          valB = b.unitCost;
        } else if (sortField === 'wholesalePrice') {
          valA = a.wholesalePrice !== undefined && a.wholesalePrice > 0 ? a.wholesalePrice : a.retailPrice;
          valB = b.wholesalePrice !== undefined && b.wholesalePrice > 0 ? b.wholesalePrice : b.retailPrice;
        } else if (sortField === 'retailPrice') {
          valA = a.retailPrice;
          valB = b.retailPrice;
        } else if (sortField === 'value') {
          valA = a.quantity * a.unitCost;
          valB = b.quantity * b.unitCost;
        } else if (sortField === 'margin') {
          valA = a.retailPrice > 0 ? (a.retailPrice - a.unitCost) / a.retailPrice : 0;
          valB = b.retailPrice > 0 ? (b.retailPrice - b.unitCost) / b.retailPrice : 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [items, searchQuery, selectedCategory, selectedStatus, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === filteredItems.length && filteredItems.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedItemIds(next);
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto flex flex-col h-[calc(100vh-2.5rem)]">
      {/* Top Controls: Search, Filters & Main Actions */}
      <div className="space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Inventory Catalog</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {filteredItems.length} items
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage SKUs, monitor bin locations, adjust stock levels, and print barcode tags.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              id="inv-btn-export"
              onClick={onExportCSV}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 rounded-md text-xs font-medium border border-black/[0.08] dark:border-white/[0.08] transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export CSV</span>
            </button>

            {isAdmin ? (
              <button
                id="inv-btn-add"
                onClick={onAddItem}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Item</span>
              </button>
            ) : (
              <button
                disabled
                title="Only Administrator accounts have permission to add new inventory items"
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-md text-xs font-medium cursor-not-allowed border border-black/[0.06] dark:border-white/[0.06]"
              >
                <Plus className="w-4 h-4 opacity-50" />
                <span>New Item (Admin Only)</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-[#252525] border border-black/[0.08] dark:border-white/[0.08] text-xs">
          {/* Left: Search input */}
          <div className="relative min-w-[220px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Filter by SKU, name, bin..."
              className="w-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] rounded-md pl-8 pr-3 py-1 text-xs outline-none focus:border-blue-500 dark:focus:border-blue-400"
            />
          </div>

          {/* Center: Category dropdown & Status Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Category select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] rounded-md px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
            >
              <option value="all">All Categories ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Status filters */}
            <div className="flex items-center space-x-1 bg-black/[0.03] dark:bg-white/[0.05] p-0.5 rounded-md border border-black/[0.06] dark:border-white/[0.06]">
              {[
                { id: 'all', label: 'All Stock' },
                { id: 'in_stock', label: 'In Stock' },
                { id: 'low_stock', label: 'Low Stock' },
                { id: 'out_of_stock', label: 'Out of Stock' },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setSelectedStatus(st.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    selectedStatus === st.id
                      ? 'bg-white dark:bg-[#333] text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Batch Actions Bar (when items selected) */}
        {selectedItemIds.size > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-lg text-xs animate-fade-in">
            <span className="font-semibold text-blue-800 dark:text-blue-300">
              {selectedItemIds.size} {selectedItemIds.size === 1 ? 'item' : 'items'} selected
            </span>
            <div className="flex items-center space-x-2">
              {isAdmin ? (
                <button
                  onClick={() => setIsBatchDeleteModalOpen(true)}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-medium transition-colors cursor-pointer shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedItemIds.size})</span>
                </button>
              ) : (
                <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1 bg-amber-100/70 dark:bg-amber-950/40 px-2 py-1 rounded border border-amber-300 dark:border-amber-800">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Admin permission required to delete items</span>
                </span>
              )}
              <button
                onClick={() => setSelectedItemIds(new Set())}
                className="px-2 py-1 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Data Table */}
      <div className="flex-1 min-h-0 bg-white dark:bg-[#252525] rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-xs flex flex-col overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            {/* Header */}
            <thead className="sticky top-0 bg-[#f8f9fa] dark:bg-[#1e1e1e] border-b border-black/[0.08] dark:border-white/[0.08] z-20 font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3 w-10 text-center">
                  <button onClick={toggleSelectAll} className="cursor-pointer text-slate-400 hover:text-slate-600">
                    {selectedItemIds.size === filteredItems.length && filteredItems.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => handleSort('sku')}
                  className="p-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>SKU / Code</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="p-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Product Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="p-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Category</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('quantity')}
                  className="p-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Stock Level</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('unitCost')}
                  className="p-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Ex Brew Cost</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('wholesalePrice')}
                  className="p-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Whole Sale</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('retailPrice')}
                  className="p-3 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors bg-blue-50/20 dark:bg-blue-950/10"
                >
                  <div className="flex items-center space-x-1 text-blue-700 dark:text-blue-400 font-bold">
                    <span>Retail Price</span>
                    <ArrowUpDown className="w-3 h-3 text-blue-500" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('value')}
                  className="p-3 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center space-x-1">
                    <span>Total Value</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="p-3">Location</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <Boxes className="w-8 h-8 mx-auto mb-2 opacity-60 text-slate-400" />
                    <p className="font-medium text-slate-600 dark:text-slate-300">No inventory items found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting your search criteria or add a new item.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedItemIds.has(item.id);
                  const isLow = item.quantity > 0 && item.quantity <= item.minQuantity;
                  const isOut = item.quantity === 0;
                  const totalValue = item.quantity * item.unitCost;
                  const pricing = getItemPricing(item);
                  const wholesaleVal =
                    item.wholesalePrice !== undefined && item.wholesalePrice > 0
                      ? item.wholesalePrice
                      : item.retailPrice;
                  const wholesaleMarginPercent =
                    wholesaleVal > 0
                      ? (((wholesaleVal - item.unitCost) / wholesaleVal) * 100).toFixed(0)
                      : '0';
                  const effectiveRetail =
                    pricing.isPromoActive && pricing.promoPrice !== undefined
                      ? pricing.promoPrice
                      : item.retailPrice;
                  const retailMarginPercent =
                    effectiveRetail > 0
                      ? (((effectiveRetail - item.unitCost) / effectiveRetail) * 100).toFixed(0)
                      : '0';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors group ${
                        isSelected ? 'bg-blue-50/60 dark:bg-blue-950/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleSelectItem(item.id)}
                          className="cursor-pointer text-slate-400 hover:text-slate-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* SKU */}
                      <td className="p-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {item.sku}
                          </span>
                          {item.barcode && (
                            <button
                              onClick={() => onViewBarcode(item)}
                              title="View & Print Barcode Label"
                              className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                            >
                              <Barcode className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Name & Description */}
                      <td className="p-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100 max-w-[220px] truncate">
                          {item.name}
                        </div>
                        {item.description && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                            {item.description}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                          {item.category}
                        </span>
                      </td>

                      {/* Stock Level with indicator */}
                      <td className="p-3">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isOut
                                ? 'text-rose-600 dark:text-rose-400'
                                : isLow
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}
                          >
                            {item.quantity} {item.unit}
                          </span>

                          {/* Mini Status Tag */}
                          {isOut ? (
                            <span className="px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[10px] font-semibold">
                              Out
                            </span>
                          ) : isLow ? (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-semibold">
                              Low (Min: {item.minQuantity})
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Ex Brew Cost */}
                      <td className="p-3">
                        <div className="font-mono text-slate-900 dark:text-slate-100 font-medium text-xs">
                          {settings.currencySymbol}
                          {item.unitCost.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400">Brewery Cost</div>
                      </td>

                      {/* Whole Sale Price */}
                      <td className="p-3">
                        <div className="font-mono text-slate-900 dark:text-slate-100 font-semibold text-xs">
                          {settings.currencySymbol}
                          {wholesaleVal.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {wholesaleMarginPercent}% margin
                        </div>
                      </td>

                      {/* Retail Price (Dedicated Column) */}
                      <td className="p-3 bg-blue-50/20 dark:bg-blue-950/10">
                        <div className="font-mono font-bold text-xs text-blue-700 dark:text-blue-300 flex items-center flex-wrap gap-1">
                          <span className={pricing.isPromoActive ? 'line-through opacity-60 text-slate-500' : ''}>
                            {settings.currencySymbol}
                            {item.retailPrice.toFixed(2)}
                          </span>
                          {pricing.isPromoActive && pricing.promoPrice !== undefined && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[10px] font-bold border border-amber-300 dark:border-amber-700"
                              title={pricing.promoLabel || 'Promo Price Active'}
                            >
                              PROMO: {settings.currencySymbol}
                              {pricing.promoPrice.toFixed(2)}
                            </span>
                          )}
                          {!pricing.isPromoActive && pricing.promoStatus === 'upcoming' && pricing.promoPrice !== undefined && (
                            <span
                              className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-medium"
                              title={pricing.promoLabel}
                            >
                              Starts: {settings.currencySymbol}
                              {pricing.promoPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {retailMarginPercent}% margin {pricing.isPromoActive ? '(promo)' : ''}
                        </div>
                      </td>

                      {/* Total Value */}
                      <td className="p-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {settings.currencySymbol}
                        {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Location */}
                      <td className="p-3">
                        <div className="flex items-center space-x-1 text-slate-600 dark:text-slate-400 text-[11px]">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{item.location || 'Unassigned'}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {/* Fast + Stock In */}
                          {isAdmin ? (
                            <>
                              <button
                                onClick={() => onQuickStockAdjust(item, 'in')}
                                title="Quick Stock In (+)"
                                className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                              >
                                <PlusCircle className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => onQuickStockAdjust(item, 'out')}
                                title="Quick Stock Out (-)"
                                className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                              >
                                <MinusCircle className="w-4 h-4" />
                              </button>
                            </>
                          ) : null}

                          {/* Barcode */}
                          <button
                            onClick={() => onViewBarcode(item)}
                            title="View Barcode"
                            className="p-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                          >
                            <Barcode className="w-4 h-4" />
                          </button>

                          {/* Edit Item */}
                          {isAdmin ? (
                            <button
                              onClick={() => onEditItem(item)}
                              title="Edit Item Details"
                              className="p-1 rounded hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-400 transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          ) : null}

                          {/* Delete Item (Admin Only) */}
                          {isAdmin ? (
                            <button
                              onClick={() => setDeleteTargetItem(item)}
                              title="Delete Item"
                              className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span
                              title="Admin role required to edit or delete inventory items"
                              className="p-1 text-slate-300 dark:text-slate-600"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Summary Bar */}
        <div className="p-3 bg-[#f8f9fa] dark:bg-[#1e1e1e] border-t border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-mono">
          <div>
            Showing <span className="font-bold text-slate-800 dark:text-slate-200">{filteredItems.length}</span> of{' '}
            <span className="font-bold text-slate-800 dark:text-slate-200">{items.length}</span> total items
          </div>
          <div className="flex items-center space-x-4">
            <span>
              Total Units:{' '}
              <strong className="text-slate-800 dark:text-slate-200">
                {filteredItems.reduce((acc, i) => acc + i.quantity, 0).toLocaleString()}
              </strong>
            </span>
            {isAdmin ? (
              <span>
                Valuation:{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {settings.currencySymbol}
                  {filteredItems
                    .reduce((acc, i) => acc + i.quantity * i.unitCost, 0)
                    .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </span>
            ) : (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                Valuation: <span className="font-sans font-medium">Admin Restricted</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Single Item Delete Confirmation Modal */}
      {deleteTargetItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#202020] rounded-2xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-rose-950 dark:text-rose-100">
                    Delete Inventory Item
                  </h3>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                    Irreversible inventory catalog deletion
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTargetItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] space-y-1.5">
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {deleteTargetItem.name}
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                  <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                    SKU: {deleteTargetItem.sku}
                  </span>
                  <span className="bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                    Category: {deleteTargetItem.category}
                  </span>
                  <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                    Current Stock: {deleteTargetItem.quantity} {deleteTargetItem.unit}
                  </span>
                </div>
              </div>

              <p className="leading-relaxed">
                Are you sure you want to permanently delete <strong>{deleteTargetItem.name}</strong> from the catalog? This will remove the SKU from active inventory.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setDeleteTargetItem(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (deleteTargetItem) {
                    onDeleteItem(deleteTargetItem.id);
                    setDeleteTargetItem(null);
                  }
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete Item</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Confirmation Modal */}
      {isBatchDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#202020] rounded-2xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-rose-950 dark:text-rose-100">
                    Delete Multiple Items
                  </h3>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                    Batch permanent deletion
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBatchDeleteModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-900 dark:text-rose-200 font-medium">
                ⚠️ You are about to permanently delete <strong>{selectedItemIds.size}</strong> inventory items from your catalog.
              </div>

              <p className="leading-relaxed">
                This action cannot be undone. All selected SKUs will be completely removed from your active catalog.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setIsBatchDeleteModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onBatchDelete(Array.from(selectedItemIds));
                  setSelectedItemIds(new Set());
                  setIsBatchDeleteModalOpen(false);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete ({selectedItemIds.size} Items)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
