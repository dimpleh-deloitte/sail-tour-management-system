// Mirrors /database/seed/070_seed_ta_rule_master.sql exactly — keep in sync.
// See that file's header comment for why this is modeled at individual-grade
// granularity rather than the source PDF's row groupings.
import { TaRule } from "../types.js";

const EFFECTIVE_FROM = "2021-12-17";
const SOURCE_REF = "PER/RULES/4001 (eff. 17-Dec-2021)";

interface Row {
  gradeCode: string;
  gradeLabel: string;
  rail: string;
  water: string;
  air: TaRule["airEntitlement"];
  minDist: number | null;
  regionFlag: "Y" | "N";
  road: number | null;
  daHotel: number;
  daOwn: number;
  lodgeSpec: number | null;
  lodgeOther: number | null;
  discretionary: "Y" | "N";
}

const ROWS: Row[] = [
  { gradeCode: "S1_LT5YR", gradeLabel: "S-1 (less than 5 years of service)", rail: "3AC", water: "Middle class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 4.0, daHotel: 450, daOwn: 650, lodgeSpec: 1200, lodgeOther: 1000, discretionary: "N" },
  { gradeCode: "S1_GE5YR", gradeLabel: "S-1 (5 years of service or more)", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 5.0, daHotel: 450, daOwn: 650, lodgeSpec: 1200, lodgeOther: 1000, discretionary: "N" },
  { gradeCode: "S2_LT5YR", gradeLabel: "S-2 (less than 5 years of service)", rail: "3AC", water: "Middle class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 4.0, daHotel: 450, daOwn: 650, lodgeSpec: 1200, lodgeOther: 1000, discretionary: "N" },
  { gradeCode: "S2_GE5YR", gradeLabel: "S-2 (5 years of service or more)", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 5.0, daHotel: 450, daOwn: 650, lodgeSpec: 1200, lodgeOther: 1000, discretionary: "N" },
  { gradeCode: "S3", gradeLabel: "S-3", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 5.0, daHotel: 450, daOwn: 650, lodgeSpec: 1200, lodgeOther: 1000, discretionary: "N" },
  { gradeCode: "S4", gradeLabel: "S-4", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 5.0, daHotel: 450, daOwn: 650, lodgeSpec: 1200, lodgeOther: 1000, discretionary: "N" },
  { gradeCode: "S5", gradeLabel: "S-5", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 5.0, daHotel: 450, daOwn: 650, lodgeSpec: 1200, lodgeOther: 1000, discretionary: "N" },
  { gradeCode: "S6", gradeLabel: "S-6", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 5.0, daHotel: 450, daOwn: 650, lodgeSpec: 1200, lodgeOther: 1000, discretionary: "N" },
  { gradeCode: "S7", gradeLabel: "S-7", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 5.0, daHotel: 500, daOwn: 700, lodgeSpec: 1600, lodgeOther: 1400, discretionary: "N" },
  { gradeCode: "S8", gradeLabel: "S-8", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 5.0, daHotel: 500, daOwn: 700, lodgeSpec: 1600, lodgeOther: 1400, discretionary: "N" },
  { gradeCode: "S9", gradeLabel: "S-9", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 5.0, daHotel: 500, daOwn: 700, lodgeSpec: 1600, lodgeOther: 1400, discretionary: "N" },
  { gradeCode: "S10", gradeLabel: "S-10", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 9.0, daHotel: 500, daOwn: 700, lodgeSpec: 1600, lodgeOther: 1400, discretionary: "N" },
  { gradeCode: "S11", gradeLabel: "S-11", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 9.0, daHotel: 500, daOwn: 700, lodgeSpec: 1600, lodgeOther: 1400, discretionary: "N" },
  { gradeCode: "E0", gradeLabel: "E-0", rail: "2AC/CC", water: "Highest class", air: "NOT_ENTITLED", minDist: null, regionFlag: "N", road: 10.5, daHotel: 600, daOwn: 900, lodgeSpec: 2500, lodgeOther: 2100, discretionary: "N" },
  { gradeCode: "E1", gradeLabel: "E-1", rail: "2AC/CC", water: "Highest class", air: "ECONOMY_OR_EQUIVALENT", minDist: 500, regionFlag: "Y", road: 10.5, daHotel: 600, daOwn: 900, lodgeSpec: 2500, lodgeOther: 2100, discretionary: "N" },
  { gradeCode: "E2", gradeLabel: "E-2", rail: "2AC/CC", water: "Highest class", air: "ECONOMY_OR_EQUIVALENT", minDist: 500, regionFlag: "Y", road: 10.5, daHotel: 600, daOwn: 900, lodgeSpec: 2500, lodgeOther: 2100, discretionary: "N" },
  { gradeCode: "E3", gradeLabel: "E-3", rail: "2AC/CC", water: "Highest class", air: "ECONOMY_OR_EQUIVALENT", minDist: null, regionFlag: "N", road: 10.5, daHotel: 600, daOwn: 900, lodgeSpec: 2500, lodgeOther: 2100, discretionary: "N" },
  { gradeCode: "E4", gradeLabel: "E-4", rail: "1AC/EC", water: "Highest class", air: "ECONOMY_OR_EQUIVALENT", minDist: null, regionFlag: "N", road: 12.0, daHotel: 750, daOwn: 1100, lodgeSpec: 3500, lodgeOther: 3000, discretionary: "N" },
  { gradeCode: "E5", gradeLabel: "E-5", rail: "1AC/EC", water: "Highest class", air: "ECONOMY_OR_EQUIVALENT", minDist: null, regionFlag: "N", road: 12.0, daHotel: 750, daOwn: 1100, lodgeSpec: 3500, lodgeOther: 3000, discretionary: "N" },
  { gradeCode: "E6", gradeLabel: "E-6", rail: "1AC/EC", water: "Highest class", air: "ECONOMY_OR_EQUIVALENT", minDist: null, regionFlag: "N", road: 14.0, daHotel: 750, daOwn: 1100, lodgeSpec: 3500, lodgeOther: 3000, discretionary: "N" },
  { gradeCode: "E7", gradeLabel: "E-7", rail: "1AC/EC", water: "Highest class", air: "ECONOMY_OR_EQUIVALENT", minDist: null, regionFlag: "N", road: 14.0, daHotel: 900, daOwn: 1300, lodgeSpec: 4500, lodgeOther: 3500, discretionary: "Y" },
  { gradeCode: "E8", gradeLabel: "E-8", rail: "1AC/EC", water: "Highest class", air: "PREMIUM_ECONOMY_OR_ECONOMY", minDist: null, regionFlag: "N", road: 14.0, daHotel: 900, daOwn: 1300, lodgeSpec: 4500, lodgeOther: 3500, discretionary: "Y" },
  { gradeCode: "E9", gradeLabel: "E-9", rail: "1AC/EC", water: "Highest class", air: "PREMIUM_ECONOMY_OR_ECONOMY", minDist: null, regionFlag: "N", road: 14.0, daHotel: 1000, daOwn: 1500, lodgeSpec: null, lodgeOther: null, discretionary: "Y" },
  { gradeCode: "CHAIRMAN_DIRECTOR", gradeLabel: "Chairman/Director", rail: "1AC/EC", water: "Highest class", air: "EXECUTIVE_CLASS", minDist: null, regionFlag: "N", road: null, daHotel: 1100, daOwn: 1600, lodgeSpec: null, lodgeOther: null, discretionary: "Y" },
];

export const TA_RULES: TaRule[] = ROWS.map((r, i) => ({
  ruleId: i + 1,
  gradeCode: r.gradeCode,
  gradeLabel: r.gradeLabel,
  railEntitlement: r.rail,
  waterwayEntitlement: r.water,
  airEntitlement: r.air,
  airMinDistanceKm: r.minDist,
  airRegionExceptionFlag: r.regionFlag,
  roadMileageRate: r.road,
  daHotelRate: r.daHotel,
  daOwnArrangementRate: r.daOwn,
  lodgingCeilingSpecified: r.lodgeSpec,
  lodgingCeilingOther: r.lodgeOther,
  discretionaryModeFlag: r.discretionary,
  effectiveFrom: EFFECTIVE_FROM,
  effectiveTo: null,
  ruleVersion: 1,
  sourceRef: SOURCE_REF,
}));
