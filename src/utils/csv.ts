import { InventoryItem, StockMovement, ReceiptData, Supplier, PurchaseOrder } from '../types';

export function convertItemsToCSV(items: InventoryItem[]): string {
  const headers = [
    'SKU',
    'Name',
    'Category',
    'Quantity',
    'Unit',
    'Min Stock Alert',
    'Ex Brew Price',
    'Whole Sale Price',
    'Has Promo',
    'Promo Price',
    'Promo Start Date',
    'Promo End Date',
    'Total Asset Value',
    'Margin %',
    'Location',
    'Barcode',
    'Last Restocked',
    'Notes',
  ];

  const rows = items.map((item) => {
    const assetValue = (item.quantity * item.unitCost).toFixed(2);
    const margin = item.retailPrice > 0 ? (((item.retailPrice - item.unitCost) / item.retailPrice) * 100).toFixed(1) : '0';
    return [
      `"${item.sku.replace(/"/g, '""')}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.category.replace(/"/g, '""')}"`,
      item.quantity,
      `"${item.unit}"`,
      item.minQuantity,
      item.unitCost.toFixed(2),
      item.retailPrice.toFixed(2),
      item.hasPromo ? 'Yes' : 'No',
      item.promoPrice !== undefined ? item.promoPrice.toFixed(2) : '',
      `"${item.promoStartDate || ''}"`,
      `"${item.promoEndDate || ''}"`,
      assetValue,
      `${margin}%`,
      `"${item.location.replace(/"/g, '""')}"`,
      `"${item.barcode || item.sku}"`,
      `"${item.lastRestocked || ''}"`,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function exportInventoryToCSV(items: InventoryItem[], filename = 'inventory-export.csv') {
  const csvContent = convertItemsToCSV(items);
  downloadCSVFile(csvContent, filename);
}

export function convertMovementsToCSV(movements: StockMovement[]): string {
  const headers = [
    'Movement ID',
    'Date & Time',
    'SKU',
    'Item Name',
    'Type',
    'Qty Delta',
    'Prev Qty',
    'New Qty',
    'Unit Cost',
    'Total Cost Impact',
    'Operator',
    'Ref #',
    'Reason / Notes',
  ];

  const rows = movements.map((m) => {
    const totalImpact = (Math.abs(m.quantityDelta) * m.unitCost).toFixed(2);
    return [
      `"${m.id}"`,
      `"${m.timestamp}"`,
      `"${m.itemSku}"`,
      `"${m.itemName.replace(/"/g, '""')}"`,
      `"${m.type}"`,
      m.quantityDelta,
      m.previousQuantity,
      m.newQuantity,
      m.unitCost.toFixed(2),
      totalImpact,
      `"${m.operator.replace(/"/g, '""')}"`,
      `"${(m.referenceNumber || '').replace(/"/g, '""')}"`,
      `"${(m.reason || '').replace(/"/g, '""')}"`,
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function exportStockMovementsToCSV(movements: StockMovement[], filename = 'stock-movements-ledger.csv') {
  const csvContent = convertMovementsToCSV(movements);
  downloadCSVFile(csvContent, filename);
}

export function convertReceiptsToCSV(receipts: ReceiptData[]): string {
  const headers = [
    'Receipt ID',
    'Receipt #',
    'Date',
    'Customer Name',
    'Customer Phone',
    'Operator',
    'Payment Method',
    'Item Count',
    'Subtotal',
    'Tax %',
    'Tax Amount',
    'Discount',
    'Grand Total',
    'Amount Paid',
    'Change Due',
    'Items Summary',
  ];

  const rows = receipts.map((r) => {
    const itemsSummary = r.items.map((i) => `${i.name} (x${i.quantity})`).join('; ');
    return [
      `"${r.id}"`,
      `"${r.receiptNumber}"`,
      `"${r.date}"`,
      `"${(r.customerName || 'Counter Customer').replace(/"/g, '""')}"`,
      `"${(r.customerPhone || '').replace(/"/g, '""')}"`,
      `"${r.operator.replace(/"/g, '""')}"`,
      `"${r.paymentMethod}"`,
      r.items.length,
      r.subtotal.toFixed(2),
      r.taxRate,
      r.taxAmount.toFixed(2),
      r.discount.toFixed(2),
      r.grandTotal.toFixed(2),
      r.amountPaid.toFixed(2),
      r.changeDue.toFixed(2),
      `"${itemsSummary.replace(/"/g, '""')}"`,
    ];
  });

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

export function exportReceiptsToCSV(receipts: ReceiptData[], filename = 'sales-receipts-log.csv') {
  const csvContent = convertReceiptsToCSV(receipts);
  downloadCSVFile(csvContent, filename);
}

export function exportAllDataCSVBundle(
  items: InventoryItem[],
  movements: StockMovement[],
  receipts: ReceiptData[],
  suppliers: Supplier[],
  orders: PurchaseOrder[]
) {
  const dateStr = new Date().toISOString().split('T')[0];
  exportInventoryToCSV(items, `inventory-catalog-${dateStr}.csv`);
  setTimeout(() => exportStockMovementsToCSV(movements, `stock-ledger-${dateStr}.csv`), 300);
  setTimeout(() => exportReceiptsToCSV(receipts, `sales-receipts-${dateStr}.csv`), 600);
}

function downloadCSVFile(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function parseCSVToItems(csvText: string): Partial<InventoryItem>[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  // Parse header line
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const items: Partial<InventoryItem>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length === 0 || !cols.some((c) => c)) continue;

    const item: Partial<InventoryItem> = {
      id: 'item_' + Math.random().toString(36).substring(2, 9),
      sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000),
      name: 'Unnamed Item',
      category: 'General',
      quantity: 0,
      minQuantity: 5,
      unitCost: 0,
      retailPrice: 0,
      unit: 'pcs',
      location: 'Main Aisle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRestocked: new Date().toISOString().split('T')[0],
    };

    headers.forEach((h, idx) => {
      const val = cols[idx] || '';
      if (h.includes('sku')) item.sku = val || item.sku;
      else if (h.includes('name') || h.includes('item') || h.includes('product')) item.name = val || item.name;
      else if (h.includes('category') || h.includes('group')) item.category = val || item.category;
      else if (h.includes('quantity') || h.includes('qty') || h.includes('stock')) item.quantity = Number(val) || 0;
      else if (h.includes('min') || h.includes('alert') || h.includes('reorder')) item.minQuantity = Number(val) || 5;
      else if (h.includes('exbrew') || h.includes('cost')) item.unitCost = Number(val.replace(/[^0-9.]/g, '')) || 0;
      else if (h.includes('promoprice')) {
        const num = Number(val.replace(/[^0-9.]/g, ''));
        if (num > 0) {
          item.promoPrice = num;
          item.hasPromo = true;
        }
      } else if (h.includes('haspromo')) {
        item.hasPromo = val.toLowerCase() === 'yes' || val.toLowerCase() === 'true';
      } else if (h.includes('promostart')) {
        item.promoStartDate = val;
      } else if (h.includes('promoend')) {
        item.promoEndDate = val;
      } else if (h.includes('wholesale') || h.includes('price') || h.includes('retail') || h.includes('sell')) {
        item.retailPrice = Number(val.replace(/[^0-9.]/g, '')) || 0;
      } else if (h.includes('location') || h.includes('bin') || h.includes('shelf')) item.location = val || item.location;
      else if (h.includes('unit')) item.unit = val || 'pcs';
      else if (h.includes('barcode')) item.barcode = val;
      else if (h.includes('notes') || h.includes('description')) item.notes = val;
    });

    items.push(item);
  }

  return items;
}
