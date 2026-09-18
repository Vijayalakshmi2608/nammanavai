import type { ReactNode } from "react";
import type { TrustPathStatus } from "@/lib/designTokens";

const statusStyles: Record<TrustPathStatus, string> = {
  verified: "border-[#36C275]/40 bg-[#36C275]/10 text-[#8bf0b2]",
  challenge: "border-[#F05D5E]/50 bg-[#F05D5E]/10 text-[#ffaaa9]",
  warning: "border-[#F4B740]/50 bg-[#F4B740]/10 text-[#ffd983]",
  info: "border-[#56A8FF]/50 bg-[#56A8FF]/10 text-[#a9d3ff]",
  unknown: "border-[#29485A] bg-[#12344A] text-[#A9BBC7]",
};

export function TrustBadge({ label, status = "info" }: { label: string; status?: TrustPathStatus }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}><span aria-hidden="true" className="mr-1.5">{status === "verified" ? "✓" : status === "challenge" ? "!" : status === "warning" ? "△" : status === "unknown" ? "?" : "i"}</span>{label}</span>;
}

export function TrustCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-[#29485A] bg-[#0D2638] p-6 shadow-[0_20px_60px_rgba(0,0,0,.2)] ${className}`}>{children}</section>;
}

export function ScoreBreakdown({ items }: { items: Array<{ label: string; value: string | number; tone?: TrustPathStatus }> }) {
  return <dl className="grid gap-3 sm:grid-cols-2">{items.map((item) => <div key={item.label} className="rounded-2xl border border-[#29485A] bg-[#12344A] p-3"><dt className="text-xs text-[#A9BBC7]">{item.label}</dt><dd className="mt-1 font-mono text-sm font-semibold text-[#F5F8FA]"><TrustBadge label={String(item.value)} status={item.tone ?? "info"} /></dd></div>)}</dl>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div role="status" className="rounded-2xl border border-dashed border-[#29485A] bg-[#12344A] p-5"><p className="font-semibold text-[#F5F8FA]">{title}</p><p className="mt-1 text-sm text-[#A9BBC7]">{description}</p></div>;
}

export function ErrorState({ title, description }: { title: string; description: string }) {
  return <div role="alert" className="rounded-2xl border border-[#F05D5E]/50 bg-[#F05D5E]/10 p-5"><p className="font-semibold text-[#ffaaa9]">{title}</p><p className="mt-1 text-sm text-[#ffd0cf]">{description}</p></div>;
}
