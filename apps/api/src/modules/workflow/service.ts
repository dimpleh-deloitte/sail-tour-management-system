import { store } from "../../repository/store.js";
import { Employee, RoleCode, TourRequestRecord, WorklistStatusFilter } from "../../types.js";
import { assertTransition, pendingRoleForStatus, toWorklistStatus, WorkflowAction } from "../../domain/workflow-state-machine.js";
import { assignControlNumberIfApproved } from "../tours/service.js";
import { ApiError } from "../../middleware/error-handler.js";
import { recordAudit } from "../audit/service.js";
import { canActFor, DelegableRole, delegatorsFor } from "../delegation/service.js";

export interface AdvanceAmountInput {
  categoryCode: string;
  amount: number;
}

/**
 * Field-level corrections an acting authority may make (client requirement 5,
 * Oct 2026). Deliberately narrow: travel-arrangement details an authority can
 * legitimately fix in place. Identity, dates, destination and the advance
 * applied-amount are excluded — changing those makes it a different request,
 * which must go back to the employee rather than be edited through.
 */
export interface ApproverEdits {
  pnrTicketNumber?: string | null;
  vehicleNumber?: string | null;
  roadTravelPermission?: string;
  airTravelPermission?: string;
  railTravelPermission?: string;
  competentAuthorityApprover?: string | null;
  purpose?: string;
}

/** Applies approver edits and returns the changed field names for the audit trail. */
function applyEdits(
  record: TourRequestRecord,
  edits: ApproverEdits | undefined
): { record: TourRequestRecord; changed: string[] } {
  if (!edits) return { record, changed: [] };

  const next: TourRequestRecord = { ...record };
  const changed: string[] = [];

  function set<K extends keyof TourRequestRecord>(key: K, value: TourRequestRecord[K] | undefined) {
    if (value === undefined) return;
    if (next[key] === value) return;
    next[key] = value;
    changed.push(String(key));
  }

  set("pnrTicketNumber", edits.pnrTicketNumber);
  set("vehicleNumber", edits.vehicleNumber);
  set("roadTravelPermission", edits.roadTravelPermission as TourRequestRecord["roadTravelPermission"]);
  set("airTravelPermission", edits.airTravelPermission as TourRequestRecord["airTravelPermission"]);
  set("railTravelPermission", edits.railTravelPermission as TourRequestRecord["railTravelPermission"]);
  set("competentAuthorityApprover", edits.competentAuthorityApprover);
  set("purpose", edits.purpose);

  return { record: next, changed };
}

// Which AdvanceLine column a given workflow role is allowed to write —
// matches the client's confirmed Advance Details screenshot: each stage
// fills in only its own column, the other three stay frozen.
function advanceColumnForRole(role: RoleCode): "forwardedAmount" | "recommendedAmount" | "approvedAmount" | null {
  if (role === "FORWARDING") return "forwardedAmount";
  if (role === "RECOMMENDING") return "recommendedAmount";
  if (role === "APPROVING") return "approvedAmount";
  return null;
}

function applyAdvanceAmounts(
  record: TourRequestRecord,
  role: RoleCode,
  advanceAmounts: AdvanceAmountInput[] | undefined
): TourRequestRecord["advances"] {
  const column = advanceColumnForRole(role);
  if (!column || !advanceAmounts || advanceAmounts.length === 0) return record.advances;
  const byCategory = new Map(advanceAmounts.map((a) => [a.categoryCode, a.amount]));
  return record.advances.map((line) =>
    byCategory.has(line.categoryCode) ? { ...line, [column]: byCategory.get(line.categoryCode)! } : line
  );
}

export class WorkflowConflictError extends ApiError {
  constructor(message: string) {
    super(409, "VERSION_CONFLICT", message);
  }
}

function authorityFieldForRole(role: RoleCode): "forwarding" | "recommending" | "approving" | null {
  if (role === "FORWARDING") return "forwarding";
  if (role === "RECOMMENDING") return "recommending";
  if (role === "APPROVING") return "approving";
  return null;
}

// SSoT §14: "authorities see only assigned requests." An acting authority
// holding a live delegation for this role counts as assigned too (client
// requirement 6, Oct 2026) — see modules/delegation/service.ts.
function assertAssigned(record: TourRequestRecord, user: Employee, role: RoleCode) {
  const field = authorityFieldForRole(role);
  const assignedPersonNumber = field ? record.authorities[field]?.personNumber : null;
  const delegable = field !== null;
  const permitted = delegable
    ? canActFor(user, assignedPersonNumber, role as DelegableRole)
    : assignedPersonNumber === user.personNumber;
  if (!permitted) {
    throw new ApiError(403, "FORBIDDEN", "This request is not assigned to you.");
  }
}

