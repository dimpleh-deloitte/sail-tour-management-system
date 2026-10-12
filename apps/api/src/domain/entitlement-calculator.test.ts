// Tests for the §7.2 / §7.3 entitlement quantum rules. Each case cites the
// clause it proves, so a future rule revision can be traced to the tests it
// should break.
import { describe, expect, it } from "vitest";
import { calculateEntitlement, computeDaMultiplier } from "./entitlement-calculator.js";
import { TA_RULES } from "../repository/seed-ta-rules.js";

function ruleFor(gradeCode: string) {
  const rule = TA_RULES.find((r) => r.gradeCode === gradeCode);
  if (!rule) throw new Error(`No seeded rule for grade ${gradeCode}`);
  return rule;
}

describe("§7.3 — regulation of DA depending upon tour period", () => {
  it("allows no DA below 6 hours", () => {
    expect(computeDaMultiplier(0).daMultiplier).toBe(0);
    expect(computeDaMultiplier(5.9).daMultiplier).toBe(0);
    expect(computeDaMultiplier(5.9).band).toBe("NIL");
  });

  it("allows half DA from 6 to 12 hours", () => {
    expect(computeDaMultiplier(6).daMultiplier).toBe(0.5);
    expect(computeDaMultiplier(12).daMultiplier).toBe(0.5);
    expect(computeDaMultiplier(6).band).toBe("HALF");
  });

  it("allows full DA from 12 to 24 hours", () => {
    expect(computeDaMultiplier(12.1).daMultiplier).toBe(1);
    expect(computeDaMultiplier(24).daMultiplier).toBe(1);
    expect(computeDaMultiplier(24).band).toBe("FULL");
  });

  it("allows full DA per 24h block plus half DA for a remainder up to 12h", () => {
    // 36h = one full 24h block + 12h remainder -> 1 + 0.5
    expect(computeDaMultiplier(36).daMultiplier).toBe(1.5);
    // 30h = one block + 6h remainder -> 1 + 0.5
    expect(computeDaMultiplier(30).daMultiplier).toBe(1.5);
    // 48h = exactly two blocks, no remainder -> 2
    expect(computeDaMultiplier(48).daMultiplier).toBe(2);
    // 72h = exactly three blocks -> 3
    expect(computeDaMultiplier(72).daMultiplier).toBe(3);
  });

  it("allows a further full DA where the remainder exceeds 12 hours", () => {
    // 40h = one block + 16h remainder. The remainder is itself in the
    // 12-to-24h band, which §7.3 pays at full DA.
    expect(computeDaMultiplier(40).daMultiplier).toBe(2);
  });

  it("rejects a negative duration rather than producing a silent zero", () => {
    expect(() => computeDaMultiplier(-1)).toThrow(RangeError);
  });
});

describe("§7.2A — lodging ceiling by grade and location type", () => {
  it("applies the Specified Location column to the 12 §4.5 cities", () => {
    const result = calculateEntitlement({
      rule: ruleFor("E5"),
      travelStartDate: "2026-01-05",
      travelEndDate: "2026-01-07",
      isSpecifiedLocation: true,
      stayType: "HOTEL_OR_GUEST_HOUSE",
      retainsAccommodationAtDestination: false,
    });
    // E-4 to E-6 at a Specified Location: Rs.3500/night, 2 nights.
    expect(result.lodging.ceilingPerNight).toBe(3500);
    expect(result.lodging.nights).toBe(2);
    expect(result.lodging.maxAmount).toBe(7000);
    expect(result.lodging.locationType).toBe("SPECIFIED");
  });

  it("applies the Other Locations column elsewhere", () => {
    const result = calculateEntitlement({
      rule: ruleFor("E5"),
      travelStartDate: "2026-01-05",
      travelEndDate: "2026-01-07",
      isSpecifiedLocation: false,
      stayType: "HOTEL_OR_GUEST_HOUSE",
      retainsAccommodationAtDestination: false,
    });
    expect(result.lodging.ceilingPerNight).toBe(3000);
    expect(result.lodging.maxAmount).toBe(6000);
  });

  it("reports no computable ceiling for E-9 and above (actuals)", () => {
    const result = calculateEntitlement({
      rule: ruleFor("E9"),
      travelStartDate: "2026-01-05",
      travelEndDate: "2026-01-07",
      isSpecifiedLocation: true,
      stayType: "HOTEL_OR_GUEST_HOUSE",
      retainsAccommodationAtDestination: false,
    });
    expect(result.lodging.ceilingPerNight).toBeNull();
    expect(result.lodging.maxAmount).toBeNull();
    // With no lodging ceiling there is no overall computable maximum —
    // it must not silently fall back to the DA figure alone.
    expect(result.maxComputableAdvance).toBeNull();
  });

  it("raises no lodging claim for a same-day tour", () => {
    const result = calculateEntitlement({
      rule: ruleFor("E5"),
      travelStartDate: "2026-01-05",
      travelEndDate: "2026-01-05",
      isSpecifiedLocation: true,
      stayType: "HOTEL_OR_GUEST_HOUSE",
      retainsAccommodationAtDestination: false,
    });
    expect(result.lodging.nights).toBe(0);
    expect(result.lodging.maxAmount).toBe(0);
  });
});

