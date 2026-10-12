// Bill settlement — §11 (client requirement 8).
//
// The page the employee uses to claim what they actually spent, and the one
// the Approving Authority uses to admit or disallow each line. Every ceiling
// shown comes from the server's entitlement calculator; nothing is derived
// here.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { api, ApiClientError } from "../api/client.js";
import { useSession } from "../hooks/use-session.js";
import { Card, CardBody, CardHeader } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { Skeleton } from "../components/ui/skeleton.js";
import { StatusChip } from "../components/shared/status-chip.js";
import {
  SettlementCategoryCode,
  SettlementPreview,
  TourRequestRecord,
} from "../types.js";

const inputClass =
  "w-full rounded-lg border border-steel-200 px-3 py-2 text-sm focus:border-sail-500 focus:outline-none focus:ring-1 focus:ring-sail-500";

// Settlement categories extend the four advance categories with the two
// cost heads the Rules treat separately at bill stage: lodging (§7.2A,
// which has its own ceiling) and incidentals (§6.1(c) booking charges).
const CATEGORIES: { code: SettlementCategoryCode; label: string; hint: string }[] = [
  { code: "AIR_FARE", label: "Air Fare", hint: "Actuals by entitled class" },
  { code: "RAIL", label: "Rail Fare", hint: "Actuals by entitled class" },
  { code: "ROAD", label: "Road Mileage", hint: "Rate per km or actuals, whichever is lower" },
  { code: "DA", label: "Daily Allowance", hint: "Capped by grade and tour period" },
  { code: "LODGING", label: "Lodging", hint: "Capped by grade and location" },
  { code: "INCIDENTAL", label: "Booking / Incidental", hint: "Reservation, agency and Tatkal charges" },
];

