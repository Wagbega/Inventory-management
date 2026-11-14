import QRCode from 'qrcode';

// Barcode and QR Code vector generator

// Generate deterministic 1D barcode pattern from any string (Code-128 inspired)
export function generateBarcodeBars(text: string): boolean[] {
  const clean = text.toUpperCase().replace(/[^A-Z0-9-_]/g, '') || 'ITEM-001';
  const bars: boolean[] = [true, false, true, false]; // Start guard

  // Simple deterministic pattern generator based on char codes
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const pattern = [
      (code & 1) !== 0,
      (code & 2) !== 0,
      (code & 4) === 0,
      (code & 8) !== 0,
      (code & 16) === 0,
      (code & 32) !== 0,
      true,
      false,
    ];
    bars.push(...pattern);
  }

  // Checksum bar
  const checksum = clean.split('').reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 1), 0);
  for (let i = 0; i < 4; i++) {
    bars.push(((checksum >> i) & 1) === 1);
  }

  bars.push(true, true, false, true, true); // End guard
  return bars;
}

// Generate real ISO/IEC 18004 compliant 2D QR-matrix with standard quiet zone margin
export function generateQrMatrix(text: string, _legacySize?: number): boolean[][] {
  const safeText = (text && text.trim().length > 0) ? text : 'https://inventory.local';
  try {
    const qr = QRCode.create(safeText, { errorCorrectionLevel: 'M' });
    const moduleCount = qr.modules.size;
    const margin = 2; // Standard quiet zone
    const totalSize = moduleCount + margin * 2;

    const matrix: boolean[][] = Array.from({ length: totalSize }, () => Array(totalSize).fill(false));

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (qr.modules.get(r, c) === 1) {
          matrix[r + margin][c + margin] = true;
        }
      }
    }

    return matrix;
  } catch (error) {
    console.error('Failed to generate standard QR matrix:', error);
    // Return empty fallback matrix with quiet zone
    return Array.from({ length: 25 }, () => Array(25).fill(false));
  }
}

// Generate high-resolution PNG data URL for crystal-clear smartphone camera scanning
export async function generateQrDataUrl(text: string, width = 320): Promise<string> {
  const safeText = (text && text.trim().length > 0) ? text : 'https://inventory.local';
  try {
    return await QRCode.toDataURL(safeText, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error creating QR data URL:', err);
    return '';
  }
}

// Generate SVG string for vector exports
export async function generateQrSvgString(text: string): Promise<string> {
  const safeText = (text && text.trim().length > 0) ? text : 'https://inventory.local';
  try {
    return await QRCode.toString(safeText, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error creating QR SVG:', err);
    return '';
  }
}

