// Live-updating Travel Summary — ported from the legacy prototype's
// TravelSummaryCard (see legacy src/components/travel-request/travel-request-form.tsx,
// ~L926) as a sticky sidebar on desktop (xl:block, `sticky top-24`) and a
// compact card above the form on tablet/mobile (xl:hidden), re-keyed by its
// own summary fields so it visibly refreshes as the employee fills the form.
import { motion } from "framer-motion";
import { LucideIcon, MapPin, CalendarClock, Route, PlaneTakeoff, TrainFront, IndianRupee, Hash, ClipboardCheck } from "lucide-react";
import { Card } from "../ui/card.js";
import { StatusChip } from "./status-chip.js";
import { TourStatus } from "../../types.js";

export interface TravelSummaryData {
  requestNumber: string;
  controlNumber?: string | null;
  status: TourStatus;
  tourType: string;
  destinationLabel: string;
  durationDays: number;
  roadTravelPermission: string;
  airTravelPermission: string;
  railTravelPermission: string;
  railEntitlement?: string | null;
  advanceRequired: boolean;
  appliedTotal: number;
  pendingAuthority?: string | null;
}

function SummaryRow({ label, value, icon: Icon }: { label: string; value: string; icon?: LucideIcon }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-steel-400">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-steel-800">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-sail-500" />}
        <span className="truncate">{value}</span>
      </p>
    </div>
  );
}

function formatCurrency(n: number) {
  if (!n) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function TravelSummaryCard({ data, compact = false }: { data: TravelSummaryData; compact?: boolean }) {
  const {
    requestNumber,
    controlNumber,
    status,
    tourType,
    destinationLabel,
    durationDays,
    roadTravelPermission,
    airTravelPermission,
    railTravelPermission,
    railEntitlement,
    advanceRequired,
    appliedTotal,
    pendingAuthority,
  } = data;

  return (
    <motion.div
      key={`${destinationLabel}-${durationDays}-${tourType}-${appliedTotal}-${status}`}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={compact ? "border-sail-200/70" : "shadow-card-hover"}>
        <div className={`flex items-center justify-between rounded-t-2xl border-b border-steel-100 bg-gradient-to-r from-sail-50 to-white px-5 ${compact ? "py-3" : "py-4"}`}>
          <span className="flex items-center gap-2 text-sm font-semibold text-steel-800">
            <ClipboardCheck className="h-4 w-4 text-sail-500" />
            Travel Summary
          </span>
          <span className="flex items-center gap-1 rounded-full bg-sail-100 px-2 py-0.5 text-[10px] font-semibold text-sail-700">
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-sail-500"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            Live
          </span>
        </div>

        <div className={`grid gap-4 p-5 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2"}`}>
          <SummaryRow label="Request No." value={requestNumber} icon={Hash} />
          {controlNumber && <SummaryRow label="Control No." value={controlNumber} icon={Hash} />}
          <SummaryRow label="Tour Type" value={tourType || "—"} />
          <SummaryRow label="Destination" value={destinationLabel || "—"} icon={MapPin} />
          <SummaryRow
            label="Duration"
            value={durationDays > 0 ? `${durationDays} day${durationDays > 1 ? "s" : ""}` : "—"}
            icon={CalendarClock}
          />
          <SummaryRow label="Road Travel" value={roadTravelPermission} icon={Route} />
          <SummaryRow label="Air Travel" value={airTravelPermission} icon={PlaneTakeoff} />
          <SummaryRow
            label="Rail Travel"
            value={railTravelPermission === "Yes" && railEntitlement ? `${railTravelPermission} — ${railEntitlement}` : railTravelPermission}
            icon={TrainFront}
          />
          <SummaryRow
            label="Advance"
            value={appliedTotal > 0 ? formatCurrency(appliedTotal) : advanceRequired ? "Pending amount" : "Not required"}
            icon={IndianRupee}
          />
          {!compact && (
            <>
              <div className="col-span-2 h-px bg-steel-100" />
              <SummaryRow label="Pending With" value={pendingAuthority ?? "Forwarding Authority"} />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-steel-400">Current Status</p>
                <div className="mt-1"><StatusChip status={status} /></div>
              </div>
            </>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
