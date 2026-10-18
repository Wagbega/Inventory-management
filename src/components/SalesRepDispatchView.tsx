import React, { useState, useMemo } from 'react';
import {
  SalesRepDispatch,
  DispatchedProductLine,
  InventoryItem,
  AppSettings,
  AppUser,
  RepDispatchStatus,
} from '../types';
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  Printer,
  Plus,
  Search,
  Filter,
  Trash2,
  AlertCircle,
  FileText,
  Download,
  ArrowRight,
  MinusCircle,
  TrendingUp,
  UserCheck,
  Building2,
  Calendar,
  X,
  Check,
  RotateCcw,
  Receipt,
  Wallet,
  Coins,
  Copy,
  Loader2,
} from 'lucide-react';
import { sound } from '../utils/audio';
import { getItemPricing } from '../utils/pricing';
import { printElementById, printDispatchSlip, downloadDispatchSlipHtml } from '../utils/print';
import { generateBarcodeBars } from '../utils/barcode';
import { AppLogo } from './AppLogo';

interface SalesRepDispatchViewProps {
  dispatches: SalesRepDispatch[];
  items: InventoryItem[];
  settings: AppSettings;
  users: AppUser[];
  currentUser: AppUser | null;
  isAdmin: boolean;
  onCreateDispatch: (
    dispatchData: Omit<SalesRepDispatch, 'id' | 'createdAt' | 'updatedAt'>,
    deductFromStock: boolean
  ) => void;
  onReconcileDispatch: (
    dispatchId: string,
    reconciliationData: {
      items: DispatchedProductLine[];
      totalUnsoldReturnedValue: number;
      netSalesDue: number;
      amountRemittedCash: number;
      amountRemittedTransfer: number;
      amountRemittedPOS: number;
      totalAmountRemitted: number;
      shortageOrExcess: number;
      dateReturned: string;
      timeReturned: string;
      receivedAndAuditedBy: string;
      notes?: string;
    },
    restoreUnsoldToStock: boolean
  ) => void;
  onDeleteDispatch: (dispatchId: string) => void;
}

