import { store } from "../../repository/store.js";
import { EntitlementSnapshot, Employee, TourRequestRecord } from "../../types.js";
import { calculateEntitlement } from "../../domain/entitlement-calculator.js";
import { TourInput } from "./dto.js";
import { evaluateTaRules } from "../../domain/ta-rule-engine.js";
import { resolveAuthorities } from "../../domain/authority-resolver.js";
import { currentFinancialYear, generateRequestNumber, generateControlNumber } from "../../domain/request-number.js";
import { assertTransition, pendingRoleForStatus } from "../../domain/workflow-state-machine.js";
import { ApiError } from "../../middleware/error-handler.js";
import { recordAudit } from "../audit/service.js";

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, "VERSION_CONFLICT", message);
  }
}

function assertDestinationActive(destCode: string) {
  const dest = store.destinations.find((d) => d.destCode === destCode);
  if (!dest || dest.activeFlag !== "Y") {
    // VAL-04
    throw new ApiError(400, "VALIDATION_ERROR", `Unknown or inactive destination code "${destCode}".`, {
      destCode: "Destination must exist and be active.",
    });
  }
}

function runTaEvaluation(user: Employee, input: TourInput) {
  return evaluateTaRules({
    gradeCode: user.gradeCode,
    destCode: input.destCode,
    airTravelPermission: input.airTravelPermission as "No" | "Yes",
    roadTravelPermission: input.roadTravelPermission as TourRequestRecord["roadTravelPermission"],
    ownVehicleRequested: input.roadTravelPermission === "Own Vehicle",
    nonShortestRoute: input.nonShortestRouteFlag,
    requestedHigherClass: input.higherClassApprovalFlag,
    // One-way distance now comes from the HQ->destination reference matrix
    // (§6(c)), not from a self-reported field. The matrix ships empty, so
    // this is null until HR Admin populates the pair — which the engine
    // reports as DISTANCE_NOT_RECORDED and routes to special approval
    // rather than silently passing.
    oneWayDistanceKm: store.findDistanceKm(input.headquarter, input.destCode),
  });
}

/**
 * Computes the entitlement ceiling for a request and flattens it for storage
 * on the record, so the employee sees the maximum admissible amount before
 * submitting and the approver later sees the same figures.
 */
export function buildEntitlementSnapshot(
  user: Employee,
  input: Pick<
    TourInput,
    "destCode" | "travelStartDate" | "travelEndDate" | "stayType" | "retainsAccommodationAtDestination"
  >
): EntitlementSnapshot | null {
  const rule = store.taRules.find((r) => r.gradeCode === user.gradeCode && r.effectiveTo === null);
  if (!rule) return null;

  const dest = store.destinations.find((d) => d.destCode === input.destCode);

  const breakdown = calculateEntitlement({
    rule,
    travelStartDate: input.travelStartDate,
    travelEndDate: input.travelEndDate,
    isSpecifiedLocation: dest?.specifiedLocationFlag === "Y",
    stayType: input.stayType,
    retainsAccommodationAtDestination: input.retainsAccommodationAtDestination,
  });

  return {
    ruleId: breakdown.ruleId,
    ruleVersion: breakdown.ruleVersion,
    gradeCode: breakdown.gradeCode,
    gradeLabel: breakdown.gradeLabel,
    daMaxAmount: breakdown.da.maxAmount,
    daRatePerDay: breakdown.da.ratePerDay,
    daMultiplier: breakdown.da.computation.daMultiplier,
    daBasis: breakdown.da.computation.basis,
    lodgingNights: breakdown.lodging.nights,
    lodgingCeilingPerNight: breakdown.lodging.ceilingPerNight,
    lodgingMaxAmount: breakdown.lodging.maxAmount,
    lodgingNote: breakdown.lodging.note,
    locationType: breakdown.lodging.locationType,
    maxComputableAdvance: breakdown.maxComputableAdvance,
    advisories: breakdown.advisories,
    computedAt: new Date().toISOString(),
  };
}

