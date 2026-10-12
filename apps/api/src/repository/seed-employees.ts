// MOCK Fusion HCM employee directory + application-role assignments.
// SSoT §25: exact Fusion HCM endpoints/credentials are TBD. This directory
// exists only so the app is runnable end-to-end in development
// (HCM_USE_MOCK_ADAPTER=true). Swap for a real Fusion HCM client in
// modules/hcm/client.fusion.ts (not yet implemented — see that folder's
// README) without touching any calling code, since callers only depend on
// the HcmClient interface.
import { Employee } from "../types.js";

export const MOCK_EMPLOYEES: Employee[] = [
  {
    personNumber: "A000241",
    staffNo: "A000241",
    scaleCode: "E8",
    name: "NAVEEN KALA",
    department: "C&IT",
    gradeCode: "E8",
    headquarter: "Bokaro",
    roles: ["EMPLOYEE"],
  },
  {
    personNumber: "A000305",
    staffNo: "A000305",
    scaleCode: "E1",
    name: "ANITA VERMA",
    department: "Finance",
    gradeCode: "E1",
    headquarter: "Ranchi",
    roles: ["EMPLOYEE"],
  },
  {
    personNumber: "A000112",
    staffNo: "A000112",
    scaleCode: "E9",
    name: "SUNIL KUMAR SHUKLA",
    department: "C&IT",
    gradeCode: "E9",
    headquarter: "Bokaro",
    roles: ["FORWARDING"],
  },
  {
    personNumber: "A000089",
    staffNo: "A000089",
    scaleCode: "E9",
    name: "MANISH KUMAR SINGH",
    department: "C&IT",
    gradeCode: "E9",
    headquarter: "Bokaro",
    roles: ["RECOMMENDING"],
  },
  {
    personNumber: "A000045",
    staffNo: "A000045",
    scaleCode: "CHAIRMAN_DIRECTOR",
    name: "PREM KISHOR SINGH",
    department: "Management",
    gradeCode: "CHAIRMAN_DIRECTOR",
    headquarter: "Bokaro",
    roles: ["APPROVING"],
  },
  {
    // Alternate authority, added for the acting-authority delegation feature
    // (client requirement 6, Oct 2026). Without a second holder of each
    // authority role there is nobody to delegate to, so the feature could
    // not be exercised in mocked mode at all.
    personNumber: "A000067",
    staffNo: "A000067",
    scaleCode: "E7",
    name: "ANJALI RAMESH",
    department: "Management",
    gradeCode: "E7",
    headquarter: "Bokaro",
    roles: ["FORWARDING", "RECOMMENDING", "APPROVING"],
  },
  {
    personNumber: "A000001",
    staffNo: "A000001",
    scaleCode: "E9",
    name: "HR ADMIN USER",
    department: "HR",
    gradeCode: "E9",
    headquarter: "Bokaro",
    roles: ["HR_ADMIN"],
  },
];
