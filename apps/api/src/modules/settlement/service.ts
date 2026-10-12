// Bill settlement under §11 (client requirement 8, Oct 2026).
//
// §11: "Bill to be submitted within one month of completion of journey" and
// "Advance to be recovered if there is delay in submission of bill".
//
// What settlement does
// --------------------
// The employee enters what they actually spent, per category. Each line is
// held against the entitlement ceiling computed by
// domain/entitlement-calculator.ts, so DA and lodging cannot be admitted
// above what the Rules allow. Journey fare has no ceiling in the Rules (§6
// is "actuals by entitled class"), so those lines carry a null cap and are
// admitted on the approver's judgement against the bills.
//
// The net figure is then advance drawn vs amount admitted: positive means
// the Company owes the employee, negative means the employee must refund.
import { store } from "../../repository/store.js";
import {
  Employee,
  SettlementCategoryCode,
  SettlementLine,
  SettlementRecord,
  TourRequestRecord,
} from "../../types.js";
import { assertTransition } from "../../domain/workflow-state-machine.js";
import { ApiError } from "../../middleware/error-handler.js";
import { recordAudit } from "../audit/service.js";
import { canActFor } from "../delegation/service.js";

export class SettlementConflictError extends ApiError {
  constructor(message: string) {
    super(409, "VERSION_CONFLICT", message);
  }
}

