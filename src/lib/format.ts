export const TZ = "Australia/Sydney";

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

export const money = (n: number) => aud.format(Number.isFinite(n) ? n : 0);

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** GST component of a GST-inclusive amount (10% GST => 1/11th). */
export const gstOf = (incGst: number) => round2(incGst / 11);

export const exGst = (incGst: number) => round2(incGst - incGst / 11);

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));

export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-AU", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** YYYY-MM-DD in Sydney time, for grouping by trading day. */
export const dayKey = (iso: string | Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );

/** Milliseconds elapsed since midnight in Sydney (for "so far today" comparisons). */
export const msSinceSydneyMidnight = (d: Date) => {
  const [h, m, s] = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .format(d)
    .split(":")
    .map(Number);
  return ((h * 60 + m) * 60 + s) * 1000 + d.getMilliseconds();
};

export const monthKey =(iso: string | Date) => dayKey(iso).slice(0, 7);

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-AU", { month: "short", year: "numeric" });
};

export const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
};

export const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

export const pad = (n: number, w = 6) => String(n).padStart(w, "0");
