import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TitleBar } from './components/TitleBar';
import { NavigationSidebar } from './components/NavigationSidebar';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { StockMovementsView } from './components/StockMovementsView';
import { PurchaseOrdersView } from './components/PurchaseOrdersView';
import { SuppliersView } from './components/SuppliersView';
import { TeamManagementView } from './components/TeamManagementView';
import { BarcodeStudioView } from './components/BarcodeStudioView';
import { ReceiptsView } from './components/ReceiptsView';
import { ReceiptPrintModal } from './components/ReceiptPrintModal';
import { AuthLockScreen } from './components/AuthLockScreen';
import { ItemModal } from './components/ItemModal';
import { StockAdjustModal } from './components/StockAdjustModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { SettingsModal } from './components/SettingsModal';
import { DevPasswordModal } from './components/DevPasswordModal';
import { POSRegisterModal } from './components/POSRegisterModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { AndroidAppView } from './components/mobile/AndroidAppView';
import { DailySalesRecapView } from './components/DailySalesRecapView';
import { SalesRepDispatchView } from './components/SalesRepDispatchView';
import { CrateReturnModal } from './components/CrateReturnModal';

import {
  InventoryItem,
  StockMovement,
  Supplier,
  PurchaseOrder,
  AppSettings,
  ViewTab,
  MovementType,
  ReceiptData,
  AppUser,
  CloudBackupSchedule,
  CloudBackupSnapshot,
  CloudBackupFrequency,
  DailyExpense,
  BankDeposit,
  SalesRepDispatch,
  DispatchedProductLine,
  CreditCustomerPayment,
  CrateReturn,
} from './types';
import {
  defaultItems,
  defaultMovements,
  defaultSuppliers,
  defaultPurchaseOrders,
  defaultUsers,
  initialSettings,
  IndustryPreset,
} from './data/mockData';
import {
  exportInventoryToCSV,
  exportStockMovementsToCSV,
  exportReceiptsToCSV,
  exportAllDataCSVBundle,
} from './utils/csv';
import {
  defaultCloudSchedule,
  defaultMockSnapshots,
  createCloudSnapshotPayload,
  calculateNextBackupDate,
} from './utils/cloudBackup';
import { sound } from './utils/audio';
import { getItemPricing } from './utils/pricing';
import {
  subscribeToRemoteItems,
  saveItemToFirestore,
  saveItemsBatchToFirestore,
  mergeRemoteItemsByTimestamp,
  deleteItemFromFirestore,
  saveMovementToFirestore,
  deleteMovementFromFirestore,
  uploadAllMovementsToFirestore,
  subscribeToRemoteMovements,
  saveReceiptToFirestore,
  deleteReceiptFromFirestore,
  uploadAllReceiptsToFirestore,
  subscribeToRemoteReceipts,
  savePurchaseOrderToFirestore,
  deletePurchaseOrderFromFirestore,
  uploadAllPurchaseOrdersToFirestore,
  subscribeToRemotePurchaseOrders,
  saveSupplierToFirestore,
  deleteSupplierFromFirestore,
  uploadAllSuppliersToFirestore,
  subscribeToRemoteSuppliers,
  saveStoreSettingsToFirestore,
  subscribeToStoreSettings,
  testFirestoreConnection,
  subscribeToRemoteExpenses,
  saveExpenseToFirestore,
  deleteExpenseFromFirestore,
  subscribeToRemoteDeposits,
  saveDepositToFirestore,
  deleteDepositFromFirestore,
  subscribeToRemoteDispatches,
  saveDispatchToFirestore,
  deleteDispatchFromFirestore,
  subscribeToRemoteCreditPayments,
  saveCreditPaymentToFirestore,
  deleteCreditPaymentFromFirestore,
  subscribeToRemoteCrateReturns,
  saveCrateReturnToFirestore,
  deleteCrateReturnFromFirestore,
  ensureCloudDevPasswordInitialized,
  upsertActiveDeviceSession,
  subscribeToActiveDevices,
  getOrCreateLocalDeviceId,
  reconcileRemoteDeltas,
  DELTA_SYNC_INTERVAL_MS,
  LAST_SYNC_CHECK_STORAGE_KEY,
  saveUserToFirestore,
  deleteUserFromFirestore,
  uploadAllUsersToFirestore,
  fetchRemoteUsers,
  subscribeToRemoteUsers,
} from './services/firebaseSync';

const defaultMockReceipts: ReceiptData[] = [];
const defaultExpenses: DailyExpense[] = [];
const defaultBankDeposits: BankDeposit[] = [];
const defaultSalesRepDispatches: SalesRepDispatch[] = [];
const defaultCreditPayments: CreditCustomerPayment[] = [];
const defaultCrateReturns: CrateReturn[] = [];

