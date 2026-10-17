import React, { useState, useEffect, useCallback } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Download,
  Trash2,
  FileSpreadsheet,
  HardDrive,
  FileJson,
  Check,
  ShieldCheck,
  FolderSync,
  LogOut,
  FolderOpen,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import {
  InventoryItem,
  StockMovement,
  Supplier,
  PurchaseOrder,
  ReceiptData,
  AppUser,
  AppSettings,
  CloudBackupSnapshot,
} from '../types';
import {
  initDriveAuth,
  signInWithGoogleDrive,
  signOutGoogleDrive,
  getDriveUser,
  getDriveAccessToken,
  uploadSnapshotToGoogleDrive,
  uploadFileToDrive,
  listDriveBackupFiles,
  fetchDriveFileContent,
  deleteDriveBackupFile,
  DriveFileInfo,
} from '../services/googleDriveService';
import {
  convertItemsToCSV,
  convertMovementsToCSV,
  convertReceiptsToCSV,
} from '../utils/csv';
import { createCloudSnapshotPayload } from '../utils/cloudBackup';

interface GoogleDriveManagerProps {
  currentUser: AppUser | null;
  isAdmin: boolean;
  items: InventoryItem[];
  movements: StockMovement[];
  suppliers: Supplier[];
  orders: PurchaseOrder[];
  receipts: ReceiptData[];
  users: AppUser[];
  settings: AppSettings;
  onRestoreData: (data: {
    items?: InventoryItem[];
    movements?: StockMovement[];
    suppliers?: Supplier[];
    orders?: PurchaseOrder[];
    receipts?: ReceiptData[];
    users?: AppUser[];
    settings?: AppSettings;
  }) => void;
  onSnapshotCreated?: (snapshot: CloudBackupSnapshot) => void;
}

