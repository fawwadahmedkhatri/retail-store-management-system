export type Role = "admin" | "staff";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Demo only. Production uses hashed passwords via Auth.js + PostgreSQL. */
  password: string;
  active: boolean;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  /** Buying price per unit, ex GST (what the supplier invoice shows). */
  cost: number;
  /** Selling price per unit, GST inclusive (shelf price). */
  price: number;
  qty: number;
  reorderLevel: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  suburb: string;
  notes: string;
  createdAt: string;
}

export type PaymentMethod = "Cash" | "Card" | "Bank Transfer";

export interface SaleLine {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  /** GST-inclusive unit price at time of sale. */
  unitPrice: number;
  /** Ex-GST unit cost at time of sale, snapshotted for accurate profit. */
  unitCost: number;
  /** Line discount in dollars (total for the line, inc GST). */
  discount: number;
}

export interface Sale {
  id: string;
  invoiceNo: string;
  date: string;
  userId: string;
  customerId: string | null;
  lines: SaleLine[];
  /** Whole-cart discount in dollars, inc GST. */
  cartDiscount: number;
  subtotal: number;
  total: number;
  gst: number;
  payment: PaymentMethod;
  tendered: number | null;
}

export interface ReturnLine {
  productId: string;
  name: string;
  qty: number;
  refund: number;
  unitCost: number;
}

export interface SaleReturn {
  id: string;
  returnNo: string;
  saleId: string;
  invoiceNo: string;
  date: string;
  userId: string;
  lines: ReturnLine[];
  total: number;
  reason: string;
  refundMethod: PaymentMethod;
  restocked: boolean;
}

export interface StockEntry {
  id: string;
  date: string;
  productId: string;
  qty: number;
  cost: number;
  supplier: string;
  reference: string;
  userId: string;
}

export type LogAction =
  | "created"
  | "updated"
  | "deleted"
  | "sale"
  | "return"
  | "stock-in"
  | "import"
  | "login";

export interface ActivityEntry {
  id: string;
  at: string;
  userId: string;
  action: LogAction;
  entity: "Product" | "Customer" | "Sale" | "Return" | "Stock" | "User" | "Settings";
  entityId: string;
  summary: string;
  changes?: { field: string; from: string; to: string }[];
}

export interface ShopSettings {
  name: string;
  abn: string;
  address: string;
  phone: string;
  email: string;
  logo: string | null;
  receiptFooter: string;
  lowStockDefault: number;
}

export interface DbState {
  version: number;
  settings: ShopSettings;
  users: User[];
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  returns: SaleReturn[];
  stockEntries: StockEntry[];
  activity: ActivityEntry[];
  counters: { invoice: number; return: number };
}
