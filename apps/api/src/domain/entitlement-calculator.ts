// Entitlement calculator — SAIL TA Rules-2021 §7.2 and §7.3.
//
// This module turns the grade-wise *rates* held in ta_rule_master into the
// actual *ceiling amounts* a given tour may claim, so an employee can see the
// maximum admissible figure before submitting (client requirement, Oct 2026).
//
// Division of responsibility, deliberately kept narrow:
//   ta-rule-engine.ts  -> may I travel this way at all? (eligibility)
//   this module        -> how much may I claim? (quantum)
// Neither routes nor React components may re-derive any of it.
//
// What is computable here and what is not
// ---------------------------------------
// DA and lodging are fully determined by the Rules: a grade rate times a
// duration band (§7.3) and a nightly ceiling (§7.2A). Journey fare is NOT.
// §6 entitles an employee to "actuals by entitled class" and sets no monetary
// cap anywhere, so this module deliberately returns no fare ceiling rather
// than inventing one. The confirmed scope (Oct 2026) is: compute DA and
// lodging as hard caps, present fare as actuals-by-entitled-class.
import { TaRule } from "../types.js";

// --- §7.3 Regulation of DA depending upon Tour Period ----------------------
// Verbatim from the Rules:
//   Less than 6 hours   -> Nil
//   6 to 12 hours       -> Half DA
//   12 to 24 hours      -> Full DA
//   More than 24 hours  -> Full DA for each 24 hour duration plus half DA
//                          upto additional 12 hours.
// The footnote "*including holidays during Tour but excluding leave period,
// if any" means the raw elapsed duration is the right input; leave taken
// mid-tour is a deduction the settlement stage applies, not something that
// can be known at request time.
export type DaBand = "NIL" | "HALF" | "FULL" | "MULTI_DAY";

export interface DaComputation {
  band: DaBand;
  /** Elapsed tour duration in hours, per §4.1(b). */
  durationHours: number;
  /**
   * DA payable expressed as a multiple of the daily rate — e.g. 2.5 means two
   * full days plus a half. Kept separate from the money so the multiplier is
   * auditable on its own.
   */
  daMultiplier: number;
  /** Plain-language basis, shown to the employee and stored on the request. */
  basis: string;
}

/**
 * §4.1(b): "A tour shall be deemed to have commenced from the scheduled time
 * of departure ... and shall be deemed to have ended at the actual time of
 * arrival of transport at the Headquarters station."
 */
export function computeDaMultiplier(durationHours: number): DaComputation {
  if (durationHours < 0) {
    throw new RangeError("Tour duration cannot be negative.");
  }

  if (durationHours < 6) {
    return {
      band: "NIL",
      durationHours,
      daMultiplier: 0,
      basis: "Tour period is less than 6 hours — no DA is admissible.",
    };
  }

  if (durationHours <= 12) {
    return {
      band: "HALF",
      durationHours,
      daMultiplier: 0.5,
      basis: "Tour period is between 6 and 12 hours — half DA is admissible.",
    };
  }

  if (durationHours <= 24) {
    return {
      band: "FULL",
      durationHours,
      daMultiplier: 1,
      basis: "Tour period is between 12 and 24 hours — full DA is admissible.",
    };
  }

  // More than 24 hours: full DA for each completed 24-hour block, plus a half
  // DA for a remainder of up to 12 hours. A remainder above 12 hours earns a
  // further full DA, which is what the next completed block already accounts
  // for once it is reached; between 12 and 24 hours of remainder the Rules
  // give full DA by the same reading as the 12-to-24 band above.
  const fullBlocks = Math.floor(durationHours / 24);
  const remainderHours = durationHours - fullBlocks * 24;

  let remainderMultiplier = 0;
  let remainderBasis = "";
  if (remainderHours === 0) {
    remainderBasis = "";
  } else if (remainderHours <= 12) {
    remainderMultiplier = 0.5;
    remainderBasis = ` plus half DA for the remaining ${formatHours(remainderHours)} (up to 12 hours)`;
  } else {
    remainderMultiplier = 1;
    remainderBasis = ` plus full DA for the remaining ${formatHours(remainderHours)} (over 12 hours)`;
  }

  return {
    band: "MULTI_DAY",
    durationHours,
    daMultiplier: fullBlocks + remainderMultiplier,
    basis:
      `Tour period is ${formatHours(durationHours)} — full DA for each of the ` +
      `${fullBlocks} complete 24-hour period${fullBlocks === 1 ? "" : "s"}${remainderBasis}.`,
  };
}

