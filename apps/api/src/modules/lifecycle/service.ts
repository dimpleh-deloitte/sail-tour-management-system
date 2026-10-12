// Post-approval tour lifecycle (client requirements 2, 3, 4 and 7, Oct 2026).
//
// The SSoT's workflow ends at APPROVED. This module carries a sanctioned
// request through the journey itself: start acknowledgement, extension,
// cancellation, advance withdrawal, completion, and the >500km special
// approval acknowledgement. Bill settlement under §11 lives in
// modules/settlement.
//
// Every transition goes through domain/workflow-state-machine.ts — nothing
// here sets a status directly.
import { store } from "../../repository/store.js";
import {
  Employee,
  JourneyAcknowledgement,
  RoleCode,
  TourExtension,
  TourRequestRecord,
  WorkflowHistoryEntry,
} from "../../types.js";
import { assertTransition, WorkflowAction } from "../../domain/workflow-state-machine.js";
import { ApiError } from "../../middleware/error-handler.js";
import { recordAudit } from "../audit/service.js";
import { canActFor } from "../delegation/service.js";
import { buildEntitlementSnapshot } from "../tours/service.js";

export class LifecycleConflictError extends ApiError {
  constructor(message: string) {
    super(409, "VERSION_CONFLICT", message);
  }
}

function load(requestId: string): TourRequestRecord {
  const record = store.tourRequests.get(requestId);
  if (!record) throw new ApiError(404, "NOT_FOUND", "Tour request not found.");
  return record;
}

function assertVersion(record: TourRequestRecord, expectedVersion: number) {
  if (record.versionNo !== expectedVersion) {
    throw new LifecycleConflictError("This request was modified elsewhere. Reload and retry."); // VAL-16
  }
}

function assertOwner(record: TourRequestRecord, user: Employee) {
  if (record.personNumber !== user.personNumber) {
    throw new ApiError(403, "FORBIDDEN", "Only the employee who raised this request may do that.");
  }
}

function historyEntry(
  user: Employee,
  role: RoleCode,
  action: WorkflowHistoryEntry["action"],
  oldStatus: TourRequestRecord["status"],
  newStatus: TourRequestRecord["status"],
  remarks: string | null
): WorkflowHistoryEntry {
  return {
    historyId: store.newId(),
    actorPersonNumber: user.personNumber,
    actorName: user.name,
    roleCode: role,
    action,
    oldStatus,
    newStatus,
    remarks,
    actionAt: new Date().toISOString(),
  };
}

/** Commits a lifecycle transition: bumps the version, appends history, audits. */
function commit(
  user: Employee,
  record: TourRequestRecord,
  role: RoleCode,
  action: WorkflowAction,
  patch: Partial<TourRequestRecord>,
  remarks: string | null,
  auditDetail: Record<string, unknown>
): TourRequestRecord {
  const oldStatus = record.status;
  const newStatus = assertTransition(oldStatus, action, role);
  const now = new Date().toISOString();

  const updated: TourRequestRecord = {
    ...record,
    ...patch,
    status: newStatus,
    versionNo: record.versionNo + 1,
    updatedAt: now,
    workflowHistory: [
      ...record.workflowHistory,
      historyEntry(user, role, action as WorkflowHistoryEntry["action"], oldStatus, newStatus, remarks),
    ],
  };

  store.tourRequests.set(record.requestId, updated);
  recordAudit({
    eventType: `TOUR_${action}`,
    entityType: "TOUR_REQUEST",
    entityId: record.requestId,
    actorPersonNumber: user.personNumber,
    actorRole: role,
    detail: { oldStatus, newStatus, ...auditDetail },
    correlationId: null,
  });
  return updated;
}

// --- Requirement 2: journey start acknowledgement -------------------------

export interface JourneyStartInput {
  expectedVersion: number;
  actualStartDate: string;
  remarks?: string | null;
}

/**
 * Confirmed with the client: available once the advance is approved, and
 * acknowledged either by the employee or by the Forwarding Authority acting
 * as controlling officer.
 */