describe("§7.2B — DA rate depends on the stay type", () => {
  it("uses the hotel/guest-house column for a hotel stay", () => {
    const result = calculateEntitlement({
      rule: ruleFor("E5"),
      travelStartDate: "2026-01-05",
      travelEndDate: "2026-01-06",
      isSpecifiedLocation: false,
      stayType: "HOTEL_OR_GUEST_HOUSE",
      retainsAccommodationAtDestination: false,
    });
    expect(result.da.ratePerDay).toBe(750); // E-4 to E-6
  });

  it("uses the higher own-arrangement column for own arrangement", () => {
    const result = calculateEntitlement({
      rule: ruleFor("E5"),
      travelStartDate: "2026-01-05",
      travelEndDate: "2026-01-06",
      isSpecifiedLocation: false,
      stayType: "OWN_ARRANGEMENT",
      retainsAccommodationAtDestination: false,
    });
    expect(result.da.ratePerDay).toBe(1100);
  });
});

describe("§7.2C(9) — retention of accommodation at the touring location", () => {
  it("halves DA against the own-arrangement rate and bars lodging", () => {
    const result = calculateEntitlement({
      rule: ruleFor("E5"),
      travelStartDate: "2026-01-05",
      travelEndDate: "2026-01-07",
      isSpecifiedLocation: true,
      stayType: "HOTEL_OR_GUEST_HOUSE",
      retainsAccommodationAtDestination: true,
    });
    // 50% of the own-arrangement rate (1100), not of the hotel rate.
    expect(result.da.ratePerDay).toBe(550);
    expect(result.da.retentionHalvingApplied).toBe(true);
    expect(result.lodging.maxAmount).toBe(0);
    expect(result.lodging.applicable).toBe(false);
  });
});

describe("§7.2C(12) — halt beyond 14 days", () => {
  it("advises that full DA beyond 14 days needs Director/CE approval", () => {
    const result = calculateEntitlement({
      rule: ruleFor("E5"),
      travelStartDate: "2026-01-01",
      travelEndDate: "2026-01-20", // 19 nights
      isSpecifiedLocation: false,
      stayType: "HOTEL_OR_GUEST_HOUSE",
      retainsAccommodationAtDestination: false,
    });
    expect(result.advisories.some((a) => a.includes("Director/CE"))).toBe(true);
  });

  it("stays silent for a halt within 14 days", () => {
    const result = calculateEntitlement({
      rule: ruleFor("E5"),
      travelStartDate: "2026-01-01",
      travelEndDate: "2026-01-10",
      isSpecifiedLocation: false,
      stayType: "HOTEL_OR_GUEST_HOUSE",
      retainsAccommodationAtDestination: false,
    });
    expect(result.advisories.some((a) => a.includes("Director/CE"))).toBe(false);
  });
});

describe("§6 — journey fare is never given a monetary ceiling", () => {
  it("reports fare as actuals by entitled class and excludes it from the maximum", () => {
    const result = calculateEntitlement({
      rule: ruleFor("E5"),
      travelStartDate: "2026-01-05",
      travelEndDate: "2026-01-06",
      isSpecifiedLocation: false,
      stayType: "HOTEL_OR_GUEST_HOUSE",
      retainsAccommodationAtDestination: false,
    });
    // 1 night at 3000 + full DA 750 (24h exactly) = 3750, fare excluded.
    expect(result.maxComputableAdvance).toBe(3750);
    expect(result.fare.note).toContain("actuals");
    expect(result.fare.railEntitlement).toBe("1AC/EC");
  });
});

describe("input validation", () => {
  it("rejects an end date before the start date", () => {
    expect(() =>
      calculateEntitlement({
        rule: ruleFor("E5"),
        travelStartDate: "2026-01-07",
        travelEndDate: "2026-01-05",
        isSpecifiedLocation: false,
        stayType: "HOTEL_OR_GUEST_HOUSE",
        retainsAccommodationAtDestination: false,
      })
    ).toThrow(RangeError);
  });
});
