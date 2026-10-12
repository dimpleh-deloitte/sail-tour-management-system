import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiClientError } from "../api/client.js";
import { useSession } from "../hooks/use-session.js";
import { TourRequestRecord } from "../types.js";
import { Card, CardHeader, CardBody } from "../components/ui/card.js";
import { Skeleton } from "../components/ui/skeleton.js";
import { Button } from "../components/ui/button.js";
import { StatusChip } from "../components/shared/status-chip.js";
import { ProgressJourney } from "../components/shared/progress-journey.js";
import { AdvanceDetailsTable, AdvanceCategoryLov, AdvanceColumn } from "../components/shared/advance-details-table.js";
import { LifecycleActions } from "../components/shared/lifecycle-actions.js";
import { EntitlementSummary } from "../components/shared/entitlement-summary.js";
import { Link } from "react-router-dom";
import { Receipt, Pencil } from "lucide-react";

const editInputClass =
  "w-full rounded-lg border border-steel-200 px-3 py-2 text-sm focus:border-sail-500 focus:outline-none focus:ring-1 focus:ring-sail-500";

const ACTION_BY_ROLE: Record<string, { forward?: string; approve?: string }> = {
  FORWARDING: { forward: "forward" },
  RECOMMENDING: { forward: "recommend" },
  APPROVING: { forward: "approve" },
};

// Which AdvanceLine column the currently-pending role is allowed to fill in
// — mirrors apps/api/src/modules/workflow/service.ts `advanceColumnForRole`.
const ADVANCE_COLUMN_BY_ROLE: Record<string, AdvanceColumn> = {
  FORWARDING: "forwardedAmount",
  RECOMMENDING: "recommendedAmount",
  APPROVING: "approvedAmount",
};

