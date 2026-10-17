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
  deleteItemFromFirestore,
  saveMovementToFirestore,
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
  ensureCloudDevPasswordInitialized,
  upsertActiveDeviceSession,
  subscribeToActiveDevices,
  getOrCreateLocalDeviceId,
} from './services/firebaseSync';

const defaultMockReceipts: ReceiptData[] = [];

const defaultExpenses: DailyExpense[] = [
  {
    id: 'exp-1',
    date: new Date().toISOString().split('T')[0],
    category: 'electricity',
    amount: 12500,
    description: 'PHCN prepaid electricity token recharge for warehouse',
    paymentSource: 'Cash Sales',
    time: '09:30 AM',
    createdAt: new Date().toISOString(),
    recordedBy: 'Alex Rivera',
  },
  {
    id: 'exp-2',
    date: new Date().toISOString().split('T')[0],
    category: 'vehicle_fuel',
    amount: 18000,
    description: '35L PMS Fuel for dispatch delivery van',
    paymentSource: 'Cash Sales',
    time: '11:15 AM',
    createdAt: new Date().toISOString(),
    recordedBy: 'Alex Rivera',
  },
  {
    id: 'exp-3',
    date: new Date().toISOString().split('T')[0],
    category: 'vehicle_repair',
    amount: 25000,
    description: 'Front brake pads & suspension bushing replacement',
    vehicleNumber: 'LAG-492-XA',
    driverName: 'Emeka Johnson',
    paymentSource: 'Bank Transfer',
    time: '01:45 PM',
    createdAt: new Date().toISOString(),
    recordedBy: 'Alex Rivera',
  },
];

const defaultBankDeposits: BankDeposit[] = [
  {
    id: 'dep-1',
    date: new Date().toISOString().split('T')[0],
    amount: 150000,
    depositMethod: 'cash',
    bankName: 'Guaranty Trust Bank (GTB)',
    depositorName: 'Samantha Chen',
    referenceNumber: 'TLR-904128',
    time: '02:30 PM',
    notes: 'Midday cash sales banking',
    createdAt: new Date().toISOString(),
    recordedBy: 'Samantha Chen',
  },
];

const defaultSalesRepDispatches: SalesRepDispatch[] = [
  {
    id: 'dsp_sample_1',
    dispatchNumber: 'DSP-2026-001',
    repName: 'Ibrahim Babatunde',
    repPhone: '+234 803 123 4567',
    dateDispatched: new Date().toISOString().split('T')[0],
    timeDispatched: '08:30 AM',
    status: 'active',
    items: [
      {
        itemId: 'sample-p1',
        sku: 'GEN-OIL-5L',
        name: 'Generator Engine Oil 5W-40 (5L)',
        unit: 'Bottle',
        unitPrice: 14500,
        unitCost: 11000,
        quantityTaken: 10,
        totalValueTaken: 145000,
        quantityReturned: 0,
        quantitySold: 0,
        totalValueSold: 0,
        totalValueReturned: 0,
      },
      {
        itemId: 'sample-p2',
        sku: 'PLUG-NGK-4',
        name: 'NGK Spark Plugs Pack (Set of 4)',
        unit: 'Pack',
        unitPrice: 6500,
        unitCost: 4500,
        quantityTaken: 6,
        totalValueTaken: 39000,
        quantityReturned: 0,
        quantitySold: 0,
        totalValueSold: 0,
        totalValueReturned: 0,
      },
    ],
    totalSumTaken: 184000,
    totalUnsoldReturnedValue: 0,
    netSalesDue: 184000,
    amountRemittedCash: 0,
    amountRemittedTransfer: 0,
    amountRemittedPOS: 0,
    totalAmountRemitted: 0,
    shortageOrExcess: -184000,
    deductedStockImmediate: false,
    dispatchedBy: 'Alex Rivera',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: 'Outward market sales run around Lagos Island & Ikeja electronics market.',
  },
];