function worklistFor(user: Employee, role: RoleCode, statusFilter?: WorklistStatusFilter) {
  const field = authorityFieldForRole(role);
  // Requests assigned to this user directly, plus those assigned to any
  // authority who has delegated this role to them for today.
  const actingFor = field ? delegatorsFor(user, role as DelegableRole) : [];
  const visibleTo = new Set([user.personNumber, ...actingFor]);
  return [...store.tourRequests.values()]
    .filter((r) => {
      const assigned = field ? r.authorities[field]?.personNumber : null;
      return assigned !== null && assigned !== undefined && visibleTo.has(assigned);
    })
    .filter((r) => {
      const worklistStatus = toWorklistStatus(r.status);
      if (!worklistStatus) return false;
      if (!statusFilter) return true;
      return worklistStatus === statusFilter;
    })
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
}

// GET /api/v1/worklists/forwarding — SSoT §14 "Manage Tour Forwarded"
export function forwardingWorklist(user: Employee, statusFilter?: WorklistStatusFilter) {
  return worklistFor(user, "FORWARDING", statusFilter);
}

// GET /api/v1/worklists/recommendation
export function recommendationWorklist(user: Employee, statusFilter?: WorklistStatusFilter) {
  return worklistFor(user, "RECOMMENDING", statusFilter);
}

// GET /api/v1/worklists/approval — SSoT §14 "Manage Tour Approval"
export function approvalWorklist(user: Employee, statusFilter?: WorklistStatusFilter) {
  return worklistFor(user, "APPROVING", statusFilter);
}

function act(
  user: Employee,
  requestId: string,
  role: RoleCode,
  action: WorkflowAction,
  expectedVersion: number,
  remarks: string | null,
  advanceAmounts?: AdvanceAmountInput[],
  edits?: ApproverEdits
): TourRequestRecord {
  const record = store.tourRequests.get(requestId);
  if (!record) {
    throw new ApiError(404, "NOT_FOUND", "Tour request not found.");
  }
  assertAssigned(record, user, role);

  const currentRole = pendingRoleForStatus(record.status);
  if (currentRole !== role) {
    // Covers both "not this role's turn" and duplicate/replayed actions
    // (SSoT §13: "a request must not be advanced twice by duplicate API
    // calls" / acceptance test "duplicate action is rejected safely").
    throw new WorkflowConflictError(
      `Request is not currently pending at the ${role} stage (status: ${record.status}). It may already have been actioned.`
    );
  }
  if (record.versionNo !== expectedVersion) {
    throw new WorkflowConflictError("This request was modified elsewhere. Reload and retry."); // VAL-16
  }

  const oldStatus = record.status;
  const newStatus = assertTransition(oldStatus, action, role);
  const now = new Date().toISOString();

  // Approver field corrections are applied before the status change, and
  // never on a rejection — a rejected request goes back untouched.
  const { record: edited, changed: editedFields } =
    action === "REJECT" ? { record, changed: [] as string[] } : applyEdits(record, edits);

  let updated: TourRequestRecord = {
    ...edited,
    status: newStatus,
    versionNo: record.versionNo + 1,
    updatedAt: now,
    advances: action === "REJECT" ? record.advances : applyAdvanceAmounts(record, role, advanceAmounts),
    workflowHistory: [
      ...record.workflowHistory,
      {
        historyId: store.newId(),
        actorPersonNumber: user.personNumber,
        actorName: user.name,
        roleCode: role,
        action,
        oldStatus,
        newStatus,
        remarks: remarks ?? null,
        actionAt: now,
      },
    ],
  };
  updated = assignControlNumberIfApproved(updated);

  store.tourRequests.set(requestId, updated);
  recordAudit({
    eventType: `TOUR_${action}`,
    entityType: "TOUR_REQUEST",
    entityId: requestId,
    actorPersonNumber: user.personNumber,
    actorRole: role,
    detail: {
      oldStatus,
      newStatus,
      remarks,
      editedFields: editedFields.length ? editedFields : undefined,
    },
    correlationId: null,
  });
  return updated;
}

export function forward(
  user: Employee,
  requestId: string,
  expectedVersion: number,
  remarks: string | null,
  advanceAmounts?: AdvanceAmountInput[],
  edits?: ApproverEdits
) {
  return act(user, requestId, "FORWARDING", "FORWARD", expectedVersion, remarks, advanceAmounts, edits);
}
export function recommend(
  user: Employee,
  requestId: string,
  expectedVersion: number,
  remarks: string | null,
  advanceAmounts?: AdvanceAmountInput[],
  edits?: ApproverEdits
) {
  return act(user, requestId, "RECOMMENDING", "RECOMMEND", expectedVersion, remarks, advanceAmounts, edits);
}
export function approve(
  user: Employee,
  requestId: string,
  expectedVersion: number,
  remarks: string | null,
  advanceAmounts?: AdvanceAmountInput[],
  edits?: ApproverEdits
) {
  return act(user, requestId, "APPROVING", "APPROVE", expectedVersion, remarks, advanceAmounts, edits);
}
export function reject(user: Employee, requestId: string, expectedVersion: number, remarks: string | null) {
  const record = store.tourRequests.get(requestId);
  if (!record) throw new ApiError(404, "NOT_FOUND", "Tour request not found.");
  const role = pendingRoleForStatus(record.status);
  if (!role) {
    throw new WorkflowConflictError(`Request in status "${record.status}" cannot be rejected.`);
  }
  return act(user, requestId, role, "REJECT", expectedVersion, remarks);
}
