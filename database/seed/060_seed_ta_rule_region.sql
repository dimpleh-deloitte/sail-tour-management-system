-- =============================================================================
-- SAIL Tour Management System — TA rule region seed data
-- SSoT §15.2: E-1/E-2 executives travelling to/from J&K or North-East region
-- are entitled to Economy/equivalent air travel irrespective of distance.
-- SSoT §25: the authoritative region/destination mapping source is TBD.
-- This seeds ONLY the region definition, not a destination mapping — do not
-- infer which DESTINATION_MASTER rows belong to J&K/North-East from name
-- text. Populate ta_rule_region_destination via the HR Admin function once
-- the authoritative mapping is confirmed.
-- =============================================================================

INSERT INTO ta_rule_region (region_code, region_name, description) VALUES
  ('JK_NE_EXCEPTION', 'J&K / North-East Region',
   'Destinations qualifying for the SSoT S15.2 air-eligibility distance exception. '
   'Mapping intentionally left empty pending confirmation of the authoritative source (TBD).');

COMMIT;
