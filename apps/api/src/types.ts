// Shared domain types for the API layer. Mirrors the Oracle schema in
// /database/ddl — keep in sync when either changes.

export type RoleCode = "EMPLOYEE" | "FORWARDING" | "RECOMMENDING" | "APPROVING" | "HR_ADMIN";

export type TourStatus =
  | "DRAFT"
  | "PENDING_FORWARDING"
  | "FORWARDED"
  | "PENDING_RECOMMENDATION"
  | "RECOMMENDED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  // Post-approval lifecycle (client requirement, Oct 2026). The SSoT's
  // workflow ends at APPROVED; these carry the request through the journey
  // itself and into bill settlement under §11.
  | "IN_PROGRESS" // journey start acknowledged
  | "PENDING_EXTENSION_APPROVAL" // an extension is awaiting the Approving Authority
  | "COMPLETED" // tour ended, settlement not yet submitted
  | "PENDING_SETTLEMENT_APPROVAL"
  | "SETTLED"
  | "REJECTED"
  | "CANCELLED";

export type WorklistStatusFilter = "Pending" | "Approved" | "Rejected";

export interface Employee {
  personNumber: string;
  staffNo: string;
  scaleCode: string;
  name: string;
  department: string;
  gradeCode: string; // matches ta_rule_master.grade_code, e.g. "E7"
  headquarter: string;
  roles: RoleCode[];
}

export interface Destination {
  destCode: string;
  destName: string;
  activeFlag: "Y" | "N";
  /**
   * §4.5 — one of the 12 "Specified Locations" carrying the higher lodging
   * ceiling in §7.2(A). Derived from repository/specified-locations.ts.
   */
  specifiedLocationFlag: "Y" | "N";
}

export type AirEntitlement =
  | "NOT_ENTITLED"
  | "ECONOMY_OR_EQUIVALENT"
  | "PREMIUM_ECONOMY_OR_ECONOMY"
  | "EXECUTIVE_CLASS";

export interface TaRule {
  ruleId: number;
  gradeCode: string;
  gradeLabel: string;
  railEntitlement: string;
  waterwayEntitlement: string;
  airEntitlement: AirEntitlement;
  airMinDistanceKm: number | null;
  airRegionExceptionFlag: "Y" | "N";
  roadMileageRate: number | null; // null = "Actual"
  daHotelRate: number;
  daOwnArrangementRate: number;
  lodgingCeilingSpecified: number | null;
  lodgingCeilingOther: number | null;
  discretionaryModeFlag: "Y" | "N";
  effectiveFrom: string;
  effectiveTo: string | null;
  ruleVersion: number;
  sourceRef: string;
}

export type RoadTravelPermission = "No" | "Own Vehicle" | "Hired Vehicle" | "Vehicle Retention";
export type AirTravelPermission = "No" | "Yes";
export type RailTravelPermission = "No" | "Yes";

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
  /**
   * Mirrors domain/workflow-state-machine.ts's WorkflowAction, plus RETURN,
   * which is recorded in history but is not a state-machine transition.
   */
  action:
    | "SUBMIT"
    | "FORWARD"
    | "RECOMMEND"
    | "APPROVE"
    | "REJECT"
    | "RETURN"
    | "CANCEL"
    | "ACKNOWLEDGE_JOURNEY_START"
    | "REQUEST_EXTENSION"
    | "APPROVE_EXTENSION"
    | "REJECT_EXTENSION"
    | "COMPLETE_TOUR"
    | "SUBMIT_SETTLEMENT"
    | "APPROVE_SETTLEMENT"
    | "REJECT_SETTLEMENT"
    | "WITHDRAW_ADVANCE";
  oldStatus: TourStatus | null;
  newStatus: TourStatus;
  remarks: string | null;
  actionAt: string;
}

