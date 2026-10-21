import React, { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Printer,
  Trash2,
  AlertCircle,
  X,
} from 'lucide-react';
import { PurchaseOrder, Supplier, InventoryItem, AppSettings, PurchaseOrderItem } from '../types';
import { printElementById } from '../utils/print';

interface PurchaseOrdersViewProps {
  orders: PurchaseOrder[];
  suppliers: Supplier[];
  items: InventoryItem[];
  settings: AppSettings;
  onCreatePO: (po: PurchaseOrder) => void;
  onReceivePO: (poId: string) => void;
  onCancelPO: (poId: string) => void;
  onDeletePO: (poId: string) => void;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({
  orders,
  suppliers,
  items,
  settings,
  onCreatePO,
  onReceivePO,
  onCancelPO,
  onDeletePO,
}) => {
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(orders[0] || null);
  const [isCreating, setIsCreating] = useState(false);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync selectedPO when orders list updates (e.g. status change or deletion)
  useEffect(() => {
    if (selectedPO) {
      const updated = orders.find((o) => o.id === selectedPO.id);
      if (updated) {
        setSelectedPO(updated);
      } else {
        setSelectedPO(orders[0] || null);
      }
    } else if (orders.length > 0 && !isCreating) {
      setSelectedPO(orders[0]);
    }
  }, [orders]);

  // New PO form state
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedItemIdToAdd, setSelectedItemIdToAdd] = useState(items[0]?.id || '');
  const [addItemQty, setAddItemQty] = useState(10);

  const handleAddItemToPO = () => {
    const item = items.find((i) => i.id === selectedItemIdToAdd);
    if (!item) return;

    // Check if already in PO
    const exists = orderItems.find((oi) => oi.itemId === item.id);
    if (exists) {
      setOrderItems(
        orderItems.map((oi) =>
          oi.itemId === item.id
            ? { ...oi, quantity: oi.quantity + addItemQty, totalCost: (oi.quantity + addItemQty) * oi.unitCost }
            : oi
        )
      );
    } else {
      setOrderItems([
        ...orderItems,
        {
          itemId: item.id,
          sku: item.sku,
          name: item.name,
          quantity: addItemQty,
          unitCost: item.unitCost,
          totalCost: addItemQty * item.unitCost,
        },
      ]);
    }
  };

  const handleRemoveItemFromPO = (itemId: string) => {
    setOrderItems(orderItems.filter((i) => i.itemId !== itemId));
  };

