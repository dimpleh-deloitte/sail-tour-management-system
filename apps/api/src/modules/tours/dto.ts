import { z } from "zod";
import { HEADQUARTERS, TOUR_TYPES, ROAD_TRAVEL_PERMISSIONS, AIR_TRAVEL_PERMISSIONS, RAIL_TRAVEL_PERMISSIONS } from "../reference-data/lov.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD).");

export const advanceLineInputSchema = z.object({
  categoryCode: z.string().min(1),
  appliedAmount: z.number().min(0, "Applied amount must be zero or greater."), // VAL-09
});

// Fields captured on the Add Tour form (SSoT §5-§12). Employee identity
// fields are deliberately NOT accepted here — they are always derived
// server-side from the authenticated session (SSoT VAL-01).
export const tourInputSchema = z.object({
  headquarter: z.enum(HEADQUARTERS as unknown as [string, ...string[]]), // SSoT §6
  commencementDate: isoDate,
  travelStartDate: isoDate,
  travelEndDate: isoDate,
  tourType: z.enum(TOUR_TYPES as unknown as [string, ...string[]]), // VAL-03
  destCode: z.string().min(1), // resolved against DESTINATION_MASTER server-side — VAL-04
  purpose: z.string().max(500, "Purpose must be 500 characters or fewer."), // VAL-07
  roadTravelPermission: z.enum(ROAD_TRAVEL_PERMISSIONS as unknown as [string, ...string[]]).default("No"), // VAL-05
  vehicleNumber: z.string().max(30).nullable().optional(),
  airTravelPermission: z.enum(AIR_TRAVEL_PERMISSIONS as unknown as [string, ...string[]]).default("No"), // VAL-06
  railTravelPermission: z.enum(RAIL_TRAVEL_PERMISSIONS as unknown as [string, ...string[]]).default("No"),
  nonShortestRouteFlag: z.boolean().default(false),
  higherClassApprovalFlag: z.boolean().default(false),
  ownVehicleApprovalFlag: z.boolean().default(false),
  competentAuthorityApprover: z.string().nullable().optional(),
  pnrTicketNumber: z.string().max(60).nullable().optional(), // VAL-14
  advanceRequired: z.boolean().default(false),
  advances: z.array(advanceLineInputSchema).default([]),

  // §7.2B — which DA column applies. Defaults to a hotel/guest-house stay,
  // which is the lower of the two rates, so the default never over-states
  // the entitlement.
  stayType: z.enum(["HOTEL_OR_GUEST_HOUSE", "OWN_ARRANGEMENT"]).default("HOTEL_OR_GUEST_HOUSE"),
  // §7.2C(9) — retention of Company accommodation/HRA at the touring
  // location bars Hotel/GH there and halves DA.
  retainsAccommodationAtDestination: z.boolean().default(false),
});

export type TourInput = z.infer<typeof tourInputSchema>;

// --- Post-approval lifecycle actions (client requirements, Oct 2026) ------

export const journeyStartSchema = z.object({
  expectedVersion: z.number().int().positive(),
  /** Actual start, which may differ from the planned travelStartDate. */
  actualStartDate: isoDate,
  remarks: z.string().max(2000).nullable().optional(),
});

export const cancelSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().min(1, "A cancellation reason is required.").max(2000),
  /**
   * §6.1(d) — cancellation/rescheduling charges are admissible only where the
   * change was necessitated by official reasons and approved by the Competent
   * Authority. Captured at cancellation time so settlement can apply it.
   */
  officialReason: z.boolean().default(false),
});

export const withdrawAdvanceSchema = z.object({
  expectedVersion: z.number().int().positive(),
  reason: z.string().min(1, "A withdrawal reason is required.").max(2000),
});

export const extensionRequestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  newEndDate: isoDate,
  reason: z.string().min(1, "An extension reason is required.").max(2000),
  additionalAdvanceAmount: z.number().min(0).nullable().optional(),
});

export const extensionDecisionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  extensionId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  remarks: z.string().max(2000).nullable().optional(),
});

/**
 * Explicit approver acknowledgement for the >500km special approval flow
 * (§6(c) and the client's Oct 2026 requirement). Recorded separately from the
 * ordinary approval remark so it is auditable on its own.
 */
export const specialApprovalSchema = z.object({
  expectedVersion: z.number().int().positive(),
  acknowledged: z.literal(true, {
    errorMap: () => ({ message: "The distance acknowledgement must be confirmed." }),
  }),
  remarks: z.string().max(2000).nullable().optional(),
});

// Amounts a workflow-stage authority enters for the fixed advance
// categories, keyed by categoryCode — see workflow/service.ts `act()`,
// which writes these into the column matching the authority's own role
// (forwardedAmount / recommendedAmount / approvedAmount) and leaves the
// other columns untouched ("frozen") per the client's confirmed screenshot.
export const advanceAmountInputSchema = z.object({
  categoryCode: z.string().min(1),
  amount: z.number().min(0),
});

export const workflowActionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  remarks: z.string().max(2000).nullable().optional(),
  advanceAmounts: z.array(advanceAmountInputSchema).optional(),
  /**
   * Field-level edits an approver may make while acting (client requirement
   * 5, Oct 2026). Restricted to the travel-arrangement fields an authority
   * can legitimately correct — never the employee's identity, the dates that
   * drive the entitlement, or the destination, all of which would change the
   * request into a different one and must go back to the employee.
   */
  edits: z
    .object({
      pnrTicketNumber: z.string().max(60).nullable().optional(),
      vehicleNumber: z.string().max(30).nullable().optional(),
      roadTravelPermission: z
        .enum(ROAD_TRAVEL_PERMISSIONS as unknown as [string, ...string[]])
        .optional(),
      airTravelPermission: z.enum(AIR_TRAVEL_PERMISSIONS as unknown as [string, ...string[]]).optional(),
      railTravelPermission: z.enum(RAIL_TRAVEL_PERMISSIONS as unknown as [string, ...string[]]).optional(),
      competentAuthorityApprover: z.string().max(200).nullable().optional(),
      purpose: z.string().max(500).optional(),
    })
    .optional(),
});

// --- Settlement (§11) ------------------------------------------------------

export const settlementLineInputSchema = z.object({
  categoryCode: z.enum(["AIR_FARE", "RAIL", "ROAD", "DA", "LODGING", "INCIDENTAL"]),
  claimedAmount: z.number().min(0, "Claimed amount must be zero or greater."),
});

export const settlementSubmitSchema = z.object({
  expectedVersion: z.number().int().positive(),
  lines: z.array(settlementLineInputSchema).min(1, "At least one settlement line is required."),
  remarks: z.string().max(2000).nullable().optional(),
});

export const settlementDecisionLineSchema = z.object({
  lineNo: z.number().int().positive(),
  admittedAmount: z.number().min(0),
  disallowanceReason: z.string().max(500).nullable().optional(),
});

export const settlementDecisionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  decision: z.enum(["APPROVE", "REJECT"]),
  lines: z.array(settlementDecisionLineSchema).optional(),
  remarks: z.string().max(2000).nullable().optional(),
});

// --- Delegation (acting authority) ----------------------------------------

export const delegationCreateSchema = z
  .object({
    toPersonNumber: z.string().min(1, "An acting authority must be selected."),
    roleCode: z.enum(["FORWARDING", "RECOMMENDING", "APPROVING"]),
    fromDate: isoDate,
    toDate: isoDate,
    reason: z.string().max(500).nullable().optional(),
  })
  .refine((v) => v.toDate >= v.fromDate, {
    message: "The end date cannot precede the start date.",
    path: ["toDate"],
  });
