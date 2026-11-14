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
  Clock,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { InventoryItem } from '../types';
import {
  testFirestoreConnection,
  uploadAllItemsToFirestore,
  fetchRemoteItems,
  saveItemToFirestore,
  saveItemsBatchToFirestore,
  mergeRemoteItemsByTimestamp,
  getFirebaseConfig,
  getRecentDeltaSyncLogs,
  DeltaSyncLogEntry,
  DELTA_SYNC_INTERVAL_MS,
} from '../services/firebaseSync';

interface FirebaseSyncManagerProps {
  items: InventoryItem[];
  isAdmin: boolean;
  onItemsUpdated: (updatedItems: InventoryItem[]) => void;
  onOpenMobileIntake?: () => void;
  lastSyncTime?: string;
  isDeltaSyncing?: boolean;
  onTriggerDeltaSync?: () => Promise<void> | void;
}

export const FirebaseSyncManager: React.FC<FirebaseSyncManagerProps> = ({
  items,
  isAdmin,
  onItemsUpdated,
  onOpenMobileIntake,
  lastSyncTime,
  isDeltaSyncing = false,
  onTriggerDeltaSync,
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [statusMessage, setStatusMessage] = useState<string>('Verifying Firestore connection...');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'sync' | 'intake'>('sync');
  const [syncNotification, setSyncNotification] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [deltaLogs, setDeltaLogs] = useState<DeltaSyncLogEntry[]>(() => getRecentDeltaSyncLogs());

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

  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setSyncNotification({ type, text });
    setTimeout(() => setSyncNotification(null), 4500);
  };

  useEffect(() => {
    checkConnection();
  }, []);

  // Refresh recent delta logs whenever lastSyncTime updates
  useEffect(() => {
    setDeltaLogs(getRecentDeltaSyncLogs());
  }, [lastSyncTime]);

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
      showNotification('error', 'Permission Denied: Only administrators can push bulk inventory to cloud.');
      return;
    }
    setIsSyncing(true);
    try {
      const count = await uploadAllItemsToFirestore(items);
      showNotification('success', `Successfully pushed ${count} inventory items to Firebase Firestore.`);
      await checkConnection();
    } catch (err: any) {
      showNotification('error', `Failed to sync to Firestore: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullFromCloud = async () => {
    setIsSyncing(true);
    try {
      const remoteItems = await fetchRemoteItems();
      if (remoteItems.length === 0) {
        showNotification('info', 'No items found in Firestore cloud database. You can push your desktop items first.');
      } else {
        let deletedSet = new Set<string>();
        try {
          const savedDeleted = localStorage.getItem('win_inv_deleted_ids');
          if (savedDeleted) deletedSet = new Set<string>(JSON.parse(savedDeleted));
        } catch {}

        const { merged, hasChanges, localNewerItems } = mergeRemoteItemsByTimestamp(
          items,
          remoteItems,
          deletedSet
        );
        if (hasChanges) {
          onItemsUpdated(merged);
        }
        if (localNewerItems.length > 0) {
          await saveItemsBatchToFirestore(localNewerItems);
        }
        showNotification(
          'success',
          localNewerItems.length > 0
            ? `Synced ${remoteItems.length} cloud item(s) and preserved & uploaded ${localNewerItems.length} newer local update(s).`
            : `Successfully pulled and synchronized ${remoteItems.length} items from Firebase Firestore.`
        );
      }
    } catch (err: any) {
      showNotification('error', `Failed to fetch from Firestore: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualDeltaClick = async () => {
    if (onTriggerDeltaSync) {
      await onTriggerDeltaSync();
      setDeltaLogs(getRecentDeltaSyncLogs());
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
      showNotification('error', 'Please enter an item name.');
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
      showNotification('error', `Failed to save remotely: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSubmittingIntake(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Inline Feedback Toast */}
      {syncNotification && (
        <div
          className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between space-x-2 animate-fade-in ${
            syncNotification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              : syncNotification.type === 'error'
              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800'
              : 'bg-blue-50 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {syncNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : syncNotification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span>{syncNotification.text}</span>
          </div>
          <button
            onClick={() => setSyncNotification(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

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
          {/* 5-Minute Smart Delta Check Card (Spark Free Tier Safe) */}
          <div className="p-4 rounded-xl border border-blue-500/30 dark:border-blue-500/20 bg-gradient-to-br from-blue-50/60 via-indigo-50/30 to-purple-50/30 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-purple-950/20 space-y-3 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      5-Minute Smart Delta Check
                    </h4>
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Active</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Lightweight delta query checks for changes made across other devices strictly since last check.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleManualDeltaClick}
                disabled={isDeltaSyncing}
                className="flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 transition-colors shrink-0"
                title="Trigger immediate delta reconciliation check"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDeltaSyncing ? 'animate-spin' : ''}`} />
                <span>{isDeltaSyncing ? 'Checking Firestore...' : 'Run Delta Sync Now'}</span>
              </button>
            </div>

            {/* Quota & Health Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-black/[0.05] dark:border-white/[0.05] flex flex-col justify-between">
                <span className="text-slate-500 text-[10px]">Last Checked</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                  {lastSyncTime
                    ? `${new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : 'Awaiting first check'}
                </span>
                <span className="text-[9.5px] text-slate-400 mt-0.5">Auto-Interval: Every 5 minutes</span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-black/[0.05] dark:border-white/[0.05] flex flex-col justify-between">
                <span className="text-slate-500 text-[10px]">Free Tier Quota Usage</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center space-x-1">
                  <span>~288 reads / day (&lt;3.5%)</span>
                </span>
                <span className="text-[9.5px] text-slate-400 mt-0.5">Spark plan: 50,000 free reads/day</span>
              </div>

              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-black/[0.05] dark:border-white/[0.05] flex flex-col justify-between">
                <span className="text-slate-500 text-[10px]">Query Strategy</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  Indexed Timestamp Deltas
                </span>
                <span className="text-[9.5px] text-slate-400 mt-0.5">0-read cost when unchanged</span>
              </div>
            </div>

            {/* Recent Delta Sync Log Table */}
            {deltaLogs.length > 0 && (
              <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.05] space-y-1.5">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                    <Activity className="w-3 h-3 text-blue-500" />
                    <span>Recent Delta Check History</span>
                  </span>
                  <span className="text-slate-400 text-[10px]">Last {Math.min(deltaLogs.length, 6)} checks</span>
                </div>
                <div className="max-h-36 overflow-y-auto overflow-x-auto rounded-lg border border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-[10.5px] min-w-[420px]">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 text-slate-600 dark:text-slate-400 font-semibold">
                      <tr>
                        <th className="p-1.5 pl-2">Time</th>
                        <th className="p-1.5">Status</th>
                        <th className="p-1.5">Changes Reconciled</th>
                        <th className="p-1.5 pr-2 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04] font-mono text-[10px]">
                      {deltaLogs.slice(0, 6).map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-1.5 pl-2 text-slate-700 dark:text-slate-300 font-sans">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="p-1.5">
                            <span
                              className={`px-1.5 py-0.2 rounded font-sans text-[9px] font-bold uppercase tracking-wider ${
                                log.status === 'synced_changes'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : log.status === 'error'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}
                            >
                              {log.status === 'synced_changes'
                                ? 'Updated'
                                : log.status === 'error'
                                ? 'Warning'
                                : 'In Sync'}
                            </span>
                          </td>
                          <td className="p-1.5 text-slate-600 dark:text-slate-300 font-sans">
                            {log.totalChanges > 0 ? (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                +{log.totalChanges} record(s) reconciled
                              </span>
                            ) : (
                              <span className="text-slate-400">0 deltas (all current)</span>
                            )}
                          </td>
                          <td className="p-1.5 pr-2 text-right text-slate-500">
                            {log.durationMs}ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

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