function buildRecord(user: Employee, input: TourInput, requestId: string): TourRequestRecord {
  const financialYear = currentFinancialYear();
  const seq = store.nextRequestSeq();
  const taResult = runTaEvaluation(user, input);
  return {
    requestId,
    requestNumber: generateRequestNumber(seq, financialYear),
    controlNumber: null,
    personNumber: user.personNumber,
    staffNo: user.staffNo,
    scaleCode: user.scaleCode,
    employeeName: user.name,
    department: user.department,
    gradeCode: user.gradeCode,
    headquarter: input.headquarter,
    commencementDate: input.commencementDate,
    travelStartDate: input.travelStartDate,
    travelEndDate: input.travelEndDate,
    tourType: input.tourType,
    destCode: input.destCode,
    purpose: input.purpose,
    roadTravelPermission: input.roadTravelPermission as TourRequestRecord["roadTravelPermission"],
    vehicleNumber: input.vehicleNumber ?? null,
    airTravelPermission: input.airTravelPermission as TourRequestRecord["airTravelPermission"],
    railTravelPermission: input.railTravelPermission as TourRequestRecord["railTravelPermission"],
    nonShortestRouteFlag: input.nonShortestRouteFlag ? "Y" : "N",
    higherClassApprovalFlag: input.higherClassApprovalFlag ? "Y" : "N",
    ownVehicleApprovalFlag: input.ownVehicleApprovalFlag ? "Y" : "N",
    competentAuthorityApprover: input.competentAuthorityApprover ?? null,
    pnrTicketNumber: input.pnrTicketNumber ?? null,
    advanceRequired: input.advanceRequired ? "Y" : "N",
    status: "DRAFT",
    financialYear,
    versionNo: 1,
    createdBy: user.personNumber,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    submittedAt: null,
    advances: input.advances.map((a, i) => ({
      lineNo: i + 1,
      categoryCode: a.categoryCode,
      appliedAmount: a.appliedAmount,
      forwardedAmount: null,
      recommendedAmount: null,
      approvedAmount: null,
    })),
    attachments: [],
    workflowHistory: [],
    authorities: resolveAuthorities(user.personNumber),
    lastTaEvaluation: taResult,

    // --- Post-approval lifecycle (client requirements, Oct 2026) ----------
    stayType: input.stayType,
    retainsAccommodationAtDestination: input.retainsAccommodationAtDestination ? "Y" : "N",
    lastEntitlement: buildEntitlementSnapshot(user, input),
    journeyAcknowledgement: null,
    extensions: [],
    specialApproval: null,
    settlement: null,
    advanceWithdrawnAt: null,
    advanceWithdrawalReason: null,
    cancelledAt: null,
    cancellationReason: null,
    cancellationOfficialReason: null,
  };
}

export function createDraft(user: Employee, input: TourInput): TourRequestRecord {
  assertDestinationActive(input.destCode);
  const requestId = store.newId();
  const record = buildRecord(user, input, requestId);
  store.tourRequests.set(requestId, record);
  recordAudit({
    eventType: "TOUR_DRAFT_CREATED",
    entityType: "TOUR_REQUEST",
    entityId: requestId,
    actorPersonNumber: user.personNumber,
    actorRole: "EMPLOYEE",
    detail: { requestNumber: record.requestNumber },
    correlationId: null,
  });
  return record;
}

function getOwned(user: Employee, requestId: string, allowRoles = false): TourRequestRecord {
  const record = store.tourRequests.get(requestId);
  if (!record) {
    throw new ApiError(404, "NOT_FOUND", "Tour request not found.");
  }
  const isOwner = record.personNumber === user.personNumber;
  const isAssignedAuthority =
    allowRoles &&
    (record.authorities.forwarding?.personNumber === user.personNumber ||
      record.authorities.recommending?.personNumber === user.personNumber ||
      record.authorities.approving?.personNumber === user.personNumber);
  const isHrAdmin = user.roles.includes("HR_ADMIN");
  if (!isOwner && !isAssignedAuthority && !isHrAdmin) {
    throw new ApiError(403, "FORBIDDEN", "You are not authorized to view this tour request.");
  }
  return record;
}