function load(requestId: string): TourRequestRecord {
  const record = store.tourRequests.get(requestId);
  if (!record) throw new ApiError(404, "NOT_FOUND", "Tour request not found.");
  return record;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** §11 — one month from completion of the journey. */
export function settlementDueDate(journeyEndIso: string): string {
  const end = new Date(`${journeyEndIso}T00:00:00.000Z`);
  const due = new Date(end);
  due.setUTCMonth(due.getUTCMonth() + 1);
  return due.toISOString().slice(0, 10);
}

/**
 * The entitlement ceiling for a settlement line, or null where the Rules set
 * no monetary cap.
 *
 * DA and LODGING come straight from the entitlement snapshot taken when the
 * request was raised (and recomputed on an approved extension), so the
 * employee is held to the figures they were shown. Fare categories are
 * uncapped by §6; INCIDENTAL is uncapped because §6.1(c) admits reservation,
 * agency and Tatkal charges at actuals.
 */
function capForCategory(record: TourRequestRecord, category: SettlementCategoryCode): number | null {
  const ent = record.lastEntitlement;
  if (!ent) return null;
  switch (category) {
    case "DA":
      return ent.daMaxAmount;
    case "LODGING":
      return ent.lodgingMaxAmount; // null for E-9+ (actuals)
    case "AIR_FARE":
    case "RAIL":
    case "ROAD":
    case "INCIDENTAL":
      return null;
    default:
      return null;
  }
}

/** Total advance actually sanctioned — the approved column on the advance lines. */
export function advanceDrawnFor(record: TourRequestRecord): number {
  if (record.advanceRequired !== "Y") return 0;
  return round2(record.advances.reduce((sum, line) => sum + (line.approvedAmount ?? 0), 0));
}

/**
 * Everything settlement-related that concerns this user, so the obligation is
 * discoverable from the sidebar rather than only from a tour's detail page.
 *
 * §11 gives one month from completion of the journey and makes the advance
 * recoverable on delay, so a pending bill is a deadline the employee has to
 * be able to find — not something they must remember to go looking for.
 */
export interface SettlementWorklist {
  /** Tours of this employee's that need a bill submitted now. */
  awaitingSubmission: SettlementWorklistRow[];
  /** This employee's bills sitting with an approver. */
  awaitingApproval: SettlementWorklistRow[];
  /** Settlements awaiting *this user's* decision as Approving Authority. */
  awaitingMyDecision: SettlementWorklistRow[];
  /** Finished, for reference. */
  settled: SettlementWorklistRow[];
}

export interface SettlementWorklistRow {
  requestId: string;
  requestNumber: string;
  employeeName: string;
  destCode: string;
  travelStartDate: string;
  travelEndDate: string;
  status: TourRequestRecord["status"];
  dueDate: string;
  /** Negative once past due; null when there is no deadline yet. */
  daysRemaining: number | null;
  overdue: boolean;
  advanceDrawn: number;
  totalClaimed: number | null;
  netPayable: number | null;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00.000Z`);
  const b = Date.parse(`${toIso}T00:00:00.000Z`);
  return Math.round((b - a) / 864e5);
}

function toRow(record: TourRequestRecord): SettlementWorklistRow {
  const dueDate = settlementDueDate(record.travelEndDate);
  const today = new Date().toISOString().slice(0, 10);
  // Once submitted the deadline has been met or missed already — the
  // countdown only means something while the bill is still outstanding.
  const outstanding = record.status === "COMPLETED";
  const daysRemaining = outstanding ? daysBetween(today, dueDate) : null;
  return {
    requestId: record.requestId,
    requestNumber: record.requestNumber,
    employeeName: record.employeeName,
    destCode: record.destCode,
    travelStartDate: record.travelStartDate,
    travelEndDate: record.travelEndDate,
    status: record.status,
    dueDate,
    daysRemaining,
    overdue: outstanding ? today > dueDate : (record.settlement?.submittedLate ?? false),
    advanceDrawn: advanceDrawnFor(record),
    totalClaimed: record.settlement?.totalClaimed ?? null,
    netPayable: record.settlement?.netPayable ?? null,
  };
}

export function settlementWorklist(user: Employee): SettlementWorklist {
  const all = [...store.tourRequests.values()];
  const mine = all.filter((r) => r.personNumber === user.personNumber);

  const byOldestDueFirst = (a: SettlementWorklistRow, b: SettlementWorklistRow) =>
    a.dueDate.localeCompare(b.dueDate);

  return {
    awaitingSubmission: mine.filter((r) => r.status === "COMPLETED").map(toRow).sort(byOldestDueFirst),
    awaitingApproval: mine
      .filter((r) => r.status === "PENDING_SETTLEMENT_APPROVAL")
      .map(toRow)
      .sort(byOldestDueFirst),
    awaitingMyDecision: all
      .filter(
        (r) =>
          r.status === "PENDING_SETTLEMENT_APPROVAL" &&
          canActFor(user, r.authorities.approving?.personNumber, "APPROVING")
      )
      .map(toRow)
      .sort(byOldestDueFirst),
    settled: mine
      .filter((r) => r.status === "SETTLED")
      .map(toRow)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
  };
}

export interface SettlementLineInput {
  categoryCode: SettlementCategoryCode;
  claimedAmount: number;
}

export interface SettlementSubmitInput {
  expectedVersion: number;
  lines: SettlementLineInput[];
  remarks?: string | null;
}

/**
 * A read-only preview of what settlement would look like, so the employee
 * sees the caps and the net position before committing. Available from
 * COMPLETED onwards.
 */
export function previewSettlement(record: TourRequestRecord, lines: SettlementLineInput[]) {
  const built = buildLines(record, lines);
  const totalClaimed = round2(built.reduce((s, l) => s + l.claimedAmount, 0));
  const defaultAdmitted = round2(built.reduce((s, l) => s + (l.admittedAmount ?? 0), 0));
  const advanceDrawn = advanceDrawnFor(record);
  return {
    lines: built,
    totalClaimed,
    defaultAdmitted,
    advanceDrawn,
    netPayable: round2(defaultAdmitted - advanceDrawn),
  };
}

function buildLines(record: TourRequestRecord, lines: SettlementLineInput[]): SettlementLine[] {
  // One line per category; a duplicate category would make the caps
  // ambiguous, so they are rejected rather than silently summed.
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.categoryCode)) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        `Duplicate settlement line for category "${line.categoryCode}".`,
        { lines: "Each category may appear only once." }
      );
    }
    seen.add(line.categoryCode);
  }

  return lines.map((line, i) => {
    const cap = capForCategory(record, line.categoryCode);
    // The default admitted amount is the claim held to its ceiling. The
    // approver can reduce it further but never raise it above the cap.
    const admitted = cap === null ? line.claimedAmount : Math.min(line.claimedAmount, cap);
    return {
      lineNo: i + 1,
      categoryCode: line.categoryCode,
      claimedAmount: round2(line.claimedAmount),
      entitlementCap: cap,
      admittedAmount: round2(admitted),
      disallowanceReason:
        cap !== null && line.claimedAmount > cap
          ? `Limited to the grade entitlement ceiling of ₹${cap.toLocaleString("en-IN")}.`
          : null,
    };
  });
}

export function submitSettlement(
  user: Employee,
  requestId: string,
  input: SettlementSubmitInput
): TourRequestRecord {
  const record = load(requestId);
  if (record.personNumber !== user.personNumber) {
    throw new ApiError(403, "FORBIDDEN", "Only the employee who raised this request may settle it.");
  }
  if (record.versionNo !== input.expectedVersion) {
    throw new SettlementConflictError("This request was modified elsewhere. Reload and retry.");
  }

  const oldStatus = record.status;
  const newStatus = assertTransition(oldStatus, "SUBMIT_SETTLEMENT", "EMPLOYEE");

  const lines = buildLines(record, input.lines);
  const totalClaimed = round2(lines.reduce((s, l) => s + l.claimedAmount, 0));
  const advanceDrawn = advanceDrawnFor(record);

  // §11 — the deadline runs from completion of the journey, which is the
  // tour end date (extended end date, if an extension was approved).
  const dueDate = settlementDueDate(record.travelEndDate);
  const now = new Date().toISOString();
  const submittedLate = now.slice(0, 10) > dueDate;

  const settlement: SettlementRecord = {
    settlementId: record.settlement?.settlementId ?? store.newId(),
    requestId,
    submittedBy: user.personNumber,
    submittedAt: now,
    dueDate,
    submittedLate,
    lines,
    advanceDrawn,
    totalClaimed,
    totalAdmitted: null, // set by the approver
    netPayable: null,
    status: "PENDING_APPROVAL",
    approvedBy: null,
    approvedByName: null,
    approvedAt: null,
    remarks: input.remarks ?? null,
    // Bills are attached to the parent request through the existing
    // attachments endpoint; settlement reuses them rather than introducing
    // a second upload path.
    attachments: [],
  };

  const updated: TourRequestRecord = {
    ...record,
    settlement,
    status: newStatus,
    versionNo: record.versionNo + 1,
    updatedAt: now,
    workflowHistory: [
      ...record.workflowHistory,
      {
        historyId: store.newId(),
        actorPersonNumber: user.personNumber,
        actorName: user.name,
        roleCode: "EMPLOYEE",
        action: "SUBMIT_SETTLEMENT",
        oldStatus,
        newStatus,
        remarks: input.remarks ?? null,
        actionAt: now,
      },
    ],
  };

  store.tourRequests.set(requestId, updated);
  recordAudit({
    eventType: "SETTLEMENT_SUBMITTED",
    entityType: "TOUR_REQUEST",
    entityId: requestId,
    actorPersonNumber: user.personNumber,
    actorRole: "EMPLOYEE",
    detail: { totalClaimed, advanceDrawn, dueDate, submittedLate },
    correlationId: null,
  });
  return updated;
}

export interface SettlementDecisionLineInput {
  lineNo: number;
  admittedAmount: number;
  disallowanceReason?: string | null;
}

export interface SettlementDecisionInput {
  expectedVersion: number;
  decision: "APPROVE" | "REJECT";
  lines?: SettlementDecisionLineInput[];
  remarks?: string | null;
}

export function decideSettlement(
  user: Employee,
  requestId: string,
  input: SettlementDecisionInput
): TourRequestRecord {
  const record = load(requestId);
  if (record.versionNo !== input.expectedVersion) {
    throw new SettlementConflictError("This request was modified elsewhere. Reload and retry.");
  }
  if (!canActFor(user, record.authorities.approving?.personNumber, "APPROVING")) {
    throw new ApiError(403, "FORBIDDEN", "Only the Approving Authority may decide a settlement.");
  }
  const settlement = record.settlement;
  if (!settlement || settlement.status !== "PENDING_APPROVAL") {
    throw new SettlementConflictError("There is no settlement awaiting approval on this request.");
  }

  const approved = input.decision === "APPROVE";
  const oldStatus = record.status;
  const newStatus = assertTransition(
    oldStatus,
    approved ? "APPROVE_SETTLEMENT" : "REJECT_SETTLEMENT",
    "APPROVING"
  );
  const now = new Date().toISOString();

  // Apply the approver's per-line decisions, holding each to its ceiling —
  // an approver may reduce a line but never admit above the entitlement.
  const overrides = new Map((input.lines ?? []).map((l) => [l.lineNo, l]));
  const lines: SettlementLine[] = settlement.lines.map((line) => {
    const override = overrides.get(line.lineNo);
    if (!override) return line;
    if (line.entitlementCap !== null && override.admittedAmount > line.entitlementCap) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        `Line ${line.lineNo} (${line.categoryCode}): admitted amount cannot exceed the entitlement ceiling of ₹${line.entitlementCap.toLocaleString("en-IN")}.`,
        { lines: "An admitted amount may not exceed the entitlement ceiling." }
      );
    }
    if (override.admittedAmount > line.claimedAmount) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        `Line ${line.lineNo} (${line.categoryCode}): admitted amount cannot exceed the amount claimed.`,
        { lines: "An admitted amount may not exceed the claim." }
      );
    }
    return {
      ...line,
      admittedAmount: round2(override.admittedAmount),
      disallowanceReason: override.disallowanceReason ?? line.disallowanceReason,
    };
  });

  const totalAdmitted = approved ? round2(lines.reduce((s, l) => s + (l.admittedAmount ?? 0), 0)) : null;
  // Positive = payable to the employee; negative = recoverable from them.
  const netPayable = totalAdmitted === null ? null : round2(totalAdmitted - settlement.advanceDrawn);

  const updatedSettlement: SettlementRecord = {
    ...settlement,
    lines,
    totalAdmitted,
    netPayable,
    status: approved ? "APPROVED" : "REJECTED",
    approvedBy: approved ? user.personNumber : null,
    approvedByName: approved ? user.name : null,
    approvedAt: approved ? now : null,
    remarks: input.remarks ?? settlement.remarks,
  };

  const updated: TourRequestRecord = {
    ...record,
    settlement: updatedSettlement,
    status: newStatus,
    versionNo: record.versionNo + 1,
    updatedAt: now,
    workflowHistory: [
      ...record.workflowHistory,
      {
        historyId: store.newId(),
        actorPersonNumber: user.personNumber,
        actorName: user.name,
        roleCode: "APPROVING",
        action: approved ? "APPROVE_SETTLEMENT" : "REJECT_SETTLEMENT",
        oldStatus,
        newStatus,
        remarks: input.remarks ?? null,
        actionAt: now,
      },
    ],
  };

  store.tourRequests.set(requestId, updated);
  recordAudit({
    eventType: approved ? "SETTLEMENT_APPROVED" : "SETTLEMENT_REJECTED",
    entityType: "TOUR_REQUEST",
    entityId: requestId,
    actorPersonNumber: user.personNumber,
    actorRole: "APPROVING",
    detail: { totalAdmitted, netPayable, submittedLate: settlement.submittedLate },
    correlationId: null,
  });
  return updated;
}
