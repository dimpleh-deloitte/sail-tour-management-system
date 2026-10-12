// Shows the employee the maximum amount admissible before they submit
// (client requirement 1, Oct 2026).
//
// Every figure here is computed server-side by
// apps/api/src/domain/entitlement-calculator.ts — this component formats,
// it never derives. That boundary matters: the SSoT forbids re-implementing
// business rules in React, and a cap shown here that disagreed with the cap
// enforced at settlement would be worse than showing nothing.
import { AlertTriangle, BedDouble, Info, Plane, Receipt, Wallet } from "lucide-react";
import { EntitlementBreakdown } from "../../types.js";

function rupees(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function Row({
  icon: Icon,
  label,
  detail,
  amount,
}: {
  icon: typeof Wallet;
  label: string;
  detail: string;
  amount: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-steel-100 py-2.5 last:border-b-0">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sail-600" />
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-steel-800">{label}</div>
          <div className="mt-0.5 text-[11px] leading-snug text-steel-500">{detail}</div>
        </div>
      </div>
      <div className="shrink-0 text-right text-[13px] font-semibold tabular-nums text-steel-900">{amount}</div>
    </div>
  );
}

export function EntitlementPanel({ entitlement }: { entitlement: EntitlementBreakdown | null }) {
  if (!entitlement) {
    return (
      <div className="rounded-xl border border-dashed border-steel-200 bg-steel-50/60 px-4 py-6 text-center">
        <Info className="mx-auto h-5 w-5 text-steel-400" />
        <p className="mt-2 text-[12px] text-steel-500">
          Enter the From and To dates to see the maximum amount admissible for your grade.
        </p>
      </div>
    );
  }

  const { da, lodging, fare, maxComputableAdvance, advisories, gradeLabel } = entitlement;

  return (
    <div className="rounded-xl border border-steel-200 bg-white">
      <div className="border-b border-steel-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-steel-900">Your entitlement for this tour</h3>
            <p className="mt-0.5 text-[11px] text-steel-500">
              Derived from grade {gradeLabel} under SAIL TA Rules-2021.
            </p>
          </div>
          {maxComputableAdvance !== null ? (
            <div className="shrink-0 rounded-lg bg-sail-600 px-3 py-2 text-right">
              <div className="text-[10px] font-medium uppercase tracking-wide text-sail-100">Maximum</div>
              <div className="text-base font-bold leading-tight text-white tabular-nums">
                {rupees(maxComputableAdvance)}
              </div>
            </div>
          ) : (
            <div className="shrink-0 rounded-lg bg-steel-100 px-3 py-2 text-right">
              <div className="text-[10px] font-medium uppercase tracking-wide text-steel-500">Maximum</div>
              <div className="text-[13px] font-semibold leading-tight text-steel-700">At actuals</div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-1">
        <Row
          icon={Wallet}
          label="Daily Allowance (Food & Incidental)"
          detail={da.computation.basis}
          amount={rupees(da.maxAmount)}
        />
        <Row
          icon={BedDouble}
          label="Lodging"
          detail={lodging.note}
          amount={lodging.maxAmount === null ? "At actuals" : rupees(lodging.maxAmount)}
        />
        <Row
          icon={Plane}
          label="Journey fare"
          detail={`Rail ${fare.railEntitlement}${
            fare.roadMileageRate !== null ? ` · Road ₹${fare.roadMileageRate.toFixed(2)}/km` : " · Road at actuals"
          }. Reimbursed at actuals by entitled class — no monetary ceiling applies.`}
          amount="At actuals"
        />
      </div>

      {maxComputableAdvance === null && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-steel-200 bg-steel-50 px-3 py-2 text-[11px] leading-snug text-steel-600">
          <Receipt className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Your grade is entitled to lodging at actuals, so no single maximum figure applies. DA remains capped at{" "}
            {rupees(da.maxAmount)}.
          </span>
        </div>
      )}

      {advisories.length > 0 && (
        <div className="border-t border-steel-100 bg-amber-50/50 px-4 py-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <ul className="space-y-1 text-[11px] leading-snug text-amber-800">
              {advisories.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
