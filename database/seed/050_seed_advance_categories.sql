-- =============================================================================
-- SAIL Tour Management System — Advance category seed data
-- SSoT §11 originally confirmed only "Air Fare" and "Rail" as examples; the
-- client's current-system screenshot (Add Tour → Advance Details, Sep 2026
-- conversation) confirms a fixed four-row list in this exact order — Road
-- and DA are added on that later, more specific confirmation. This table
-- remains the configuration seam an HR Admin function can extend later
-- without a code change.
-- =============================================================================

INSERT INTO advance_category (category_code, category_name, sort_order) VALUES
  ('AIR_FARE', 'Air Fare', 10);
INSERT INTO advance_category (category_code, category_name, sort_order) VALUES
  ('RAIL', 'Rail', 20);
INSERT INTO advance_category (category_code, category_name, sort_order) VALUES
  ('ROAD', 'Road', 30);
INSERT INTO advance_category (category_code, category_name, sort_order) VALUES
  ('DA', 'DA', 40);

COMMIT;
