import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Filter,
  FileSpreadsheet,
  Calendar,
  User,
  Hash,
  Layers,
  Printer,
  Trash2,
  Lock,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { StockMovement, AppSettings, MovementType } from '../types';

interface StockMovementsViewProps {
  movements: StockMovement[];
  settings: AppSettings;
  isAdmin?: boolean;
  onPrintReceipt?: (movement: StockMovement) => void;
  onDeleteMovement?: (id: string) => void;
  onNewAdjustment?: () => void;
}

export const StockMovementsView: React.FC<StockMovementsViewProps> = ({
  movements,
  settings,
  isAdmin = true,
  onPrintReceipt,
  onDeleteMovement,
  onNewAdjustment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [deleteTargetMovement, setDeleteTargetMovement] = useState<StockMovement | null>(null);

  const filteredMovements = useMemo(() => {
    return movements.filter((mov) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSku = mov.itemSku.toLowerCase().includes(q);
        const matchName = mov.itemName.toLowerCase().includes(q);
        const matchOp = mov.operator.toLowerCase().includes(q);
        const matchRef = (mov.referenceNumber || '').toLowerCase().includes(q);
        const matchReason = (mov.reason || '').toLowerCase().includes(q);
        if (!matchSku && !matchName && !matchOp && !matchRef && !matchReason) return false;
      }

      if (selectedType === 'in') {
        if (mov.quantityDelta <= 0) return false;
      } else if (selectedType === 'out') {
        if (mov.quantityDelta >= 0) return false;
      } else if (selectedType !== 'all') {
        if (mov.type !== selectedType) return false;
      }

      return true;
    });
  }, [movements, searchQuery, selectedType]);

  const getTypeLabel = (type: MovementType) => {
    switch (type) {
      case 'in_purchase':
        return { label: 'Supplier Purchase', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
      case 'in_return':
        return { label: 'Customer Return', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' };
      case 'in_adjustment':
        return { label: 'Audit Adjustment (+)', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' };
      case 'out_sale':
        return { label: 'Customer Sale', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' };
      case 'out_damaged':
        return { label: 'Damaged / Scrapped', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' };
      case 'out_loss':
        return { label: 'Lost / Shrinkage', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
      case 'out_adjustment':
        return { label: 'Audit Adjustment (-)', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' };
      default:
        return { label: type, color: 'bg-slate-100 text-slate-800' };
    }
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto flex flex-col h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Stock Ledger & Audit Trail</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {filteredMovements.length} transactions
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Log of all inbound receipts, outbound dispatches, and inventory adjustments.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {isAdmin ? (
            onNewAdjustment && (
              <button
                onClick={onNewAdjustment}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Transaction / Adjustment</span>
              </button>
            )
          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md text-xs font-medium border border-black/[0.06] dark:border-white/[0.06]">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Admin Required to Edit Ledger</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-[#252525] border border-black/[0.08] dark:border-white/[0.08] text-xs shrink-0">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search SKU, operator, reference #..."
            className="w-full bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] rounded-md pl-8 pr-3 py-1 text-xs outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.06] dark:border-white/[0.06] rounded-md px-2.5 py-1 text-xs text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="all">All Movements</option>
            <option value="in">Inbound (+ All Receipts)</option>
            <option value="out">Outbound (- All Dispatches)</option>
            <option value="in_purchase">Supplier Purchases</option>
            <option value="out_sale">Sales Orders</option>
            <option value="out_damaged">Damaged / Scrap</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="flex-1 min-h-0 bg-white dark:bg-[#252525] rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-xs flex flex-col overflow-hidden">
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-[#f8f9fa] dark:bg-[#1e1e1e] border-b border-black/[0.08] dark:border-white/[0.08] z-10 font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Type / Category</th>
                <th className="p-3">SKU & Item</th>
                <th className="p-3 text-right">Change (Delta)</th>
                <th className="p-3 text-right">New Balance</th>
                <th className="p-3">Reference / Order #</th>
                <th className="p-3">Operator</th>
                <th className="p-3">Reason / Notes</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 opacity-60 text-slate-400" />
                    <p className="font-medium text-slate-600 dark:text-slate-300">No stock movements found</p>
                  </td>
                </tr>
              ) : (
                filteredMovements.map((mov) => {
                  const isIn = mov.quantityDelta > 0;
                  const typeInfo = getTypeLabel(mov.type);

                  return (
                    <tr key={mov.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      {/* Timestamp */}
                      <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(mov.timestamp).toLocaleDateString()} {new Date(mov.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>

                      {/* Movement Type */}
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>

                      {/* SKU & Name */}
                      <td className="p-3">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                          <span className="font-mono text-blue-600 dark:text-blue-400">{mov.itemSku}</span>
                          <span className="text-slate-400">•</span>
                          <span className="truncate max-w-[180px]">{mov.itemName}</span>
                        </div>
                      </td>

                      {/* Quantity Delta */}
                      <td className="p-3 text-right">
                        <span
                          className={`font-mono font-bold text-xs inline-flex items-center gap-0.5 ${
                            isIn ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isIn ? (
                            <>
                              <ArrowDownRight className="w-3.5 h-3.5 inline" />
                              +{mov.quantityDelta}
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5 inline" />
                              {mov.quantityDelta}
                            </>
                          )}
                        </span>
                      </td>

                      {/* Balance After */}
                      <td className="p-3 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {mov.newQuantity}
                      </td>

                      {/* Reference # */}
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                        {mov.referenceNumber || '—'}
                      </td>

                      {/* Operator */}
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        {mov.operator}
                      </td>

                      {/* Notes / Reason */}
                      <td className="p-3 text-slate-500 dark:text-slate-400 max-w-[160px] truncate text-[11px]">
                        {mov.reason || '—'}
                      </td>

                      {/* Actions: Print Slip & Delete Record (Admin Only) */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {onPrintReceipt && (
                            <button
                              onClick={() => onPrintReceipt(mov)}
                              className="inline-flex items-center space-x-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded text-[11px] font-medium transition-colors cursor-pointer"
                              title="Print Transaction Slip / Receipt"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Slip</span>
                            </button>
                          )}

                          {isAdmin && onDeleteMovement ? (
                            <button
                              onClick={() => setDeleteTargetMovement(mov)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                              title="Delete Transaction Record (Admin Only)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span
                              title="Only Administrator can delete stock ledger transaction records"
                              className="p-1 text-slate-300 dark:text-slate-600"
                            >
                              <Lock className="w-3 h-3" />
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
      </div>

      {/* In-App Delete Movement Record Confirmation Modal */}
      {deleteTargetMovement && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#222] rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-rose-950 dark:text-rose-100">
                    Delete Ledger Entry
                  </h3>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                    Admin Audit Removal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTargetMovement(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Are you sure you want to permanently delete movement record for <strong className="text-slate-900 dark:text-slate-100">{deleteTargetMovement.itemName}</strong>?
              </p>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] space-y-1">
                <div>SKU: <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{deleteTargetMovement.itemSku}</span></div>
                <div>Change: <span className={`font-mono font-bold ${deleteTargetMovement.quantityDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{deleteTargetMovement.quantityDelta > 0 ? `+${deleteTargetMovement.quantityDelta}` : deleteTargetMovement.quantityDelta}</span></div>
                <div>Operator: {deleteTargetMovement.operator}</div>
                <div>Ref / Date: {deleteTargetMovement.referenceNumber || deleteTargetMovement.id} ({new Date(deleteTargetMovement.timestamp).toLocaleString()})</div>
              </div>
            </div>

            <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteTargetMovement(null)}
                className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] cursor-pointer font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteMovement) {
                    onDeleteMovement(deleteTargetMovement.id);
                  }
                  setDeleteTargetMovement(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-lg shadow-xs cursor-pointer text-xs flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Entry</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