export default function App() {
  // --- Persistent State from LocalStorage ---
  const [items, setItems] = useState<InventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_items');
      return saved ? JSON.parse(saved) : defaultItems;
    } catch {
      return defaultItems;
    }
  });

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

  const [orders, setOrders] = useState<PurchaseOrder[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_orders');
      return saved ? JSON.parse(saved) : defaultPurchaseOrders;
    } catch {
      return defaultPurchaseOrders;
    }
  });

  const [receipts, setReceipts] = useState<ReceiptData[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_receipts');
      return saved ? JSON.parse(saved) : defaultMockReceipts;
    } catch {
      return defaultMockReceipts;
    }
  });

  const [expenses, setExpenses] = useState<DailyExpense[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_expenses');
      return saved ? JSON.parse(saved) : defaultExpenses;
    } catch {
      return defaultExpenses;
    }
  });

  const [bankDeposits, setBankDeposits] = useState<BankDeposit[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_bank_deposits');
      return saved ? JSON.parse(saved) : defaultBankDeposits;
    } catch {
      return defaultBankDeposits;
    }
  });

  const [salesRepDispatches, setSalesRepDispatches] = useState<SalesRepDispatch[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_sales_rep_dispatches');
      return saved ? JSON.parse(saved) : defaultSalesRepDispatches;
    } catch {
      return defaultSalesRepDispatches;
    }
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('win_inv_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
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

  const [users, setUsers] = useState<AppUser[]>(() => {
    try {
      const saved = localStorage.getItem('win_inv_users');
      if (saved) {
        const parsed: AppUser[] = JSON.parse(saved);
        // Ensure admin users have 6-digit PINs (migrate any legacy 4-digit '1234' demo PIN)
        return parsed.map((u) => {
          if (u.role === 'admin' && (!u.pin || u.pin === '1234')) {
            return { ...u, pin: '123456' };
          }
          return u;
        });
      }
      return defaultUsers;
    } catch {
      return defaultUsers;
    }
  });

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

  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    try {
      const savedId = localStorage.getItem('win_inv_active_user_id');
      if (savedId === 'locked_session') return null;
      if (!savedId) return defaultUsers[0];
      const found = defaultUsers.find((u) => u.id === savedId);
      return found || defaultUsers[0];
    } catch {
      return defaultUsers[0];
    }
  });

  const isAdmin = currentUser?.role === 'admin';

  // Track deleted record IDs so real-time Firestore listeners do not resurrect deleted records
  const deletedIdsRef = useRef<Set<string>>(
    (() => {
      try {
        const saved = localStorage.getItem('win_inv_deleted_ids');
        return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
      } catch {
        return new Set<string>();
      }
    })()
  );

  const markIdDeleted = useCallback((id: string) => {
    deletedIdsRef.current.add(id);
    try {
      localStorage.setItem('win_inv_deleted_ids', JSON.stringify(Array.from(deletedIdsRef.current)));
    } catch {}
  }, []);

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
    localStorage.setItem('win_inv_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('win_inv_cloud_schedule', JSON.stringify(cloudSchedule));
  }, [cloudSchedule]);

  useEffect(() => {
    localStorage.setItem('win_inv_cloud_backups', JSON.stringify(cloudSnapshots));
  }, [cloudSnapshots]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('win_inv_active_user_id', currentUser.id);
      upsertActiveDeviceSession(currentUser, 'online').catch(() => {});
    } else {
      localStorage.setItem('win_inv_active_user_id', 'locked_session');
      upsertActiveDeviceSession(null, 'offline').catch(() => {});
    }
  }, [currentUser]);

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
        setItems((currentItems) => {
          const map = new Map<string, InventoryItem>();
          currentItems.forEach((it) => {
            if (!deletedIdsRef.current.has(it.id)) {
              map.set(it.id, it);
            }
          });

          let hasChanges = false;
          remoteItems.forEach((remote) => {
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
              localStorage.setItem('win_inv_items', JSON.stringify(merged));
            } catch {}
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

    return () => {
      unsubscribe();
      unsubExpenses();
      unsubDeposits();
      unsubDispatches();
    };
  }, []);

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
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, pin: newPass } : u))
    );
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
    const existingIndex = items.findIndex((i) => i.id === savedItem.id);
    if (existingIndex >= 0) {
      setItems((prev) => prev.map((i) => (i.id === savedItem.id ? savedItem : i)));
    } else {
      if (!isAdmin) {
        alert('Permission Denied: Only Administrators can create new inventory items.');
        return;
      }
      setItems((prev) => [savedItem, ...prev]);
      // Log initial movement
      if (savedItem.quantity > 0) {
        const initialMov: StockMovement = {
          id: 'mov_' + Math.random().toString(36).substring(2, 9),
          itemId: savedItem.id,
          itemSku: savedItem.sku,
          itemName: savedItem.name,
          type: 'in_adjustment',
          quantityDelta: savedItem.quantity,
          previousQuantity: 0,
          newQuantity: savedItem.quantity,
          unitCost: savedItem.unitCost,
          timestamp: new Date().toISOString(),
          operator: currentUser ? `${currentUser.name} (${currentUser.role})` : 'System Admin',
          reason: 'Initial stock intake on catalog creation',
        };
        setMovements((prev) => [initialMov, ...prev]);
        saveMovementToFirestore(initialMov).catch(() => {});
      }
    }

    // Persist to Cloud Firestore
    saveItemToFirestore(savedItem).catch((err) => {
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
  };

  // --- Receipt Deletion ---
  const handleDeleteReceipt = (receiptId: string) => {
    markIdDeleted(receiptId);
    setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
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
      setItems((prevItems) => {
        return prevItems.map((item) => {
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
              timestamp: new Date().toISOString(),
              operator: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Sales Rep Dispatcher',
              reason: `Field Stock Dispatch #${newDispatch.dispatchNumber} to Rep: ${newDispatch.repName}`,
            };
            newMovements.push(mov);
            saveMovementToFirestore(mov).catch(() => {});
            const updatedItem = { ...item, quantity: newQty };
            saveItemToFirestore(updatedItem).catch(() => {});
            return updatedItem;
          }
          return item;
        });
      });

      if (newMovements.length > 0) {
        setMovements((prev) => [...newMovements, ...prev]);
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
    let targetDispatch: SalesRepDispatch | undefined;

    setSalesRepDispatches((prev) =>
      prev.map((d) => {
        if (d.id === dispatchId) {
          targetDispatch = {
            ...d,
            ...reconciliationData,
            status: 'reconciled',
            updatedAt: new Date().toISOString(),
          };
          return targetDispatch;
        }
        return d;
      })
    );

    if (targetDispatch) {
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
          setItems((prevItems) => {
            return prevItems.map((item) => {
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
                  timestamp: new Date().toISOString(),
                  operator: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Sales Rep Auditor',
                  reason: `Unsold stock return from Rep: ${targetDispatch!.repName} (Dispatch #${targetDispatch!.dispatchNumber})`,
                };
                restoreMovements.push(mov);
                saveMovementToFirestore(mov).catch(() => {});
                const updatedItem = { ...item, quantity: newQty };
                saveItemToFirestore(updatedItem).catch(() => {});
                return updatedItem;
              }
              return item;
            });
          });

          if (restoreMovements.length > 0) {
            setMovements((prev) => [...restoreMovements, ...prev]);
          }
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
      id: 'id' in userCandidate && userCandidate.id ? userCandidate.id : 'usr_' + Math.random().toString(36).substring(2, 9),
      createdAt: 'createdAt' in userCandidate && userCandidate.createdAt ? userCandidate.createdAt : new Date().toISOString(),
      ...userCandidate,
    };
    setUsers((prev) => [...prev, newUser]);
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleUpdateUser = (updatedUser: AppUser) => {
    setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    if (currentUser?.id === updatedUser.id) {
      setCurrentUser(updatedUser);
    }
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUsers((prev) => {
      const remaining = prev.filter((u) => u.id !== userId);
      // If the deleted user is currently active, switch to next available admin or user
      if (currentUser?.id === userId) {
        const nextUser = remaining.find((u) => u.role === 'admin') || remaining[0] || null;
        setCurrentUser(nextUser);
      }
      return remaining;
    });
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
    setReceipts((prev) => [newReceipt, ...prev]);

    // Also deduct stock and record in ledger for each line item
    newReceipt.items.forEach((line) => {
      const targetItem = items.find((i) => (line.itemId && i.id === line.itemId) || i.sku === line.sku);
      if (targetItem) {
        const delta = -line.quantity;
        const prevQty = targetItem.quantity;
        const newQty = Math.max(0, prevQty + delta);

        setItems((prev) =>
          prev.map((i) =>
            i.id === targetItem.id
              ? {
                  ...i,
                  quantity: newQty,
                  updatedAt: new Date().toISOString(),
                }
              : i
          )
        );

        const mov: StockMovement = {
          id: 'mov_' + Math.random().toString(36).substring(2, 9),
          itemId: targetItem.id,
          itemSku: targetItem.sku,
          itemName: targetItem.name,
          type: 'out_sale',
          quantityDelta: delta,
          previousQuantity: prevQty,
          newQuantity: newQty,
          unitCost: targetItem.unitCost,
          timestamp: newReceipt.date,
          referenceNumber: newReceipt.receiptNumber,
          operator: newReceipt.operator,
          reason: `POS Sale Receipt #${newReceipt.receiptNumber} (${newReceipt.paymentMethod})`,
        };
        setMovements((prev) => [mov, ...prev]);
      }
    });

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
    const prevQty = item.quantity;
    const newQty = Math.max(0, prevQty + delta);

    // Update item stock
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              quantity: newQty,
              lastRestocked: delta > 0 ? new Date().toISOString().split('T')[0] : i.lastRestocked,
              updatedAt: new Date().toISOString(),
            }
          : i
      )
    );

    // Append to immutable Ledger
    const newMov: StockMovement = {
      id: 'mov_' + Math.random().toString(36).substring(2, 9),
      itemId: item.id,
      itemSku: item.sku,
      itemName: item.name,
      type: type,
      quantityDelta: delta,
      previousQuantity: prevQty,
      newQuantity: newQty,
      unitCost: item.unitCost,
      timestamp: new Date().toISOString(),
      referenceNumber: referenceNumber || undefined,
      operator: operator,
      reason: reason || undefined,
    };
    setMovements((prev) => [newMov, ...prev]);

    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }

    if (printReceipt) {
      handlePrintReceiptFromMovement(newMov);
    }
  };

  // --- Purchase Orders Handlers ---
  const handleCreatePO = (po: PurchaseOrder) => {
    setOrders((prev) => [po, ...prev]);
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleReceivePO = (poId: string) => {
    const po = orders.find((o) => o.id === poId);
    if (!po) return;

    // Increment inventory for each item in PO
    const newMovements: StockMovement[] = [];
    const itemMap = new Map<string, InventoryItem>(items.map((i) => [i.id, i]));

    po.items.forEach((poItem) => {
      const existing = itemMap.get(poItem.itemId);
      if (existing) {
        const prevQty = existing.quantity;
        const newQty = prevQty + poItem.quantity;
        existing.quantity = newQty;
        existing.lastRestocked = new Date().toISOString().split('T')[0];
        existing.updatedAt = new Date().toISOString();

        newMovements.push({
          id: 'mov_' + Math.random().toString(36).substring(2, 9),
          itemId: existing.id,
          itemSku: existing.sku,
          itemName: existing.name,
          type: 'in_purchase',
          quantityDelta: poItem.quantity,
          previousQuantity: prevQty,
          newQuantity: newQty,
          unitCost: poItem.unitCost,
          timestamp: new Date().toISOString(),
          referenceNumber: po.poNumber,
          operator: 'Receiving Team',
          reason: `Shipment received from ${po.supplierName}`,
        });
      }
    });

    setItems(Array.from(itemMap.values()));
    setMovements((prev) => [...newMovements, ...prev]);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === poId
          ? {
              ...o,
              status: 'received',
              receivedDate: new Date().toISOString().split('T')[0],
            }
          : o
      )
    );

    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleCancelPO = (poId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === poId ? { ...o, status: 'cancelled' } : o))
    );
  };

  const handleDeletePO = (poId: string) => {
    markIdDeleted(poId);
    setOrders((prev) => {
      const updated = prev.filter((o) => o.id !== poId);
      try {
        localStorage.setItem('win_inv_orders', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (settings.enableSoundEffects) {
      sound.playAlertSound();
    }
  };

  // --- Suppliers Handlers ---
  const handleAddSupplier = (sup: Supplier) => {
    setSuppliers((prev) => [sup, ...prev]);
  };

  const handleEditSupplier = (sup: Supplier) => {
    setSuppliers((prev) => prev.map((s) => (s.id === sup.id ? sup : s)));
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  // --- Settings & Presets Handlers ---
  const handleLoadPreset = (preset: IndustryPreset) => {
    setItems(preset.sampleItems);
    setMovements([]);
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleImportCSVItems = (imported: InventoryItem[]) => {
    setItems((prev) => [...imported, ...prev]);
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
    users?: AppUser[];
    settings?: AppSettings;
  }) => {
    if (data.items) setItems(data.items);
    if (data.movements) setMovements(data.movements);
    if (data.suppliers) setSuppliers(data.suppliers);
    if (data.orders) setOrders(data.orders);
    if (data.receipts) setReceipts(data.receipts);
    if (data.expenses) setExpenses(data.expenses);
    if (data.bankDeposits) setBankDeposits(data.bankDeposits);
    if (data.salesRepDispatches) setSalesRepDispatches(data.salesRepDispatches);
    if (data.users) setUsers(data.users);
    if (data.settings) setSettings(data.settings);
  };

  const handleResetAllData = () => {
    setItems([]);
    setMovements([]);
    setOrders([]);
    setReceipts([]);
    setExpenses([]);
    setBankDeposits([]);
    setSalesRepDispatches([]);
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
      if (snapshot.payloadData.items) setItems(snapshot.payloadData.items);
      if (snapshot.payloadData.movements) setMovements(snapshot.payloadData.movements);
      if (snapshot.payloadData.suppliers) setSuppliers(snapshot.payloadData.suppliers);
      if (snapshot.payloadData.purchaseOrders) setOrders(snapshot.payloadData.purchaseOrders);
      if (snapshot.payloadData.receipts) setReceipts(snapshot.payloadData.receipts);
      if (snapshot.payloadData.users) setUsers(snapshot.payloadData.users);
      if (snapshot.payloadData.settings) setSettings(snapshot.payloadData.settings);
    }
    if (settings.enableSoundEffects) {
      sound.playSuccessChime();
    }
  };

  const handleDeleteCloudSnapshot = (id: string) => {
    setCloudSnapshots((prev) => prev.filter((s) => s.id !== id));
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
        setItemToEdit(null);
        setIsItemModalOpen(true);
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
        onRefreshData={() => {
          if (settings.enableSoundEffects) sound.playScanBeep();
        }}
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
              settings={settings}
              isAdmin={isAdmin}
              onNavigateTab={(tab) => setCurrentTab(tab)}
              onOpenAddItem={() => {
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
              settings={settings}
              currentUser={currentUser}
              isAdmin={isAdmin}
              onAddExpense={handleAddExpense}
              onDeleteExpense={handleDeleteExpense}
              onAddDeposit={handleAddDeposit}
              onDeleteDeposit={handleDeleteDeposit}
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
        onUpdateSettings={(s) => setSettings((prev) => ({ ...prev, ...s }))}
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
        onItemsUpdated={(newItems) => setItems(newItems)}
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
          setReceipts((prev) =>
            prev.map((r) => (r.id === updatedRec.id ? updatedRec : r))
          );
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
    </div>
  );
}
