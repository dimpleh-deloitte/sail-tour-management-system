import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { evaluateTaRules } from "../../domain/ta-rule-engine.js";
import { calculateEntitlement } from "../../domain/entitlement-calculator.js";
import { store } from "../../repository/store.js";
import { AIR_TRAVEL_PERMISSIONS, ROAD_TRAVEL_PERMISSIONS } from "../reference-data/lov.js";
import { ApiError } from "../../middleware/error-handler.js";

export const taRulesRouter = Router();
taRulesRouter.use(requireAuth);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date (YYYY-MM-DD).");

const evaluateSchema = z.object({
  // Destination is only used for the air region-exception check and the
  // §4.5 Specified-Location lodging ceiling — grade-based entitlements (rail
  // class, road mileage, air class) don't need it, so it's optional here and
  // the employee can see live eligibility before picking a destination.
  destCode: z.string().optional().default(""),
  // Needed to resolve the §6(c) one-way distance from the HQ->destination
  // matrix. Falls back to the employee's own headquarters.
  headquarter: z.string().optional(),
  airTravelPermission: z.enum(AIR_TRAVEL_PERMISSIONS as unknown as [string, ...string[]]),
  roadTravelPermission: z
    .enum(ROAD_TRAVEL_PERMISSIONS as unknown as [string, ...string[]])
    .default("No"),
  ownVehicleRequested: z.boolean().default(false),
  nonShortestRoute: z.boolean().default(false),
  requestedHigherClass: z.boolean().default(false),
  // Supplying both dates asks for the entitlement ceiling (§7.2/§7.3) in
  // addition to eligibility, so the employee sees the maximum admissible
  // amount before submitting.
  travelStartDate: isoDate.optional(),
  travelEndDate: isoDate.optional(),
  stayType: z.enum(["HOTEL_OR_GUEST_HOUSE", "OWN_ARRANGEMENT"]).default("HOTEL_OR_GUEST_HOUSE"),
  retainsAccommodationAtDestination: z.boolean().default(false),
});

// POST /api/v1/ta/evaluate — SSoT §19: "Evaluate applicable TA eligibility/rules."
// Uses the authenticated employee's own grade — never a client-supplied grade.
//
// Returns eligibility (may I travel this way?) always, and the entitlement
// ceiling (how much may I claim?) whenever both travel dates are supplied.
taRulesRouter.post("/ta/evaluate", (req, res) => {
  const input = evaluateSchema.parse(req.body);
  const user = req.user!;
  const headquarter = input.headquarter ?? user.headquarter;

  const result = evaluateTaRules({
    gradeCode: user.gradeCode,
    destCode: input.destCode,
    airTravelPermission: input.airTravelPermission as "No" | "Yes",
    roadTravelPermission: input.roadTravelPermission as "No" | "Own Vehicle" | "Hired Vehicle" | "Vehicle Retention",
    ownVehicleRequested: input.ownVehicleRequested || input.roadTravelPermission === "Own Vehicle",
    nonShortestRoute: input.nonShortestRoute,
    requestedHigherClass: input.requestedHigherClass,
    oneWayDistanceKm: input.destCode ? store.findDistanceKm(headquarter, input.destCode) : null,
  });

  // Entitlement ceiling is only computable once both dates are known — §7.3
  // bands are a function of the tour period.
  let entitlement = null;
  if (input.travelStartDate && input.travelEndDate) {
    if (input.travelEndDate < input.travelStartDate) {
      throw new ApiError(400, "VALIDATION_ERROR", "Travel end date cannot precede the start date.", {
        travelEndDate: "End date must be on or after the start date.",
      });
    }
    const rule = store.taRules.find((r) => r.gradeCode === user.gradeCode && r.effectiveTo === null);
    if (rule) {
      const dest = store.destinations.find((d) => d.destCode === input.destCode);
      entitlement = calculateEntitlement({
        rule,
        travelStartDate: input.travelStartDate,
        travelEndDate: input.travelEndDate,
        isSpecifiedLocation: dest?.specifiedLocationFlag === "Y",
        stayType: input.stayType,
        retainsAccommodationAtDestination: input.retainsAccommodationAtDestination,
      });
    }
  }

  res.json({ data: { ...result, entitlement } });
});
