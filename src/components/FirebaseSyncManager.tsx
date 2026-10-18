import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  QrCode,
  Copy,
  Check,
  Plus,
  Package,
  Barcode,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
  Cloud,
} from 'lucide-react';
import { InventoryItem } from '../types';
import {
  testFirestoreConnection,
  uploadAllItemsToFirestore,
  fetchRemoteItems,
  saveItemToFirestore,
  getFirebaseConfig,
} from '../services/firebaseSync';

interface FirebaseSyncManagerProps {
  items: InventoryItem[];
  isAdmin: boolean;
  onItemsUpdated: (updatedItems: InventoryItem[]) => void;
  onOpenMobileIntake?: () => void;
}

export const FirebaseSyncManager: React.FC<FirebaseSyncManagerProps> = ({
  items,
  isAdmin,
  onItemsUpdated,
  onOpenMobileIntake,
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [statusMessage, setStatusMessage] = useState<string>('Verifying Firestore connection...');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'sync' | 'intake'>('sync');

  // Quick remote test intake state
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newQuantity, setNewQuantity] = useState(10);
  const [newCostPrice, setNewCostPrice] = useState(1500);
  const [newRetailPrice, setNewRetailPrice] = useState(2500);
  const [newUnit, setNewUnit] = useState('pcs');
  const [newBarcode, setNewBarcode] = useState('');
  const [isSubmittingIntake, setIsSubmittingIntake] = useState(false);
  const [intakeSuccessMsg, setIntakeSuccessMsg] = useState<string | null>(null);

  const firebaseConfig = getFirebaseConfig();

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setConnectionStatus('checking');
    setStatusMessage('Checking Firestore connection...');
    const res = await testFirestoreConnection();
    if (res.success) {
      setConnectionStatus('connected');
      setStatusMessage('Connected to Google Firebase Firestore. Ready for real-time cloud sync.');
    } else {
      setConnectionStatus('error');
      setStatusMessage(res.message);
    }
  };

  const handlePushAllToCloud = async () => {
    if (!isAdmin) {
      alert('Permission Denied: Only administrators can push bulk inventory to cloud.');
      return;
    }
    setIsSyncing(true);
    try {
      const count = await uploadAllItemsToFirestore(items);
      alert(`Successfully synced ${count} inventory items to Firebase Firestore.`);
      await checkConnection();
    } catch (err: any) {
      alert(`Failed to sync to Firestore: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsSyncing(true);
    try {
      const remoteItems = await fetchRemoteItems();
      if (remoteItems.length === 0) {
        alert('No items found in Firestore cloud database. You can push your desktop items first.');
      } else {
        // Merge with local items by id or sku
        const mergedMap = new Map<string, InventoryItem>();
        items.forEach((it) => mergedMap.set(it.id, it));
        remoteItems.forEach((it) => mergedMap.set(it.id, it));
        const combined = Array.from(mergedMap.values());
        onItemsUpdated(combined);
        alert(`Successfully pulled and synchronized ${remoteItems.length} items from Firebase Firestore.`);
      }
    } catch (err: any) {
      alert(`Failed to fetch from Firestore: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleRemoteSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert('Please enter an item name.');
      return;
    }

    setIsSubmittingIntake(true);
    const id = 'item_' + Math.random().toString(36).substring(2, 9);
    const sku = newSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

    const now = new Date().toISOString();
    const newItem: InventoryItem = {
      id,
      sku,
      name: newName.trim(),
      category: newCategory.trim() || 'General',
      quantity: Number(newQuantity) || 0,
      minQuantity: 5,
      unitCost: Number(newCostPrice) || 0,
      retailPrice: Number(newRetailPrice) || 0,
      unit: newUnit.trim() || 'pcs',
      barcode: newBarcode.trim() || undefined,
      location: 'Store Floor',
      notes: 'Added remotely via Cloud Intake Portal',
      lastRestocked: now,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await saveItemToFirestore(newItem);
      onItemsUpdated([newItem, ...items]);
      setIntakeSuccessMsg(`"${newItem.name}" (${newItem.sku}) loaded remotely into Firestore!`);
      // Reset form
      setNewName('');
      setNewSku('');
      setNewBarcode('');
      setTimeout(() => setIntakeSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Failed to save remotely: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingIntake(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Cloud Status Banner */}
      <div className="p-4 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-slate-50 dark:bg-slate-800/60 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-600'
                  : connectionStatus === 'checking'
                  ? 'bg-blue-600'
                  : 'bg-rose-600'
              }`}
            >
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Google Firebase Firestore
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1 ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : connectionStatus === 'checking'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connectionStatus === 'connected'
                        ? 'bg-emerald-500 animate-pulse'
                        : connectionStatus === 'checking'
                        ? 'bg-blue-500 animate-ping'
                        : 'bg-rose-500'
                    }`}
                  />
                  <span>
                    {connectionStatus === 'connected'
                      ? 'Cloud Connected (Free Tier)'
                      : connectionStatus === 'checking'
                      ? 'Checking...'
                      : 'Offline / Error'}
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{statusMessage}</p>
            </div>
          </div>

          <button
            onClick={checkConnection}
            disabled={connectionStatus === 'checking'}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-600 text-xs font-medium cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${connectionStatus === 'checking' ? 'animate-spin' : ''}`} />
            <span>Test Connection</span>
          </button>
        </div>

        {/* Database Identifiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] text-[11px] font-mono">
          <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900 border border-black/[0.04] dark:border-white/[0.04]">
            <span className="text-slate-500">Project ID:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate ml-2">
              {firebaseConfig.projectId}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900 border border-black/[0.04] dark:border-white/[0.04]">
            <span className="text-slate-500">Database ID:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate ml-2">
              {firebaseConfig.firestoreDatabaseId || '(default)'}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-black/[0.06] dark:border-white/[0.06] gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveSubTab('sync')}
          className={`pb-2 px-1 border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
            activeSubTab === 'sync'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Sync Controls</span>
        </button>

        <button
          onClick={() => setActiveSubTab('intake')}
          className={`pb-2 px-1 border-b-2 flex items-center space-x-1.5 transition-colors cursor-pointer ${
            activeSubTab === 'intake'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Remote Intake Portal</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Live
          </span>
        </button>
      </div>

      {/* TAB 1: SYNC CONTROLS */}
      {activeSubTab === 'sync' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Push Local Items */}
            <div className="p-4 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-800/40 flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-2">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Push Desktop Items to Cloud
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Upload all {items.length} current inventory items to Firestore so your cloud database has the full catalog.
                </p>
              </div>

              <button
                onClick={handlePushAllToCloud}
                disabled={isSyncing || !isAdmin}
                className="mt-4 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{isSyncing ? 'Syncing...' : `Push All (${items.length} Items)`}</span>
              </button>
            </div>

            {/* Pull Remote Items */}
            <div className="p-4 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-800/40 flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                  <DownloadCloud className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Pull Items from Cloud
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Download items added or modified remotely from other cloud sessions into your local database.
                </p>
              </div>

              <button
                onClick={handlePullFromCloud}
                disabled={isSyncing}
                className="mt-4 w-full flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>{isSyncing ? 'Pulling...' : 'Pull & Merge Remote Items'}</span>
              </button>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300 flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Automatic Real-Time Background Synchronization</p>
              <p className="mt-0.5 text-blue-800 dark:text-blue-400">
                Any item loaded via Firestore is received instantaneously by the desktop application. There is no need to manually reload or re-open the app.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REMOTE INTAKE PORTAL */}
      {activeSubTab === 'intake' && (
        <div className="p-4 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-800/40 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Cloud className="w-4 h-4 text-blue-600" />
                <span>Remote Intake (Instant Simulation)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Test adding items remotely right now. This directly writes to the Firestore cloud database and updates the inventory in real time.
              </p>
            </div>
          </div>

          {intakeSuccessMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center space-x-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{intakeSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleRemoteSubmitIntake} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wireless Barcode Scanner Gen 2"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.12] bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  SKU (Leave blank to auto-generate)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SCAN-0099"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.12] bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  placeholder="Accessories"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.12] bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Stock
                </label>
                <input
                  type="number"
                  min="0"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.12] bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Cost Price
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={newCostPrice}
                  onChange={(e) => setNewCostPrice(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.12] bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Retail Price
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={newRetailPrice}
                  onChange={(e) => setNewRetailPrice(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.12] bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Barcode / UPC (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 79357319201"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.12] bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Unit Type
                </label>
                <input
                  type="text"
                  placeholder="pcs, box, roll, kg"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-black/[0.12] dark:border-white/[0.12] bg-slate-50 dark:bg-slate-900 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmittingIntake}
              className="w-full mt-2 flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{isSubmittingIntake ? 'Uploading to Firestore...' : 'Save & Push Remotely to Cloud Inventory'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
