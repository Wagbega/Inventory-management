import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { CloudBackupSnapshot } from '../types';

// Initialize or reuse Firebase App instance
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Google Drive scope for file creation and management
export const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  webViewLink?: string;
  webContentLink?: string;
  description?: string;
}

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token might need a fresh popup if cached in-memory token was cleared on page reload
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleDrive = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Google Drive authorization token');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Drive sign in failed:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const signOutGoogleDrive = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export const getDriveAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getDriveUser = (): User | null => {
  return auth.currentUser;
};

/**
 * Ensures a dedicated folder exists on Google Drive for Inventory Backups.
 */
export async function getOrCreateDriveBackupFolder(
  folderName = 'Inventory_Cloud_Backups'
): Promise<string> {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('Not signed in to Google Drive. Please connect your account first.');

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name%3D'${encodeURIComponent(
    folderName
  )}'+and+mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse&fields=files(id,name)`;

  const response = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to query Google Drive folder: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  // Create folder
  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Automated and on-demand cloud backups from Inventory Management System',
    }),
  });

  if (!createResponse.ok) {
    throw new Error(`Failed to create Google Drive backup folder: ${createResponse.statusText}`);
  }

  const created = await createResponse.json();
  return created.id;
}

/**
 * Uploads a file (JSON or CSV) to Google Drive using multipart upload.
 */
export async function uploadFileToDrive(
  fileName: string,
  content: string,
  mimeType: string,
  description?: string,
  folderId?: string
): Promise<DriveFileInfo> {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('Google Drive access token missing. Please sign in to Google Drive.');

  let targetFolderId = folderId;
  if (!targetFolderId) {
    targetFolderId = await getOrCreateDriveBackupFolder();
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType,
    parents: targetFolderId ? [targetFolderId] : undefined,
    description: description || 'Backup snapshot created from Inventory Management App',
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    content +
    closeDelimiter;

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,createdTime,webViewLink,webContentLink,description',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Google Drive Upload Failed: ${uploadResponse.status} ${errText}`);
  }

  const uploadedFile: DriveFileInfo = await uploadResponse.json();
  return uploadedFile;
}

/**
 * Uploads a complete snapshot JSON directly to Google Drive.
 */
export async function uploadSnapshotToGoogleDrive(
  snapshot: CloudBackupSnapshot,
  customNotes?: string
): Promise<DriveFileInfo> {
  const dateStr = new Date(snapshot.timestamp)
    .toISOString()
    .slice(0, 19)
    .replace(/[:T]/g, '-');
  const fileName = `inventory-snapshot-${snapshot.type}-${dateStr}.json`;
  const content = JSON.stringify(snapshot, null, 2);

  const description = `Snapshot [${snapshot.type.toUpperCase()}] created by ${snapshot.operator} (${
    snapshot.operatorRole
  }). Items: ${snapshot.itemCount}, Movements: ${snapshot.movementCount}, Receipts: ${
    snapshot.receiptCount
  }. Notes: ${customNotes || snapshot.notes || 'None'}`;

  return await uploadFileToDrive(fileName, content, 'application/json', description);
}

/**
 * List all backup files saved in Google Drive (specifically in our app backup folder).
 */
export async function listDriveBackupFiles(): Promise<DriveFileInfo[]> {
  const token = await getDriveAccessToken();
  if (!token) return [];

  try {
    const folderId = await getOrCreateDriveBackupFolder();
    const query = `'${folderId}'+in+parents+and+trashed%3Dfalse`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,mimeType,size,createdTime,webViewLink,webContentLink,description)&orderBy=createdTime+desc&pageSize=50`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to list Google Drive files: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error fetching Google Drive backups:', error);
    throw error;
  }
}

/**
 * Downloads and parses backup content directly from Google Drive.
 */
export async function fetchDriveFileContent(fileId: string): Promise<any> {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('Not authenticated to Google Drive.');

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file from Google Drive: ${response.statusText}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Deletes a backup file from Google Drive.
 * (Workspace Integration Skill Mandate: Destructive operations must be confirmed in UI prior to call)
 */
export async function deleteDriveBackupFile(fileId: string): Promise<boolean> {
  const token = await getDriveAccessToken();
  if (!token) throw new Error('Not authenticated to Google Drive.');

  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete Google Drive file: ${response.statusText}`);
  }

  return true;
}