export const GoogleDriveManager: React.FC<GoogleDriveManagerProps> = ({
  currentUser,
  isAdmin,
  items,
  movements,
  suppliers,
  orders,
  receipts,
  users,
  settings,
  onRestoreData,
  onSnapshotCreated,
}) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [driveFiles, setDriveFiles] = useState<DriveFileInfo[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Destructive deletion modal state (Mandated by Workspace integration skill)
  const [fileToDelete, setFileToDelete] = useState<DriveFileInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Restoration confirmation modal state
  const [fileToRestore, setFileToRestore] = useState<DriveFileInfo | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const loadDriveFiles = useCallback(async () => {
    setIsLoadingFiles(true);
    setErrorMessage(null);
    try {
      const files = await listDriveBackupFiles();
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Failed to load drive files:', err);
      setErrorMessage(err?.message || 'Could not load Google Drive backup files');
    } finally {
      setIsLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initDriveAuth(
      (user, token) => {
        setIsSignedIn(true);
        setGoogleUser(user);
        if (token) {
          loadDriveFiles();
        }
      },
      () => {
        setIsSignedIn(false);
        setGoogleUser(null);
        setDriveFiles([]);
      }
    );

    // Initial check
    const current = getDriveUser();
    getDriveAccessToken().then((token) => {
      if (current && token) {
        setIsSignedIn(true);
        setGoogleUser(current);
        loadDriveFiles();
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadDriveFiles]);

  const handleSignIn = async () => {
    if (!isAdmin) {
      setErrorMessage('Admin Privileges Required: Only Administrator accounts can link or authorize Google Drive.');
      return;
    }
    setIsAuthenticating(true);
    setErrorMessage(null);
    try {
      const res = await signInWithGoogleDrive();
      if (res) {
        setIsSignedIn(true);
        setGoogleUser(res.user);
        setSuccessToast(`Connected Google Drive as ${res.user.email}`);
        await loadDriveFiles();
      }
    } catch (err: any) {
      console.error('Google Drive sign-in error:', err);
      setErrorMessage(err?.message || 'Failed to authenticate with Google Drive');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSignOut = async () => {
    if (!isAdmin) {
      setErrorMessage('Admin Privileges Required: Only Administrator accounts can disconnect Google Drive.');
      return;
    }
    await signOutGoogleDrive();
    setIsSignedIn(false);
    setGoogleUser(null);
    setDriveFiles([]);
    setSuccessToast('Disconnected from Google Drive');
  };

  // 1. Upload snapshot JSON to Google Drive
  const handleUploadSnapshotToDrive = async () => {
    if (!isAdmin) return;
    setIsUploading(true);
    setUploadStatus('Preparing complete database snapshot...');
    setErrorMessage(null);

    try {
      const snapshot = createCloudSnapshotPayload(
        'manual',
        currentUser,
        { items, movements, suppliers, purchaseOrders: orders, receipts, users, settings },
        'Google Drive Cloud Vault Snapshot'
      );

      setUploadStatus('Connecting to Google Drive API...');
      const uploaded = await uploadSnapshotToGoogleDrive(snapshot, 'Synced to Google Drive');

      if (onSnapshotCreated) {
        onSnapshotCreated(snapshot);
      }

      setUploadStatus('Snapshot successfully archived in Google Drive!');
      setSuccessToast(`Saved "${uploaded.name}" to Google Drive`);
      await loadDriveFiles();
    } catch (err: any) {
      console.error('Error uploading snapshot to Google Drive:', err);
      setErrorMessage(err?.message || 'Failed to upload snapshot to Google Drive');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadStatus(''), 4000);
    }
  };

  // 2. Upload CSV Bundle to Google Drive
  const handleUploadCSVsToDrive = async () => {
    if (!isAdmin) return;
    setIsUploading(true);
    setUploadStatus('Generating CSV datasets...');
    setErrorMessage(null);

    try {
      const timestamp = new Date().toISOString().slice(0, 10);

      // Upload items CSV
      setUploadStatus('Uploading Inventory items CSV...');
      const itemsCSV = convertItemsToCSV(items);
      await uploadFileToDrive(
        `inventory_items_${timestamp}.csv`,
        itemsCSV,
        'text/csv',
        `Inventory Items Export (${items.length} records)`
      );

      // Upload movements CSV
      setUploadStatus('Uploading Stock Movements CSV...');
      const movementsCSV = convertMovementsToCSV(movements);
      await uploadFileToDrive(
        `stock_movements_${timestamp}.csv`,
        movementsCSV,
        'text/csv',
        `Stock Movements Log (${movements.length} records)`
      );

      // Upload receipts CSV
      setUploadStatus('Uploading Sales Receipts CSV...');
      const receiptsCSV = convertReceiptsToCSV(receipts);
      await uploadFileToDrive(
        `sales_receipts_${timestamp}.csv`,
        receiptsCSV,
        'text/csv',
        `Sales Receipts Archive (${receipts.length} records)`
      );

      setUploadStatus('All 3 CSV datasets uploaded to Google Drive!');
      setSuccessToast('Exported Inventory, Movements, and Receipts CSVs to Google Drive');
      await loadDriveFiles();
    } catch (err: any) {
      console.error('Error uploading CSVs to Google Drive:', err);
      setErrorMessage(err?.message || 'Failed to upload CSV files to Google Drive');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadStatus(''), 4000);
    }
  };

  // 3. Confirm & Execute File Restore from Drive
  const handleConfirmRestore = async () => {
    if (!fileToRestore || !isAdmin) return;
    setIsRestoring(true);
    setErrorMessage(null);

    try {
      const content = await fetchDriveFileContent(fileToRestore.id);
      if (content && typeof content === 'object') {
        const payload = content.payloadData || content;
        onRestoreData({
          items: payload.items,
          movements: payload.movements,
          suppliers: payload.suppliers,
          orders: payload.purchaseOrders || payload.orders,
          receipts: payload.receipts,
          users: payload.users,
          settings: payload.settings,
        });
        setSuccessToast(`Successfully restored database from "${fileToRestore.name}"!`);
        setFileToRestore(null);
      } else {
        throw new Error('Selected file is not a valid JSON inventory snapshot.');
      }
    } catch (err: any) {
      console.error('Failed to restore from Google Drive:', err);
      setErrorMessage(err?.message || 'Failed to restore snapshot from Google Drive');
    } finally {
      setIsRestoring(false);
    }
  };

  // 4. Confirm & Execute File Deletion (Workspace Skill Mandate)
  const handleConfirmDelete = async () => {
    if (!fileToDelete || !isAdmin) return;
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteDriveBackupFile(fileToDelete.id);
      setSuccessToast(`Deleted "${fileToDelete.name}" from Google Drive`);
      setFileToDelete(null);
      await loadDriveFiles();
    } catch (err: any) {
      console.error('Failed to delete file from Google Drive:', err);
      setErrorMessage(err?.message || 'Failed to delete file from Google Drive');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Administrator Privilege Notice for Non-Admin Users */}
      {!isAdmin && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start space-x-2.5 text-xs text-amber-800 dark:text-amber-200 animate-fade-in">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div className="font-bold flex items-center space-x-1">
              <span>Administrator Access Required</span>
              <Lock className="w-3 h-3 text-amber-600" />
            </div>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Only Administrator accounts have permission to link, authorize, unlink, upload snapshots to, or restore databases from Google Drive.
            </p>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {successToast && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            onClick={() => setSuccessToast(null)}
            className="text-[11px] text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start space-x-2 text-xs text-rose-800 dark:text-rose-200">
          <div className="font-semibold shrink-0">Drive Error:</div>
          <div className="flex-1">{errorMessage}</div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Connection Card / Google Sign-In */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 via-emerald-500/5 to-purple-500/10 border border-blue-500/20 dark:border-blue-400/20 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center shrink-0">
              {/* Google Drive Tri-color Icon */}
              <svg className="w-6 h-6" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  Google Drive Cloud Vault
                </h4>
                {isSignedIn ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Connected</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Not Connected
                  </span>
                )}
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">
                Automatically backup inventory databases, movement records, and CSV files directly into your personal or organization Google Drive with permission.
              </p>
            </div>
          </div>

          {/* Connect / Disconnect Actions */}
          <div className="shrink-0">
            {isSignedIn ? (
              <div className="flex items-center space-x-2">
                <button
                  disabled={!isAdmin}
                  onClick={handleSignOut}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold transition-colors ${
                    isAdmin
                      ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer'
                      : 'opacity-50 text-slate-400 cursor-not-allowed'
                  }`}
                  title={isAdmin ? 'Disconnect Google Drive' : 'Admin privileges required to disconnect Google Drive'}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              /* Standard Google Sign-In Button compliant with GSI standard */
              <button
                disabled={isAuthenticating || !isAdmin}
                onClick={handleSignIn}
                title={isAdmin ? 'Sign in with Google' : 'Administrator privileges required to connect Google Drive'}
                className={`flex items-center space-x-2.5 px-4 py-2 rounded-lg text-xs font-semibold border shadow-sm transition-all ${
                  !isAdmin
                    ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 cursor-pointer hover:shadow'
                }`}
              >
                {isAuthenticating ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                ) : !isAdmin ? (
                  <Lock className="w-4 h-4 text-amber-500" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                )}
                <span>
                  {isAuthenticating
                    ? 'Connecting...'
                    : !isAdmin
                    ? 'Admin Only (Sign in with Google)'
                    : 'Sign in with Google'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Connected Profile Details */}
        {isSignedIn && googleUser && (
          <div className="pt-2 border-t border-blue-500/10 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
            <div className="flex items-center space-x-2">
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Google Account'}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full border border-blue-400"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-[10px]">
                  {(googleUser.email || 'G')[0].toUpperCase()}
                </div>
              )}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {googleUser.displayName || 'Google User'}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">({googleUser.email})</span>
            </div>

            <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400">
              <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
              <span>
                Target Folder: <strong className="font-mono text-blue-600 dark:text-blue-400">Inventory_Cloud_Backups</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Google Drive Action Hub */}
      {isSignedIn ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Action 1: Upload Full Snapshot JSON */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-black/[0.08] dark:border-white/[0.08] flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-bold">
                  <FileJson className="w-4 h-4 text-blue-600" />
                  <span>Sync Complete Database Snapshot</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Uploads full JSON archive containing {items.length} items, {movements.length} movements, {receipts.length} receipts, suppliers, and configs to Google Drive.
                </p>
              </div>

              <button
                disabled={isUploading || !isAdmin}
                onClick={handleUploadSnapshotToDrive}
                className={`w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                  isUploading || !isAdmin
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                }`}
              >
                {isUploading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Cloud className="w-3.5 h-3.5" />
                )}
                <span>Upload Snapshot to Google Drive</span>
              </button>
            </div>

            {/* Action 2: Upload CSV Suite to Google Drive */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-black/[0.08] dark:border-white/[0.08] flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-bold">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Export & Upload CSV Spreadsheets</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Exports and uploads 3 separate spreadsheet files (Inventory, Stock Movements, Sales Receipts) directly to Google Drive for Sheets integration.
                </p>
              </div>

              <button
                disabled={isUploading || !isAdmin}
                onClick={handleUploadCSVsToDrive}
                className={`w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                  isUploading || !isAdmin
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                }`}
              >
                {isUploading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FolderSync className="w-3.5 h-3.5" />
                )}
                <span>Sync CSV Spreadsheets to Drive</span>
              </button>
            </div>
          </div>

          {/* Active Upload Status Feedback */}
          {isUploading && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs flex items-center space-x-2 text-blue-700 dark:text-blue-300 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
              <span className="font-semibold">{uploadStatus}</span>
            </div>
          )}

          {/* 3. Google Drive Remote Files Explorer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-4 h-4 text-blue-600" />
                <h5 className="font-bold text-slate-900 dark:text-slate-100">
                  Files in Google Drive: <span className="font-mono text-blue-600">/Inventory_Cloud_Backups</span> ({driveFiles.length})
                </h5>
              </div>

              <button
                onClick={loadDriveFiles}
                disabled={isLoadingFiles}
                className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                <span>Refresh Drive</span>
              </button>
            </div>

            {isLoadingFiles ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center space-y-2 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span>Fetching backups from your Google Drive folder...</span>
              </div>
            ) : driveFiles.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 space-y-1 text-xs">
                <p className="font-semibold text-slate-600 dark:text-slate-400">No backup files in Google Drive folder yet.</p>
                <p>Click &quot;Upload Snapshot to Google Drive&quot; or &quot;Sync CSV Spreadsheets&quot; above to create your first cloud archive.</p>
              </div>
            ) : (
              <div className="border border-black/[0.08] dark:border-white/[0.08] rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-800/90">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-semibold text-slate-700 dark:text-slate-300 z-10">
                      <tr>
                        <th className="p-2.5">File Name & Format</th>
                        <th className="p-2.5">Created Date</th>
                        <th className="p-2.5">File Size</th>
                        <th className="p-2.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                      {driveFiles.map((file) => {
                        const isJson = file.name.endsWith('.json') || file.mimeType.includes('json');
                        const isCSV = file.name.endsWith('.csv') || file.mimeType.includes('csv');

                        return (
                          <tr
                            key={file.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <td className="p-2.5">
                              <div className="flex items-center space-x-2">
                                {isJson ? (
                                  <FileJson className="w-4 h-4 text-blue-600 shrink-0" />
                                ) : isCSV ? (
                                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <HardDrive className="w-4 h-4 text-slate-500 shrink-0" />
                                )}
                                <div className="truncate max-w-[200px] sm:max-w-[280px]">
                                  <div className="font-semibold text-slate-900 dark:text-slate-100 font-mono text-[11px] truncate">
                                    {file.name}
                                  </div>
                                  {file.description && (
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {file.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="p-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {new Date(file.createdTime).toLocaleDateString()} {new Date(file.createdTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>

                            <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {file.size ? `${(Number(file.size) / 1024).toFixed(1)} KB` : 'Cloud Object'}
                            </td>

                            <td className="p-2.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end space-x-1.5">
                                {/* Open in Google Drive */}
                                {file.webViewLink && (
                                  <a
                                    href={file.webViewLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                                    title="Open directly in Google Drive"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}

                                {/* Restore from Drive (JSON only) */}
                                {isJson && (
                                  <button
                                    disabled={!isAdmin}
                                    onClick={() => setFileToRestore(file)}
                                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors flex items-center space-x-1 cursor-pointer ${
                                      isAdmin
                                        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300'
                                        : 'opacity-40 cursor-not-allowed'
                                    }`}
                                    title="Restore inventory database from this Google Drive snapshot"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    <span>Restore</span>
                                  </button>
                                )}

                                {/* Delete from Google Drive (Requires explicit confirmation modal) */}
                                <button
                                  disabled={!isAdmin}
                                  onClick={() => setFileToDelete(file)}
                                  className={`p-1.5 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer ${
                                    !isAdmin ? 'opacity-40 cursor-not-allowed' : ''
                                  }`}
                                  title="Delete from Google Drive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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
      ) : (
        /* Prompt to sign in with Google */
        <div className="p-6 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h5 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Connect Your Google Drive
            </h5>
            <p className="text-slate-500 text-xs max-w-md mx-auto mt-1">
              Sign in with your Google account to automatically store scheduled inventory snapshots and spreadsheet exports inside your personal or company Google Drive.
            </p>
          </div>
          <button
            disabled={isAuthenticating || !isAdmin}
            onClick={handleSignIn}
            title={isAdmin ? 'Connect Google Drive' : 'Administrator privileges required to link Google Drive'}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all ${
              !isAdmin
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
            }`}
          >
            {isAuthenticating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : !isAdmin ? (
              <Lock className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Cloud className="w-3.5 h-3.5" />
            )}
            <span>{isAuthenticating ? 'Connecting...' : !isAdmin ? 'Admin Only: Link Google Drive' : 'Connect Google Drive'}</span>
          </button>
        </div>
      )}

      {/* MODAL 1: Confirm File Deletion from Google Drive (Workspace Skill Requirement) */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#202020] rounded-xl border border-black/10 dark:border-white/10 shadow-2xl p-5 space-y-4 animate-scale-up">
            <div className="flex items-center space-x-2 text-rose-600 font-bold text-sm">
              <Trash2 className="w-5 h-5" />
              <span>Delete File from Google Drive?</span>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p>
                Are you sure you want to permanently delete <strong>&quot;{fileToDelete.name}&quot;</strong> from your Google Drive folder?
              </p>
              <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-300 font-mono">
                File ID: {fileToDelete.id}
                <br />
                Size: {fileToDelete.size ? `${(Number(fileToDelete.size) / 1024).toFixed(1)} KB` : 'N/A'}
              </div>
              <p className="text-[11px] text-slate-500">
                This action will delete the file from Google Drive. It cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-black/[0.08] dark:border-white/[0.08]">
              <button
                disabled={isDeleting}
                onClick={() => setFileToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                {isDeleting && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>{isDeleting ? 'Deleting...' : 'Confirm Delete from Drive'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Confirm Database Restore from Drive Snapshot */}
      {fileToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#202020] rounded-xl border border-black/10 dark:border-white/10 shadow-2xl p-5 space-y-4 animate-scale-up">
            <div className="flex items-center space-x-2 text-blue-600 font-bold text-sm">
              <ShieldCheck className="w-5 h-5" />
              <span>Restore Database from Google Drive Snapshot?</span>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p>
                You are about to restore workspace data using <strong>&quot;{fileToRestore.name}&quot;</strong> from Google Drive.
              </p>
              <div className="p-2.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300 space-y-1">
                <div>This will overwrite the current live inventory items, transaction movements, suppliers, purchase orders, receipts, and settings.</div>
              </div>
              <p className="text-[11px] text-slate-500">
                Ensure you have a recent backup if you wish to preserve the current state.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-black/[0.08] dark:border-white/[0.08]">
              <button
                disabled={isRestoring}
                onClick={() => setFileToRestore(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={isRestoring}
                onClick={handleConfirmRestore}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                {isRestoring && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>{isRestoring ? 'Restoring...' : 'Confirm Restore Database'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
