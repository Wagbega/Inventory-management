const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch (e) {
  // electron-updater will be loaded when installed or packaged
  console.log('[Updater] electron-updater not present, auto-update standby.');
}

function getAppIcon() {
  const iconFiles = process.platform === 'win32'
    ? ['icon.ico', 'icon.png', 'icon.svg']
    : ['icon.png', 'icon.ico', 'icon.svg'];

  for (const file of iconFiles) {
    const iconsDirIcon = path.join(__dirname, 'icons', file);
    if (fs.existsSync(iconsDirIcon)) return iconsDirIcon;

    const electronDirIcon = path.join(__dirname, file);
    if (fs.existsSync(electronDirIcon)) return electronDirIcon;

    const buildDirIcon = path.join(__dirname, '../build', file);
    if (fs.existsSync(buildDirIcon)) return buildDirIcon;
  }
  return undefined;
}

function createWindow() {
  const iconPath = getAppIcon();
  const preloadPath = path.join(__dirname, 'preload.cjs');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 850,
    minHeight: 600,
    title: 'Inventory & POS Management',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    autoHideMenuBar: true,
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Initialize auto-updater in packaged environment
  if (!isDev) {
    setupAutoUpdater(win);
  }
}

function setupAutoUpdater(win) {
  if (!autoUpdater) return;

  try {
    autoUpdater.logger = console;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking GitHub Releases for updates...');
      if (win && !win.isDestroyed()) {
        win.webContents.send('updater:status', {
          status: 'checking',
          message: 'Checking GitHub Releases for updates...',
        });
      }
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[AutoUpdater] Update available on GitHub Releases:', info.version);
      if (win && !win.isDestroyed()) {
        win.webContents.send('updater:status', {
          status: 'available',
          version: info.version,
          releaseDate: info.releaseDate,
          releaseNotes: info.releaseNotes,
          message: `Update v${info.version} available! Downloading from GitHub in background...`,
        });
      }
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('[AutoUpdater] Application is up to date.');
      if (win && !win.isDestroyed()) {
        win.webContents.send('updater:status', {
          status: 'latest',
          version: info?.version || app.getVersion(),
          message: 'You are on the latest release.',
        });
      }
    });

    autoUpdater.on('error', (err) => {
      console.warn('[AutoUpdater] Error checking update:', err ? err.message : err);
      if (win && !win.isDestroyed()) {
        win.webContents.send('updater:status', {
          status: 'error',
          message: err ? err.message : 'Error connecting to GitHub Releases.',
        });
      }
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const speed = Math.round(progressObj.bytesPerSecond / 1024);
      const percent = Math.round(progressObj.percent);
      console.log(`[AutoUpdater] Download: ${percent}% (${speed} KB/s)`);
      if (win && !win.isDestroyed()) {
        win.webContents.send('updater:status', {
          status: 'downloading',
          percent,
          speed,
          transferred: progressObj.transferred,
          total: progressObj.total,
        });
      }
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AutoUpdater] Update downloaded from GitHub Releases:', info.version);
      if (win && !win.isDestroyed()) {
        win.webContents.send('updater:status', {
          status: 'downloaded',
          version: info.version,
          message: `Version ${info.version} downloaded and ready to install.`,
        });
      }

      dialog
        .showMessageBox(win, {
          type: 'info',
          title: 'Update Ready to Install',
          message: `Inventory & POS version ${info.version} has been downloaded.`,
          detail: 'Would you like to restart the application now to install the new release?',
          buttons: ['Restart & Install', 'Later'],
          defaultId: 0,
          cancelId: 1,
        })
        .then((result) => {
          if (result.response === 0) {
            autoUpdater.quitAndInstall(false, true);
          }
        });
    });

    // Check 5 seconds after startup, then every 2 hours
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('[AutoUpdater] Initial check warning:', err ? err.message : err);
      });
    }, 5000);

    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 2 * 60 * 60 * 1000);
  } catch (err) {
    console.warn('[AutoUpdater] Setup exception:', err);
  }
}

// IPC Handlers
ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

ipcMain.handle('app:check-for-updates', async () => {
  if (!autoUpdater) {
    return { success: false, message: 'Auto-updater not active in dev environment.' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (err) {
    return { success: false, message: err?.message || 'Failed checking GitHub Releases.' };
  }
});

ipcMain.handle('app:restart-and-install', () => {
  if (autoUpdater) {
    autoUpdater.quitAndInstall(false, true);
    return true;
  }
  return false;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

