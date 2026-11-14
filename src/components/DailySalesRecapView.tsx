import React, { useState, useMemo } from 'react';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  CreditCard,
  Building2,
  Receipt,
  Plus,
  Trash2,
  Printer,
  ChevronLeft,
  ChevronRight,
  Zap,
  Fuel,
  Wrench,
  HelpCircle,
  Home,
  Users,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Car,
  User,
  FileText,
  Clock,
  Send,
  X,
  PieChart,
  Coins,
  Phone,
  ArrowDownLeft,
  UserCheck,
} from 'lucide-react';
import {
  ReceiptData,
  AppSettings,
  AppUser,
  DailyExpense,
  BankDeposit,
  ExpenseCategory,
  PaymentMethod,
  CreditCustomerPayment,
} from '../types';
import { sound } from '../utils/audio';

interface DailySalesRecapViewProps {
  receipts: ReceiptData[];
  expenses: DailyExpense[];
  bankDeposits: BankDeposit[];
  creditPayments?: CreditCustomerPayment[];
  settings: AppSettings;
  currentUser?: AppUser;
  isAdmin?: boolean;
  onAddExpense: (expense: Omit<DailyExpense, 'id' | 'createdAt'>) => void;
  onDeleteExpense: (expenseId: string) => void;
  onAddDeposit: (deposit: Omit<BankDeposit, 'id' | 'createdAt'>) => void;
  onDeleteDeposit: (depositId: string) => void;
  onAddCreditPayment?: (payment: Omit<CreditCustomerPayment, 'id' | 'createdAt'>) => void;
  onDeleteCreditPayment?: (paymentId: string) => void;
  onOpenReceipt?: (receipt: ReceiptData) => void;
}

const POPULAR_BANKS = [
  'Access Bank',
  'Guaranty Trust Bank (GTB)',
  'Zenith Bank',
  'First Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Fidelity Bank',
  'Stanbic IBTC Bank',
  'Moniepoint MFB',
  'OPay (Paycom)',
  'Kuda Bank',
  'Wema Bank / ALAT',
  'Union Bank',
  'Ecobank',
  'Sterling Bank',
  'FCMB',
  'Polaris Bank',
];

const EXPENSE_CATEGORY_META: Record<
  ExpenseCategory,
  { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string }
> = {
  electricity: {
    label: 'Electricity',
    icon: Zap,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
  },
  vehicle_fuel: {
    label: 'Vehicle Fuel',
    icon: Fuel,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60',
  },
  vehicle_repair: {
    label: 'Vehicle Repair',
    icon: Wrench,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60',
  },
  miscellaneous: {
    label: 'Miscellaneous',
    icon: HelpCircle,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60',
  },
  home_expenses: {
    label: 'Home Expenses',
    icon: Home,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
  },
  salary: {
    label: 'Salary / Wages',
    icon: Users,
    color: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60',
  },
  other: {
    label: 'Other Operating Cost',
    icon: Wallet,
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
  },
};

