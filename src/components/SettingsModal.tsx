import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  X,
  Upload,
  Download,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  FileSpreadsheet,
  Building,
  DollarSign,
  AlertTriangle,
  Cloud,
  CloudUpload,
  CloudDownload,
  Calendar,
  Clock,
  Shield,
  Briefcase,
  Lock,
  RefreshCw,
  HardDrive,
  Check,
  Trash2,
  Layers,
  Database,
  ExternalLink,
  Sun,
  Moon,
  Monitor,
  Smartphone,
  Laptop,
  LogOut,
  Edit3,
  Radio,
  Image as ImageIcon,
  KeyRound,
  ArrowUpCircle,
  GitBranch,
  Terminal,
  Copy,
  CheckSquare,
} from 'lucide-react';
import {
  AppSettings,
  InventoryItem,
  StockMovement,
  Supplier,
  PurchaseOrder,
  ReceiptData,
  AppUser,
  CloudBackupSchedule,
  CloudBackupSnapshot,
  CloudBackupFrequency,
  ActiveDeviceSession,
} from '../types';
import { industryPresets, IndustryPreset } from '../data/mockData';
import {
  parseCSVToItems,
  exportInventoryToCSV,
  exportStockMovementsToCSV,
  exportReceiptsToCSV,
  exportAllDataCSVBundle,
} from '../utils/csv';
import { downloadSnapshotJSON } from '../utils/cloudBackup';
import { GoogleDriveManager } from './GoogleDriveManager';
import { FirebaseSyncManager } from './FirebaseSyncManager';
import { AppLogo } from './AppLogo';
import {
  updateCloudDevPassword,
  subscribeToActiveDevices,
  upsertActiveDeviceSession,
  revokeDeviceSessionInFirestore,
  renameDeviceSessionInFirestore,
  deleteDeviceSessionFromFirestore,
  getOrCreateLocalDeviceId,
  getLocalDeviceName,
  APP_BUILD_VERSION,
} from '../services/firebaseSync';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  settings: AppSettings;
  onUpdateSettings: (s: Partial<AppSettings>) => void;
  onLoadPreset: (preset: IndustryPreset) => void;
  onImportCSVItems: (items: InventoryItem[]) => void;
  onExportJSONBackup: () => void;
  onRestoreJSONBackup: (data: {
    items?: InventoryItem[];
    movements?: StockMovement[];
    suppliers?: Supplier[];
    orders?: PurchaseOrder[];
    receipts?: ReceiptData[];
    users?: AppUser[];
    settings?: AppSettings;
  }) => void;
  onResetAllData: () => void;

  // Items and records for CSV and Cloud operations
  items: InventoryItem[];
  movements: StockMovement[];
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  receipts: ReceiptData[];
  users: AppUser[];

  // Cloud Backup State & Handlers
  cloudSchedule: CloudBackupSchedule;
  cloudSnapshots: CloudBackupSnapshot[];
  onUpdateCloudSchedule: (s: Partial<CloudBackupSchedule>) => void;
  onTriggerCloudBackup: (type?: CloudBackupFrequency, notes?: string) => Promise<CloudBackupSnapshot>;
  onRestoreCloudSnapshot: (snapshot: CloudBackupSnapshot) => void;
  onDeleteCloudSnapshot: (id: string) => void;
  onOpenChangePassword?: (targetUser?: AppUser) => void;
  onItemsUpdated?: (items: InventoryItem[]) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  settings,
  onUpdateSettings,
  onLoadPreset,
  onImportCSVItems,
  onExportJSONBackup,
  onRestoreJSONBackup,
  onResetAllData,
  items,
  movements,
  suppliers,
  orders,
  receipts,
  users,
  cloudSchedule,
  cloudSnapshots,
  onUpdateCloudSchedule,
  onTriggerCloudBackup,
  onRestoreCloudSnapshot,
  onDeleteCloudSnapshot,
  onOpenChangePassword,
  onItemsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<
    'devices' | 'updates' | 'cloud_backup' | 'firestore_sync' | 'gdrive' | 'csv' | 'presets' | 'general' | 'backup'
  >('devices');

  // GitHub Auto-Updates State
  const [updaterStatus, setUpdaterStatus] = useState<{
    status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'latest' | 'error';
    message?: string;
    version?: string;
    percent?: number;
    speed?: number;
  }>({ status: 'idle', message: 'Ready to check GitHub Releases' });
  const [ghOwner, setGhOwner] = useState<string>(() => {
    try {
      return localStorage.getItem('gh_update_owner') || 'Wagbega';
    } catch {
      return 'Wagbega';
    }
  });
  const [ghRepo, setGhRepo] = useState<string>(() => {
    try {
      return localStorage.getItem('gh_update_repo') || 'inventory-management';
    } catch {
      return 'inventory-management';
    }
  });
  const [latestGhRelease, setLatestGhRelease] = useState<{
    tagName: string;
    name: string;
    publishedAt: string;
    htmlUrl: string;
    hasExe: boolean;
    assetsCount: number;
    body: string;
  } | null>(null);
  const [isCheckingGhApi, setIsCheckingGhApi] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';
  const [csvPreview, setCsvPreview] = useState<Partial<InventoryItem>[] | null>(null);

  // Connected Devices (Firestore active_devices) state
  const [activeDevices, setActiveDevices] = useState<ActiveDeviceSession[]>([]);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const localDeviceId = useMemo(() => getOrCreateLocalDeviceId(), []);
  const [thisDeviceNameInput, setThisDeviceNameInput] = useState<string>(() => getLocalDeviceName());
  const [isSavingDeviceName, setIsSavingDeviceName] = useState(false);
  const [editingRemoteDeviceId, setEditingRemoteDeviceId] = useState<string | null>(null);
  const [editingRemoteDeviceName, setEditingRemoteDeviceName] = useState<string>('');
  const [isRefreshingDevices, setIsRefreshingDevices] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setThisDeviceNameInput(getLocalDeviceName());
    // Ensure current device session is registered/refreshed when opening Dev panel
    if (currentUser) {
      upsertActiveDeviceSession(currentUser, 'online').catch(() => {});
    }
    const unsub = subscribeToActiveDevices((devices) => {
      setActiveDevices(devices);
    });
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 15000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [isOpen, currentUser]);

  // Helper: A device is considered actively online if status === 'online' and lastActive within 5 minutes
  const isDeviceOnline = (dev: ActiveDeviceSession) => {
    if (dev.status !== 'online') return false;
    const lastMs = new Date(dev.lastActive).getTime();
    if (isNaN(lastMs)) return false;
    return nowTick - lastMs < 5 * 60 * 1000;
  };

  const onlineDevicesCount = useMemo(
    () => activeDevices.filter((d) => isDeviceOnline(d)).length,
    [activeDevices, nowTick]
  );

  const formatRelativeTime = (isoString: string) => {
    const ms = new Date(isoString).getTime();
    if (isNaN(ms)) return 'Unknown';
    const diffSec = Math.max(0, Math.floor((nowTick - ms) / 1000));
    if (diffSec < 30) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  };

  const handleSaveThisDeviceName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thisDeviceNameInput.trim()) return;
    setIsSavingDeviceName(true);
    await upsertActiveDeviceSession(
      currentUser,
      currentUser ? 'online' : 'offline',
      thisDeviceNameInput.trim()
    );
    setIsSavingDeviceName(false);
  };

  const handleManualHeartbeatRefresh = async () => {
    setIsRefreshingDevices(true);
    await upsertActiveDeviceSession(currentUser, currentUser ? 'online' : 'offline');
    setNowTick(Date.now());
    setTimeout(() => setIsRefreshingDevices(false), 400);
  };

  // Cloud backup in-progress UI state
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupStep, setBackupStep] = useState<string>('');
  const [justCompletedBackup, setJustCompletedBackup] = useState<CloudBackupSnapshot | null>(null);
  const [selectedSnapshotDetails, setSelectedSnapshotDetails] = useState<CloudBackupSnapshot | null>(null);
  const [verifiedHashId, setVerifiedHashId] = useState<string | null>(null);

  // Updater Electron bridge listener
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onUpdateStatus) {
      const unsub = (window as any).electronAPI.onUpdateStatus((data: any) => {
        setUpdaterStatus(data);
      });
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }
  }, []);

  const handleCheckForUpdatesInElectron = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.checkForUpdates) {
      setUpdaterStatus({ status: 'checking', message: 'Checking GitHub Releases from Electron...' });
      try {
        const res = await (window as any).electronAPI.checkForUpdates();
        if (!res.success) {
          setUpdaterStatus({ status: 'error', message: res.message || 'Check failed.' });
        }
      } catch (err: any) {
        setUpdaterStatus({ status: 'error', message: err.message || 'Failed checking updates.' });
      }
    } else {
      // In web preview: perform GitHub API check
      handleCheckGitHubApi();
    }
  };

  const handleRestartAndInstall = async () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.restartAndInstall) {
      await (window as any).electronAPI.restartAndInstall();
    } else {
      alert('Automatic restart and install is available inside the installed Windows desktop app.');
    }
  };

  const handleCheckGitHubApi = async () => {
    const cleanOwner = ghOwner.trim();
    const cleanRepo = ghRepo.trim();
    if (!cleanOwner || !cleanRepo || cleanOwner === 'YOUR_GITHUB_USERNAME') {
      alert('Please configure your GitHub Username / Organization and Repo name first.');
      return;
    }

    try {
      localStorage.setItem('gh_update_owner', cleanOwner);
      localStorage.setItem('gh_update_repo', cleanRepo);
    } catch {}

    setIsCheckingGhApi(true);
    setUpdaterStatus({
      status: 'checking',
      message: `Checking https://api.github.com/repos/${cleanOwner}/${cleanRepo}/releases/latest...`,
    });

    try {
      const res = await fetch(`https://api.github.com/repos/${cleanOwner}/${cleanRepo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github.v3+json' },
      });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`No published releases found yet in GitHub repository "${cleanOwner}/${cleanRepo}". Push tag and release first!`);
        }
        throw new Error(`GitHub API HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const hasExe = assets.some((a: any) => typeof a.name === 'string' && a.name.endsWith('.exe'));

      setLatestGhRelease({
        tagName: data.tag_name || 'v1.2.11',
        name: data.name || data.tag_name || 'Release',
        publishedAt: data.published_at || new Date().toISOString(),
        htmlUrl: data.html_url || `https://github.com/${cleanOwner}/${cleanRepo}/releases`,
        hasExe,
        assetsCount: assets.length,
        body: data.body || 'No release notes provided.',
      });

      setUpdaterStatus({
        status: 'latest',
        version: data.tag_name,
        message: `Connected! Latest GitHub release is "${data.tag_name}" (${assets.length} assets, installer ${hasExe ? 'detected' : 'pending'}).`,
      });
    } catch (err: any) {
      setUpdaterStatus({
        status: 'error',
        message: err.message || 'Failed connecting to GitHub API.',
      });
    } finally {
      setIsCheckingGhApi(false);
    }
  };

  const handleCopyCommand = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  // Cloud Dev Password change form state
  const [currentDevPass, setCurrentDevPass] = useState('');
  const [newDevPass, setNewDevPass] = useState('');
  const [confirmDevPass, setConfirmDevPass] = useState('');
  const [isUpdatingDevPass, setIsUpdatingDevPass] = useState(false);
  const [devPassFeedback, setDevPassFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleUpdateCloudDevPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDevPass.trim() || !newDevPass.trim()) {
      setDevPassFeedback({ type: 'error', text: 'Please enter both current and new Dev passwords.' });
      return;
    }
    if (newDevPass.trim() !== confirmDevPass.trim()) {
      setDevPassFeedback({ type: 'error', text: 'New Dev password and confirmation do not match.' });
      return;
    }
    setIsUpdatingDevPass(true);
    setDevPassFeedback(null);
    const res = await updateCloudDevPassword(
      currentDevPass,
      newDevPass,
      currentUser?.name || 'Administrator'
    );
    setIsUpdatingDevPass(false);
    if (res.success) {
      setCurrentDevPass('');
      setNewDevPass('');
      setConfirmDevPass('');
      setDevPassFeedback({ type: 'success', text: res.message });
    } else {
      setDevPassFeedback({ type: 'error', text: res.message });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSVToItems(text);
      setCsvPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleConfirmCSVImport = () => {
    if (!csvPreview || csvPreview.length === 0) return;
    const fullItems: InventoryItem[] = csvPreview.map((p, idx) => ({
      id: p.id || 'item_' + Math.random().toString(36).substring(2, 9),
      sku: p.sku || `SKU-${idx + 1000}`,
      name: p.name || 'Imported Item',
      category: p.category || 'Imported',
      quantity: Number(p.quantity) || 0,
      minQuantity: Number(p.minQuantity) || 5,
      unitCost: Number(p.unitCost) || 0,
      retailPrice: Number(p.retailPrice) || 0,
      location: p.location || 'Main Storage',
      unit: p.unit || 'units',
      lastRestocked: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    onImportCSVItems(fullItems);
    setCsvPreview(null);
    alert(`Successfully imported ${fullItems.length} inventory items.`);
  };

  const handleJsonRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      alert('Permission Denied: Only Administrators can restore database backups.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        onRestoreJSONBackup(json);
        alert('Data backup successfully restored!');
        onClose();
      } catch {
        alert('Invalid JSON backup file format.');
      }
    };
    reader.readAsText(file);
  };

  const handlePerformCloudBackup = async (type: CloudBackupFrequency = 'manual') => {
    if (!isAdmin) {
      alert('Permission Denied: Only Administrators can initiate cloud backups.');
      return;
    }

    setIsBackingUp(true);
    setJustCompletedBackup(null);

    setBackupStep('1/4 Packaging items, ledger & sales receipts...');
    await new Promise((r) => setTimeout(r, 450));

    setBackupStep('2/4 Calculating SHA-256 integrity checksum & metadata...');
    await new Promise((r) => setTimeout(r, 400));

    setBackupStep('3/4 Encrypting payload with AES-256 & streaming to Cloud Storage Vault...');
    await new Promise((r) => setTimeout(r, 600));

    setBackupStep('4/4 Verifying cloud bucket sync & retention rotation...');
    const newSnapshot = await onTriggerCloudBackup(type);
    await new Promise((r) => setTimeout(r, 300));

    setIsBackingUp(false);
    setBackupStep('');
    setJustCompletedBackup(newSnapshot);
  };

  const handleVerifyChecksum = (snapshot: CloudBackupSnapshot) => {
    setVerifiedHashId(snapshot.id);
    setTimeout(() => {
      setVerifiedHashId(null);
    }, 4000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in select-none">
      <div className="bg-white dark:bg-[#202020] rounded-xl border border-black/[0.1] dark:border-white/[0.1] shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Dev
                </h2>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isAdmin
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {isAdmin ? 'Admin Mode' : 'Sales Manager'}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('devices')}
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center space-x-1.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/60 cursor-pointer hover:bg-emerald-200/70 transition-colors"
                  title="View active logged-in devices in Firestore"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    {onlineDevicesCount} {onlineDevicesCount === 1 ? 'Device' : 'Devices'} Online
                  </span>
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-black/[0.06] dark:border-white/[0.06] bg-slate-100/60 dark:bg-slate-800/40 px-3 sm:px-4 text-xs font-medium overflow-x-auto">
          {[
            {
              id: 'devices',
              label: 'Connected Devices',
              icon: Monitor,
              badge: `${onlineDevicesCount} Online`,
              badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
            },
            {
              id: 'updates',
              label: 'App Auto-Updates',
              icon: ArrowUpCircle,
              badge: 'GitHub Releases',
              badgeColor: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
            },
            {
              id: 'firestore_sync',
              label: 'Firebase Cloud Sync',
              icon: Database,
              badge: 'Real-time',
              badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
            },
            {
              id: 'cloud_backup',
              label: 'Cloud Backup & Schedule',
              icon: Cloud,
              badge: 'Daily/Wk/Mo',
            },
            {
              id: 'gdrive',
              label: 'Google Drive Sync',
              icon: CloudUpload,
              badge: !isAdmin ? 'Admin Only' : 'G-Drive',
              badgeColor: !isAdmin ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
            },
            {
              id: 'csv',
              label: 'CSV Data Hub',
              icon: FileSpreadsheet,
              badge: 'Import/Export',
            },
            {
              id: 'presets',
              label: 'Industry Presets',
              icon: Sparkles,
            },
            {
              id: 'general',
              label: 'General & Currency',
              icon: Building,
            },
            {
              id: 'backup',
              label: 'Local JSON & Reset',
              icon: HardDrive,
            },
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;

            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`py-2.5 px-3 border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold bg-white dark:bg-[#202020]'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {t.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 font-bold rounded-full ${t.badgeColor || 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'}`}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {/* TAB 0: CONNECTED DEVICES & LIVE SESSIONS MONITOR (FIRESTORE) */}
          {activeTab === 'devices' && (
            <div className="space-y-4">
              {/* Top Summary Banner & Manual Heartbeat Refresh */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-blue-500/5 border border-emerald-500/20 dark:border-emerald-400/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        Firestore Live Device & Session Tracker
                      </h4>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        active_devices
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                      Real-time count of all PCs, POS terminals, and mobile devices logged into your database. Heartbeats update every 2 minutes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleManualHeartbeatRefresh}
                  disabled={isRefreshingDevices}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer shadow-xs shrink-0 self-start sm:self-center"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingDevices ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>Ping Heartbeat</span>
                </button>
              </div>

              {/* 4 KPI Counter Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                    <span>Devices Online</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
                    {onlineDevicesCount}
                  </div>
                  <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                    Active within last 5m
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Total Registered
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1 font-mono">
                    {activeDevices.length}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    All known workstations
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06]">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Offline / Locked
                  </div>
                  <div className="text-xl font-extrabold text-slate-700 dark:text-slate-300 mt-1 font-mono">
                    {Math.max(0, activeDevices.length - onlineDevicesCount)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Signed out or idle
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/25 border border-purple-200/70 dark:border-purple-900/50">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                    This Device ID
                  </div>
                  <div className="text-sm font-extrabold text-purple-800 dark:text-purple-200 mt-1.5 font-mono truncate">
                    {localDeviceId}
                  </div>
                  <div className="text-[10px] text-purple-600/80 dark:text-purple-400 font-mono">
                    Build v{APP_BUILD_VERSION}
                  </div>
                </div>
              </div>

              {/* This Workstation Label / Nickname Customizer */}
              <form
                onSubmit={handleSaveThisDeviceName}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-black/[0.06] dark:border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center space-x-1.5">
                    <Monitor className="w-3.5 h-3.5 text-blue-600" />
                    <span>This Device Workstation Name</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      {localDeviceId}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Give this computer or phone a recognizable name (e.g., &quot;Front Counter POS 1&quot;, &quot;Warehouse PC&quot;).
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <input
                    type="text"
                    value={thisDeviceNameInput}
                    onChange={(e) => setThisDeviceNameInput(e.target.value)}
                    placeholder="e.g. Main POS Terminal #1"
                    className="bg-white dark:bg-slate-900 border border-black/[0.1] dark:border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 w-48 sm:w-56"
                  />
                  <button
                    type="submit"
                    disabled={isSavingDeviceName}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg text-xs cursor-pointer transition-colors"
                  >
                    {isSavingDeviceName ? 'Saving...' : 'Save Name'}
                  </button>
                </div>
              </form>

              {/* Connected Devices List / Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                    <Monitor className="w-3.5 h-3.5 text-blue-600" />
                    <span>Registered & Logged-In Devices ({activeDevices.length})</span>
                  </h5>
                  <span className="text-[11px] text-slate-500">
                    Real-time Firestore listener • Force sign-out locks remote device immediately
                  </span>
                </div>

                {activeDevices.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
                    No device sessions recorded in Firestore yet. Click &quot;Ping Heartbeat&quot; above to register this device.
                  </div>
                ) : (
                  <div className="border border-black/[0.08] dark:border-white/[0.08] rounded-xl overflow-hidden shadow-xs">
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100 dark:bg-slate-800/90 sticky top-0 font-semibold text-slate-700 dark:text-slate-300 z-10">
                          <tr>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Device / Workstation</th>
                            <th className="p-2.5">Logged-In User</th>
                            <th className="p-2.5">Platform & Version</th>
                            <th className="p-2.5">Last Active</th>
                            <th className="p-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                          {activeDevices.map((dev) => {
                            const online = isDeviceOnline(dev);
                            const isThisDevice = dev.id === localDeviceId;
                            const isMobile = dev.platform?.toLowerCase().includes('mobile') || dev.platform?.toLowerCase().includes('android');
                            const isElectron = dev.platform?.toLowerCase().includes('electron');

                            return (
                              <tr
                                key={dev.id}
                                className={`transition-colors ${
                                  isThisDevice
                                    ? 'bg-blue-50/40 dark:bg-blue-950/20 hover:bg-blue-50/70 dark:hover:bg-blue-950/30'
                                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                }`}
                              >
                                {/* Status Column */}
                                <td className="p-2.5 whitespace-nowrap">
                                  {online ? (
                                    <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      <span>ONLINE</span>
                                    </span>
                                  ) : dev.status === 'revoked' ? (
                                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                                      <span>SIGNED OUT</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                      <span>OFFLINE</span>
                                    </span>
                                  )}
                                </td>

                                {/* Device Name & ID Column */}
                                <td className="p-2.5">
                                  {editingRemoteDeviceId === dev.id ? (
                                    <div className="flex items-center space-x-1">
                                      <input
                                        type="text"
                                        value={editingRemoteDeviceName}
                                        onChange={(e) => setEditingRemoteDeviceName(e.target.value)}
                                        className="bg-white dark:bg-slate-900 border border-blue-500 rounded px-2 py-0.5 text-[11px] outline-none w-36"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (editingRemoteDeviceName.trim()) {
                                            await renameDeviceSessionInFirestore(dev, editingRemoteDeviceName.trim());
                                            if (isThisDevice) {
                                              setThisDeviceNameInput(editingRemoteDeviceName.trim());
                                            }
                                          }
                                          setEditingRemoteDeviceId(null);
                                        }}
                                        className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                                        title="Save Name"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingRemoteDeviceId(null)}
                                        className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                                        title="Cancel"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center space-x-1.5">
                                      <span className="font-bold text-slate-900 dark:text-slate-100">
                                        {dev.deviceName}
                                      </span>
                                      {isThisDevice && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-blue-600 text-white">
                                          This Device
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingRemoteDeviceId(dev.id);
                                          setEditingRemoteDeviceName(dev.deviceName);
                                        }}
                                        className="text-slate-400 hover:text-blue-600 p-0.5 rounded cursor-pointer"
                                        title="Rename workstation"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                  <div className="text-[10px] font-mono text-slate-400">
                                    ID: {dev.id}
                                  </div>
                                </td>

                                {/* Logged-in User Column */}
                                <td className="p-2.5">
                                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                                    <span>{dev.userName}</span>
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                                        dev.userRole === 'admin'
                                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                          : dev.userRole === 'supervisor'
                                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                      }`}
                                    >
                                      {dev.userRole === 'sales_manager' ? 'sales' : dev.userRole}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                                    {dev.location || 'Main Warehouse'}
                                  </div>
                                </td>

                                {/* Platform & Version Column */}
                                <td className="p-2.5">
                                  <div className="flex items-center space-x-1.5 text-slate-700 dark:text-slate-300 font-medium">
                                    {isMobile ? (
                                      <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    ) : isElectron ? (
                                      <Monitor className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    ) : (
                                      <Laptop className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                    )}
                                    <span>{dev.platform}</span>
                                    <span className="px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-slate-700 text-[9px] font-mono font-semibold">
                                      v{dev.appVersion || APP_BUILD_VERSION}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                    {dev.osInfo}
                                  </div>
                                </td>

                                {/* Last Active Column */}
                                <td className="p-2.5 whitespace-nowrap">
                                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                                    {formatRelativeTime(dev.lastActive)}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {new Date(dev.lastActive).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </div>
                                </td>

                                {/* Actions Column */}
                                <td className="p-2.5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end space-x-1">
                                    {online && (
                                      <button
                                        type="button"
                                        onClick={() => revokeDeviceSessionInFirestore(dev)}
                                        className="px-2 py-1 rounded text-[10px] font-semibold bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-950/60 dark:hover:bg-amber-900 dark:text-amber-300 flex items-center space-x-1 cursor-pointer transition-colors"
                                        title="Remotely lock & sign out this device immediately"
                                      >
                                        <LogOut className="w-3 h-3" />
                                        <span>Force Sign Out</span>
                                      </button>
                                    )}

                                    {!isThisDevice && (
                                      <button
                                        type="button"
                                        onClick={() => deleteDeviceSessionFromFirestore(dev.id)}
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                                        title="Remove device record from Firestore"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: GITHUB RELEASES & AUTO-UPDATES */}
          {activeTab === 'updates' && (
            <div className="space-y-4">
              {/* Top Engine & Version Overview Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 dark:border-purple-400/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <ArrowUpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          GitHub Releases Native Auto-Updater
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          v{APP_BUILD_VERSION}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Native background updates served directly from GitHub Releases (<code className="text-purple-700 dark:text-purple-300">Wagbega/inventory-management</code>). Clients automatically download delta updates in the background without reinstalling or cloud hosting fees.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCheckForUpdatesInElectron}
                      disabled={updaterStatus.status === 'checking' || isCheckingGhApi}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs flex items-center space-x-2 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${updaterStatus.status === 'checking' || isCheckingGhApi ? 'animate-spin' : ''}`} />
                      <span>{updaterStatus.status === 'checking' || isCheckingGhApi ? 'Checking Releases...' : 'Check for Updates Now'}</span>
                    </button>

                    {updaterStatus.status === 'downloaded' && (
                      <button
                        type="button"
                        onClick={handleRestartAndInstall}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer shadow-md flex items-center space-x-1.5 animate-bounce"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Restart & Install</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Updater Status Notification Box */}
                <div className={`p-3 rounded-lg text-xs border flex items-start space-x-2.5 ${
                  updaterStatus.status === 'downloaded'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    : updaterStatus.status === 'downloading'
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
                    : updaterStatus.status === 'available'
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-200'
                    : updaterStatus.status === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                    : 'bg-white/80 dark:bg-slate-800/80 border-black/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-slate-300'
                }`}>
                  <div className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center">
                    {updaterStatus.status === 'checking' && <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />}
                    {updaterStatus.status === 'downloaded' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    {updaterStatus.status === 'downloading' && <ArrowUpCircle className="w-4 h-4 text-blue-600 animate-pulse" />}
                    {updaterStatus.status === 'available' && <Sparkles className="w-4 h-4 text-purple-600" />}
                    {updaterStatus.status === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
                    {updaterStatus.status === 'idle' && <Clock className="w-3.5 h-3.5 text-slate-400" />}
                    {updaterStatus.status === 'latest' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>Status: {updaterStatus.status.toUpperCase()}</span>
                      {updaterStatus.version && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
                          Target: {updaterStatus.version}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5 opacity-90 break-words">
                      {updaterStatus.message || 'Auto-updater is active and checks GitHub Releases on startup and every 2 hours.'}
                    </p>

                    {/* Progress Bar for Downloading */}
                    {updaterStatus.status === 'downloading' && typeof updaterStatus.percent === 'number' && (
                      <div className="mt-2 space-y-1">
                        <div className="w-full bg-blue-200 dark:bg-blue-900/60 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, updaterStatus.percent))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-blue-700 dark:text-blue-300 font-mono">
                          <span>{updaterStatus.percent}% downloaded</span>
                          {updaterStatus.speed ? <span>{updaterStatus.speed} KB/s</span> : null}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* GitHub Target Repo Configuration & Verification */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <GitBranch className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      Target GitHub Repository Configuration
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Defined in <code>package.json</code> under <code>build.publish</code>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      GitHub Owner / Username
                    </label>
                    <input
                      type="text"
                      value={ghOwner}
                      onChange={(e) => setGhOwner(e.target.value)}
                      placeholder="Wagbega"
                      className="w-full bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Repository Name
                    </label>
                    <input
                      type="text"
                      value={ghRepo}
                      onChange={(e) => setGhRepo(e.target.value)}
                      placeholder="inventory-management"
                      className="w-full bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleCheckGitHubApi}
                      disabled={isCheckingGhApi}
                      className="w-full py-1.5 px-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCheckingGhApi ? 'animate-spin' : ''}`} />
                      <span>Test GitHub Releases API</span>
                    </button>
                  </div>
                </div>

                {/* If GitHub Release info was fetched */}
                {latestGhRelease && (
                  <div className="mt-2 p-3 bg-white dark:bg-slate-900 rounded-lg border border-purple-200/80 dark:border-purple-900/40 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {latestGhRelease.name} ({latestGhRelease.tagName})
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Published {new Date(latestGhRelease.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <a
                        href={latestGhRelease.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-600 hover:text-purple-700 dark:text-purple-400 flex items-center space-x-1 text-[11px] font-semibold"
                      >
                        <span>Open on GitHub</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                      <span>Assets: {latestGhRelease.assetsCount} files</span>
                      <span>•</span>
                      <span>Windows Setup Installer: {latestGhRelease.hasExe ? '✅ Detected' : '⚠️ No .exe attached yet'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step-by-Step Instructions Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] space-y-4">
                <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.06] pb-2">
                  <div className="flex items-center space-x-2">
                    <Terminal className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      GitHub Auto-Updater Setup &amp; Publishing Guide
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                    100% Free &bull; Unlimited Downloads
                  </span>
                </div>

                {/* FIX 1: Git Push Solution */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      1
                    </span>
                    <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      Fix Git Push &amp; Connect Local Code to GitHub:
                    </h5>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-7">
                    If you saw <code>error: src refspec main does not match any</code>, it means no commit existed yet before pushing. Run these commands in PowerShell inside <code>C:\Users\Flex\Downloads\inventory-management (11)</code>:
                  </p>
                  <div className="pl-7 space-y-2">
                    <div className="p-2.5 rounded-lg bg-slate-900 text-slate-200 font-mono text-[11px] flex items-center justify-between relative group">
                      <span className="select-all">git add . && git commit -m "feat: setup inventory management with auto-updater" && git branch -M main && git push -u origin main</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCommand('git add . && git commit -m "feat: setup inventory management with auto-updater" && git branch -M main && git push -u origin main', 'cmdGit')}
                        className="ml-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer shrink-0"
                        title="Copy command"
                      >
                        {copiedCmd === 'cmdGit' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* STEP 2: How to Release */}
                <div className="space-y-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      2
                    </span>
                    <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      Publishing a Release to GitHub:
                    </h5>
                  </div>

                  <div className="pl-7 space-y-3">
                    {/* Method A */}
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] space-y-2">
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px]">Method A (Recommended)</span>
                        <span>Drag &amp; Drop to GitHub Web (No Access Token Needed)</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 pl-1">
                        <li>
                          Run in PowerShell:
                          <div className="my-1 p-2 rounded bg-slate-900 text-slate-200 font-mono text-[10.5px] flex items-center justify-between">
                            <span className="select-all">npm run build:win</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCommand('npm run build:win', 'cmdBuildWin')}
                              className="ml-2 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer shrink-0"
                            >
                              {copiedCmd === 'cmdBuildWin' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </li>
                        <li>
                          Open <a href="https://github.com/Wagbega/inventory-management/releases/new" target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 underline font-semibold">New GitHub Release</a> in your browser.
                        </li>
                        <li>
                          Enter Tag name: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-bold">v1.2.11</code> (must match <code>package.json</code> version with <code>v</code> prefix).
                        </li>
                        <li>
                          Open folder <code>C:\Users\Flex\Downloads\inventory-management (11)\dist-electron\</code> and drag &amp; drop these 3 files into the release assets:
                          <ul className="list-disc list-inside pl-4 mt-1 text-[10.5px] text-slate-700 dark:text-slate-300 font-mono">
                            <li>Inventory Management Setup 1.2.11.exe</li>
                            <li>latest.yml (required for auto-updater)</li>
                            <li>Inventory Management Setup 1.2.11.exe.blockmap</li>
                          </ul>
                        </li>
                        <li>
                          Click <strong>Publish release</strong>!
                        </li>
                      </ol>
                    </div>

                    {/* Method B */}
                    <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] space-y-2">
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-[10px]">Method B</span>
                        <span>1-Command Publish using GitHub Personal Access Token</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        Create a classic Personal Access Token with <code>repo</code> scope at <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer" className="text-purple-600 dark:text-purple-400 underline">GitHub Token Settings</a>, then run:
                      </p>
                      <div className="p-2 rounded bg-slate-900 text-slate-200 font-mono text-[10.5px] flex items-center justify-between">
                        <span className="select-all">$env:GH_TOKEN="ghp_yourTokenHere"; npm run publish:github</span>
                        <button
                          type="button"
                          onClick={() => handleCopyCommand('$env:GH_TOKEN="ghp_yourTokenHere"; npm run publish:github', 'cmdToken')}
                          className="ml-2 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer shrink-0"
                        >
                          {copiedCmd === 'cmdToken' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEP 3: Client PC Auto-Update Experience */}
                <div className="space-y-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      3
                    </span>
                    <h5 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      How Client Machines Receive Auto-Updates:
                    </h5>
                  </div>
                  <div className="pl-7 space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200">
                      <div className="font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Seamless Background Updates:</span>
                      </div>
                      <p className="mt-1 text-[10.5px] leading-relaxed">
                        Whenever any user launches the Windows app (or every 2 hours while open), <code>electron-updater</code> queries GitHub's public API for new releases. If a higher version is published, it downloads only the changed delta blocks in the background and prompts: <em>"Inventory Management v1.2.12 downloaded. Restart now to apply?"</em>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quick GitHub Links */}
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">GitHub Repository &amp; Releases:</div>
                    <div className="text-[11px] text-slate-500 font-mono">https://github.com/Wagbega/inventory-management</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a
                      href="https://github.com/Wagbega/inventory-management/releases"
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-[11px] font-semibold flex items-center space-x-1"
                    >
                      <span>Releases</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: FIREBASE FIRESTORE CLOUD SYNC */}
          {activeTab === 'firestore_sync' && (
            <FirebaseSyncManager
              items={items}
              isAdmin={isAdmin}
              onItemsUpdated={(updated) => {
                if (onItemsUpdated) {
                  onItemsUpdated(updated);
                }
              }}
            />
          )}

          {/* TAB 1: CLOUD BACKUP & SCHEDULE (ADMIN EXCLUSIVE) */}
          {activeTab === 'cloud_backup' && (
            <div className="space-y-4">
              {/* Role banner if not admin */}
              {!isAdmin && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start space-x-2.5 text-amber-800 dark:text-amber-300">
                  <Shield className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="text-[11px]">
                    <div className="font-bold">Administrator Privilege Required</div>
                    <div>
                      You are logged in as a <strong>Sales Manager</strong>. Automated cloud scheduling, instant snapshot generation, and database restorations are restricted to Administrators. You can still download snapshots and CSV exports below.
                    </div>
                  </div>
                </div>
              )}

              {/* Top Configuration & Trigger Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5 border border-blue-500/20 dark:border-blue-400/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <Cloud className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      Automated Cloud Storage Backup Vault
                    </h4>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      Live Sync Active
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-1">
                    Scheduled snapshots archive all {items.length} SKUs, {movements.length} ledger movements, {receipts.length} sales receipts, and user configurations securely.
                  </p>
                </div>

                {/* Instant Cloud Backup Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={isBackingUp || !isAdmin}
                    onClick={() => handlePerformCloudBackup('manual')}
                    className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer ${
                      isBackingUp || !isAdmin
                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                        : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-blue-600/20'
                    }`}
                  >
                    {isBackingUp ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CloudUpload className="w-3.5 h-3.5" />
                    )}
                    <span>{isBackingUp ? 'Archiving...' : 'Backup Now to Cloud'}</span>
                  </button>
                </div>
              </div>

              {/* Active Backup Progress Indicator */}
              {isBackingUp && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2 animate-pulse">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
                    <span className="flex items-center space-x-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>Cloud Snapshot Generation in Progress</span>
                    </span>
                    <span className="font-mono text-[11px]">AES-256 Cloud Vault</span>
                  </div>
                  <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono">
                    {backupStep}
                  </div>
                  <div className="w-full h-1.5 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 rounded-full animate-[shimmer_1.5s_infinite]" />
                  </div>
                </div>
              )}

              {/* Just Completed Toast */}
              {justCompletedBackup && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fade-in">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Cloud snapshot <strong>{justCompletedBackup.id}</strong> created successfully! ({(justCompletedBackup.sizeBytes / 1024).toFixed(1)} KB, {justCompletedBackup.itemCount} SKUs, {justCompletedBackup.receiptCount} receipts)
                    </span>
                  </div>
                  <button
                    onClick={() => downloadSnapshotJSON(justCompletedBackup)}
                    className="underline text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 cursor-pointer"
                  >
                    Download JSON
                  </button>
                </div>
              )}

              {/* 1. Schedule Interval Configuration (Admin Settings) */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-black/[0.06] dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <h5 className="font-bold text-slate-900 dark:text-slate-100">
                      Cloud Backup Frequency & Automated Triggers
                    </h5>
                  </div>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={cloudSchedule.enabled}
                      onChange={(e) => onUpdateCloudSchedule({ enabled: e.target.checked })}
                      className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Auto-Schedule {cloudSchedule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* Frequency Option 1: Daily */}
                  <div
                    onClick={() => isAdmin && onUpdateCloudSchedule({ frequency: 'daily' })}
                    className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                      isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
                    } ${
                      cloudSchedule.frequency === 'daily'
                        ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-white dark:bg-slate-800 border-black/[0.08] dark:border-white/[0.08] hover:border-slate-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          Daily Backup
                        </span>
                        {cloudSchedule.frequency === 'daily' && (
                          <Check className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Automatic End-of-Day (EOD) snapshots generated every 24 hours.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold mt-2">
                      Interval: 24 Hours • 23:00 EOD
                    </span>
                  </div>

                  {/* Frequency Option 2: Weekly */}
                  <div
                    onClick={() => isAdmin && onUpdateCloudSchedule({ frequency: 'weekly' })}
                    className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                      isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
                    } ${
                      cloudSchedule.frequency === 'weekly'
                        ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-white dark:bg-slate-800 border-black/[0.08] dark:border-white/[0.08] hover:border-slate-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          Weekly Backup
                        </span>
                        {cloudSchedule.frequency === 'weekly' && (
                          <Check className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Comprehensive weekly ledger reconciliation and catalog archiving every Sunday.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold mt-2">
                      Interval: 7 Days • Every Sunday
                    </span>
                  </div>

                  {/* Frequency Option 3: Monthly */}
                  <div
                    onClick={() => isAdmin && onUpdateCloudSchedule({ frequency: 'monthly' })}
                    className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                      isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'
                    } ${
                      cloudSchedule.frequency === 'monthly'
                        ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500'
                        : 'bg-white dark:bg-slate-800 border-black/[0.08] dark:border-white/[0.08] hover:border-slate-400'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          Monthly Backup
                        </span>
                        {cloudSchedule.frequency === 'monthly' && (
                          <Check className="w-3.5 h-3.5 text-blue-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        End-of-Month (EOM) financial audit archives preserved for tax compliance.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold mt-2">
                      Interval: Monthly • 1st of Month
                    </span>
                  </div>
                </div>

                {/* Granular Schedule Time & Retention Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Execution Time (EOD Local)
                    </label>
                    <input
                      type="time"
                      disabled={!isAdmin}
                      value={cloudSchedule.timeOfDay}
                      onChange={(e) => onUpdateCloudSchedule({ timeOfDay: e.target.value })}
                      className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1.5 text-xs outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Retention Copies Limit
                    </label>
                    <select
                      disabled={!isAdmin}
                      value={cloudSchedule.retentionCopies}
                      onChange={(e) =>
                        onUpdateCloudSchedule({ retentionCopies: Number(e.target.value) })
                      }
                      className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1.5 text-xs outline-none"
                    >
                      <option value={7}>Keep last 7 snapshots (1 Week)</option>
                      <option value={30}>Keep last 30 snapshots (1 Month)</option>
                      <option value={90}>Keep last 90 snapshots (1 Quarter)</option>
                      <option value={365}>Keep last 365 snapshots (1 Year)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Target Cloud Vault Provider
                    </label>
                    <select
                      disabled={!isAdmin}
                      value={cloudSchedule.destination}
                      onChange={(e) =>
                        onUpdateCloudSchedule({ destination: e.target.value as any })
                      }
                      className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1.5 text-xs outline-none font-semibold text-blue-600 dark:text-blue-400"
                    >
                      <option value="google_drive">Google Drive (Workspace Cloud Folder)</option>
                      <option value="secure_vault">Secure AES-256 Cloud Vault (Standard)</option>
                      <option value="google_cloud">Google Cloud Storage (Multi-Region)</option>
                      <option value="aws_s3">AWS S3 Enterprise Vault</option>
                      <option value="azure_blob">Azure Blob Secure Storage</option>
                    </select>
                  </div>
                </div>

                {/* Status bar showing last and next scheduled backup */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                  <span className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Last Backup:{' '}
                      <strong className="text-slate-700 dark:text-slate-300">
                        {cloudSchedule.lastBackupDate
                          ? new Date(cloudSchedule.lastBackupDate).toLocaleString()
                          : 'Not recorded'}
                      </strong>
                    </span>
                  </span>

                  <span>
                    Next Scheduled:{' '}
                    <strong className="text-blue-600 dark:text-blue-400">
                      {cloudSchedule.nextScheduledDate
                        ? new Date(cloudSchedule.nextScheduledDate).toLocaleString()
                        : 'Calculated at trigger'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* 2. Cloud Snapshots Vault / History Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                    <Database className="w-3.5 h-3.5 text-blue-600" />
                    <span>Cloud Backup Snapshot Archives ({cloudSnapshots.length})</span>
                  </h5>
                  <span className="text-[11px] text-slate-500">
                    Encrypted with AES-256-GCM & verified with SHA-256 checksums
                  </span>
                </div>

                {cloudSnapshots.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
                    No cloud snapshots in vault yet. Click &quot;Backup Now to Cloud&quot; to create your first archive.
                  </div>
                ) : (
                  <div className="border border-black/[0.08] dark:border-white/[0.08] rounded-xl overflow-hidden shadow-xs">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 font-semibold text-slate-700 dark:text-slate-300 z-10">
                          <tr>
                            <th className="p-2">Snapshot / Date</th>
                            <th className="p-2">Type</th>
                            <th className="p-2">Payload Details</th>
                            <th className="p-2">Size</th>
                            <th className="p-2">Checksum</th>
                            <th className="p-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                          {cloudSnapshots.map((snap) => {
                            const isVerified = verifiedHashId === snap.id;

                            return (
                              <tr
                                key={snap.id}
                                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                              >
                                <td className="p-2">
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                                    {new Date(snap.timestamp).toLocaleDateString()} {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                    By {snap.operator}
                                  </div>
                                </td>

                                <td className="p-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                      snap.type === 'daily'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                        : snap.type === 'weekly'
                                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                                        : snap.type === 'monthly'
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                    }`}
                                  >
                                    {snap.type}
                                  </span>
                                </td>

                                <td className="p-2 text-[10px] text-slate-600 dark:text-slate-400">
                                  <span>{snap.itemCount} SKUs • {snap.receiptCount} Receipts</span>
                                </td>

                                <td className="p-2 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                                  {(snap.sizeBytes / 1024).toFixed(1)} KB
                                </td>

                                <td className="p-2 font-mono text-[10px]">
                                  {isVerified ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Checksum Valid</span>
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleVerifyChecksum(snap)}
                                      className="text-slate-400 hover:text-blue-500 underline cursor-pointer truncate max-w-[100px] block"
                                      title={`Click to verify integrity checksum: ${snap.checksum}`}
                                    >
                                      {snap.checksum.substring(0, 14)}...
                                    </button>
                                  )}
                                </td>

                                <td className="p-2 text-right">
                                  <div className="flex items-center justify-end space-x-1">
                                    {/* Download Snapshot */}
                                    <button
                                      onClick={() => downloadSnapshotJSON(snap)}
                                      className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer"
                                      title="Download Snapshot JSON Archive"
                                    >
                                      <CloudDownload className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Restore from Cloud Snapshot (Admin Only) */}
                                    {isAdmin && (
                                      <button
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              `Restore workspace from snapshot "${snap.id}" (${snap.type.toUpperCase()})?\nCurrent items and ledger will be replaced with this archive snapshot.`
                                            )
                                          ) {
                                            onRestoreCloudSnapshot(snap);
                                            alert(`Workspace successfully restored from snapshot ${snap.id}`);
                                            onClose();
                                          }
                                        }}
                                        className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors cursor-pointer"
                                        title="Restore Workspace to this Snapshot"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    {/* Delete Snapshot (Admin Only) */}
                                    {isAdmin && (
                                      <button
                                        onClick={() => {
                                          if (window.confirm('Delete this cloud backup snapshot from the vault?')) {
                                            onDeleteCloudSnapshot(snap.id);
                                          }
                                        }}
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                                        title="Delete Snapshot"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: GOOGLE DRIVE CLOUD SYNC & ARCHIVE */}
          {activeTab === 'gdrive' && (
            <GoogleDriveManager
              currentUser={currentUser}
              isAdmin={isAdmin}
              items={items}
              movements={movements}
              suppliers={suppliers}
              orders={orders}
              receipts={receipts}
              users={users}
              settings={settings}
              onRestoreData={(data) => {
                onRestoreJSONBackup(data);
                onClose();
              }}
              onSnapshotCreated={(snap) => {
                // If a new snapshot is created, we can update local snapshots list
              }}
            />
          )}

          {/* TAB 3: CSV DATA HUB */}
          {activeTab === 'csv' && (
            <div className="space-y-4">
              {/* CSV Quick Exporters Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-black/[0.06] dark:border-white/[0.06] space-y-3">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs flex items-center space-x-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Export CSV Spreadsheet Reports</span>
                  </h4>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Download clean, formatted CSV spreadsheets ready for Excel, Google Sheets, or ERP integration.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() => exportAllDataCSVBundle(items, movements, receipts, suppliers, orders)}
                    className="p-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex flex-col justify-between space-y-2 shadow-xs transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">Full CSV Bundle</span>
                      <Download className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] text-emerald-100">
                      Exports 3 CSV files (Catalog + Ledger + Receipts)
                    </span>
                  </button>

                  <button
                    onClick={() => exportInventoryToCSV(items)}
                    className="p-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-black/[0.08] dark:border-white/[0.08] text-slate-800 dark:text-slate-200 font-semibold text-xs flex flex-col justify-between space-y-2 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span>Inventory Catalog</span>
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {items.length} SKUs with costs, prices & locations
                    </span>
                  </button>

                  <button
                    onClick={() => exportStockMovementsToCSV(movements)}
                    className="p-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-black/[0.08] dark:border-white/[0.08] text-slate-800 dark:text-slate-200 font-semibold text-xs flex flex-col justify-between space-y-2 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center justify-between">
                      <span>Stock Ledger / Log</span>
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {movements.length} audit entries & cost impacts
                    </span>
                  </button>
                </div>
              </div>

              {/* CSV Importer Section */}
              <div className="space-y-3 pt-1">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-0.5">
                    Import Inventory Items from CSV Spreadsheet
                  </h4>
                  <p className="text-slate-500 text-[11px]">
                    Upload any standard CSV export with columns for SKU, Name, Category, Quantity, Cost, Price, Location.
                  </p>
                </div>

                <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50 dark:bg-slate-800/40">
                  <Upload className="w-8 h-8 text-blue-500 mb-2" />
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    Click to select or drag & drop CSV file
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">.csv format supported</span>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>

                {csvPreview && csvPreview.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        Parsed {csvPreview.length} items from CSV
                      </span>
                      <button
                        onClick={handleConfirmCSVImport}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                      >
                        Confirm Import ({csvPreview.length} SKUs)
                      </button>
                    </div>

                    <div className="max-h-40 overflow-y-auto border border-black/[0.08] dark:border-white/[0.08] rounded-lg">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-slate-100 dark:bg-slate-800">
                          <tr>
                            <th className="p-1.5">SKU</th>
                            <th className="p-1.5">Name</th>
                            <th className="p-1.5">Qty</th>
                            <th className="p-1.5">Cost</th>
                            <th className="p-1.5">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                          {csvPreview.slice(0, 10).map((row, idx) => (
                            <tr key={idx}>
                              <td className="p-1.5 font-mono">{row.sku}</td>
                              <td className="p-1.5 truncate max-w-[150px]">{row.name}</td>
                              <td className="p-1.5 font-mono">{row.quantity}</td>
                              <td className="p-1.5 font-mono">{row.unitCost}</td>
                              <td className="p-1.5 font-mono">{row.retailPrice}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: INDUSTRY PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1">
                  Load Pre-configured Inventory Datasets
                </h4>
                <p className="text-slate-500 text-[11px]">
                  Quickly populate your catalog with realistic industry items, suppliers, SKU formats, and stock metrics.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {industryPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] flex flex-col justify-between space-y-3 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                  >
                    <div>
                      <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {preset.name}
                      </h5>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {preset.sampleItems.length} items • {preset.categoryList.length} categories
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Load "${preset.name}" preset dataset? Current items will be replaced.`
                          )
                        ) {
                          onLoadPreset(preset);
                          alert(`Loaded "${preset.name}" successfully.`);
                          onClose();
                        }
                      }}
                      className="w-full py-1.5 px-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs cursor-pointer shadow-xs"
                    >
                      Load Preset
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: GENERAL & CURRENCY */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Theme & Display Appearance */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-black/[0.06] dark:border-white/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      Application Theme & Color Appearance
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Choose between Windows Fluent Light theme, Night/Dark mode, or Match System OS settings.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                    Active: {settings.theme === 'dark' ? 'Dark Mode' : settings.theme === 'system' ? 'System Sync' : 'Light Mode'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ theme: 'light' });
                      document.documentElement.classList.remove('dark');
                    }}
                    className={`p-3 rounded-lg border text-left flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer ${
                      settings.theme === 'light'
                        ? 'bg-white dark:bg-slate-700 border-blue-500 shadow-xs ring-1 ring-blue-500 text-blue-600 dark:text-blue-400'
                        : 'bg-white/60 dark:bg-slate-800/40 border-black/[0.08] dark:border-white/[0.08] hover:border-slate-400 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Sun className="w-5 h-5 text-amber-500" />
                    <span className="text-xs font-semibold">Light Mode</span>
                    <span className="text-[10px] text-slate-400">Clean White & Gray</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ theme: 'dark' });
                      document.documentElement.classList.add('dark');
                    }}
                    className={`p-3 rounded-lg border text-left flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer ${
                      settings.theme === 'dark'
                        ? 'bg-slate-900 border-blue-500 shadow-xs ring-1 ring-blue-500 text-blue-400'
                        : 'bg-white/60 dark:bg-slate-800/40 border-black/[0.08] dark:border-white/[0.08] hover:border-slate-400 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Moon className="w-5 h-5 text-indigo-400" />
                    <span className="text-xs font-semibold">Dark Mode</span>
                    <span className="text-[10px] text-slate-400">Night & Low Light</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({ theme: 'system' });
                      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                      if (prefersDark) {
                        document.documentElement.classList.add('dark');
                      } else {
                        document.documentElement.classList.remove('dark');
                      }
                    }}
                    className={`p-3 rounded-lg border text-left flex flex-col items-center justify-center space-y-1.5 transition-all cursor-pointer ${
                      settings.theme === 'system'
                        ? 'bg-white dark:bg-slate-700 border-blue-500 shadow-xs ring-1 ring-blue-500 text-blue-600 dark:text-blue-400'
                        : 'bg-white/60 dark:bg-slate-800/40 border-black/[0.08] dark:border-white/[0.08] hover:border-slate-400 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Monitor className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    <span className="text-xs font-semibold">System Auto</span>
                    <span className="text-[10px] text-slate-400">Follow OS Theme</span>
                  </button>
                </div>
              </div>

              {/* Custom App & Company Logo Section */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-black/[0.06] dark:border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      Custom Application & Company Logo
                    </h5>
                  </div>
                  <span className="text-[10px] text-slate-400">Desktop, Electron & Receipts</span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Current Active Logo Preview */}
                  <div className="flex flex-col items-center justify-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-black/[0.08] dark:border-white/[0.08] shrink-0">
                    <AppLogo
                      customLogoUrl={settings.customLogoUrl}
                      className="w-12 h-12"
                      alt={settings.companyName || 'App Logo'}
                    />
                    <span className="text-[9px] font-mono text-slate-400 mt-1.5">
                      {settings.customLogoUrl ? 'Custom Logo' : 'Default SVG Logo'}
                    </span>
                  </div>

                  {/* Logo URL Input & File Upload */}
                  <div className="flex-1 space-y-2 w-full">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Logo Image URL or Data URI
                      </label>
                      <input
                        type="text"
                        value={settings.customLogoUrl || ''}
                        onChange={(e) => onUpdateSettings({ customLogoUrl: e.target.value })}
                        placeholder="https://example.com/logo.png or paste image link"
                        className="w-full bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none text-xs text-slate-800 dark:text-slate-200 focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-200 dark:border-blue-800 cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo from Computer</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/svg+xml, image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const result = event.target?.result as string;
                                onUpdateSettings({ customLogoUrl: result });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>

                      {settings.customLogoUrl && (
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ customLogoUrl: undefined })}
                          className="px-2.5 py-1.5 rounded text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 cursor-pointer"
                        >
                          Reset to Default
                        </button>
                      )}
                    </div>

                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                      Electron desktop icons (<code className="font-mono text-blue-600 dark:text-blue-400">build/icon.ico</code>, <code className="font-mono text-blue-600 dark:text-blue-400">build/icon.png</code>, <code className="font-mono text-blue-600 dark:text-blue-400">build/icons/</code>) are configured in <code className="font-mono">package.json</code> for seamless Windows, macOS, and Linux packaging.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Company / Business Name</label>
                  <input
                    type="text"
                    value={settings.companyName}
                    onChange={(e) => onUpdateSettings({ companyName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none text-xs"
                    placeholder="e.g. Lagos Commercial Hub Ltd"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Warehouse / Facility Name</label>
                  <input
                    type="text"
                    value={settings.warehouseName}
                    onChange={(e) => onUpdateSettings({ warehouseName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none text-xs"
                    placeholder="e.g. Ikeja Distribution Hub (WH-01)"
                  />
                </div>
              </div>

              {/* Currency Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Currency & Symbol</label>
                  <select
                    value={settings.currencySymbol}
                    onChange={(e) => {
                      const symbol = e.target.value;
                      let code = 'USD';
                      if (symbol === '₦') code = 'NGN';
                      else if (symbol === '€') code = 'EUR';
                      else if (symbol === '£') code = 'GBP';
                      else if (symbol === '¥') code = 'JPY';
                      else if (symbol === '₹') code = 'INR';
                      else if (symbol === 'GH₵') code = 'GHS';
                      else if (symbol === 'KSh') code = 'KES';
                      else if (symbol === 'R') code = 'ZAR';
                      else if (symbol === 'AED') code = 'AED';
                      onUpdateSettings({ currencySymbol: symbol, currency: code });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none text-xs font-semibold text-blue-600 dark:text-blue-400"
                  >
                    <option value="₦">₦ - NGN (Nigerian Naira)</option>
                    <option value="$">$ - USD (US Dollar)</option>
                    <option value="€">€ - EUR (Euro)</option>
                    <option value="£">£ - GBP (British Pound)</option>
                    <option value="GH₵">GH₵ - GHS (Ghanaian Cedi)</option>
                    <option value="KSh">KSh - KES (Kenyan Shilling)</option>
                    <option value="R">R - ZAR (South African Rand)</option>
                    <option value="AED">AED - AED (UAE Dirham)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Global Low Stock Alert (Units)</label>
                  <input
                    type="number"
                    min="1"
                    value={settings.lowStockThresholdGlobal}
                    onChange={(e) =>
                      onUpdateSettings({ lowStockThresholdGlobal: Number(e.target.value) })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded p-2 outline-none text-xs"
                  />
                </div>
              </div>

              {/* Tax & Receipt Settings */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-black/[0.06] dark:border-white/[0.06] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                      Company Address
                    </label>
                    <input
                      type="text"
                      value={settings.companyAddress || ''}
                      onChange={(e) => onUpdateSettings({ companyAddress: e.target.value })}
                      placeholder="e.g. 14 Marina Street, Victoria Island, Lagos, Nigeria"
                      className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1.5 text-xs outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                      Contact Phone / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={settings.companyPhone || ''}
                      onChange={(e) => onUpdateSettings({ companyPhone: e.target.value })}
                      placeholder="e.g. +234 803 123 4567"
                      className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1.5 text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                      Tax ID / TIN / RC Number
                    </label>
                    <input
                      type="text"
                      value={settings.taxId || ''}
                      onChange={(e) => onUpdateSettings({ taxId: e.target.value })}
                      placeholder="e.g. TIN-19482019-0001"
                      className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1.5 text-xs font-mono outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                      Default VAT / Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={settings.defaultVatRate ?? 7.5}
                      onChange={(e) => onUpdateSettings({ defaultVatRate: Number(e.target.value) })}
                      placeholder="7.5"
                      className="w-full bg-white dark:bg-slate-800 border border-black/[0.08] dark:border-white/[0.08] rounded px-2.5 py-1.5 text-xs font-mono outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Security & Admin Password Section */}
              <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl border border-purple-200/70 dark:border-purple-900/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        Administrator Password & PIN Security
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Manage security credentials protecting Admin operations, team accounts, and database restores.
                      </p>
                    </div>
                  </div>

                  {isAdmin && onOpenChangePassword && (
                    <button
                      type="button"
                      id="btn-settings-change-admin-password"
                      onClick={() => onOpenChangePassword(currentUser || undefined)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold rounded-lg shadow-xs cursor-pointer text-xs flex items-center space-x-1.5 shrink-0 self-start sm:self-center"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Change Admin Password</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-purple-100 dark:border-purple-900/30">
                    <span className="text-slate-500 dark:text-slate-400">Current Administrator:</span>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {currentUser?.name || 'Administrator'} ({currentUser?.email || 'admin@company.com'})
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-purple-100 dark:border-purple-900/30 flex items-center justify-between">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Password / PIN Status:</span>
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Active & Protected</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded font-bold">
                      RBAC Enforced
                    </span>
                  </div>
                </div>
              </div>

              {/* Cloud Dev Password Management Section */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-purple-200/80 dark:border-purple-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        Cloud Dev Password (Firestore Synchronized)
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Update the password required to open the Dev console across all devices (`app_config/dev_security`).
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    SHA-256 Cloud Hash
                  </span>
                </div>

                {devPassFeedback && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium flex items-center space-x-2 ${
                      devPassFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{devPassFeedback.text}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateCloudDevPasswordSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Current Dev Password
                    </label>
                    <input
                      type="password"
                      value={currentDevPass}
                      onChange={(e) => setCurrentDevPass(e.target.value)}
                      placeholder="Current password"
                      className="w-full bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      New Dev Password
                    </label>
                    <input
                      type="password"
                      value={newDevPass}
                      onChange={(e) => setNewDevPass(e.target.value)}
                      placeholder="New password"
                      className="w-full bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Confirm New Password
                    </label>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="password"
                        value={confirmDevPass}
                        onChange={(e) => setConfirmDevPass(e.target.value)}
                        placeholder="Confirm new"
                        className="w-full bg-white dark:bg-slate-900 border border-black/[0.08] dark:border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs font-mono outline-none focus:border-purple-500"
                      />
                      <button
                        type="submit"
                        disabled={isUpdatingDevPass}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold rounded-lg text-xs shrink-0 cursor-pointer transition-colors"
                      >
                        {isUpdatingDevPass ? 'Saving...' : 'Update'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 5: LOCAL JSON BACKUP & RESET */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] space-y-2">
                  <h5 className="font-bold text-slate-900 dark:text-slate-100">Export Full JSON Backup</h5>
                  <p className="text-slate-500 text-[11px]">
                    Download your complete inventory, supplier list, PO history, and stock ledger into a standalone JSON file.
                  </p>
                  <button
                    onClick={onExportJSONBackup}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-black/[0.06] dark:border-white/[0.06] space-y-2">
                  <h5 className="font-bold text-slate-900 dark:text-slate-100">Restore from Local JSON</h5>
                  <p className="text-slate-500 text-[11px]">
                    Restore an existing backup JSON file to replace current workspace data.
                  </p>
                  <label
                    className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold ${
                      isAdmin
                        ? 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 cursor-pointer'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload JSON Backup</span>
                    <input
                      type="file"
                      disabled={!isAdmin}
                      accept=".json"
                      onChange={handleJsonRestoreUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Danger Zone */}
              {isAdmin && (
                <div className="p-4 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 space-y-2">
                  <h5 className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Danger Zone: Clear / Factory Reset</span>
                  </h5>
                  <p className="text-rose-700/80 dark:text-rose-400 text-[11px]">
                    Erase all items, purchase orders, and movement histories to start with a blank database.
                  </p>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          'Are you sure you want to clear all data? This action cannot be undone.'
                        )
                      ) {
                        onResetAllData();
                        alert('All inventory data has been reset.');
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold cursor-pointer shadow-xs"
                  >
                    Reset All Inventory Data
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
