-- =============================================================================
-- SAIL Tour Management System — ORDS REST enablement (reference pattern)
-- =============================================================================
-- TBD (SSoT §25): exact ORDS endpoints/payloads the enterprise integration
-- requires are not yet confirmed. Do NOT treat this file as the final
-- contract — it is a syntactically-correct REFERENCE for how to expose a
-- table/view through ORDS once the real endpoint design is confirmed,
-- adapted from the legacy prototype's own ORDS-enablement script (which
-- used the same mechanism against a different, superseded schema).
--
-- Run only the modules actually required by the confirmed integration
-- design; enabling more than necessary widens the attack surface.
-- =============================================================================

BEGIN
  ORDS.ENABLE_SCHEMA(
    p_enabled             => TRUE,
    p_schema              => 'SAIL_TOUR_APP',
    p_url_mapping_type     => 'BASE_PATH',
    p_url_mapping_pattern  => 'sail-tour',
    p_auto_rest_auth       => TRUE   -- require authenticated ORDS access; do not disable in production
  );
  COMMIT;
END;
/

-- Example: expose DESTINATION_MASTER read-only for a downstream enterprise
-- consumer that specifically requires an ORDS route rather than the Node.js
-- API (most consumers should use the Node.js /api/v1/destinations route
-- instead — this is only for the confirmed enterprise-integration case).
BEGIN
  ORDS.ENABLE_OBJECT(
    p_enabled        => TRUE,
    p_schema         => 'SAIL_TOUR_APP',
    p_object         => 'DESTINATION_MASTER',
    p_object_type    => 'TABLE',
    p_object_alias   => 'destinations',
    p_auto_rest_auth => TRUE
  );
  COMMIT;
END;
/

-- Do not enable ORDS on TOUR_REQUEST or other transactional tables directly
-- (SSoT §1: "React should not call privileged Oracle/Fusion APIs directly";
-- the same boundary applies to any external ORDS consumer). Transactional
-- access goes through the Node.js API's validated, authorized endpoints.
