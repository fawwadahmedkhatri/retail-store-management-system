import { gstOf, msSinceSydneyMidnight, pad, round2 } from "./format";
import type { ActivityEntry, Customer, DbState, PaymentMethod, Product, Sale, SaleReturn, User } from "./types";

/** Bump when the seed or data shape changes so browsers re-seed. */
export const DB_VERSION = 4;

/** Demo accounts. Shown on the login screen; replace before going live. */
export const DEMO_USERS: User[] = [
  { id: "u-admin", name: "Sam Taylor", email: "admin@demo.shopdesk.test", role: "admin", password: "demo-admin", active: true },
  { id: "u-staff", name: "Mia Chen", email: "staff@demo.shopdesk.test", role: "staff", password: "demo-staff", active: true },
  { id: "u-staff2", name: "Jack O'Brien", email: "jack@demo.shopdesk.test", role: "staff", password: "demo-staff", active: true },
];

// Deterministic PRNG so every demo looks the same.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATALOGUE: { cat: string; code: string; items: [string, number, number][]; brands: string[] }[] = [
  {
    cat: "Phone Cases",
    code: "CAS",
    brands: ["EFM", "3sixT", "Cygnett", "Spigen", "OtterBox"],
    items: [
      ["Clear Case iPhone 16", 12, 39.95],
      ["Clear Case iPhone 16 Pro", 12, 39.95],
      ["Rugged Case iPhone 16 Pro Max", 22, 69.95],
      ["MagSafe Case iPhone 15", 16, 49.95],
      ["Wallet Case Galaxy S25", 14, 44.95],
      ["Slim Case Galaxy S25 Ultra", 11, 34.95],
      ["Armour Case Pixel 9", 15, 49.95],
      ["Leather Folio iPhone 16", 24, 79.95],
    ],
  },
  {
    cat: "Screen Protectors",
    code: "SCR",
    brands: ["EFM", "3sixT", "Zagg", "Belkin"],
    items: [
      ["Tempered Glass iPhone 16", 4.5, 29.95],
      ["Tempered Glass iPhone 16 Pro Max", 4.5, 29.95],
      ["Privacy Glass iPhone 15", 6, 39.95],
      ["Glass Protector Galaxy S25", 4.5, 29.95],
      ["Film Protector iPad 10th Gen", 7, 34.95],
      ["Camera Lens Guard iPhone 16 Pro", 3, 19.95],
    ],
  },
  {
    cat: "Chargers & Cables",
    code: "CHG",
    brands: ["Anker", "Belkin", "Ugreen", "Baseus", "Cygnett"],
    items: [
      ["20W USB-C Wall Charger AU Plug", 9, 29.95],
      ["35W Dual USB-C Charger AU Plug", 16, 49.95],
      ["65W GaN Charger 3-Port", 28, 89.95],
      ["USB-C to Lightning Cable 1m", 6, 24.95],
      ["USB-C to USB-C Braided Cable 2m", 7, 29.95],
      ["MagSafe Wireless Charger 15W", 22, 69.95],
      ["3-in-1 Wireless Charging Stand", 45, 149.95],
      ["Car Charger Dual USB-C 40W", 11, 34.95],
    ],
  },
  {
    cat: "Power Banks",
    code: "PWR",
    brands: ["Anker", "Belkin", "Mophie", "Baseus"],
    items: [
      ["Power Bank 10,000mAh 20W", 18, 49.95],
      ["Power Bank 20,000mAh 30W", 30, 79.95],
      ["MagSafe Battery Pack 5,000mAh", 26, 69.95],
      ["Laptop Power Bank 25,000mAh 100W", 70, 199.0],
    ],
  },
  {
    cat: "Audio",
    code: "AUD",
    brands: ["JBL", "Sony", "Soundcore", "Jabra", "Apple"],
    items: [
      ["True Wireless Earbuds", 38, 99.95],
      ["Noise Cancelling Earbuds", 95, 249.0],
      ["Over-Ear Bluetooth Headphones", 75, 199.0],
      ["Portable Bluetooth Speaker", 42, 129.95],
      ["Wired Earphones USB-C", 8, 24.95],
      ["Kids Volume-Limited Headphones", 18, 49.95],
    ],
  },
  {
    cat: "Wearables",
    code: "WRB",
    brands: ["3sixT", "Cygnett", "Spigen", "Belkin"],
    items: [
      ["Sport Band Apple Watch 45mm", 7, 29.95],
      ["Milanese Loop Apple Watch 41mm", 12, 44.95],
      ["Watch Charger Puck USB-C", 10, 34.95],
      ["Screen Guard Apple Watch Ultra", 4, 24.95],
    ],
  },
  {
    cat: "Computer Accessories",
    code: "CMP",
    brands: ["Logitech", "Ugreen", "Belkin", "Targus"],
    items: [
      ["Wireless Mouse", 14, 39.95],
      ["Bluetooth Keyboard Compact", 30, 79.95],
      ["7-in-1 USB-C Hub", 32, 89.95],
      ["HDMI Cable 2m 4K", 6, 19.95],
      ["Laptop Sleeve 14in", 15, 49.95],
      ["Webcam 1080p", 38, 99.95],
    ],
  },
  {
    cat: "Storage",
    code: "STO",
    brands: ["SanDisk", "Samsung", "Kingston"],
    items: [
      ["microSD 128GB A2", 13, 34.95],
      ["microSD 256GB A2", 24, 59.95],
      ["USB-C Flash Drive 128GB", 15, 39.95],
      ["Portable SSD 1TB", 85, 199.0],
    ],
  },
  {
    cat: "Car & Mounts",
    code: "CAR",
    brands: ["Belkin", "Baseus", "Ugreen", "iOttie"],
    items: [
      ["Vent Mount MagSafe", 12, 39.95],
      ["Dash Mount Universal", 14, 44.95],
      ["Bike Phone Mount", 11, 34.95],
    ],
  },
  {
    cat: "Gaming",
    code: "GAM",
    brands: ["PowerA", "8BitDo", "Razer"],
    items: [
      ["Wireless Controller", 32, 89.95],
      ["Switch Carry Case", 12, 34.95],
      ["Mobile Gaming Trigger Set", 6, 19.95],
    ],
  },
];

