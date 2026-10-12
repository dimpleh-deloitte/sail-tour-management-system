// The entitlement snapshot stored on a request, shown on the detail page.
//
// This is deliberately the *stored* snapshot rather than a fresh calculation:
// the approver must review against the same ceiling the employee was shown
// when they submitted, even if the rule table has since been versioned.
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Card, CardBody, CardHeader } from "../ui/card.js";
import { EntitlementSnapshot } from "../../types.js";

function rupees(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function EntitlementSummary({ snapshot }: { snapshot: EntitlementSnapshot }) {
  return (
    <Card>
      <CardHeader
        title="Entitlement"
        subtitle={`Grade ${snapshot.gradeLabel} · SAIL TA Rules-2021 · rule v${snapshot.ruleVersion}`}
      />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile
            label="Daily Allowance"
            value={rupees(snapshot.daMaxAmount)}
            detail={`${rupees(snapshot.daRatePerDay)}/day × ${snapshot.daMultiplier}`}
          />
          <Tile
            label="Lodging"
            value={snapshot.lodgingMaxAmount === null ? "At actuals" : rupees(snapshot.lodgingMaxAmount)}
            detail={
              snapshot.lodgingCeilingPerNight === null
                ? `${snapshot.lodgingNights} night(s) · no ceiling`
                : `${rupees(snapshot.lodgingCeilingPerNight)}/night × ${snapshot.lodgingNights} · ${
                    snapshot.locationType === "SPECIFIED" ? "Specified" : "Other"
                  } Location`
            }
          />
          <Tile
            label="Maximum admissible"
            value={
              snapshot.maxComputableAdvance === null ? "At actuals" : rupees(snapshot.maxComputableAdvance)
            }
            detail="DA + lodging. Journey fare is extra, at actuals."
            emphasis
          />
        </div>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-steel-500">
          <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-sail-600" />
          {snapshot.daBasis}
        </p>

        {snapshot.advisories.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <ul className="space-y-1 text-[11px] leading-snug text-amber-800">
                {snapshot.advisories.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function Tile({
  label,
  value,
  detail,
  emphasis,
}: {
  label: string;
  value: string;
  detail: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        emphasis ? "border-sail-100 bg-sail-50" : "border-steel-200 bg-white"
      }`}
    >
      <p className="text-[10px] uppercase tracking-wide text-steel-400">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums ${emphasis ? "text-sail-700" : "text-steel-900"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-steel-500">{detail}</p>
    </div>
  );
}