export interface TourAuthorities {
  forwarding: { personNumber: string; name: string; designation: string } | null;
  recommending: { personNumber: string; name: string; designation: string } | null;
  approving: { personNumber: string; name: string; designation: string } | null;
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
    requested: AirTravelPermission;
    entitled: boolean;
    entitlementClass: AirEntitlement;
    requiresDistanceCheck: boolean;
    distanceKm: number | null;
    regionExceptionApplied: boolean;
    resultCode:
      | "AIR_NOT_REQUESTED"
      | "AIR_ENTITLED_UNCONDITIONAL"
      | "AIR_DISTANCE_REQUIRED"
      | "AIR_REGION_EXCEPTION"
      | "AIR_NOT_ENTITLED"
      | "AIR_NOT_ENTITLED_DISTANCE_INSUFFICIENT";
    message: string;
  };
  ownVehicle: {
    requested: boolean;
    requiresCompetentAuthorityApproval: boolean;
    resultCode: "OWN_VEHICLE_NOT_REQUESTED" | "OWN_VEHICLE_APPROVAL_REQUIRED" | "OWN_VEHICLE_APPROVED";
  };
  /**
   * Road travel entitlement, stated explicitly (client requirement, Oct 2026).
   * Every grade in §6 carries a road mileage rate, so `entitled` is true for
   * all of them; Chairman/Director is entitled at actuals (rate null). The
   * only road restriction in the Rules is §6.1(b) — use of an *own* vehicle
   * needs prior Competent Authority approval — which is reported separately
   * in `ownVehicle` and reflected in `requiresApproval` here.
   */
  road: {
    requested: RoadTravelPermission;
    entitled: boolean;
    /** null = "Actual" (Chairman/Director, §6). */
    mileageRatePerKm: number | null;
    requiresApproval: boolean;
    resultCode:
      | "ROAD_NOT_REQUESTED"
      | "ROAD_ENTITLED"
      | "ROAD_ENTITLED_ACTUALS"
      | "ROAD_ENTITLED_APPROVAL_REQUIRED";
    message: string;
  };
  /**
   * The §6(c) 500km threshold. Reported for every request so the UI can show
   * the indicator the client asked for, not only for the E-1/E-2 air gate.
   */
  distance: {
    oneWayDistanceKm: number | null;
    thresholdKm: number;
    /** null when the distance is not recorded — never assumed either way. */
    beyondThreshold: boolean | null;
    requiresSpecialApproval: boolean;
    resultCode: "DISTANCE_NOT_RECORDED" | "DISTANCE_WITHIN_THRESHOLD" | "DISTANCE_BEYOND_THRESHOLD";
    message: string;
  };
  higherClass: {
    discretionaryGrade: boolean;
    requiresCompetentAuthorityApproval: boolean;
    resultCode:
      | "HIGHER_CLASS_NOT_APPLICABLE"
      | "HIGHER_CLASS_DISCRETION_E7_PLUS"
      | "HIGHER_CLASS_APPROVAL_REQUIRED";
  };
  validationMessages: string[];
}

// --- Post-approval lifecycle (client requirements, Oct 2026) --------------

/**
 * Journey-start acknowledgement. Confirmed with the client: either the
 * employee or the Forwarding Authority (acting as controlling officer) may
 * acknowledge, and only once the advance has been approved.
 */
export interface JourneyAcknowledgement {
  acknowledgedBy: string;
  acknowledgedByName: string;
  /** EMPLOYEE for self-acknowledgement, FORWARDING for the controlling officer. */
  acknowledgedByRole: Extract<RoleCode, "EMPLOYEE" | "FORWARDING">;
  acknowledgedAt: string;
  /** Actual journey start, which may differ from the planned travelStartDate. */
  actualStartDate: string;
  remarks: string | null;
}

/**
 * A tour extension. Confirmed with the client: extension recomputes the
 * entitlement and returns to the Approving Authority only, not the full
 * three-stage chain, since the tour is already sanctioned and underway.
 */
export interface TourExtension {
  extensionId: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  previousEndDate: string;
  newEndDate: string;
  reason: string;
  /** Additional advance sought on account of the extension, if any. */
  additionalAdvanceAmount: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionRemarks: string | null;
}

/**
 * §6(c) / client requirement: where one-way distance exceeds 500km the
 * request enters a special approval flow and the approver's acknowledgement
 * is captured explicitly rather than being implied by the ordinary approval.
 */