function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} hour${rounded === 1 ? "" : "s"}`;
}

// --- Stay type (§7.2B) -----------------------------------------------------
// The DA rate itself depends on where the employee stays: there is one column
// for a hotel/guest-house stay and a higher one for own arrangement (payable
// on self-certification, §7.2B footnote).
export type StayType = "HOTEL_OR_GUEST_HOUSE" | "OWN_ARRANGEMENT";

export interface EntitlementInput {
  rule: TaRule;
  /** Tour start, ISO-8601. Per §4.1(b) this is scheduled departure from HQ. */
  travelStartDate: string;
  /** Tour end, ISO-8601. Per §4.1(b) this is actual arrival back at HQ. */
  travelEndDate: string;
  /** Drives which §7.2A ceiling column applies. */
  isSpecifiedLocation: boolean;
  stayType: StayType;
  /**
   * §7.2C(9): an employee on tour to a location where they have been allowed
   * to retain Company accommodation/HRA under the Retention Rules may not use
   * Hotel/GH facilities there, and DA drops to 50% of the own-arrangement
   * rate. Caller supplies this; it is a property of the employee's retention
   * status, not something derivable from the tour itself.
   */
  retainsAccommodationAtDestination: boolean;
}

export interface EntitlementBreakdown {
  ruleId: number;
  ruleVersion: number;
  gradeCode: string;
  gradeLabel: string;

  da: {
    computation: DaComputation;
    stayType: StayType;
    /** The §7.2B per-day rate that applies to this stay type. */
    ratePerDay: number;
    /** §7.2C(9) halving, if it applied. */
    retentionHalvingApplied: boolean;
    maxAmount: number;
  };

  lodging: {
    /** Nights for which lodging may be claimed. */
    nights: number;
    locationType: "SPECIFIED" | "OTHER";
    /** null = "Actuals" (E-9 and above, §7.2A). */
    ceilingPerNight: number | null;
    /** null when the ceiling is "Actuals" — no computable maximum exists. */
    maxAmount: number | null;
    applicable: boolean;
    note: string;
  };

  fare: {
    /** §6 sets no monetary cap — this is informational, never a ceiling. */
    railEntitlement: string;
    waterwayEntitlement: string;
    airEntitlement: TaRule["airEntitlement"];
    roadMileageRate: number | null;
    note: string;
  };

  /**
   * DA + lodging only. null when lodging is "Actuals" (E-9+) and therefore has
   * no computable ceiling. Journey fare is never included — see module header.
   */
  maxComputableAdvance: number | null;

  /** Conditions from §7.2C the employee/approver must be aware of. */
  advisories: string[];
}

/**
 * §7.2C(12): "Full DA (F&I) will be admissible for a halt for up to 14 days at
 * one stretch. However, full DA (F&I) in case of a halt beyond 14 days will be
 * payable only with the approval of concerned Director/CE."
 */
export const MAX_HALT_DAYS_WITHOUT_DIRECTOR_APPROVAL = 14;

export function calculateEntitlement(input: EntitlementInput): EntitlementBreakdown {
  const { rule } = input;
  const advisories: string[] = [];

  const start = new Date(input.travelStartDate);
  const end = new Date(input.travelEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new RangeError("travelStartDate and travelEndDate must be valid ISO-8601 dates.");
  }
  if (end.getTime() < start.getTime()) {
    throw new RangeError("travelEndDate cannot precede travelStartDate.");
  }

  const durationHours = (end.getTime() - start.getTime()) / 36e5;
  const computation = computeDaMultiplier(durationHours);

  // --- DA (§7.2B, §7.2C(9)) -----------------------------------------------
  const baseRate =
    input.stayType === "OWN_ARRANGEMENT" ? rule.daOwnArrangementRate : rule.daHotelRate;

  // §7.2C(9) is written against the own-arrangement amount specifically:
  // "DA will be payable at the rate of 50% of amount payable in case of
  // own-arrangement" — so the halving is applied to that column regardless of
  // the stay type selected, because Hotel/GH is not available to the employee
  // at such a location in the first place.
  let ratePerDay = baseRate;
  let retentionHalvingApplied = false;
  if (input.retainsAccommodationAtDestination) {
    ratePerDay = rule.daOwnArrangementRate * 0.5;
    retentionHalvingApplied = true;
    advisories.push(
      "Company accommodation/HRA is retained at this location: Hotel/Guest House may not be availed " +
        "and DA is payable at 50% of the own-arrangement rate."
    );
  }

  const daMaxAmount = round2(ratePerDay * computation.daMultiplier);

  // --- Lodging (§7.2A) -----------------------------------------------------
  // Lodging is claimable per night of stay, which is the number of nights
  // spanned by the tour. A tour of under 24 hours with no overnight stay has
  // no lodging claim.
  const nights = countNights(start, end);
  const locationType = input.isSpecifiedLocation ? ("SPECIFIED" as const) : ("OTHER" as const);
  const ceilingPerNight = input.isSpecifiedLocation
    ? rule.lodgingCeilingSpecified
    : rule.lodgingCeilingOther;

  const lodgingApplicable = nights > 0 && !input.retainsAccommodationAtDestination;
  let lodgingMax: number | null;
  let lodgingNote: string;

  if (input.retainsAccommodationAtDestination) {
    lodgingMax = 0;
    lodgingNote =
      "Not admissible — Hotel/Guest House may not be availed where Company accommodation/HRA is retained.";
  } else if (nights === 0) {
    lodgingMax = 0;
    lodgingNote = "No overnight stay — no lodging claim arises.";
  } else if (ceilingPerNight === null) {
    // E-9 and above: "Actuals". There is no computable ceiling.
    lodgingMax = null;
    lodgingNote = `Actuals for ${nights} night${nights === 1 ? "" : "s"} — grade ${rule.gradeLabel} has no monetary lodging ceiling.`;
  } else {
    lodgingMax = round2(ceilingPerNight * nights);
    lodgingNote =
      `Up to ₹${ceilingPerNight.toLocaleString("en-IN")}/night × ${nights} night${nights === 1 ? "" : "s"} ` +
      `at a ${locationType === "SPECIFIED" ? "Specified Location" : "non-specified location"}, or actuals, whichever is lower.`;
  }

  // --- §7.2C advisories that change what is actually payable ---------------
  if (nights > MAX_HALT_DAYS_WITHOUT_DIRECTOR_APPROVAL) {
    advisories.push(
      `Halt exceeds ${MAX_HALT_DAYS_WITHOUT_DIRECTOR_APPROVAL} days at one stretch — full DA beyond ` +
        `${MAX_HALT_DAYS_WITHOUT_DIRECTOR_APPROVAL} days requires approval of the concerned Director/CE.`
    );
  }
  if (lodgingApplicable) {
    advisories.push(
      "Stay preference order: Company Guest House, then tie-up hotel/guest house; other hotels only if neither is available."
    );
    advisories.push(
      "Lodging ceilings exclude levies and taxes. Where a bill does not separate boarding and lodging, 50% is treated as lodging."
    );
  }
  if (computation.band === "NIL") {
    advisories.push("No DA arises for a tour period under 6 hours.");
  }

  const maxComputableAdvance = lodgingMax === null ? null : round2(daMaxAmount + lodgingMax);

  return {
    ruleId: rule.ruleId,
    ruleVersion: rule.ruleVersion,
    gradeCode: rule.gradeCode,
    gradeLabel: rule.gradeLabel,
    da: {
      computation,
      stayType: input.stayType,
      ratePerDay,
      retentionHalvingApplied,
      maxAmount: daMaxAmount,
    },
    lodging: {
      nights,
      locationType,
      ceilingPerNight,
      maxAmount: lodgingMax,
      applicable: lodgingApplicable,
      note: lodgingNote,
    },
    fare: {
      railEntitlement: rule.railEntitlement,
      waterwayEntitlement: rule.waterwayEntitlement,
      airEntitlement: rule.airEntitlement,
      roadMileageRate: rule.roadMileageRate,
      note:
        "Journey fare is reimbursed at actuals by the entitled class — the Rules set no monetary " +
        "ceiling on fare, so no maximum is shown here. Reservation, IRCTC/agent commission and Tatkal " +
        "charges are additionally admissible.",
    },
    maxComputableAdvance,
    advisories,
  };
}

/**
 * Nights spanned by the tour, by calendar date rather than elapsed hours —
 * lodging is billed per night of occupancy, so a tour departing late on day 1
 * and returning early on day 3 occupies two nights regardless of the hour
 * count that drives DA.
 */
function countNights(start: Date, end: Date): number {
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(0, Math.round((endDay - startDay) / 864e5));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
