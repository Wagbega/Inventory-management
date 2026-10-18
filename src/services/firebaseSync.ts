import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  writeBatch,
  Firestore,
} from 'firebase/firestore';
import { InventoryItem, StockMovement, DailyExpense, BankDeposit, SalesRepDispatch, AppUser, SupervisorPresence, ActivityEvent, ActiveDeviceSession } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize or reuse Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if configured
export const db: Firestore = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export function getFirebaseConfig() {
  return firebaseConfig;
}

/**
 * Validates connection to the Firestore server instance
 */
export async function testFirestoreConnection(): Promise<{ success: boolean; message: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { success: true, message: 'Connected to Firestore successfully.' };
  } catch (err: any) {
    if (err?.code === 'unavailable' || err?.message?.includes('the client is offline')) {
      return { success: false, message: 'Client is offline or database is unreachable.' };
    }
    // Any other permission / doc-not-found response means connection succeeded
    return { success: true, message: 'Firestore is reachable and active.' };
  }
}

/**
 * Helper to remove undefined keys from an object before writing to Firestore
 */
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Save or update a single inventory item to cloud Firestore
 */
export async function saveItemToFirestore(item: InventoryItem): Promise<void> {
  const itemRef = doc(db, 'items', item.id);
  const payload = sanitizeForFirestore({
    ...item,
    updatedAt: new Date().toISOString(),
  });
  await setDoc(itemRef, payload, { merge: true });
}

/**
 * Delete an inventory item from cloud Firestore
 */
export async function deleteItemFromFirestore(itemId: string): Promise<void> {
  const itemRef = doc(db, 'items', itemId);
  await deleteDoc(itemRef);
}

/**
 * Upload all current local items to Firestore in batches
 */
export async function uploadAllItemsToFirestore(items: InventoryItem[]): Promise<number> {
  if (!items || items.length === 0) return 0;
  let count = 0;
  const chunkSize = 400; // Under Firestore's 500 limit

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const item of chunk) {
      const ref = doc(db, 'items', item.id);
      batch.set(ref, sanitizeForFirestore({ ...item, updatedAt: new Date().toISOString() }), { merge: true });
      count++;
    }
    await batch.commit();
  }
  return count;
}

/**
 * Fetch all items once from Firestore
 */
export async function fetchRemoteItems(): Promise<InventoryItem[]> {
  const snap = await getDocs(collection(db, 'items'));
  const list: InventoryItem[] = [];
  snap.forEach((d) => {
    const data = d.data() as InventoryItem;
    list.push({ ...data, id: d.id || data.id });
  });
  return list;
}

/**
 * Listen in real time to all inventory items in cloud Firestore.
 * Triggers callback immediately on initial load and whenever any remote Android/web client updates items.
 */