export function acknowledgeJourneyStart(
  user: Employee,
  requestId: string,
  input: JourneyStartInput
): TourRequestRecord {
  const record = load(requestId);
  assertVersion(record, input.expectedVersion);

  if (record.journeyAcknowledgement) {
    throw new LifecycleConflictError("The start of this journey has already been acknowledged.");
  }

  // Who is acting: the employee themselves, or their Forwarding Authority
  // (including anyone holding a live delegation of that role).
  const isOwner = record.personNumber === user.personNumber;
  const isControllingOfficer =
    user.roles.includes("FORWARDING") &&
    canActFor(user, record.authorities.forwarding?.personNumber, "FORWARDING");

  if (!isOwner && !isControllingOfficer) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Only the employee or their Forwarding Authority (controlling officer) may acknowledge the start of this journey."
    );
  }
  const role: RoleCode = isOwner ? "EMPLOYEE" : "FORWARDING";

  const acknowledgement: JourneyAcknowledgement = {
    acknowledgedBy: user.personNumber,
    acknowledgedByName: user.name,
    acknowledgedByRole: role as "EMPLOYEE" | "FORWARDING",
    acknowledgedAt: new Date().toISOString(),
    actualStartDate: input.actualStartDate,
    remarks: input.remarks ?? null,
  };

  return commit(
    user,
    record,
    role,
    "ACKNOWLEDGE_JOURNEY_START",
    { journeyAcknowledgement: acknowledgement },
    input.remarks ?? null,
    { actualStartDate: input.actualStartDate, acknowledgedByRole: role }
  );
}

// --- Requirement 3: cancellation and advance withdrawal -------------------

export interface CancelInput {
  expectedVersion: number;
  reason: string;
  officialReason: boolean;
}

/**
 * Cancellation is the employee's own action, permitted at any point up to the
 * start of the journey. Once the journey has started the tour is completed
 * and settled instead — the state machine enforces that, since there is no
 * CANCEL transition out of IN_PROGRESS.
 *
 * §6.1(d): charges arising from a cancelled or rescheduled journey are
 * admissible only where the change was necessitated by official reasons and
 * approved by the Competent Authority, so that flag is captured here and
 * carried into settlement.
 */
export function cancel(user: Employee, requestId: string, input: CancelInput): TourRequestRecord {
  const record = load(requestId);
  assertOwner(record, user);
  assertVersion(record, input.expectedVersion);

  const now = new Date().toISOString();
  return commit(
    user,
    record,
    "EMPLOYEE",
    "CANCEL",
    {
      cancelledAt: now,
      cancellationReason: input.reason,
      cancellationOfficialReason: input.officialReason ? "Y" : "N",
    },
    input.reason,
    { officialReason: input.officialReason }
  );
}

export interface WithdrawAdvanceInput {
  expectedVersion: number;
  reason: string;
}

/**
 * Confirmed with the client: this is the employee retracting their *request*
 * for an advance while the tour itself proceeds — not the disbursement of
 * money. The request keeps its current workflow status; only the advance is
 * withdrawn, so this does not go through the state machine.
 */
