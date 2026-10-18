import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  X,
  Boxes,
  User,
  Hash,
  FileText,
  DollarSign,
  Printer,
} from 'lucide-react';
import { InventoryItem, MovementType, AppSettings } from '../types';

interface StockAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
  initialType: 'in' | 'out';
  settings: AppSettings;
  onConfirmAdjust: (
    item: InventoryItem,
    delta: number,
    type: MovementType,
    operator: string,
    referenceNumber: string,
    reason: string,
    printReceipt?: boolean
  ) => void;
}

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  isOpen,
  onClose,
  item,
  initialType,
  settings,
  onConfirmAdjust,
}) => {
  const [direction, setDirection] = useState<'in' | 'out'>(initialType);
  const [quantity, setQuantity] = useState<number>(1);
  const [movementType, setMovementType] = useState<MovementType>(
    initialType === 'in' ? 'in_purchase' : 'out_sale'
  );
  const [operator, setOperator] = useState<string>('Alex Rivera (Operator)');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [shouldPrintReceipt, setShouldPrintReceipt] = useState<boolean>(true);

  if (!isOpen || !item) return null;

  const handleDirectionSwitch = (dir: 'in' | 'out') => {
    setDirection(dir);
    setMovementType(dir === 'in' ? 'in_purchase' : 'out_sale');
  };

  const calculatedNewQty =
    direction === 'in' ? item.quantity + quantity : Math.max(0, item.quantity - quantity);

  const delta = direction === 'in' ? quantity : -quantity;
  const costImpact = quantity * item.unitCost;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0) return;

    if (direction === 'out' && quantity > item.quantity) {
      if (
        !window.confirm(
          `Warning: Dispatching ${quantity} ${item.unit} exceeds current stock (${item.quantity} ${item.unit}). Proceed with depletion to 0?`
        )
      ) {
        return;
      }
    }

    onConfirmAdjust(
      item,
      delta,
      movementType,
      operator.trim() || 'Alex Rivera',
      referenceNumber.trim(),
      reason.trim(),
      shouldPrintReceipt
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-[#222222] rounded-xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${
                direction === 'in' ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            >
              {direction === 'in' ? (
                <ArrowDownRight className="w-4 h-4" />
              ) : (
                <ArrowUpRight className="w-4 h-4" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {direction === 'in' ? 'Stock Inbound Receipt (+)' : 'Stock Outbound Dispatch (-)'}
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                {item.sku} — {item.name}
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Direction toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => handleDirectionSwitch('in')}
              className={`py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                direction === 'in'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              + Stock In (Receive)
            </button>
            <button
              type="button"
              onClick={() => handleDirectionSwitch('out')}
              className={`py-1.5 rounded-md font-semibold text-xs transition-all cursor-pointer ${
                direction === 'out'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              - Stock Out (Dispatch)
            </button>
          </div>

          {/* Quantity & Balance Calculation */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-black/[0.04] dark:border-white/[0.04] space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Quantity to {direction === 'in' ? 'Add' : 'Remove'} *
              </label>
              <span className="font-mono text-slate-500">
                Current: <strong className="text-slate-900 dark:text-slate-100">{item.quantity} {item.unit}</strong>
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="flex-1 bg-white dark:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-2 text-base font-mono font-bold outline-none"
              />
              <span className="text-xs text-slate-400 font-mono">{item.unit}</span>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-black/[0.05] dark:border-white/[0.05]">
              <span className="text-slate-500">Projected Balance After:</span>
              <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                {calculatedNewQty} {item.unit}
              </span>
            </div>
          </div>

          {/* Movement Type / Reason dropdown */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Transaction Classification *
            </label>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as MovementType)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-2 text-xs outline-none cursor-pointer"
            >
              {direction === 'in' ? (
                <>
                  <option value="in_purchase">Supplier PO Purchase / Restock</option>
                  <option value="in_return">Customer Return to Inventory</option>
                  <option value="in_adjustment">Inventory Audit Count Adjustment (+)</option>
                </>
              ) : (
                <>
                  <option value="out_sale">Customer Sale / Order Dispatch</option>
                  <option value="out_damaged">Damaged / Expired / Scrap Write-off</option>
                  <option value="out_loss">Inventory Shrinkage / Lost Goods</option>
                  <option value="out_adjustment">Inventory Audit Count Adjustment (-)</option>
                </>
              )}
            </select>
          </div>

          {/* Reference # & Operator */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reference / Order #
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. PO-980 or ORD-102"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs font-mono outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Operator / Staff
              </label>
              <input
                type="text"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs outline-none"
              />
            </div>
          </div>

          {/* Reason memo */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Internal Memo / Reason (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Received from Vanguard batch shipment"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs outline-none"
            />
          </div>

          {/* Receipt Print Option */}
          <div className="flex items-center space-x-2 bg-blue-50/60 dark:bg-blue-950/30 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
            <input
              type="checkbox"
              id="shouldPrintReceipt"
              checked={shouldPrintReceipt}
              onChange={(e) => setShouldPrintReceipt(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="shouldPrintReceipt" className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer">
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>Generate & preview printable receipt / dispatch voucher</span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between">
            <div className="text-[11px] text-slate-400 font-mono">
              Valuation delta: {direction === 'in' ? '+' : '-'}{settings.currencySymbol}{costImpact.toFixed(2)}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`px-4 py-1.5 rounded text-white font-semibold shadow-xs cursor-pointer ${
                  direction === 'in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Confirm {direction === 'in' ? '+ Stock In' : '- Stock Out'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