export const DailySalesRecapView: React.FC<DailySalesRecapViewProps> = ({
  receipts,
  expenses,
  bankDeposits,
  creditPayments = [],
  settings,
  currentUser,
  isAdmin = true,
  onAddExpense,
  onDeleteExpense,
  onAddDeposit,
  onDeleteDeposit,
  onAddCreditPayment,
  onDeleteCreditPayment,
  onOpenReceipt,
}) => {
  // Selected Date state (defaults to today in local YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [activeSection, setActiveSection] = useState<'all' | 'sales' | 'credit_repayments' | 'deposits' | 'expenses'>('all');
  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isAddDepositModalOpen, setIsAddDepositModalOpen] = useState(false);
  const [isCreditPaymentModalOpen, setIsCreditPaymentModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Expense Form State
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('electricity');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expDescription, setExpDescription] = useState<string>('');
  const [expPaymentSource, setExpPaymentSource] = useState<'Cash Sales' | 'Bank Transfer' | 'POS Terminal' | 'Other'>('Cash Sales');
  const [expVehicleNumber, setExpVehicleNumber] = useState<string>('');
  const [expDriverName, setExpDriverName] = useState<string>('');
  const [expRecipientName, setExpRecipientName] = useState<string>('');
  const [expVoucherNo, setExpVoucherNo] = useState<string>('');
  const [expenseFormError, setExpenseFormError] = useState<string | null>(null);

  // Deposit Form State
  const [depAmount, setDepAmount] = useState<string>('');
  const [depMethod, setDepMethod] = useState<'cash' | 'transfer'>('cash');
  const [depBankName, setDepBankName] = useState<string>('First Bank of Nigeria');
  const [depCustomBank, setDepCustomBank] = useState<string>('');
  const [depDepositorName, setDepDepositorName] = useState<string>(currentUser?.name || '');
  const [depRefNumber, setDepRefNumber] = useState<string>('');
  const [depNotes, setDepNotes] = useState<string>('');
  const [depositFormError, setDepositFormError] = useState<string | null>(null);

  // Credit Customer Debt Repayment Form State (Debt recovery only, strictly no tips)
  const [creditPaymentCustomer, setCreditPaymentCustomer] = useState<string>('');
  const [creditPaymentPhone, setCreditPaymentPhone] = useState<string>('');
  const [creditPaymentSelectedReceiptId, setCreditPaymentSelectedReceiptId] = useState<string>('');
  const [creditPaymentAmount, setCreditPaymentAmount] = useState<string>('');
  const [creditPaymentMethod, setCreditPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'POS / Card'>('Cash');
  const [creditPaymentNotes, setCreditPaymentNotes] = useState<string>('');
  const [creditPaymentFormError, setCreditPaymentFormError] = useState<string | null>(null);

  const currencySymbol = settings.currencySymbol || '₦';

  // Quick Date Navigation
  const handleShiftDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    const ny = dateObj.getFullYear();
    const nm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const nd = String(dateObj.getDate()).padStart(2, '0');
    setSelectedDate(`${ny}-${nm}-${nd}`);
  };

  const handleSetToday = () => {
    const d = new Date();
    const ny = d.getFullYear();
    const nm = String(d.getMonth() + 1).padStart(2, '0');
    const nd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${ny}-${nm}-${nd}`);
  };

  // Filter Data for the selected day
  const dayReceipts = useMemo(() => {
    return receipts.filter((r) => {
      if (!r.date) return false;
      const recDate = r.date.split('T')[0];
      return recDate === selectedDate;
    });
  }, [receipts, selectedDate]);

  const dayExpenses = useMemo(() => {
    return expenses.filter((e) => e.date === selectedDate);
  }, [expenses, selectedDate]);

  const dayDeposits = useMemo(() => {
    return bankDeposits.filter((d) => d.date === selectedDate);
  }, [bankDeposits, selectedDate]);

  // --- SALES CALCULATIONS ---
  const salesMetrics = useMemo(() => {
    let totalCash = 0;
    let totalTransfer = 0;
    let totalPOS = 0;
    let totalOther = 0;
    let grossSales = 0;
    let cashCount = 0;
    let transferCount = 0;
    let posCount = 0;

    dayReceipts.forEach((r) => {
      const amt = Number(r.grandTotal || r.amountPaid || 0);
      grossSales += amt;
      const m = (r.paymentMethod || '').toLowerCase();

      if (m.includes('cash')) {
        totalCash += amt;
        cashCount++;
      } else if (m.includes('transfer') || m.includes('ussd')) {
        totalTransfer += amt;
        transferCount++;
      } else if (m.includes('pos') || m.includes('card')) {
        totalPOS += amt;
        posCount++;
      } else {
        totalOther += amt;
      }
    });

    return {
      grossSales,
      totalCash,
      totalTransfer,
      totalPOS,
      totalOther,
      cashCount,
      transferCount,
      posCount,
      receiptCount: dayReceipts.length,
    };
  }, [dayReceipts]);

  // --- EXPENSE CALCULATIONS ---
  const expenseMetrics = useMemo(() => {
    let totalExpenses = 0;
    let cashPaidExpenses = 0;
    let transferPaidExpenses = 0;
    const byCategory: Record<ExpenseCategory, number> = {
      electricity: 0,
      vehicle_fuel: 0,
      vehicle_repair: 0,
      miscellaneous: 0,
      home_expenses: 0,
      salary: 0,
      other: 0,
    };

    dayExpenses.forEach((exp) => {
      const amt = Number(exp.amount || 0);
      totalExpenses += amt;
      if (byCategory[exp.category] !== undefined) {
        byCategory[exp.category] += amt;
      } else {
        byCategory.other += amt;
      }

      if (exp.paymentSource === 'Cash Sales') {
        cashPaidExpenses += amt;
      } else if (exp.paymentSource === 'Bank Transfer') {
        transferPaidExpenses += amt;
      }
    });

    return {
      totalExpenses,
      cashPaidExpenses,
      transferPaidExpenses,
      byCategory,
      count: dayExpenses.length,
    };
  }, [dayExpenses]);

  // --- BANK DEPOSIT CALCULATIONS ---
  const depositMetrics = useMemo(() => {
    let totalDeposited = 0;
    let cashDeposited = 0;
    let transferDeposited = 0;

    dayDeposits.forEach((dep) => {
      const amt = Number(dep.amount || 0);
      totalDeposited += amt;
      if (dep.depositMethod === 'cash') {
        cashDeposited += amt;
      } else {
        transferDeposited += amt;
      }
    });

    return {
      totalDeposited,
      cashDeposited,
      transferDeposited,
      count: dayDeposits.length,
    };
  }, [dayDeposits]);

  const dayCreditPayments = useMemo(() => {
    return creditPayments.filter((p) => p.date === selectedDate);
  }, [creditPayments, selectedDate]);

  // Outstanding credit receipts across the system for debt repayment linking
  const outstandingCreditReceipts = useMemo(() => {
    return receipts.filter((r) => {
      const m = (r.paymentMethod || '').toLowerCase();
      const isCredit = m.includes('credit') || m.includes('account');
      const hasBalance = r.balanceDue !== undefined && r.balanceDue > 0;
      return isCredit || hasBalance;
    });
  }, [receipts]);

  const handleSelectCreditReceipt = (receiptId: string) => {
    setCreditPaymentSelectedReceiptId(receiptId);
    if (!receiptId) return;
    const found = receipts.find((r) => r.id === receiptId);
    if (found) {
      if (found.customerName) setCreditPaymentCustomer(found.customerName);
      if (found.customerPhone) setCreditPaymentPhone(found.customerPhone);
      const remainingDue = found.balanceDue !== undefined ? found.balanceDue : found.grandTotal;
      if (remainingDue > 0) {
        setCreditPaymentAmount(String(remainingDue));
      }
    }
  };

  // --- CREDIT CUSTOMER DEBT REPAYMENT CALCULATIONS ---
  const creditPaymentMetrics = useMemo(() => {
    let totalCollected = 0;
    let cashCollected = 0;
    let transferCollected = 0;
    let posCollected = 0;

    dayCreditPayments.forEach((p) => {
      const amt = Number(p.amount || 0);
      totalCollected += amt;
      const m = (p.paymentMethod || '').toLowerCase();
      if (m.includes('cash')) {
        cashCollected += amt;
      } else if (m.includes('transfer')) {
        transferCollected += amt;
      } else if (m.includes('pos') || m.includes('card')) {
        posCollected += amt;
      }
    });

    return {
      totalCollected,
      cashCollected,
      transferCollected,
      posCollected,
      count: dayCreditPayments.length,
    };
  }, [dayCreditPayments]);

  // --- NET RECONCILIATION ---
  // 1. Total Daily Inflow: Gross Sales + Debt Repayments collected from past credit customers
  const totalRevenueInflow = salesMetrics.grossSales + creditPaymentMetrics.totalCollected;
  // Net daily revenue (Inflows minus all daily expenses):
  const netDailySales = totalRevenueInflow - expenseMetrics.totalExpenses;

  // 2. Cash Drawer Reconciliation:
  // (Cash from Sales + Cash from Credit Debt Repayments) - Cash Expenses Paid - Cash Deposited to Bank
  const totalCashDrawerInflow = salesMetrics.totalCash + creditPaymentMetrics.cashCollected;
  const estimatedCashInHand = totalCashDrawerInflow - expenseMetrics.cashPaidExpenses - depositMetrics.cashDeposited;

  // 3. Overall Net Remaining vs Deposited:
  const undepositedBalance = netDailySales - depositMetrics.totalDeposited;

  // Submit Credit Debt Repayment Form (Strictly debt repayment, no tips)
  const handleSaveCreditPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(creditPaymentAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setCreditPaymentFormError('Please enter a valid repayment amount greater than 0.');
      return;
    }
    if (!creditPaymentCustomer.trim()) {
      setCreditPaymentFormError('Please enter the customer name.');
      return;
    }

    const linkedReceipt = creditPaymentSelectedReceiptId
      ? receipts.find((r) => r.id === creditPaymentSelectedReceiptId)
      : undefined;

    onAddCreditPayment?.({
      date: selectedDate,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customerName: creditPaymentCustomer.trim(),
      customerPhone: creditPaymentPhone.trim() || undefined,
      receiptId: linkedReceipt?.id,
      receiptNumber: linkedReceipt?.receiptNumber,
      amount: parsedAmt,
      paymentMethod: creditPaymentMethod,
      notes: creditPaymentNotes.trim() || undefined,
      recordedBy: currentUser?.name || 'Cashier',
    });

    if (settings.enableSoundEffects) sound.playSuccessChime();
    // Reset Form
    setCreditPaymentCustomer('');
    setCreditPaymentPhone('');
    setCreditPaymentSelectedReceiptId('');
    setCreditPaymentAmount('');
    setCreditPaymentMethod('Cash');
    setCreditPaymentNotes('');
    setCreditPaymentFormError(null);
    setIsCreditPaymentModalOpen(false);
  };

  // Submit Expense Form
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(expAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setExpenseFormError('Please enter a valid expense amount greater than 0.');
      return;
    }
    if (!expDescription.trim()) {
      setExpenseFormError('Please enter a brief description for this expense.');
      return;
    }
    if (expCategory === 'vehicle_repair' && !expVehicleNumber.trim()) {
      setExpenseFormError('Vehicle Number / Plate Number is required for vehicle repairs.');
      return;
    }

    onAddExpense({
      date: selectedDate,
      category: expCategory,
      amount: parsedAmt,
      description: expDescription.trim(),
      paymentSource: expPaymentSource,
      vehicleNumber: expCategory === 'vehicle_repair' ? expVehicleNumber.trim() : undefined,
      driverName: expCategory === 'vehicle_repair' ? expDriverName.trim() : undefined,
      recipientName: expRecipientName.trim() || undefined,
      receiptOrVoucherNo: expVoucherNo.trim() || undefined,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      recordedBy: currentUser?.name || 'Staff',
    });

    if (settings.enableSoundEffects) sound.playSuccessChime();
    // Reset Form
    setExpAmount('');
    setExpDescription('');
    setExpVehicleNumber('');
    setExpDriverName('');
    setExpRecipientName('');
    setExpVoucherNo('');
    setExpenseFormError(null);
    setIsAddExpenseModalOpen(false);
  };

  // Submit Bank Deposit Form
  const handleSaveDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = parseFloat(depAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      setDepositFormError('Please enter a valid deposit amount greater than 0.');
      return;
    }
    const finalBank = depBankName === 'OTHER_CUSTOM' ? depCustomBank.trim() : depBankName;
    if (!finalBank) {
      setDepositFormError('Please specify the destination bank name.');
      return;
    }
    if (!depDepositorName.trim()) {
      setDepositFormError('Please enter the name of the depositor.');
      return;
    }

    onAddDeposit({
      date: selectedDate,
      amount: parsedAmt,
      depositMethod: depMethod,
      bankName: finalBank,
      depositorName: depDepositorName.trim(),
      referenceNumber: depRefNumber.trim() || undefined,
      notes: depNotes.trim() || undefined,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      recordedBy: currentUser?.name || 'Cashier',
    });

    if (settings.enableSoundEffects) sound.playSuccessChime();
    // Reset Form
    setDepAmount('');
    setDepRefNumber('');
    setDepNotes('');
    setDepositFormError(null);
    setIsAddDepositModalOpen(false);
  };

  const formattedDateString = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedDate]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto h-[calc(100vh-2.5rem)]">
      {/* Top Header & Date Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-black/[0.08] dark:border-white/[0.08]">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Receipt className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Daily Sales & Expense Recap</span>
            </h1>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Audit & Balancing
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Reconcile Cash, Bank Transfer, POS terminal sales, track bank deposits, and deduct operational expenses.
          </p>
        </div>

        {/* Date Selector & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-900 shadow-xs p-0.5">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1.5 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] rounded text-slate-600 dark:text-slate-400 cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-1 px-2">
              <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-semibold bg-transparent text-slate-800 dark:text-slate-200 outline-hidden cursor-pointer"
              />
            </div>

            <button
              onClick={() => handleShiftDate(1)}
              className="p-1.5 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] rounded text-slate-600 dark:text-slate-400 cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleSetToday}
              className="px-2 py-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded transition-colors cursor-pointer border-l border-black/[0.06] dark:border-white/[0.06]"
            >
              Today
            </button>
          </div>

          <button
            onClick={() => setIsCreditPaymentModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Log payment brought in by a customer settling a past credit purchase"
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Log Debt Repayment</span>
          </button>

          <button
            onClick={() => setIsAddExpenseModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Expense</span>
          </button>

          <button
            onClick={() => setIsAddDepositModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Bank Deposit</span>
          </button>

          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.08] dark:hover:bg-white/[0.12] text-slate-800 dark:text-slate-200 rounded-lg text-xs font-medium border border-black/[0.08] dark:border-white/[0.08] transition-colors cursor-pointer"
            title="Print or Export Daily Reconciliation Sheet"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* Date Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs">
        <div className="flex items-center space-x-2 text-blue-900 dark:text-blue-200">
          <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold">Reconciliation Date:</span>
          <span>{formattedDateString}</span>
        </div>
        <div className="text-slate-600 dark:text-slate-400 text-[11px] flex flex-wrap gap-2 items-center">
          <span>{salesMetrics.receiptCount} Sales Receipts</span>
          <span>•</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{creditPaymentMetrics.count} Debt Repayments</span>
          <span>•</span>
          <span>{expenseMetrics.count} Expenses</span>
          <span>•</span>
          <span>{depositMetrics.count} Bank Deposits</span>
        </div>
      </div>

      {/* 5 Core Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Total Daily Sales */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Gross Daily Sales</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
            {currencySymbol}
            {salesMetrics.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.05] text-[10px] text-slate-500 space-y-0.5">
            <div className="flex justify-between">
              <span>Cash:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currencySymbol}{salesMetrics.totalCash.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Transfer:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currencySymbol}{salesMetrics.totalTransfer.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>POS Terminal:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currencySymbol}{salesMetrics.totalPOS.toLocaleString()}
              </span>
            </div>
            {creditPaymentMetrics.totalCollected > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold border-t border-black/[0.04] dark:border-white/[0.04] pt-0.5">
                <span>+ Debt Collections:</span>
                <span>+{currencySymbol}{creditPaymentMetrics.totalCollected.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Total Daily Expenses (Minus from Daily Sales) */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/60 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Daily Expenses</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
            -{currencySymbol}
            {expenseMetrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 pt-2 border-t border-rose-100 dark:border-rose-900/40 text-[10px] text-slate-500 space-y-0.5">
            <div className="flex justify-between">
              <span>Fuel & Repair:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currencySymbol}
                {(expenseMetrics.byCategory.vehicle_fuel + expenseMetrics.byCategory.vehicle_repair).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Electricity & Power:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currencySymbol}{expenseMetrics.byCategory.electricity.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Salaries & Others:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currencySymbol}
                {(expenseMetrics.byCategory.salary + expenseMetrics.byCategory.home_expenses + expenseMetrics.byCategory.miscellaneous).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 3. NET DAILY SALES (INFLOWS - EXPENSES) */}
        <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-300/80 dark:border-emerald-800/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider">Net Sales (Take-Home)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-black tracking-tight text-emerald-700 dark:text-emerald-300 font-mono">
            {currencySymbol}
            {netDailySales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800/60 text-[10px] text-emerald-800 dark:text-emerald-400">
            <span className="font-medium">Total inflows minus all daily expenses.</span>
            <span className="block mt-0.5">
              Margin: {totalRevenueInflow > 0 ? ((netDailySales / totalRevenueInflow) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>

        {/* 4. Total Bank Deposits */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Bank Deposits</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
            {currencySymbol}
            {depositMetrics.totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.05] text-[10px] text-slate-500 space-y-0.5">
            <div className="flex justify-between">
              <span>Deposited in Cash:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currencySymbol}{depositMetrics.cashDeposited.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Deposited via Transfer:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currencySymbol}{depositMetrics.transferDeposited.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Deposit Count:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{depositMetrics.count} slips</span>
            </div>
          </div>
        </div>

        {/* 5. Estimated In-Hand Cash Position */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Closing Cash In-Hand</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className={`text-xl font-bold tracking-tight font-mono ${estimatedCashInHand >= 0 ? 'text-slate-900 dark:text-slate-100' : 'text-rose-600 dark:text-rose-400'}`}>
            {currencySymbol}
            {estimatedCashInHand.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-2 pt-2 border-t border-black/[0.05] dark:border-white/[0.05] text-[10px] text-slate-500 space-y-0.5">
            <div className="flex justify-between">
              <span>Sales Cash:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {currencySymbol}{salesMetrics.totalCash.toLocaleString()}
              </span>
            </div>
            {creditPaymentMetrics.cashCollected > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                <span>+ Debt Repayment Cash:</span>
                <span>+{currencySymbol}{creditPaymentMetrics.cashCollected.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>- Cash Expenses & Banked:</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                -{currencySymbol}{(expenseMetrics.cashPaidExpenses + depositMetrics.cashDeposited).toLocaleString()}
              </span>
            </div>
            <span className="block mt-0.5 text-slate-700 dark:text-slate-300 font-medium text-[9px]">
              Expected in physical drawer
            </span>
          </div>
        </div>
      </div>

      {/* Section Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold overflow-x-auto pb-0.5">
        <button
          onClick={() => setActiveSection('all')}
          className={`pb-2 px-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
            activeSection === 'all'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Full Reconciliation
        </button>
        <button
          onClick={() => setActiveSection('sales')}
          className={`pb-2 px-3 border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition-colors cursor-pointer ${
            activeSection === 'sales'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Daily Sales Channels ({dayReceipts.length})</span>
        </button>
        <button
          onClick={() => setActiveSection('credit_repayments')}
          className={`pb-2 px-3 border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition-colors cursor-pointer ${
            activeSection === 'credit_repayments'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Debt Collections ({dayCreditPayments.length})</span>
        </button>
        <button
          onClick={() => setActiveSection('deposits')}
          className={`pb-2 px-3 border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition-colors cursor-pointer ${
            activeSection === 'deposits'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Bank Deposits ({dayDeposits.length})</span>
        </button>
        <button
          onClick={() => setActiveSection('expenses')}
          className={`pb-2 px-3 border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition-colors cursor-pointer ${
            activeSection === 'expenses'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ArrowDownRight className="w-3.5 h-3.5" />
          <span>Daily Expenses ({dayExpenses.length})</span>
        </button>
      </div>

      {/* SECTION 1: DAILY SALES CHANNELS (CASH / TRANSFER / POS TERMINAL) */}
      {(activeSection === 'all' || activeSection === 'sales') && (
        <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600" />
                <span>Daily Sales by Payment Channel</span>
              </h3>
              <p className="text-xs text-slate-500">
                Breakdown of receipts across Cash, Bank Transfer, and POS Terminal.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Total Sales for {selectedDate}</span>
              <span className="text-base font-bold text-blue-600 dark:text-blue-400 font-mono">
                {currencySymbol}{salesMetrics.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* 4 Payment Channel Badges (Including Debt Recoveries) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-black/[0.05] dark:border-white/[0.05]">
            {/* CASH */}
            <div className="p-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50">
              <div className="flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold">Cash Sales</span>
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                  {salesMetrics.cashCount} orders
                </span>
              </div>
              <div className="mt-2 text-lg font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                {currencySymbol}{salesMetrics.totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* BANK TRANSFER */}
            <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/50">
              <div className="flex items-center justify-between text-xs text-blue-800 dark:text-blue-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="font-bold">Bank Transfer</span>
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                  {salesMetrics.transferCount} orders
                </span>
              </div>
              <div className="mt-2 text-lg font-bold text-blue-700 dark:text-blue-300 font-mono">
                {currencySymbol}{salesMetrics.totalTransfer.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* POS TERMINAL */}
            <div className="p-3 rounded-lg bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/50">
              <div className="flex items-center justify-between text-xs text-purple-800 dark:text-purple-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-purple-600" />
                  <span className="font-bold">POS Terminal / Card</span>
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                  {salesMetrics.posCount} orders
                </span>
              </div>
              <div className="mt-2 text-lg font-bold text-purple-700 dark:text-purple-300 font-mono">
                {currencySymbol}{salesMetrics.totalPOS.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* PAST CREDIT DEBT COLLECTIONS */}
            <div className="p-3 rounded-lg bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-900/50">
              <div className="flex items-center justify-between text-xs text-teal-800 dark:text-teal-300 font-medium">
                <span className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-teal-600" />
                  <span className="font-bold">Debt Recovered (Credit)</span>
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200">
                  {creditPaymentMetrics.count} settled
                </span>
              </div>
              <div className="mt-2 text-lg font-bold text-teal-700 dark:text-teal-300 font-mono">
                {currencySymbol}{creditPaymentMetrics.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="mt-1 text-[10px] text-teal-700/80 dark:text-teal-400 flex items-center justify-between">
                <span>Cash: {currencySymbol}{creditPaymentMetrics.cashCollected.toLocaleString()}</span>
                <span>Trans: {currencySymbol}{creditPaymentMetrics.transferCollected.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Receipts table */}
          {dayReceipts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No sales receipts recorded on {selectedDate}.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-2">Slip #</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">Payment Method</th>
                    <th className="px-4 py-2">Cashier / Operator</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    {onOpenReceipt && <th className="px-4 py-2 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                  {dayReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2 font-mono font-medium text-slate-900 dark:text-slate-100">
                        {r.receiptNumber}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                        {r.customerName || 'Walk-in Customer'}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            r.paymentMethod === 'Cash'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : r.paymentMethod === 'Bank Transfer'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                          }`}
                        >
                          {r.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500">{r.operator}</td>
                      <td className="px-4 py-2 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {currencySymbol}
                        {(r.grandTotal || r.amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      {onOpenReceipt && (
                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => onOpenReceipt(r)}
                            className="text-blue-600 hover:text-blue-800 text-[11px] font-medium cursor-pointer"
                          >
                            View Slip
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION: CREDIT CUSTOMER DEBT REPAYMENTS & COLLECTIONS */}
      {(activeSection === 'all' || activeSection === 'sales' || activeSection === 'credit_repayments') && (
        <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>Credit Debt Collections & Repayments</span>
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                  Past Credit Settled
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Money brought in today by customers who previously purchased on credit. Recorded directly into today's sales and physical cash drawer.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Total Recovered</span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {currencySymbol}{creditPaymentMetrics.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <button
                onClick={() => setIsCreditPaymentModalOpen(true)}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Debt Repayment</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-emerald-50/30 dark:bg-emerald-950/10 border-b border-black/[0.05] dark:border-white/[0.05] text-xs">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                Cash Brought (Into Drawer)
              </span>
              <div className="mt-1 text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                {currencySymbol}{creditPaymentMetrics.cashCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                Bank Transfer Settled
              </span>
              <div className="mt-1 text-base font-bold text-blue-700 dark:text-blue-300 font-mono">
                {currencySymbol}{creditPaymentMetrics.transferCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                POS Terminal Settled
              </span>
              <div className="mt-1 text-base font-bold text-purple-700 dark:text-purple-300 font-mono">
                {currencySymbol}{creditPaymentMetrics.posCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Repayments List */}
          {dayCreditPayments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <p>No credit customer debt repayments logged for {selectedDate}.</p>
              <button
                onClick={() => setIsCreditPaymentModalOpen(true)}
                className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log debt repayment from credit customer</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">Debtor Customer</th>
                    <th className="px-4 py-2">Linked Credit Slip</th>
                    <th className="px-4 py-2">Payment Method</th>
                    <th className="px-4 py-2">Cashier / Collected By</th>
                    <th className="px-4 py-2">Notes / Memo</th>
                    <th className="px-4 py-2 text-right">Amount Brought</th>
                    {isAdmin && <th className="px-4 py-2 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                  {dayCreditPayments.map((p) => {
                    const linkedReceipt = p.receiptId ? receipts.find((r) => r.id === p.receiptId) : undefined;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                          {p.time || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {p.customerName}
                          </div>
                          {p.customerPhone && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              {p.customerPhone}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {p.receiptNumber ? (
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono text-blue-600 dark:text-blue-400 font-medium">
                                #{p.receiptNumber}
                              </span>
                              {linkedReceipt && onOpenReceipt && (
                                <button
                                  onClick={() => onOpenReceipt(linkedReceipt)}
                                  className="text-[10px] text-slate-400 hover:text-blue-600 underline cursor-pointer"
                                  title="View original credit invoice"
                                >
                                  View Slip
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Direct Entry</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              p.paymentMethod === 'Cash'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : p.paymentMethod === 'Bank Transfer'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                            }`}
                          >
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                          {p.recordedBy || 'Cashier'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-[11px] max-w-xs truncate">
                          {p.notes || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                          +{currencySymbol}
                          {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2.5 text-center">
                            {onDeleteCreditPayment && (
                              <button
                                onClick={() => {
                                  if (confirm(`Delete debt repayment of ${currencySymbol}${p.amount.toLocaleString()} from ${p.customerName}?`)) {
                                    onDeleteCreditPayment(p.id);
                                  }
                                }}
                                className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                title="Delete / Cancel Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: BANK DEPOSITS (BANK NAME, NAME OF DEPOSITOR, CASH/TRANSFER) */}
      {(activeSection === 'all' || activeSection === 'deposits') && (
        <div className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Bank Deposits Audit</span>
              </h3>
              <p className="text-xs text-slate-500">
                Log amounts deposited in bank either in cash or transfer, destination bank, and depositor name.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Total Deposited</span>
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  {currencySymbol}{depositMetrics.totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <button
                onClick={() => setIsAddDepositModalOpen(true)}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Deposit</span>
              </button>
            </div>
          </div>

          {/* Deposits List */}
          {dayDeposits.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <p>No bank deposits logged for {selectedDate}.</p>
              <button
                onClick={() => setIsAddDepositModalOpen(true)}
                className="inline-flex items-center space-x-1 text-indigo-600 hover:underline font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record first bank deposit</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-2">Time / Slip</th>
                    <th className="px-4 py-2">Destination Bank</th>
                    <th className="px-4 py-2">Method</th>
                    <th className="px-4 py-2">Name of Depositor</th>
                    <th className="px-4 py-2">Notes / Ref</th>
                    <th className="px-4 py-2 text-right">Amount Deposited</th>
                    {isAdmin && <th className="px-4 py-2 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                  {dayDeposits.map((dep) => (
                    <tr key={dep.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-mono text-slate-500">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{dep.time || 'Today'}</span>
                        </div>
                        {dep.referenceNumber && (
                          <span className="text-[10px] text-slate-400 block">Ref: {dep.referenceNumber}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
                        {dep.bankName}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            dep.depositMethod === 'cash'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {dep.depositMethod.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-medium">{dep.depositorName}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                        {dep.notes || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-700 dark:text-indigo-300 text-sm">
                        {currencySymbol}{dep.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteDeposit(dep.id)}
                            className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded transition-colors cursor-pointer"
                            title="Delete deposit record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: DAILY EXPENSES (ELECTRICITY, VEHICLE FUEL, VEHICLE REPAIR, MISC, HOME, SALARY) */}
      {(activeSection === 'all' || activeSection === 'expenses') && (
        <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-rose-600" />
                <span>Daily Expenses (Deducted from Sales)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Electricity, vehicle fuel, vehicle repair (vehicle number & driver name), miscellaneous, home expenses, salary.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Total Deductions</span>
                <span className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono">
                  -{currencySymbol}{expenseMetrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <button
                onClick={() => setIsAddExpenseModalOpen(true)}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Expense</span>
              </button>
            </div>
          </div>

          {/* Category Summary Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-slate-50/50 dark:bg-slate-950/20 border-b border-black/[0.05] dark:border-white/[0.05] text-xs">
            {(
              [
                'electricity',
                'vehicle_fuel',
                'vehicle_repair',
                'salary',
                'home_expenses',
                'miscellaneous',
              ] as ExpenseCategory[]
            ).map((cat) => {
              const meta = EXPENSE_CATEGORY_META[cat];
              const IconComp = meta.icon;
              const amt = expenseMetrics.byCategory[cat];
              return (
                <div key={cat} className={`p-2 rounded-lg border ${meta.bg}`}>
                  <div className="flex items-center space-x-1.5 text-[11px] font-semibold">
                    <IconComp className={`w-3.5 h-3.5 ${meta.color}`} />
                    <span className="truncate">{meta.label}</span>
                  </div>
                  <div className="mt-1 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {currencySymbol}{amt.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expenses Table */}
          {dayExpenses.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <p>No expenses recorded for {selectedDate}.</p>
              <button
                onClick={() => setIsAddExpenseModalOpen(true)}
                className="inline-flex items-center space-x-1 text-rose-600 hover:underline font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add an expense for this day</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Description / Purpose</th>
                    <th className="px-4 py-2">Vehicle / Driver Details</th>
                    <th className="px-4 py-2">Paid From</th>
                    <th className="px-4 py-2">Recorded By</th>
                    <th className="px-4 py-2 text-right">Amount Deducted</th>
                    {isAdmin && <th className="px-4 py-2 text-center">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                  {dayExpenses.map((exp) => {
                    const meta = EXPENSE_CATEGORY_META[exp.category] || EXPENSE_CATEGORY_META.other;
                    const IconComp = meta.icon;
                    return (
                      <tr key={exp.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.bg}`}>
                            <IconComp className={`w-3 h-3 ${meta.color}`} />
                            <span>{meta.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                          <div>{exp.description}</div>
                          {exp.receiptOrVoucherNo && (
                            <span className="text-[10px] text-slate-400">Voucher: {exp.receiptOrVoucherNo}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                          {exp.category === 'vehicle_repair' || exp.vehicleNumber || exp.driverName ? (
                            <div className="text-[11px] space-y-0.5">
                              {exp.vehicleNumber && (
                                <div className="flex items-center space-x-1 text-slate-800 dark:text-slate-200 font-semibold">
                                  <Car className="w-3 h-3 text-rose-500" />
                                  <span>Vehicle #{exp.vehicleNumber}</span>
                                </div>
                              )}
                              {exp.driverName && (
                                <div className="flex items-center space-x-1 text-slate-500 text-[10px]">
                                  <User className="w-3 h-3" />
                                  <span>Driver: {exp.driverName}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px]">
                            {exp.paymentSource}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-[11px]">
                          {exp.recordedBy || 'Staff'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                          -{currencySymbol}{exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => onDeleteExpense(exp.id)}
                              className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 rounded transition-colors cursor-pointer"
                              title="Delete expense"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 4: MASTER BALANCING SHEET / LEDGER */}
      {activeSection === 'all' && (
        <div className="p-5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <span>Daily Financial Balancing Statement</span>
              </h3>
              <p className="text-xs text-slate-500">
                Mathematical audit subtracting daily expenses from total sales, reconciled against bank deposits.
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              Date: {selectedDate}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Left Column: Sales & Deductions Ledger */}
            <div className="space-y-2 font-mono">
              <div className="flex justify-between py-1 text-slate-700 dark:text-slate-300 font-bold border-b border-black/[0.06] dark:border-white/[0.06]">
                <span>1. GROSS DAILY SALES</span>
                <span className="text-blue-600 dark:text-blue-400">
                  +{currencySymbol}{salesMetrics.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pl-3 space-y-1 text-slate-500 text-[11px]">
                <div className="flex justify-between">
                  <span>• Cash Sales:</span>
                  <span>{currencySymbol}{salesMetrics.totalCash.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Bank Transfer Sales:</span>
                  <span>{currencySymbol}{salesMetrics.totalTransfer.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• POS Terminal Sales:</span>
                  <span>{currencySymbol}{salesMetrics.totalPOS.toLocaleString()}</span>
                </div>
                {creditPaymentMetrics.totalCollected > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold border-t border-black/[0.04] dark:border-white/[0.04] pt-0.5">
                    <span>• Credit Debt Recoveries:</span>
                    <span>+{currencySymbol}{creditPaymentMetrics.totalCollected.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between py-1 text-rose-600 dark:text-rose-400 font-bold border-b border-black/[0.06] dark:border-white/[0.06] pt-2">
                <span>2. LESS: DAILY EXPENSES</span>
                <span>
                  -{currencySymbol}{expenseMetrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pl-3 space-y-1 text-slate-500 text-[11px]">
                <div className="flex justify-between">
                  <span>• Electricity:</span>
                  <span>-{currencySymbol}{expenseMetrics.byCategory.electricity.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Vehicle Fuel:</span>
                  <span>-{currencySymbol}{expenseMetrics.byCategory.vehicle_fuel.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Vehicle Repair (Vehicles & Drivers):</span>
                  <span>-{currencySymbol}{expenseMetrics.byCategory.vehicle_repair.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Salaries & Wages:</span>
                  <span>-{currencySymbol}{expenseMetrics.byCategory.salary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Home Expenses:</span>
                  <span>-{currencySymbol}{expenseMetrics.byCategory.home_expenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Miscellaneous / Other:</span>
                  <span>-{currencySymbol}{(expenseMetrics.byCategory.miscellaneous + expenseMetrics.byCategory.other).toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between py-2 text-emerald-700 dark:text-emerald-300 font-black text-sm bg-emerald-50/50 dark:bg-emerald-950/20 px-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <span>= NET SALES (TAKE-HOME)</span>
                <span>
                  {currencySymbol}{netDailySales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Right Column: Banking & Reconciliation */}
            <div className="space-y-2 font-mono">
              <div className="flex justify-between py-1 text-slate-700 dark:text-slate-300 font-bold border-b border-black/[0.06] dark:border-white/[0.06]">
                <span>3. TOTAL BANK DEPOSITS</span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  {currencySymbol}{depositMetrics.totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pl-3 space-y-1 text-slate-500 text-[11px]">
                <div className="flex justify-between">
                  <span>• Cash Deposited in Bank:</span>
                  <span>{currencySymbol}{depositMetrics.cashDeposited.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Transfer Deposited in Bank:</span>
                  <span>{currencySymbol}{depositMetrics.transferDeposited.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Deposit Transactions:</span>
                  <span>{depositMetrics.count} recorded</span>
                </div>
              </div>

              <div className="flex justify-between py-1 text-amber-700 dark:text-amber-400 font-bold border-b border-black/[0.06] dark:border-white/[0.06] pt-2">
                <span>4. PHYSICAL DRAWER CASH POSITION</span>
                <span>
                  {currencySymbol}{estimatedCashInHand.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="pl-3 space-y-1 text-slate-500 text-[11px]">
                <div className="flex justify-between">
                  <span>• Cash from Direct Sales:</span>
                  <span>+{currencySymbol}{salesMetrics.totalCash.toLocaleString()}</span>
                </div>
                {creditPaymentMetrics.cashCollected > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>• Cash from Debt Repayments:</span>
                    <span>+{currencySymbol}{creditPaymentMetrics.cashCollected.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>• Cash Paid out for Expenses:</span>
                  <span>-{currencySymbol}{expenseMetrics.cashPaidExpenses.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>• Cash Taken to Bank:</span>
                  <span>-{currencySymbol}{depositMetrics.cashDeposited.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex justify-between py-2 text-slate-900 dark:text-slate-100 font-bold text-sm bg-slate-100 dark:bg-slate-800 px-2 rounded-lg border border-black/[0.06] dark:border-white/[0.06]">
                <span>NET UNDEPOSITED / BALANCE:</span>
                <span>
                  {currencySymbol}{undepositedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: RECORD EXPENSE */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/30">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Record Daily Expense
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Deduct from {selectedDate} daily sales.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddExpenseModalOpen(false)}
                className="p-1 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveExpense} className="p-4 sm:p-5 space-y-4 text-xs">
              {expenseFormError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{expenseFormError}</span>
                </div>
              )}

              {/* Category Grid */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Expense Category <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(
                    [
                      'electricity',
                      'vehicle_fuel',
                      'vehicle_repair',
                      'salary',
                      'home_expenses',
                      'miscellaneous',
                    ] as ExpenseCategory[]
                  ).map((cat) => {
                    const meta = EXPENSE_CATEGORY_META[cat];
                    const IconComp = meta.icon;
                    const isSelected = expCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setExpCategory(cat)}
                        className={`p-2 rounded-lg border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-rose-500 bg-rose-50/80 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 ring-2 ring-rose-400/30'
                            : 'border-black/[0.08] dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <IconComp className={`w-3.5 h-3.5 ${meta.color}`} />
                        <span className="font-semibold text-[11px] truncate">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount & Payment Source */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Amount ({currencySymbol}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">{currencySymbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-sm outline-hidden focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Deducted / Paid From
                  </label>
                  <select
                    value={expPaymentSource}
                    onChange={(e) => setExpPaymentSource(e.target.value as any)}
                    className="w-full p-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-hidden focus:border-rose-500"
                  >
                    <option value="Cash Sales">Cash Sales Drawer</option>
                    <option value="Bank Transfer">Bank Transfer (Company Acct)</option>
                    <option value="POS Terminal">POS Terminal Account</option>
                    <option value="Other">Other Reserve</option>
                  </select>
                </div>
              </div>

              {/* SPECIAL VEHICLE REPAIR FIELDS (VEHICLE NUMBER & DRIVER NAME) */}
              {expCategory === 'vehicle_repair' && (
                <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center space-x-1.5 text-rose-800 dark:text-rose-300 font-bold text-xs">
                    <Car className="w-3.5 h-3.5" />
                    <span>Vehicle Repair Audit Details</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-semibold text-[11px] text-slate-700 dark:text-slate-300 mb-0.5">
                        Vehicle / Plate Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. KJA-821-XA or Van #2"
                        value={expVehicleNumber}
                        onChange={(e) => setExpVehicleNumber(e.target.value)}
                        required={expCategory === 'vehicle_repair'}
                        className="w-full p-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 font-mono text-xs uppercase text-slate-900 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[11px] text-slate-700 dark:text-slate-300 mb-0.5">
                        Driver Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Emeka Okonjo"
                        value={expDriverName}
                        onChange={(e) => setExpDriverName(e.target.value)}
                        className="w-full p-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Description / Purpose */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Purpose of Expense <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    expCategory === 'electricity'
                      ? 'e.g. PHCN token meter #4120 / Generator diesel'
                      : expCategory === 'vehicle_fuel'
                      ? 'e.g. 40 Litres PMS fuel for delivery truck'
                      : expCategory === 'vehicle_repair'
                      ? 'e.g. Brake pad replacement & mechanic labor'
                      : expCategory === 'salary'
                      ? 'e.g. Daily loader wages / Staff lunch stipend'
                      : 'e.g. Office cleaning detergents / Home supplies'
                  }
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  className="w-full p-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-hidden focus:border-rose-500"
                />
              </div>

              {/* Voucher / Receipt & Recipient */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Paid To (Recipient / Vendor)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TotalEnergies / NEPA office"
                    value={expRecipientName}
                    onChange={(e) => setExpRecipientName(e.target.value)}
                    className="w-full p-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Voucher / Receipt # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VCH-0042"
                    value={expVoucherNo}
                    onChange={(e) => setExpVoucherNo(e.target.value)}
                    className="w-full p-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono outline-hidden"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-black/[0.08] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsAddExpenseModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Save & Deduct Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD BANK DEPOSIT (AMOUNT, CASH/TRANSFER, BANK NAME, DEPOSITOR NAME) */}
      {isAddDepositModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/30">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Record Bank Deposit
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Log money banked in cash or transfer for {selectedDate}.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddDepositModalOpen(false)}
                className="p-1 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveDeposit} className="p-4 sm:p-5 space-y-4 text-xs">
              {depositFormError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{depositFormError}</span>
                </div>
              )}

              {/* Deposit Method (Cash vs Transfer) */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Deposit Method <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDepMethod('cash')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold cursor-pointer transition-all ${
                      depMethod === 'cash'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-400/30'
                        : 'border-black/[0.08] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    <span>Cash Deposit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDepMethod('transfer')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center space-x-2 font-bold cursor-pointer transition-all ${
                      depMethod === 'transfer'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 ring-2 ring-blue-400/30'
                        : 'border-black/[0.08] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Transfer to Bank</span>
                  </button>
                </div>
              </div>

              {/* Amount Deposited */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Amount Deposited ({currencySymbol}) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">{currencySymbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={depAmount}
                    onChange={(e) => setDepAmount(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-base outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Destination Bank Name */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Destination Bank Name <span className="text-rose-500">*</span>
                </label>
                <select
                  value={depBankName}
                  onChange={(e) => setDepBankName(e.target.value)}
                  className="w-full p-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500"
                >
                  {POPULAR_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value="OTHER_CUSTOM">+ Enter Other Bank Name...</option>
                </select>

                {depBankName === 'OTHER_CUSTOM' && (
                  <input
                    type="text"
                    required
                    placeholder="Type bank name..."
                    value={depCustomBank}
                    onChange={(e) => setDepCustomBank(e.target.value)}
                    className="mt-2 w-full p-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-hidden"
                  />
                )}
              </div>

              {/* Name of Depositor */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Name of Depositor <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Grace Adebayo (Cashier) or Manager"
                    value={depDepositorName}
                    onChange={(e) => setDepDepositorName(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Reference Number & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Teller / Ref Slip # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TLR-89421 or Session ID"
                    value={depRefNumber}
                    onChange={(e) => setDepRefNumber(e.target.value)}
                    className="w-full p-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Branch / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Main branch deposit"
                    value={depNotes}
                    onChange={(e) => setDepNotes(e.target.value)}
                    className="w-full p-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-hidden"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-black/[0.08] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsAddDepositModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Save Bank Deposit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG CREDIT CUSTOMER DEBT REPAYMENT (NO TIPS - STRICTLY DEBT COLLECTION) */}
      {isCreditPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/30">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    Log Credit Debt Repayment
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Record money brought by a debtor customer (Strictly debt repayment — no tips).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreditPaymentFormError(null);
                  setIsCreditPaymentModalOpen(false);
                }}
                className="p-1 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveCreditPayment} className="p-5 space-y-4 text-xs">
              {creditPaymentFormError && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{creditPaymentFormError}</span>
                </div>
              )}

              {/* Optional: Link to Existing Outstanding Credit Receipt */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Select Past Credit Sale Slip (Optional)
                </label>
                <select
                  value={creditPaymentSelectedReceiptId}
                  onChange={(e) => handleSelectCreditReceipt(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono outline-hidden focus:border-emerald-500"
                >
                  <option value="">-- Choose past credit sale or enter debtor manually below --</option>
                  {outstandingCreditReceipts.map((r) => {
                    const balance = r.balanceDue !== undefined ? r.balanceDue : r.grandTotal;
                    const dateStr = r.date ? r.date.split('T')[0] : '';
                    return (
                      <option key={r.id} value={r.id}>
                        {r.customerName || 'Customer'} • #{r.receiptNumber} ({dateStr}) • Balance Due: {currencySymbol}{balance.toLocaleString()}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Selecting a past slip auto-fills debtor details and updates the remaining slip balance upon saving.
                </p>
              </div>

              {/* Debtor Customer Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alhaji Musa / Mama Chinedu"
                      value={creditPaymentCustomer}
                      onChange={(e) => setCreditPaymentCustomer(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Customer Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. 0803 123 4567"
                      value={creditPaymentPhone}
                      onChange={(e) => setCreditPaymentPhone(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-hidden font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Repayment Amount & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Amount Brought ({currencySymbol}) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 font-bold text-sm">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      placeholder="0.00"
                      value={creditPaymentAmount}
                      onChange={(e) => setCreditPaymentAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold text-base outline-hidden focus:border-emerald-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Exact debt collection amount. Strictly no tips.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-black/[0.06] dark:border-white/[0.06]">
                    {(['Cash', 'Bank Transfer', 'POS / Card'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setCreditPaymentMethod(method)}
                        className={`py-1.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                          creditPaymentMethod === method
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                        }`}
                      >
                        {method === 'Cash' ? 'Cash' : method === 'Bank Transfer' ? 'Transfer' : 'POS'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {creditPaymentMethod === 'Cash'
                      ? 'Adds directly to physical cash drawer.'
                      : 'Settled to company bank / POS account.'}
                  </p>
                </div>
              </div>

              {/* Notes / Memo */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Payment Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Partial repayment for last week beverages / Settled balance in full"
                  value={creditPaymentNotes}
                  onChange={(e) => setCreditPaymentNotes(e.target.value)}
                  className="w-full p-2 rounded-lg border border-black/[0.1] dark:border-white/[0.1] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-hidden"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-black/[0.08] dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => {
                    setCreditPaymentFormError(null);
                    setIsCreditPaymentModalOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Record Debt Repayment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: PRINTABLE RECONCILIATION SHEET */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center space-x-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Daily Sales & Expense Audit Sheet
                </h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-800 dark:text-slate-200 font-sans print:p-0">
              <div className="text-center pb-4 border-b border-black/[0.1] dark:border-white/[0.1]">
                <h2 className="text-lg font-black tracking-wide text-slate-900 dark:text-slate-100 uppercase">
                  {settings.companyName || 'INVENTORY & POS SYSTEM'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  DAILY RECONCILIATION, BANKING & EXPENSE AUDIT SHEET
                </p>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mt-1 font-mono">
                  DATE: {formattedDateString}
                </p>
              </div>

              {/* Summary Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  1. Sales & Inflow Summary
                </h4>
                <div className="border border-black/[0.1] dark:border-white/[0.1] rounded-lg overflow-hidden font-mono">
                  <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 font-bold">
                    <span>Cash Sales:</span>
                    <span>{currencySymbol}{salesMetrics.totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between p-2 border-t border-black/[0.05] dark:border-white/[0.05]">
                    <span>Bank Transfer Sales:</span>
                    <span>{currencySymbol}{salesMetrics.totalTransfer.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between p-2 border-t border-black/[0.05] dark:border-white/[0.05]">
                    <span>POS Terminal / Card Sales:</span>
                    <span>{currencySymbol}{salesMetrics.totalPOS.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {creditPaymentMetrics.totalCollected > 0 && (
                    <div className="flex justify-between p-2 border-t border-black/[0.05] dark:border-white/[0.05] text-emerald-700 dark:text-emerald-400 font-bold">
                      <span>Debt Recoveries (Past Credit):</span>
                      <span>+{currencySymbol}{creditPaymentMetrics.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between p-2 border-t-2 border-black/[0.1] dark:border-white/[0.1] bg-blue-50/50 dark:bg-blue-950/30 font-black text-sm text-blue-900 dark:text-blue-200">
                    <span>TOTAL DAILY INFLOW:</span>
                    <span>{currencySymbol}{totalRevenueInflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Debt Collections Table if Any */}
              {dayCreditPayments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Credit Customer Debt Recoveries Received Today
                  </h4>
                  <table className="w-full border border-black/[0.1] dark:border-white/[0.1] rounded-lg overflow-hidden text-left font-mono text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-[10px]">
                      <tr>
                        <th className="p-2">Time</th>
                        <th className="p-2">Debtor Customer</th>
                        <th className="p-2">Slip #</th>
                        <th className="p-2">Method</th>
                        <th className="p-2 text-right">Amount Brought</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.05]">
                      {dayCreditPayments.map((p) => (
                        <tr key={p.id}>
                          <td className="p-2">{p.time || '—'}</td>
                          <td className="p-2 font-semibold">{p.customerName}</td>
                          <td className="p-2">{p.receiptNumber ? `#${p.receiptNumber}` : '—'}</td>
                          <td className="p-2">{p.paymentMethod}</td>
                          <td className="p-2 text-right font-bold text-emerald-700">
                            +{currencySymbol}{p.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-emerald-50/50 dark:bg-emerald-950/30 font-bold border-t-2">
                        <td colSpan={4} className="p-2 font-black">TOTAL DEBT RECOVERED:</td>
                        <td className="p-2 text-right text-emerald-700 font-black">
                          +{currencySymbol}{creditPaymentMetrics.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Deductions Table */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  2. Daily Expenses (Deductions from Sales)
                </h4>
                <table className="w-full border border-black/[0.1] dark:border-white/[0.1] rounded-lg overflow-hidden text-left font-mono text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px]">
                    <tr>
                      <th className="p-2">Category</th>
                      <th className="p-2">Description / Purpose</th>
                      <th className="p-2">Vehicle # / Driver</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05]">
                    {dayExpenses.map((exp) => (
                      <tr key={exp.id}>
                        <td className="p-2 uppercase font-semibold text-[10px]">{exp.category.replace('_', ' ')}</td>
                        <td className="p-2">{exp.description}</td>
                        <td className="p-2">
                          {exp.vehicleNumber ? `${exp.vehicleNumber} (${exp.driverName || 'Driver'})` : '—'}
                        </td>
                        <td className="p-2 text-right font-bold text-rose-600">
                          -{currencySymbol}{exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-rose-50/50 dark:bg-rose-950/30 font-bold border-t-2">
                      <td colSpan={3} className="p-2 font-black">TOTAL DAILY EXPENSES:</td>
                      <td className="p-2 text-right text-rose-600 font-black">
                        -{currencySymbol}{expenseMetrics.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Net Sales */}
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex justify-between items-center font-mono">
                <span className="font-black text-emerald-900 dark:text-emerald-200">
                  NET SALES AFTER EXPENSES:
                </span>
                <span className="font-black text-base text-emerald-700 dark:text-emerald-300">
                  {currencySymbol}{netDailySales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Bank Deposits */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  3. Bank Deposits Summary
                </h4>
                <table className="w-full border border-black/[0.1] dark:border-white/[0.1] rounded-lg overflow-hidden text-left font-mono text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-[10px]">
                    <tr>
                      <th className="p-2">Bank</th>
                      <th className="p-2">Method</th>
                      <th className="p-2">Depositor Name</th>
                      <th className="p-2">Teller / Ref</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.05]">
                    {dayDeposits.map((dep) => (
                      <tr key={dep.id}>
                        <td className="p-2 font-semibold">{dep.bankName}</td>
                        <td className="p-2 uppercase">{dep.depositMethod}</td>
                        <td className="p-2">{dep.depositorName}</td>
                        <td className="p-2">{dep.referenceNumber || '—'}</td>
                        <td className="p-2 text-right font-bold text-indigo-600">
                          {currencySymbol}{dep.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-indigo-50/50 dark:bg-indigo-950/30 font-bold border-t-2">
                      <td colSpan={4} className="p-2 font-black">TOTAL BANK DEPOSITS:</td>
                      <td className="p-2 text-right text-indigo-600 font-black">
                        {currencySymbol}{depositMetrics.totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Signatures Section */}
              <div className="pt-8 border-t border-black/[0.1] grid grid-cols-2 gap-8 text-center text-xs">
                <div className="border-t border-black/40 pt-2">
                  <p className="font-bold">Prepared By (Cashier / Operator)</p>
                  <p className="text-[11px] text-slate-500 mt-1">Signature & Date</p>
                </div>
                <div className="border-t border-black/40 pt-2">
                  <p className="font-bold">Approved By (Store Manager / Auditor)</p>
                  <p className="text-[11px] text-slate-500 mt-1">Signature & Date</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
