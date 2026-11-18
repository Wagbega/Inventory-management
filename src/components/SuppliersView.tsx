import React, { useState } from 'react';
import { Truck, Plus, Mail, Phone, MapPin, Clock, Edit2, Trash2, Boxes, X } from 'lucide-react';
import { Supplier, InventoryItem } from '../types';

interface SuppliersViewProps {
  suppliers: Supplier[];
  items: InventoryItem[];
  onAddSupplier: (sup: Supplier) => void;
  onEditSupplier: (sup: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  items,
  onAddSupplier,
  onEditSupplier,
  onDeleteSupplier,
}) => {
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTargetSupplier, setDeleteTargetSupplier] = useState<Supplier | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    leadTimeDays: 5,
    address: '',
    notes: '',
  });

  const handleOpenCreate = () => {
    setFormData({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      leadTimeDays: 5,
      address: '',
      notes: '',
    });
    setEditingSupplier(null);
    setIsCreating(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setFormData({
      name: sup.name,
      contactPerson: sup.contactPerson,
      email: sup.email,
      phone: sup.phone,
      leadTimeDays: sup.leadTimeDays,
      address: sup.address,
      notes: sup.notes || '',
    });
    setEditingSupplier(sup);
    setIsCreating(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingSupplier) {
      onEditSupplier({
        ...editingSupplier,
        ...formData,
      });
    } else {
      onAddSupplier({
        id: 'sup_' + Math.random().toString(36).substring(2, 9),
        ...formData,
      });
    }
    setIsCreating(false);
    setEditingSupplier(null);
  };

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto flex flex-col h-[calc(100vh-2.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Supplier Network</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {suppliers.length} vendors
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage distributor relationships, lead time estimates, and product sourcing.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Supplier</span>
        </button>
      </div>

      {/* Supplier Cards Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((sup) => {
            const linkedItems = items.filter((i) => i.supplierId === sup.id);

            return (
              <div
                key={sup.id}
                className="p-5 rounded-xl bg-white dark:bg-[#252525] border border-black/[0.08] dark:border-white/[0.08] shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
              >
                <div className="space-y-3">
                  {/* Title & Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{sup.name}</h3>
                      <div className="text-xs text-slate-500">{sup.contactPerson}</div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEdit(sup)}
                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        title="Edit Supplier"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTargetSupplier(sup)}
                        className="p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Delete Supplier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <a href={`mailto:${sup.email}`} className="text-blue-600 dark:text-blue-400 hover:underline truncate">
                        {sup.email}
                      </a>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{sup.phone}</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="text-[11px] text-slate-500 line-clamp-2">{sup.address}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Footer */}
                <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-xs">
                  <span className="flex items-center space-x-1 text-slate-500 text-[11px]">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Lead: {sup.leadTimeDays} days</span>
                  </span>

                  <span className="flex items-center space-x-1 font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                    <Boxes className="w-3 h-3 text-blue-500" />
                    <span>{linkedItems.length} SKUs</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#252525] rounded-xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
            </h3>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Company / Vendor Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Apex Hardware Supplies"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Lead Time (Days)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.leadTimeDays}
                    onChange={(e) => setFormData({ ...formData, leadTimeDays: Number(e.target.value) })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="orders@vendor.com"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Physical / Shipping Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Street, City, State, ZIP"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-App Delete Supplier Confirmation Modal */}
      {deleteTargetSupplier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-[#222] rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-2xl max-w-sm w-full overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-rose-50/70 dark:bg-rose-950/30">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-rose-950 dark:text-rose-100">
                    Delete Supplier
                  </h3>
                  <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80">
                    Remove supplier partnership
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeleteTargetSupplier(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Are you sure you want to delete supplier <strong className="text-slate-900 dark:text-slate-100">"{deleteTargetSupplier.name}"</strong>?
              </p>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] text-slate-500 space-y-1">
                <div>Contact: {deleteTargetSupplier.contactPerson || 'N/A'}</div>
                <div>Email: {deleteTargetSupplier.email || 'N/A'}</div>
                <div>Lead Time: {deleteTargetSupplier.leadTimeDays} days</div>
              </div>
            </div>

            <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteTargetSupplier(null)}
                className="px-3.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-black/[0.05] dark:hover:bg-white/[0.05] cursor-pointer font-medium text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSupplier(deleteTargetSupplier.id);
                  setDeleteTargetSupplier(null);
                }}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-lg shadow-xs cursor-pointer text-xs flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Supplier</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
