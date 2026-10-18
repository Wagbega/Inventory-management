import React from 'react';
import {
  DollarSign,
  Package,
  AlertTriangle,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Boxes,
  ShoppingCart,
  ScanLine,
  FileSpreadsheet,
  Layers,
  Clock,
  ChevronRight,
  ShieldCheck,
  Zap,
  Cloud,
  ShoppingBag,
  Receipt,
  Building2,
  Wallet,
  Lock,
  Truck,
} from 'lucide-react';
import { InventoryItem, StockMovement, AppSettings, ViewTab, ReceiptData, DailyExpense, BankDeposit, SalesRepDispatch } from '../types';

export const NairaIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M6 4v16" />
    <path d="M6 5.5l12 13" />
    <path d="M18 4v16" />
    <path d="M3.5 10h17" />
    <path d="M3.5 14h17" />
  </svg>
);

interface DashboardViewProps {
  items: InventoryItem[];
  movements: StockMovement[];
  settings: AppSettings;
  isAdmin?: boolean;
  onNavigateTab: (tab: ViewTab) => void;
  onOpenAddItem: () => void;
  onOpenScanner: () => void;
  onOpenQuickStockAdjust: (item: InventoryItem, type: 'in' | 'out') => void;
  onExportCSV: () => void;
  onOpenCloudBackup?: () => void;
  onOpenPOSRegister?: () => void;
  receipts?: ReceiptData[];
  expenses?: DailyExpense[];
  bankDeposits?: BankDeposit[];
  salesRepDispatches?: SalesRepDispatch[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  items,
  movements,
  settings,
  isAdmin = true,
  onNavigateTab,
  onOpenAddItem,
  onOpenScanner,
  onOpenQuickStockAdjust,
  onExportCSV,
  onOpenCloudBackup,
  onOpenPOSRegister,
  receipts = [],
  expenses = [],
  bankDeposits = [],
  salesRepDispatches = [],
}) => {
  // Key Metrics Calculations
  const totalCostValue = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const totalRetailValue = items.reduce((sum, item) => sum + item.quantity * item.retailPrice, 0);
  const potentialProfit = totalRetailValue - totalCostValue;
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  const lowStockItems = items.filter((item) => item.quantity > 0 && item.quantity <= item.minQuantity);
  const outOfStockItems = items.filter((item) => item.quantity === 0);
  const healthyItems = items.filter((item) => item.quantity > item.minQuantity);

  const avgMargin =
    items.length > 0
      ? items.reduce((sum, item) => {
          if (item.retailPrice <= 0) return sum;
          return sum + ((item.retailPrice - item.unitCost) / item.retailPrice) * 100;
        }, 0) / items.length
      : 0;

  // Category breakdown
  const categoryMap = new Map<string, { count: number; value: number; units: number }>();
  items.forEach((item) => {
    const cat = item.category || 'Uncategorized';
    const current = categoryMap.get(cat) || { count: 0, value: 0, units: 0 };
    categoryMap.set(cat, {
      count: current.count + 1,
      value: current.value + item.quantity * item.unitCost,
      units: current.units + item.quantity,
    });
  });

  const categories = Array.from(categoryMap.entries()).sort((a, b) => b[1].value - a[1].value);

  // Recent movements
  const recentMovements = movements.slice(0, 6);

  // Today's Sales & Expenses Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todayReceipts = receipts.filter((r) => r.date && r.date.split('T')[0] === todayStr);
  const todayGrossSales = todayReceipts.reduce((sum, r) => sum + (r.grandTotal || r.amountPaid || 0), 0);
  const todayCashSales = todayReceipts
    .filter((r) => (r.paymentMethod || '').toLowerCase().includes('cash'))
    .reduce((sum, r) => sum + (r.grandTotal || r.amountPaid || 0), 0);
  const todayTransferSales = todayReceipts
    .filter((r) => (r.paymentMethod || '').toLowerCase().includes('transfer') || (r.paymentMethod || '').toLowerCase().includes('ussd'))
    .reduce((sum, r) => sum + (r.grandTotal || r.amountPaid || 0), 0);
  const todayPOSSales = todayReceipts
    .filter((r) => (r.paymentMethod || '').toLowerCase().includes('pos') || (r.paymentMethod || '').toLowerCase().includes('card'))
    .reduce((sum, r) => sum + (r.grandTotal || r.amountPaid || 0), 0);

  const todayExpenses = expenses.filter((e) => e.date === todayStr);
  const todayTotalExpenses = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const todayNetSales = todayGrossSales - todayTotalExpenses;

  const todayDeposits = bankDeposits.filter((d) => d.date === todayStr);
  const todayTotalDeposited = todayDeposits.reduce((sum, d) => sum + (d.amount || 0), 0);

  // Field Sales Reps Metrics
  const activeRepDispatches = salesRepDispatches.filter((d) => d.status === 'active');
  const activeRepsCount = activeRepDispatches.length;
  const activeRepsGoodsValue = activeRepDispatches.reduce((sum, d) => sum + d.totalSumTaken, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Inventory Overview</span>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              Live Telemetry
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time stock valuation, critical replenishment alerts, and warehouse throughput.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="dash-btn-sales-rep"
            onClick={() => onNavigateTab('sales_rep_dispatch')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-md text-xs font-semibold border border-amber-200 dark:border-amber-800/60 transition-colors cursor-pointer"
            title="Field Sales Rep Stock Dispatches & Returns"
          >
            <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Field Sales Reps</span>
            {activeRepsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                {activeRepsCount}
              </span>
            )}
          </button>
          <button
            id="dash-btn-sales-recap"
            onClick={() => onNavigateTab('sales_recap')}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-md text-xs font-semibold border border-blue-200 dark:border-blue-800/60 transition-colors cursor-pointer"
            title="Open Daily Sales Recap, Expenses & Bank Deposits"
          >
            <Receipt className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Daily Sales & Expenses</span>
          </button>
          {onOpenPOSRegister && (
            <button
              id="dash-btn-pos-register"
              onClick={onOpenPOSRegister}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title="Open POS Register & Quick Sales (F3)"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>POS Register (F3)</span>
            </button>
          )}
          <button
            id="dash-btn-new-item"
            onClick={onOpenAddItem}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>New Item</span>
          </button>
          <button
            id="dash-btn-scan"
            onClick={onOpenScanner}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 rounded-md text-xs font-medium border border-black/[0.08] dark:border-white/[0.08] transition-colors cursor-pointer"
          >
            <ScanLine className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Barcode Scanner</span>
          </button>
          <button
            id="dash-btn-export"
            onClick={onExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 rounded-md text-xs font-medium border border-black/[0.08] dark:border-white/[0.08] transition-colors cursor-pointer"
            title="Export Inventory as CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV</span>
          </button>
          {onOpenCloudBackup && (
            <button
              id="dash-btn-cloud-backup"
              onClick={onOpenCloudBackup}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-md text-xs font-medium border border-purple-200 dark:border-purple-800/60 transition-colors cursor-pointer"
              title="Dev (Cloud Password Protected)"
            >
              <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Dev</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Cost Value / Asset Value (Admin Only) */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#252525] border border-black/[0.08] dark:border-white/[0.08] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Asset Value</span>
            <div className={`w-8 h-8 rounded-lg ${isAdmin ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'} flex items-center justify-center`}>
              {isAdmin ? <NairaIcon className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-500" />}
            </div>
          </div>
          {isAdmin ? (
            <>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                {settings.currencySymbol}
                {totalCostValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  +{settings.currencySymbol}{potentialProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span>potential profit at retail</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-xl font-bold tracking-tight text-slate-400 dark:text-slate-500 font-mono flex items-center space-x-1.5">
                <span>••••••••</span>
              </div>
              <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Admin Restricted Access</span>
              </div>
            </>
          )}
        </div>

        {/* Total Stock Units */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#252525] border border-black/[0.08] dark:border-white/[0.08] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Stock Count</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
            {totalUnits.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-400">units</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Across <span className="font-semibold text-slate-700 dark:text-slate-300">{items.length}</span> unique SKU catalog items
          </div>
        </div>

        {/* Critical Alerts */}
        <div
          onClick={() => onNavigateTab('inventory')}
          className={`p-4 rounded-xl border shadow-xs transition-all cursor-pointer ${
            lowStockItems.length + outOfStockItems.length > 0
              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300/60 dark:border-amber-800/40 hover:border-amber-400'
              : 'bg-white dark:bg-[#252525] border-black/[0.08] dark:border-white/[0.08]'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Low / Depleted Stock
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-400 font-mono">
            {lowStockItems.length + outOfStockItems.length}
          </div>
          <div className="mt-2 text-[11px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
            <span>
              {outOfStockItems.length} out of stock, {lowStockItems.length} low
            </span>
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Avg Profit Margin (Admin Only) */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#252525] border border-black/[0.08] dark:border-white/[0.08] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Gross Margin</span>
            <div className={`w-8 h-8 rounded-lg ${isAdmin ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'} flex items-center justify-center`}>
              {isAdmin ? <TrendingUp className="w-4 h-4" /> : <Lock className="w-4 h-4 text-amber-500" />}
            </div>
          </div>
          {isAdmin ? (
            <>
              <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                {avgMargin.toFixed(1)}%
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Optimal margin threshold</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-xl font-bold tracking-tight text-slate-400 dark:text-slate-500 font-mono">
                ••••%
              </div>
              <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Admin Restricted Access</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Daily Sales & Expenses Reconciliation Quick Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-emerald-50/70 dark:from-slate-900 dark:via-indigo-950/20 dark:to-emerald-950/20 border border-blue-200/70 dark:border-white/[0.08] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Today's Daily Sales & Expenses Balancing</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Live Audit
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Gross sales by channel (Cash/Transfer/POS) minus all operational expenses.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('sales_recap')}
            className="self-start sm:self-auto flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            <span>Open Full Recap & Audit Sheet</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3.5">
          {/* Today's Gross Sales */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Gross Daily Sales
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
              {settings.currencySymbol}{todayGrossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              Cash: {settings.currencySymbol}{todayCashSales.toLocaleString()} | Trans: {settings.currencySymbol}{todayTransferSales.toLocaleString()}
            </div>
          </div>

          {/* Today's Deductions */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-500 block mb-1">
              Expenses Deducted
            </span>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">
              -{settings.currencySymbol}{todayTotalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              {todayExpenses.length} expense voucher(s) logged
            </div>
          </div>

          {/* Today's Net Sales */}
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block mb-1">
              Net Sales (Take-Home)
            </span>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono">
              {settings.currencySymbol}{todayNetSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[10px] text-emerald-800 dark:text-emerald-400 font-medium">
              Sales minus operational expenses
            </div>
          </div>

          {/* Today's Bank Deposits */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 block mb-1">
              Deposited in Bank
            </span>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              {settings.currencySymbol}{todayTotalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              {todayDeposits.length} deposit slip(s) recorded
            </div>
          </div>
        </div>
      </div>

      {/* Field Sales Reps Outside Sales Banner */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#252525] border border-amber-200/80 dark:border-amber-900/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Field Sales Reps (Outside Sales & Stock In Transit)
              </h3>
              {activeRepsCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {activeRepsCount} Active Rep(s) Outside
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  All Reps Reconciled
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {activeRepsCount > 0
                ? `${activeRepsCount} sales rep(s) currently outside with ${settings.currencySymbol}${activeRepsGoodsValue.toLocaleString(undefined, { minimumFractionDigits: 2 })} worth of stock. Returns will be deducted upon settlement.`
                : 'Manage products taken by reps for sales outside. Total sum is tracked and unsold returns are deducted upon return.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => onNavigateTab('sales_rep_dispatch')}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <span>{activeRepsCount > 0 ? 'Reconcile Rep Returns' : 'Manage Rep Dispatches'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Middle Grid: Stock Health + Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stock Health Visual Bar */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#252525] border border-black/[0.08] dark:border-white/[0.08] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Stock Health Ratio
            </h3>
            <span className="text-[11px] font-mono text-slate-400">{items.length} SKUs</span>
          </div>

          {/* Multi-segment Progress Bar */}
          <div className="w-full h-4 rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden p-0.5 gap-0.5">
            <div
              style={{ width: `${items.length > 0 ? (healthyItems.length / items.length) * 100 : 0}%` }}
              className="h-full bg-emerald-500 rounded-l-full transition-all"
              title={`Healthy: ${healthyItems.length}`}
            />
            <div
              style={{ width: `${items.length > 0 ? (lowStockItems.length / items.length) * 100 : 0}%` }}
              className="h-full bg-amber-500 transition-all"
              title={`Low Stock: ${lowStockItems.length}`}
            />
            <div
              style={{ width: `${items.length > 0 ? (outOfStockItems.length / items.length) * 100 : 0}%` }}
              className="h-full bg-rose-500 rounded-r-full transition-all"
              title={`Out of Stock: ${outOfStockItems.length}`}
            />
          </div>

          {/* Health Legend */}
          <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-black/[0.04] dark:border-white/[0.04]">
              <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Healthy</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-800 dark:text-slate-200 mt-1">
                {healthyItems.length}
              </div>
            </div>

            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-black/[0.04] dark:border-white/[0.04]">
              <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Low</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-800 dark:text-slate-200 mt-1">
                {lowStockItems.length}
              </div>
            </div>

            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-black/[0.04] dark:border-white/[0.04]">
              <div className="flex items-center space-x-1.5 text-rose-600 dark:text-rose-400 font-medium text-[11px]">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Depleted</span>
              </div>
              <div className="text-base font-bold font-mono text-slate-800 dark:text-slate-200 mt-1">
                {outOfStockItems.length}
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('inventory')}
            className="w-full py-1.5 px-3 rounded text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200 dark:border-blue-900 transition-colors flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>View Full Inventory Catalog</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {/* Category Value / Quantity Distribution */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#252525] border border-black/[0.08] dark:border-white/[0.08] shadow-xs lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <span>{isAdmin ? 'Valuation by Category' : 'Stock Units by Category'}</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              {isAdmin ? 'Ranked by Asset Worth' : 'Ranked by Quantity'}
            </span>
          </div>

          <div className="space-y-2.5 pt-1">
            {categories.slice(0, 5).map(([catName, data]) => {
              const percent = isAdmin
                ? (totalCostValue > 0 ? (data.value / totalCostValue) * 100 : 0)
                : (totalUnits > 0 ? (data.units / totalUnits) * 100 : 0);
              return (
                <div key={catName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{catName}</span>
                    <div className="flex items-center space-x-3 text-[11px] font-mono">
                      <span className="text-slate-400">{data.units} units ({data.count} items)</span>
                      {isAdmin ? (
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {settings.currencySymbol}
                          {data.value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                          {percent.toFixed(0)}% of stock
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${percent}%` }}
                      className="h-full bg-blue-500 rounded-full transition-all"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Critical Low Stock Items + Recent Movement Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Low Stock Action List */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#252525] border border-black/[0.08] dark:border-white/[0.08] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Attention Required (Restock Needed)</span>
            </h3>
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              {lowStockItems.length + outOfStockItems.length} items
            </span>
          </div>

          {lowStockItems.length + outOfStockItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
              <span>All inventory items are currently above minimum threshold.</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {[...outOfStockItems, ...lowStockItems].slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {item.name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 bg-white dark:bg-slate-700 px-1 rounded border border-black/[0.05] dark:border-white/[0.05]">
                        {item.sku}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Location: {item.location}</span>
                      <span>•</span>
                      <span>Min Required: {item.minQuantity} {item.unit}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                        item.quantity === 0
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {item.quantity} {item.unit}
                    </span>

                    <button
                      onClick={() => onOpenQuickStockAdjust(item, 'in')}
                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                      title="Quick Stock In (+)"
                    >
                      + Stock In
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Movements Activity Feed */}
        <div className="p-5 rounded-xl bg-white dark:bg-[#252525] border border-black/[0.08] dark:border-white/[0.08] shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Recent Stock Movements</span>
            </h3>
            <button
              onClick={() => onNavigateTab('movements')}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>Full Ledger</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {recentMovements.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No recent stock movements recorded yet.
              </div>
            ) : (
              recentMovements.map((mov) => {
                const isIn = mov.quantityDelta > 0;
                return (
                  <div
                    key={mov.id}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          isIn
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isIn ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                          {mov.itemName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {mov.operator} • {new Date(mov.timestamp).toLocaleDateString()} {new Date(mov.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-mono font-bold ${
                          isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isIn ? `+${mov.quantityDelta}` : mov.quantityDelta}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Bal: {mov.newQuantity}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