export function getById(user: Employee, requestId: string): TourRequestRecord {
  return getOwned(user, requestId, true);
}

export function listMine(user: Employee): TourRequestRecord[] {
  return [...store.tourRequests.values()]
    .filter((r) => r.personNumber === user.personNumber)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateDraft(
  user: Employee,
  requestId: string,
  input: TourInput,
  expectedVersion: number
): TourRequestRecord {
  const record = getOwned(user, requestId);
  if (record.personNumber !== user.personNumber) {
    throw new ApiError(403, "FORBIDDEN", "Only the owning employee may edit this draft.");
  }
  if (record.status !== "DRAFT") {
    throw new ApiError(409, "NOT_EDITABLE", `Request is in status "${record.status}" and can no longer be edited.`);
  }
  if (record.versionNo !== expectedVersion) {
    // VAL-16
    throw new ConflictError("This request was modified elsewhere. Reload and retry.");
  }
  assertDestinationActive(input.destCode);

  const taResult = runTaEvaluation(user, input);
  const updated: TourRequestRecord = {
    ...record,
    headquarter: input.headquarter,
    commencementDate: input.commencementDate,
    travelStartDate: input.travelStartDate,
    travelEndDate: input.travelEndDate,
    tourType: input.tourType,
    destCode: input.destCode,
    purpose: input.purpose,
    roadTravelPermission: input.roadTravelPermission as TourRequestRecord["roadTravelPermission"],
    vehicleNumber: input.vehicleNumber ?? null,
    airTravelPermission: input.airTravelPermission as TourRequestRecord["airTravelPermission"],
    railTravelPermission: input.railTravelPermission as TourRequestRecord["railTravelPermission"],
    nonShortestRouteFlag: input.nonShortestRouteFlag ? "Y" : "N",
    higherClassApprovalFlag: input.higherClassApprovalFlag ? "Y" : "N",
    ownVehicleApprovalFlag: input.ownVehicleApprovalFlag ? "Y" : "N",
    competentAuthorityApprover: input.competentAuthorityApprover ?? null,
    pnrTicketNumber: input.pnrTicketNumber ?? null,
    advanceRequired: input.advanceRequired ? "Y" : "N",
    advances: input.advances.map((a, i) => ({
      lineNo: i + 1,
      categoryCode: a.categoryCode,
      appliedAmount: a.appliedAmount,
      forwardedAmount: null,
      recommendedAmount: null,
      approvedAmount: null,
    })),
    versionNo: record.versionNo + 1,
    updatedAt: new Date().toISOString(),
    lastTaEvaluation: taResult,
  };
  store.tourRequests.set(requestId, updated);
  return updated;
}

// Full server-side validation contract for submission (SSoT §17/§24).
// Frontend validation is UX-only; this is authoritative.
function validateForSubmit(record: TourRequestRecord): string[] {
  const errors: string[] = [];

  if (record.travelEndDate < record.travelStartDate) {
    errors.push("To Date must be on or after From Date."); // VAL-02
  }
  if (record.travelStartDate < record.commencementDate) {
    errors.push("From Date must be on or after the Commencement Date.");
  }
  if (record.purpose.length > 500) {
    errors.push("Purpose must be 500 characters or fewer."); // VAL-07
  }
  if (record.attachments.length > 3) {
    errors.push("Maximum 3 attachments allowed."); // VAL-08
  }
  for (const line of record.advances) {
    if (line.appliedAmount < 0) {
      errors.push("Advance amounts must be numeric and non-negative."); // VAL-09
    }
  }

  const ta = record.lastTaEvaluation;
  if (ta) {
    const airBlocked =
      record.airTravelPermission === "Yes" &&
      !ta.air.entitled &&
      !(record.higherClassApprovalFlag === "Y" && record.competentAuthorityApprover);
    if (airBlocked) {
      // VAL-10
      errors.push(
        `${ta.air.message} Record Competent Authority approval before submitting, or withdraw the Air=Yes request.`
      );
    }
    if (
      ta.ownVehicle.requiresCompetentAuthorityApproval &&
      !(record.ownVehicleApprovalFlag === "Y" && record.competentAuthorityApprover)
    ) {
      errors.push("Own Vehicle requires prior Competent Authority approval to be recorded before submission."); // VAL-11
    }
    if (
      ta.higherClass.resultCode === "HIGHER_CLASS_APPROVAL_REQUIRED" &&
      !(record.higherClassApprovalFlag === "Y" && record.competentAuthorityApprover)
    ) {
      errors.push("Higher/different mode or class requires Competent Authority approval to be recorded before submission."); // VAL-12
    }
  }
  if (record.nonShortestRouteFlag === "Y" && !record.competentAuthorityApprover) {
    errors.push("Non-shortest route requires Competent Authority approval to be recorded before submission."); // VAL-13
  }
  if (record.airTravelPermission === "Yes" && !record.pnrTicketNumber) {
    errors.push("PNR / Ticket No. is required when an air journey is captured."); // VAL-14
  }
  if (record.railTravelPermission === "Yes" && !record.pnrTicketNumber) {
    errors.push("PNR / Ticket No. is required when a train journey is captured."); // VAL-14
  }

  return errors;
}

export function submit(user: Employee, requestId: string, expectedVersion: number): TourRequestRecord {
  const record = getOwned(user, requestId);
  if (record.personNumber !== user.personNumber) {
    throw new ApiError(403, "FORBIDDEN", "Only the owning employee may submit this request.");
  }
  if (record.versionNo !== expectedVersion) {
    throw new ConflictError("This request was modified elsewhere. Reload and retry.");
  }
  if (record.status !== "DRAFT") {
    throw new ApiError(409, "ALREADY_SUBMITTED", "This request has already been submitted.");
  }

  const errors = validateForSubmit(record);
  if (errors.length > 0) {
    // Kept as an indexed list rather than a per-field map because several
    // VAL-* rules are cross-field checks, not tied to one input.
    const fieldErrors = Object.fromEntries(errors.map((e, i) => [`rule_${i + 1}`, e]));
    throw new ApiError(400, "VALIDATION_ERROR", "Submission failed validation.", fieldErrors);
  }

  const newStatus = assertTransition(record.status, "SUBMIT", "EMPLOYEE");
  const now = new Date().toISOString();
  const updated: TourRequestRecord = {
    ...record,
    status: newStatus,
    versionNo: record.versionNo + 1,
    updatedAt: now,
    submittedAt: now,
    workflowHistory: [
      ...record.workflowHistory,
      {
        historyId: store.newId(),
        actorPersonNumber: user.personNumber,
        actorName: user.name,
        roleCode: "EMPLOYEE",
        action: "SUBMIT",
        oldStatus: record.status,
        newStatus,
        remarks: null,
        actionAt: now,
      },
    ],
  };
  store.tourRequests.set(requestId, updated);
  recordAudit({
    eventType: "TOUR_SUBMITTED",
    entityType: "TOUR_REQUEST",
    entityId: requestId,
    actorPersonNumber: user.personNumber,
    actorRole: "EMPLOYEE",
    detail: { requestNumber: updated.requestNumber },
    correlationId: null,
  });
  return updated;
}

export { validateForSubmit as __validateForSubmit_testOnly };
export function pendingRole(record: TourRequestRecord) {
  return pendingRoleForStatus(record.status);
}
export function assignControlNumberIfApproved(record: TourRequestRecord): TourRequestRecord {
  if (record.status === "APPROVED" && !record.controlNumber) {
    const seq = store.nextRequestSeq();
    return { ...record, controlNumber: generateControlNumber(seq, record.financialYear) };
  }
  return record;
}
