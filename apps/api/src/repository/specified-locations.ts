// SAIL TA Rules-2021 §4.5 — "Specified Locations" for the purpose of these
// Rules. These 12 cities carry the higher lodging ceiling in §7.2(A); every
// other destination falls under the "Other Locations" column.
//
// Verbatim from §4.5: "Delhi, Mumbai, Kolkata, Chennai, Hyderabad, Ahmedabad,
// Bangalore, Pune, Kanpur, Nagpur, Lucknow, and Jaipur shall be treated as
// specified locations for the purpose of these Rules and may be amended from
// time to time with the approval of Director (Personnel)."
//
// This lives in its own module rather than being folded into
// seed-destinations.ts because that file is generated from the supplied
// destination master XLSX and is marked "do not hand-edit". Each code below
// was matched by name against that master; all 12 resolved to exactly one
// destination row, so nothing here is inferred.
//
// Two name variants in the destination master differ from the wording in
// §4.5 and are mapped on the city's identity, not a string match:
//   - "Bangalore" (§4.5)  -> BENGALURU              (D000000005)
//   - "Delhi"     (§4.5)  -> NEW DELHI              (D000000039)
// One master row covers a twin-city pair:
//   - "Hyderabad" (§4.5)  -> HYDERABAD / SECUNDERABAD (D000000022)
//
// Amending this list requires Director (Personnel) approval per §4.5; it is
// therefore a code-level constant rather than user-editable reference data.
export const SPECIFIED_LOCATION_DEST_CODES: ReadonlySet<string> = new Set([
  "D000000039", // NEW DELHI              — §4.5 "Delhi"
  "D000000037", // MUMBAI
  "D000000033", // KOLKATA
  "D000000011", // CHENNAI
  "D000000022", // HYDERABAD / SECUNDERABAD
  "D000000002", // AHMEDABAD
  "D000000005", // BENGALURU              — §4.5 "Bangalore"
  "D000000043", // PUNE
  "D000000030", // KANPUR
  "D000000038", // NAGPUR
  "D000000035", // LUCKNOW
  "D000000026", // JAIPUR
]);

export function isSpecifiedLocation(destCode: string): boolean {
  return SPECIFIED_LOCATION_DEST_CODES.has(destCode);
}
