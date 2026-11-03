import type { Product } from "./types";

type ProductRow = Omit<Product, "id" | "createdAt" | "updatedAt">;

// Accept the column names shops actually use in their existing spreadsheets.
const ALIASES: Record<keyof ProductRow, string[]> = {
  sku: ["sku", "code", "item code", "product code", "stock code"],
  barcode: ["barcode", "ean", "upc", "gtin", "bar code"],
  name: ["name", "product", "product name", "description", "item", "item name"],
  category: ["category", "cat", "group", "department"],
  brand: ["brand", "make", "supplier brand"],
  cost: ["cost", "buy", "buy price", "buying price", "cost price", "cost ex gst", "buy ex gst"],
  price: ["price", "sell", "sell price", "selling price", "rrp", "retail", "price inc gst", "sell inc gst"],
  qty: ["qty", "quantity", "stock", "on hand", "soh", "stock on hand"],
  reorderLevel: ["reorder", "reorder level", "min", "min qty", "low stock", "reorder point"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export interface ImportResult {
  rows: ProductRow[];
  errors: { row: number; message: string }[];
  mapped: Partial<Record<keyof ProductRow, string>>;
}

export async function parseProductFile(file: File, defaultReorder: number): Promise<ImportResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer());
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headers = Object.keys(raw[0] ?? {});
  const mapped: ImportResult["mapped"] = {};
  for (const [field, aliases] of Object.entries(ALIASES) as [keyof ProductRow, string[]][]) {
    const h = headers.find((x) => aliases.includes(norm(x)));
    if (h) mapped[field] = h;
  }
  const rows: ProductRow[] = [];
  const errors: ImportResult["errors"] = [];
  const seen = new Set<string>();
  raw.forEach((r, i) => {
    const get = (f: keyof ProductRow) => (mapped[f] ? r[mapped[f]!] : "");
    const sku = String(get("sku")).trim();
    const name = String(get("name")).trim();
    const line = i + 2; // header is row 1
    if (!sku && !name) return;
    if (!sku) return errors.push({ row: line, message: "Missing SKU" });
    if (!name) return errors.push({ row: line, message: `Missing product name for ${sku}` });
    if (seen.has(sku.toLowerCase())) return errors.push({ row: line, message: `Duplicate SKU ${sku}` });
    seen.add(sku.toLowerCase());
    const price = num(get("price"));
    if (price <= 0) errors.push({ row: line, message: `${sku}: sell price is 0 - check this row` });
    rows.push({
      sku,
      name,
      barcode: String(get("barcode")).trim(),
      category: String(get("category")).trim() || "Uncategorised",
      brand: String(get("brand")).trim(),
      cost: num(get("cost")),
      price,
      qty: Math.round(num(get("qty"))),
      reorderLevel: mapped.reorderLevel ? Math.round(num(get("reorderLevel"))) : defaultReorder,
    });
  });
  return { rows, errors, mapped };
}

export async function exportWorkbook(fileName: string, sheets: { name: string; rows: Record<string, string | number>[] }[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows);
    const cols = Object.keys(s.rows[0] ?? {});
    ws["!cols"] = cols.map((c) => ({ wch: Math.max(c.length, ...s.rows.slice(0, 200).map((r) => String(r[c] ?? "").length)) + 2 }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  XLSX.writeFile(wb, fileName);
}

export async function downloadTemplate() {
  await exportWorkbook("product-import-template.xlsx", [
    {
      name: "Products",
      rows: [
        { SKU: "CHG-ANK-0001", Barcode: "9300000000001", Name: "Anker 20W USB-C Wall Charger AU Plug", Category: "Chargers & Cables", Brand: "Anker", "Buy ex GST": 9.5, "Sell inc GST": 29.95, Qty: 24, "Reorder level": 5 },
      ],
    },
  ]);
}
