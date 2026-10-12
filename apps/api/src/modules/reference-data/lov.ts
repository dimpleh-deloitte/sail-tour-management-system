// Confirmed LOVs from the SSoT — exact values, verbatim. Do not add to these
// lists without a confirmed source (SSoT §25: "other dropdown LOVs not yet
// supplied" is explicitly TBD).

// SSoT §6 — Head Qtr. confirmed LOV.
export const HEADQUARTERS = [
  "Bokaro",
  "Ranchi",
  "NewDelhi",
  "Kolkata",
  "Kiruburu",
  "Meghathaburu",
  "Gua",
  "Manoharpur",
  "Bhawanathpur",
  "Dhanbad",
  "Chasnalla",
  "Ramnagore",
  "Tasra",
  "Jitpur",
] as const;

// SSoT §7 — Tour Type confirmed LOV.
export const TOUR_TYPES = [
  "Training/Seminar/Conference",
  "Audit/Inspection",
  "Interview",
  "Customer Visit",
  "MTI- Training",
  "Leave Recall",
  "Appearance before Court/Inquiry/Ext Agency",
  "PESB interview(other than sail)",
  "PESB interview(for SAIL)",
  "receiving award",
  "plant exposure",
  "medical",
  "others",
] as const;

// SSoT §8 — Travel Permissions confirmed values.
export const ROAD_TRAVEL_PERMISSIONS = ["No", "Own Vehicle", "Hired Vehicle", "Vehicle Retention"] as const;
export const AIR_TRAVEL_PERMISSIONS = ["No", "Yes"] as const;
// Rail Travel Permission — explicit field added at the client's direction
// (current-system screenshot, Sep 2026 conversation), mirroring Air's
// No/Yes shape. SSoT §8 itself only lists Road and Air; this extends the
// same pattern rather than inventing new values.
export const RAIL_TRAVEL_PERMISSIONS = ["No", "Yes"] as const;

// Advance categories — confirmed by the client's current-system screenshot
// (Add Tour → Advance Details, Sep 2026 conversation): four fixed rows in
// this exact order, not a free-form add/remove list. Originally only
// AIR_FARE/RAIL were confirmed by the SSoT (§11); ROAD/DA are added here on
// that later, more specific confirmation.
export const ADVANCE_CATEGORIES = [
  { code: "AIR_FARE", label: "Air Fare" },
  { code: "RAIL", label: "Rail" },
  { code: "ROAD", label: "Road" },
  { code: "DA", label: "DA" },
] as const;
