export type StockStatus = 'in_stock' | 'low_stock' | 'critical' | 'out_of_stock' | 'overstocked';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number; // Low stock threshold
  maxQuantity?: number; // Overstock threshold
  unitCost: number; // Ex Brew price (Acquisition / Brewery cost)
  retailPrice: number; // Whole Sale price (Standard selling price)
  hasPromo?: boolean; // Whether item has a promotional price configured
  promoPrice?: number; // Promotional selling price during promo week/month
  promoStartDate?: string; // YYYY-MM-DD start of promo
  promoEndDate?: string; // YYYY-MM-DD end of promo
  location: string; // Warehouse Bin/Shelf (e.g. A-12, Bin 3)
  supplierId?: string;
  barcode?: string;
  description?: string;
  unit: string; // pcs, kg, boxes, sets, etc.
  lastRestocked: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export type MovementType = 'in_purchase' | 'in_return' | 'in_adjustment' | 'out_sale' | 'out_damaged' | 'out_loss' | 'out_adjustment';

export interface StockMovement {
  id: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  type: MovementType;
  quantityDelta: number; // + or -
  previousQuantity: number;
  newQuantity: number;
  unitCost: number;
  timestamp: string;
  referenceNumber?: string; // PO#, Invoice#, Order#
  operator: string;
  reason?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  leadTimeDays: number;
  address: string;
  notes?: string;
}

export interface PurchaseOrderItem {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  totalAmount: number;
  notes?: string;
}

export interface ReceiptLineItem {
  itemId?: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  regularPrice?: number;
  isPromo?: boolean;
  unit?: string;
  discount?: number;
  total: number;
}

export type PaymentMethod =
  | 'Cash'
  | 'POS / Card'
  | 'Bank Transfer'
  | 'USSD'
  | 'Credit / On Account'
  | 'Cheque';

export interface ReceiptData {
  id: string;
  receiptNumber: string;
  date: string;
  type: 'sale' | 'dispatch' | 'inbound' | 'adjustment';
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  taxId?: string; // TIN or VAT registration
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  operator: string;
  paymentMethod: PaymentMethod;
  items: ReceiptLineItem[];
  subtotal: number;
  taxRate: number; // e.g. 7.5 for 7.5%
  taxAmount: number;
  discount: number;
  grandTotal: number;
  amountPaid: number;
  changeDue: number;
  notes?: string;
  showMemo?: boolean; // Whether memo / warranty terms appear on printed slip
  barcode?: string;
}

export type UserRole = 'admin' | 'supervisor' | 'sales_manager';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  location?: string; // e.g. "Main Office (HQ)", "Branch 1 (Ikeja)", "Branch 2 (Abuja)", "Warehouse / Depot"
  phone?: string;
  pin?: string;
  createdAt: string;
  status: 'active' | 'inactive';
}

export interface SupervisorPresence {
  id: string; // user id or session id
  userId: string;
  userName: string;
  role: UserRole;
  location: string;
  lastSeen: string;
  activeTab?: string;
  deviceInfo?: string;
}

export interface ActiveDeviceSession {
  id: string; // Unique persistent device ID (e.g., DEV-8F3A92)
  deviceName: string; // Custom label or auto-detected workstation name
  platform: string; // 'Windows Electron' | 'Mobile / Android' | 'Web Browser'
  osInfo: string; // OS & browser summary
  userId: string;
  userName: string;
  userRole: UserRole;
  userEmail?: string;
  location: string;
  appVersion: string;
  status: 'online' | 'offline' | 'revoked';
  loginTime: string;
  lastActive: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: 'sale' | 'dispatch' | 'reconciliation' | 'expense' | 'deposit' | 'stock_adjustment' | 'po';
  title: string;
  description: string;
  amount?: number;
  operator: string;
  location?: string;
  status?: 'success' | 'warning' | 'info';
  referenceId?: string;
}

export type CloudBackupFrequency = 'manual' | 'daily' | 'weekly' | 'monthly';

export interface CloudBackupSchedule {
  enabled: boolean;
  frequency: CloudBackupFrequency;
  timeOfDay: string; // e.g. "23:00"
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  dayOfMonth: number; // 1-31
  retentionCopies: number; // e.g. 7, 30, 90, 365
  destination: 'google_drive' | 'google_cloud' | 'aws_s3' | 'azure_blob' | 'secure_vault';
  cloudBucketName?: string;
  autoSyncToGoogleDrive?: boolean;
  lastBackupDate?: string;
  nextScheduledDate?: string;
  autoDownloadLocalCopy?: boolean;
}

