// Headquarters -> destination one-way road/rail distance matrix.
//
// Why this exists
// ---------------
// §6 note (c) entitles E-1/E-2 executives to air travel only where "the
// one-way distance of touring station from the originating station is more
// than 500Km". The client additionally wants every request beyond 500km
// flagged for a special approval flow (Oct 2026). Both need a distance, and
// distance was previously removed from the Add Tour form — see the comment in
// domain/ta-rule-engine.ts. This matrix reinstates it as *reference data*
// rather than a self-reported field, so the 500km decision is auditable.
//
// Why it ships empty
// ------------------
// The authoritative distances have not been supplied. A wrong value here does
// not produce a visible error — it silently flips an entitlement decision at
// the 500km boundary — so no distance is guessed or derived from city names.
// Until a pair is populated, lookups return null and the rule engine reports
// DISTANCE_NOT_RECORDED, which routes the request to special approval instead
// of quietly passing or quietly failing. This mirrors how the unconfirmed
// J&K/North-East region mapping is handled in ta-rule-engine.ts.
//
// Populate via the HR Admin maintenance endpoint (PUT /admin/distances) or by
// adding confirmed rows below. Distances are one-way, in kilometres, measured
// from the originating station (the employee's headquarters) per §6(c).

export interface DistanceRow {
  /** Matches Employee.headquarter — one of the §6 HEADQUARTERS LOV values. */
  headquarter: string;
  /** Matches Destination.destCode. */
  destCode: string;
  /** One-way distance in kilometres. */
  distanceKm: number;
  /** Provenance, so an approver can see where a figure came from. */
  sourceRef: string;
}

export const DISTANCES: DistanceRow[] = [
  // Intentionally empty — see the header comment. Confirmed rows go here.
];