export const SalesRepDispatchView: React.FC<SalesRepDispatchViewProps> = ({
  dispatches,
  items,
  settings,
  users,
  currentUser,
  isAdmin,
  onCreateDispatch,
  onReconcileDispatch,
  onDeleteDispatch,
}) => {
  // Filter and Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RepDispatchStatus>('all');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Modals state
  const [isNewDispatchModalOpen, setIsNewDispatchModalOpen] = useState(false);
  const [dispatchToReconcile, setDispatchToReconcile] = useState<SalesRepDispatch | null>(null);
  const [selectedDispatchForPrint, setSelectedDispatchForPrint] = useState<SalesRepDispatch | null>(null);
  const [slipFormat, setSlipFormat] = useState<'a4' | 'thermal80'>('a4');
  const [isPrintingSlip, setIsPrintingSlip] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const [copiedSlip, setCopiedSlip] = useState(false);
  const [dispatchToDelete, setDispatchToDelete] = useState<SalesRepDispatch | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // --- NEW DISPATCH MODAL STATE ---
  const [repName, setRepName] = useState('');
  const [repPhone, setRepPhone] = useState('');
  const [vehicleOrRoute, setVehicleOrRoute] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [dispatchTime, setDispatchTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [deductFromStockNow, setDeductFromStockNow] = useState(true);

  // Line items being prepared for dispatch
  interface DraftDispatchLine {
    itemId: string;
    quantity: number;
  }
  const [draftLines, setDraftLines] = useState<DraftDispatchLine[]>([]);
  const [selectedItemIdToAdd, setSelectedItemIdToAdd] = useState('');
  const [selectedQtyToAdd, setSelectedQtyToAdd] = useState<number>(1);
  const [newDispatchError, setNewDispatchError] = useState<string | null>(null);

  // --- RECONCILE (RETURN & UNSOLD) MODAL STATE ---
  interface ReturnInputLine {
    itemId: string;
    quantityReturned: number;
  }
  const [returnInputLines, setReturnInputLines] = useState<{ [itemId: string]: number }>({});
  const [remittedCash, setRemittedCash] = useState<string>('');
  const [remittedTransfer, setRemittedTransfer] = useState<string>('');
  const [remittedPOS, setRemittedPOS] = useState<string>('');
  const [reconcileNotes, setReconcileNotes] = useState<string>('');
  const [restoreUnsoldStock, setRestoreUnsoldStock] = useState<boolean>(true);
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  const currency = settings.currencySymbol || '₦';

  // Format monetary value
  const fmt = (val: number) => {
    return `${currency}${Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Filtered dispatches
  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (dateFilter && d.dateDispatched !== dateFilter && d.dateReturned !== dateFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesRep = d.repName.toLowerCase().includes(q);
        const matchesNum = d.dispatchNumber.toLowerCase().includes(q);
        const matchesRoute = (d.vehicleOrRoute || '').toLowerCase().includes(q);
        const matchesItem = d.items.some((it) => it.name.toLowerCase().includes(q) || it.sku.toLowerCase().includes(q));
        return matchesRep || matchesNum || matchesRoute || matchesItem;
      }
      return true;
    });
  }, [dispatches, statusFilter, dateFilter, searchQuery]);

  // Key stats
  const stats = useMemo(() => {
    const totalCount = dispatches.length;
    const activeDispatches = dispatches.filter((d) => d.status === 'active');
    const reconciledDispatches = dispatches.filter((d) => d.status === 'reconciled');

    const totalActiveGoodsValue = activeDispatches.reduce((acc, d) => acc + d.totalSumTaken, 0);
    const totalAllDispatchedValue = dispatches.reduce((acc, d) => acc + d.totalSumTaken, 0);
    const totalUnsoldReturnedValue = dispatches.reduce((acc, d) => acc + d.totalUnsoldReturnedValue, 0);
    const totalNetSalesDue = dispatches.reduce((acc, d) => acc + d.netSalesDue, 0);
    const totalRemitted = dispatches.reduce((acc, d) => acc + d.totalAmountRemitted, 0);

    return {
      totalCount,
      activeCount: activeDispatches.length,
      reconciledCount: reconciledDispatches.length,
      totalActiveGoodsValue,
      totalAllDispatchedValue,
      totalUnsoldReturnedValue,
      totalNetSalesDue,
      totalRemitted,
    };
  }, [dispatches]);

  // Handler to open New Dispatch modal
  const handleOpenNewDispatchModal = () => {
    setRepName('');
    setRepPhone('');
    setVehicleOrRoute('');
    setDispatchDate(new Date().toISOString().split('T')[0]);
    setDispatchTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setDispatchNotes('');
    setDraftLines([]);
    setSelectedItemIdToAdd('');
    setSelectedQtyToAdd(1);
    setDeductFromStockNow(true);
    setNewDispatchError(null);
    setIsNewDispatchModalOpen(true);
  };

  // Add line to draft dispatch
  const handleAddLineToDraft = () => {
    if (!selectedItemIdToAdd) return;
    const item = items.find((i) => i.id === selectedItemIdToAdd);
    if (!item) return;

    if (selectedQtyToAdd <= 0) {
      setNewDispatchError('Quantity taken must be at least 1.');
      return;
    }

    if (selectedQtyToAdd > item.quantity) {
      setNewDispatchError(
        `Insufficient warehouse stock! Only ${item.quantity} ${item.unit} available for "${item.name}".`
      );
      return;
    }

    // Check if already in draft
    const existingIndex = draftLines.findIndex((l) => l.itemId === item.id);
    if (existingIndex >= 0) {
      const newQty = draftLines[existingIndex].quantity + selectedQtyToAdd;
      if (newQty > item.quantity) {
        setNewDispatchError(`Total requested exceeds stock limit of ${item.quantity} ${item.unit}.`);
        return;
      }
      const updated = [...draftLines];
      updated[existingIndex].quantity = newQty;
      setDraftLines(updated);
    } else {
      setDraftLines([...draftLines, { itemId: item.id, quantity: selectedQtyToAdd }]);
    }

    setSelectedItemIdToAdd('');
    setSelectedQtyToAdd(1);
    setNewDispatchError(null);
  };

  const handleRemoveDraftLine = (itemId: string) => {
    setDraftLines((prev) => prev.filter((l) => l.itemId !== itemId));
  };

  const handleUpdateDraftLineQty = (itemId: string, qty: number) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    if (qty <= 0) {
      handleRemoveDraftLine(itemId);
      return;
    }
    if (qty > item.quantity) {
      setNewDispatchError(`Cannot exceed available stock of ${item.quantity} ${item.unit}`);
      return;
    }
    setDraftLines((prev) =>
      prev.map((l) => (l.itemId === itemId ? { ...l, quantity: qty } : l))
    );
  };

  // Calculate Draft Total Sum
  const draftTotalSum = useMemo(() => {
    return draftLines.reduce((acc, line) => {
      const it = items.find((i) => i.id === line.itemId);
      const price = it ? getItemPricing(it, dispatchDate).effectivePrice : 0;
      return acc + line.quantity * price;
    }, 0);
  }, [draftLines, items, dispatchDate]);

  // Submit New Dispatch
  const handleSubmitNewDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repName.trim()) {
      setNewDispatchError('Please specify the Sales Representative name.');
      return;
    }
    if (draftLines.length === 0) {
      setNewDispatchError('Please add at least one product taken for outside sales.');
      return;
    }

    // Generate sequential dispatch number
    const dispatchSeq = dispatches.length + 1;
    const dispatchNum = `DSP-${new Date().getFullYear()}-${String(dispatchSeq).padStart(3, '0')}`;

    // Construct product lines
    const finalProductLines: DispatchedProductLine[] = draftLines.map((line) => {
      const it = items.find((i) => i.id === line.itemId)!;
      const activePrice = getItemPricing(it, dispatchDate).effectivePrice;
      const totalVal = line.quantity * activePrice;
      return {
        itemId: it.id,
        sku: it.sku,
        name: it.name,
        unit: it.unit || 'pcs',
        unitPrice: activePrice,
        unitCost: it.unitCost,
        quantityTaken: line.quantity,
        totalValueTaken: totalVal,
        quantityReturned: 0,
        quantitySold: 0,
        totalValueSold: 0,
        totalValueReturned: 0,
      };
    });

    onCreateDispatch(
      {
        dispatchNumber: dispatchNum,
        repName: repName.trim(),
        repPhone: repPhone.trim() || undefined,
        vehicleOrRoute: vehicleOrRoute.trim() || undefined,
        dateDispatched: dispatchDate,
        timeDispatched: dispatchTime,
        items: finalProductLines,
        totalSumTaken: draftTotalSum,
        totalUnsoldReturnedValue: 0,
        netSalesDue: draftTotalSum,
        amountRemittedCash: 0,
        amountRemittedTransfer: 0,
        amountRemittedPOS: 0,
        totalAmountRemitted: 0,
        shortageOrExcess: 0,
        status: 'active',
        dispatchedBy: currentUser?.name || 'Store Manager',
        notes: dispatchNotes.trim() || undefined,
      },
      deductFromStockNow
    );

    setIsNewDispatchModalOpen(false);
  };

  // --- OPEN RECONCILE MODAL ---
  const handleOpenReconcileModal = (disp: SalesRepDispatch) => {
    setDispatchToReconcile(disp);
    // Initialize returned quantities to 0 for all items
    const initialReturns: { [itemId: string]: number } = {};
    disp.items.forEach((it) => {
      initialReturns[it.itemId] = it.quantityReturned || 0;
    });
    setReturnInputLines(initialReturns);
    setRemittedCash(disp.amountRemittedCash ? String(disp.amountRemittedCash) : '');
    setRemittedTransfer(disp.amountRemittedTransfer ? String(disp.amountRemittedTransfer) : '');
    setRemittedPOS(disp.amountRemittedPOS ? String(disp.amountRemittedPOS) : '');
    setReconcileNotes(disp.notes || '');
    setRestoreUnsoldStock(true);
    setReconcileError(null);
  };

  // Calculate live return calculations inside Reconcile Modal
  const reconcileCalculations = useMemo(() => {
    if (!dispatchToReconcile) {
      return {
        unsoldReturnedValue: 0,
        netSalesDue: 0,
        totalRemitted: 0,
        shortageOrExcess: 0,
        soldItemsCount: 0,
        returnedItemsCount: 0,
      };
    }

    let unsoldReturnedValue = 0;
    let soldItemsCount = 0;
    let returnedItemsCount = 0;

    dispatchToReconcile.items.forEach((it) => {
      const returnedQty = returnInputLines[it.itemId] || 0;
      const validReturned = Math.min(it.quantityTaken, Math.max(0, returnedQty));
      const soldQty = it.quantityTaken - validReturned;
      unsoldReturnedValue += validReturned * it.unitPrice;
      returnedItemsCount += validReturned;
      soldItemsCount += soldQty;
    });

    const netSalesDue = Math.max(0, dispatchToReconcile.totalSumTaken - unsoldReturnedValue);

    const cash = parseFloat(remittedCash) || 0;
    const transfer = parseFloat(remittedTransfer) || 0;
    const pos = parseFloat(remittedPOS) || 0;
    const totalRemitted = cash + transfer + pos;
    const shortageOrExcess = totalRemitted - netSalesDue;

    return {
      unsoldReturnedValue,
      netSalesDue,
      totalRemitted,
      shortageOrExcess,
      soldItemsCount,
      returnedItemsCount,
    };
  }, [dispatchToReconcile, returnInputLines, remittedCash, remittedTransfer, remittedPOS]);

  // Submit Reconciliation (Unsold Returns deducted and saved)
  const handleSubmitReconciliation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchToReconcile) return;

    // Validate inputs
    for (const it of dispatchToReconcile.items) {
      const retQty = returnInputLines[it.itemId] || 0;
      if (retQty < 0) {
        setReconcileError(`Returned quantity cannot be negative for ${it.name}.`);
        return;
      }
      if (retQty > it.quantityTaken) {
        setReconcileError(
          `Returned quantity (${retQty}) cannot exceed quantity taken (${it.quantityTaken}) for "${it.name}".`
        );
        return;
      }
    }

    // Build updated product lines with returned & sold breakdown
    const updatedItems: DispatchedProductLine[] = dispatchToReconcile.items.map((it) => {
      const retQty = returnInputLines[it.itemId] || 0;
      const soldQty = it.quantityTaken - retQty;
      const retVal = retQty * it.unitPrice;
      const soldVal = soldQty * it.unitPrice;

      return {
        ...it,
        quantityReturned: retQty,
        quantitySold: soldQty,
        totalValueReturned: retVal,
        totalValueSold: soldVal,
      };
    });

    const { unsoldReturnedValue, netSalesDue, totalRemitted, shortageOrExcess } = reconcileCalculations;

    onReconcileDispatch(
      dispatchToReconcile.id,
      {
        items: updatedItems,
        totalUnsoldReturnedValue: unsoldReturnedValue,
        netSalesDue: netSalesDue,
        amountRemittedCash: parseFloat(remittedCash) || 0,
        amountRemittedTransfer: parseFloat(remittedTransfer) || 0,
        amountRemittedPOS: parseFloat(remittedPOS) || 0,
        totalAmountRemitted: totalRemitted,
        shortageOrExcess: shortageOrExcess,
        dateReturned: new Date().toISOString().split('T')[0],
        timeReturned: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        receivedAndAuditedBy: currentUser?.name || 'Warehouse Auditor',
        notes: reconcileNotes.trim() || undefined,
      },
      restoreUnsoldStock
    );

    // Prompt user to print or view the final settlement slip
    const reconciledCopy: SalesRepDispatch = {
      ...dispatchToReconcile,
      items: updatedItems,
      totalUnsoldReturnedValue: unsoldReturnedValue,
      netSalesDue: netSalesDue,
      amountRemittedCash: parseFloat(remittedCash) || 0,
      amountRemittedTransfer: parseFloat(remittedTransfer) || 0,
      amountRemittedPOS: parseFloat(remittedPOS) || 0,
      totalAmountRemitted: totalRemitted,
      shortageOrExcess: shortageOrExcess,
      status: 'reconciled',
      dateReturned: new Date().toISOString().split('T')[0],
      timeReturned: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      receivedAndAuditedBy: currentUser?.name || 'Warehouse Auditor',
      notes: reconcileNotes.trim() || undefined,
    };

    setDispatchToReconcile(null);
    setSelectedDispatchForPrint(reconciledCopy);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (dispatches.length === 0) {
      setFeedbackBanner('No sales rep dispatch records to export.');
      return;
    }

    const headers = [
      'Dispatch No',
      'Sales Rep Name',
      'Phone',
      'Route / Vehicle',
      'Date Dispatched',
      'Time Dispatched',
      'Status',
      'Total Sum Taken',
      'Unsold Returned Value',
      'Net Sales Due',
      'Cash Remitted',
      'Transfer Remitted',
      'POS Remitted',
      'Total Remitted',
      'Variance / Shortage',
      'Date Returned',
      'Dispatched By',
      'Audited By',
    ];

    const rows = dispatches.map((d) => [
      d.dispatchNumber,
      `"${d.repName.replace(/"/g, '""')}"`,
      d.repPhone || '',
      `"${(d.vehicleOrRoute || '').replace(/"/g, '""')}"`,
      d.dateDispatched,
      d.timeDispatched,
      d.status,
      d.totalSumTaken,
      d.totalUnsoldReturnedValue,
      d.netSalesDue,
      d.amountRemittedCash,
      d.amountRemittedTransfer,
      d.amountRemittedPOS,
      d.totalAmountRemitted,
      d.shortageOrExcess,
      d.dateReturned || '',
      `"${d.dispatchedBy.replace(/"/g, '""')}"`,
      `"${(d.receivedAndAuditedBy || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-rep-dispatches-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Print Dispatch Slip using robust offscreen iframe utility
  const handlePrintDispatchSlip = async () => {
    if (!selectedDispatchForPrint) return;
    setIsPrintingSlip(true);
    try {
      const success = await printDispatchSlip(
        selectedDispatchForPrint,
        settings,
        slipFormat
      );
      if (success) {
        setPrintSuccess(true);
        setTimeout(() => setPrintSuccess(false), 2500);
      } else {
        // Fallback to DOM element printing
        await printElementById(
          'printable-dispatch-slip',
          `Dispatch-${selectedDispatchForPrint.dispatchNumber}`,
          slipFormat
        );
      }
    } catch (err) {
      console.warn('[Print] Print failed, falling back to window.print()', err);
      window.print();
    } finally {
      setIsPrintingSlip(false);
    }
  };

  // Plain-text formatted copy for WhatsApp / SMS dispatch
  const handleCopyDispatchText = () => {
    if (!selectedDispatchForPrint) return;
    const d = selectedDispatchForPrint;
    const isActive = d.status === 'active';
    const lines = [
      `📦 *${(settings.companyName || 'INVENTORY MANAGEMENT').toUpperCase()}*`,
      `*${isActive ? 'FIELD DISPATCH LOADING SLIP (GATE PASS)' : 'SALES REP SETTLEMENT VOUCHER'}*`,
      `Ref: ${d.dispatchNumber}`,
      `Date: ${d.dateDispatched} ${d.timeDispatched}`,
      `Rep: ${d.repName} ${d.repPhone ? `(${d.repPhone})` : ''}`,
      d.vehicleOrRoute ? `Route / Van: ${d.vehicleOrRoute}` : '',
      `Status: ${isActive ? 'OUT ON FIELD (ACTIVE)' : 'SETTLED & RECONCILED'}`,
      '--------------------------------',
      'ITEMS TAKEN:',
      ...d.items.map(
        (it) =>
          `• ${it.name} [${it.sku}] - ${it.quantityTaken} ${it.unit} @ ${currency}${it.unitPrice.toLocaleString()} = ${currency}${it.totalValueTaken.toLocaleString()}` +
          (!isActive
            ? ` | Unsold: ${it.quantityReturned || 0}, Sold: ${it.quantitySold || 0} (${currency}${(it.totalValueSold || 0).toLocaleString()})`
            : '')
      ),
      '--------------------------------',
      `TOTAL SUM TAKEN: ${currency}${d.totalSumTaken.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      ...(!isActive
        ? [
            `Minus Unsold Returns: -${currency}${d.totalUnsoldReturnedValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            `NET SALES AMOUNT DUE: ${currency}${d.netSalesDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            `Cash Remitted: ${currency}${d.amountRemittedCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            `Transfer Remitted: ${currency}${d.amountRemittedTransfer.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            d.amountRemittedPOS > 0
              ? `POS Remitted: ${currency}${d.amountRemittedPOS.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : '',
            `Total Money Remitted: ${currency}${d.totalAmountRemitted.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            d.shortageOrExcess !== 0
              ? `Settlement Variance: ${d.shortageOrExcess < 0 ? '⚠ SHORTAGE ' : 'SURPLUS '}${currency}${Math.abs(d.shortageOrExcess).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : 'Settlement Variance: Balanced (Zero Shortage)',
            `Audited By: ${d.receivedAndAuditedBy || 'Store Auditor'}`,
          ]
        : [`Dispatched By: ${d.dispatchedBy}`]),
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSlip(true);
    setTimeout(() => setCopiedSlip(false), 2500);
  };

  // Download Standalone HTML Voucher Slip
  const handleDownloadDispatchHtml = () => {
    if (!selectedDispatchForPrint) return;
    downloadDispatchSlipHtml(selectedDispatchForPrint, settings, slipFormat);
  };

  return (
    <div className="h-full flex flex-col bg-[#f9fafb] dark:bg-[#18181b] overflow-hidden">
      {/* View Header */}
      <div className="bg-white dark:bg-[#27272a] border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                Field Sales Rep Dispatches & Returns
              </h1>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                Outside Sales
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Manage stock outward loading, track rep custody, deduct unsold returns, and reconcile cash/transfers.
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#323236] border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-[#3f3f46] transition-colors shadow-sm"
            title="Export Dispatches to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenNewDispatchModal}
            className="flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Dispatch Stock to Rep</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Banner */}
      <div className="px-6 py-3.5 bg-gray-50/70 dark:bg-[#202023] border-b border-gray-200 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-shrink-0">
        {/* Card 1: Active Out on Field */}
        <div className="bg-white dark:bg-[#27272a] rounded-xl p-3 border border-amber-200/70 dark:border-amber-900/40 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse inline-block mr-1"></span>
              Out on Field (Active)
            </span>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {stats.activeCount} <span className="text-xs font-normal text-gray-500">trips</span>
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
              {fmt(stats.totalActiveGoodsValue)} <span className="text-[10px] font-normal text-gray-500">goods in custody</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Total Dispatched Sum */}
        <div className="bg-white dark:bg-[#27272a] rounded-xl p-3 border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Goods Dispatched
            </span>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {fmt(stats.totalAllDispatchedValue)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Across {stats.totalCount} outward trips
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Unsold Stock Returns (Minused) */}
        <div className="bg-white dark:bg-[#27272a] rounded-xl p-3 border border-rose-200/70 dark:border-rose-900/40 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-400 uppercase tracking-wider">
              Unsold Stock Returned
            </span>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              -{fmt(stats.totalUnsoldReturnedValue)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Deducted & restored to stock
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Net Field Sales & Remittance */}
        <div className="bg-white dark:bg-[#27272a] rounded-xl p-3 border border-emerald-200/70 dark:border-emerald-900/40 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Net Field Sales (Remitted)
            </span>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {fmt(stats.totalNetSalesDue)}
            </div>
            <div className="text-xs text-emerald-700/80 dark:text-emerald-400/80 font-medium mt-0.5">
              Remitted: {fmt(stats.totalRemitted)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <Coins className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 bg-white dark:bg-[#27272a] border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        <div className="flex items-center space-x-2 flex-1 min-w-[240px] max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by rep name, dispatch #, route, or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Status Filter Buttons */}
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-[#1e1e21] text-xs font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-[#323236] text-gray-900 dark:text-gray-100 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              All ({dispatches.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-amber-500 text-white font-semibold shadow-xs'
                  : 'text-amber-700 dark:text-amber-400 hover:text-amber-800'
              }`}
            >
              Active on Field ({stats.activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('reconciled')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'reconciled'
                  ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                  : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
              }`}
            >
              Settled / Returned ({stats.reconciledCount})
            </button>
          </div>

          {/* Date Filter */}
          <div className="flex items-center space-x-1 text-xs">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:text-gray-200"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1"
                title="Clear date filter"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dispatches List / Table */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {feedbackBanner && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-2xs">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedbackBanner}</span>
            </div>
            <button
              onClick={() => setFeedbackBanner(null)}
              className="px-2 py-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
        {filteredDispatches.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-[#27272a] rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
              <Truck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              No field sales rep dispatches found
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mt-1 mb-4">
              When sales reps take stock outside for distribution or van sales, register their outward loading slip here.
              Upon return, any unsold stock will be subtracted and returned to warehouse inventory.
            </p>
            <button
              onClick={handleOpenNewDispatchModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
            >
              + Create First Rep Dispatch
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredDispatches.map((disp) => {
              const isActive = disp.status === 'active';
              const totalItemsCount = disp.items.reduce((acc, i) => acc + i.quantityTaken, 0);
              const totalReturnedCount = disp.items.reduce((acc, i) => acc + (i.quantityReturned || 0), 0);
              const totalSoldCount = disp.items.reduce((acc, i) => acc + (i.quantitySold || 0), 0);

              return (
                <div
                  key={disp.id}
                  className={`bg-white dark:bg-[#27272a] rounded-xl border transition-all shadow-xs overflow-hidden ${
                    isActive
                      ? 'border-amber-300 dark:border-amber-700/60 ring-1 ring-amber-400/20'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  {/* Card Header */}
                  <div className="px-5 py-3.5 bg-gray-50/80 dark:bg-[#202023] border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${
                          isActive
                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {disp.repName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            {disp.repName}
                          </span>
                          {disp.repPhone && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              ({disp.repPhone})
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-gray-200/70 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {disp.dispatchNumber}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-2 mt-0.5">
                          <span>Dispatched: {disp.dateDispatched} {disp.timeDispatched}</span>
                          {disp.vehicleOrRoute && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600 dark:text-blue-400 font-medium">
                                🚐 {disp.vehicleOrRoute}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge and Quick Action Buttons */}
                    <div className="flex items-center space-x-2">
                      {isActive ? (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          <span>OUT ON FIELD (ACTIVE)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>SETTLED & RETURNED</span>
                        </span>
                      )}

                      {/* Print Voucher */}
                      <button
                        type="button"
                        onClick={() => setSelectedDispatchForPrint(disp)}
                        className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-[#323236] border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-2xs cursor-pointer"
                        title={isActive ? 'Print Outward Loading Slip / Gate Pass' : 'Print Return Settlement Voucher'}
                      >
                        <Printer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Print Slip</span>
                      </button>

                      {/* Delete Dispatch Button */}
                      <button
                        type="button"
                        onClick={() => setDispatchToDelete(disp)}
                        className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 bg-white dark:bg-[#323236] border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer shadow-2xs"
                        title="Delete dispatch record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Body: Products & Financial Math */}
                  <div className="p-5">
                    {/* Products Grid / Table Preview */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                            <th className="pb-2">Product Taken</th>
                            <th className="pb-2 text-center">Unit Price</th>
                            <th className="pb-2 text-center">Qty Taken</th>
                            <th className="pb-2 text-right">Initial Sum</th>
                            {!isActive && (
                              <>
                                <th className="pb-2 text-center text-rose-600 dark:text-rose-400">Unsold Returned</th>
                                <th className="pb-2 text-center text-emerald-600 dark:text-emerald-400">Qty Sold</th>
                                <th className="pb-2 text-right text-emerald-600 dark:text-emerald-400">Net Value Sold</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                          {disp.items.map((line, idx) => (
                            <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-[#202023]/40">
                              <td className="py-2.5 font-medium text-gray-800 dark:text-gray-200">
                                {line.name}
                                <span className="block text-[10px] text-gray-400 font-mono">{line.sku}</span>
                              </td>
                              <td className="py-2.5 text-center text-gray-600 dark:text-gray-400 font-mono">
                                {fmt(line.unitPrice)}
                              </td>
                              <td className="py-2.5 text-center font-bold text-blue-600 dark:text-blue-400">
                                {line.quantityTaken} {line.unit}
                              </td>
                              <td className="py-2.5 text-right font-mono font-medium text-gray-900 dark:text-gray-100">
                                {fmt(line.totalValueTaken)}
                              </td>
                              {!isActive && (
                                <>
                                  <td className="py-2.5 text-center font-bold text-rose-600 dark:text-rose-400">
                                    {line.quantityReturned || 0} {line.unit}
                                    <span className="block text-[10px] font-normal text-rose-500 font-mono">
                                      (-{fmt(line.totalValueReturned || 0)})
                                    </span>
                                  </td>
                                  <td className="py-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                    {line.quantitySold || 0} {line.unit}
                                  </td>
                                  <td className="py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                    {fmt(line.totalValueSold || 0)}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Financial Summary Strip */}
                    <div className="mt-4 pt-3.5 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4 bg-gray-50/50 dark:bg-[#202023]/50 p-3 rounded-lg">
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Total Sum Dispatched:</span>{' '}
                          <span className="font-bold text-gray-900 dark:text-gray-100 font-mono">
                            {fmt(disp.totalSumTaken)}
                          </span>{' '}
                          <span className="text-[11px] text-gray-400">({totalItemsCount} units)</span>
                        </div>

                        {!isActive && (
                          <>
                            <div className="text-rose-600 dark:text-rose-400 font-medium">
                              <span>Minus Unsold Returned:</span>{' '}
                              <span className="font-bold font-mono">
                                -{fmt(disp.totalUnsoldReturnedValue)}
                              </span>{' '}
                              <span className="text-[11px]">({totalReturnedCount} units returned)</span>
                            </div>

                            <div className="text-emerald-600 dark:text-emerald-400 font-semibold">
                              <span>Net Sales Due:</span>{' '}
                              <span className="font-bold font-mono text-sm">
                                {fmt(disp.netSalesDue)}
                              </span>
                            </div>

                            <div className="text-blue-600 dark:text-blue-400 font-medium">
                              <span>Remitted:</span>{' '}
                              <span className="font-bold font-mono">
                                {fmt(disp.totalAmountRemitted)}
                              </span>
                              {disp.shortageOrExcess !== 0 && (
                                <span
                                  className={`ml-1 text-[11px] font-bold ${
                                    disp.shortageOrExcess < 0 ? 'text-rose-600' : 'text-emerald-600'
                                  }`}
                                >
                                  ({disp.shortageOrExcess < 0 ? 'Shortage: ' : 'Surplus: '}
                                  {fmt(disp.shortageOrExcess)})
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Action Button: Process Return & Settlement */}
                      {isActive && (
                        <button
                          onClick={() => handleOpenReconcileModal(disp)}
                          className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 rounded-lg shadow-sm shadow-amber-600/20 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Process Returns & Settle (Minus Unsold)</span>
                        </button>
                      )}

                      {!isActive && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          Settled on: {disp.dateReturned} {disp.timeReturned} by {disp.receivedAndAuditedBy || 'Auditor'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: NEW DISPATCH MODAL ("TAKE STOCK FOR SALES OUTSIDE")              */}
      {/* ========================================================================= */}
      {isNewDispatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#27272a] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-[#202023]">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Dispatch Stocks for Outside Sales (Gate Pass)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Record goods taken by sales rep. Unsold stock will be deducted upon return.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewDispatchModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitNewDispatch} className="flex-1 overflow-y-auto p-6 space-y-4">
              {newDispatchError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center space-x-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{newDispatchError}</span>
                </div>
              )}

              {/* Rep Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Sales Representative Name <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Okafor, Chidinma, Musa"
                      value={repName}
                      onChange={(e) => setRepName(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
                    />
                    {users.length > 0 && (
                      <select
                        onChange={(e) => {
                          const u = users.find((usr) => usr.id === e.target.value);
                          if (u) {
                            setRepName(u.name);
                            if (u.phone) setRepPhone(u.phone);
                          }
                        }}
                        className="px-2 py-2 text-xs bg-gray-100 dark:bg-[#323236] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200"
                        title="Pick from existing team"
                      >
                        <option value="">Choose Rep...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Rep Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +234 803 123 4567"
                    value={repPhone}
                    onChange={(e) => setRepPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Route / Vehicle / Territory
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Van 03 - Ikeja Route, Motorbike B"
                    value={vehicleOrRoute}
                    onChange={(e) => setVehicleOrRoute(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Dispatch Date
                    </label>
                    <input
                      type="date"
                      required
                      value={dispatchDate}
                      onChange={(e) => setDispatchDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Dispatch Time
                    </label>
                    <input
                      type="text"
                      required
                      value={dispatchTime}
                      onChange={(e) => setDispatchTime(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
                    />
                  </div>
                </div>
              </div>

              {/* Product Picker Section */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-1.5">
                    <Package className="w-4 h-4 text-blue-600" />
                    <span>Select Products Taken for Outside Sales</span>
                  </span>
                  <span className="text-[11px] text-gray-500">
                    {draftLines.length} product(s) added
                  </span>
                </div>

                {/* Add product line bar */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl mb-3">
                  <div className="flex-1 min-w-[200px]">
                    <select
                      value={selectedItemIdToAdd}
                      onChange={(e) => setSelectedItemIdToAdd(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#202023] border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-gray-100"
                    >
                      <option value="">-- Select Product from Inventory --</option>
                      {items.map((it) => {
                        const pricing = getItemPricing(it, dispatchDate);
                        return (
                          <option key={it.id} value={it.id} disabled={it.quantity <= 0}>
                            {it.name} ({it.sku}) - Stock: {it.quantity} {it.unit} - {fmt(pricing.effectivePrice)}
                            {pricing.isPromoActive ? ' [PROMO]' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      min={1}
                      value={selectedQtyToAdd}
                      onChange={(e) => setSelectedQtyToAdd(parseInt(e.target.value) || 1)}
                      placeholder="Qty"
                      className="w-full px-2.5 py-2 text-xs bg-white dark:bg-[#202023] border border-gray-200 dark:border-gray-700 rounded-lg text-center font-bold text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddLineToDraft}
                    className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                  >
                    + Add Product
                  </button>
                </div>

                {/* Draft Products Table */}
                {draftLines.length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-[#202023] text-gray-600 dark:text-gray-400 font-semibold">
                        <tr>
                          <th className="p-2.5">Product</th>
                          <th className="p-2.5 text-center">Unit Price</th>
                          <th className="p-2.5 text-center">Qty Taken</th>
                          <th className="p-2.5 text-right">Subtotal</th>
                          <th className="p-2.5 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {draftLines.map((line) => {
                          const it = items.find((i) => i.id === line.itemId);
                          if (!it) return null;
                          const pricing = getItemPricing(it, dispatchDate);
                          const lineTotal = line.quantity * pricing.effectivePrice;

                          return (
                            <tr key={line.itemId} className="hover:bg-gray-50 dark:hover:bg-[#202023]/50">
                              <td className="p-2.5 font-medium text-gray-900 dark:text-gray-100">
                                <div className="flex items-center gap-1.5">
                                  <span>{it.name}</span>
                                  {pricing.isPromoActive && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[9px] font-bold">
                                      PROMO
                                    </span>
                                  )}
                                </div>
                                <span className="block text-[10px] text-gray-400 font-mono">
                                  {it.sku} • Stock Left: {it.quantity} {it.unit}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-mono text-gray-600 dark:text-gray-400">
                                {fmt(pricing.effectivePrice)}
                              </td>
                              <td className="p-2.5 text-center">
                                <input
                                  type="number"
                                  min={1}
                                  max={it.quantity}
                                  value={line.quantity}
                                  onChange={(e) => handleUpdateDraftLineQty(line.itemId, parseInt(e.target.value) || 1)}
                                  className="w-16 px-1.5 py-1 text-xs text-center font-bold bg-gray-50 dark:bg-[#1e1e21] border border-gray-300 dark:border-gray-700 rounded-md"
                                />
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold text-gray-900 dark:text-gray-100">
                                {fmt(lineTotal)}
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDraftLine(line.itemId)}
                                  className="text-gray-400 hover:text-red-600"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Total Sum & Stock Deduct Toggle */}
              <div className="p-4 bg-gray-50 dark:bg-[#202023] rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                      Total Sum of Goods Taken Outside:
                    </span>
                    <p className="text-[11px] text-gray-500">
                      Entrusted to sales rep. Value returned unsold will be subtracted upon return.
                    </p>
                  </div>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                    {fmt(draftTotalSum)}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <label className="flex items-center space-x-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deductFromStockNow}
                      onChange={(e) => setDeductFromStockNow(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Deduct taken quantities from warehouse stock immediately</span>
                  </label>
                  <span className="text-[10px] text-gray-400">
                    (Stock movements will be audited)
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Dispatch Instructions / Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sales rep expected to return before 6:00 PM, promo price applied"
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
                />
              </div>

              {/* Footer Submit Buttons */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsNewDispatchModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={draftLines.length === 0 || !repName.trim()}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  Confirm & Dispatch Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PROCESS RETURNS & SETTLEMENT ("MINUS UNSOLD WHEN HE RETURNS")    */}
      {/* ========================================================================= */}
      {dispatchToReconcile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#27272a] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-amber-500/10 dark:bg-amber-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                    <span>Process Sales Rep Return & Settlement</span>
                    <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                      {dispatchToReconcile.dispatchNumber}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Rep: <span className="font-semibold text-gray-800 dark:text-gray-200">{dispatchToReconcile.repName}</span> •
                    Dispatched on: {dispatchToReconcile.dateDispatched}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDispatchToReconcile(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitReconciliation} className="flex-1 overflow-y-auto p-6 space-y-4">
              {reconcileError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center space-x-2 text-xs text-red-700 dark:text-red-300">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{reconcileError}</span>
                </div>
              )}

              {/* Instructions banner */}
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300">
                Enter the exact quantity of products returned unsold. The value of unsold goods will automatically be
                subtracted from the total sum dispatched, leaving the net sales amount to be remitted.
              </div>

              {/* Products Table with Unsold Return Inputs */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-[#202023] text-gray-700 dark:text-gray-300 font-semibold">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3 text-center">Unit Price</th>
                      <th className="p-3 text-center">Qty Taken</th>
                      <th className="p-3 text-center bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">
                        Qty Returned Unsold
                      </th>
                      <th className="p-3 text-center">Qty Sold</th>
                      <th className="p-3 text-right">Net Value Sold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {dispatchToReconcile.items.map((line) => {
                      const returnedQty = returnInputLines[line.itemId] || 0;
                      const soldQty = Math.max(0, line.quantityTaken - returnedQty);
                      const soldValue = soldQty * line.unitPrice;
                      const returnedValue = returnedQty * line.unitPrice;

                      return (
                        <tr key={line.itemId} className="hover:bg-gray-50 dark:hover:bg-[#202023]/40">
                          <td className="p-3 font-medium text-gray-900 dark:text-gray-100">
                            {line.name}
                            <span className="block text-[10px] text-gray-400 font-mono">{line.sku}</span>
                          </td>
                          <td className="p-3 text-center font-mono text-gray-600 dark:text-gray-400">
                            {fmt(line.unitPrice)}
                          </td>
                          <td className="p-3 text-center font-bold text-gray-700 dark:text-gray-300">
                            {line.quantityTaken} {line.unit}
                          </td>
                          <td className="p-3 text-center bg-amber-50/50 dark:bg-amber-950/20">
                            <div className="inline-flex items-center space-x-1.5">
                              <input
                                type="number"
                                min={0}
                                max={line.quantityTaken}
                                value={returnedQty}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  setReturnInputLines((prev) => ({
                                    ...prev,
                                    [line.itemId]: Math.min(line.quantityTaken, Math.max(0, val)),
                                  }));
                                }}
                                className="w-18 px-2 py-1 text-xs text-center font-bold text-rose-600 dark:text-rose-400 bg-white dark:bg-[#1e1e21] border border-amber-300 dark:border-amber-700 rounded-lg shadow-2xs focus:ring-1 focus:ring-amber-500"
                              />
                              <span className="text-[11px] text-gray-500">{line.unit}</span>
                            </div>
                            {returnedQty > 0 && (
                              <span className="block text-[10px] text-rose-500 font-mono mt-0.5">
                                -{fmt(returnedValue)}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                            {soldQty} {line.unit}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {fmt(soldValue)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Math Reconciliation Ledger */}
              <div className="p-4 bg-gray-50 dark:bg-[#202023] rounded-xl border border-gray-200 dark:border-gray-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">1. Original Total Sum Dispatched:</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 font-mono">
                    {fmt(dispatchToReconcile.totalSumTaken)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-medium">
                  <span className="flex items-center space-x-1">
                    <MinusCircle className="w-3.5 h-3.5" />
                    <span>2. Minus Products Returned Unsold:</span>
                  </span>
                  <span className="font-bold font-mono">
                    -{fmt(reconcileCalculations.unsoldReturnedValue)}
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm">
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    3. Net Sales Amount Due (To Remit):
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {fmt(reconcileCalculations.netSalesDue)}
                  </span>
                </div>
              </div>

              {/* Remittance Input Fields */}
              <div className="p-4 bg-white dark:bg-[#202023] rounded-xl border border-gray-200 dark:border-gray-800 space-y-3">
                <span className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-1.5">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>Amount Remitted by Sales Rep</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Cash Handed Over ({currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      placeholder="0.00"
                      value={remittedCash}
                      onChange={(e) => setRemittedCash(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      Bank Transfer Remitted ({currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      placeholder="0.00"
                      value={remittedTransfer}
                      onChange={(e) => setRemittedTransfer(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      POS / Terminal Card ({currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      placeholder="0.00"
                      value={remittedPOS}
                      onChange={(e) => setRemittedPOS(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg font-mono focus:ring-1 focus:ring-emerald-500 dark:text-gray-100"
                    />
                  </div>
                </div>

                {/* Remittance Totals & Variance */}
                <div className="p-3 bg-gray-50 dark:bg-[#1e1e21] rounded-lg border border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-500">Total Money Remitted: </span>
                    <span className="font-bold text-gray-900 dark:text-gray-100 font-mono">
                      {fmt(reconcileCalculations.totalRemitted)}
                    </span>
                  </div>

                  <div className="font-semibold">
                    {reconcileCalculations.shortageOrExcess === 0 ? (
                      <span className="text-emerald-600 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Balanced (Zero Shortage)</span>
                      </span>
                    ) : reconcileCalculations.shortageOrExcess < 0 ? (
                      <span className="text-rose-600 font-bold">
                        ⚠ Rep Shortage / Owed: {fmt(reconcileCalculations.shortageOrExcess)}
                      </span>
                    ) : (
                      <span className="text-blue-600 font-bold">
                        Surplus / Overpayment: +{fmt(reconcileCalculations.shortageOrExcess)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Warehouse Stock Restore Checkbox */}
              <div className="flex items-center space-x-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  id="restoreUnsold"
                  checked={restoreUnsoldStock}
                  onChange={(e) => setRestoreUnsoldStock(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <label htmlFor="restoreUnsold" className="cursor-pointer">
                  Automatically add returned unsold quantities back to warehouse inventory
                </label>
              </div>

              {/* Audit remarks */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Settlement & Audit Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified by Store Manager, all unsold cartons inspected in good shape"
                  value={reconcileNotes}
                  onChange={(e) => setReconcileNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-[#1e1e21] border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 dark:text-gray-100"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setDispatchToReconcile(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  Complete Settlement & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PRINTABLE VOUCHER / SETTLEMENT SLIP                              */}
      {/* ========================================================================= */}
      {selectedDispatchForPrint && (() => {
        const barcodeBars = generateBarcodeBars(selectedDispatchForPrint.dispatchNumber || 'DSP-001');
        const isActive = selectedDispatchForPrint.status === 'active';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs select-none" data-print-modal="true">
            <div className="bg-white dark:bg-[#202020] rounded-none sm:rounded-2xl max-w-3xl w-full h-full sm:h-auto sm:max-h-[95vh] flex flex-col shadow-2xl overflow-hidden border-0 sm:border border-black/[0.1] dark:border-white/[0.1]">
              
              {/* Action Toolbar Header */}
              <div className="p-3 sm:px-5 sm:py-3.5 bg-slate-100 dark:bg-slate-800/90 border-b border-black/[0.08] dark:border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 no-print">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                        {isActive
                          ? 'Field Dispatch Loading Slip (Gate Pass)'
                          : 'Sales Rep Return & Settlement Voucher'}
                      </h3>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold shrink-0">
                        {selectedDispatchForPrint.dispatchNumber}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-500 truncate hidden sm:block">
                      Rep: <strong className="text-slate-700 dark:text-slate-300">{selectedDispatchForPrint.repName}</strong> • {selectedDispatchForPrint.dateDispatched}
                    </p>
                  </div>
                </div>

                {/* Right toolbar controls */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {/* Format Switcher: A4 vs 80mm Thermal */}
                  <div className="flex p-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setSlipFormat('a4')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        slipFormat === 'a4'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      A4 Gate Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlipFormat('thermal80')}
                      className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                        slipFormat === 'thermal80'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      80mm Thermal
                    </button>
                  </div>

                  {/* Copy for WhatsApp / SMS */}
                  <button
                    type="button"
                    onClick={handleCopyDispatchText}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold cursor-pointer shadow-2xs"
                    title="Copy formatted manifest for WhatsApp or SMS dispatch to driver"
                  >
                    {copiedSlip ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSlip ? 'Copied!' : 'WhatsApp'}</span>
                  </button>

                  {/* Download Slip HTML */}
                  <button
                    type="button"
                    onClick={handleDownloadDispatchHtml}
                    className="flex items-center space-x-1 px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md border border-black/[0.08] dark:border-white/[0.08] text-xs font-semibold cursor-pointer shadow-2xs"
                    title="Download offline printable HTML voucher"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Download</span>
                  </button>

                  {/* Print Slip Action Button */}
                  <button
                    type="button"
                    id="btn-print-dispatch-slip"
                    onClick={handlePrintDispatchSlip}
                    disabled={isPrintingSlip}
                    className={`flex items-center space-x-1.5 px-3 py-1 rounded-md text-xs font-bold text-white shadow-2xs transition-all cursor-pointer ${
                      printSuccess
                        ? 'bg-emerald-600'
                        : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                    }`}
                  >
                    {isPrintingSlip ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : printSuccess ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Printer className="w-3.5 h-3.5" />
                    )}
                    <span>{isPrintingSlip ? 'Preparing...' : printSuccess ? 'Printed!' : 'Print Slip'}</span>
                  </button>

                  {/* Close Modal */}
                  <button
                    type="button"
                    onClick={() => setSelectedDispatchForPrint(null)}
                    className="p-1.5 rounded-md hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer ml-1"
                    title="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Preview Viewport */}
              <div className="flex-1 overflow-y-auto bg-slate-200/90 dark:bg-[#141414] p-3 sm:p-6 flex justify-center items-start">
                {/* Dedicated Printable Slip Container */}
                <div
                  id="printable-dispatch-slip"
                  className={`printable-area printable-dispatch-slip printable-receipt bg-white text-black p-5 sm:p-7 shadow-2xl rounded-sm border border-slate-300 font-mono text-xs leading-relaxed self-start space-y-4 mx-auto my-0 ${
                    slipFormat === 'thermal80' ? 'max-w-[340px] text-[11px] format-thermal80' : 'max-w-[720px] text-xs format-a4'
                  }`}
                  style={{ color: '#000000', backgroundColor: '#ffffff' }}
                >
                  {/* Slip Header */}
                  <div className="text-center border-b pb-3 border-black flex flex-col items-center">
                    <AppLogo
                      customLogoUrl={settings.customLogoUrl}
                      className="w-12 h-12 mb-1.5"
                      alt={settings.companyName || 'Apex Logistics'}
                    />
                    <h2 className="text-base sm:text-lg font-black uppercase tracking-wider text-black">
                      {settings.companyName || 'APEX LOGISTICS & INVENTORY'}
                    </h2>
                    {settings.companyAddress && (
                      <p className="text-[10px] text-black mt-0.5">{settings.companyAddress}</p>
                    )}
                    <div className="text-[10px] text-black flex flex-wrap justify-center gap-x-2">
                      {settings.companyPhone && <span>Tel: {settings.companyPhone}</span>}
                      {settings.taxId && <span>TIN: {settings.taxId}</span>}
                    </div>
                    <div className="inline-block mt-2 px-3 py-1 bg-gray-100 border border-black rounded text-xs font-bold uppercase text-black tracking-wide">
                      {isActive
                        ? 'OFFICIAL GATE PASS / OUTWARD LOADING SLIP'
                        : 'SALES REP RETURN & SETTLEMENT VOUCHER'}
                    </div>
                  </div>

                  {/* Barcode & Reference Number */}
                  <div className="text-center space-y-1 pt-1 pb-1">
                    <div className="flex justify-center overflow-hidden">
                      <svg className="h-8 w-44 max-w-full" viewBox={`0 0 ${barcodeBars.length * 2} 40`}>
                        {barcodeBars.map((isBar, idx) =>
                          isBar ? <rect key={idx} x={idx * 2} y="0" width="2" height="40" fill="black" /> : null
                        )}
                      </svg>
                    </div>
                    <div className="font-mono text-[10px] font-bold tracking-widest text-black">
                      {selectedDispatchForPrint.dispatchNumber}
                    </div>
                  </div>

                  {/* Meta details grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] border-b pb-3 border-black">
                    <div>
                      <span className="font-semibold text-black">DISPATCH REF:</span>{' '}
                      <strong className="text-black">{selectedDispatchForPrint.dispatchNumber}</strong>
                    </div>
                    <div>
                      <span className="font-semibold text-black">DATE &amp; TIME:</span>{' '}
                      <span className="text-black">{selectedDispatchForPrint.dateDispatched} {selectedDispatchForPrint.timeDispatched}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-black">SALES REP:</span>{' '}
                      <strong className="text-black">{selectedDispatchForPrint.repName}</strong>
                    </div>
                    <div>
                      <span className="font-semibold text-black">PHONE:</span>{' '}
                      <span className="text-black">{selectedDispatchForPrint.repPhone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-black">VAN / ROUTE:</span>{' '}
                      <span className="text-black">{selectedDispatchForPrint.vehicleOrRoute || 'Counter / Field Dispatch'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-black">STATUS:</span>{' '}
                      <strong className="text-black uppercase">
                        {isActive ? 'OUT ON FIELD (ACTIVE)' : 'SETTLED & RECONCILED'}
                      </strong>
                    </div>
                    {selectedDispatchForPrint.dispatchedBy && (
                      <div>
                        <span className="font-semibold text-black">DISPATCHED BY:</span>{' '}
                        <span className="text-black">{selectedDispatchForPrint.dispatchedBy}</span>
                      </div>
                    )}
                    {!isActive && selectedDispatchForPrint.receivedAndAuditedBy && (
                      <div>
                        <span className="font-semibold text-black">AUDITED BY:</span>{' '}
                        <span className="text-black">{selectedDispatchForPrint.receivedAndAuditedBy}</span>
                      </div>
                    )}
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b-2 border-black font-bold uppercase text-black">
                          <th className="py-1 pr-1">Item Description</th>
                          <th className="py-1 px-1 text-center">Qty Taken</th>
                          <th className="py-1 px-1 text-right">Unit Price</th>
                          <th className="py-1 pl-1 text-right">Sum Taken</th>
                          {!isActive && (
                            <>
                              <th className="py-1 px-1 text-center">Unsold</th>
                              <th className="py-1 px-1 text-center">Sold</th>
                              <th className="py-1 pl-1 text-right">Net Sold</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/30">
                        {selectedDispatchForPrint.items.map((it, idx) => (
                          <tr key={idx} className="text-black">
                            <td className="py-1.5 pr-1 font-medium">
                              <div>{it.name}</div>
                              <div className="text-[9.5px] text-gray-700 font-mono">{it.sku}</div>
                            </td>
                            <td className="py-1.5 px-1 text-center font-bold">
                              {it.quantityTaken} {it.unit}
                            </td>
                            <td className="py-1.5 px-1 text-right font-mono">
                              {fmt(it.unitPrice)}
                            </td>
                            <td className="py-1.5 pl-1 text-right font-bold font-mono">
                              {fmt(it.totalValueTaken)}
                            </td>
                            {!isActive && (
                              <>
                                <td className="py-1.5 px-1 text-center font-mono">
                                  {it.quantityReturned || 0} {it.unit}
                                </td>
                                <td className="py-1.5 px-1 text-center font-bold font-mono">
                                  {it.quantitySold || 0} {it.unit}
                                </td>
                                <td className="py-1.5 pl-1 text-right font-bold font-mono">
                                  {fmt(it.totalValueSold || 0)}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Calculation Box */}
                  <div className="border-t-2 border-b-2 border-black py-2.5 space-y-1 text-[11px] text-black">
                    <div className="flex justify-between">
                      <span className="font-semibold">Initial Total Sum Dispatched:</span>
                      <strong className="font-mono text-sm">{fmt(selectedDispatchForPrint.totalSumTaken)}</strong>
                    </div>

                    {!isActive && (
                      <>
                        <div className="flex justify-between text-black">
                          <span>Minus Unsold Returns (Restored to Stock):</span>
                          <span className="font-bold font-mono">-{fmt(selectedDispatchForPrint.totalUnsoldReturnedValue)}</span>
                        </div>

                        <div className="flex justify-between font-black text-xs pt-1 border-t border-black">
                          <span>NET SALES AMOUNT DUE:</span>
                          <span className="font-mono text-sm">{fmt(selectedDispatchForPrint.netSalesDue)}</span>
                        </div>

                        <div className="flex justify-between pt-0.5">
                          <span>Cash Remitted:</span>
                          <span className="font-mono font-semibold">{fmt(selectedDispatchForPrint.amountRemittedCash)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Bank Transfer Remitted:</span>
                          <span className="font-mono font-semibold">{fmt(selectedDispatchForPrint.amountRemittedTransfer)}</span>
                        </div>
                        {selectedDispatchForPrint.amountRemittedPOS > 0 && (
                          <div className="flex justify-between">
                            <span>POS Terminal Remitted:</span>
                            <span className="font-mono font-semibold">{fmt(selectedDispatchForPrint.amountRemittedPOS)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold pt-1 border-t border-dashed border-black">
                          <span>Total Money Remitted:</span>
                          <span className="font-mono">{fmt(selectedDispatchForPrint.totalAmountRemitted)}</span>
                        </div>
                        {selectedDispatchForPrint.shortageOrExcess !== 0 ? (
                          <div className="flex justify-between font-black">
                            <span>{selectedDispatchForPrint.shortageOrExcess < 0 ? '⚠ SHORTAGE / BALANCE OWED:' : 'SURPLUS / EXCESS PAYMENT:'}</span>
                            <span className="font-mono text-sm">
                              {fmt(selectedDispatchForPrint.shortageOrExcess)}
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-between font-semibold">
                            <span>Settlement Audit:</span>
                            <span className="font-mono">Balanced (Zero Shortage)</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Notes & Memo */}
                  {selectedDispatchForPrint.notes && (
                    <div className="text-[10.5px] text-black pt-1">
                      <strong>Remarks / Instructions:</strong> {selectedDispatchForPrint.notes}
                    </div>
                  )}

                  {/* Signatures Block */}
                  <div className="pt-6 grid grid-cols-2 gap-6 text-[10px] text-center text-black">
                    <div>
                      <div className="border-b-2 border-black pb-8"></div>
                      <p className="mt-1 font-bold uppercase">Sales Representative</p>
                      <p className="text-gray-700">({selectedDispatchForPrint.repName})</p>
                    </div>
                    <div>
                      <div className="border-b-2 border-black pb-8"></div>
                      <p className="mt-1 font-bold uppercase">Store / Inventory Auditor</p>
                      <p className="text-gray-700">
                        ({selectedDispatchForPrint.receivedAndAuditedBy || selectedDispatchForPrint.dispatchedBy || 'Auditor'})
                      </p>
                    </div>
                  </div>

                  {/* System Footer Stamp */}
                  <div className="text-center text-[9px] text-gray-700 pt-2 border-t border-dashed border-black">
                    Validated &bull; Windows Inventory Management POS &bull; Generated {new Date().toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE DISPATCH CONFIRMATION MODAL                               */}
      {/* ========================================================================= */}
      {dispatchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#27272a] rounded-2xl max-w-md w-full shadow-2xl border border-rose-200 dark:border-rose-900/50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-950 dark:text-rose-100">
                    Delete Field Dispatch Record
                  </h3>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                    Confirm permanent removal of dispatch slip
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchToDelete(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-gray-600 dark:text-gray-300">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#202023] border border-gray-200 dark:border-gray-800 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                    {dispatchToDelete.repName}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                    {dispatchToDelete.dispatchNumber}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500">
                  Date: {dispatchToDelete.dateDispatched} {dispatchToDelete.timeDispatched} • Total Taken: {fmt(dispatchToDelete.totalSumTaken)}
                </div>
              </div>

              <p className="leading-relaxed">
                Are you sure you want to delete dispatch <strong className="text-gray-900 dark:text-gray-100">{dispatchToDelete.dispatchNumber}</strong> for{' '}
                <strong className="text-gray-900 dark:text-gray-100">{dispatchToDelete.repName}</strong>?
              </p>
            </div>

            <div className="px-5 py-3.5 bg-gray-50 dark:bg-[#202023] border-t border-gray-200 dark:border-gray-800 flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setDispatchToDelete(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = dispatchToDelete;
                  setDispatchToDelete(null);
                  onDeleteDispatch(target.id);
                  setFeedbackBanner(`Dispatch ${target.dispatchNumber} (${target.repName}) deleted.`);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete Dispatch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
