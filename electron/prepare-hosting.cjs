/**
 * Cross-platform script to prepare Firebase Hosting updates directory.
 * Copies generated Electron .exe, latest.yml, and .blockmap into dist-hosting/updates/
 * and generates a clean download page at dist-hosting/index.html
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distElectron = path.join(rootDir, 'dist-electron');
const distHosting = path.join(rootDir, 'dist-hosting');
const updatesDir = path.join(distHosting, 'updates');

// Ensure destination directories exist
if (!fs.existsSync(distHosting)) {
  fs.mkdirSync(distHosting, { recursive: true });
}
if (!fs.existsSync(updatesDir)) {
  fs.mkdirSync(updatesDir, { recursive: true });
}

if (!fs.existsSync(distElectron)) {
  console.error('[prepare-hosting] dist-electron directory does not exist. Run "npm run build:win" first.');
  process.exit(1);
}

// Find files to copy: latest.yml, *.exe, *.blockmap
const files = fs.readdirSync(distElectron);
let copiedCount = 0;
let installerName = '';

for (const file of files) {
  if (
    file === 'latest.yml' ||
    file.endsWith('.exe') ||
    file.endsWith('.blockmap')
  ) {
    const src = path.join(distElectron, file);
    const dest = path.join(updatesDir, file);
    fs.copyFileSync(src, dest);
    copiedCount++;
    console.log(`[prepare-hosting] Staged: ${file}`);
    if (file.toLowerCase().includes('setup') && file.endsWith('.exe')) {
      installerName = file;
    } else if (!installerName && file.endsWith('.exe')) {
      installerName = file;
    }
  }
}

// Read current version from package.json
let appVersion = '1.2.11';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  appVersion = pkg.version || appVersion;
} catch (e) {}

// Generate web download page
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inventory Management & POS - Official App Updates</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      max-width: 560px;
      width: 100%;
      padding: 32px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .badge {
      display: inline-block;
      background: #059669;
      color: #ecfdf5;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 16px;
    }
    h1 { margin: 0 0 8px 0; font-size: 24px; color: #ffffff; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #2563eb;
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.2s;
    }
    .btn:hover { background: #1d4ed8; }
    .footer { margin-top: 24px; font-size: 12px; color: #64748b; }
    .code-box {
      margin-top: 20px;
      background: #090d16;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 12px;
      color: #38bdf8;
      text-align: left;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Official Google Firebase Hosting Release</div>
    <h1>Inventory Management & POS</h1>
    <p>Version v${appVersion} is deployed. Installed desktop apps automatically receive updates through this endpoint.</p>
    ${
      installerName
        ? `<a class="btn" href="./updates/${encodeURIComponent(installerName)}" download>Download Windows Installer (v${appVersion})</a>`
        : `<p style="color: #fbbf24;">Installer is being packaged.</p>`
    }
    <div class="code-box">
      Update Endpoint: /updates/latest.yml<br>
      Provider: Firebase Hosting (Google Cloud CDN)
    </div>
    <div class="footer">
      Softcraft Technologies &bull; Powered by Firebase Hosting
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(distHosting, 'index.html'), indexHtml, 'utf8');

console.log(`[prepare-hosting] Successfully staged ${copiedCount} release files into dist-hosting/updates/`);
