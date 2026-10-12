// Ported from the legacy prototype's ProgressJourney: animated step-fill,
// check icon on completed steps, ring highlight on the current step.
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { TourStatus } from "../../types.js";

const STEPS = ["Draft", "Forwarding", "Recommendation", "Approval", "Approved", "Journey", "Settled"];

// Every status maps to a step explicitly. The post-approval lifecycle
// (Oct 2026) added statuses that are not a simple linear extension — an
// extension request sits back at the journey step, and a rejected settlement
// returns to it — so an index lookup over an ordered array would give the
// wrong answer or -1. CANCELLED and REJECTED are handled separately.
const STEP_INDEX: Partial<Record<TourStatus, number>> = {
  DRAFT: 0,
  PENDING_FORWARDING: 1,
  FORWARDED: 1,
  PENDING_RECOMMENDATION: 2,
  RECOMMENDED: 2,
  PENDING_APPROVAL: 3,
  APPROVED: 4,
  IN_PROGRESS: 5,
  PENDING_EXTENSION_APPROVAL: 5,
  COMPLETED: 5,
  PENDING_SETTLEMENT_APPROVAL: 6,
  SETTLED: 6,
};

export function ProgressJourney({ status }: { status: TourStatus }) {
  // A cancelled request stops where it stopped; like a rejection, it has no
  // meaningful "current" step on the happy path.
  const rejected = status === "REJECTED" || status === "CANCELLED";
  const currentIndex = rejected ? -1 : STEP_INDEX[status] ?? -1;

  return (
    <div className="flex w-full items-center">
      {STEPS.map((label, i) => {
        const done = !rejected && currentIndex > i;
        const current = !rejected && currentIndex === i;
        const state = done ? "completed" : current ? "current" : "pending";
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300 ${
                  state === "completed"
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                    : state === "current"
                    ? "border-sail-500 bg-sail-500 text-white shadow-md shadow-sail-200 ring-4 ring-sail-100"
                    : "border-steel-200 bg-white text-steel-400"
                }`}
              >
                {state === "completed" ? <Check className="h-4 w-4" /> : i + 1}
              </motion.div>
              <span
                className={`hidden text-center text-[11px] font-medium leading-tight sm:block ${
                  state === "completed" ? "text-emerald-600" : state === "current" ? "text-sail-600" : "text-steel-400"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-1.5 h-0.5 flex-1 overflow-hidden rounded-full bg-steel-100 sm:mx-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: currentIndex > i ? "100%" : currentIndex === i ? "50%" : "0%" }}
                  transition={{ delay: i * 0.1 + 0.2, duration: 0.5 }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sail-400"
                />
              </div>
            )}
          </div>
        );
      })}
      {rejected && (
        <span className="ml-3 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
          Rejected
        </span>
      )}
    </div>
  );
}
