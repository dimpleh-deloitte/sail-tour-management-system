// Post-approval tour actions (client requirements 2, 3, 4 and 7).
//
// Which actions are offered is decided from the record's status and the
// viewer's role, but the server re-checks every one of them — this component
// only decides what to *show*. The state machine in
// apps/api/src/domain/workflow-state-machine.ts is the authority.
import { useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Flag,
  Ban,
  Route,
  Undo2,
  WalletMinimal,
} from "lucide-react";
import { api, ApiClientError } from "../../api/client.js";
import { Card, CardBody, CardHeader } from "../ui/card.js";
import { Button } from "../ui/button.js";
import { Employee, TourRequestRecord } from "../../types.js";

const inputClass =
  "w-full rounded-lg border border-steel-200 px-3 py-2 text-sm focus:border-sail-500 focus:outline-none focus:ring-1 focus:ring-sail-500";

type ActionKey =
  | "journey-start"
  | "cancel"
  | "withdraw-advance"
  | "extend"
  | "extension-decision"
  | "special-approval"
  | "complete";

export function LifecycleActions({
  record,
  user,
  onUpdated,
}: {
  record: TourRequestRecord;
  user: Employee;
  onUpdated: (r: TourRequestRecord) => void;
}) {
  const [open, setOpen] = useState<ActionKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for the action currently open.
  const [actualStartDate, setActualStartDate] = useState(record.travelStartDate);
  const [reason, setReason] = useState("");
  const [officialReason, setOfficialReason] = useState(false);
  const [newEndDate, setNewEndDate] = useState("");
  const [additionalAdvance, setAdditionalAdvance] = useState("");
  const [remarks, setRemarks] = useState("");

  const isOwner = record.personNumber === user.personNumber;
  const isApprover =
    user.roles.includes("APPROVING") && record.authorities.approving?.personNumber === user.personNumber;
  const isForwarder =
    user.roles.includes("FORWARDING") && record.authorities.forwarding?.personNumber === user.personNumber;

  const pendingExtension = record.extensions.find((e) => e.status === "PENDING");
  const distance = record.lastTaEvaluation?.distance;

  // --- Availability, mirroring the server-side state machine ---------------
  const canAcknowledgeStart =
    record.status === "APPROVED" && !record.journeyAcknowledgement && (isOwner || isForwarder);
  const canCancel =
    isOwner &&
    ["DRAFT", "PENDING_FORWARDING", "PENDING_RECOMMENDATION", "PENDING_APPROVAL", "APPROVED"].includes(
      record.status
    );
  const canWithdrawAdvance =
    isOwner &&
    record.advanceRequired === "Y" &&
    !record.advanceWithdrawnAt &&
    !["COMPLETED", "PENDING_SETTLEMENT_APPROVAL", "SETTLED", "CANCELLED"].includes(record.status);
  const canExtend = isOwner && record.status === "IN_PROGRESS" && !pendingExtension;
  const canCompleteTour = isOwner && record.status === "IN_PROGRESS";
  const canDecideExtension = isApprover && record.status === "PENDING_EXTENSION_APPROVAL" && !!pendingExtension;
  const canAcknowledgeSpecial =
    isApprover && !!distance?.requiresSpecialApproval && !record.specialApproval;

  const anyAvailable =
    canAcknowledgeStart ||
    canCancel ||
    canWithdrawAdvance ||
    canExtend ||
    canCompleteTour ||
    canDecideExtension ||
    canAcknowledgeSpecial;

  async function run(path: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.post<TourRequestRecord>(`/tours/${record.requestId}${path}`, {
        expectedVersion: record.versionNo,
        ...payload,
      });
      onUpdated(updated);
      setOpen(null);
      setReason("");
      setRemarks("");
      setNewEndDate("");
      setAdditionalAdvance("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The action could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Journey acknowledgement, once recorded, is shown as a fact rather
          than an action — requirement 2. */}
      {record.journeyAcknowledgement && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Journey started on {record.journeyAcknowledgement.actualStartDate}</p>
            <p className="mt-0.5 text-xs">
              Acknowledged by {record.journeyAcknowledgement.acknowledgedByName}
              {record.journeyAcknowledgement.acknowledgedByRole === "FORWARDING" && " (controlling officer)"} on{" "}
              {new Date(record.journeyAcknowledgement.acknowledgedAt).toLocaleString()}.
              {record.journeyAcknowledgement.remarks && ` — ${record.journeyAcknowledgement.remarks}`}
            </p>
          </div>
        </div>
      )}

      {record.cancelledAt && (
        <div className="flex items-start gap-2.5 rounded-xl border border-steel-200 bg-steel-50 px-4 py-3 text-sm text-steel-700">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Tour cancelled</p>
            <p className="mt-0.5 text-xs">
              {record.cancellationReason}
              {record.cancellationOfficialReason === "Y" && (
                <>
                  {" "}
                  Cancellation was for official reasons, so cancellation and rebooking charges may be admissible
                  with Competent Authority approval.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {record.advanceWithdrawnAt && (
        <div className="flex items-start gap-2.5 rounded-xl border border-steel-200 bg-steel-50 px-4 py-3 text-sm text-steel-700">
          <Undo2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Advance request withdrawn</p>
            <p className="mt-0.5 text-xs">{record.advanceWithdrawalReason}</p>
          </div>
        </div>
      )}

      {/* >500km special approval — requirement 7. */}
      {record.specialApproval && (
        <div className="flex items-start gap-2.5 rounded-xl border border-sail-100 bg-sail-50 px-4 py-3 text-sm text-sail-700">
          <Route className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Distance acknowledgement recorded</p>
            <p className="mt-0.5 text-xs">
              {record.specialApproval.groundsCode === "DISTANCE_BEYOND_500KM"
                ? `One-way distance ${record.specialApproval.distanceKm} km exceeds 500 km.`
                : "No distance was on record for this route."}{" "}
              Acknowledged by {record.specialApproval.acknowledgedByName} on{" "}
              {new Date(record.specialApproval.acknowledgedAt).toLocaleString()}.
              {record.specialApproval.remarks && ` — ${record.specialApproval.remarks}`}
            </p>
          </div>
        </div>
      )}

      {/* Extension history — requirement 4. */}
      {record.extensions.length > 0 && (
        <Card>
          <CardHeader title="Extensions" />
          <CardBody>
            <ul className="space-y-2 text-sm">
              {record.extensions.map((e) => (
                <li key={e.extensionId} className="border-b border-steel-50 pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-steel-800">
                      {e.previousEndDate} → <strong>{e.newEndDate}</strong>
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        e.status === "APPROVED"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : e.status === "REJECTED"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {e.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-steel-500">
                    {e.reason}
                    {e.additionalAdvanceAmount != null && (
                      <> · Additional advance sought: ₹{e.additionalAdvanceAmount.toLocaleString("en-IN")}</>
                    )}
                    {e.decidedByName && ` · Decided by ${e.decidedByName}`}
                    {e.decisionRemarks && ` — ${e.decisionRemarks}`}
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {anyAvailable && (
        <Card>
          <CardHeader
            title="Tour Actions"
            subtitle="Actions available to you at this stage of the request."
          />
          <CardBody>
            {error && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {canAcknowledgeStart && (
                <Button onClick={() => setOpen(open === "journey-start" ? null : "journey-start")}>
                  <Flag className="mr-1.5 h-3.5 w-3.5" />
                  {isOwner ? "I have started my journey" : "Acknowledge journey start"}
                </Button>
              )}
              {canCompleteTour && (
                <Button onClick={() => setOpen(open === "complete" ? null : "complete")}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Mark tour complete
                </Button>
              )}
              {canExtend && (
                <Button variant="secondary" onClick={() => setOpen(open === "extend" ? null : "extend")}>
                  <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                  Extend tour
                </Button>
              )}
              {canDecideExtension && (
                <Button onClick={() => setOpen(open === "extension-decision" ? null : "extension-decision")}>
                  <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                  Decide extension
                </Button>
              )}
              {canAcknowledgeSpecial && (
                <Button onClick={() => setOpen(open === "special-approval" ? null : "special-approval")}>
                  <Route className="mr-1.5 h-3.5 w-3.5" />
                  Distance acknowledgement
                </Button>
              )}
              {canWithdrawAdvance && (
                <Button
                  variant="secondary"
                  onClick={() => setOpen(open === "withdraw-advance" ? null : "withdraw-advance")}
                >
                  <WalletMinimal className="mr-1.5 h-3.5 w-3.5" />
                  Withdraw advance request
                </Button>
              )}
              {canCancel && (
                <Button variant="destructive" onClick={() => setOpen(open === "cancel" ? null : "cancel")}>
                  <Ban className="mr-1.5 h-3.5 w-3.5" />
                  Cancel tour
                </Button>
              )}
            </div>

            {/* --- Requirement 2: journey start ------------------------- */}
            {open === "journey-start" && (
              <div className="mt-4 space-y-3 rounded-xl border border-steel-200 bg-steel-50/60 p-3">
                <p className="text-xs text-steel-600">
                  {isOwner
                    ? "Confirm the date on which you actually commenced the journey."
                    : "Acknowledge, as controlling officer, that this employee has commenced the journey."}
                </p>
                <label className="block text-xs font-medium text-steel-600">
                  Actual start date
                  <input
                    type="date"
                    className={`${inputClass} mt-1`}
                    value={actualStartDate}
                    onChange={(e) => setActualStartDate(e.target.value)}
                  />
                </label>
                <textarea
                  rows={2}
                  placeholder="Remarks (optional)"
                  className={inputClass}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <Button
                  disabled={busy || !actualStartDate}
                  onClick={() => run("/journey-start", { actualStartDate, remarks: remarks || null })}
                >
                  Confirm journey start
                </Button>
              </div>
            )}

            {/* --- Requirement 4: extension ------------------------------ */}
            {open === "extend" && (
              <div className="mt-4 space-y-3 rounded-xl border border-steel-200 bg-steel-50/60 p-3">
                <p className="text-xs text-steel-600">
                  The tour currently ends on <strong>{record.travelEndDate}</strong>. An extension is approved by
                  your Approving Authority and recomputes your DA and lodging entitlement.
                </p>
                <label className="block text-xs font-medium text-steel-600">
                  New end date
                  <input
                    type="date"
                    min={record.travelEndDate}
                    className={`${inputClass} mt-1`}
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                  />
                </label>
                <label className="block text-xs font-medium text-steel-600">
                  Additional advance sought (optional)
                  <input
                    type="number"
                    min={0}
                    className={`${inputClass} mt-1`}
                    value={additionalAdvance}
                    onChange={(e) => setAdditionalAdvance(e.target.value)}
                  />
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for extension (required)"
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Button
                  disabled={busy || !newEndDate || !reason.trim()}
                  onClick={() =>
                    run("/extend", {
                      newEndDate,
                      reason,
                      additionalAdvanceAmount: additionalAdvance ? Number(additionalAdvance) : null,
                    })
                  }
                >
                  Request extension
                </Button>
              </div>
            )}

            {open === "extension-decision" && pendingExtension && (
              <div className="mt-4 space-y-3 rounded-xl border border-steel-200 bg-steel-50/60 p-3">
                <p className="text-xs text-steel-600">
                  {pendingExtension.requestedByName} has asked to extend this tour from{" "}
                  <strong>{pendingExtension.previousEndDate}</strong> to{" "}
                  <strong>{pendingExtension.newEndDate}</strong>: {pendingExtension.reason}
                </p>
                <textarea
                  rows={2}
                  placeholder="Remarks (optional)"
                  className={inputClass}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      run("/extension-decision", {
                        extensionId: pendingExtension.extensionId,
                        decision: "APPROVE",
                        remarks: remarks || null,
                      })
                    }
                  >
                    Approve extension
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      run("/extension-decision", {
                        extensionId: pendingExtension.extensionId,
                        decision: "REJECT",
                        remarks: remarks || null,
                      })
                    }
                  >
                    Reject extension
                  </Button>
                </div>
              </div>
            )}

            {/* --- Requirement 7: >500km acknowledgement ----------------- */}
            {open === "special-approval" && distance && (
              <div className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-800">{distance.message}</p>
                <textarea
                  rows={2}
                  placeholder="Remarks (optional)"
                  className={inputClass}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <Button
                  disabled={busy}
                  onClick={() => run("/special-approval", { acknowledged: true, remarks: remarks || null })}
                >
                  I acknowledge the distance condition
                </Button>
              </div>
            )}

            {/* --- Requirement 3: advance withdrawal --------------------- */}
            {open === "withdraw-advance" && (
              <div className="mt-4 space-y-3 rounded-xl border border-steel-200 bg-steel-50/60 p-3">
                <p className="text-xs text-steel-600">
                  This retracts your request for a travel advance. The tour request itself continues through the
                  workflow unchanged.
                </p>
                <textarea
                  rows={2}
                  placeholder="Reason for withdrawing the advance (required)"
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Button
                  variant="secondary"
                  disabled={busy || !reason.trim()}
                  onClick={() => run("/withdraw-advance", { reason })}
                >
                  Withdraw advance request
                </Button>
              </div>
            )}

            {/* --- Requirement 3: cancellation --------------------------- */}
            {open === "cancel" && (
              <div className="mt-4 space-y-3 rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-700">
                  Cancelling closes this tour request. This cannot be undone — a new request would have to be
                  raised.
                </p>
                <textarea
                  rows={2}
                  placeholder="Reason for cancellation (required)"
                  className={inputClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <label className="flex items-start gap-2 text-xs text-steel-600">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={officialReason}
                    onChange={(e) => setOfficialReason(e.target.checked)}
                  />
                  <span>
                    Cancellation is necessitated by official reasons
                    <span className="mt-0.5 block text-[11px] text-steel-400">
                      Cancellation and rebooking charges are admissible only on this basis, with
                      Competent Authority approval.
                    </span>
                  </span>
                </label>
                <Button
                  variant="destructive"
                  disabled={busy || !reason.trim()}
                  onClick={() => run("/cancel", { reason, officialReason })}
                >
                  Confirm cancellation
                </Button>
              </div>
            )}

            {open === "complete" && (
              <div className="mt-4 space-y-3 rounded-xl border border-steel-200 bg-steel-50/60 p-3">
                <p className="text-xs text-steel-600">
                  Marking the tour complete opens bill settlement. The bill must then be submitted within one
                  month of completion of the journey, failing which the advance becomes recoverable.
                </p>
                <textarea
                  rows={2}
                  placeholder="Remarks (optional)"
                  className={inputClass}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
                <Button disabled={busy} onClick={() => run("/complete", { remarks: remarks || null })}>
                  Mark tour complete
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
