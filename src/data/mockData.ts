import { InventoryItem, StockMovement, Supplier, PurchaseOrder, AppSettings, AppUser } from '../types';

export const defaultUsers: AppUser[] = [
  {
    id: 'usr_admin_default',
    name: 'Administrator',
    email: 'admin@company.com',
    role: 'admin',
    location: 'Main Branch',
    phone: '',
    pin: '123456',
    createdAt: '2026-01-01T08:00:00Z',
    status: 'active',
  },
];

export const initialSettings: AppSettings = {
  currency: 'NGN',
  currencySymbol: '₦',
  theme: 'light',
  lowStockThresholdGlobal: 5,
  companyName: 'Inventory Manager',
  warehouseName: 'Main Store',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  taxId: '',
  defaultVatRate: 7.5,
  receiptFooterNote: 'Thank you for your business! Goods sold in good condition are covered by standard warranty.',
  showReceiptMemo: true,
  enableSoundEffects: true,
  compactTableMode: false,
};

export const defaultSuppliers: Supplier[] = [];

export const defaultItems: InventoryItem[] = [];

export const defaultMovements: StockMovement[] = [];

export const defaultPurchaseOrders: PurchaseOrder[] = [];

// Presets for quick switching
export interface IndustryPreset {
  id: string;
  name: string;
  categoryList: string[];
  sampleItems: InventoryItem[];
}

export const industryPresets: IndustryPreset[] = [
  {
    id: 'electronics',
    name: 'PC Hardware & Electronics',
    categoryList: ['Graphics Cards', 'Processors', 'Memory', 'Storage', 'Power Supplies', 'Chassis', 'Cooling', 'Accessories & Cables', 'Peripherals'],
    sampleItems: [],
  },
  {
    id: 'coffee',
    name: 'Specialty Coffee Roastery',
    categoryList: ['Green Beans', 'Roasted Coffee', 'Packaging & Bags', 'Brewing Gear', 'Cleaning & Filters', 'Syrups & Flavors'],
    sampleItems: [],
  },
  {
    id: 'apparel',
    name: 'Apparel & Fashion Boutique',
    categoryList: ['Outerwear', 'Tops & Tees', 'Denim & Pants', 'Footwear', 'Accessories', 'Packaging'],
    sampleItems: [],
  },
  {
    id: 'nigeria_fmcg',
    name: 'West African / Lagos Electronics & FMCG (₦ NGN)',
    categoryList: ['Solar & Inverters', 'Smartphones & Tablets', 'Generators & Power', 'Beverages & Foods', 'Laptops & Gadgets', 'Accessories'],
    sampleItems: [],
  },
];
