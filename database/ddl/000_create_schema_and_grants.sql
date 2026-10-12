-- =============================================================================
-- SAIL Tour Management System — Application schema bootstrap
-- Target: Oracle Database, managed via ORDS SQL Developer / SQLcl
-- =============================================================================
-- IMPORTANT
--   * Do NOT modify Fusion HCM core tables (PER_*, HR_*, FND_*, HZ_*).
--   * This creates a dedicated, least-privilege application schema.
--   * Employee master data is READ from Fusion HCM via the Node.js HCM
--     integration module — never written to from this schema.
--   * Replace the password below before running in any real environment.
--     Do not commit real passwords; this file is a template.
-- =============================================================================

CREATE USER sail_tour_app IDENTIFIED BY "__CHANGE_ME__"
  DEFAULT TABLESPACE USERS
  TEMPORARY TABLESPACE TEMP
  QUOTA UNLIMITED ON USERS;

GRANT CREATE SESSION   TO sail_tour_app;
GRANT CREATE TABLE     TO sail_tour_app;
GRANT CREATE VIEW      TO sail_tour_app;
GRANT CREATE SEQUENCE  TO sail_tour_app;
GRANT CREATE PROCEDURE TO sail_tour_app;
GRANT CREATE TRIGGER   TO sail_tour_app;

-- Optional, only if Fusion HCM views/tables are reachable from the same PDB
-- and a DBA approves read-only cross-schema grants for the specific views
-- the Node.js HCM module needs (exact views are TBD — see SSoT §25):
-- GRANT SELECT ON per_all_people_f        TO sail_tour_app;
-- GRANT SELECT ON per_all_assignments_m   TO sail_tour_app;

-- Run the remaining DDL/seed scripts connected AS sail_tour_app, e.g.:
-- ALTER SESSION SET CURRENT_SCHEMA = sail_tour_app;