function rupees(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function SettlementPage() {
  const { id } = useParams();
  const { user } = useSession();
  const [record, setRecord] = useState<TourRequestRecord | null>(null);
  const [claimed, setClaimed] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [admitted, setAdmitted] = useState<Record<number, string>>({});
  const [remarks, setRemarks] = useState("");
  const [banner, setBanner] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setRecord(await api.get<TourRequestRecord>(`/tours/${id}`));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const settlement = record?.settlement ?? null;
  const isOwner = !!record && record.personNumber === user?.personNumber;
  const isApprover =
    !!record &&
    !!user?.roles.includes("APPROVING") &&
    record.authorities.approving?.personNumber === user.personNumber;

  const canSubmit = isOwner && record?.status === "COMPLETED";
  const canDecide = isApprover && record?.status === "PENDING_SETTLEMENT_APPROVAL" && !!settlement;

  // What actually gets submitted: only categories with an amount entered.
  const draftLines = useMemo(
    () =>
      CATEGORIES.map((c) => ({ categoryCode: c.code, claimedAmount: Number(claimed[c.code] || 0) })).filter(
        (l) => l.claimedAmount > 0
      ),
    [claimed]
  );

  // What gets previewed: *every* category, including the ones still empty.
  // The ceilings are the main thing this page has to tell the employee, and
  // they must be visible before anything is typed — previewing only the
  // filled-in lines would leave DA and lodging reading "at actuals" on an
  // empty form, which is the opposite of true.
  const previewLines = useMemo(
    () => CATEGORIES.map((c) => ({ categoryCode: c.code, claimedAmount: Number(claimed[c.code] || 0) })),
    [claimed]
  );

  // Live preview of caps and the net position while the employee types.
  useEffect(() => {
    if (!canSubmit || !id) return;
    const handle = setTimeout(() => {
      api
        .post<SettlementPreview>(`/tours/${id}/settlement/preview`, { lines: previewLines })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(handle);
  }, [canSubmit, id, previewLines]);

  // Seed the approver's admitted amounts from what the server defaulted to.
  useEffect(() => {
    if (!settlement) return;
    const seeded: Record<number, string> = {};
    for (const line of settlement.lines) {
      if (line.admittedAmount !== null) seeded[line.lineNo] = String(line.admittedAmount);
    }
    setAdmitted(seeded);
  }, [settlement?.settlementId, settlement?.status]);

  async function submit() {
    if (!record) return;
    setBusy(true);
    setBanner(null);
    try {
      const updated = await api.post<TourRequestRecord>(`/tours/${record.requestId}/settlement`, {
        expectedVersion: record.versionNo,
        lines: draftLines,
        remarks: remarks || null,
      });
      setRecord(updated);
      setRemarks("");
      setBanner({ kind: "success", text: "Settlement submitted for approval." });
    } catch (err) {
      setBanner({
        kind: "error",
        text: err instanceof ApiClientError ? err.message : "The settlement could not be submitted.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "APPROVE" | "REJECT") {
    if (!record || !settlement) return;
    setBusy(true);
    setBanner(null);
    try {
      const updated = await api.post<TourRequestRecord>(`/tours/${record.requestId}/settlement/decision`, {
        expectedVersion: record.versionNo,
        decision,
        lines: settlement.lines.map((l) => ({
          lineNo: l.lineNo,
          admittedAmount: Number(admitted[l.lineNo] ?? l.admittedAmount ?? 0),
        })),
        remarks: remarks || null,
      });
      setRecord(updated);
      setRemarks("");
      setBanner({ kind: "success", text: `Settlement ${decision === "APPROVE" ? "approved" : "rejected"}.` });
    } catch (err) {
      setBanner({
        kind: "error",
        text: err instanceof ApiClientError ? err.message : "The decision could not be recorded.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!record) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // The approver's running total as they edit, so the net position updates live.
  const admittedTotal = settlement
    ? settlement.lines.reduce((s, l) => s + Number(admitted[l.lineNo] ?? l.admittedAmount ?? 0), 0)
    : 0;
  const netAfterEdits = settlement ? admittedTotal - settlement.advanceDrawn : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to={`/tours/${record.requestId}`}
            className="mb-1 inline-flex items-center gap-1 text-xs text-steel-500 hover:text-sail-600"
          >
            <ArrowLeft className="h-3 w-3" /> Back to tour
          </Link>
          <h1 className="font-mono text-lg font-semibold text-steel-800">{record.requestNumber}</h1>
          <p className="text-xs text-steel-500">Bill Settlement · {record.employeeName}</p>
        </div>
        <StatusChip status={record.status} />
      </div>

      {banner && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            banner.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* §11 deadline */}
      {settlement && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${
            settlement.submittedLate
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-steel-200 bg-steel-50 text-steel-600"
          }`}
        >
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {settlement.submittedLate ? "Submitted after the due date" : `Bill due by ${settlement.dueDate}`}
            </p>
            <p className="mt-0.5 text-xs">
              The bill is due within one month of completion of the journey. A late bill makes the advance
              recoverable.
            </p>
          </div>
        </div>
      )}

      {/* --- Employee: enter the claim ---------------------------------- */}
      {canSubmit && (
        <Card>
          <CardHeader
            title="Enter your claim"
            subtitle="Amounts you actually spent, per bills. Entitlement ceilings are applied automatically."
          />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-steel-200 text-left text-[11px] uppercase tracking-wide text-steel-400">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 text-right font-medium">Entitlement ceiling</th>
                    <th className="pb-2 text-right font-medium">Amount claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.map((c) => {
                    const previewLine = preview?.lines.find((l) => l.categoryCode === c.code);
                    const cap = previewLine?.entitlementCap ?? null;
                    const over = cap !== null && Number(claimed[c.code] || 0) > cap;
                    return (
                      <tr key={c.code} className="border-b border-steel-50 last:border-0">
                        <td className="py-2.5">
                          <div className="font-medium text-steel-800">{c.label}</div>
                          <div className="text-[11px] text-steel-400">{c.hint}</div>
                        </td>
                        <td className="py-2.5 text-right tabular-nums text-steel-600">
                          {cap === null ? <span className="text-steel-400">At actuals</span> : rupees(cap)}
                        </td>
                        <td className="py-2.5 pl-4 text-right">
                          <input
                            type="number"
                            min={0}
                            className={`${inputClass} text-right ${over ? "border-amber-300 bg-amber-50" : ""}`}
                            value={claimed[c.code] ?? ""}
                            onChange={(e) => setClaimed((p) => ({ ...p, [c.code]: e.target.value }))}
                          />
                          {over && (
                            <p className="mt-1 text-[11px] text-amber-700">
                              Above the ceiling — {rupees(cap!)} will be admitted.
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {preview && <NetPosition preview={preview} />}

            <textarea
              rows={2}
              placeholder="Remarks (optional)"
              className={`${inputClass} mt-4`}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            <div className="mt-3">
              <Button disabled={busy || draftLines.length === 0} onClick={submit}>
                <Receipt className="mr-1.5 h-3.5 w-3.5" />
                Submit settlement
              </Button>
              {draftLines.length === 0 && (
                <p className="mt-2 text-xs text-steel-400">Enter at least one amount to submit.</p>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* --- Submitted settlement: review / decision --------------------- */}
      {settlement && (
        <Card>
          <CardHeader
            title="Settlement"
            subtitle={
              canDecide
                ? "Admit or reduce each line. An admitted amount can never exceed the entitlement ceiling or the claim."
                : `Status: ${settlement.status}`
            }
          />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-steel-200 text-left text-[11px] uppercase tracking-wide text-steel-400">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 text-right font-medium">Claimed</th>
                    <th className="pb-2 text-right font-medium">Ceiling</th>
                    <th className="pb-2 text-right font-medium">Admitted</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.lines.map((line) => (
                    <tr key={line.lineNo} className="border-b border-steel-50 last:border-0">
                      <td className="py-2.5">
                        <div className="font-medium text-steel-800">
                          {CATEGORIES.find((c) => c.code === line.categoryCode)?.label ?? line.categoryCode}
                        </div>
                        {line.disallowanceReason && (
                          <div className="text-[11px] text-amber-700">{line.disallowanceReason}</div>
                        )}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-steel-700">
                        {rupees(line.claimedAmount)}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-steel-500">
                        {line.entitlementCap === null ? "—" : rupees(line.entitlementCap)}
                      </td>
                      <td className="py-2.5 pl-4 text-right">
                        {canDecide ? (
                          <input
                            type="number"
                            min={0}
                            max={line.entitlementCap ?? line.claimedAmount}
                            className={`${inputClass} text-right`}
                            value={admitted[line.lineNo] ?? ""}
                            onChange={(e) =>
                              setAdmitted((p) => ({ ...p, [line.lineNo]: e.target.value }))
                            }
                          />
                        ) : (
                          <span className="tabular-nums font-medium text-steel-900">
                            {line.admittedAmount === null ? "—" : rupees(line.admittedAmount)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-1.5 rounded-xl border border-steel-200 bg-steel-50/60 p-3 text-sm">
              <SummaryRow label="Total claimed" value={rupees(settlement.totalClaimed)} />
              <SummaryRow
                label="Advance drawn"
                value={rupees(settlement.advanceDrawn)}
              />
              <SummaryRow
                label="Total admitted"
                value={
                  settlement.totalAdmitted !== null
                    ? rupees(settlement.totalAdmitted)
                    : canDecide
                      ? rupees(admittedTotal)
                      : "Pending"
                }
              />
              <div className="mt-2 border-t border-steel-200 pt-2">
                <NetRow
                  net={settlement.netPayable !== null ? settlement.netPayable : canDecide ? netAfterEdits : null}
                />
              </div>
            </div>

            {settlement.approvedByName && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approved by {settlement.approvedByName} on{" "}
                {settlement.approvedAt && new Date(settlement.approvedAt).toLocaleString()}
              </p>
            )}

            {canDecide && (
              <>
                <textarea
                  rows={2}
                  placeholder="Remarks (optional)"
                  className={`${inputClass} mt-4`}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <div className="mt-3 flex gap-2">
                  <Button disabled={busy} onClick={() => decide("APPROVE")}>
                    Approve settlement
                  </Button>
                  <Button variant="destructive" disabled={busy} onClick={() => decide("REJECT")}>
                    Reject settlement
                  </Button>
                </div>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {!canSubmit && !settlement && (
        <Card>
          <CardBody>
            <div className="py-8 text-center">
              <Receipt className="mx-auto h-6 w-6 text-steel-300" />
              <p className="mt-2 text-sm text-steel-500">
                Settlement opens once the tour is marked complete.
              </p>
              <p className="mt-1 text-xs text-steel-400">Current status: {record.status}</p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-steel-500">{label}</span>
      <span className="tabular-nums font-medium text-steel-800">{value}</span>
    </div>
  );
}

/** Positive = payable to the employee; negative = recoverable from them. */
function NetRow({ net }: { net: number | null }) {
  if (net === null) {
    return (
      <div className="flex items-center justify-between">
        <span className="font-semibold text-steel-600">Net position</span>
        <span className="text-steel-400">Pending approval</span>
      </div>
    );
  }
  const recoverable = net < 0;
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 font-semibold text-steel-700">
        {recoverable ? (
          <TrendingDown className="h-4 w-4 text-red-600" />
        ) : (
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        )}
        {recoverable ? "Recoverable from employee" : "Payable to employee"}
      </span>
      <span
        className={`text-base font-bold tabular-nums ${recoverable ? "text-red-700" : "text-emerald-700"}`}
      >
        {rupees(Math.abs(net))}
      </span>
    </div>
  );
}

function NetPosition({ preview }: { preview: SettlementPreview }) {
  const recoverable = preview.netPayable < 0;
  return (
    <div className="mt-4 space-y-1.5 rounded-xl border border-steel-200 bg-steel-50/60 p-3 text-sm">
      <SummaryRow label="Total claimed" value={rupees(preview.totalClaimed)} />
      <SummaryRow label="Admissible within entitlement" value={rupees(preview.defaultAdmitted)} />
      <SummaryRow label="Advance drawn" value={rupees(preview.advanceDrawn)} />
      <div className="mt-2 border-t border-steel-200 pt-2">
        <NetRow net={preview.netPayable} />
      </div>
      {preview.defaultAdmitted < preview.totalClaimed && (
        <p className="flex items-start gap-1.5 pt-1 text-[11px] text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {rupees(preview.totalClaimed - preview.defaultAdmitted)} of your claim is above the entitlement
          ceilings and would be disallowed.
        </p>
      )}
      {recoverable && (
        <p className="pt-1 text-[11px] text-steel-500">
          You drew more in advance than is admissible, so the difference is recoverable.
        </p>
      )}
    </div>
  );
}