export default function App() {
  // Legacy mock IDs to always purge from local storage
  const MOCK_ITEM_IDS = ['sample-p1', 'sample-p2', 'cof_01', 'cof_02', 'cof_03', 'cof_04', 'app_01', 'app_02', 'app_03', 'nga_01', 'nga_02', 'nga_03', 'nga_04'];
  const MOCK_EXPENSE_IDS = ['exp-1', 'exp-2', 'exp-3'];
  const MOCK_DEPOSIT_IDS = ['dep-1'];
  const MOCK_DISPATCH_IDS = ['dsp_sample_1'];
  const MOCK_USER_IDS = ['usr_admin_1', 'usr_super_1', 'usr_super_2', 'usr_super_3', 'usr_sales_1'];

  // --- Persistent State from LocalStorage ---
  const [items, setItems] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_items');
      if (saved) {
        const parsed: InventoryItem[] = JSON.parse(saved);
        return parsed.filter((it) => !MOCK_ITEM_IDS.includes(it.id));
      }
      return defaultItems;
    } catch {
      return defaultItems;
    }
  });
  const itemsRef = useRef<InventoryItem[]>(items);
  itemsRef.current = items;
  const lastPushedTimestampsRef = useRef<Map<string, string>>(new Map());

  const pushNewerLocalItems = useCallback((newerItems: InventoryItem[]) => {
    const toPush = newerItems.filter((it) => {
      const ts = it.updatedAt || '';
      return ts && lastPushedTimestampsRef.current.get(it.id) !== ts;
    });
    if (toPush.length === 0) return;
    toPush.forEach((it) => {
      if (it.updatedAt) lastPushedTimestampsRef.current.set(it.id, it.updatedAt);
    });
    saveItemsBatchToFirestore(toPush).catch((err) => {
      // Allow retry if offline/write failed
      toPush.forEach((it) => {
        if (lastPushedTimestampsRef.current.get(it.id) === it.updatedAt) {
          lastPushedTimestampsRef.current.delete(it.id);
        }
      });
      console.warn('[Firestore] Failed to push newer local items:', err);
    });
  }, []);

  const [movements, setMovements] = useState<StockMovement[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_movements');
      return saved ? JSON.parse(saved) : defaultMovements;
    } catch {
      return defaultMovements;
    }
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_suppliers');
      return saved ? JSON.parse(saved) : defaultSuppliers;
    } catch {
      return defaultSuppliers;
    }
  });
  const suppliersRef = useRef<Supplier[]>(suppliers);
  suppliersRef.current = suppliers;

  const [orders, setOrders] = useState<PurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_orders');
      return saved ? JSON.parse(saved) : defaultPurchaseOrders;
    } catch {
      return defaultPurchaseOrders;
    }
  });
  const ordersRef = useRef<PurchaseOrder[]>(orders);
  ordersRef.current = orders;

  const [receipts, setReceipts] = useState<ReceiptData[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_receipts');
      return saved ? JSON.parse(saved) : defaultMockReceipts;
    } catch {
      return defaultMockReceipts;
    }
  });
  const receiptsRef = useRef<ReceiptData[]>(receipts);
  receiptsRef.current = receipts;

  const [expenses, setExpenses] = useState<DailyExpense[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_expenses');
      if (saved) {
        const parsed: DailyExpense[] = JSON.parse(saved);
        return parsed.filter((exp) => !MOCK_EXPENSE_IDS.includes(exp.id));
      }
      return defaultExpenses;
    } catch {
      return defaultExpenses;
    }
  });

  const [bankDeposits, setBankDeposits] = useState<BankDeposit[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_bank_deposits');
      if (saved) {
        const parsed: BankDeposit[] = JSON.parse(saved);
        return parsed.filter((dep) => !MOCK_DEPOSIT_IDS.includes(dep.id));
      }
      return defaultBankDeposits;
    } catch {
      return defaultBankDeposits;
    }
  });

  const [salesRepDispatches, setSalesRepDispatches] = useState<SalesRepDispatch[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_sales_rep_dispatches');
      if (saved) {
        const parsed: SalesRepDispatch[] = JSON.parse(saved);
        return parsed.filter((dsp) => !MOCK_DISPATCH_IDS.includes(dsp.id));
      }
      return defaultSalesRepDispatches;
    } catch {
      return defaultSalesRepDispatches;
    }
  });

  const [creditPayments, setCreditPayments] = useState<CreditCustomerPayment[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_credit_payments');
      return saved ? JSON.parse(saved) : defaultCreditPayments;
    } catch {
      return defaultCreditPayments;
    }
  });

  const [crateReturns, setCrateReturns] = useState<CrateReturn[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_crate_returns');
      return saved ? JSON.parse(saved) : defaultCrateReturns;
    } catch {
      return defaultCrateReturns;
    }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('win_inv_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.companyName === 'Apex Dynamics Logistics') {
          parsed.companyName = initialSettings.companyName;
          parsed.warehouseName = initialSettings.warehouseName;
          parsed.companyAddress = initialSettings.companyAddress;
          parsed.companyPhone = initialSettings.companyPhone;
          parsed.companyEmail = initialSettings.companyEmail;
          parsed.taxId = initialSettings.taxId;
        }
        if (parsed.currency === 'USD' && parsed.currencySymbol === '$') {
          return { ...parsed, currency: 'NGN', currencySymbol: '₦' };
        }
        return { ...initialSettings, ...parsed };
      }
      return initialSettings;
    } catch {
      return initialSettings;
    }
  });
  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;

  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_users');
      if (saved) {
        const parsed: AppUser[] = JSON.parse(saved);
        const nonMockUsers = parsed.filter((u) => !MOCK_USER_IDS.includes(u.id));
        if (nonMockUsers.length > 0) {
          return nonMockUsers.map((u) => {
            if (u.role === 'admin' && (!u.pin || u.pin === '1234')) {
              return { ...u, pin: '123456' };
            }
            return u;
          });
        }
      }
      return defaultUsers;
    } catch {
      return defaultUsers;
    }
  });
  const usersRef = useRef<AppUser[]>(users);
  usersRef.current = users;

  // Cloud Backup Schedule (Daily / Weekly / Monthly / Manual)
  const [cloudSchedule, setCloudSchedule] = useState<CloudBackupSchedule>(() => {
    try {
      const saved = localStorage.getItem('win_inv_cloud_schedule');
      return saved ? JSON.parse(saved) : defaultCloudSchedule;
    } catch {
      return defaultCloudSchedule;
    }
  });

  // Cloud Backup Snapshots History
  const [cloudSnapshots, setCloudSnapshots] = useState<CloudBackupSnapshot[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_cloud_backups');
      return saved ? JSON.parse(saved) : defaultMockSnapshots;
    } catch {
      return defaultMockSnapshots;
    }
  });

  const [isHydratingUsers, setIsHydratingUsers] = useState<boolean>(() => {
    try {
      return !localStorage.getItem('win_inv_users') && !localStorage.getItem('win_inv_active_user_id');
    } catch {
      return false;
    }
  });

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const hasLocalUsers = Boolean(localStorage.getItem('win_inv_users'));
      const savedId = localStorage.getItem('win_inv_active_user_id');
      if (savedId === 'locked_session') return null;

      if (savedId) {
        const found = users.find((u) => u.id === savedId);
        if (found && found.status !== 'inactive') {
          return found;
        }
        // Saved user is missing locally or inactive: require sign-in instead of falling back to Admin
        return null;
      }

      // Brand-new device with no local cache: defer login until remote Firestore users finish hydrating
      if (!hasLocalUsers) {
        return null;
      }

      // First-time boot when only the default initial Administrator exists
      if (users.length === 1 && users[0]?.id === 'usr_admin_default') {
        return users[0];
      }

      // When multiple staff accounts exist and no active session ID is stored, prompt sign-in
      return null;
    } catch {
      return null;
    }
  });

  const isAdmin = currentUser?.role === 'admin';

  // Track deleted record IDs so real-time Firestore listeners do not resurrect deleted or purged records
  const deletedIdsRef = useRef<Set<string>>(
    (() => {
      try {
        const saved = localStorage.getItem('win_inv_deleted_ids');
        const initialSet = saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
        // Add known mock IDs to deleted set to prevent any remote Firestore sync from resurrecting them
        [...MOCK_ITEM_IDS, ...MOCK_EXPENSE_IDS, ...MOCK_DEPOSIT_IDS, ...MOCK_DISPATCH_IDS].forEach((id) =>
          initialSet.add(id)
        );
        return initialSet;
      } catch {
        return new Set<string>([...MOCK_ITEM_IDS, ...MOCK_EXPENSE_IDS, ...MOCK_DEPOSIT_IDS, ...MOCK_DISPATCH_IDS]);
      }
    })()
  );

  const markIdDeleted = useCallback((id: string) => {
    deletedIdsRef.current.add(id);
    try {
      localStorage.setItem('win_inv_deleted_ids', JSON.stringify(Array.from(deletedIdsRef.current)));
    } catch {}
  }, []);

  // 5-Minute Smart Delta Sync State (Spark Free Tier Safe)
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(LAST_SYNC_CHECK_STORAGE_KEY);
      return saved || new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  });
  const [isDeltaSyncing, setIsDeltaSyncing] = useState<boolean>(false);
  const [deltaSyncToast, setDeltaSyncToast] = useState<string | null>(null);

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('win_inv_items', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('win_inv_movements', JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    localStorage.setItem('win_inv_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('win_inv_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('win_inv_receipts', JSON.stringify(receipts));
  }, [receipts]);

  useEffect(() => {
    localStorage.setItem('win_inv_expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('win_inv_bank_deposits', JSON.stringify(bankDeposits));
  }, [bankDeposits]);

  useEffect(() => {
    localStorage.setItem('win_inv_sales_rep_dispatches', JSON.stringify(salesRepDispatches));
  }, [salesRepDispatches]);

  useEffect(() => {
    localStorage.setItem('win_inv_credit_payments', JSON.stringify(creditPayments));
  }, [creditPayments]);

  useEffect(() => {
    localStorage.setItem('win_inv_crate_returns', JSON.stringify(crateReturns));
  }, [crateReturns]);

  useEffect(() => {
    localStorage.setItem('win_inv_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('win_inv_cloud_schedule', JSON.stringify(cloudSchedule));
  }, [cloudSchedule]);

  useEffect(() => {
    localStorage.setItem('win_inv_cloud_backups', JSON.stringify(cloudSnapshots));
  }, [cloudSnapshots]);

  // On a fresh device without local staff cache, hydrate staff users from Firestore before deciding login vs lock screen
  useEffect(() => {
    if (!isHydratingUsers) return;
    let cancelled = false;

    const hydrate = async () => {
      try {
        const timeoutPromise = new Promise<AppUser[] | null>((resolve) =>
          setTimeout(() => resolve(null), 2500)
        );
        const remote = await Promise.race([fetchRemoteUsers(), timeoutPromise]);
        if (cancelled) return;

        if (remote && remote.length > 0) {
          const validRemote = remote.filter(
            (u) => !MOCK_USER_IDS.includes(u.id) && !deletedIdsRef.current.has(u.id)
          );
          if (validRemote.length > 0) {
            usersRef.current = validRemote;
            setUsers(validRemote);
            try {
              localStorage.setItem('win_inv_users', JSON.stringify(validRemote));
            } catch {}
            // Keep currentUser as null so AuthLockScreen prompts PIN sign-in for Admin 1, Admin 2, or staff
            setIsHydratingUsers(false);
            return;
          }
        }

        // Brand-new store with no remote staff in Firestore yet, or offline fallback
        if (usersRef.current.length === 1 && usersRef.current[0]?.id === 'usr_admin_default') {
          setCurrentUser(usersRef.current[0]);
          if (remote !== null) {
            uploadAllUsersToFirestore(usersRef.current).catch(() => {});
          }
        }
      } catch {
        if (!cancelled && usersRef.current.length === 1 && usersRef.current[0]?.id === 'usr_admin_default') {
          setCurrentUser(usersRef.current[0]);
        }
      } finally {
        if (!cancelled) {
          setIsHydratingUsers(false);
        }
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [isHydratingUsers]);

  useEffect(() => {
    if (isHydratingUsers) return;
    if (currentUser) {
      localStorage.setItem('win_inv_active_user_id', currentUser.id);
      localStorage.setItem('win_inv_last_user_id', currentUser.id);
      upsertActiveDeviceSession(currentUser, 'online').catch(() => {});
    } else {
      localStorage.setItem('win_inv_active_user_id', 'locked_session');
      upsertActiveDeviceSession(null, 'offline').catch(() => {});
    }
  }, [currentUser, isHydratingUsers]);

  // Periodic 2-minute heartbeat + beforeunload offline update + remote force-logout listener
  useEffect(() => {
    if (!currentUser) return;

    const heartbeatInterval = setInterval(() => {
      upsertActiveDeviceSession(currentUser, 'online').catch(() => {});
    }, 2 * 60 * 1000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        upsertActiveDeviceSession(currentUser, 'online').catch(() => {});
      }
    };

    const handleBeforeUnload = () => {
      upsertActiveDeviceSession(currentUser, 'offline').catch(() => {});
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const localDevId = getOrCreateLocalDeviceId();
    let ignoreInitialRevoked = true;
    const unsubDevices = subscribeToActiveDevices((devices) => {
      const mySession = devices.find((d) => d.id === localDevId);
      if (ignoreInitialRevoked) {
        ignoreInitialRevoked = false;
        return;
      }
      if (mySession && mySession.status === 'revoked') {
        setCurrentUser(null);
      }
    });

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsubDevices();
    };
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('win_inv_settings', JSON.stringify(settings));
    const applyTheme = () => {
      if (settings.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (settings.theme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    applyTheme();

    if (settings.theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings]);

  const handleToggleTheme = () => {
    setSettings((prev) => {
      const nextTheme = prev.theme === 'dark' ? 'light' : 'dark';
      return { ...prev, theme: nextTheme };
    });
  };

  // --- Real-time Firebase Firestore Synchronization (Remote Android & Cloud Sync) ---
  useEffect(() => {
    testFirestoreConnection().then((res) => {
      if (res.success) {
        console.log('[Firestore] Connected to Firebase Firestore successfully.');
      }
    });

    ensureCloudDevPasswordInitialized().catch(() => {});

    const unsubscribe = subscribeToRemoteItems((remoteItems) => {
      if (remoteItems && remoteItems.length > 0) {
        const { localNewerItems } = mergeRemoteItemsByTimestamp(
          itemsRef.current,
          remoteItems,
          deletedIdsRef.current
        );
        if (localNewerItems.length > 0) {
          pushNewerLocalItems(localNewerItems);
        }

        setItems((currentItems) => {
          const { merged, hasChanges } = mergeRemoteItemsByTimestamp(
            currentItems,
            remoteItems,
            deletedIdsRef.current
          );

          if (hasChanges) {
            try {
              localStorage.setItem('win_inv_items', JSON.stringify(merged));
            } catch {}
            itemsRef.current = merged;
            return merged;
          }
          return currentItems;
        });
      }
    });

    const unsubExpenses = subscribeToRemoteExpenses((remoteExpenses) => {
      if (remoteExpenses && remoteExpenses.length > 0) {
        setExpenses((currentExpenses) => {
          const map = new Map<string, DailyExpense>();
          currentExpenses.forEach((e) => {
            if (!deletedIdsRef.current.has(e.id)) {
              map.set(e.id, e);
            }
          });

          let hasChanges = false;
          remoteExpenses.forEach((remote) => {
            if (deletedIdsRef.current.has(remote.id)) return;
            const existing = map.get(remote.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
              map.set(remote.id, remote);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('win_inv_expenses', JSON.stringify(merged));
            } catch {}
            return merged;
          }
          return currentExpenses;
        });
      }
    });

    const unsubDeposits = subscribeToRemoteDeposits((remoteDeposits) => {
      if (remoteDeposits && remoteDeposits.length > 0) {
        setBankDeposits((currentDeposits) => {
          const map = new Map<string, BankDeposit>();
          currentDeposits.forEach((d) => {
            if (!deletedIdsRef.current.has(d.id)) {
              map.set(d.id, d);
            }
          });

          let hasChanges = false;
          remoteDeposits.forEach((remote) => {
            if (deletedIdsRef.current.has(remote.id)) return;
            const existing = map.get(remote.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
              map.set(remote.id, remote);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('win_inv_bank_deposits', JSON.stringify(merged));
            } catch {}
            return merged;
          }
          return currentDeposits;
        });
      }
    });

    const unsubDispatches = subscribeToRemoteDispatches((remoteDispatches) => {
      if (remoteDispatches && remoteDispatches.length > 0) {
        setSalesRepDispatches((currentDispatches) => {
          const map = new Map<string, SalesRepDispatch>();
          currentDispatches.forEach((d) => {
            if (!deletedIdsRef.current.has(d.id)) {
              map.set(d.id, d);
            }
          });

          let hasChanges = false;
          remoteDispatches.forEach((remote) => {
            if (deletedIdsRef.current.has(remote.id)) return;
            const existing = map.get(remote.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
              map.set(remote.id, remote);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('win_inv_sales_rep_dispatches', JSON.stringify(merged));
            } catch {}
            return merged;
          }
          return currentDispatches;
        });
      }
    });

    const unsubCreditPayments = subscribeToRemoteCreditPayments((remotePayments) => {
      if (remotePayments && remotePayments.length > 0) {
        setCreditPayments((currentPayments) => {
          const map = new Map<string, CreditCustomerPayment>();
          currentPayments.forEach((p) => {
            if (!deletedIdsRef.current.has(p.id)) {
              map.set(p.id, p);
            }
          });

          let hasChanges = false;
          remotePayments.forEach((remote) => {
            if (deletedIdsRef.current.has(remote.id)) return;
            const existing = map.get(remote.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
              map.set(remote.id, remote);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('win_inv_credit_payments', JSON.stringify(merged));
            } catch {}
            return merged;
          }
          return currentPayments;
        });
      }
    });

    const unsubCrateReturns = subscribeToRemoteCrateReturns((remoteReturns) => {
      if (remoteReturns && remoteReturns.length > 0) {
        setCrateReturns((currentReturns) => {
          const map = new Map<string, CrateReturn>();
          currentReturns.forEach((r) => {
            if (!deletedIdsRef.current.has(r.id)) {
              map.set(r.id, r);
            }
          });

          let hasChanges = false;
          remoteReturns.forEach((remote) => {
            if (deletedIdsRef.current.has(remote.id)) return;
            const existing = map.get(remote.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
              map.set(remote.id, remote);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('win_inv_crate_returns', JSON.stringify(merged));
            } catch {}
            return merged;
          }
          return currentReturns;
        });
      }
    });

    const toMillis = (iso?: string): number => {
      if (!iso) return 0;
      const ms = Date.parse(iso);
      return Number.isNaN(ms) ? 0 : ms;
    };

    const unsubMovements = subscribeToRemoteMovements((remoteMovements) => {
      if (remoteMovements && remoteMovements.length > 0) {
        setMovements((currentMovements) => {
          const map = new Map<string, StockMovement>();
          currentMovements.forEach((m) => {
            if (!deletedIdsRef.current.has(m.id)) {
              map.set(m.id, m);
            }
          });

          let hasChanges = false;
          remoteMovements.forEach((remote) => {
            if (deletedIdsRef.current.has(remote.id)) return;
            const existing = map.get(remote.id);
            if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
              map.set(remote.id, remote);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            try {
              localStorage.setItem('win_inv_movements', JSON.stringify(merged));
            } catch {}
            return merged;
          }
          return currentMovements;
        });
      }
    });

    const unsubReceipts = subscribeToRemoteReceipts((remoteReceipts) => {
      if (remoteReceipts && remoteReceipts.length > 0) {
        const localNewerReceipts: ReceiptData[] = [];
        const remoteMap = new Map<string, ReceiptData>();
        remoteReceipts.forEach((r) => remoteMap.set(r.id, r));
        receiptsRef.current.forEach((localRec) => {
          if (deletedIdsRef.current.has(localRec.id)) return;
          const remoteRec = remoteMap.get(localRec.id);
          if (remoteRec) {
            const localMs = toMillis(localRec.updatedAt || localRec.date);
            const remoteMs = toMillis(remoteRec.updatedAt || remoteRec.date);
            if (localMs > remoteMs) {
              localNewerReceipts.push(localRec);
            }
          }
        });
        localNewerReceipts.forEach((rec) => {
          saveReceiptToFirestore(rec).catch(() => {});
        });

        setReceipts((currentReceipts) => {
          const map = new Map<string, ReceiptData>();
          currentReceipts.forEach((r) => {
            if (!deletedIdsRef.current.has(r.id)) {
              map.set(r.id, r);
            }
          });

          let hasChanges = false;
          remoteReceipts.forEach((remote) => {
            if (deletedIdsRef.current.has(remote.id)) return;
            const existing = map.get(remote.id);
            if (!existing) {
              map.set(remote.id, remote);
              hasChanges = true;
              return;
            }
            const localMs = toMillis(existing.updatedAt || existing.date);
            const remoteMs = toMillis(remote.updatedAt || remote.date);
            if (remoteMs > localMs || (remoteMs === localMs && JSON.stringify(existing) !== JSON.stringify(remote) && !existing.updatedAt)) {
              map.set(remote.id, remote);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            try {
              localStorage.setItem('win_inv_receipts', JSON.stringify(merged));
            } catch {}
            receiptsRef.current = merged;
            return merged;
          }
          return currentReceipts;
        });
      }
    });

    const unsubOrders = subscribeToRemotePurchaseOrders((remoteOrders) => {
      if (remoteOrders && remoteOrders.length > 0) {
        const localNewerOrders: PurchaseOrder[] = [];
        const remoteMap = new Map<string, PurchaseOrder>();
        remoteOrders.forEach((o) => remoteMap.set(o.id, o));
        ordersRef.current.forEach((localPo) => {
          if (deletedIdsRef.current.has(localPo.id)) return;
          const remotePo = remoteMap.get(localPo.id);
          if (remotePo) {
            const localMs = toMillis(localPo.updatedAt || localPo.receivedDate || localPo.orderDate);
            const remoteMs = toMillis(remotePo.updatedAt || remotePo.receivedDate || remotePo.orderDate);
            if (localMs > remoteMs) {
              localNewerOrders.push(localPo);
            }
          }
        });
        localNewerOrders.forEach((po) => {
          savePurchaseOrderToFirestore(po).catch(() => {});
        });

        setOrders((currentOrders) => {
          const map = new Map<string, PurchaseOrder>();
          currentOrders.forEach((o) => {
            if (!deletedIdsRef.current.has(o.id)) {
              map.set(o.id, o);
            }
          });

          let hasChanges = false;
          remoteOrders.forEach((remote) => {
            if (deletedIdsRef.current.has(remote.id)) return;
            const existing = map.get(remote.id);
            if (!existing) {
              map.set(remote.id, remote);
              hasChanges = true;
              return;
            }
            const localMs = toMillis(existing.updatedAt || existing.receivedDate || existing.orderDate);
            const remoteMs = toMillis(remote.updatedAt || remote.receivedDate || remote.orderDate);
            if (remoteMs > localMs || (remoteMs === localMs && JSON.stringify(existing) !== JSON.stringify(remote) && !existing.updatedAt)) {
              map.set(remote.id, remote);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
            );
            try {
              localStorage.setItem('win_inv_orders', JSON.stringify(merged));
            } catch {}
            ordersRef.current = merged;
            return merged;
          }
          return currentOrders;
        });
      }
    });

    const unsubSuppliers = subscribeToRemoteSuppliers((remoteSuppliers) => {
      if (remoteSuppliers && remoteSuppliers.length > 0) {
        const localNewerSuppliers: Supplier[] = [];
        const remoteMap = new Map<string, Supplier>();
        remoteSuppliers.forEach((s) => remoteMap.set(s.id, s));
        suppliersRef.current.forEach((localSup) => {
          if (deletedIdsRef.current.has(localSup.id)) return;
          const remoteSup = remoteMap.get(localSup.id);
          if (remoteSup) {
            const localMs = toMillis(localSup.updatedAt);
            const remoteMs = toMillis(remoteSup.updatedAt);
            if (localMs > remoteMs) {
              localNewerSuppliers.push(localSup);
            }
          }
        });
        localNewerSuppliers.forEach((sup) => {
          saveSupplierToFirestore(sup).catch(() => {});
        });

        setSuppliers((currentSuppliers) => {
          const map = new Map<string, Supplier>();
          currentSuppliers.forEach((s) => {
            if (!deletedIdsRef.current.has(s.id)) {
              map.set(s.id, s);
            }
          });

          let hasChanges = false;
          remoteSuppliers.forEach((remote) => {
            if (deletedIdsRef.current.has(remote.id)) return;
            const existing = map.get(remote.id);
            if (!existing) {
              map.set(remote.id, remote);
              hasChanges = true;
              return;
            }
            const localMs = toMillis(existing.updatedAt);
            const remoteMs = toMillis(remote.updatedAt);
            if (remoteMs > localMs || (remoteMs === localMs && JSON.stringify(existing) !== JSON.stringify(remote) && !existing.updatedAt)) {
              map.set(remote.id, remote);
              hasChanges = true;
            }
          });

          if (hasChanges) {
            const merged = Array.from(map.values());
            try {
              localStorage.setItem('win_inv_suppliers', JSON.stringify(merged));
            } catch {}
            suppliersRef.current = merged;
            return merged;
          }
          return currentSuppliers;
        });
      }
    });

    const unsubStoreSettings = subscribeToStoreSettings((remoteSettings) => {
      setSettings((currentSettings) => {
        const localMs = toMillis(currentSettings.updatedAt);
        const remoteMs = toMillis(remoteSettings.updatedAt);
        if (currentSettings.updatedAt && remoteSettings.updatedAt && localMs > remoteMs) {
          return currentSettings;
        }
        const candidate: AppSettings = {
          ...currentSettings,
          ...remoteSettings,
          theme: currentSettings.theme,
        };
        if (JSON.stringify(candidate) !== JSON.stringify(currentSettings)) {
          try {
            localStorage.setItem('win_inv_settings', JSON.stringify(candidate));
          } catch {}
          settingsRef.current = candidate;
          return candidate;
        }
        return currentSettings;
      });
    });

    const unsubUsers = subscribeToRemoteUsers((remoteUsers) => {
      const validRemote = remoteUsers.filter(
        (u) => !MOCK_USER_IDS.includes(u.id) && !deletedIdsRef.current.has(u.id)
      );
      if (validRemote.length === 0) return;

      const currentUsers = usersRef.current;
      const map = new Map<string, AppUser>();
      currentUsers.forEach((u) => {
        if (!MOCK_USER_IDS.includes(u.id) && !deletedIdsRef.current.has(u.id)) {
          map.set(u.id, u);
        }
      });

      let hasChanges = false;
      const missingFromRemote: AppUser[] = [];
      const remoteIds = new Set(validRemote.map((u) => u.id));

      currentUsers.forEach((localUser) => {
        if (
          !MOCK_USER_IDS.includes(localUser.id) &&
          !deletedIdsRef.current.has(localUser.id) &&
          !remoteIds.has(localUser.id)
        ) {
          missingFromRemote.push(localUser);
        }
      });

      validRemote.forEach((remote) => {
        const existing = map.get(remote.id);
        if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
          map.set(remote.id, remote);
          hasChanges = true;
        }
      });

      if (missingFromRemote.length > 0) {
        uploadAllUsersToFirestore(missingFromRemote).catch(() => {});
      }

      if (hasChanges) {
        const merged = Array.from(map.values());
        try {
          localStorage.setItem('win_inv_users', JSON.stringify(merged));
        } catch {}
        usersRef.current = merged;
        setUsers(merged);
        setCurrentUser((active) => {
          if (!active) return null;
          const updatedActive = merged.find((u) => u.id === active.id);
          if (!updatedActive || updatedActive.status === 'inactive') {
            return null;
          }
          return JSON.stringify(updatedActive) !== JSON.stringify(active) ? updatedActive : active;
        });
      }
    });

    return () => {
      unsubscribe();
      unsubExpenses();
      unsubDeposits();
      unsubDispatches();
      unsubCreditPayments();
      unsubCrateReturns();
      unsubMovements();
      unsubReceipts();
      unsubOrders();
      unsubSuppliers();
      unsubStoreSettings();
      unsubUsers();
    };
  }, []);

  // --- 5-Minute Smart Delta Reconciliation Function (Spark Free Tier Safe) ---
  const handleTriggerDeltaSync = useCallback(
    async (isSilent = false) => {
      if (isDeltaSyncing) return;
      setIsDeltaSyncing(true);
      try {
        const currentSince = localStorage.getItem(LAST_SYNC_CHECK_STORAGE_KEY) || lastSyncTime;
        const res = await reconcileRemoteDeltas(currentSince);
        const newCheckTime = res.summary.checkedAt;
        setLastSyncTime(newCheckTime);
        localStorage.setItem(LAST_SYNC_CHECK_STORAGE_KEY, newCheckTime);

        // Heartbeat active device session concurrently
        if (currentUser) {
          upsertActiveDeviceSession(currentUser, 'online').catch(() => {});
        }

        // 1. Reconcile items delta (timestamp-safe so stale cloud data never overwrites newer local deductions)
        if (res.deltas.items.length > 0) {
          const { localNewerItems } = mergeRemoteItemsByTimestamp(
            itemsRef.current,
            res.deltas.items,
            deletedIdsRef.current
          );
          if (localNewerItems.length > 0) {
            pushNewerLocalItems(localNewerItems);
          }

          setItems((currentItems) => {
            const { merged, hasChanges } = mergeRemoteItemsByTimestamp(
              currentItems,
              res.deltas.items,
              deletedIdsRef.current
            );
            if (hasChanges) {
              try {
                localStorage.setItem('win_inv_items', JSON.stringify(merged));
              } catch {}
              itemsRef.current = merged;
              return merged;
            }
            return currentItems;
          });
        }

        // 2. Reconcile expenses delta
        if (res.deltas.expenses.length > 0) {
          setExpenses((current) => {
            const map = new Map<string, DailyExpense>();
            current.forEach((e) => {
              if (!deletedIdsRef.current.has(e.id)) map.set(e.id, e);
            });
            let changes = false;
            res.deltas.expenses.forEach((remote) => {
              if (deletedIdsRef.current.has(remote.id)) return;
              const existing = map.get(remote.id);
              if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
                map.set(remote.id, remote);
                changes = true;
              }
            });
            if (changes) {
              const merged = Array.from(map.values());
              try {
                localStorage.setItem('win_inv_expenses', JSON.stringify(merged));
              } catch {}
              return merged;
            }
            return current;
          });
        }

        // 3. Reconcile bank deposits delta
        if (res.deltas.deposits.length > 0) {
          setBankDeposits((current) => {
            const map = new Map<string, BankDeposit>();
            current.forEach((d) => {
              if (!deletedIdsRef.current.has(d.id)) map.set(d.id, d);
            });
            let changes = false;
            res.deltas.deposits.forEach((remote) => {
              if (deletedIdsRef.current.has(remote.id)) return;
              const existing = map.get(remote.id);
              if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
                map.set(remote.id, remote);
                changes = true;
              }
            });
            if (changes) {
              const merged = Array.from(map.values());
              try {
                localStorage.setItem('win_inv_bank_deposits', JSON.stringify(merged));
              } catch {}
              return merged;
            }
            return current;
          });
        }

        // 4. Reconcile sales rep dispatches delta
        if (res.deltas.dispatches.length > 0) {
          setSalesRepDispatches((current) => {
            const map = new Map<string, SalesRepDispatch>();
            current.forEach((d) => {
              if (!deletedIdsRef.current.has(d.id)) map.set(d.id, d);
            });
            let changes = false;
            res.deltas.dispatches.forEach((remote) => {
              if (deletedIdsRef.current.has(remote.id)) return;
              const existing = map.get(remote.id);
              if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
                map.set(remote.id, remote);
                changes = true;
              }
            });
            if (changes) {
              const merged = Array.from(map.values());
              try {
                localStorage.setItem('win_inv_sales_rep_dispatches', JSON.stringify(merged));
              } catch {}
              return merged;
            }
            return current;
          });
        }

        // 5. Reconcile credit payments delta
        if (res.deltas.creditPayments.length > 0) {
          setCreditPayments((current) => {
            const map = new Map<string, CreditCustomerPayment>();
            current.forEach((p) => {
              if (!deletedIdsRef.current.has(p.id)) map.set(p.id, p);
            });
            let changes = false;
            res.deltas.creditPayments.forEach((remote) => {
              if (deletedIdsRef.current.has(remote.id)) return;
              const existing = map.get(remote.id);
              if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
                map.set(remote.id, remote);
                changes = true;
              }
            });
            if (changes) {
              const merged = Array.from(map.values());
              try {
                localStorage.setItem('win_inv_credit_payments', JSON.stringify(merged));
              } catch {}
              return merged;
            }
            return current;
          });
        }

        // 6. Reconcile crate returns delta
        if (res.deltas.crateReturns.length > 0) {
          setCrateReturns((current) => {
            const map = new Map<string, CrateReturn>();
            current.forEach((r) => {
              if (!deletedIdsRef.current.has(r.id)) map.set(r.id, r);
            });
            let changes = false;
            res.deltas.crateReturns.forEach((remote) => {
              if (deletedIdsRef.current.has(remote.id)) return;
              const existing = map.get(remote.id);
              if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
                map.set(remote.id, remote);
                changes = true;
              }
            });
            if (changes) {
              const merged = Array.from(map.values());
              try {
                localStorage.setItem('win_inv_crate_returns', JSON.stringify(merged));
              } catch {}
              return merged;
            }
            return current;
          });
        }

        // 7. Reconcile receipts delta (timestamp-safe)
        if (res.deltas.receipts.length > 0) {
          setReceipts((current) => {
            const toMs = (iso?: string) => {
              if (!iso) return 0;
              const parsed = Date.parse(iso);
              return Number.isNaN(parsed) ? 0 : parsed;
            };
            const map = new Map<string, ReceiptData>();
            current.forEach((r) => {
              if (!deletedIdsRef.current.has(r.id)) map.set(r.id, r);
            });
            let changes = false;
            res.deltas.receipts.forEach((remote) => {
              if (deletedIdsRef.current.has(remote.id)) return;
              const existing = map.get(remote.id);
              if (!existing) {
                map.set(remote.id, remote);
                changes = true;
                return;
              }
              const localMs = toMs(existing.updatedAt || existing.date);
              const remoteMs = toMs(remote.updatedAt || remote.date);
              if (remoteMs > localMs || (remoteMs === localMs && JSON.stringify(existing) !== JSON.stringify(remote) && !existing.updatedAt)) {
                map.set(remote.id, remote);
                changes = true;
              }
            });
            if (changes) {
              const merged = Array.from(map.values()).sort(
                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
              );
              try {
                localStorage.setItem('win_inv_receipts', JSON.stringify(merged));
              } catch {}
              receiptsRef.current = merged;
              return merged;
            }
            return current;
          });
        }

        // 8. Reconcile purchase orders delta
        if (res.deltas.purchaseOrders.length > 0) {
          setOrders((current) => {
            const toMs = (iso?: string) => {
              if (!iso) return 0;
              const parsed = Date.parse(iso);
              return Number.isNaN(parsed) ? 0 : parsed;
            };
            const map = new Map<string, PurchaseOrder>();
            current.forEach((o) => {
              if (!deletedIdsRef.current.has(o.id)) map.set(o.id, o);
            });
            let changes = false;
            res.deltas.purchaseOrders.forEach((remote) => {
              if (deletedIdsRef.current.has(remote.id)) return;
              const existing = map.get(remote.id);
              if (!existing) {
                map.set(remote.id, remote);
                changes = true;
                return;
              }
              const localMs = toMs(existing.updatedAt || existing.receivedDate || existing.orderDate);
              const remoteMs = toMs(remote.updatedAt || remote.receivedDate || remote.orderDate);
              if (remoteMs > localMs || (remoteMs === localMs && JSON.stringify(existing) !== JSON.stringify(remote) && !existing.updatedAt)) {
                map.set(remote.id, remote);
                changes = true;
              }
            });
            if (changes) {
              const merged = Array.from(map.values()).sort(
                (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
              );
              try {
                localStorage.setItem('win_inv_orders', JSON.stringify(merged));
              } catch {}
              ordersRef.current = merged;
              return merged;
            }
            return current;
          });
        }

        // 9. Reconcile suppliers delta
        if (res.deltas.suppliers.length > 0) {
          setSuppliers((current) => {
            const toMs = (iso?: string) => {
              if (!iso) return 0;
              const parsed = Date.parse(iso);
              return Number.isNaN(parsed) ? 0 : parsed;
            };
            const map = new Map<string, Supplier>();
            current.forEach((s) => {
              if (!deletedIdsRef.current.has(s.id)) map.set(s.id, s);
            });
            let changes = false;
            res.deltas.suppliers.forEach((remote) => {
              if (deletedIdsRef.current.has(remote.id)) return;
              const existing = map.get(remote.id);
              if (!existing) {
                map.set(remote.id, remote);
                changes = true;
                return;
              }
              const localMs = toMs(existing.updatedAt);
              const remoteMs = toMs(remote.updatedAt);
              if (remoteMs > localMs || (remoteMs === localMs && JSON.stringify(existing) !== JSON.stringify(remote) && !existing.updatedAt)) {
                map.set(remote.id, remote);
                changes = true;
              }
            });
            if (changes) {
              const merged = Array.from(map.values());
              try {
                localStorage.setItem('win_inv_suppliers', JSON.stringify(merged));
              } catch {}
              suppliersRef.current = merged;
              return merged;
            }
            return current;
          });
        }

        // 10. Reconcile stock movements delta
        if (res.deltas.movements.length > 0) {
          setMovements((current) => {
            const map = new Map<string, StockMovement>();
            current.forEach((m) => {
              if (!deletedIdsRef.current.has(m.id)) map.set(m.id, m);
            });
            let changes = false;
            res.deltas.movements.forEach((remote) => {
              if (deletedIdsRef.current.has(remote.id)) return;
              const existing = map.get(remote.id);
              if (!existing || JSON.stringify(existing) !== JSON.stringify(remote)) {
                map.set(remote.id, remote);
                changes = true;
              }
            });
            if (changes) {
              const merged = Array.from(map.values()).sort(
                (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              );
              try {
                localStorage.setItem('win_inv_movements', JSON.stringify(merged));
              } catch {}
              return merged;
            }
            return current;
          });
        }

        if (!isSilent) {
          if (res.summary.totalChangesFound > 0) {
            if (settings.enableSoundEffects) sound.playSuccessChime();
            setDeltaSyncToast(`Reconciled ${res.summary.totalChangesFound} updated cloud record(s)`);
          } else {
            if (settings.enableSoundEffects) sound.playScanBeep();
            setDeltaSyncToast('Firebase: Up to date (0 delta changes)');
          }
          setTimeout(() => setDeltaSyncToast(null), 3000);
        }
      } catch (err: any) {
        console.warn('[Firestore] Delta check error:', err);
        if (!isSilent) {
          setDeltaSyncToast('Firebase delta check offline or unavailable');
          setTimeout(() => setDeltaSyncToast(null), 3000);
        }
      } finally {
        setIsDeltaSyncing(false);
      }
    },
    [isDeltaSyncing, lastSyncTime, currentUser, settings.enableSoundEffects]
  );

  // --- 5-Minute Smart Delta Background Interval ---
  useEffect(() => {
    // Initial verification 2.5 seconds after mount
    const bootTimer = setTimeout(() => {
      handleTriggerDeltaSync(true);
    }, 2500);

    // Periodic 5-minute timer (300,000 ms)
    const intervalTimer = setInterval(() => {
      handleTriggerDeltaSync(true);
    }, DELTA_SYNC_INTERVAL_MS);

    // Recheck deltas when tab regains focus or visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const last = localStorage.getItem(LAST_SYNC_CHECK_STORAGE_KEY);
        if (last) {
          const elapsed = Date.now() - new Date(last).getTime();
          // If more than 2 minutes have elapsed since last check, run delta check immediately
          if (elapsed > 2 * 60 * 1000) {
            handleTriggerDeltaSync(true);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearTimeout(bootTimer);
      clearInterval(intervalTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [handleTriggerDeltaSync]);

  // --- UI Navigation & State ---
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);

  const [isStockAdjustOpen, setIsStockAdjustOpen] = useState(false);
  const [adjustTargetItem, setAdjustTargetItem] = useState<InventoryItem | null>(null);
  const [adjustDirection, setAdjustDirection] = useState<'in' | 'out'>('in');

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedReceiptForPrint, setSelectedReceiptForPrint] = useState<ReceiptData | null>(null);
  const [isPOSModalOpen, setIsPOSModalOpen] = useState(false);
  const [isCrateReturnModalOpen, setIsCrateReturnModalOpen] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDevPasswordOpen, setIsDevPasswordOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<AppUser | null>(null);
  const [selectedItemForBarcode, setSelectedItemForBarcode] = useState<InventoryItem | null>(null);
  const [isAndroidModeActive, setIsAndroidModeActive] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'android' || params.get('mode') === 'mobile') {
        return true;
      }
    }
    return false;
  });

  const handleOpenChangePassword = (target?: AppUser) => {
    setPasswordTargetUser(target || currentUser);
    setIsChangePasswordOpen(true);
  };

  const handleSavePassword = (userId: string, newPass: string) => {
    const updatedUsers = usersRef.current.map((u) =>
      u.id === userId ? { ...u, pin: newPass } : u
    );
    usersRef.current = updatedUsers;
    setUsers(updatedUsers);
    const changedUser = updatedUsers.find((u) => u.id === userId);
    if (changedUser) {
      saveUserToFirestore(changedUser).catch(() => {});
    }
    if (currentUser?.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, pin: newPass } : null));
    }
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  // Categories list derived from current items
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [items]);

  // Badge calculations
  const lowStockCount = useMemo(() => {
    return items.filter((i) => i.quantity <= i.minQuantity).length;
  }, [items]);

  const pendingPOCount = useMemo(() => {
    return orders.filter((o) => o.status === 'ordered').length;
  }, [orders]);

  // --- Item Handlers ---
  const handleSaveItem = (savedItem: InventoryItem) => {
    const itemToPersist: InventoryItem = {
      ...savedItem,
      updatedAt: savedItem.updatedAt || new Date().toISOString(),
    };
    const currentItems = itemsRef.current;
    const existingIndex = currentItems.findIndex((i) => i.id === itemToPersist.id);
    if (existingIndex >= 0) {
      const nextItems = currentItems.map((i) => (i.id === itemToPersist.id ? itemToPersist : i));
      itemsRef.current = nextItems;
      setItems(nextItems);
    } else {
      if (!isAdmin) {
        setDeltaSyncToast('Permission Denied: Only Administrators can create new inventory items.');
        setTimeout(() => setDeltaSyncToast(null), 3500);
        return;
      }
      const nextItems = [itemToPersist, ...currentItems];
      itemsRef.current = nextItems;
      setItems(nextItems);
      // Log initial movement
      if (itemToPersist.quantity > 0) {
        const initialMov: StockMovement = {
          id: 'mov_' + Math.random().toString(36).substring(2, 9),
          itemId: itemToPersist.id,
          itemSku: itemToPersist.sku,
          itemName: itemToPersist.name,
          type: 'in_adjustment',
          quantityDelta: itemToPersist.quantity,
          previousQuantity: 0,
          newQuantity: itemToPersist.quantity,
          unitCost: itemToPersist.unitCost,
          timestamp: new Date().toISOString(),
          operator: currentUser ? `${currentUser.name} (${currentUser.role})` : 'System Admin',
          reason: 'Initial stock intake on catalog creation',
        };
        setMovements((prev) => [initialMov, ...prev]);
        saveMovementToFirestore(initialMov).catch(() => {});
      }
    }

    // Persist to Cloud Firestore
    saveItemToFirestore(itemToPersist).catch((err) => {
      console.warn('[Firestore] Sync save error:', err);
    });

    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleDeleteItem = (itemId: string) => {
    markIdDeleted(itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    deleteItemFromFirestore(itemId).catch((err) => {
      console.warn('[Firestore] Sync delete error:', err);
    });
  };

  const handleBatchDelete = (itemIds: string[]) => {
    itemIds.forEach((id) => markIdDeleted(id));
    const set = new Set(itemIds);
    setItems((prev) => prev.filter((i) => !set.has(i.id)));
    itemIds.forEach((id) => {
      deleteItemFromFirestore(id).catch(() => {});
    });
  };

  // --- Stock Movement / Ledger Deletion ---
  const handleDeleteMovement = (movementId: string) => {
    markIdDeleted(movementId);
    setMovements((prev) => prev.filter((m) => m.id !== movementId));
    deleteMovementFromFirestore(movementId).catch(() => {});
  };

  // --- Receipt Deletion ---
  const handleDeleteReceipt = (receiptId: string) => {
    markIdDeleted(receiptId);
    const nextReceipts = receiptsRef.current.filter((r) => r.id !== receiptId);
    receiptsRef.current = nextReceipts;
    setReceipts(nextReceipts);
    deleteReceiptFromFirestore(receiptId).catch(() => {});
  };

  // --- Daily Expense Handlers ---
  const handleAddExpense = (newExpData: Omit<DailyExpense, 'id' | 'createdAt'>) => {
    const id = 'exp_' + Math.random().toString(36).substring(2, 9);
    const newExpense: DailyExpense = {
      ...newExpData,
      id,
      createdAt: new Date().toISOString(),
    };
    setExpenses((prev) => [newExpense, ...prev]);
    saveExpenseToFirestore(newExpense);
    sound.playSuccessChime();
  };

  const handleDeleteExpense = (expenseId: string) => {
    markIdDeleted(expenseId);
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId));
    deleteExpenseFromFirestore(expenseId);
  };

  // --- Bank Deposit Handlers ---
  const handleAddDeposit = (newDepData: Omit<BankDeposit, 'id' | 'createdAt'>) => {
    const id = 'dep_' + Math.random().toString(36).substring(2, 9);
    const newDeposit: BankDeposit = {
      ...newDepData,
      id,
      createdAt: new Date().toISOString(),
    };
    setBankDeposits((prev) => [newDeposit, ...prev]);
    saveDepositToFirestore(newDeposit);
    sound.playSuccessChime();
  };

  const handleDeleteDeposit = (depositId: string) => {
    markIdDeleted(depositId);
    setBankDeposits((prev) => prev.filter((d) => d.id !== depositId));
    deleteDepositFromFirestore(depositId);
  };

  // --- Credit Customer Debt Repayment Handlers (Strictly debt recovery, no tips) ---
  const handleAddCreditPayment = (newPayData: Omit<CreditCustomerPayment, 'id' | 'createdAt'>) => {
    const id = 'cr_pay_' + Math.random().toString(36).substring(2, 9);
    const newPayment: CreditCustomerPayment = {
      ...newPayData,
      id,
      createdAt: new Date().toISOString(),
    };

    setCreditPayments((prev) => {
      const updated = [newPayment, ...prev];
      try {
        localStorage.setItem('win_inv_credit_payments', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    saveCreditPaymentToFirestore(newPayment);

    // If linked to a credit receipt, update that receipt's amountPaid and remaining balanceDue
    if (newPayData.receiptId) {
      const nowIso = new Date().toISOString();
      let updatedLinkedReceipt: ReceiptData | null = null;
      const updatedReceipts = receiptsRef.current.map((r) => {
        if (r.id === newPayData.receiptId) {
          const prevPaid = Number(r.amountPaid || 0);
          const newPaid = prevPaid + newPayData.amount;
          const prevBalance = r.balanceDue !== undefined ? Number(r.balanceDue) : Number(r.grandTotal);
          const newBalance = Math.max(0, prevBalance - newPayData.amount);
          updatedLinkedReceipt = {
            ...r,
            amountPaid: newPaid,
            balanceDue: newBalance,
            updatedAt: nowIso,
          };
          return updatedLinkedReceipt;
        }
        return r;
      });
      receiptsRef.current = updatedReceipts;
      setReceipts(updatedReceipts);
      try {
        localStorage.setItem('win_inv_receipts', JSON.stringify(updatedReceipts));
      } catch {}
      if (updatedLinkedReceipt) {
        saveReceiptToFirestore(updatedLinkedReceipt).catch(() => {});
      }
    }

    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleDeleteCreditPayment = (paymentId: string) => {
    markIdDeleted(paymentId);
    const target = creditPayments.find((p) => p.id === paymentId);

    setCreditPayments((prev) => {
      const updated = prev.filter((p) => p.id !== paymentId);
      try {
        localStorage.setItem('win_inv_credit_payments', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    deleteCreditPaymentFromFirestore(paymentId);

    // If payment was linked to a receipt, revert the balance due
    if (target?.receiptId) {
      const nowIso = new Date().toISOString();
      let updatedLinkedReceipt: ReceiptData | null = null;
      const updatedReceipts = receiptsRef.current.map((r) => {
        if (r.id === target.receiptId) {
          const prevPaid = Number(r.amountPaid || 0);
          const newPaid = Math.max(0, prevPaid - target.amount);
          const prevBalance = r.balanceDue !== undefined ? Number(r.balanceDue) : 0;
          const newBalance = prevBalance + target.amount;
          updatedLinkedReceipt = {
            ...r,
            amountPaid: newPaid,
            balanceDue: newBalance,
            updatedAt: nowIso,
          };
          return updatedLinkedReceipt;
        }
        return r;
      });
      receiptsRef.current = updatedReceipts;
      setReceipts(updatedReceipts);
      try {
        localStorage.setItem('win_inv_receipts', JSON.stringify(updatedReceipts));
      } catch {}
      if (updatedLinkedReceipt) {
        saveReceiptToFirestore(updatedLinkedReceipt).catch(() => {});
      }
    }

    if (settings.enableSoundEffects) {
      sound.playAlertSound();
    }
  };

  // --- Empty Bottles & Crate Returns Handlers ---
  const handleSaveCrateReturn = (newReturnData: Omit<CrateReturn, 'id' | 'createdAt'>) => {
    const id = 'crt_' + Math.random().toString(36).substring(2, 9);
    const newReturn: CrateReturn = {
      ...newReturnData,
      id,
      createdAt: new Date().toISOString(),
    };
    setCrateReturns((prev) => [newReturn, ...prev]);
    saveCrateReturnToFirestore(newReturn);
  };

  const handleDeleteCrateReturn = (returnId: string) => {
    markIdDeleted(returnId);
    setCrateReturns((prev) => {
      const updated = prev.filter((r) => r.id !== returnId);
      try {
        localStorage.setItem('win_inv_crate_returns', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    deleteCrateReturnFromFirestore(returnId);
    if (settings.enableSoundEffects) {
      sound.playAlertSound();
    }
  };

  // --- Field Sales Rep Dispatch Handlers ---
  const handleCreateDispatch = (
    dispatchData: Omit<SalesRepDispatch, 'id' | 'createdAt' | 'updatedAt'>,
    deductStockImmediate: boolean
  ) => {
    const id = 'dsp_' + Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();
    const newDispatch: SalesRepDispatch = {
      ...dispatchData,
      id,
      deductedStockImmediate: deductStockImmediate,
      createdAt: now,
      updatedAt: now,
    };

    setSalesRepDispatches((prev) => [newDispatch, ...prev]);
    saveDispatchToFirestore(newDispatch);

    // If stock deduction was requested upon dispatch
    if (deductStockImmediate) {
      const productMap = new Map<string, number>();
      newDispatch.items.forEach((line) => {
        productMap.set(line.itemId, (productMap.get(line.itemId) || 0) + line.quantityTaken);
      });

      const newMovements: StockMovement[] = [];
      const affectedItems: InventoryItem[] = [];
      const nextItems = itemsRef.current.map((item) => {
        const qtyToDeduct = productMap.get(item.id);
        if (qtyToDeduct && qtyToDeduct > 0) {
          const prevQty = item.quantity;
          const newQty = Math.max(0, prevQty - qtyToDeduct);
          const mov: StockMovement = {
            id: 'mov_' + Math.random().toString(36).substring(2, 9),
            itemId: item.id,
            itemSku: item.sku,
            itemName: item.name,
            type: 'out_sale',
            quantityDelta: -(prevQty - newQty),
            previousQuantity: prevQty,
            newQuantity: newQty,
            unitCost: item.unitCost,
            timestamp: now,
            operator: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Sales Rep Dispatcher',
            reason: `Field Stock Dispatch #${newDispatch.dispatchNumber} to Rep: ${newDispatch.repName}`,
          };
          newMovements.push(mov);
          const updatedItem: InventoryItem = { ...item, quantity: newQty, updatedAt: now };
          affectedItems.push(updatedItem);
          return updatedItem;
        }
        return item;
      });

      itemsRef.current = nextItems;
      setItems(nextItems);

      if (newMovements.length > 0) {
        setMovements((prev) => [...newMovements, ...prev]);
        newMovements.forEach((mov) => {
          saveMovementToFirestore(mov).catch(() => {});
        });
      }
      if (affectedItems.length > 0) {
        saveItemsBatchToFirestore(affectedItems).catch((err) => {
          console.warn('[Firestore] Dispatch stock deduction sync error:', err);
        });
      }
    }

    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleReconcileDispatch = (
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
    restoreUnsoldStock: boolean
  ) => {
    const existingDispatch = salesRepDispatches.find((d) => d.id === dispatchId);
    if (!existingDispatch || existingDispatch.status === 'reconciled') {
      return;
    }

    const now = new Date().toISOString();
    const targetDispatch: SalesRepDispatch = {
      ...existingDispatch,
      ...reconciliationData,
      status: 'reconciled',
      updatedAt: now,
    };

    setSalesRepDispatches((prev) =>
      prev.map((d) => (d.id === dispatchId ? targetDispatch : d))
    );
    saveDispatchToFirestore(targetDispatch);

    // If unsold stock should be restored to inventory
    if (restoreUnsoldStock && targetDispatch.items) {
      const returnMap = new Map<string, number>();
      targetDispatch.items.forEach((line) => {
        if (line.quantityReturned && line.quantityReturned > 0) {
          returnMap.set(line.itemId, (returnMap.get(line.itemId) || 0) + line.quantityReturned);
        }
      });

      if (returnMap.size > 0) {
        const restoreMovements: StockMovement[] = [];
        const restoredItems: InventoryItem[] = [];
        const nextItems = itemsRef.current.map((item) => {
          const qtyToRestore = returnMap.get(item.id);
          if (qtyToRestore && qtyToRestore > 0) {
            const prevQty = item.quantity;
            const newQty = prevQty + qtyToRestore;
            const mov: StockMovement = {
              id: 'mov_' + Math.random().toString(36).substring(2, 9),
              itemId: item.id,
              itemSku: item.sku,
              itemName: item.name,
              type: 'in_adjustment',
              quantityDelta: qtyToRestore,
              previousQuantity: prevQty,
              newQuantity: newQty,
              unitCost: item.unitCost,
              timestamp: now,
              operator: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Sales Rep Auditor',
              reason: `Unsold stock return from Rep: ${targetDispatch.repName} (Dispatch #${targetDispatch.dispatchNumber})`,
            };
            restoreMovements.push(mov);
            const updatedItem: InventoryItem = { ...item, quantity: newQty, updatedAt: now };
            restoredItems.push(updatedItem);
            return updatedItem;
          }
          return item;
        });

        itemsRef.current = nextItems;
        setItems(nextItems);

        if (restoreMovements.length > 0) {
          setMovements((prev) => [...restoreMovements, ...prev]);
          restoreMovements.forEach((mov) => {
            saveMovementToFirestore(mov).catch(() => {});
          });
        }
        if (restoredItems.length > 0) {
          saveItemsBatchToFirestore(restoredItems).catch((err) => {
            console.warn('[Firestore] Dispatch restore stock sync error:', err);
          });
        }
      }
    }

    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleDeleteDispatch = (dispatchId: string) => {
    markIdDeleted(dispatchId);
    setSalesRepDispatches((prev) => {
      const updated = prev.filter((d) => d.id !== dispatchId);
      try {
        localStorage.setItem('win_inv_sales_rep_dispatches', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    deleteDispatchFromFirestore(dispatchId);
    if (settings.enableSoundEffects) {
      sound.playAlertSound();
    }
  };

  // --- Team & RBAC User Handlers ---
  const handleAddUser = (userCandidate: Omit<AppUser, 'id' | 'createdAt'> | AppUser) => {
    const newUser: AppUser = {
      ...userCandidate,
      id: 'id' in userCandidate && userCandidate.id ? userCandidate.id : 'usr_' + Math.random().toString(36).substring(2, 9),
      createdAt: 'createdAt' in userCandidate && userCandidate.createdAt ? userCandidate.createdAt : new Date().toISOString(),
    };
    setUsers((prev) => [...prev, newUser]);
    saveUserToFirestore(newUser).catch(() => {});
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleUpdateUser = (updatedUser: AppUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    saveUserToFirestore(updatedUser).catch(() => {});
    if (currentUser?.id === updatedUser.id) {
      setCurrentUser(updatedUser.status === 'inactive' ? null : updatedUser);
    }
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleDeleteUser = (userId: string) => {
    markIdDeleted(userId);
    deleteUserFromFirestore(userId).catch(() => {});
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    if (currentUser?.id === userId) {
      setCurrentUser(null);
    }
    if (settings.enableSoundEffects) {
      sound.playAlertSound();
    }
  };

  const handleSwitchCurrentUser = (user: AppUser) => {
    setCurrentUser(user);
    if (settings.enableSoundEffects) {
      sound.playScanBeep();
    }
  };

  const handleSignIn = (user: AppUser) => {
    setCurrentUser(user);
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    if (settings.enableSoundEffects) {
      sound.playScanBeep();
    }
  };

  // --- Stock Adjustment & Ledger Movement ---
  const handleOpenStockAdjust = (item: InventoryItem, dir: 'in' | 'out') => {
    setAdjustTargetItem(item);
    setAdjustDirection(dir);
    setIsStockAdjustOpen(true);
  };

  const handleCreateNewReceipt = (newReceipt: ReceiptData) => {
    const now = new Date().toISOString();
    const receiptToSave: ReceiptData = {
      ...newReceipt,
      updatedAt: newReceipt.updatedAt || now,
    };
    const nextReceipts = [receiptToSave, ...receiptsRef.current];
    receiptsRef.current = nextReceipts;
    setReceipts(nextReceipts);
    saveReceiptToFirestore(receiptToSave).catch(() => {});
    const workingItems = itemsRef.current.map((i) => ({ ...i }));
    const updatedItemsMap = new Map<string, InventoryItem>();
    const newMovements: StockMovement[] = [];

    // Deduct stock sequentially across all receipt lines and persist to Firestore
    newReceipt.items.forEach((line) => {
      const targetIndex = workingItems.findIndex(
        (i) => (line.itemId && i.id === line.itemId) || i.sku === line.sku
      );
      if (targetIndex >= 0) {
        const targetItem = workingItems[targetIndex];
        const prevQty = targetItem.quantity;
        const actualDeducted = Math.min(prevQty, Math.max(0, line.quantity));
        const newQty = Math.max(0, prevQty - line.quantity);
        const updatedItem: InventoryItem = {
          ...targetItem,
          quantity: newQty,
          updatedAt: now,
        };
        workingItems[targetIndex] = updatedItem;
        updatedItemsMap.set(updatedItem.id, updatedItem);

        const mov: StockMovement = {
          id: 'mov_' + Math.random().toString(36).substring(2, 9),
          itemId: updatedItem.id,
          itemSku: updatedItem.sku,
          itemName: updatedItem.name,
          type: 'out_sale',
          quantityDelta: -actualDeducted,
          previousQuantity: prevQty,
          newQuantity: newQty,
          unitCost: updatedItem.unitCost,
          timestamp: newReceipt.date || now,
          referenceNumber: newReceipt.receiptNumber,
          operator: newReceipt.operator,
          reason: `POS Sale Receipt #${newReceipt.receiptNumber} (${newReceipt.paymentMethod})`,
        };
        newMovements.push(mov);
      }
    });

    if (updatedItemsMap.size > 0) {
      itemsRef.current = workingItems;
      setItems(workingItems);
      saveItemsBatchToFirestore(Array.from(updatedItemsMap.values())).catch((err) => {
        console.warn('[Firestore] POS receipt stock deduction sync error:', err);
      });
    }

    if (newMovements.length > 0) {
      setMovements((prev) => [...newMovements, ...prev]);
      newMovements.forEach((mov) => {
        saveMovementToFirestore(mov).catch(() => {});
      });
    }

    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handlePrintReceiptFromMovement = (mov: StockMovement) => {
    const isOut = mov.quantityDelta < 0;
    const qty = Math.abs(mov.quantityDelta);
    const item = items.find((i) => i.id === mov.itemId || i.sku === mov.itemSku);
    const pricing = item ? getItemPricing(item) : null;
    const unitPrice = item ? (isOut ? (pricing?.effectivePrice ?? item.retailPrice) : item.unitCost) : 0;
    const subtotal = qty * unitPrice;
    const vatRate = settings.defaultVatRate ?? 7.5;
    const vatAmount = subtotal * (vatRate / 100);
    const grandTotal = subtotal + vatAmount;

    const receipt: ReceiptData = {
      id: 'rec_mov_' + mov.id,
      receiptNumber: mov.referenceNumber || `SLIP-${mov.id.slice(-6).toUpperCase()}`,
      date: mov.timestamp,
      type: isOut ? 'sale' : 'inbound',
      companyName: settings.companyName,
      companyAddress: settings.companyAddress,
      companyPhone: settings.companyPhone,
      companyEmail: settings.companyEmail,
      taxId: settings.taxId,
      customerName: isOut ? 'Counter Customer / Dispatch' : 'Inbound Supplier Intake',
      operator: mov.operator,
      paymentMethod: isOut ? 'Cash' : 'Bank Transfer',
      items: [
        {
          itemId: mov.itemId,
          sku: mov.itemSku,
          name: mov.itemName,
          quantity: qty,
          unitPrice: unitPrice,
          regularPrice: pricing?.wholesalePrice,
          isPromo: Boolean(isOut && pricing?.isPromoActive),
          unit: item?.unit || 'pcs',
          total: subtotal,
        },
      ],
      subtotal: subtotal,
      taxRate: vatRate,
      taxAmount: vatAmount,
      discount: 0,
      grandTotal: grandTotal,
      amountPaid: grandTotal,
      changeDue: 0,
      notes: mov.reason || settings.receiptFooterNote || 'Official Inventory & Movement Voucher',
    };

    setSelectedReceiptForPrint(receipt);
    setIsReceiptModalOpen(true);
  };

  const handleConfirmStockAdjust = (
    item: InventoryItem,
    delta: number,
    type: MovementType,
    operator: string,
    referenceNumber: string,
    reason: string,
    printReceipt?: boolean
  ) => {
    const now = new Date().toISOString();
    const liveItem = itemsRef.current.find((i) => i.id === item.id) || item;
    const prevQty = liveItem.quantity;
    const newQty = Math.max(0, prevQty + delta);

    const updatedItem: InventoryItem = {
      ...liveItem,
      quantity: newQty,
      lastRestocked: delta > 0 ? now.split('T')[0] : liveItem.lastRestocked,
      updatedAt: now,
    };

    const nextItems = itemsRef.current.map((i) => (i.id === updatedItem.id ? updatedItem : i));
    itemsRef.current = nextItems;
    setItems(nextItems);

    // Append to immutable Ledger
    const newMov: StockMovement = {
      id: 'mov_' + Math.random().toString(36).substring(2, 9),
      itemId: updatedItem.id,
      itemSku: updatedItem.sku,
      itemName: updatedItem.name,
      type: type,
      quantityDelta: delta < 0 ? -(prevQty - newQty) : delta,
      previousQuantity: prevQty,
      newQuantity: newQty,
      unitCost: updatedItem.unitCost,
      timestamp: now,
      referenceNumber: referenceNumber || undefined,
      operator: operator,
      reason: reason || undefined,
    };
    setMovements((prev) => [newMov, ...prev]);

    // Persist adjustment & ledger entry to Cloud Firestore
    saveItemToFirestore(updatedItem).catch((err) => {
      console.warn('[Firestore] Stock adjustment sync error:', err);
    });
    saveMovementToFirestore(newMov).catch(() => {});

    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }

    if (printReceipt) {
      handlePrintReceiptFromMovement(newMov);
    }
  };

  // --- Purchase Orders Handlers ---
  const handleCreatePO = (po: PurchaseOrder) => {
    const now = new Date().toISOString();
    const poToSave: PurchaseOrder = { ...po, updatedAt: po.updatedAt || now };
    const nextOrders = [poToSave, ...ordersRef.current];
    ordersRef.current = nextOrders;
    setOrders(nextOrders);
    savePurchaseOrderToFirestore(poToSave).catch(() => {});
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleReceivePO = (poId: string) => {
    const po = ordersRef.current.find((o) => o.id === poId);
    if (!po || po.status === 'received') return;

    const now = new Date().toISOString();
    const todayDate = now.split('T')[0];

    // Increment inventory immutably for each item in PO
    const newMovements: StockMovement[] = [];
    const updatedItemsMap = new Map<string, InventoryItem>();
    const itemMap = new Map<string, InventoryItem>(
      itemsRef.current.map((i) => [i.id, { ...i }])
    );

    po.items.forEach((poItem) => {
      const existing = itemMap.get(poItem.itemId);
      if (existing) {
        const prevQty = existing.quantity;
        const newQty = prevQty + poItem.quantity;
        const updatedItem: InventoryItem = {
          ...existing,
          quantity: newQty,
          lastRestocked: todayDate,
          updatedAt: now,
        };
        itemMap.set(existing.id, updatedItem);
        updatedItemsMap.set(existing.id, updatedItem);

        newMovements.push({
          id: 'mov_' + Math.random().toString(36).substring(2, 9),
          itemId: updatedItem.id,
          itemSku: updatedItem.sku,
          itemName: updatedItem.name,
          type: 'in_purchase',
          quantityDelta: poItem.quantity,
          previousQuantity: prevQty,
          newQuantity: newQty,
          unitCost: poItem.unitCost,
          timestamp: now,
          referenceNumber: po.poNumber,
          operator: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Receiving Team',
          reason: `Shipment received from ${po.supplierName}`,
        });
      }
    });

    const receivedPO: PurchaseOrder = {
      ...po,
      status: 'received',
      receivedDate: todayDate,
      updatedAt: now,
    };

    const nextItems = Array.from(itemMap.values());
    itemsRef.current = nextItems;
    setItems(nextItems);
    setMovements((prev) => [...newMovements, ...prev]);

    const nextOrders = ordersRef.current.map((o) => (o.id === poId ? receivedPO : o));
    ordersRef.current = nextOrders;
    setOrders(nextOrders);

    // Persist PO status & restock changes to Cloud Firestore
    savePurchaseOrderToFirestore(receivedPO).catch(() => {});
    if (updatedItemsMap.size > 0) {
      saveItemsBatchToFirestore(Array.from(updatedItemsMap.values())).catch((err) => {
        console.warn('[Firestore] PO receive stock sync error:', err);
      });
    }
    newMovements.forEach((mov) => {
      saveMovementToFirestore(mov).catch(() => {});
    });

    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleCancelPO = (poId: string) => {
    const existing = ordersRef.current.find((o) => o.id === poId);
    if (!existing) return;
    const cancelledPO: PurchaseOrder = {
      ...existing,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    };
    const nextOrders = ordersRef.current.map((o) => (o.id === poId ? cancelledPO : o));
    ordersRef.current = nextOrders;
    setOrders(nextOrders);
    savePurchaseOrderToFirestore(cancelledPO).catch(() => {});
  };

  const handleDeletePO = (poId: string) => {
    markIdDeleted(poId);
    const updated = ordersRef.current.filter((o) => o.id !== poId);
    ordersRef.current = updated;
    setOrders(updated);
    try {
      localStorage.setItem('win_inv_orders', JSON.stringify(updated));
    } catch {}
    deletePurchaseOrderFromFirestore(poId).catch(() => {});
    if (settings.enableSoundEffects) {
      sound.playAlertSound();
    }
  };

  // --- Suppliers Handlers ---
  const handleAddSupplier = (sup: Supplier) => {
    const supToSave: Supplier = { ...sup, updatedAt: sup.updatedAt || new Date().toISOString() };
    const nextSuppliers = [supToSave, ...suppliersRef.current];
    suppliersRef.current = nextSuppliers;
    setSuppliers(nextSuppliers);
    saveSupplierToFirestore(supToSave).catch(() => {});
  };

  const handleEditSupplier = (sup: Supplier) => {
    const supToSave: Supplier = { ...sup, updatedAt: new Date().toISOString() };
    const nextSuppliers = suppliersRef.current.map((s) => (s.id === supToSave.id ? supToSave : s));
    suppliersRef.current = nextSuppliers;
    setSuppliers(nextSuppliers);
    saveSupplierToFirestore(supToSave).catch(() => {});
  };

  const handleDeleteSupplier = (id: string) => {
    markIdDeleted(id);
    const nextSuppliers = suppliersRef.current.filter((s) => s.id !== id);
    suppliersRef.current = nextSuppliers;
    setSuppliers(nextSuppliers);
    deleteSupplierFromFirestore(id).catch(() => {});
  };

  // --- Settings & Presets Handlers ---
  const handleLoadPreset = (preset: IndustryPreset) => {
    const now = new Date().toISOString();
    const stamped = preset.sampleItems.map((it) => ({ ...it, updatedAt: now }));
    itemsRef.current = stamped;
    setItems(stamped);
    setMovements([]);
    saveItemsBatchToFirestore(stamped).catch(() => {});
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleImportCSVItems = (imported: InventoryItem[]) => {
    const now = new Date().toISOString();
    const stamped = imported.map((it) => ({ ...it, updatedAt: it.updatedAt || now }));
    const nextItems = [...stamped, ...itemsRef.current];
    itemsRef.current = nextItems;
    setItems(nextItems);
    saveItemsBatchToFirestore(stamped).catch(() => {});
  };

  const handleExportJSONBackup = () => {
    const backupData = {
      items,
      movements,
      suppliers,
      orders,
      receipts,
      expenses,
      bankDeposits,
      salesRepDispatches,
      creditPayments,
      crateReturns,
      users,
      settings,
      backupDate: new Date().toISOString(),
      version: '1.4',
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreJSONBackup = (data: {
    items?: InventoryItem[];
    movements?: StockMovement[];
    suppliers?: Supplier[];
    orders?: PurchaseOrder[];
    receipts?: ReceiptData[];
    expenses?: DailyExpense[];
    bankDeposits?: BankDeposit[];
    salesRepDispatches?: SalesRepDispatch[];
    creditPayments?: CreditCustomerPayment[];
    crateReturns?: CrateReturn[];
    users?: AppUser[];
    settings?: AppSettings;
  }) => {
    if (data.items) {
      const now = new Date().toISOString();
      const stamped = data.items.map((it) => ({ ...it, updatedAt: now }));
      itemsRef.current = stamped;
      setItems(stamped);
      saveItemsBatchToFirestore(stamped).catch(() => {});
    }
    if (data.movements) {
      setMovements(data.movements);
      uploadAllMovementsToFirestore(data.movements).catch(() => {});
    }
    if (data.suppliers) {
      const now = new Date().toISOString();
      const stampedSuppliers = data.suppliers.map((s) => ({ ...s, updatedAt: s.updatedAt || now }));
      suppliersRef.current = stampedSuppliers;
      setSuppliers(stampedSuppliers);
      uploadAllSuppliersToFirestore(stampedSuppliers).catch(() => {});
    }
    if (data.orders) {
      const now = new Date().toISOString();
      const stampedOrders = data.orders.map((o) => ({ ...o, updatedAt: o.updatedAt || now }));
      ordersRef.current = stampedOrders;
      setOrders(stampedOrders);
      uploadAllPurchaseOrdersToFirestore(stampedOrders).catch(() => {});
    }
    if (data.receipts) {
      const now = new Date().toISOString();
      const stampedReceipts = data.receipts.map((r) => ({ ...r, updatedAt: r.updatedAt || now }));
      receiptsRef.current = stampedReceipts;
      setReceipts(stampedReceipts);
      uploadAllReceiptsToFirestore(stampedReceipts).catch(() => {});
    }
    if (data.expenses) {
      setExpenses(data.expenses);
      data.expenses.forEach((exp) => {
        saveExpenseToFirestore(exp).catch(() => {});
      });
    }
    if (data.bankDeposits) {
      setBankDeposits(data.bankDeposits);
      data.bankDeposits.forEach((dep) => {
        saveDepositToFirestore(dep).catch(() => {});
      });
    }
    if (data.salesRepDispatches) {
      setSalesRepDispatches(data.salesRepDispatches);
      data.salesRepDispatches.forEach((dsp) => {
        saveDispatchToFirestore(dsp).catch(() => {});
      });
    }
    if (data.creditPayments) {
      setCreditPayments(data.creditPayments);
      data.creditPayments.forEach((pay) => {
        saveCreditPaymentToFirestore(pay).catch(() => {});
      });
    }
    if (data.crateReturns) {
      setCrateReturns(data.crateReturns);
      data.crateReturns.forEach((crt) => {
        saveCrateReturnToFirestore(crt).catch(() => {});
      });
    }
    if (data.users) {
      const cleanedUsers = data.users.filter((u) => !MOCK_USER_IDS.includes(u.id));
      const finalUsers = cleanedUsers.length > 0 ? cleanedUsers : defaultUsers;
      usersRef.current = finalUsers;
      setUsers(finalUsers);
      uploadAllUsersToFirestore(finalUsers).catch(() => {});
    }
    if (data.settings) {
      const stampedSettings: AppSettings = { ...data.settings, updatedAt: new Date().toISOString() };
      settingsRef.current = stampedSettings;
      setSettings(stampedSettings);
      saveStoreSettingsToFirestore(stampedSettings).catch(() => {});
    }
  };

  const handleResetAllData = () => {
    itemsRef.current = [];
    setItems([]);
    setMovements([]);
    setSuppliers([]);
    setOrders([]);
    setReceipts([]);
    setExpenses([]);
    setBankDeposits([]);
    setSalesRepDispatches([]);
    setCreditPayments([]);
    setCrateReturns([]);
    setUsers(defaultUsers);
    setSettings(initialSettings);
    setCurrentUser(defaultUsers[0] || null);
    localStorage.clear();
  };

  // --- Cloud Backup Handlers (Daily / Weekly / Monthly / Manual) ---
  const handleUpdateCloudSchedule = (updates: Partial<CloudBackupSchedule>) => {
    setCloudSchedule((prev) => {
      const merged = { ...prev, ...updates };
      merged.nextScheduledDate = calculateNextBackupDate(
        merged.frequency,
        merged.timeOfDay,
        merged.dayOfWeek,
        merged.dayOfMonth
      );
      return merged;
    });
  };

  const handleTriggerCloudBackup = async (
    type: CloudBackupFrequency = 'manual',
    notes?: string
  ): Promise<CloudBackupSnapshot> => {
    const snapshot = createCloudSnapshotPayload(
      type,
      currentUser,
      {
        items,
        movements,
        suppliers,
        purchaseOrders: orders,
        receipts,
        users,
        settings,
      },
      notes
    );

    setCloudSnapshots((prev) => [snapshot, ...prev]);
    setCloudSchedule((prev) => ({
      ...prev,
      lastBackupDate: snapshot.timestamp,
      nextScheduledDate: calculateNextBackupDate(
        prev.frequency,
        prev.timeOfDay,
        prev.dayOfWeek,
        prev.dayOfMonth
      ),
    }));

    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
    return snapshot;
  };

  const handleRestoreCloudSnapshot = (snapshot: CloudBackupSnapshot) => {
    if (snapshot.payloadData) {
      if (snapshot.payloadData.items) {
        const now = new Date().toISOString();
        const stamped = snapshot.payloadData.items.map((it) => ({ ...it, updatedAt: now }));
        itemsRef.current = stamped;
        setItems(stamped);
        saveItemsBatchToFirestore(stamped).catch(() => {});
      }
      if (snapshot.payloadData.movements) {
        setMovements(snapshot.payloadData.movements);
        uploadAllMovementsToFirestore(snapshot.payloadData.movements).catch(() => {});
      }
      if (snapshot.payloadData.suppliers) {
        const now = new Date().toISOString();
        const stampedSuppliers = snapshot.payloadData.suppliers.map((s) => ({ ...s, updatedAt: s.updatedAt || now }));
        suppliersRef.current = stampedSuppliers;
        setSuppliers(stampedSuppliers);
        uploadAllSuppliersToFirestore(stampedSuppliers).catch(() => {});
      }
      if (snapshot.payloadData.purchaseOrders) {
        const now = new Date().toISOString();
        const stampedOrders = snapshot.payloadData.purchaseOrders.map((o) => ({ ...o, updatedAt: o.updatedAt || now }));
        ordersRef.current = stampedOrders;
        setOrders(stampedOrders);
        uploadAllPurchaseOrdersToFirestore(stampedOrders).catch(() => {});
      }
      if (snapshot.payloadData.receipts) {
        const now = new Date().toISOString();
        const stampedReceipts = snapshot.payloadData.receipts.map((r) => ({ ...r, updatedAt: r.updatedAt || now }));
        receiptsRef.current = stampedReceipts;
        setReceipts(stampedReceipts);
        uploadAllReceiptsToFirestore(stampedReceipts).catch(() => {});
      }
      if (snapshot.payloadData.users) {
        const cleanedUsers = snapshot.payloadData.users.filter((u) => !MOCK_USER_IDS.includes(u.id));
        const finalUsers = cleanedUsers.length > 0 ? cleanedUsers : defaultUsers;
        usersRef.current = finalUsers;
        setUsers(finalUsers);
        uploadAllUsersToFirestore(finalUsers).catch(() => {});
      }
      if (snapshot.payloadData.settings) {
        const stampedSettings: AppSettings = { ...snapshot.payloadData.settings, updatedAt: new Date().toISOString() };
        settingsRef.current = stampedSettings;
        setSettings(stampedSettings);
        saveStoreSettingsToFirestore(stampedSettings).catch(() => {});
      }
    }
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleDeleteCloudSnapshot = (id: string) => {
    setCloudSnapshots((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      try {
        localStorage.setItem('win_inv_cloud_backups', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  // --- Global Keyboard Shortcuts ---
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't intercept when user is typing inside text inputs unless Ctrl is pressed
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'n' || e.key === 'N')
      ) {
        e.preventDefault();
        if (isAdmin) {
          setItemToEdit(null);
          setIsItemModalOpen(true);
        }
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'k' || e.key === 'K' || e.key === 'f' || e.key === 'F')
      ) {
        e.preventDefault();
        const searchEl = document.getElementById('titlebar-global-search');
        searchEl?.focus();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        exportInventoryToCSV(items);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setCurrentTab('barcode_studio');
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setIsScannerOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        handleSignOut();
      } else if (e.key === 'F3') {
        e.preventDefault();
        setIsPOSModalOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsItemModalOpen(false);
        setIsStockAdjustOpen(false);
        setIsScannerOpen(false);
        setIsSettingsOpen(false);
        setIsPOSModalOpen(false);
      }
    },
    [items]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // While hydrating remote staff directory on a brand-new device, show brief cloud sync loader
  if (isHydratingUsers && !currentUser) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 select-none">
        <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mb-4">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-sm font-semibold text-white tracking-tight">
          Connecting to Cloud Store...
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Syncing staff accounts and store configuration
        </p>
      </div>
    );
  }

  // If station is locked / signed out, render Auth Lock Screen
  if (!currentUser) {
    return (
      <AuthLockScreen
        users={users}
        settings={settings}
        onSignIn={handleSignIn}
      />
    );
  }

  // If in Android Mobile Mode (e.g. on smartphone or ?mode=android), render Android Mobile App View
  if (isAndroidModeActive) {
    return (
      <AndroidAppView
        items={items}
        settings={settings}
        currentUser={currentUser}
        onUpdateItem={handleSaveItem}
        onDeleteItem={handleDeleteItem}
        onSwitchToDesktop={() => {
          setIsAndroidModeActive(false);
          if (typeof window !== 'undefined' && window.history.pushState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('mode');
            window.history.pushState({}, '', url.toString());
          }
        }}
        lastSyncTime={lastSyncTime}
        isDeltaSyncing={isDeltaSyncing}
        onTriggerDeltaSync={() => handleTriggerDeltaSync(false)}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f4f4f4] dark:bg-[#1a1a1a] text-slate-900 dark:text-slate-100 overflow-hidden select-none font-sans">
      {/* 1. Windows 11 Native-Styled TitleBar with Mica blur */}
      <TitleBar
        settings={settings}
        onUpdateSettings={(s) => setSettings((prev) => ({ ...prev, ...s }))}
        currentUser={currentUser}
        onOpenTeamView={() => setCurrentTab('team')}
        onOpenChangePassword={() => handleOpenChangePassword()}
        onSignOut={handleSignOut}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenPOSRegister={() => setIsPOSModalOpen(true)}
        onRefreshData={() => handleTriggerDeltaSync(false)}
        isDeltaSyncing={isDeltaSyncing}
        lastSyncTime={lastSyncTime}
        deltaSyncToast={deltaSyncToast}
        onToggleMobileMenu={() => setIsMobileSidebarOpen((prev) => !prev)}
        isMobileMenuOpen={isMobileSidebarOpen}
      />

      {/* 2. Main Workstation Area: Sidebar + Active View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <NavigationSidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          lowStockCount={lowStockCount}
          pendingPOCount={pendingPOCount}
          totalItemsCount={items.length}
          receiptsCount={receipts.length}
          activeRepDispatchesCount={salesRepDispatches.filter((d) => d.status === 'active').length}
          currentUser={currentUser}
          settings={settings}
          onToggleTheme={handleToggleTheme}
          onSignOut={handleSignOut}
          onOpenAddItem={() => {
            setItemToEdit(null);
            setIsItemModalOpen(true);
          }}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenSettings={() => setIsDevPasswordOpen(true)}
          onOpenPOSRegister={() => setIsPOSModalOpen(true)}
          onOpenChangePassword={() => handleOpenChangePassword()}
          onOpenCrateReturn={() => setIsCrateReturnModalOpen(true)}
        />

        {/* View Router */}
        <main className="flex-1 overflow-hidden relative bg-[#f7f7f8] dark:bg-[#1e1e1e]">
          {currentTab === 'dashboard' && (
            <DashboardView
              items={items}
              movements={movements}
              receipts={receipts}
              expenses={expenses}
              bankDeposits={bankDeposits}
              salesRepDispatches={salesRepDispatches}
              creditPayments={creditPayments}
              settings={settings}
              isAdmin={isAdmin}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onOpenAddItem={() => {
                if (!isAdmin) return;
                setItemToEdit(null);
                setIsItemModalOpen(true);
              }}
              onOpenScanner={() => setIsScannerOpen(true)}
              onOpenQuickStockAdjust={(item, dir) => handleOpenStockAdjust(item, dir)}
              onExportCSV={() => exportInventoryToCSV(items)}
              onOpenCloudBackup={() => setIsDevPasswordOpen(true)}
              onOpenPOSRegister={() => setIsPOSModalOpen(true)}
            />
          )}

          {currentTab === 'inventory' && (
            <InventoryView
              items={items}
              settings={settings}
              searchQuery={searchQuery}
              isAdmin={isAdmin}
              onSearchChange={setSearchQuery}
              onAddItem={() => {
                setItemToEdit(null);
                setIsItemModalOpen(true);
              }}
              onEditItem={(item) => {
                setItemToEdit(item);
                setIsItemModalOpen(true);
              }}
              onDeleteItem={handleDeleteItem}
              onBatchDelete={handleBatchDelete}
              onQuickStockAdjust={(item, dir) => handleOpenStockAdjust(item, dir)}
              onViewBarcode={(item) => {
                setSelectedItemForBarcode(item);
                setCurrentTab('barcode_studio');
              }}
              onExportCSV={() => exportInventoryToCSV(items)}
              onCreatePOWithItem={(item) => {
                setCurrentTab('purchase_orders');
              }}
              onOpenCrateReturn={() => setIsCrateReturnModalOpen(true)}
            />
          )}

          {currentTab === 'movements' && (
            <StockMovementsView
              movements={movements}
              settings={settings}
              isAdmin={isAdmin}
              onPrintReceipt={handlePrintReceiptFromMovement}
              onDeleteMovement={handleDeleteMovement}
            />
          )}

          {currentTab === 'receipts' && (
            <ReceiptsView
              receipts={receipts}
              items={items}
              settings={settings}
              isAdmin={isAdmin}
              onOpenReceiptModal={(rec) => {
                setSelectedReceiptForPrint(rec);
                setIsReceiptModalOpen(true);
              }}
              onCreateNewReceipt={handleCreateNewReceipt}
              onDeleteReceipt={handleDeleteReceipt}
              onOpenPOSModal={() => setIsPOSModalOpen(true)}
            />
          )}

          {currentTab === 'sales_recap' && (
            <DailySalesRecapView
              receipts={receipts}
              expenses={expenses}
              bankDeposits={bankDeposits}
              creditPayments={creditPayments}
              settings={settings}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onAddDeposit={handleAddDeposit}
              onDeleteDeposit={handleDeleteDeposit}
              onAddCreditPayment={handleAddCreditPayment}
              onDeleteCreditPayment={handleDeleteCreditPayment}
              onOpenReceipt={(rec) => {
                setSelectedReceiptForPrint(rec);
                setIsReceiptModalOpen(true);
              }}
            />
          )}

          {currentTab === 'sales_rep_dispatch' && (
            <SalesRepDispatchView
              dispatches={salesRepDispatches}
              items={items}
              settings={settings}
              users={users}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onCreateDispatch={handleCreateDispatch}
              onReconcileDispatch={handleReconcileDispatch}
              onDeleteDispatch={handleDeleteDispatch}
            />
          )}

          {currentTab === 'purchase_orders' && (
            <PurchaseOrdersView
              orders={orders}
              suppliers={suppliers}
              items={items}
              settings={settings}
              onCreatePO={handleCreatePO}
              onReceivePO={handleReceivePO}
              onCancelPO={handleCancelPO}
              onDeletePO={handleDeletePO}
            />
          )}

          {currentTab === 'suppliers' && (
            <SuppliersView
              suppliers={suppliers}
              items={items}
              onAddSupplier={handleAddSupplier}
              onEditSupplier={handleEditSupplier}
              onDeleteSupplier={handleDeleteSupplier}
            />
          )}

          {currentTab === 'team' && (
            <TeamManagementView
              users={users}
              currentUser={currentUser}
              onSwitchUser={handleSwitchCurrentUser}
              onAddUser={handleAddUser}
              onEditUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onSignOut={handleSignOut}
            />
          )}

          {currentTab === 'barcode_studio' && (
            <BarcodeStudioView
              items={items}
              settings={settings}
              selectedItemForBarcode={selectedItemForBarcode}
            />
          )}
        </main>
      </div>

      {/* --- Modals & Dialogs --- */}
      {/* 1. Item Add / Edit Modal */}
      <ItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        itemToEdit={itemToEdit}
        suppliers={suppliers}
        categories={categories}
        settings={settings}
        onSave={handleSaveItem}
      />

      {/* 2. Stock Adjustment In/Out Modal */}
      <StockAdjustModal
        isOpen={isStockAdjustOpen}
        onClose={() => setIsStockAdjustOpen(false)}
        item={adjustTargetItem}
        initialType={adjustDirection}
        settings={settings}
        onConfirmAdjust={handleConfirmStockAdjust}
      />

      {/* 3. Barcode / QR Optical & Gun Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        items={items}
        settings={settings}
        onQuickAdjust={(item, dir) => handleOpenStockAdjust(item, dir)}
        onSelectItem={(item) => {
          setItemToEdit(item);
          setIsItemModalOpen(true);
        }}
      />

      {/* 4. Dev Password Verification Gate & Dev Console Modal */}
      <DevPasswordModal
        isOpen={isDevPasswordOpen}
        onClose={() => setIsDevPasswordOpen(false)}
        onUnlocked={() => {
          setIsDevPasswordOpen(false);
          setIsSettingsOpen(true);
          if (settings.enableSoundEffects) {
            sound.playSuccessChime();
          }
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        settings={settings}
        onUpdateSettings={(s) => {
          const nextSettings: AppSettings = {
            ...settingsRef.current,
            ...s,
            updatedAt: new Date().toISOString(),
          };
          settingsRef.current = nextSettings;
          setSettings(nextSettings);
          saveStoreSettingsToFirestore(nextSettings).catch(() => {});
        }}
        onLoadPreset={handleLoadPreset}
        onImportCSVItems={handleImportCSVItems}
        onExportJSONBackup={handleExportJSONBackup}
        onRestoreJSONBackup={handleRestoreJSONBackup}
        onResetAllData={handleResetAllData}
        items={items}
        movements={movements}
        suppliers={suppliers}
        orders={orders}
        receipts={receipts}
        users={users}
        cloudSchedule={cloudSchedule}
        cloudSnapshots={cloudSnapshots}
        onUpdateCloudSchedule={handleUpdateCloudSchedule}
        onTriggerCloudBackup={handleTriggerCloudBackup}
        onRestoreCloudSnapshot={handleRestoreCloudSnapshot}
        onDeleteCloudSnapshot={handleDeleteCloudSnapshot}
        onOpenChangePassword={(target) => handleOpenChangePassword(target)}
        onItemsUpdated={(newItems) => {
          itemsRef.current = newItems;
          setItems(newItems);
        }}
        lastSyncTime={lastSyncTime}
        isDeltaSyncing={isDeltaSyncing}
        onTriggerDeltaSync={() => handleTriggerDeltaSync(false)}
      />

      {/* 5. Admin & Staff Password / Security PIN Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        targetUser={passwordTargetUser || currentUser}
        currentUser={currentUser}
        onSavePassword={handleSavePassword}
      />

      {/* 6. Receipt & Sales Slip Printer Modal */}
      <ReceiptPrintModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        receiptData={selectedReceiptForPrint}
        settings={settings}
        onSaveReceipt={(updatedRec) => {
          const stamped: ReceiptData = {
            ...updatedRec,
            updatedAt: new Date().toISOString(),
          };
          const nextReceipts = receiptsRef.current.map((r) =>
            r.id === stamped.id ? stamped : r
          );
          receiptsRef.current = nextReceipts;
          setReceipts(nextReceipts);
          saveReceiptToFirestore(stamped).catch(() => {});
        }}
      />

      {/* 7. Dedicated Fullscreen & Responsive POS Register Terminal Modal */}
      <POSRegisterModal
        isOpen={isPOSModalOpen}
        onClose={() => setIsPOSModalOpen(false)}
        items={items}
        settings={settings}
        currentUser={currentUser}
        onCreateNewReceipt={(newReceipt) => {
          handleCreateNewReceipt(newReceipt);
          setSelectedReceiptForPrint(newReceipt);
          setIsReceiptModalOpen(true);
        }}
      />

      {/* 8. Crate & Empty Bottle Returns Modal */}
      <CrateReturnModal
        isOpen={isCrateReturnModalOpen}
        onClose={() => setIsCrateReturnModalOpen(false)}
        crateReturns={crateReturns}
        onSaveCrateReturn={handleSaveCrateReturn}
        onDeleteCrateReturn={handleDeleteCrateReturn}
        currentUser={currentUser}
        items={items}
        settings={settings}
      />
    </div>
  );
}
