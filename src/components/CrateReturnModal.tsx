import React, { useState, useMemo } from 'react';
import {
  X,
  PackageCheck,
  Calendar,
  Layers,
  User,
  FileText,
  Trash2,
  Plus,
  CheckCircle2,
  Clock,
  Download,
  Search,
  Wine,
  ArrowDownLeft,
  ArrowUpRight,
  Scale,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { CrateReturn, AppUser, InventoryItem, AppSettings } from '../types';
import { sound } from '../utils/audio';

interface CrateReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  crateReturns: CrateReturn[];
  onSaveCrateReturn: (newReturn: Omit<CrateReturn, 'id' | 'createdAt'>) => void;
  onDeleteCrateReturn: (returnId: string) => void;
  currentUser?: AppUser;
  items?: InventoryItem[];
  settings?: AppSettings;
}

const COMMON_BRANDS = [
  'Guinness',
  'Nigerian Breweries (Star/Gulder)',
  'Heineken',
  'Trophy Lager',
  'Budweiser',
  'Coca-Cola / NBC',
  'Goldberg',
  'Life Continental',
  'Origin / Malta',
];

export const CrateReturnModal: React.FC<CrateReturnModalProps> = ({
  isOpen,
  onClose,
  crateReturns,
  onSaveCrateReturn,
  onDeleteCrateReturn,
  currentUser,
  items = [],
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<'record' | 'history'>('record');

  // Form State
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState<string>('1'); // Crates Returned (In)
  const [cratesTakenOut, setCratesTakenOut] = useState<string>('0'); // Crates Taken Out (Out)
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [customerOrRepName, setCustomerOrRepName] = useState('');
  const [bottlesPerCrate, setBottlesPerCrate] = useState<number>(24);
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // History search, filter, and delete state
  const [searchFilter, setSearchFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Summary footer collapse state
  const [isFooterCollapsed, setIsFooterCollapsed] = useState(false);

  // Summary stats (Overall totals)
  const totalCratesReturned = useMemo(() => {
    return crateReturns.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  }, [crateReturns]);

  const totalCratesTakenOut = useMemo(() => {
    return crateReturns.reduce((acc, curr) => acc + (Number(curr.cratesTakenOut) || 0), 0);
  }, [crateReturns]);

  const netCrateBalance = totalCratesReturned - totalCratesTakenOut;

  // Breakdown by item type / brand
  const brandSummaries = useMemo(() => {
    const map = new Map<string, { returned: number; takenOut: number }>();
    crateReturns.forEach((r) => {
      const b = (r.brand || 'Unspecified').trim();
      const existing = map.get(b) || { returned: 0, takenOut: 0 };
      existing.returned += Number(r.quantity) || 0;
      existing.takenOut += Number(r.cratesTakenOut) || 0;
      map.set(b, existing);
    });

    return Array.from(map.entries())
      .map(([brandName, data]) => {
        const net = data.returned - data.takenOut;
        return {
          brand: brandName,
          returned: data.returned,
          takenOut: data.takenOut,
          netBalance: net,
          status: net > 0 ? 'surplus' : net < 0 ? 'outstanding' : 'balanced',
        };
      })
      .sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance) || (b.returned + b.takenOut) - (a.returned + a.takenOut));
  }, [crateReturns]);

  const todayIso = new Date().toISOString().split('T')[0];
  const todayCratesReturned = useMemo(() => {
    return crateReturns
      .filter((r) => r.date === todayIso)
      .reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  }, [crateReturns, todayIso]);

  const todayCratesTakenOut = useMemo(() => {
    return crateReturns
      .filter((r) => r.date === todayIso)
      .reduce((acc, curr) => acc + (Number(curr.cratesTakenOut) || 0), 0);
  }, [crateReturns, todayIso]);

  // Filtered returns for history table
  const filteredReturns = useMemo(() => {
    return [...crateReturns]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.createdAt || '').localeCompare(a.createdAt || ''))
      .filter((r) => {
        if (brandFilter !== 'all' && r.brand !== brandFilter) return false;
        if (!searchFilter.trim()) return true;
        const q = searchFilter.toLowerCase();
        return (
          r.brand.toLowerCase().includes(q) ||
          (r.customerOrRepName && r.customerOrRepName.toLowerCase().includes(q)) ||
          r.date.includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q))
        );
      });
  }, [crateReturns, brandFilter, searchFilter]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanBrand = brand.trim();
    if (!cleanBrand) {
      setErrorMsg('Please specify the beverage brand or brewery.');
      return;
    }

    const qtyReturned = parseInt(quantity, 10) || 0;
    const qtyTakenOut = parseInt(cratesTakenOut, 10) || 0;

    if (qtyReturned < 0 || qtyTakenOut < 0) {
      setErrorMsg('Quantities cannot be negative numbers.');
      return;
    }

    if (qtyReturned === 0 && qtyTakenOut === 0) {
      setErrorMsg('Please enter at least 1 crate returned or 1 crate taken out.');
      return;
    }

    if (!date) {
      setErrorMsg('Please select a valid date.');
      return;
    }

    onSaveCrateReturn({
      brand: cleanBrand,
      quantity: qtyReturned,
      cratesTakenOut: qtyTakenOut,
      date,
      customerOrRepName: customerOrRepName.trim() || undefined,
      bottlesPerCrate,
      notes: notes.trim() || undefined,
      recordedBy: currentUser?.name || 'Staff User',
    });

    if (settings?.enableSoundEffects) {
      sound.playSuccessChime();
    }

    // Reset inputs
    setBrand('');
    setQuantity('1');
    setCratesTakenOut('0');
    setCustomerOrRepName('');
    setNotes('');

    const summaryParts: string[] = [];
    if (qtyReturned > 0) summaryParts.push(`${qtyReturned} returned`);
    if (qtyTakenOut > 0) summaryParts.push(`${qtyTakenOut} taken out`);
    setSuccessToast(`Successfully recorded ${summaryParts.join(' & ')} for "${cleanBrand}".`);
    setTimeout(() => setSuccessToast(''), 3500);
  };

  const handleQuickReturned = (delta: number) => {
    const curr = parseInt(quantity, 10) || 0;
    const next = Math.max(0, curr + delta);
    setQuantity(next.toString());
  };

  const handleQuickTakenOut = (delta: number) => {
    const curr = parseInt(cratesTakenOut, 10) || 0;
    const next = Math.max(0, curr + delta);
    setCratesTakenOut(next.toString());
  };

  const handleExportCSV = () => {
    if (crateReturns.length === 0) return;
    const headers = [
      'ID',
      'Brand',
      'Crates Returned (In)',
      'Crates Taken Out (Out)',
      'Net Crate Balance',
      'Bottles Per Crate',
      'Date',
      'Customer / Rep',
      'Recorded By',
      'Notes',
      'Created At',
    ];
    const rows = crateReturns.map((r) => {
      const returned = Number(r.quantity) || 0;
      const taken = Number(r.cratesTakenOut) || 0;
      const balance = returned - taken;
      return [
        r.id,
        `"${r.brand.replace(/"/g, '""')}"`,
        returned,
        taken,
        balance,
        r.bottlesPerCrate || 24,
        r.date,
        `"${(r.customerOrRepName || '').replace(/"/g, '""')}"`,
        `"${(r.recordedBy || '').replace(/"/g, '""')}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`,
        r.createdAt,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crate_returns_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-3xl bg-white dark:bg-[#1f1f1f] rounded-xl shadow-2xl border border-black/10 dark:border-white/10 flex flex-col max-h-[92vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crate-return-title"
      >
        {/* Modal Window Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/10 dark:border-white/10 bg-slate-50/80 dark:bg-[#252525]/80 select-none shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 id="crate-return-title" className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Empty Crate & Bottle Returns
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                  {totalCratesReturned} Returned / {totalCratesTakenOut} Taken Out
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Log batches of empty bottles brought back
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-5 pt-3 border-b border-black/5 dark:border-white/5 bg-slate-50/40 dark:bg-[#232323] shrink-0">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('record')}
              className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'record'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Return / Taken Out</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Return History & Logs ({crateReturns.length})</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="hidden sm:flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 pb-2.5">
            <span>Today In: <strong className="text-amber-600 dark:text-amber-400">{todayCratesReturned}</strong></span>
            <span>Today Out: <strong className="text-blue-600 dark:text-blue-400">{todayCratesTakenOut}</strong></span>
            <span>Net: <strong className={netCrateBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>{netCrateBalance > 0 ? `+${netCrateBalance}` : netCrateBalance}</strong></span>
          </div>
        </div>

        {/* Success Alert */}
        {successToast && (
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center space-x-2 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in shrink-0">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'record' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-xs text-rose-700 dark:text-rose-300">
                  {errorMsg}
                </div>
              )}

              {/* Brand Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Beverage Brand / Brewery <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Wine className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Guinness, Nigerian Breweries (Star), Trophy, Heineken..."
                    className="w-full bg-slate-50 dark:bg-[#282828] border border-black/10 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-amber-500 dark:focus:border-amber-400 text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Brand Preset Chips */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-slate-400 self-center mr-1">Quick select:</span>
                  {COMMON_BRANDS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBrand(b)}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                        brand === b
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-black/[0.07] dark:hover:bg-white/[0.08] border-black/5 dark:border-white/5'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Two Column Grid for Quantities: Crates Returned vs Crates Taken Out */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-xl bg-slate-50/80 dark:bg-[#242424]/60 border border-black/5 dark:border-white/5">
                {/* 1. Crates Returned (Empties In) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <ArrowDownLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Crates Returned (In)</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-normal">Empties returned</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickReturned(-1)}
                      className="px-2.5 py-2 rounded-lg bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.09] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-xs font-bold border border-black/5 dark:border-white/5 cursor-pointer"
                      title="Decrease by 1"
                    >
                      -
                    </button>
                    <div className="relative flex-1">
                      <Layers className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white dark:bg-[#282828] border border-amber-300 dark:border-amber-700/60 rounded-lg pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-amber-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickReturned(1)}
                      className="px-2.5 py-2 rounded-lg bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.09] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-xs font-bold border border-black/5 dark:border-white/5 cursor-pointer"
                      title="Increase by 1"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Quantity Chips */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {[1, 5, 10, 20, 50].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setQuantity(n.toString())}
                        className="text-[10px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200/60 dark:border-amber-800/40 cursor-pointer"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Crates Taken Out (Fresh / Issued) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Crates Taken Out (Out)</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-normal">Crates issued</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickTakenOut(-1)}
                      className="px-2.5 py-2 rounded-lg bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.09] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-xs font-bold border border-black/5 dark:border-white/5 cursor-pointer"
                      title="Decrease by 1"
                    >
                      -
                    </button>
                    <div className="relative flex-1">
                      <Layers className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={cratesTakenOut}
                        onChange={(e) => setCratesTakenOut(e.target.value)}
                        placeholder="0"
                        className="w-full bg-white dark:bg-[#282828] border border-blue-300 dark:border-blue-700/60 rounded-lg pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickTakenOut(1)}
                      className="px-2.5 py-2 rounded-lg bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.09] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-xs font-bold border border-black/5 dark:border-white/5 cursor-pointer"
                      title="Increase by 1"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Quantity Chips */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {[0, 1, 5, 10, 20, 50].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCratesTakenOut(n.toString())}
                        className="text-[10px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200/60 dark:border-blue-800/40 cursor-pointer"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Net Exchange Indicator */}
                <div className="sm:col-span-2 pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px]">
                    <Scale className="w-3.5 h-3.5" />
                    <span>Batch Net Crate Balance:</span>
                  </div>
                  {(() => {
                    const ret = parseInt(quantity, 10) || 0;
                    const out = parseInt(cratesTakenOut, 10) || 0;
                    const diff = ret - out;
                    if (diff === 0) {
                      return <span className="font-semibold text-slate-600 dark:text-slate-300">0 (Balanced Exchange)</span>;
                    } else if (diff > 0) {
                      return <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{diff} Net in favor of Depot (Store received more)</span>;
                    } else {
                      return <span className="font-semibold text-rose-600 dark:text-rose-400">{diff} Net in favor of Customer (Customer took more)</span>;
                    }
                  })()}
                </div>
              </div>

              {/* Date & Standard Bottles / Crate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date Picker */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Date <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setDate(new Date().toISOString().split('T')[0])}
                      className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      Set Today
                    </button>
                  </div>
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-[#282828] border border-black/10 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-amber-500 dark:focus:border-amber-400 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Standard Bottles / Crate */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Standard Bottles / Crate
                  </label>
                  <div className="flex space-x-2">
                    {[24, 12, 20].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setBottlesPerCrate(cnt)}
                        className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors cursor-pointer ${
                          bottlesPerCrate === cnt
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-black/[0.03] dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.08] border-black/10 dark:border-white/10'
                        }`}
                      >
                        {cnt} btls/crate
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Customer / Driver / Rep Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Customer / Driver / Rep
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={customerOrRepName}
                    onChange={(e) => setCustomerOrRepName(e.target.value)}
                    placeholder="e.g. customer's name"
                    className="w-full bg-slate-50 dark:bg-[#282828] border border-black/10 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-amber-500 dark:focus:border-amber-400 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Notes / Physical Inspection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Condition / Remarks (Optional)
                </label>
                <div className="relative">
                  <FileText className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. All bottles intact"
                    className="w-full bg-slate-50 dark:bg-[#282828] border border-black/10 dark:border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-amber-500 dark:focus:border-amber-400 text-slate-800 dark:text-slate-100 resize-none"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs rounded-lg font-semibold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Record Entry</span>
                </button>
              </div>
            </form>
          ) : (
            /* History & Log Tab with Crates Returned, Crates Taken Out, and Balance columns */
            <div className="space-y-3">
              {/* Filter controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 text-xs">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search brand, person, or date..."
                    className="w-full bg-white dark:bg-[#282828] border border-black/10 dark:border-white/10 rounded-md pl-8 pr-2.5 py-1 text-xs outline-none focus:border-amber-500 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="bg-white dark:bg-[#282828] border border-black/10 dark:border-white/10 rounded-md px-2 py-1 text-xs outline-none text-slate-700 dark:text-slate-200"
                  >
                    <option value="all">All Brands</option>
                    {COMMON_BRANDS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleExportCSV}
                    disabled={crateReturns.length === 0}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-medium border border-black/5 dark:border-white/5 disabled:opacity-40 cursor-pointer"
                    title="Export CSV"
                  >
                    <Download className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </button>
                </div>
              </div>

              {/* Returns List */}
              {filteredReturns.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <PackageCheck className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-500" />
                  <p className="text-xs font-medium">No crate return records found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Switch to &ldquo;Record Return / Taken Out&rdquo; above to log an empty bottle batch.
                  </p>
                </div>
              ) : (
                <div className="border border-black/10 dark:border-white/10 rounded-lg overflow-x-auto bg-white dark:bg-[#222]">
                  <table className="w-full text-left border-collapse text-xs min-w-[620px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-[#282828] border-b border-black/5 dark:border-white/5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                        <th className="py-2.5 px-3">Brand</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap text-amber-700 dark:text-amber-400">
                          Crates Returned
                        </th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap text-blue-700 dark:text-blue-400">
                          Crates Taken Out
                        </th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">
                          Balance
                        </th>
                        <th className="py-2.5 px-3">Customer / Rep</th>
                        <th className="py-2.5 px-3">Recorded By</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {filteredReturns.map((item) => {
                        const returnedQty = Number(item.quantity) || 0;
                        const takenOutQty = Number(item.cratesTakenOut) || 0;
                        const balance = returnedQty - takenOutQty;

                        return (
                          <tr key={item.id} className="hover:bg-amber-500/[0.04] transition-colors">
                            <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {item.date}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">
                              <div>{item.brand}</div>
                              {item.notes && (
                                <div className="text-[10px] text-slate-400 font-normal truncate max-w-[180px]" title={item.notes}>
                                  {item.notes}
                                </div>
                              )}
                            </td>
                            {/* Column: Crates Returned */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                                {returnedQty}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1">crates</span>
                            </td>
                            {/* Column: Crates Taken Out */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <span className={`font-bold text-xs ${takenOutQty > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                                {takenOutQty}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1">crates</span>
                            </td>
                            {/* Column: Net Balance */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-medium text-xs">
                              {balance > 0 ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                                  +{balance}
                                </span>
                              ) : balance < 0 ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                                  {balance}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">0</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                              {item.customerOrRepName || <span className="text-slate-400 italic">Direct Walk-in</span>}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                              {item.recordedBy || 'Staff'}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              {deletingId === item.id ? (
                                <div className="inline-flex items-center space-x-1.5 animate-in fade-in">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteCrateReturn(item.id);
                                      setDeletingId(null);
                                      setSuccessToast(`Deleted record for ${item.brand}`);
                                      setTimeout(() => setSuccessToast(''), 3000);
                                    }}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white cursor-pointer shadow-xs transition-colors"
                                    title="Confirm Delete"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingId(null);
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition-colors"
                                    title="Cancel"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingId(item.id);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                  title="Delete record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* History Table Summary Footer */}
                    {filteredReturns.length > 0 && (
                      <tfoot className="bg-slate-100/80 dark:bg-[#282828] border-t-2 border-black/10 dark:border-white/10 font-semibold text-xs">
                        <tr>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 dark:text-slate-200">
                            Total / Net
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 text-[11px]">
                            {brandSummaries.length} item {brandSummaries.length === 1 ? 'type' : 'types'}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap text-amber-700 dark:text-amber-400 font-bold">
                            {totalCratesReturned} <span className="text-[10px] text-slate-400 font-normal">crates</span>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap text-blue-700 dark:text-blue-400 font-bold">
                            {totalCratesTakenOut} <span className="text-[10px] text-slate-400 font-normal">crates</span>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {netCrateBalance > 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                +{netCrateBalance} Net
                              </span>
                            ) : netCrateBalance < 0 ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                                {netCrateBalance} Net
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                0
                              </span>
                            )}
                          </td>
                          <td colSpan={3} className="py-2.5 px-3 text-slate-400 text-[11px] italic">
                            Returned minus Taken Out
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary Footer: Outstanding Crate Status by Item Type / Brand */}
        <div className="border-t border-black/10 dark:border-white/10 bg-slate-50/95 dark:bg-[#1c1c1c]/95 select-none shrink-0 shadow-inner">
          <div className="px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Scale className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Outstanding Crate Status by Item Type
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {brandSummaries.length} {brandSummaries.length === 1 ? 'brand' : 'brands'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-2 text-xs">
                <span className="text-[11px] text-slate-500">Overall Net:</span>
                {netCrateBalance > 0 ? (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                    +{netCrateBalance} Crates in Depot
                  </span>
                ) : netCrateBalance < 0 ? (
                  <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800/40">
                    {netCrateBalance} Crates Outstanding (Customers Owe)
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                    0 Balanced
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsFooterCollapsed((prev) => !prev)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer transition-colors"
                title={isFooterCollapsed ? 'Expand Summary' : 'Collapse Summary'}
              >
                {isFooterCollapsed ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Brand Summary Breakdown Cards */}
          {!isFooterCollapsed && (
            <div className="px-5 pb-3 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
              {brandSummaries.length === 0 ? (
                <p className="text-[11px] text-slate-400 py-1 italic">
                  No crate movements logged yet. Record a return or crate issue above to track item balances.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[145px] overflow-y-auto pr-1">
                  {brandSummaries.map((summary) => {
                    const isSurplus = summary.netBalance > 0;
                    const isDeficit = summary.netBalance < 0;

                    return (
                      <div
                        key={summary.brand}
                        className="p-2.5 rounded-lg bg-white dark:bg-[#252525] border border-black/5 dark:border-white/5 shadow-2xs flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate" title={summary.brand}>
                            {summary.brand}
                          </span>
                          {isSurplus && (
                            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                              +{summary.netBalance}
                            </span>
                          )}
                          {isDeficit && (
                            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
                              {summary.netBalance}
                            </span>
                          )}
                          {!isSurplus && !isDeficit && (
                            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                              0
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-0.5 text-amber-700 dark:text-amber-400">
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>In: <strong>{summary.returned}</strong></span>
                          </span>
                          <span className="flex items-center gap-0.5 text-blue-700 dark:text-blue-400">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>Out: <strong>{summary.takenOut}</strong></span>
                          </span>
                        </div>

                        <div className="mt-1.5 pt-1 border-t border-black/[0.04] dark:border-white/[0.04] text-[10px]">
                          {isSurplus && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              +{summary.netBalance} crates in depot
                            </span>
                          )}
                          {isDeficit && (
                            <span className="text-rose-600 dark:text-rose-400 font-medium">
                              {Math.abs(summary.netBalance)} crates outstanding
                            </span>
                          )}
                          {!isSurplus && !isDeficit && (
                            <span className="text-slate-400">
                              Balanced (0 net)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
