import { TourStatus } from "../../types.js";

const LABELS: Record<TourStatus, string> = {
  DRAFT: "Draft",
  PENDING_FORWARDING: "Pending — Forwarding",
  FORWARDED: "Forwarded",
  PENDING_RECOMMENDATION: "Pending — Recommendation",
  RECOMMENDED: "Recommended",
  PENDING_APPROVAL: "Pending — Approval",
  APPROVED: "Approved",
  IN_PROGRESS: "Journey in progress",
  PENDING_EXTENSION_APPROVAL: "Pending — Extension",
  COMPLETED: "Completed — Awaiting bill",
  PENDING_SETTLEMENT_APPROVAL: "Pending — Settlement",
  SETTLED: "Settled",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

// Ported from the legacy prototype's STATUS_COLORS palette (bordered pill,
// tracking-wide caps) — see DESIGN_SYSTEM.md §2.
const COLORS: Record<TourStatus, string> = {
  DRAFT: "bg-steel-100 text-steel-600 border-steel-200",
  PENDING_FORWARDING: "bg-amber-50 text-amber-700 border-amber-200",
  FORWARDED: "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_RECOMMENDATION: "bg-amber-50 text-amber-700 border-amber-200",
  RECOMMENDED: "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  IN_PROGRESS: "bg-sail-50 text-sail-700 border-sail-100",
  PENDING_EXTENSION_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  COMPLETED: "bg-sail-50 text-sail-700 border-sail-100",
  PENDING_SETTLEMENT_APPROVAL: "bg-amber-50 text-amber-700 border-amber-200",
  SETTLED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  CANCELLED: "bg-steel-100 text-steel-500 border-steel-200",
};

export function StatusChip({ status }: { status: TourStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${COLORS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
