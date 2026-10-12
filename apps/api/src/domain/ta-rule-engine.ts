// TA rule engine — SSoT §15 / §21. Every decision is traceable to a
// ta_rule_master row (ruleId + ruleVersion). This module is the ONLY place
// grade/mode/distance/region eligibility is decided; routes and UI must
// never re-implement these checks (SSoT: "do not hard-code business rules
// into React components" / "implement through backend/domain/rule-engine").
import { store } from "../repository/store.js";
import { AirTravelPermission, RoadTravelPermission, TaEvaluationResult, TaRule } from "../types.js";

/**
 * §6(c) one-way distance threshold above which E-1/E-2 executives become
 * entitled to air travel, and (per the client's Oct 2026 requirement) above
 * which any request is flagged for the special approval flow.
 */
export const DISTANCE_THRESHOLD_KM = 500;

export interface TaEvaluationInput {
  gradeCode: string;
  destCode: string;
  airTravelPermission: AirTravelPermission;
  roadTravelPermission: RoadTravelPermission;
  ownVehicleRequested: boolean; // roadTravelPermission === "Own Vehicle"
  nonShortestRoute: boolean;
  requestedHigherClass: boolean; // employee is asking for a mode/class above entitlement
  // One-way distance from the originating station (§6(c)). Supplied by the
  // caller from the HQ->destination matrix (repository/seed-distances.ts);
  // null means the pair has not been recorded, which the engine surfaces as
  // DISTANCE_NOT_RECORDED rather than assuming eligibility either way.
  oneWayDistanceKm: number | null;
}

export class TaRuleEngineError extends Error {
  code = "TA_RULE_NOT_FOUND";
}

function findActiveRule(gradeCode: string): TaRule {
  const rule = store.taRules.find((r) => r.gradeCode === gradeCode && r.effectiveTo === null);
  if (!rule) {
    throw new TaRuleEngineError(`No active TA_RULE_MASTER row for grade "${gradeCode}".`);
  }
  return rule;
}

function isRegionExceptionDestination(destCode: string): boolean {
  // Configuration seam for SSoT §15.2's J&K/North-East exception. The
  // authoritative destination-to-region mapping is TBD (SSoT §25) — see
  // database/seed/060_seed_ta_rule_region.sql. Until that mapping is
  // populated, this always returns false rather than guessing from the
  // destination name, per the SSoT's explicit instruction not to infer the
  // region from free text.
  void destCode;
  return false;
}

