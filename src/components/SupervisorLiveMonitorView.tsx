import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  Radio,
  Shield,
  Eye,
  Truck,
  DollarSign,
  Building2,
  Users,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Filter,
  Search,
  Volume2,
  VolumeX,
  ExternalLink,
  Laptop,
  Smartphone,
  Sparkles,
  RefreshCw,
  Landmark,
  FileSpreadsheet,
} from 'lucide-react';
import {
  AppUser,
  AppSettings,
  SupervisorPresence,
  ActivityEvent,
  SalesRepDispatch,
  DailyExpense,
  BankDeposit,
  ReceiptData,
  StockMovement,
  ViewTab,
} from '../types';

interface SupervisorLiveMonitorViewProps {
  currentUser: AppUser;
  users: AppUser[];
  settings: AppSettings;
  presences: SupervisorPresence[];
  activityEvents: ActivityEvent[];
  dispatches: SalesRepDispatch[];
  expenses: DailyExpense[];
  deposits: BankDeposit[];
  receipts: ReceiptData[];
  movements: StockMovement[];
  onNavigateTab: (tab: ViewTab) => void;
  onRefreshData?: () => void;
}

export const SupervisorLiveMonitorView: React.FC<SupervisorLiveMonitorViewProps> = ({
  currentUser,
  users,
  settings,
  presences,
  activityEvents,
  dispatches,
  expenses,
  deposits,
  receipts,
  movements,
  onNavigateTab,
  onRefreshData,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAudioAlertEnabled, setIsAudioAlertEnabled] = useState(false);
  const [prevEventCount, setPrevEventCount] = useState(activityEvents.length);

  // Sound chime when a new event arrives if enabled
  useEffect(() => {
    if (isAudioAlertEnabled && activityEvents.length > prevEventCount) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.36);
      } catch (err) {
        console.warn('Audio alert error:', err);
      }
    }
    setPrevEventCount(activityEvents.length);
  }, [activityEvents.length, prevEventCount, isAudioAlertEnabled]);

  // Today's date string YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  // Live Metrics Calculations
  const todayReceipts = useMemo(() => {
    return receipts.filter((r) => r.date.startsWith(todayStr));
  }, [receipts, todayStr]);

  const todayGrossSales = useMemo(() => {
    return todayReceipts.reduce((acc, r) => acc + (r.grandTotal || 0), 0);
  }, [todayReceipts]);

  const todayCashSales = useMemo(() => {
    return todayReceipts
      .filter((r) => r.paymentMethod === 'Cash')
      .reduce((acc, r) => acc + (r.grandTotal || 0), 0);
  }, [todayReceipts]);

  const todayTransferSales = useMemo(() => {
    return todayReceipts
      .filter((r) => r.paymentMethod === 'Bank Transfer')
      .reduce((acc, r) => acc + (r.grandTotal || 0), 0);
  }, [todayReceipts]);

  const todayPOSSales = useMemo(() => {
    return todayReceipts
      .filter((r) => r.paymentMethod === 'POS / Card')
      .reduce((acc, r) => acc + (r.grandTotal || 0), 0);
  }, [todayReceipts]);

  const todayExpensesTotal = useMemo(() => {
    return expenses
      .filter((e) => e.date === todayStr)
      .reduce((acc, e) => acc + (e.amount || 0), 0);
  }, [expenses, todayStr]);

  const todayDepositsTotal = useMemo(() => {
    return deposits
      .filter((d) => d.date === todayStr)
      .reduce((acc, d) => acc + (d.amount || 0), 0);
  }, [deposits, todayStr]);

  const netSalesDueFromDispatches = useMemo(() => {
    return dispatches
      .filter((d) => d.status === 'active')
      .reduce((acc, d) => acc + (d.totalSumTaken || 0), 0);
  }, [dispatches]);

  const activeRepDispatchesCount = useMemo(() => {
    return dispatches.filter((d) => d.status === 'active').length;
  }, [dispatches]);

  // Supervisors & Admins List
  const supervisorsAndAdmins = useMemo(() => {
    return users.filter((u) => u.role === 'admin' || u.role === 'supervisor');
  }, [users]);

  // Filtered Activity Stream (Synthesized from recorded events + live operations)
  const unifiedActivities = useMemo(() => {
    const stream: ActivityEvent[] = [...activityEvents];

    // Synthesize latest dispatches into events if not present
    dispatches.slice(0, 20).forEach((d) => {
      const exists = stream.some((e) => e.referenceId === d.id);
      if (!exists) {
        stream.push({
          id: `disp_${d.id}`,
          timestamp: d.createdAt || new Date().toISOString(),
          type: 'dispatch',
          title: `Field Stock Dispatched (${d.dispatchNumber})`,
          description: `Rep ${d.repName} took ${d.itemsTaken?.length || 0} product lines for outward sales.`,
          amount: d.totalSumTaken,
          operator: d.dispatchedBy || 'Warehouse Auditor',
          location: 'Dispatch Hub',
          status: d.status === 'active' ? 'warning' : 'success',
          referenceId: d.id,
        });

        if (d.status === 'reconciled' && d.reconciledAt) {
          stream.push({
            id: `rec_${d.id}`,
            timestamp: d.reconciledAt,
            type: 'reconciliation',
            title: `Return Reconciled (${d.dispatchNumber})`,
            description: `Rep ${d.repName}: returned ${settings.currencySymbol}${(d.totalUnsoldReturnedValue || 0).toLocaleString()} unsold, remitted ${settings.currencySymbol}${(d.totalAmountRemitted || 0).toLocaleString()}.`,
            amount: d.netSalesDue,
            operator: d.receivedAndAuditedBy || 'Audit Supervisor',
            location: 'Audit Desk',
            status: (d.shortageOrExcess || 0) < 0 ? 'warning' : 'success',
            referenceId: d.id,
          });
        }
      }
    });

    // Synthesize latest receipts
    receipts.slice(0, 15).forEach((r) => {
      const exists = stream.some((e) => e.referenceId === r.id);
      if (!exists) {
        stream.push({
          id: `rcpt_${r.id}`,
          timestamp: r.date || new Date().toISOString(),
          type: 'sale',
          title: `POS Receipt ${r.receiptNumber}`,
          description: `Customer sale of ${r.items?.length || 1} items paid via ${r.paymentMethod}.`,
          amount: r.grandTotal,
          operator: r.operator,
          location: 'Counter POS',
          status: 'success',
          referenceId: r.id,
        });
      }
    });

    // Synthesize latest expenses
    expenses.slice(0, 15).forEach((ex) => {
      const exists = stream.some((e) => e.referenceId === ex.id);
      if (!exists) {
        stream.push({
          id: `exp_${ex.id}`,
          timestamp: `${ex.date}T${ex.time || '12:00:00'}`,
          type: 'expense',
          title: `Expense: ${ex.category}`,
          description: ex.description || 'Operational cost deduction',
          amount: ex.amount,
          operator: ex.recordedBy || 'Manager',
          location: 'Operations',
          status: 'info',
          referenceId: ex.id,
        });
      }
    });

    // Synthesize latest deposits
    deposits.slice(0, 15).forEach((dp) => {
      const exists = stream.some((e) => e.referenceId === dp.id);
      if (!exists) {
        stream.push({
          id: `dep_${dp.id}`,
          timestamp: `${dp.date}T${dp.time || '14:00:00'}`,
          type: 'deposit',
          title: `Bank Deposit: ${dp.bankName}`,
          description: `Deposited via ${dp.depositMethod} by ${dp.depositorName} (Ref: ${dp.referenceNumber || 'N/A'})`,
          amount: dp.amount,
          operator: dp.depositorName,
          location: 'Finance',
          status: 'success',
          referenceId: dp.id,
        });
      }
    });

    // Sort descending by timestamp
    stream.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return stream;
  }, [activityEvents, dispatches, receipts, expenses, deposits, settings.currencySymbol]);

  // Filter and search stream
  const filteredStream = useMemo(() => {
    return unifiedActivities.filter((act) => {
      const matchesFilter =
        filterType === 'all'
          ? true
          : filterType === 'dispatch'
          ? act.type === 'dispatch' || act.type === 'reconciliation'
          : filterType === 'sale'
          ? act.type === 'sale'
          : filterType === 'expense'
          ? act.type === 'expense'
          : filterType === 'deposit'
          ? act.type === 'deposit'
          : true;

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        act.title.toLowerCase().includes(q) ||
        act.description.toLowerCase().includes(q) ||
        act.operator.toLowerCase().includes(q) ||
        (act.location && act.location.toLowerCase().includes(q));

      return matchesFilter && matchesSearch;
    });
  }, [unifiedActivities, filterType, searchQuery]);

  return (
    <div className="w-full h-full overflow-y-auto bg-[#f6f7f9] dark:bg-[#19191a] text-slate-800 dark:text-slate-100 p-3 sm:p-5 lg:p-6 pb-28">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* Top Header & Supervisory Radar Banner */}
        <div className="bg-white dark:bg-[#222224] rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-3.5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <Radio className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    Real-Time Supervisory Control Hub
                  </h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-ping" />
                    LIVE SYNC ACTIVE
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Multi-location monitoring for 1 Administrator & 2–3 Field/Branch Supervisors in real time via Firestore.
                </p>
              </div>
            </div>

            {/* Quick Action Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsAudioAlertEnabled(!isAudioAlertEnabled)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-colors cursor-pointer ${
                  isAudioAlertEnabled
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
                title="Toggle audio alert chime when transactions or field dispatches occur"
              >
                {isAudioAlertEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Alert Chime: ON</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5" />
                    <span>Alert Chime: OFF</span>
                  </>
                )}
              </button>

              {onRefreshData && (
                <button
                  onClick={onRefreshData}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Cloud</span>
                </button>
              )}

              <button
                onClick={() => onNavigateTab('sales_rep_dispatch')}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Supervise Dispatches</span>
              </button>
            </div>
          </div>

          {/* Connected Supervisors & Locations Radar Grid */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Supervisory Staff & Branch Presence (Multi-Location Active)</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {supervisorsAndAdmins.length} Supervised Station Profiles Configured
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {supervisorsAndAdmins.map((user) => {
                const presence = presences.find((p) => p.userId === user.id);
                const isOnline = presence !== undefined || user.id === currentUser.id;
                const isCurrent = user.id === currentUser.id;

                return (
                  <div
                    key={user.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? 'bg-blue-50/60 dark:bg-blue-950/25 border-blue-200 dark:border-blue-900/60'
                        : isOnline
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 opacity-80'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                              user.role === 'admin'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                        </div>
                        <div className="overflow-hidden">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                              {user.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] bg-blue-600 text-white font-bold px-1 rounded">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center space-x-1 truncate">
                            <Building2 className="w-2.5 h-2.5 shrink-0" />
                            <span>{user.location || (user.role === 'admin' ? 'Headquarters' : 'Field Branch')}</span>
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          user.role === 'admin'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200'
                            : 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200'
                        }`}
                      >
                        {user.role === 'admin' ? 'Admin' : 'Supervisor'}
                      </span>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 flex items-center space-x-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{isOnline ? 'Active Now' : 'Offline'}</span>
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        {isCurrent ? 'Current Station' : isOnline ? 'Live Feed Connected' : 'Last Session Logged'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Real-time Business Metrics Deck */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Today's Gross Sales */}
          <div className="bg-white dark:bg-[#222224] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Today's Gross Sales</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
              {settings.currencySymbol}{todayGrossSales.toLocaleString()}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Cash: {settings.currencySymbol}{todayCashSales.toLocaleString()}</span>
              <span>Transfer: {settings.currencySymbol}{todayTransferSales.toLocaleString()}</span>
            </div>
          </div>

          {/* Card 2: Field Reps Outside Stock */}
          <div className="bg-white dark:bg-[#222224] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Field Dispatches</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
              {settings.currencySymbol}{netSalesDueFromDispatches.toLocaleString()}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="font-semibold text-amber-700 dark:text-amber-300">
                {activeRepDispatchesCount} sales rep{activeRepDispatchesCount === 1 ? '' : 's'} outside
              </span>
              <button
                onClick={() => onNavigateTab('sales_rep_dispatch')}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center space-x-0.5"
              >
                <span>Audit</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Card 3: Today's Operating Expenses */}
          <div className="bg-white dark:bg-[#222224] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Operating Expenses Subtracted</span>
              <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
              -{settings.currencySymbol}{todayExpensesTotal.toLocaleString()}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Fuel, Repairs & Misc</span>
              <button
                onClick={() => onNavigateTab('sales_recap')}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center space-x-0.5"
              >
                <span>Recap</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Card 4: Verified Bank Deposits */}
          <div className="bg-white dark:bg-[#222224] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Today's Bank Deposits</span>
              <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-purple-600 dark:text-purple-400">
              {settings.currencySymbol}{todayDepositsTotal.toLocaleString()}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span>Cash & Transfers Deposited</span>
              <button
                onClick={() => onNavigateTab('sales_recap')}
                className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center space-x-0.5"
              >
                <span>Reconcile</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Live Supervisory Operations Stream & Audit Feed */}
        <div className="bg-white dark:bg-[#222224] rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Stream Header & Filters */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-blue-600" />
                <span>Live Operational Activity Stream</span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-600 dark:text-slate-400">
                  {filteredStream.length} Events
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Every sale, outward dispatch, returned stock audit, expense deduction, and deposit updates here across all branches in real time.
              </p>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-blue-500 w-44 sm:w-52"
                />
              </div>

              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-semibold">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'dispatch', label: 'Dispatches' },
                  { id: 'sale', label: 'Sales' },
                  { id: 'expense', label: 'Expenses' },
                  { id: 'deposit', label: 'Deposits' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id)}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      filterType === f.id
                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Stream Feed List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[550px] overflow-y-auto">
            {filteredStream.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Radio className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                  No activity events match your filter criteria.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  New sales, dispatches, and ledger movements will appear here automatically.
                </p>
              </div>
            ) : (
              filteredStream.map((act) => {
                const isDispatch = act.type === 'dispatch';
                const isRecon = act.type === 'reconciliation';
                const isSale = act.type === 'sale';
                const isExpense = act.type === 'expense';
                const isDeposit = act.type === 'deposit';

                return (
                  <div
                    key={act.id}
                    className="p-3.5 sm:p-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start space-x-3">
                      {/* Event Type Icon */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isDispatch
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300'
                            : isRecon
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : isSale
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300'
                            : isExpense
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                            : isDeposit
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {isDispatch && <Truck className="w-4 h-4" />}
                        {isRecon && <CheckCircle2 className="w-4 h-4" />}
                        {isSale && <Receipt className="w-4 h-4" />}
                        {isExpense && <ArrowDownLeft className="w-4 h-4" />}
                        {isDeposit && <Landmark className="w-4 h-4" />}
                      </div>

                      {/* Event Details */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                            {act.title}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                              act.status === 'success'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                : act.status === 'warning'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {act.type.replace('_', ' ')}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          {act.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1.5">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                          <span className="flex items-center space-x-1 font-medium text-slate-600 dark:text-slate-300">
                            <Users className="w-3 h-3" />
                            <span>Logged by {act.operator}</span>
                          </span>
                          {act.location && (
                            <span className="flex items-center space-x-1">
                              <Building2 className="w-3 h-3" />
                              <span>{act.location}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Monetary Amount & Action Link */}
                    <div className="text-right shrink-0">
                      {act.amount !== undefined && (
                        <div
                          className={`text-xs sm:text-sm font-black font-mono ${
                            isExpense
                              ? 'text-rose-600 dark:text-rose-400'
                              : isDeposit
                              ? 'text-purple-600 dark:text-purple-400'
                              : isDispatch
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {isExpense ? '-' : ''}
                          {settings.currencySymbol}
                          {act.amount.toLocaleString()}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          if (isDispatch || isRecon) onNavigateTab('sales_rep_dispatch');
                          else if (isSale) onNavigateTab('receipts');
                          else if (isExpense || isDeposit) onNavigateTab('sales_recap');
                        }}
                        className="mt-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center space-x-0.5 cursor-pointer"
                      >
                        <span>Inspect</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
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
