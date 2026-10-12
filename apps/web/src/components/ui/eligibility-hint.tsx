// Inline, per-field eligibility feedback driven by the TA rule engine
// (apps/api/src/domain/ta-rule-engine.ts) — the live /ta/evaluate result is
// already computed for the whole form; this just surfaces the slice that's
// relevant to one particular field, right under that field, and animates in
// the moment the employee interacts with it (matching the "validations
// popping up for that particular employee, per his grade" behaviour).
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, LucideIcon } from "lucide-react";

type Tone = "info" | "success" | "warning";

const TONE_STYLES: Record<Tone, { bg: string; text: string; icon: LucideIcon }> = {
  info: { bg: "bg-sail-50 border-sail-100", text: "text-sail-700", icon: Info },
  success: { bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700", icon: CheckCircle2 },
  warning: { bg: "bg-amber-50 border-amber-100", text: "text-amber-700", icon: AlertTriangle },
};

export function EligibilityHint({ tone = "info", children }: { tone?: Tone; children: React.ReactNode }) {
  const { bg, text, icon: Icon } = TONE_STYLES[tone];
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={String(children)}
        initial={{ opacity: 0, y: -4, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.15 }}
        className={`mt-1.5 flex items-start gap-1.5 overflow-hidden rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug ${bg} ${text}`}
      >
        <Icon className="mt-0.5 h-3 w-3 shrink-0" />
        <span>{children}</span>
      </motion.div>
    </AnimatePresence>
  );
}
