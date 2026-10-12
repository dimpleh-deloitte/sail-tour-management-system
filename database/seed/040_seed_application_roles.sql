-- =============================================================================
-- SAIL Tour Management System — Application role seed data
-- SSoT §3: Employee/Applicant, Forwarding Authority, Recommending Authority,
-- Approving Authority, HR Admin.
-- =============================================================================

INSERT INTO application_role (role_code, role_name, description) VALUES
  ('EMPLOYEE', 'Employee / Applicant', 'Creates, edits and submits own tour requests.');
INSERT INTO application_role (role_code, role_name, description) VALUES
  ('FORWARDING', 'Forwarding Authority', 'Reviews and forwards assigned tour requests.');
INSERT INTO application_role (role_code, role_name, description) VALUES
  ('RECOMMENDING', 'Recommending Authority', 'Reviews and recommends assigned tour requests.');
INSERT INTO application_role (role_code, role_name, description) VALUES
  ('APPROVING', 'Approving Authority', 'Approves or rejects assigned tour requests.');
INSERT INTO application_role (role_code, role_name, description) VALUES
  ('HR_ADMIN', 'HR Admin', 'Cross-request monitoring and administrative functions (exact scope TBD per SSoT S3).');

COMMIT;