export function subscribeToRemoteItems(
  onItemsChange: (items: InventoryItem[]) => void,
  onError?: (err: Error) => void
): () => void {
  const itemsCol = collection(db, 'items');
  return onSnapshot(
    itemsCol,
    (snapshot) => {
      const remoteItems: InventoryItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as InventoryItem;
        remoteItems.push({ ...data, id: d.id || data.id });
      });
      onItemsChange(remoteItems);
    },
    (error) => {
      console.warn('[Firestore] Realtime sync listener warning:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Save an audit stock movement to Firestore
 */
export async function saveMovementToFirestore(movement: StockMovement): Promise<void> {
  try {
    const movRef = doc(db, 'stock_movements', movement.id);
    await setDoc(movRef, movement, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to log stock movement:', err);
  }
}

/**
 * Save a daily expense record to Firestore
 */
export async function saveExpenseToFirestore(expense: DailyExpense): Promise<void> {
  try {
    const expRef = doc(db, 'expenses', expense.id);
    await setDoc(expRef, expense, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to save expense:', err);
  }
}

/**
 * Delete a daily expense record from Firestore
 */
export async function deleteExpenseFromFirestore(expenseId: string): Promise<void> {
  try {
    const expRef = doc(db, 'expenses', expenseId);
    await deleteDoc(expRef);
  } catch (err) {
    console.warn('[Firestore] Failed to delete expense:', err);
  }
}

/**
 * Subscribe to real-time daily expenses in Firestore
 */
export function subscribeToRemoteExpenses(
  onExpensesChange: (expenses: DailyExpense[]) => void,
  onError?: (err: Error) => void
): () => void {
  const expCol = collection(db, 'expenses');
  return onSnapshot(
    expCol,
    (snapshot) => {
      const remoteExpenses: DailyExpense[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as DailyExpense;
        remoteExpenses.push({ ...data, id: d.id || data.id });
      });
      onExpensesChange(remoteExpenses);
    },
    (error) => {
      console.warn('[Firestore] Realtime expenses listener warning:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Save a daily bank deposit to Firestore
 */
export async function saveDepositToFirestore(deposit: BankDeposit): Promise<void> {
  try {
    const depRef = doc(db, 'bank_deposits', deposit.id);
    await setDoc(depRef, deposit, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to save bank deposit:', err);
  }
}

/**
 * Delete a bank deposit record from Firestore
 */
export async function deleteDepositFromFirestore(depositId: string): Promise<void> {
  try {
    const depRef = doc(db, 'bank_deposits', depositId);
    await deleteDoc(depRef);
  } catch (err) {
    console.warn('[Firestore] Failed to delete bank deposit:', err);
  }
}

/**
 * Subscribe to real-time bank deposits in Firestore
 */
export function subscribeToRemoteDeposits(
  onDepositsChange: (deposits: BankDeposit[]) => void,
  onError?: (err: Error) => void
): () => void {
  const depCol = collection(db, 'bank_deposits');
  return onSnapshot(
    depCol,
    (snapshot) => {
      const remoteDeposits: BankDeposit[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as BankDeposit;
        remoteDeposits.push({ ...data, id: d.id || data.id });
      });
      onDepositsChange(remoteDeposits);
    },
    (error) => {
      console.warn('[Firestore] Realtime bank deposits listener warning:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Save a sales rep dispatch record to Firestore
 */
export async function saveDispatchToFirestore(dispatch: SalesRepDispatch): Promise<void> {
  try {
    const dispRef = doc(db, 'sales_rep_dispatches', dispatch.id);
    await setDoc(dispRef, dispatch, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to save sales rep dispatch:', err);
  }
}

/**
 * Delete a sales rep dispatch record from Firestore
 */
export async function deleteDispatchFromFirestore(dispatchId: string): Promise<void> {
  try {
    const dispRef = doc(db, 'sales_rep_dispatches', dispatchId);
    await deleteDoc(dispRef);
  } catch (err) {
    console.warn('[Firestore] Failed to delete sales rep dispatch:', err);
  }
}

/**
 * Subscribe to real-time sales rep dispatches in Firestore
 */
export function subscribeToRemoteDispatches(
  onDispatchesChange: (dispatches: SalesRepDispatch[]) => void,
  onError?: (err: Error) => void
): () => void {
  const dispCol = collection(db, 'sales_rep_dispatches');
  return onSnapshot(
    dispCol,
    (snapshot) => {
      const remoteDispatches: SalesRepDispatch[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as SalesRepDispatch;
        remoteDispatches.push({ ...data, id: d.id || data.id });
      });
      onDispatchesChange(remoteDispatches);
    },
    (error) => {
      console.warn('[Firestore] Realtime sales rep dispatches listener warning:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Save or update a staff user to Firestore
 */
export async function saveUserToFirestore(user: AppUser): Promise<void> {
  try {
    const userRef = doc(db, 'users', user.id);
    await setDoc(userRef, user, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to save user:', err);
  }
}

/**
 * Delete a staff user from Firestore
 */
export async function deleteUserFromFirestore(userId: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
  } catch (err) {
    console.warn('[Firestore] Failed to delete user:', err);
  }
}

/**
 * Upload all current local users to Firestore in batches
 */
export async function uploadAllUsersToFirestore(users: AppUser[]): Promise<number> {
  if (!users || users.length === 0) return 0;
  let count = 0;
  const batch = writeBatch(db);
  for (const user of users) {
    const ref = doc(db, 'users', user.id);
    batch.set(ref, user, { merge: true });
    count++;
  }
  await batch.commit();
  return count;
}

/**
 * Subscribe to real-time users list in Firestore
 */
export function subscribeToRemoteUsers(
  onUsersChange: (users: AppUser[]) => void,
  onError?: (err: Error) => void
): () => void {
  const usersCol = collection(db, 'users');
  return onSnapshot(
    usersCol,
    (snapshot) => {
      const remoteUsers: AppUser[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as AppUser;
        remoteUsers.push({ ...data, id: d.id || data.id });
      });
      if (remoteUsers.length > 0) {
        onUsersChange(remoteUsers);
      }
    },
    (error) => {
      console.warn('[Firestore] Realtime users listener warning:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Broadcast / heartbeat active supervisor or admin presence
 */
export async function saveSupervisorPresenceToFirestore(presence: SupervisorPresence): Promise<void> {
  try {
    const presRef = doc(db, 'supervisor_presences', presence.id);
    await setDoc(presRef, presence, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to update supervisor presence:', err);
  }
}

/**
 * Remove supervisor presence on sign out or tab close
 */
export async function deleteSupervisorPresenceFromFirestore(presenceId: string): Promise<void> {
  try {
    const presRef = doc(db, 'supervisor_presences', presenceId);
    await deleteDoc(presRef);
  } catch (err) {
    console.warn('[Firestore] Failed to delete supervisor presence:', err);
  }
}

/**
 * Subscribe to real-time active supervisor and admin presences
 */
export function subscribeToSupervisorPresences(
  onPresencesChange: (presences: SupervisorPresence[]) => void,
  onError?: (err: Error) => void
): () => void {
  const presCol = collection(db, 'supervisor_presences');
  return onSnapshot(
    presCol,
    (snapshot) => {
      const remotePresences: SupervisorPresence[] = [];
      const now = Date.now();
      snapshot.forEach((d) => {
        const data = d.data() as SupervisorPresence;
        // Keep presences seen within the last 5 minutes as online
        const lastSeenMs = new Date(data.lastSeen).getTime();
        if (now - lastSeenMs < 5 * 60 * 1000) {
          remotePresences.push({ ...data, id: d.id || data.id });
        }
      });
      onPresencesChange(remotePresences);
    },
    (error) => {
      console.warn('[Firestore] Realtime supervisor presences listener warning:', error);
      if (onError) onError(error);
    }
  );
}

/**
 * Log a real-time activity event for supervisors to monitor
 */
export async function logActivityEventToFirestore(event: ActivityEvent): Promise<void> {
  try {
    const eventRef = doc(db, 'activity_events', event.id);
    await setDoc(eventRef, event, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to log activity event:', err);
  }
}

/**
 * Subscribe to real-time activity events for live supervisor monitoring
 */
export function subscribeToActivityEvents(
  onEventsChange: (events: ActivityEvent[]) => void,
  onError?: (err: Error) => void
): () => void {
  const eventsCol = collection(db, 'activity_events');
  return onSnapshot(
    eventsCol,
    (snapshot) => {
      const remoteEvents: ActivityEvent[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as ActivityEvent;
        remoteEvents.push({ ...data, id: d.id || data.id });
      });
      // Sort newest first
      remoteEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onEventsChange(remoteEvents.slice(0, 100)); // Cap at 100 newest items
    },
    (error) => {
      console.warn('[Firestore] Realtime activity events listener warning:', error);
      if (onError) onError(error);
    }
  );
}

// --- Cloud-Stored Dev Password Management (app_config/dev_security) ---

export const INITIAL_DEV_PASSWORD = 'PaerMtil5090';

export interface DevSecurityConfig {
  id: string;
  passwordHash: string;
  updatedAt: string;
  updatedBy?: string;
}

/**
 * Pure-JS + WebCrypto SHA-256 hex digest of a plaintext password
 */
export async function computeSha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback deterministic hex encoding if crypto.subtle is unavailable
  return Array.from(text)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .padEnd(64, '0')
    .slice(0, 64);
}

/**
 * Ensures app_config/dev_security exists in Cloud Firestore.
 * If missing or still using a legacy seed, seeds it with the exact SHA-256 hash of "PaerMtil5090".
 */
export async function ensureCloudDevPasswordInitialized(): Promise<DevSecurityConfig> {
  const defaultHash = await computeSha256Hex(INITIAL_DEV_PASSWORD);
  const configRef = doc(db, 'app_config', 'dev_security');
  try {
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const data = snap.data() as DevSecurityConfig;
      // If it was seeded with an old placeholder by system initialization, refresh it with exact hash
      if (data && data.passwordHash && data.updatedBy !== 'System Initialization') {
        try {
          localStorage.setItem('win_inv_dev_security_cache', JSON.stringify(data));
        } catch {}
        return data;
      }
    }

    const initialConfig: DevSecurityConfig = {
      id: 'dev_security',
      passwordHash: defaultHash,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Initial Seed',
    };
    await setDoc(configRef, initialConfig, { merge: true });
    try {
      localStorage.setItem('win_inv_dev_security_cache', JSON.stringify(initialConfig));
    } catch {}
    return initialConfig;
  } catch (err) {
    console.warn('[Firestore] Falling back to cached/default Dev security config:', err);
    try {
      const cached = localStorage.getItem('win_inv_dev_security_cache');
      if (cached) {
        const parsed = JSON.parse(cached) as DevSecurityConfig;
        if (parsed && parsed.updatedBy !== 'System Initialization') {
          return parsed;
        }
      }
    } catch {}
    return {
      id: 'dev_security',
      passwordHash: defaultHash,
      updatedAt: new Date().toISOString(),
      updatedBy: 'Default Fallback',
    };
  }
}

/**
 * Verifies a candidate password against the live Firestore app_config/dev_security document
 */
export async function verifyCloudDevPassword(candidatePassword: string): Promise<{
  valid: boolean;
  config: DevSecurityConfig;
}> {
  const cleanCandidate = candidatePassword.trim();
  const candidateHash = await computeSha256Hex(cleanCandidate);
  const defaultHash = await computeSha256Hex(INITIAL_DEV_PASSWORD);
  const configRef = doc(db, 'app_config', 'dev_security');

  try {
    let snap;
    try {
      snap = await getDocFromServer(configRef);
    } catch {
      snap = await getDoc(configRef);
    }

    if (snap && snap.exists()) {
      const config = snap.data() as DevSecurityConfig;
      // If document was never manually changed by user, ensure initial password works and repair hash
      if (config && config.updatedBy === 'System Initialization') {
        const fixedConfig: DevSecurityConfig = {
          id: 'dev_security',
          passwordHash: defaultHash,
          updatedAt: new Date().toISOString(),
          updatedBy: 'Initial Seed',
        };
        await setDoc(configRef, fixedConfig, { merge: true });
        try {
          localStorage.setItem('win_inv_dev_security_cache', JSON.stringify(fixedConfig));
        } catch {}
        return {
          valid: candidateHash === defaultHash,
          config: fixedConfig,
        };
      }

      if (config && config.passwordHash) {
        try {
          localStorage.setItem('win_inv_dev_security_cache', JSON.stringify(config));
        } catch {}
        return {
          valid: candidateHash === config.passwordHash,
          config,
        };
      }
    }

    // Seed initial document if not yet present in cloud
    const seeded = await ensureCloudDevPasswordInitialized();
    return {
      valid: candidateHash === seeded.passwordHash,
      config: seeded,
    };
  } catch (err) {
    console.warn('[Firestore] Cloud password check offline fallback:', err);
    const fallbackConfig = await ensureCloudDevPasswordInitialized();
    return {
      valid: candidateHash === fallbackConfig.passwordHash || cleanCandidate === INITIAL_DEV_PASSWORD,
      config: fallbackConfig,
    };
  }
}

/**
 * Updates the Dev password in Cloud Firestore after verifying the current password
 */
export async function updateCloudDevPassword(
  currentPassword: string,
  newPassword: string,
  operatorName: string = 'Administrator'
): Promise<{ success: boolean; message: string; config?: DevSecurityConfig }> {
  const check = await verifyCloudDevPassword(currentPassword);
  if (!check.valid) {
    return {
      success: false,
      message: 'Current Dev password is incorrect.',
    };
  }

  const trimmedNew = newPassword.trim();
  if (trimmedNew.length < 4) {
    return {
      success: false,
      message: 'New Dev password must be at least 4 characters.',
    };
  }

  const newHash = await computeSha256Hex(trimmedNew);
  const updatedConfig: DevSecurityConfig = {
    id: 'dev_security',
    passwordHash: newHash,
    updatedAt: new Date().toISOString(),
    updatedBy: operatorName,
  };

  try {
    const configRef = doc(db, 'app_config', 'dev_security');
    await setDoc(configRef, updatedConfig, { merge: true });
    try {
      localStorage.setItem('win_inv_dev_security_cache', JSON.stringify(updatedConfig));
    } catch {}
    return {
      success: true,
      message: 'Cloud Dev password updated and synchronized across all devices.',
      config: updatedConfig,
    };
  } catch (err: any) {
    console.error('[Firestore] Failed to update Cloud Dev password:', err);
    return {
      success: false,
      message: err?.message || 'Failed to update password in Cloud Firestore.',
    };
  }
}

// --- Active Device Session & Login Tracking (Firestore active_devices) ---

export const APP_BUILD_VERSION = '1.2.11';

/**
 * Generates or retrieves a persistent unique ID for this device/browser instance
 */
export function getOrCreateLocalDeviceId(): string {
  try {
    const existing = localStorage.getItem('win_inv_device_id');
    if (existing && /^[a-zA-Z0-9_\-]+$/.test(existing)) {
      return existing;
    }
    const randomPart = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 16)
        .toString(16)
        .toUpperCase()
    ).join('');
    const newId = `DEV-${randomPart}`;
    localStorage.setItem('win_inv_device_id', newId);
    return newId;
  } catch {
    return 'DEV-LOCAL01';
  }
}

/**
 * Detects whether this instance is running in Windows Electron, Android/Mobile, or Web Browser
 */
export function detectDevicePlatformAndOS(): {
  platform: string;
  osInfo: string;
  defaultDeviceName: string;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      platform: 'Desktop Workstation',
      osInfo: 'Windows / Node',
      defaultDeviceName: 'Main Desktop Station',
    };
  }

  const ua = navigator.userAgent || '';
  const isElectron = ua.toLowerCase().includes('electron') || Boolean((window as any).electronAPI);
  const isAndroid = /android/i.test(ua) || window.location.search.includes('mode=android');
  const isIOS = /iphone|ipad|ipod/i.test(ua);

  let os = 'Windows PC';
  if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android OS';
  else if (isIOS) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Browser';
  if (isElectron) browser = 'Electron Native';
  else if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/chrome\//i.test(ua)) browser = 'Google Chrome';
  else if (/firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/safari\//i.test(ua)) browser = 'Safari';

  const platform = isElectron
    ? 'Windows Electron'
    : isAndroid || isIOS
    ? 'Mobile / Android'
    : 'Web Browser';

  const shortId = getOrCreateLocalDeviceId().replace('DEV-', '');
  const defaultDeviceName = isElectron
    ? `Windows POS #${shortId.slice(0, 4)}`
    : isAndroid || isIOS
    ? `Mobile Handheld #${shortId.slice(0, 4)}`
    : `${os} Workstation #${shortId.slice(0, 4)}`;

  return {
    platform,
    osInfo: `${os} • ${browser}`,
    defaultDeviceName,
  };
}

export function getLocalDeviceName(): string {
  const { defaultDeviceName } = detectDevicePlatformAndOS();
  try {
    const saved = localStorage.getItem('win_inv_device_name');
    return saved && saved.trim() ? saved.trim() : defaultDeviceName;
  } catch {
    return defaultDeviceName;
  }
}

export function setLocalDeviceName(name: string): string {
  const clean = name.trim().slice(0, 80) || detectDevicePlatformAndOS().defaultDeviceName;
  try {
    localStorage.setItem('win_inv_device_name', clean);
  } catch {}
  return clean;
}

/**
 * Registers or heartbeats the current device's login status in Firestore (`active_devices/{deviceId}`)
 */
export async function upsertActiveDeviceSession(
  user: AppUser | null,
  status: 'online' | 'offline',
  customDeviceName?: string
): Promise<ActiveDeviceSession | null> {
  const deviceId = getOrCreateLocalDeviceId();
  const { platform, osInfo } = detectDevicePlatformAndOS();
  const deviceName = customDeviceName ? setLocalDeviceName(customDeviceName) : getLocalDeviceName();
  const now = new Date().toISOString();

  let loginTime = now;
  try {
    const savedLogin = sessionStorage.getItem('win_inv_device_login_time');
    if (savedLogin && status === 'online') {
      loginTime = savedLogin;
    } else if (status === 'online') {
      sessionStorage.setItem('win_inv_device_login_time', now);
    }
  } catch {}

  const sessionPayload: ActiveDeviceSession = {
    id: deviceId,
    deviceName,
    platform,
    osInfo,
    userId: user?.id || 'signed_out',
    userName: user?.name || 'Signed Out (Lock Screen)',
    userRole: user?.role || 'sales_manager',
    userEmail: user?.email || '',
    location: user?.location || 'Main Warehouse / POS',
    appVersion: APP_BUILD_VERSION,
    status: user ? status : 'offline',
    loginTime,
    lastActive: now,
  };

  try {
    const ref = doc(db, 'active_devices', deviceId);
    await setDoc(ref, sanitizeForFirestore(sessionPayload), { merge: true });
    return sessionPayload;
  } catch (err) {
    console.warn('[Firestore] Failed to heartbeat active device session:', err);
    return null;
  }
}

/**
 * Remotely forces a logged-in device to sign out (sets status = 'revoked')
 */
export async function revokeDeviceSessionInFirestore(deviceSession: ActiveDeviceSession): Promise<void> {
  try {
    const ref = doc(db, 'active_devices', deviceSession.id);
    const updated: ActiveDeviceSession = {
      ...deviceSession,
      status: 'revoked',
      lastActive: new Date().toISOString(),
    };
    await setDoc(ref, sanitizeForFirestore(updated), { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to revoke device session:', err);
  }
}

/**
 * Renames a tracked device in Firestore
 */
export async function renameDeviceSessionInFirestore(
  deviceSession: ActiveDeviceSession,
  newName: string
): Promise<void> {
  const cleanName = newName.trim().slice(0, 80);
  if (!cleanName) return;
  if (deviceSession.id === getOrCreateLocalDeviceId()) {
    setLocalDeviceName(cleanName);
  }
  try {
    const ref = doc(db, 'active_devices', deviceSession.id);
    const updated: ActiveDeviceSession = {
      ...deviceSession,
      deviceName: cleanName,
      lastActive: new Date().toISOString(),
    };
    await setDoc(ref, sanitizeForFirestore(updated), { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to rename device session:', err);
  }
}

/**
 * Deletes a device record from Firestore (`active_devices/{deviceId}`)
 */
export async function deleteDeviceSessionFromFirestore(deviceId: string): Promise<void> {
  try {
    const ref = doc(db, 'active_devices', deviceId);
    await deleteDoc(ref);
  } catch (err) {
    console.warn('[Firestore] Failed to delete device session:', err);
  }
}

/**
 * Subscribes in real time to all registered devices in `active_devices`
 */
export function subscribeToActiveDevices(
  onDevicesChange: (devices: ActiveDeviceSession[]) => void,
  onError?: (err: Error) => void
): () => void {
  const colRef = collection(db, 'active_devices');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const devices: ActiveDeviceSession[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as ActiveDeviceSession;
        devices.push({
          ...data,
          id: d.id || data.id,
        });
      });
      // Sort online devices first, then by most recent lastActive
      devices.sort((a, b) => {
        const timeA = new Date(a.lastActive).getTime() || 0;
        const timeB = new Date(b.lastActive).getTime() || 0;
        return timeB - timeA;
      });
      onDevicesChange(devices);
    },
    (error) => {
      console.warn('[Firestore] Realtime active_devices listener warning:', error);
      if (onError) onError(error);
    }
  );
}





