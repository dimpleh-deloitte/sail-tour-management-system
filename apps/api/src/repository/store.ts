// In-memory data store used when DATA_MODE=memory (the default for local
// dev/demo without a real Oracle instance). Its shape intentionally mirrors
// the Oracle schema in /database/ddl so that an oracle.ts implementation of
// the same repository interfaces (see repository/interfaces.ts) is a
// mechanical swap, not a rewrite of any calling code.
import { randomUUID } from "node:crypto";
import {
  Delegation,
  Destination,
  TaRule,
  Employee,
  TourRequestRecord,
} from "../types.js";
import { DESTINATIONS } from "./seed-destinations.js";
import { TA_RULES } from "./seed-ta-rules.js";
import { MOCK_EMPLOYEES } from "./seed-employees.js";
import { DISTANCES, DistanceRow } from "./seed-distances.js";
import { isSpecifiedLocation } from "./specified-locations.js";

class InMemoryStore {
  // The §4.5 Specified-Location flag is applied here rather than in
  // seed-destinations.ts, which is generated from the destination master
  // XLSX and marked "do not hand-edit".
  destinations: Destination[] = DESTINATIONS.map((d) => ({
    ...d,
    specifiedLocationFlag: isSpecifiedLocation(d.destCode) ? ("Y" as const) : ("N" as const),
  }));
  taRules: TaRule[] = TA_RULES.map((r) => ({ ...r }));
  employees: Employee[] = MOCK_EMPLOYEES.map((e) => ({ ...e, roles: [...e.roles] }));
  tourRequests: Map<string, TourRequestRecord> = new Map();

  /**
   * Headquarters -> destination one-way distances, keyed `${headquarter}|${destCode}`.
   * Ships empty; see seed-distances.ts for why nothing is guessed.
   */
  distances: Map<string, DistanceRow> = new Map(
    DISTANCES.map((row) => [distanceKey(row.headquarter, row.destCode), row])
  );

  /** Out-of-office delegations (acting authority), newest first. */
  delegations: Delegation[] = [];

  private requestSeq = 1000;

  nextRequestSeq(): number {
    this.requestSeq += 1;
    return this.requestSeq;
  }

  newId(): string {
    return randomUUID();
  }

  /** One-way distance in km, or null when the pair has not been recorded. */
  findDistanceKm(headquarter: string, destCode: string): number | null {
    return this.distances.get(distanceKey(headquarter, destCode))?.distanceKm ?? null;
  }

  upsertDistance(row: DistanceRow): void {
    this.distances.set(distanceKey(row.headquarter, row.destCode), row);
  }
}

export function distanceKey(headquarter: string, destCode: string): string {
  return `${headquarter}|${destCode}`;
}

export const store = new InMemoryStore();
