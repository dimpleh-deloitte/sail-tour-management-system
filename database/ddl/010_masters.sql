-- =============================================================================
-- SAIL Tour Management System — Master / reference tables
-- Run as sail_tour_app after 000_create_schema_and_grants.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- DESTINATION_MASTER
-- Source: supplied "tour destination codes in SAP" XLSX (154 rows).
-- SSoT §9: LOV display = DESTI_NAME, LOV return = DESTI_CODE.
-- ---------------------------------------------------------------------------
CREATE TABLE destination_master (
  dest_code       VARCHAR2(20)    NOT NULL,
  dest_name       VARCHAR2(150)   NOT NULL,
  active_flag     CHAR(1)         DEFAULT 'Y' NOT NULL,
  effective_from  DATE            DEFAULT SYSDATE NOT NULL,
  effective_to    DATE,
  created_at      TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at      TIMESTAMP,
  CONSTRAINT pk_destination_master PRIMARY KEY (dest_code),
  CONSTRAINT chk_dest_active_flag CHECK (active_flag IN ('Y', 'N')),
  CONSTRAINT chk_dest_effective CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_dest_name ON destination_master (dest_name);
CREATE INDEX idx_dest_active ON destination_master (active_flag);

COMMENT ON TABLE destination_master IS
  'Approved touring destinations. Loaded from the supplied 154-row destination XLSX. Never hard-code destinations in the frontend.';

-- ---------------------------------------------------------------------------
-- APPLICATION_ROLE
-- SSoT §3: Employee/Applicant, Forwarding Authority, Recommending Authority,
-- Approving Authority, HR Admin. A person may hold more than one role.
-- ---------------------------------------------------------------------------
CREATE TABLE application_role (
  role_code     VARCHAR2(30)   NOT NULL,
  role_name     VARCHAR2(120)  NOT NULL,
  description   VARCHAR2(500),
  CONSTRAINT pk_application_role PRIMARY KEY (role_code)
);

-- ---------------------------------------------------------------------------
-- USER_ROLE
-- Role-mapping store used ONLY as a fallback/override when the SSO/HCM
-- identity source does not itself carry application-role claims.
-- SSoT §3/§25: exact role-mapping source is TBD — this table is the
-- configurable seam the AuthorityResolver / role-assignment service reads.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE user_role_seq START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE TABLE user_role (
  user_role_id    NUMBER          NOT NULL,
  person_number   VARCHAR2(30)    NOT NULL,  -- Fusion HCM person_number / SAIL PNo.
  role_code       VARCHAR2(30)    NOT NULL,
  effective_from  DATE            DEFAULT SYSDATE NOT NULL,
  effective_to    DATE,
  created_at      TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_user_role PRIMARY KEY (user_role_id),
  CONSTRAINT fk_user_role_role FOREIGN KEY (role_code) REFERENCES application_role (role_code),
  CONSTRAINT chk_user_role_effective CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_user_role_person ON user_role (person_number);
CREATE UNIQUE INDEX uq_user_role_active
  ON user_role (person_number, role_code, effective_from);

-- ---------------------------------------------------------------------------
-- ADVANCE_CATEGORY
-- SSoT §11: confirmed examples are Air Fare and Rail; full list is TBD.
-- Configurable so the category list can grow without a code change.
-- ---------------------------------------------------------------------------
CREATE TABLE advance_category (
  category_code   VARCHAR2(40)   NOT NULL,
  category_name   VARCHAR2(150)  NOT NULL,
  active_flag     CHAR(1)        DEFAULT 'Y' NOT NULL,
  sort_order      NUMBER(4)      DEFAULT 0 NOT NULL,
  CONSTRAINT pk_advance_category PRIMARY KEY (category_code),
  CONSTRAINT chk_advance_category_active CHECK (active_flag IN ('Y', 'N'))
);

-- ---------------------------------------------------------------------------
-- TA_RULE_REGION / TA_RULE_REGION_DESTINATION
-- SSoT §15.2 & §25: J&K / North-East region exception source is TBD.
-- Modeled as a configurable region-to-destination mapping so the exception
-- can be maintained by admins rather than inferred from free text.
-- ---------------------------------------------------------------------------
CREATE TABLE ta_rule_region (
  region_code   VARCHAR2(30)   NOT NULL,
  region_name   VARCHAR2(150)  NOT NULL,
  description   VARCHAR2(500),
  CONSTRAINT pk_ta_rule_region PRIMARY KEY (region_code)
);

CREATE TABLE ta_rule_region_destination (
  region_code   VARCHAR2(30)  NOT NULL,
  dest_code     VARCHAR2(20)  NOT NULL,
  CONSTRAINT pk_ta_rule_region_dest PRIMARY KEY (region_code, dest_code),
  CONSTRAINT fk_region_dest_region FOREIGN KEY (region_code) REFERENCES ta_rule_region (region_code),
  CONSTRAINT fk_region_dest_dest FOREIGN KEY (dest_code) REFERENCES destination_master (dest_code)
);

COMMENT ON TABLE ta_rule_region_destination IS
  'Configuration seam for the J&K/North-East air-eligibility exception (SSoT S15.2). '
  'Source/authoritative list is TBD; populate/maintain via admin function once confirmed.';

-- ---------------------------------------------------------------------------
-- TA_RULE_MASTER
-- SSoT §15.1/§15.6/§21 and TA Rules PDF §6.0/§7.2 — grade-wise entitlement,
-- effective-dated so future amendments do not require code changes.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE ta_rule_master_seq START WITH 1 INCREMENT BY 1 NOCACHE;

CREATE TABLE ta_rule_master (
  rule_id                     NUMBER          NOT NULL,
  grade_code                  VARCHAR2(30)    NOT NULL,  -- exact individual grade, e.g. S1_LT5YR, S7,
                                                           -- S10, E0, E1, E2, E3, E6, E7, CHAIRMAN_DIRECTOR
                                                           -- (kept at individual-grade granularity because the
                                                           -- source PDF uses three DIFFERENT groupings for
                                                           -- rail/air/road, DA rates, and lodging ceilings)
  grade_label                 VARCHAR2(150)   NOT NULL,
  rail_entitlement            VARCHAR2(60)    NOT NULL,
  waterway_entitlement        VARCHAR2(60)    NOT NULL,
  air_entitlement             VARCHAR2(30)    NOT NULL,  -- NOT_ENTITLED | ECONOMY_OR_EQUIVALENT |
                                                           -- PREMIUM_ECONOMY_OR_ECONOMY | EXECUTIVE_CLASS
  air_min_distance_km         NUMBER(6),                 -- 500 for E-1/E-2; NULL = no distance gate
  air_region_exception_flag   CHAR(1)         DEFAULT 'N' NOT NULL, -- Y = J&K/NE overrides distance gate
  road_mileage_rate           NUMBER(8,2),               -- NULL = "Actual" (e.g. Chairman/Director)
  da_hotel_rate                NUMBER(8,2)    NOT NULL,  -- DA (F&I) when staying Hotel/Guest House
  da_own_arrangement_rate      NUMBER(8,2)    NOT NULL,  -- DA when own-arrangement (self-certified)
  lodging_ceiling_specified    NUMBER(8,2),              -- specified locations, per PDF S7.2A; NULL = Actuals
  lodging_ceiling_other        NUMBER(8,2),              -- other locations, per PDF S7.2A; NULL = Actuals
  discretionary_mode_flag      CHAR(1)        DEFAULT 'N' NOT NULL, -- Y = E-7+ may choose any mode
  effective_from                DATE           NOT NULL,
  effective_to                  DATE,
  rule_version                  NUMBER(6)      DEFAULT 1 NOT NULL,
  source_ref                    VARCHAR2(200)  DEFAULT 'PER/RULES/4001 (eff. 17-Dec-2021)' NOT NULL,
  created_at                    TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
  updated_at                    TIMESTAMP,
  CONSTRAINT pk_ta_rule_master PRIMARY KEY (rule_id),
  CONSTRAINT chk_ta_rule_air_entitlement CHECK (air_entitlement IN
    ('NOT_ENTITLED', 'ECONOMY_OR_EQUIVALENT', 'PREMIUM_ECONOMY_OR_ECONOMY', 'EXECUTIVE_CLASS')),
  CONSTRAINT chk_ta_rule_air_region_flag CHECK (air_region_exception_flag IN ('Y', 'N')),
  CONSTRAINT chk_ta_rule_discretionary CHECK (discretionary_mode_flag IN ('Y', 'N')),
  CONSTRAINT chk_ta_rule_effective CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX idx_ta_rule_grade ON ta_rule_master (grade_code, effective_from);

COMMENT ON TABLE ta_rule_master IS
  'Effective-dated, grade-wise TA/DA entitlement. Every TA rule-engine decision '
  'must be traceable to a row here (rule_id + rule_version). Do not hard-code '
  'these figures anywhere in application code (SSoT S15/S21).';