const FIRST = ["Olivia", "Jack", "Charlotte", "William", "Amelia", "Noah", "Isla", "Lachlan", "Mia", "Oliver", "Chloe", "Thomas", "Ava", "Liam", "Grace", "Ethan", "Ruby", "Hamish", "Zoe", "Riley", "Priya", "Arjun", "Mei", "Kenji", "Fatima", "Omar", "Sophie", "Lucas", "Ella", "Cooper"];
const LAST = ["Smith", "Jones", "Williams", "Brown", "Wilson", "Taylor", "Nguyen", "Kelly", "Martin", "Anderson", "Patel", "Walker", "White", "Thompson", "Lee", "Harris", "Ryan", "Chen", "Singh", "Murphy"];
const SUBURBS = ["Parramatta NSW 2150", "Bondi NSW 2026", "Chatswood NSW 2067", "Newtown NSW 2042", "Surry Hills NSW 2010", "Penrith NSW 2750", "Blacktown NSW 2148", "Manly NSW 2095", "Hurstville NSW 2220", "Liverpool NSW 2170", "Strathfield NSW 2135", "Hornsby NSW 2077"];

/** EAN-13 with the GS1 Australia "93" prefix and a valid check digit. */
function ean13(n: number) {
  const body = "93" + pad(4512, 5) + pad(n, 5);
  const sum = body.split("").reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
  return body + ((10 - (sum % 10)) % 10);
}