export interface SpecialApprovalAcknowledgement {
  acknowledgedBy: string;
  acknowledgedByName: string;
  acknowledgedAt: string;
  distanceKm: number | null;
  /** Why special approval was required, captured at the time of the decision. */
  groundsCode: "DISTANCE_BEYOND_500KM" | "DISTANCE_NOT_RECORDED";
  remarks: string | null;
}

export type SettlementCategoryCode = "AIR_FARE" | "RAIL" | "ROAD" | "DA" | "LODGING" | "INCIDENTAL";

export interface SettlementLine {
  lineNo: number;
  categoryCode: SettlementCategoryCode;
  /** What the employee actually spent, per bills. */
  claimedAmount: number;
  /**
   * Ceiling from the entitlement calculator, where one exists. null means the
   * Rules set no monetary cap on this line (journey fare per §6; lodging at
   * actuals for E-9 and above per §7.2A).
   */
  entitlementCap: number | null;
  /** Set by the settlement approver; defaults to min(claimed, cap). */
  admittedAmount: number | null;
  /** Populated when admitted < claimed, so the employee sees why. */
  disallowanceReason: string | null;
}

/**
 * Bill settlement under §11: "Bill to be submitted within one month of
 * completion of journey", with the advance recoverable on delay.
 */
export interface SettlementRecord {
  settlementId: string;
  requestId: string;
  submittedBy: string;
  submittedAt: string | null;
  /** §11 — one month from journey completion. */
  dueDate: string;
  /** True when submitted after dueDate, which makes the advance recoverable. */
  submittedLate: boolean;
  lines: SettlementLine[];
  /** Sum of approved advance lines on the parent request. */
  advanceDrawn: number;
  totalClaimed: number;
  totalAdmitted: number | null;
  /** Positive = payable to employee; negative = recoverable from employee. */
  netPayable: number | null;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  remarks: string | null;
  attachments: Attachment[];
}

/**
 * Self-service out-of-office delegation. Confirmed with the client: an
 * approver nominates an acting authority for a date range, and anything
 * arriving in that window routes to the delegate automatically.
 */
export interface Delegation {
  delegationId: string;
  /** The authority who is delegating. */
  fromPersonNumber: string;
  fromName: string;
  /** The acting authority. */
  toPersonNumber: string;
  toName: string;
  /** Which of the delegator's roles is being delegated. */
  roleCode: Extract<RoleCode, "FORWARDING" | "RECOMMENDING" | "APPROVING">;
  /** Inclusive ISO dates. */
  fromDate: string;
  toDate: string;
  reason: string | null;
  active: boolean;
  createdAt: string;
  revokedAt: string | null;
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
  roadTravelPermission: RoadTravelPermission;
  vehicleNumber: string | null;
  airTravelPermission: AirTravelPermission;
  railTravelPermission: RailTravelPermission;
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

  // --- Post-approval lifecycle (client requirements, Oct 2026) ------------
  /** §7.2B — drives which DA column applies. */
  stayType: "HOTEL_OR_GUEST_HOUSE" | "OWN_ARRANGEMENT";
  /** §7.2C(9) — halves DA and bars Hotel/GH at the touring location. */
  retainsAccommodationAtDestination: "Y" | "N";
  /** Snapshot of the entitlement ceiling shown to the employee at submission. */
  lastEntitlement: EntitlementSnapshot | null;
  /** Set once the employee or controlling officer confirms the journey began. */
  journeyAcknowledgement: JourneyAcknowledgement | null;
  extensions: TourExtension[];
  /** Captured when the >500km special approval flow is exercised. */
  specialApproval: SpecialApprovalAcknowledgement | null;
  settlement: SettlementRecord | null;
  /** Employee retracted the advance request while keeping the tour (§11). */
  advanceWithdrawnAt: string | null;
  advanceWithdrawalReason: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  /**
   * §6.1(d) — charges for a cancelled/rescheduled journey are admissible only
   * where the change was for official reasons and CA-approved.
   */
  cancellationOfficialReason: "Y" | "N" | null;
}

/**
 * Serialisable snapshot of a domain/entitlement-calculator result, stored on
 * the request so an approver sees the same figures the employee saw, even if
 * the rule table is later versioned.
 */
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