export function withdrawAdvance(
  user: Employee,
  requestId: string,
  input: WithdrawAdvanceInput
): TourRequestRecord {
  const record = load(requestId);
  assertOwner(record, user);
  assertVersion(record, input.expectedVersion);

  if (record.advanceRequired !== "Y") {
    throw new ApiError(400, "NO_ADVANCE_REQUESTED", "No advance was requested on this tour.");
  }
  if (record.advanceWithdrawnAt) {
    throw new LifecycleConflictError("The advance request has already been withdrawn.");
  }
  // Once the tour is over, the advance is a settlement matter, not something
  // that can be retracted.
  if (["COMPLETED", "PENDING_SETTLEMENT_APPROVAL", "SETTLED", "CANCELLED"].includes(record.status)) {
    throw new LifecycleConflictError(
      `An advance request cannot be withdrawn once the request reaches status "${record.status}".`
    );
  }

  const now = new Date().toISOString();
  const updated: TourRequestRecord = {
    ...record,
    advanceRequired: "N",
    advanceWithdrawnAt: now,
    advanceWithdrawalReason: input.reason,
    // Zero the applied amounts so nothing downstream treats a withdrawn
    // advance as still claimable; the authority columns keep their history.
    advances: record.advances.map((line) => ({ ...line, appliedAmount: 0 })),
    versionNo: record.versionNo + 1,
    updatedAt: now,
    workflowHistory: [
      ...record.workflowHistory,
      historyEntry(user, "EMPLOYEE", "WITHDRAW_ADVANCE", record.status, record.status, input.reason),
    ],
  };

  store.tourRequests.set(requestId, updated);
  recordAudit({
    eventType: "TOUR_WITHDRAW_ADVANCE",
    entityType: "TOUR_REQUEST",
    entityId: requestId,
    actorPersonNumber: user.personNumber,
    actorRole: "EMPLOYEE",
    detail: { reason: input.reason, status: record.status },
    correlationId: null,
  });
  return updated;
}

// --- Requirement 4: extension of an ongoing tour --------------------------

export interface ExtensionRequestInput {
  expectedVersion: number;
  newEndDate: string;
  reason: string;
  additionalAdvanceAmount?: number | null;
}

/**
 * Confirmed with the client: an extension recomputes the entitlement and
 * returns to the Approving Authority only, not the full three-stage chain,
 * since the tour is already sanctioned and underway.
 */
export function requestExtension(
  user: Employee,
  requestId: string,
  input: ExtensionRequestInput
): TourRequestRecord {
  const record = load(requestId);
  assertOwner(record, user);
  assertVersion(record, input.expectedVersion);

  // An extension must actually extend. Comparing ISO date strings is safe
  // and avoids a timezone round-trip.
  if (input.newEndDate <= record.travelEndDate) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `The new end date must be later than the current end date (${record.travelEndDate}).`,
      { newEndDate: "Must be after the current tour end date." }
    );
  }
  if (record.extensions.some((e) => e.status === "PENDING")) {
    throw new LifecycleConflictError("An extension request is already awaiting approval on this tour.");
  }

  const extension: TourExtension = {
    extensionId: store.newId(),
    requestedBy: user.personNumber,
    requestedByName: user.name,
    requestedAt: new Date().toISOString(),
    previousEndDate: record.travelEndDate,
    newEndDate: input.newEndDate,
    reason: input.reason,
    additionalAdvanceAmount: input.additionalAdvanceAmount ?? null,
    status: "PENDING",
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    decisionRemarks: null,
  };

  return commit(
    user,
    record,
    "EMPLOYEE",
    "REQUEST_EXTENSION",
    { extensions: [...record.extensions, extension] },
    input.reason,
    { extensionId: extension.extensionId, newEndDate: input.newEndDate }
  );
}

export interface ExtensionDecisionInput {
  expectedVersion: number;
  extensionId: string;
  decision: "APPROVE" | "REJECT";
  remarks?: string | null;
}

