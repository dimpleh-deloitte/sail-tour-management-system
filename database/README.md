# Database — Oracle DDL & Seed Scripts

Run in this exact order against the target Oracle Database:

```
ddl/000_create_schema_and_grants.sql   -- as DBA: creates SAIL_TOUR_APP user
ddl/010_masters.sql                    -- as sail_tour_app: master/reference tables
ddl/020_core_tables.sql                -- as sail_tour_app: transactional tables

seed/030_seed_destinations.sql         -- 154 rows, verified against source XLSX
seed/040_seed_application_roles.sql
seed/050_seed_advance_categories.sql   -- only the 2 SSoT-confirmed categories (Air Fare, Rail)
seed/060_seed_ta_rule_region.sql       -- region definition only; mapping left TBD, see file
seed/070_seed_ta_rule_master.sql       -- 24 grade rows from TA Rules-2021 (PER/RULES/4001)

ords/080_enable_ords_reference.sql     -- reference pattern only; real endpoint design is TBD
```

## Design notes

- **Optimistic locking**: `tour_request.version_no` auto-increments via
  `trg_tour_request_biu`. The API's update path must send back the
  `version_no` it read and fail the request (not silently overwrite) if it
  no longer matches — this satisfies SSoT VAL-16.
- **TA_RULE_MASTER granularity**: modeled per exact grade (24 rows), not the
  source PDF's row groupings, because the PDF itself groups grades
  differently for rail/air/road-mileage vs. DA rates vs. lodging ceilings.
  See the comment block at the top of `070_seed_ta_rule_master.sql` for the
  full reasoning and the S-1/S-2 service-length split.
- **Max-3-attachments** is not a table CHECK constraint (Oracle can't count
  sibling rows in a CHECK); it's enforced by the Node.js service layer
  inside the same transaction as the insert, under a row lock on the parent
  `tour_request` to close the race between two concurrent uploads.
- **Everything marked TBD** in the SSoT is either an empty configuration
  table (e.g. `ta_rule_region_destination`), a nullable/placeholder column,
  or documented explicitly in a script comment — nothing has been guessed.