export function evaluateTaRules(input: TaEvaluationInput): TaEvaluationResult {
  const rule = findActiveRule(input.gradeCode);
  const messages: string[] = [];

  // --- Air eligibility (SSoT §15.2, VAL-10) ---------------------------------
  let air: TaEvaluationResult["air"];
  if (input.airTravelPermission === "No") {
    air = {
      requested: "No",
      entitled: false,
      entitlementClass: rule.airEntitlement,
      requiresDistanceCheck: false,
      distanceKm: input.oneWayDistanceKm,
      regionExceptionApplied: false,
      resultCode: "AIR_NOT_REQUESTED",
      message: "Air travel was not requested.",
    };
  } else if (rule.airEntitlement === "NOT_ENTITLED") {
    air = {
      requested: "Yes",
      entitled: false,
      entitlementClass: "NOT_ENTITLED",
      requiresDistanceCheck: false,
      distanceKm: input.oneWayDistanceKm,
      regionExceptionApplied: false,
      resultCode: "AIR_NOT_ENTITLED",
      message: `Grade ${rule.gradeLabel} is not entitled to air travel. Competent Authority approval is required to proceed.`,
    };
    messages.push(air.message);
  } else if (rule.airMinDistanceKm === null) {
    // Unconditional entitlement (E-3 and above, excluding the E-1/E-2 gate).
    air = {
      requested: "Yes",
      entitled: true,
      entitlementClass: rule.airEntitlement,
      requiresDistanceCheck: false,
      distanceKm: input.oneWayDistanceKm,
      regionExceptionApplied: false,
      resultCode: "AIR_ENTITLED_UNCONDITIONAL",
      message: `Grade ${rule.gradeLabel} is entitled to air travel (${rule.airEntitlement}) without a distance condition.`,
    };
  } else {
    // Distance-gated entitlement (E-1/E-2, SSoT §15.2).
    const regionException = rule.airRegionExceptionFlag === "Y" && isRegionExceptionDestination(input.destCode);
    if (regionException) {
      air = {
        requested: "Yes",
        entitled: true,
        entitlementClass: rule.airEntitlement,
        requiresDistanceCheck: false,
        distanceKm: input.oneWayDistanceKm,
        regionExceptionApplied: true,
        resultCode: "AIR_REGION_EXCEPTION",
        message: `Grade ${rule.gradeLabel} is entitled to air travel via the J&K/North-East region exception, irrespective of distance.`,
      };
    } else if (input.oneWayDistanceKm === null) {
      // Distance capture was removed from the Add Tour form at the client's
      // direction, then reinstated in Oct 2026 as reference data (the
      // HQ->destination matrix) rather than a self-reported field. This
      // branch is now reached only when that matrix has no row for the
      // employee's HQ/destination pair.
      //
      // The request is not blocked — an unpopulated matrix must not stop an
      // employee travelling — but it is no longer silent either: it routes
      // to the >500km special approval flow so a human decides, and says so
      // in `messages`.
      air = {
        requested: "Yes",
        entitled: true,
        entitlementClass: rule.airEntitlement,
        requiresDistanceCheck: true,
        distanceKm: null,
        regionExceptionApplied: false,
        resultCode: "AIR_DISTANCE_REQUIRED",
        message: `Grade ${rule.gradeLabel} air entitlement is subject to the ${rule.airMinDistanceKm}km one-way distance condition, but no distance is recorded for this headquarters/destination pair. Special approval is required to confirm eligibility.`,
      };
      messages.push(air.message);
    } else if (input.oneWayDistanceKm > rule.airMinDistanceKm) {
      air = {
        requested: "Yes",
        entitled: true,
        entitlementClass: rule.airEntitlement,
        requiresDistanceCheck: true,
        distanceKm: input.oneWayDistanceKm,
        regionExceptionApplied: false,
        resultCode: "AIR_ENTITLED_UNCONDITIONAL",
        message: `Grade ${rule.gradeLabel} entitled: one-way distance ${input.oneWayDistanceKm}km exceeds the ${rule.airMinDistanceKm}km threshold.`,
      };
    } else {
      air = {
        requested: "Yes",
        entitled: false,
        entitlementClass: rule.airEntitlement,
        requiresDistanceCheck: true,
        distanceKm: input.oneWayDistanceKm,
        regionExceptionApplied: false,
        resultCode: "AIR_NOT_ENTITLED_DISTANCE_INSUFFICIENT",
        message: `Grade ${rule.gradeLabel} not entitled: one-way distance ${input.oneWayDistanceKm}km does not exceed the ${rule.airMinDistanceKm}km threshold. Competent Authority approval required to proceed.`,
      };
      messages.push(air.message);
    }
  }

  // --- Own vehicle (SSoT §15.3, VAL-11) -------------------------------------
  const ownVehicle: TaEvaluationResult["ownVehicle"] = input.ownVehicleRequested
    ? {
        requested: true,
        requiresCompetentAuthorityApproval: true,
        resultCode: "OWN_VEHICLE_APPROVAL_REQUIRED",
      }
    : { requested: false, requiresCompetentAuthorityApproval: false, resultCode: "OWN_VEHICLE_NOT_REQUESTED" };
  if (ownVehicle.requiresCompetentAuthorityApproval) {
    messages.push("Own-vehicle travel requires prior Competent Authority approval.");
  }

  // --- Higher/different mode or class, and non-shortest route (SSoT §15.3, VAL-12/13) --
  const discretionaryGrade = rule.discretionaryModeFlag === "Y";
  let higherClass: TaEvaluationResult["higherClass"];
  if (!input.requestedHigherClass) {
    higherClass = {
      discretionaryGrade,
      requiresCompetentAuthorityApproval: false,
      resultCode: "HIGHER_CLASS_NOT_APPLICABLE",
    };
  } else if (discretionaryGrade) {
    higherClass = {
      discretionaryGrade,
      requiresCompetentAuthorityApproval: false,
      resultCode: "HIGHER_CLASS_DISCRETION_E7_PLUS",
    };
  } else {
    higherClass = {
      discretionaryGrade,
      requiresCompetentAuthorityApproval: true,
      resultCode: "HIGHER_CLASS_APPROVAL_REQUIRED",
    };
    messages.push(
      "Higher/different mode or class for this grade requires Competent Authority (E-9 or above) approval."
    );
  }

  if (input.nonShortestRoute) {
    messages.push("Non-shortest route requires Competent Authority approval.");
  }

  // --- Road entitlement, stated explicitly (§6, §6.1(b)) --------------------
  // Every one of the 24 grades in the §6 table carries a road mileage rate,
  // so there is no grade that is barred from road travel; Chairman/Director
  // is entitled at actuals (rate null). Confirmed with the client (Oct 2026):
  // show "entitled" for all grades and gate only the use of an own vehicle,
  // which §6.1(b) makes subject to prior Competent Authority approval.
  const road = evaluateRoad(rule, input.roadTravelPermission);

  // --- §6(c) 500km threshold -----------------------------------------------
  // Reported for every request, not only air, so the UI can show the
  // indicator and the special approval flow can be triggered.
  const distance = evaluateDistance(input.oneWayDistanceKm);
  if (distance.requiresSpecialApproval) {
    messages.push(distance.message);
  }

  return {
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    gradeCode: rule.gradeCode,
    railEntitlement: rule.railEntitlement,
    roadMileageRate: rule.roadMileageRate,
    daHotelRate: rule.daHotelRate,
    daOwnArrangementRate: rule.daOwnArrangementRate,
    air,
    ownVehicle,
    road,
    distance,
    higherClass,
    validationMessages: messages,
  };
}

