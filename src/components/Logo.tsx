import { cx } from "./ui";

export function Logo({ light, compact }: { light?: boolean; compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <rect x="5" y="8" width="26" height="24" rx="7" fill={light ? "rgba(0,0,0,0.28)" : "var(--brand-deep)"} />
        <rect x="4" y="4" width="26" height="24" rx="7" fill={light ? "rgba(255,255,255,0.16)" : "var(--brand)"} />
        <path d="M11 15h14l-1.3 9.2a2 2 0 0 1-2 1.7h-7.4a2 2 0 0 1-2-1.7L11 15Z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M14.2 15v-1.4a3.8 3.8 0 0 1 7.6 0V15" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="18" cy="20" r="1.6" fill="var(--accent)" />
      </svg>
      {!compact && (
        <span className={cx("text-lg font-semibold tracking-tight", light ? "text-case-ink" : "text-ink")}>
          Shop<span className={light ? "text-accent" : "text-brand"}>Desk</span>
        </span>
      )}
    </div>
  );
}
