// Mirrors apps/api/src/types.ts — kept as a hand-synced copy rather than a
// shared package to keep this reference build simple. In a production
// monorepo these would live in a shared @sail-tour/contracts package.
export type RoleCode = "EMPLOYEE" | "FORWARDING" | "RECOMMENDING" | "APPROVING" | "HR_ADMIN";

export type TourStatus =
  | "DRAFT"
  | "PENDING_FORWARDING"
  | "FORWARDED"
  | "PENDING_RECOMMENDATION"
  | "RECOMMENDED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "IN_PROGRESS"
  | "PENDING_EXTENSION_APPROVAL"
  | "COMPLETED"
  | "PENDING_SETTLEMENT_APPROVAL"
  | "SETTLED"
  | "REJECTED"
  | "CANCELLED";

export interface Employee {
  personNumber: string;
  staffNo: string;
  scaleCode: string;
  name: string;
  department: string;
  gradeCode: string;
  headquarter: string;
  roles: RoleCode[];
}

export interface AdvanceLine {
  lineNo: number;
  categoryCode: string;
  appliedAmount: number;
  forwardedAmount: number | null;
  recommendedAmount: number | null;
  approvedAmount: number | null;
}

export interface Attachment {
  attachmentId: string;
  attachmentName: string;
  fileName: string;
  fileExtension: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface WorkflowHistoryEntry {
  historyId: string;
  actorPersonNumber: string;
  actorName: string;
  roleCode: RoleCode;
  action: string;
  oldStatus: TourStatus | null;
  newStatus: TourStatus;
  remarks: string | null;
  actionAt: string;
}

export interface TaEvaluationResult {
  ruleId: number;
  ruleVersion: number;
  gradeCode: string;
  railEntitlement: string;
  roadMileageRate: number | null;
  daHotelRate: number;
  daOwnArrangementRate: number;
  air: {
    requested: "No" | "Yes";
    entitled: boolean;
    entitlementClass: string;
    requiresDistanceCheck: boolean;
    distanceKm: number | null;
    regionExceptionApplied: boolean;
    resultCode: string;
    message: string;
  };
  ownVehicle: { requested: boolean; requiresCompetentAuthorityApproval: boolean; resultCode: string };
  road: {
    requested: string;
    entitled: boolean;
    mileageRatePerKm: number | null;
    requiresApproval: boolean;
    resultCode: string;
    message: string;
  };
  distance: {
    oneWayDistanceKm: number | null;
    thresholdKm: number;
    beyondThreshold: boolean | null;
    requiresSpecialApproval: boolean;
    resultCode: string;
    message: string;
  };
  higherClass: { discretionaryGrade: boolean; requiresCompetentAuthorityApproval: boolean; resultCode: string };
  validationMessages: string[];
}

// --- Entitlement and post-approval lifecycle (Oct 2026) ------------------

/** Mirrors the API's EntitlementBreakdown (domain/entitlement-calculator.ts). */
export interface EntitlementBreakdown {
  ruleId: number;
  ruleVersion: number;
  gradeCode: string;
  gradeLabel: string;
  da: {
    computation: { band: string; durationHours: number; daMultiplier: number; basis: string };
    stayType: StayType;
    ratePerDay: number;
    retentionHalvingApplied: boolean;
    maxAmount: number;
  };
  lodging: {
    nights: number;
    locationType: "SPECIFIED" | "OTHER";
    ceilingPerNight: number | null;
    maxAmount: number | null;
    applicable: boolean;
    note: string;
  };
  fare: {
    railEntitlement: string;
    waterwayEntitlement: string;
    airEntitlement: string;
    roadMileageRate: number | null;
    note: string;
  };
  maxComputableAdvance: number | null;
  advisories: string[];
}

export type StayType = "HOTEL_OR_GUEST_HOUSE" | "OWN_ARRANGEMENT";

export interface EntitlementSnapshot {
  ruleId: number;
  ruleVersion: number;
  gradeCode: string;
  gradeLabel: string;
  daMaxAmount: number;
  daRatePerDay: number;
  daMultiplier: number;
  daBasis: string;
  lodgingNights: number;
  lodgingCeilingPerNight: number | null;
  lodgingMaxAmount: number | null;
  lodgingNote: string;
  locationType: "SPECIFIED" | "OTHER";
  maxComputableAdvance: number | null;
  advisories: string[];
  computedAt: string;
}

export interface JourneyAcknowledgement {
  acknowledgedBy: string;
  acknowledgedByName: string;
  acknowledgedByRole: "EMPLOYEE" | "FORWARDING";
  acknowledgedAt: string;
  actualStartDate: string;
  remarks: string | null;
}

export interface TourExtension {
  extensionId: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  previousEndDate: string;
  newEndDate: string;
  reason: string;
  additionalAdvanceAmount: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionRemarks: string | null;
}

export interface SpecialApprovalAcknowledgement {
  acknowledgedBy: string;
  acknowledgedByName: string;
  acknowledgedAt: string;
  distanceKm: number | null;
  groundsCode: "DISTANCE_BEYOND_500KM" | "DISTANCE_NOT_RECORDED";
  remarks: string | null;
}

export type SettlementCategoryCode = "AIR_FARE" | "RAIL" | "ROAD" | "DA" | "LODGING" | "INCIDENTAL";

export interface SettlementLine {
  lineNo: number;
  categoryCode: SettlementCategoryCode;
  claimedAmount: number;
  entitlementCap: number | null;
  admittedAmount: number | null;
  disallowanceReason: string | null;
}

export interface SettlementRecord {
  settlementId: string;
  requestId: string;
  submittedBy: string;
  submittedAt: string | null;
  dueDate: string;
  submittedLate: boolean;
  lines: SettlementLine[];
  advanceDrawn: number;
  totalClaimed: number;
  totalAdmitted: number | null;
  netPayable: number | null;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  remarks: string | null;
  attachments: Attachment[];
}

export interface SettlementWorklistRow {
  requestId: string;
  requestNumber: string;
  employeeName: string;
  destCode: string;
  travelStartDate: string;
  travelEndDate: string;
  status: TourStatus;
  dueDate: string;
  daysRemaining: number | null;
  overdue: boolean;
  advanceDrawn: number;
  totalClaimed: number | null;
  netPayable: number | null;
}

export interface SettlementWorklist {
  awaitingSubmission: SettlementWorklistRow[];
  awaitingApproval: SettlementWorklistRow[];
  awaitingMyDecision: SettlementWorklistRow[];
  settled: SettlementWorklistRow[];
}

export interface SettlementPreview {
  lines: SettlementLine[];
  totalClaimed: number;
  defaultAdmitted: number;
  advanceDrawn: number;
  netPayable: number;
}

export interface Delegation {
  delegationId: string;
  fromPersonNumber: string;
  fromName: string;
  toPersonNumber: string;
  toName: string;
  roleCode: "FORWARDING" | "RECOMMENDING" | "APPROVING";
  fromDate: string;
  toDate: string;
  reason: string | null;
  active: boolean;
  createdAt: string;
  revokedAt: string | null;
}

export interface DistanceRow {
  headquarter: string;
  destCode: string;
  distanceKm: number;
  sourceRef: string;
}

export interface DistanceMatrix {
  rows: DistanceRow[];
  coverage: {
    recorded: number;
    possiblePairs: number;
    headquarters: number;
    activeDestinations: number;
  };
}

export interface TourAuthorities {
  forwarding: { personNumber: string; name: string; designation: string } | null;
  recommending: { personNumber: string; name: string; designation: string } | null;
  approving: { personNumber: string; name: string; designation: string } | null;
}

export interface TourRequestRecord {
  requestId: string;
  requestNumber: string;
  controlNumber: string | null;
  personNumber: string;
  staffNo: string;
  scaleCode: string;
  employeeName: string;
  department: string;
  gradeCode: string;
  headquarter: string;
  commencementDate: string;
  travelStartDate: string;
  travelEndDate: string;
  tourType: string;
  destCode: string;
  purpose: string;
  roadTravelPermission: "No" | "Own Vehicle" | "Hired Vehicle" | "Vehicle Retention";
  vehicleNumber: string | null;
  airTravelPermission: "No" | "Yes";
  railTravelPermission: "No" | "Yes";
  nonShortestRouteFlag: "Y" | "N";
  higherClassApprovalFlag: "Y" | "N";
  ownVehicleApprovalFlag: "Y" | "N";
  competentAuthorityApprover: string | null;
  pnrTicketNumber: string | null;
  advanceRequired: "Y" | "N";
  status: TourStatus;
  financialYear: string;
  versionNo: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
  submittedAt: string | null;
  advances: AdvanceLine[];
  attachments: Attachment[];
  workflowHistory: WorkflowHistoryEntry[];
  authorities: TourAuthorities;
  lastTaEvaluation: TaEvaluationResult | null;

  // --- Post-approval lifecycle (Oct 2026) --------------------------------
  stayType: StayType;
  retainsAccommodationAtDestination: "Y" | "N";
  lastEntitlement: EntitlementSnapshot | null;
  journeyAcknowledgement: JourneyAcknowledgement | null;
  extensions: TourExtension[];
  specialApproval: SpecialApprovalAcknowledgement | null;
  settlement: SettlementRecord | null;
  advanceWithdrawnAt: string | null;
  advanceWithdrawalReason: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancellationOfficialReason: "Y" | "N" | null;
}