export function buildSeed(now = new Date()): DbState {
  const r = rng(20261103);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const iso = now.toISOString();

  // --- Products: expand catalogue x brands x colour/variant until we reach 600 ---
  const variants = ["Black", "White", "Blue", "Midnight", "Clear", "Sand", "Graphite", "Green"];
  const products: Product[] = [];
  let n = 1;
  outer: for (let round = 0; round < 10; round++) {
    for (const c of CATALOGUE) {
      for (const [item, cost, price] of c.items) {
        for (const brand of c.brands) {
          if (products.length >= 600) break outer;
          const variant = variants[(round + n) % variants.length];
          const name = `${brand} ${item}${round ? ` - ${variant}` : ""}`;
          if (products.some((p) => p.name === name)) continue;
          const brandFactor = 0.85 + r() * 0.35;
          // Catalogue costs are wholesale list; landed cost (freight, duty) is ~45% higher.
          const landed = 1.45 + r() * 0.25;
          products.push({
            id: `p-${n}`,
            sku: `${c.code}-${brand.slice(0, 3).toUpperCase()}-${pad(n, 4)}`,
            barcode: ean13(n),
            name,
            category: c.cat,
            brand,
            cost: round2(cost * brandFactor * landed),
            price: Math.max(9.95, Math.round(price * brandFactor) - 0.05),
            qty: 0,
            reorderLevel: price > 100 ? 2 : 5,
            createdAt: new Date(now.getTime() - 200 * 864e5).toISOString(),
            updatedAt: iso,
          });
          n++;
        }
      }
    }
  }

  // Popularity weighting so "top sellers" is meaningful.
  const weights = products.map((p) => (p.price < 40 ? 6 : p.price < 90 ? 3 : 1) * (0.3 + r() * 1.7));
  const totalW = weights.reduce((a, b) => a + b, 0);
  const weightedPick = () => {
    let x = r() * totalW;
    for (let i = 0; i < products.length; i++) if ((x -= weights[i]) <= 0) return products[i];
    return products[0];
  };

  // --- Customers ---
  const customers: Customer[] = Array.from({ length: 48 }, (_, i) => {
    const f = pick(FIRST);
    const l = pick(LAST);
    return {
      id: `c-${i + 1}`,
      name: `${f} ${l}`,
      phone: `04${Math.floor(r() * 10)}${Math.floor(r() * 10)} ${String(Math.floor(r() * 1000)).padStart(3, "0")} ${String(Math.floor(r() * 1000)).padStart(3, "0")}`,
      email: `${f}.${l}${i}`.toLowerCase().replace(/[^a-z0-9.]/g, "") + "@example.com",
      suburb: pick(SUBURBS),
      notes: i % 9 === 0 ? "Trade customer - repairs shop" : "",
      createdAt: new Date(now.getTime() - (120 - i) * 864e5).toISOString(),
    };
  });

  // --- 90 days of trading history (Sydney trading hours 9am-6pm, busier on weekends) ---
  const sales: Sale[] = [];
  const sold = new Map<string, number>();
  let invoice = 1000;
  const payments: PaymentMethod[] = ["Card", "Card", "Card", "Card", "Cash", "Cash", "Bank Transfer"];
  const sydHourNow = msSinceSydneyMidnight(now) / 3600e3;
  for (let d = 89; d >= 0; d--) {
    const day = new Date(now.getTime() - d * 864e5);
    const midnight = day.getTime() - msSinceSydneyMidnight(day);
    const dow = new Date(midnight + 12 * 3600e3).getUTCDay();
    let count = Math.floor((dow === 0 ? 10 : dow === 6 ? 26 : 16) + r() * 10 + (89 - d) * 0.06);
    if (d === 0) count = Math.max(3, Math.floor(count * Math.min(1, Math.max(0, sydHourNow - 9) / 9)));
    for (let s = 0; s < count; s++) {
      const at = new Date(midnight + (9 + r() * 9) * 3600e3);
      if (at > now) at.setTime(now.getTime() - Math.floor(r() * 3 * 3600e3));
      const lineCount = 1 + Math.floor(r() * r() * 4);
      const lines: Sale["lines"] = [];
      for (let l = 0; l < lineCount; l++) {
        const p = weightedPick();
        if (lines.some((x) => x.productId === p.id)) continue;
        const qty = r() < 0.85 ? 1 : 2;
        const discount = r() < 0.08 ? round2(p.price * qty * 0.1) : 0;
        lines.push({ productId: p.id, sku: p.sku, name: p.name, qty, unitPrice: p.price, unitCost: p.cost, discount });
        sold.set(p.id, (sold.get(p.id) ?? 0) + qty);
      }
      const subtotal = round2(lines.reduce((a, x) => a + x.unitPrice * x.qty - x.discount, 0));
      const total = subtotal;
      const payment = pick(payments);
      invoice++;
      sales.push({
        id: `s-${invoice}`,
        invoiceNo: `INV-${pad(invoice)}`,
        date: at.toISOString(),
        userId: pick(DEMO_USERS).id,
        customerId: r() < 0.35 ? pick(customers).id : null,
        lines,
        cartDiscount: 0,
        subtotal,
        total,
        gst: gstOf(total),
        payment,
        tendered: payment === "Cash" ? Math.ceil(total / 10) * 10 : null,
      });
    }
  }
  sales.sort((a, b) => a.date.localeCompare(b.date));

  // A few returns linked to real invoices.
  const returns: SaleReturn[] = [];
  let ret = 100;
  for (let i = 0; i < 6; i++) {
    const sale = sales[Math.floor(sales.length * (0.2 + i * 0.13))];
    const line = sale.lines[0];
    ret++;
    const refund = round2(line.unitPrice - line.discount / line.qty);
    returns.push({
      id: `r-${ret}`,
      returnNo: `RTN-${pad(ret, 5)}`,
      saleId: sale.id,
      invoiceNo: sale.invoiceNo,
      date: new Date(new Date(sale.date).getTime() + 2 * 864e5).toISOString(),
      userId: "u-admin",
      lines: [{ productId: line.productId, name: line.name, qty: 1, refund, unitCost: line.unitCost }],
      total: refund,
      reason: ["Faulty - not charging", "Wrong model", "Change of mind (unopened)"][i % 3],
      refundMethod: sale.payment,
      restocked: i % 3 !== 0,
    });
  }

  // Opening stock = sold history + a healthy on-hand level; some items deliberately low.
  products.forEach((p, i) => {
    p.qty = i % 23 === 0 ? Math.floor(r() * 3) : i % 41 === 0 ? 0 : 6 + Math.floor(r() * 30);
  });

  const activity = (<ActivityEntry[]>[
    { id: "a-1", at: new Date(now.getTime() - 3 * 864e5).toISOString(), userId: "u-admin", action: "import", entity: "Product", entityId: "-", summary: "Imported 600 products from Stock List.xlsx" },
    { id: "a-2", at: new Date(now.getTime() - 2 * 864e5).toISOString(), userId: "u-admin", action: "updated", entity: "Product", entityId: products[3].id, summary: `Updated ${products[3].name}`, changes: [{ field: "price", from: "$44.95", to: `$${products[3].price.toFixed(2)}` }] },
    { id: "a-3", at: new Date(now.getTime() - 1 * 864e5).toISOString(), userId: "u-admin", action: "stock-in", entity: "Stock", entityId: products[7].id, summary: `Received 24 x ${products[7].name} (PO-2291, Anker AU)` },
    { id: "a-4", at: new Date(now.getTime() - 20 * 3600e3).toISOString(), userId: "u-staff", action: "created", entity: "Customer", entityId: customers[0].id, summary: `Added customer ${customers[0].name}` },
  ]).reverse(); // newest first, matching how the store prepends entries

  return {
    version: DB_VERSION,
    settings: {
      name: "Harbour Tech Accessories",
      abn: "12 345 678 901",
      address: "Shop 14, 159 Church St, Parramatta NSW 2150",
      phone: "(02) 9000 1234",
      email: "hello@harbourtech.example",
      logo: null,
      receiptFooter: "Thanks for shopping local! Keep your receipt for returns within 30 days. Your rights under the Australian Consumer Law are not affected.",
      lowStockDefault: 5,
    },
    users: DEMO_USERS,
    products,
    customers,
    sales,
    returns,
    stockEntries: [],
    activity,
    counters: { invoice, return: ret },
  };
}