export function TourDetailPage() {
  const { id } = useParams();
  const { user } = useSession();
  const [record, setRecord] = useState<TourRequestRecord | null>(null);
  const [advanceCategories, setAdvanceCategories] = useState<AdvanceCategoryLov[]>([]);
  const [advanceAmounts, setAdvanceAmounts] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Approver field edits (client requirement 5), seeded from the record once
  // it loads so an untouched field is sent back unchanged.
  const [editOpen, setEditOpen] = useState(false);
  const [edits, setEdits] = useState({
    pnrTicketNumber: "",
    vehicleNumber: "",
    roadTravelPermission: "No",
    competentAuthorityApprover: "",
    purpose: "",
  });

  async function load() {
    if (!id) return;
    const r = await api.get<TourRequestRecord>(`/tours/${id}`);
    setRecord(r);
    setEdits({
      pnrTicketNumber: r.pnrTicketNumber ?? "",
      vehicleNumber: r.vehicleNumber ?? "",
      roadTravelPermission: r.roadTravelPermission,
      competentAuthorityApprover: r.competentAuthorityApprover ?? "",
      purpose: r.purpose,
    });
  }

  useEffect(() => {
    load();
    api.get<AdvanceCategoryLov[]>("/advance-categories").then(setAdvanceCategories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const pendingRoleField =
    record?.status === "PENDING_FORWARDING"
      ? "FORWARDING"
      : record?.status === "PENDING_RECOMMENDATION"
      ? "RECOMMENDING"
      : record?.status === "PENDING_APPROVAL"
      ? "APPROVING"
      : null;

  const canAct = pendingRoleField && user?.roles.includes(pendingRoleField as never);
  const advanceEndpoint = pendingRoleField ? ACTION_BY_ROLE[pendingRoleField]?.forward : undefined;
  const editableAdvanceColumn = canAct && pendingRoleField ? ADVANCE_COLUMN_BY_ROLE[pendingRoleField] : null;

  // Seed the editable amounts from whatever's already on the record (e.g. a
  // reload after a version conflict), keyed by categoryCode, once we know
  // which column this authority may edit.
  useEffect(() => {
    if (!record || !editableAdvanceColumn) return;
    const seeded: Record<string, string> = {};
    for (const line of record.advances) {
      const existing = line[editableAdvanceColumn];
      if (existing !== null && existing !== undefined) seeded[line.categoryCode] = String(existing);
    }
    setAdvanceAmounts(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.requestId, editableAdvanceColumn]);

  async function act(kind: "forward-action" | "reject") {
    if (!record) return;
    setBusy(true);
    setBanner(null);
    try {
      const path =
        kind === "reject"
          ? `/tours/${record.requestId}/reject`
          : `/tours/${record.requestId}/${advanceEndpoint}`;
      const payload: Record<string, unknown> = { expectedVersion: record.versionNo, remarks: remarks || null };
      if (kind === "forward-action" && editableAdvanceColumn) {
        payload.advanceAmounts = advanceCategories.map((c) => ({
          categoryCode: c.code,
          amount: Number(advanceAmounts[c.code] || 0),
        }));
        // Only send edits the authority actually opened and changed — an
        // untouched panel must not rewrite fields with stale values.
        if (editOpen) {
          payload.edits = {
            pnrTicketNumber: edits.pnrTicketNumber || null,
            vehicleNumber: edits.vehicleNumber || null,
            roadTravelPermission: edits.roadTravelPermission,
            competentAuthorityApprover: edits.competentAuthorityApprover || null,
            purpose: edits.purpose,
          };
        }
      }
      const updated = await api.post<TourRequestRecord>(path, payload);
      setRecord(updated);
      setRemarks("");
      setBanner("Action recorded.");
    } catch (err) {
      setBanner(err instanceof ApiClientError ? err.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!record) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const advanceLinesByCategory = Object.fromEntries(record.advances.map((a) => [a.categoryCode, a]));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-lg font-semibold text-steel-800">{record.requestNumber}</h1>
          {record.controlNumber && <p className="font-mono text-xs text-steel-500">{record.controlNumber}</p>}
        </div>
        <StatusChip status={record.status} />
      </div>

      <Card><CardBody><ProgressJourney status={record.status} /></CardBody></Card>

      {banner && <div className="rounded-lg bg-sail-50 px-4 py-3 text-sm text-sail-700">{banner}</div>}

      <Card>
        <CardHeader title="Tour Details" />
        <CardBody className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <Detail label="Employee" value={`${record.employeeName} (${record.staffNo})`} />
          <Detail label="Department" value={record.department} />
          <Detail label="Grade" value={record.gradeCode} />
          <Detail label="Headquarter" value={record.headquarter} />
          <Detail label="Tour Type" value={record.tourType} />
          <Detail label="Destination" value={record.destCode} />
          <Detail label="From — To" value={`${record.travelStartDate} — ${record.travelEndDate}`} />
          <Detail label="Road Permission" value={record.roadTravelPermission} />
          <Detail label="Air Permission" value={record.airTravelPermission} />
          <Detail label="Rail Permission" value={record.railTravelPermission} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Purpose" />
        <CardBody><p className="text-sm text-steel-700">{record.purpose}</p></CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Advance Details"
          subtitle={
            editableAdvanceColumn
              ? "You may enter amounts in your column below; the others are frozen."
              : "Read-only — amounts are entered by the authority currently reviewing this request."
          }
        />
        <CardBody>
          <AdvanceDetailsTable
            categories={advanceCategories}
            lines={advanceLinesByCategory}
            editableColumn={editableAdvanceColumn}
            editableValues={advanceAmounts}
            onEditableChange={(code, value) => setAdvanceAmounts((a) => ({ ...a, [code]: value }))}
          />
        </CardBody>
      </Card>

      {/* Entitlement snapshot taken when the request was raised — the same
          figures the employee saw, so an approver reviews against them. */}
      {record.lastEntitlement && <EntitlementSummary snapshot={record.lastEntitlement} />}

      {user && (
        <LifecycleActions record={record} user={user} onUpdated={setRecord} />
      )}

      {/* Settlement under §11. Shown from approval onwards, not only once
          the tour is complete — an employee needs to know the obligation is
          coming and what has to happen first, rather than having the card
          appear out of nowhere three status transitions later. */}
      {["APPROVED", "IN_PROGRESS", "PENDING_EXTENSION_APPROVAL"].includes(record.status) && (
        <Card>
          <CardBody className="flex items-start gap-2.5">
            <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-steel-400" />
            <div>
              <p className="text-sm font-semibold text-steel-700">Bill Settlement — not yet open</p>
              <p className="mt-0.5 text-xs text-steel-500">
                {record.status === "APPROVED"
                  ? "Acknowledge the start of your journey, then mark the tour complete, to submit your bill."
                  : "Mark the tour complete to submit your bill."}{" "}
                The bill is then due within one month of completing the journey.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {["COMPLETED", "PENDING_SETTLEMENT_APPROVAL", "SETTLED"].includes(record.status) && (
        <Card>
          <CardBody className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-steel-800">Bill Settlement</p>
              <p className="mt-0.5 text-xs text-steel-500">
                {record.settlement
                  ? `Status: ${record.settlement.status}`
                  : "Submit your bill within one month of completing the journey."}
              </p>
            </div>
            <Link to={`/tours/${record.requestId}/settlement`}>
              <Button>
                <Receipt className="mr-1.5 h-3.5 w-3.5" />
                Open settlement
              </Button>
            </Link>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Workflow History" />
        <CardBody>
          <ul className="space-y-2 text-sm">
            {record.workflowHistory.map((h) => (
              <li key={h.historyId} className="flex items-center justify-between border-b border-steel-50 pb-2 last:border-0">
                <span>
                  <span className="font-medium text-steel-800">{h.action}</span> by {h.actorName} ({h.roleCode})
                  {h.remarks && <span className="text-steel-500"> — {h.remarks}</span>}
                </span>
                <span className="text-xs text-steel-400">{new Date(h.actionAt).toLocaleString()}</span>
              </li>
            ))}
            {record.workflowHistory.length === 0 && <p className="text-xs text-steel-400">No actions yet.</p>}
          </ul>
        </CardBody>
      </Card>

      {canAct && (
        <Card>
          <CardHeader title="Take Action" />
          <CardBody>
            <textarea
              placeholder="Remarks (optional)"
              className="w-full rounded-lg border border-steel-200 px-3 py-2 text-sm"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
            {/* Approver edits — client requirement 5. Limited to the
                travel-arrangement fields an authority can legitimately
                correct in place; dates, destination and the employee's own
                details are not editable here, since changing those makes it
                a different request that must go back to the employee. */}
            <div className="mt-4 rounded-xl border border-steel-200 bg-steel-50/60 p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left text-xs font-semibold text-steel-700"
                onClick={() => setEditOpen((v) => !v)}
              >
                <span className="flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit details before acting
                </span>
                <span className="text-steel-400">{editOpen ? "Hide" : "Show"}</span>
              </button>

              {editOpen && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-steel-600">
                    PNR / Ticket No.
                    <input
                      className={`${editInputClass} mt-1`}
                      value={edits.pnrTicketNumber}
                      onChange={(e) => setEdits((p) => ({ ...p, pnrTicketNumber: e.target.value }))}
                    />
                  </label>
                  <label className="block text-xs font-medium text-steel-600">
                    Vehicle Number
                    <input
                      className={`${editInputClass} mt-1`}
                      value={edits.vehicleNumber}
                      onChange={(e) => setEdits((p) => ({ ...p, vehicleNumber: e.target.value }))}
                    />
                  </label>
                  <label className="block text-xs font-medium text-steel-600">
                    Road Travel Permission
                    <select
                      className={`${editInputClass} mt-1`}
                      value={edits.roadTravelPermission}
                      onChange={(e) => setEdits((p) => ({ ...p, roadTravelPermission: e.target.value }))}
                    >
                      {["No", "Own Vehicle", "Hired Vehicle", "Vehicle Retention"].map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-steel-600">
                    Competent Authority Approver
                    <input
                      className={`${editInputClass} mt-1`}
                      value={edits.competentAuthorityApprover}
                      onChange={(e) =>
                        setEdits((p) => ({ ...p, competentAuthorityApprover: e.target.value }))
                      }
                    />
                  </label>
                  <label className="col-span-full block text-xs font-medium text-steel-600">
                    Purpose
                    <textarea
                      rows={2}
                      maxLength={500}
                      className={`${editInputClass} mt-1`}
                      value={edits.purpose}
                      onChange={(e) => setEdits((p) => ({ ...p, purpose: e.target.value }))}
                    />
                  </label>
                  <p className="col-span-full text-[11px] text-steel-400">
                    Any change you make is recorded against your name in the workflow history.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 flex gap-3">
              <Button disabled={busy} onClick={() => act("forward-action")}>
                {pendingRoleField === "FORWARDING" ? "Forward" : pendingRoleField === "RECOMMENDING" ? "Recommend" : "Approve"}
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => act("reject")}>
                Reject
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-steel-400">{label}</p>
      <p className="mt-0.5 text-steel-800">{value}</p>
    </div>
  );
}