function evaluateRoad(rule: TaRule, requested: RoadTravelPermission): TaEvaluationResult["road"] {
  if (requested === "No") {
    return {
      requested,
      // The entitlement exists whether or not it is being exercised — the
      // employee asked to see entitled/not-entitled by grade, so report it
      // even when road travel is not part of this request.
      entitled: true,
      mileageRatePerKm: rule.roadMileageRate,
      requiresApproval: false,
      resultCode: "ROAD_NOT_REQUESTED",
      message: "Road travel was not requested.",
    };
  }

  // §6(b): "Road mileage admissible will be as per the above rates or actual,
  // whichever is lesser."
  const rateText =
    rule.roadMileageRate === null
      ? "actuals"
      : `₹${rule.roadMileageRate.toFixed(2)}/km, or actuals, whichever is lower`;

  if (requested === "Own Vehicle") {
    return {
      requested,
      entitled: true,
      mileageRatePerKm: rule.roadMileageRate,
      requiresApproval: true,
      resultCode: "ROAD_ENTITLED_APPROVAL_REQUIRED",
      message: `Grade ${rule.gradeLabel} is entitled to road mileage at ${rateText}. Use of an own vehicle requires prior Competent Authority approval.`,
    };
  }

  if (rule.roadMileageRate === null) {
    return {
      requested,
      entitled: true,
      mileageRatePerKm: null,
      requiresApproval: false,
      resultCode: "ROAD_ENTITLED_ACTUALS",
      message: `Grade ${rule.gradeLabel} is entitled to road travel at actuals.`,
    };
  }

  return {
    requested,
    entitled: true,
    mileageRatePerKm: rule.roadMileageRate,
    requiresApproval: false,
    resultCode: "ROAD_ENTITLED",
    message: `Grade ${rule.gradeLabel} is entitled to road mileage at ${rateText}.`,
  };
}

function evaluateDistance(oneWayDistanceKm: number | null): TaEvaluationResult["distance"] {
  if (oneWayDistanceKm === null) {
    return {
      oneWayDistanceKm: null,
      thresholdKm: DISTANCE_THRESHOLD_KM,
      beyondThreshold: null,
      requiresSpecialApproval: true,
      resultCode: "DISTANCE_NOT_RECORDED",
      message: `No one-way distance is recorded for this headquarters/destination pair, so the ${DISTANCE_THRESHOLD_KM}km threshold cannot be verified automatically. Special approval is required.`,
    };
  }

  if (oneWayDistanceKm > DISTANCE_THRESHOLD_KM) {
    return {
      oneWayDistanceKm,
      thresholdKm: DISTANCE_THRESHOLD_KM,
      beyondThreshold: true,
      requiresSpecialApproval: true,
      resultCode: "DISTANCE_BEYOND_THRESHOLD",
      message: `One-way distance ${oneWayDistanceKm}km exceeds the ${DISTANCE_THRESHOLD_KM}km threshold — special approval and an explicit approver acknowledgement are required.`,
    };
  }

  return {
    oneWayDistanceKm,
    thresholdKm: DISTANCE_THRESHOLD_KM,
    beyondThreshold: false,
    requiresSpecialApproval: false,
    resultCode: "DISTANCE_WITHIN_THRESHOLD",
    message: `One-way distance ${oneWayDistanceKm}km is within the ${DISTANCE_THRESHOLD_KM}km threshold.`,
  };
}
