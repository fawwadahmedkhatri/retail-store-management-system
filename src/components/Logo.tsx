import { cx } from "./ui";

export function Logo({ light, compact }: { light?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={light ? "rgba(255,255,255,0.14)" : "var(--brand)"} />
        <path d="M9 12h14l-1.4 10.2a2 2 0 0 1-2 1.8h-7.2a2 2 0 0 1-2-1.8L9 12Z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12.5 12V10.5a3.5 3.5 0 0 1 7 0V12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="17.5" r="1.6" fill="var(--accent)" />
      </svg>
      {!compact && (
        <span className={cx("text-lg font-semibold tracking-tight", light ? "text-white" : "text-ink")}>
          Shop<span className={light ? "text-white/70" : "text-brand"}>Desk</span>
        </span>
      )}
    </div>
  );
}