export function decideExtension(
  user: Employee,
  requestId: string,
  input: ExtensionDecisionInput
): TourRequestRecord {
  const record = load(requestId);
  assertVersion(record, input.expectedVersion);

  if (!canActFor(user, record.authorities.approving?.personNumber, "APPROVING")) {
    throw new ApiError(403, "FORBIDDEN", "Only the Approving Authority may decide an extension.");
  }

  const extension = record.extensions.find((e) => e.extensionId === input.extensionId);
  if (!extension) throw new ApiError(404, "NOT_FOUND", "Extension request not found.");
  if (extension.status !== "PENDING") {
    throw new LifecycleConflictError("This extension has already been decided.");
  }

  const now = new Date().toISOString();
  const approved = input.decision === "APPROVE";
  const decided: TourExtension = {
    ...extension,
    status: approved ? "APPROVED" : "REJECTED",
    decidedBy: user.personNumber,
    decidedByName: user.name,
    decidedAt: now,
    decisionRemarks: input.remarks ?? null,
  };

  const patch: Partial<TourRequestRecord> = {
    extensions: record.extensions.map((e) => (e.extensionId === decided.extensionId ? decided : e)),
  };

  // An approved extension moves the tour end date, which changes the §7.3
  // DA bands and the §7.2A night count — so the entitlement is recomputed
  // against the new dates rather than left stale.
  if (approved) {
    patch.travelEndDate = extension.newEndDate;
    const employee = store.employees.find((e) => e.personNumber === record.personNumber);
    if (employee) {
      patch.lastEntitlement = buildEntitlementSnapshot(employee, {
        destCode: record.destCode,
        travelStartDate: record.travelStartDate,
        travelEndDate: extension.newEndDate,
        stayType: record.stayType,
        retainsAccommodationAtDestination: record.retainsAccommodationAtDestination === "Y",
      });
    }
  }

  return commit(
    user,
    record,
    "APPROVING",
    approved ? "APPROVE_EXTENSION" : "REJECT_EXTENSION",
    patch,
    input.remarks ?? null,
    { extensionId: input.extensionId, decision: input.decision, newEndDate: extension.newEndDate }
  );
}

// --- Requirement 7: >500km special approval acknowledgement ---------------

export interface SpecialApprovalInput {
  expectedVersion: number;
  remarks?: string | null;
}

/**
 * §6(c) / client requirement 7. Recorded separately from the ordinary
 * approval remark so the acknowledgement that the distance condition was
 * considered is auditable on its own.
 */
export function acknowledgeSpecialApproval(
  user: Employee,
  requestId: string,
  input: SpecialApprovalInput
): TourRequestRecord {
  const record = load(requestId);
  assertVersion(record, input.expectedVersion);

  if (!canActFor(user, record.authorities.approving?.personNumber, "APPROVING")) {
    throw new ApiError(403, "FORBIDDEN", "Only the Approving Authority may give the distance acknowledgement.");
  }

  const distance = record.lastTaEvaluation?.distance;
  if (!distance?.requiresSpecialApproval) {
    throw new ApiError(
      400,
      "SPECIAL_APPROVAL_NOT_REQUIRED",
      "This request does not require a distance-based special approval."
    );
  }
  if (record.specialApproval) {
    throw new LifecycleConflictError("The distance acknowledgement has already been recorded.");
  }

  const now = new Date().toISOString();
  const updated: TourRequestRecord = {
    ...record,
    specialApproval: {
      acknowledgedBy: user.personNumber,
      acknowledgedByName: user.name,
      acknowledgedAt: now,
      distanceKm: distance.oneWayDistanceKm,
      groundsCode:
        distance.resultCode === "DISTANCE_NOT_RECORDED" ? "DISTANCE_NOT_RECORDED" : "DISTANCE_BEYOND_500KM",
      remarks: input.remarks ?? null,
    },
    versionNo: record.versionNo + 1,
    updatedAt: now,
  };

  store.tourRequests.set(requestId, updated);
  recordAudit({
    eventType: "TOUR_SPECIAL_APPROVAL_ACKNOWLEDGED",
    entityType: "TOUR_REQUEST",
    entityId: requestId,
    actorPersonNumber: user.personNumber,
    actorRole: "APPROVING",
    detail: { distanceKm: distance.oneWayDistanceKm, grounds: distance.resultCode },
    correlationId: null,
  });
  return updated;
}

// --- Completion (gateway into settlement, §11) ----------------------------

export function completeTour(
  user: Employee,
  requestId: string,
  expectedVersion: number,
  remarks: string | null
): TourRequestRecord {
  const record = load(requestId);
  assertOwner(record, user);
  assertVersion(record, expectedVersion);
  return commit(user, record, "EMPLOYEE", "COMPLETE_TOUR", {}, remarks, {});
}
