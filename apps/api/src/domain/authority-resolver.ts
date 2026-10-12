// Authority resolution — SSoT §12/§25: "Determine dynamically from
// organizational/workflow data; never hard-code sample people... exact
// authority-resolution service/API is TBD."
//
// This module is the single seam that decides who the Forwarding /
// Recommending / Approving authority is for a given employee. The mock
// implementation below resolves authorities from the same mock HCM
// directory used for login/demo purposes (by role, not by a hard-coded
// name), which is honest about being a stand-in — swap resolveAuthorities()
// for a real org-hierarchy/workflow-engine call once that source is
// confirmed, without changing any caller in modules/tours or modules/workflow.
import { store } from "../repository/store.js";
import { RoleCode, TourAuthorities } from "../types.js";

function firstEmployeeWithRole(role: RoleCode) {
  const emp = store.employees.find((e) => e.roles.includes(role));
  if (!emp) return null;
  return { personNumber: emp.personNumber, name: emp.name, designation: `${emp.gradeCode} — ${emp.department}` };
}

export function resolveAuthorities(_forEmployeePersonNumber: string): TourAuthorities {
  // _forEmployeePersonNumber is accepted now so the real implementation
  // (org-hierarchy lookup) has the input it will need; the mock ignores it
  // and simply returns whichever mock employees hold each authority role.
  return {
    forwarding: firstEmployeeWithRole("FORWARDING"),
    recommending: firstEmployeeWithRole("RECOMMENDING"),
    approving: firstEmployeeWithRole("APPROVING"),
  };
}