  const handleSavePO = () => {
    if (orderItems.length === 0) {
      setFeedback({ type: 'error', message: 'Please add at least one item to the purchase order.' });
      return;
    }
    const sup = suppliers.find((s) => s.id === supplierId);
    const total = orderItems.reduce((sum, i) => sum + i.totalCost, 0);
    const poNum = `PO-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newPO: PurchaseOrder = {
      id: 'po_' + Math.random().toString(36).substring(2, 9),
      poNumber: poNum,
      supplierId: supplierId,
      supplierName: sup ? sup.name : 'Unknown Supplier',
      items: orderItems,
      status: 'ordered',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalAmount: total,
      notes: notes,
    };

    onCreatePO(newPO);
    setSelectedPO(newPO);
    setIsCreating(false);
    setOrderItems([]);
    setNotes('');
    setFeedback({ type: 'success', message: `Purchase Order ${newPO.poNumber} created.` });
  };

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'received':
        return { label: 'Received & Stocked', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' };
      case 'ordered':
        return { label: 'In Transit / Ordered', icon: Clock, color: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' };
      case 'draft':
        return { label: 'Draft PO', icon: FileText, color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' };
      case 'cancelled':
        return { label: 'Cancelled', icon: XCircle, color: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' };
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto flex flex-col h-[calc(100vh-2.5rem)]">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold shrink-0 shadow-2xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="px-2 py-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Purchase Orders</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {orders.length} orders
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Order replenishment from suppliers, receive goods into inventory, and print formal invoices.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase Order</span>
        </button>
      </div>

      {/* Two Column Layout: PO List & Detail Inspector */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Orders List */}
        <div className="lg:col-span-5 bg-white dark:bg-[#252525] rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-xs flex flex-col overflow-hidden">
          <div className="p-3 border-b border-black/[0.06] dark:border-white/[0.06] font-semibold text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40">
            All Purchase Orders
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-black/[0.04] dark:divide-white/[0.04]">
            {orders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No purchase orders created yet.</div>
            ) : (
              orders.map((po) => {
                const statusInfo = getStatusBadge(po.status);
                const StatusIcon = statusInfo.icon;
                const isSelected = selectedPO?.id === po.id;

                return (
                  <div
                    key={po.id}
                    onClick={() => {
                      setSelectedPO(po);
                      setIsCreating(false);
                    }}
                    className={`p-3.5 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/80 dark:bg-blue-950/50 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{po.poNumber}</span>
                      <div className="flex items-center space-x-1.5">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{statusInfo.label}</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPoToDelete(po);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                          title="Delete purchase order"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">
                      {po.supplierName}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-mono">
                      <span>{po.items.length} line items • Order Date: {po.orderDate}</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {settings.currencySymbol}
                        {po.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: PO Inspector / Print Preview OR Create Form */}
        <div className="lg:col-span-7 bg-white dark:bg-[#252525] rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-xs flex flex-col overflow-hidden">
          {isCreating ? (
            /* Create New PO Form */
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">Create Purchase Order</h3>
                <button
                  onClick={() => setIsCreating(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              {/* Supplier Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Supplier
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md px-3 py-1.5 text-xs outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Lead Time: {s.leadTimeDays} days)
                    </option>
                  ))}
                </select>
              </div>

              {/* Add Line Items */}
              <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-black/[0.04] dark:border-white/[0.04]">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">Add Items to PO</div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-8">
                    <select
                      value={selectedItemIdToAdd}
                      onChange={(e) => setSelectedItemIdToAdd(e.target.value)}
                      className="w-full bg-white dark:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1 text-xs"
                    >
                      {items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.sku} — {i.name} (Cost: {settings.currencySymbol}{i.unitCost.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min="1"
                      value={addItemQty}
                      onChange={(e) => setAddItemQty(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-white dark:bg-[#2b2b2b] border border-black/[0.08] dark:border-white/[0.08] rounded px-2 py-1 text-xs font-mono"
                      placeholder="Qty"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItemToPO}
                      className="w-full py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Order Items Table */}
              <div className="border border-black/[0.06] dark:border-white/[0.06] rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-2">Item</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Unit Cost</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                    {orderItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">
                          No items added to this PO yet.
                        </td>
                      </tr>
                    ) : (
                      orderItems.map((oi) => (
                        <tr key={oi.itemId}>
                          <td className="p-2 font-medium">
                            <span className="font-mono text-blue-600 dark:text-blue-400">{oi.sku}</span> - {oi.name}
                          </td>
                          <td className="p-2 text-right font-mono">{oi.quantity}</td>
                          <td className="p-2 text-right font-mono">
                            {settings.currencySymbol}{oi.unitCost.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-mono font-semibold">
                            {settings.currencySymbol}{oi.totalCost.toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleRemoveItemFromPO(oi.itemId)}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total & Notes */}
              <div className="flex items-center justify-between pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                <div className="text-xs text-slate-500">
                  Total Items: {orderItems.reduce((acc, i) => acc + i.quantity, 0)}
                </div>
                <div className="text-base font-bold font-mono text-slate-900 dark:text-slate-100">
                  Grand Total: {settings.currencySymbol}
                  {orderItems.reduce((acc, i) => acc + i.totalCost, 0).toFixed(2)}
                </div>
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal notes or delivery instructions..."
                rows={2}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded-md p-2 text-xs outline-none"
              />

              <button
                onClick={handleSavePO}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold cursor-pointer"
              >
                Create & Transmit Purchase Order
              </button>
            </div>
          ) : selectedPO ? (
            /* View / Inspect PO Details */
            <div id="po-printable-container" className="p-5 flex-1 overflow-y-auto flex flex-col justify-between space-y-4">
              <div className="space-y-4">
                {/* Header Action Row */}
                <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06] flex-wrap gap-2">
                  <div>
                    <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                      {selectedPO.poNumber}
                    </div>
                    <div className="text-xs text-slate-500">
                      Supplier: <strong className="text-slate-800 dark:text-slate-200">{selectedPO.supplierName}</strong>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 no-print">
                    <button
                      onClick={async () => {
                        try {
                          await printElementById('po-printable-container', `PO-${selectedPO.poNumber}`, 'a4');
                        } catch {
                          window.print();
                        }
                      }}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-medium cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print PO</span>
                    </button>

                    {selectedPO.status === 'ordered' && (
                      <button
                        type="button"
                        onClick={() => {
                          onReceivePO(selectedPO.id);
                          setFeedback({
                            type: 'success',
                            message: `Received ${selectedPO.poNumber} and added ${selectedPO.items.length} line items to stock.`,
                          });
                        }}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Receive Shipment</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setPoToDelete(selectedPO)}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-semibold cursor-pointer transition-colors"
                      title="Delete purchase order"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-black/[0.04] dark:border-white/[0.04]">
                    <div className="text-slate-400 text-[10px] uppercase font-semibold">Order Date</div>
                    <div className="font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                      {selectedPO.orderDate}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-black/[0.04] dark:border-white/[0.04]">
                    <div className="text-slate-400 text-[10px] uppercase font-semibold">Expected Arrival</div>
                    <div className="font-mono font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                      {selectedPO.expectedDate || 'N/A'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/60 border border-black/[0.04] dark:border-white/[0.04]">
                    <div className="text-slate-400 text-[10px] uppercase font-semibold">Status</div>
                    <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 capitalize">
                      {selectedPO.status}
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border border-black/[0.06] dark:border-white/[0.06] rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2.5">SKU & Item Name</th>
                        <th className="p-2.5 text-right">Quantity</th>
                        <th className="p-2.5 text-right">Unit Cost</th>
                        <th className="p-2.5 text-right">Total Line Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {selectedPO.items.map((item) => (
                        <tr key={item.itemId}>
                          <td className="p-2.5">
                            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                              {item.sku}
                            </span>{' '}
                            — {item.name}
                          </td>
                          <td className="p-2.5 text-right font-mono">{item.quantity}</td>
                          <td className="p-2.5 text-right font-mono">
                            {settings.currencySymbol}{item.unitCost.toFixed(2)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-semibold">
                            {settings.currencySymbol}{item.totalCost.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedPO.notes && (
                  <div className="p-3 rounded bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200">
                    <strong>Notes:</strong> {selectedPO.notes}
                  </div>
                )}
              </div>

              {/* Total Bottom Bar */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Invoice Net Amount</span>
                <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                  {settings.currencySymbol}
                  {selectedPO.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">Select a purchase order to view details.</div>
          )}
        </div>
      </div>

      {/* Delete Purchase Order Confirmation Modal */}
      {poToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#252525] rounded-2xl max-w-md w-full shadow-2xl border border-rose-200 dark:border-rose-900/50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-950 dark:text-rose-100">
                    Delete Purchase Order
                  </h3>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                    Confirm permanent removal of order record
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPoToDelete(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">
                    {poToDelete.poNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold capitalize bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                    {poToDelete.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Supplier: {poToDelete.supplierName} • Total: {settings.currencySymbol}
                  {poToDelete.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>

              <p className="leading-relaxed">
                Are you sure you want to delete Purchase Order <strong className="text-slate-900 dark:text-slate-100">{poToDelete.poNumber}</strong> for{' '}
                <strong className="text-slate-900 dark:text-slate-100">{poToDelete.supplierName}</strong>?
              </p>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/40 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => setPoToDelete(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-black/[0.06] dark:hover:bg-white/[0.06] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = poToDelete;
                  setPoToDelete(null);
                  onDeletePO(target.id);
                  setFeedback({
                    type: 'success',
                    message: `Purchase Order ${target.poNumber} (${target.supplierName}) deleted.`,
                  });
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Delete PO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

