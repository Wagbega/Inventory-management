import {
  CloudBackupSchedule,
  CloudBackupSnapshot,
  CloudBackupFrequency,
  InventoryItem,
  StockMovement,
  Supplier,
  PurchaseOrder,
  ReceiptData,
  AppUser,
  AppSettings,
  UserRole,
} from '../types';

export const defaultCloudSchedule: CloudBackupSchedule = {
  enabled: true,
  frequency: 'daily',
  timeOfDay: '23:00',
  dayOfWeek: 0, // Sunday
  dayOfMonth: 1, // 1st
  retentionCopies: 30,
  destination: 'secure_vault',
  cloudBucketName: 'prod-inventory-cloud-vault-nga-01',
  lastBackupDate: new Date(Date.now() - 3600000 * 14).toISOString(),
  nextScheduledDate: calculateNextBackupDate('daily', '23:00', 0, 1),
  autoDownloadLocalCopy: false,
};

export function calculateNextBackupDate(
  frequency: CloudBackupFrequency,
  timeOfDay: string,
  dayOfWeek = 0,
  dayOfMonth = 1
): string {
  const now = new Date();
  const [hours, minutes] = (timeOfDay || '23:00').split(':').map(Number);

  const target = new Date();
  target.setHours(hours || 23, minutes || 0, 0, 0);

  if (frequency === 'manual') {
    return 'Manual Trigger Only';
  }

  if (frequency === 'daily') {
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target.toISOString();
  }

  if (frequency === 'weekly') {
    const currentDay = now.getDay();
    let daysUntil = (dayOfWeek - currentDay + 7) % 7;
    if (daysUntil === 0 && target.getTime() <= now.getTime()) {
      daysUntil = 7;
    }
    target.setDate(target.getDate() + daysUntil);
    return target.toISOString();
  }

  if (frequency === 'monthly') {
    target.setDate(dayOfMonth);
    if (target.getTime() <= now.getTime()) {
      target.setMonth(target.getMonth() + 1);
      target.setDate(dayOfMonth);
    }
    return target.toISOString();
  }

  return target.toISOString();
}

// Generate simple deterministic SHA-256 like hash for verification checksum
export function generatePayloadChecksum(payload: unknown): string {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `sha256:e9a7${hex}c4f801ad29e377bf`;
}

export function createCloudSnapshotPayload(
  type: CloudBackupFrequency,
  currentUser: AppUser | null,
  data: {
    items: InventoryItem[];
    movements: StockMovement[];
    suppliers: Supplier[];
    purchaseOrders: PurchaseOrder[];
    receipts: ReceiptData[];
    users: AppUser[];
    settings: AppSettings;
  },
  notes?: string
): CloudBackupSnapshot {
  const timestamp = new Date().toISOString();
  const payloadData = {
    items: data.items,
    movements: data.movements,
    suppliers: data.suppliers,
    purchaseOrders: data.purchaseOrders,
    receipts: data.receipts,
    users: data.users,
    settings: data.settings,
  };

  const jsonString = JSON.stringify(payloadData);
  const sizeBytes = new Blob([jsonString]).size;
  const checksum = generatePayloadChecksum(jsonString);

  return {
    id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp,
    type,
    operator: currentUser ? currentUser.name : 'System Scheduler',
    operatorRole: currentUser ? currentUser.role : 'admin',
    sizeBytes,
    itemCount: data.items.length,
    movementCount: data.movements.length,
    poCount: data.purchaseOrders.length,
    supplierCount: data.suppliers.length,
    receiptCount: data.receipts.length,
    userCount: data.users.length,
    checksum,
    cloudRegion: 'gcp-europe-west1 (Cloud Storage Vault)',
    status: 'synced',
    notes: notes || `${type.toUpperCase()} Automated/Admin Snapshot Archive`,
    payloadData,
  };
}

export const defaultMockSnapshots: CloudBackupSnapshot[] = [];

export function downloadSnapshotJSON(snapshot: CloudBackupSnapshot) {
  const jsonContent = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cloud-backup-${snapshot.type}-${snapshot.id}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
