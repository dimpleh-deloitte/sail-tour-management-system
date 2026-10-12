// Advance Details — fixed four-row table (Air Fare / Rail / Road / DA),
// matching the client's confirmed current-system screenshot (Sep 2026
// conversation) exactly: one column per workflow stage (Applied, Forwarded,
// Recommended, Approved), only ONE of which is ever editable at a time —
// whichever stage is currently acting on the request — with the other
// three frozen/read-only. Shared between Add Tour (Applied, by the
// employee) and Tour Detail (Forwarded/Recommended/Approved, by whichever
// authority is currently logged in).
import { IndianRupee } from "lucide-react";

export interface AdvanceCategoryLov {
  code: string;
  label: string;
}

export interface AdvanceTableLine {
  categoryCode: string;
  appliedAmount: number | null;
  forwardedAmount: number | null;
  recommendedAmount: number | null;
  approvedAmount: number | null;
}

export type AdvanceColumn = "appliedAmount" | "forwardedAmount" | "recommendedAmount" | "approvedAmount";

const COLUMNS: { key: AdvanceColumn; label: string }[] = [
  { key: "appliedAmount", label: "Applied Amount(₹)" },
  { key: "forwardedAmount", label: "Forwarded Amount(₹)" },
  { key: "recommendedAmount", label: "Recommended Amount(₹)" },
  { key: "approvedAmount", label: "Approved Amount(₹)" },
];

function formatFrozen(v: number | null) {
  return v === null || v === undefined ? "-" : `₹${v.toLocaleString("en-IN")}`;
}

export function AdvanceDetailsTable({
  categories,
  lines,
  editableColumn,
  editableValues,
  onEditableChange,
}: {
  categories: AdvanceCategoryLov[];
  /** Existing saved amounts, keyed by categoryCode — empty/undefined before first save. */
  lines: Record<string, AdvanceTableLine | undefined>;
  /** Which single column the current user may edit right now; null = fully read-only (e.g. viewing someone else's request). */
  editableColumn: AdvanceColumn | null;
  /** Controlled string values for the editable column, keyed by categoryCode. */
  editableValues: Record<string, string>;
  onEditableChange: (categoryCode: string, value: string) => void;
}) {
  const total = categories.reduce((sum, c) => {
    if (editableColumn === "appliedAmount") return sum + (Number(editableValues[c.code]) || 0);
    return sum + (lines[c.code]?.appliedAmount ?? 0);
  }, 0);

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-steel-200">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-steel-100 bg-steel-50/70 text-xs uppercase tracking-wide text-steel-400">
            <tr>
              <th className="px-4 py-3">No.</th>
              <th className="px-4 py-3">Details</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-4 py-3">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, i) => {
              const line = lines[cat.code];
              return (
                <tr key={cat.code} className="border-b border-steel-50 last:border-0 even:bg-steel-50/30">
                  <td className="px-4 py-2.5 text-steel-400">
                    <input className={frozenClass} value={i + 1} readOnly />
                  </td>
                  <td className="px-4 py-2.5">
                    <input className={frozenClass} value={cat.label} readOnly />
                  </td>
                  {COLUMNS.map((c) => {
                    const isEditable = editableColumn === c.key;
                    if (isEditable) {
                      return (
                        <td key={c.key} className="px-4 py-2.5">
                          <input
                            type="number"
                            min={0}
                            className="w-full rounded-lg border border-sail-300 bg-white px-3 py-2 text-sm focus:border-sail-500 focus:outline-none focus:ring-1 focus:ring-sail-500"
                            value={editableValues[cat.code] ?? ""}
                            onChange={(e) => onEditableChange(cat.code, e.target.value)}
                            placeholder="0"
                          />
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className="px-4 py-2.5 text-steel-500">
                        {formatFrozen(line?.[c.key] ?? null)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-wide text-steel-400">Total Advance</p>
        <div className="mt-1 flex items-center gap-1.5 rounded-lg bg-steel-50 px-3 py-2 text-sm font-semibold text-sail-700">
          <IndianRupee className="h-3.5 w-3.5" />
          {total.toLocaleString("en-IN")}
        </div>
      </div>
    </div>
  );
}

const frozenClass =
  "w-full rounded-lg border border-steel-100 bg-steel-50 px-3 py-2 text-sm text-steel-500 cursor-not-allowed";