export interface CloudBackupSnapshot {
  id: string;
  timestamp: string;
  type: CloudBackupFrequency;
  operator: string;
  operatorRole: UserRole;
  sizeBytes: number;
  itemCount: number;
  movementCount: number;
  poCount: number;
  supplierCount: number;
  receiptCount: number;
  userCount: number;
  checksum: string;
  cloudRegion: string;
  status: 'synced' | 'encrypted' | 'verified';
  notes?: string;
  payloadData: {
    items: InventoryItem[];
    movements: StockMovement[];
    suppliers: Supplier[];
    purchaseOrders: PurchaseOrder[];
    receipts: ReceiptData[];
    users: AppUser[];
    settings: AppSettings;
  };
}

export interface AppSettings {
  currency: string;
  currencySymbol: string;
  theme: 'light' | 'dark' | 'system';
  lowStockThresholdGlobal: number;
  companyName: string;
  warehouseName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  taxId?: string;
  defaultVatRate?: number;
  receiptFooterNote?: string;
  showReceiptMemo?: boolean; // Default preference: whether to print memo / warranty terms on receipts
  enableSoundEffects: boolean;
  compactTableMode: boolean;
  customLogoUrl?: string;
}

export type ExpenseCategory =
  | 'electricity'
  | 'vehicle_fuel'
  | 'vehicle_repair'
  | 'miscellaneous'
  | 'home_expenses'
  | 'salary'
  | 'other';

export interface DailyExpense {
  id: string;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  categoryLabel?: string;
  amount: number;
  description: string;
  paymentSource: 'Cash Sales' | 'Bank Transfer' | 'POS Terminal' | 'Other';
  // Vehicle repair specific fields
  vehicleNumber?: string;
  driverName?: string;
  // General metadata
  recipientName?: string;
  receiptOrVoucherNo?: string;
  time?: string;
  createdAt: string;
  recordedBy?: string;
}

export interface BankDeposit {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  depositMethod: 'cash' | 'transfer';
  bankName: string;
  depositorName: string;
  referenceNumber?: string;
  time?: string;
  notes?: string;
  createdAt: string;
  recordedBy?: string;
}

export interface DispatchedProductLine {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
  unitCost?: number;
  quantityTaken: number;
  totalValueTaken: number;
  // Returned unsold fields
  quantityReturned: number;
  quantitySold: number;
  totalValueSold: number;
  totalValueReturned: number;
}

export type RepDispatchStatus = 'active' | 'reconciled';

export interface SalesRepDispatch {
  id: string;
  dispatchNumber: string; // e.g. "DSP-2026-001"
  repName: string; // Sales rep name
  repPhone?: string;
  repUserId?: string;
  vehicleOrRoute?: string; // e.g. "Van 01 - Island Route", "Motorbike A"
  dateDispatched: string; // YYYY-MM-DD
  timeDispatched: string; // e.g. "08:30 AM"
  
  items: DispatchedProductLine[];
  
  totalSumTaken: number; // Total initial monetary value of stock taken outside
  totalUnsoldReturnedValue: number; // Value of products returned unsold (minused)
  netSalesDue: number; // totalSumTaken - totalUnsoldReturnedValue
  
  // Remittance
  amountRemittedCash: number;
  amountRemittedTransfer: number;
  amountRemittedPOS: number;
  totalAmountRemitted: number;
  shortageOrExcess: number; // totalAmountRemitted - netSalesDue
  
  status: RepDispatchStatus; // 'active' (on field) or 'reconciled' (returned and settled)
  dateReturned?: string;
  timeReturned?: string;
  
  dispatchedBy: string;
  receivedAndAuditedBy?: string;
  deductedStockImmediate?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type ViewTab =
  | 'dashboard'
  | 'live_monitor'
  | 'sales_recap'
  | 'sales_rep_dispatch'
  | 'inventory'
  | 'movements'
  | 'receipts'
  | 'purchase_orders'
  | 'suppliers'
  | 'team'
  | 'barcode_studio';



