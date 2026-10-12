// Workflow state machine — SSoT §13. Server-authoritative; the frontend only
// reflects these states, never derives or enforces them.
import { RoleCode, TourStatus } from "../types.js";

export type WorkflowAction =
  | "SUBMIT"
  | "FORWARD"
  | "RECOMMEND"
  | "APPROVE"
  | "REJECT"
  // Post-approval lifecycle (client requirements, Oct 2026).
  | "CANCEL"
  | "ACKNOWLEDGE_JOURNEY_START"
  | "REQUEST_EXTENSION"
  | "APPROVE_EXTENSION"
  | "REJECT_EXTENSION"
  | "COMPLETE_TOUR"
  | "SUBMIT_SETTLEMENT"
  | "APPROVE_SETTLEMENT"
  | "REJECT_SETTLEMENT";

interface Transition {
  from: TourStatus;
  action: WorkflowAction;
  actingRole: RoleCode;
  to: TourStatus;
}

// SSoT §13: Employee submits -> Forwarding Authority -> Recommending Authority
// -> Approving Authority -> Approved. Rejection may occur at any authority
// stage; the resulting user-facing status is always REJECTED (SSoT §13/§14).
// FORWARDED/RECOMMENDED are recorded as the "old status" on the resulting
// TOUR_WORKFLOW_HISTORY row (see modules/workflow/service.ts) even though
// the request's live status moves straight to the next PENDING_* state —
// this keeps the four-stage SSoT description intact while still leaving a
// full audit trail of each stage having been acted on.
const TRANSITIONS: Transition[] = [
  { from: "DRAFT", action: "SUBMIT", actingRole: "EMPLOYEE", to: "PENDING_FORWARDING" },
  { from: "PENDING_FORWARDING", action: "FORWARD", actingRole: "FORWARDING", to: "PENDING_RECOMMENDATION" },
  { from: "PENDING_FORWARDING", action: "REJECT", actingRole: "FORWARDING", to: "REJECTED" },
  { from: "PENDING_RECOMMENDATION", action: "RECOMMEND", actingRole: "RECOMMENDING", to: "PENDING_APPROVAL" },
  { from: "PENDING_RECOMMENDATION", action: "REJECT", actingRole: "RECOMMENDING", to: "REJECTED" },
  { from: "PENDING_APPROVAL", action: "APPROVE", actingRole: "APPROVING", to: "APPROVED" },
  { from: "PENDING_APPROVAL", action: "REJECT", actingRole: "APPROVING", to: "REJECTED" },

  // --- Post-approval lifecycle (client requirements, Oct 2026) ------------
  // The SSoT's workflow ends at APPROVED. Everything below carries the
  // request through the journey and into bill settlement under §11.

  // Journey start. Confirmed with the client: available once the advance is
  // approved, and acknowledged either by the employee or by the Forwarding
  // Authority acting as controlling officer.
  { from: "APPROVED", action: "ACKNOWLEDGE_JOURNEY_START", actingRole: "EMPLOYEE", to: "IN_PROGRESS" },
  { from: "APPROVED", action: "ACKNOWLEDGE_JOURNEY_START", actingRole: "FORWARDING", to: "IN_PROGRESS" },

  // Cancellation. Permitted by the employee at any point before the journey
  // has started; once underway the tour is completed and settled instead.
  { from: "DRAFT", action: "CANCEL", actingRole: "EMPLOYEE", to: "CANCELLED" },
  { from: "PENDING_FORWARDING", action: "CANCEL", actingRole: "EMPLOYEE", to: "CANCELLED" },
  { from: "PENDING_RECOMMENDATION", action: "CANCEL", actingRole: "EMPLOYEE", to: "CANCELLED" },
  { from: "PENDING_APPROVAL", action: "CANCEL", actingRole: "EMPLOYEE", to: "CANCELLED" },
  { from: "APPROVED", action: "CANCEL", actingRole: "EMPLOYEE", to: "CANCELLED" },

  // Extension of an ongoing tour. Confirmed with the client: returns to the
  // Approving Authority only, not the full three-stage chain.
  { from: "IN_PROGRESS", action: "REQUEST_EXTENSION", actingRole: "EMPLOYEE", to: "PENDING_EXTENSION_APPROVAL" },
  { from: "PENDING_EXTENSION_APPROVAL", action: "APPROVE_EXTENSION", actingRole: "APPROVING", to: "IN_PROGRESS" },
  { from: "PENDING_EXTENSION_APPROVAL", action: "REJECT_EXTENSION", actingRole: "APPROVING", to: "IN_PROGRESS" },

  // Completion and settlement (§11).
  { from: "IN_PROGRESS", action: "COMPLETE_TOUR", actingRole: "EMPLOYEE", to: "COMPLETED" },
  { from: "COMPLETED", action: "SUBMIT_SETTLEMENT", actingRole: "EMPLOYEE", to: "PENDING_SETTLEMENT_APPROVAL" },
  { from: "PENDING_SETTLEMENT_APPROVAL", action: "APPROVE_SETTLEMENT", actingRole: "APPROVING", to: "SETTLED" },
  // A rejected settlement returns to COMPLETED so the employee can correct
  // and resubmit, rather than terminating the request.
  { from: "PENDING_SETTLEMENT_APPROVAL", action: "REJECT_SETTLEMENT", actingRole: "APPROVING", to: "COMPLETED" },
];

export class InvalidWorkflowTransitionError extends Error {
  code = "INVALID_WORKFLOW_TRANSITION";
}

export function assertTransition(from: TourStatus, action: WorkflowAction, actingRole: RoleCode): TourStatus {
  const match = TRANSITIONS.find((t) => t.from === from && t.action === action && t.actingRole === actingRole);
  if (!match) {
    throw new InvalidWorkflowTransitionError(
      `Action "${action}" by role "${actingRole}" is not valid from status "${from}".`
    );
  }
  return match.to;
}

export function toWorklistStatus(status: TourStatus): "Pending" | "Approved" | "Rejected" | null {
  // SSoT §14: worklist status filter values are exactly Pending/Approved/Rejected.
  switch (status) {
    case "PENDING_FORWARDING":
    case "PENDING_RECOMMENDATION":
    case "PENDING_APPROVAL":
    // Post-approval stages that are awaiting an authority's decision sit in
    // the same "Pending" bucket, so the SSoT's three filter values still
    // cover every worklist-visible state.
    case "PENDING_EXTENSION_APPROVAL":
    case "PENDING_SETTLEMENT_APPROVAL":
      return "Pending";
    case "APPROVED":
    // Once sanctioned, the request stays "Approved" for filtering purposes
    // as it moves through the journey and settlement.
    case "IN_PROGRESS":
    case "COMPLETED":
    case "SETTLED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return null; // DRAFT / CANCELLED are not worklist-visible states
  }
}

// Which role's worklist a given status currently sits in (used to build the
// Forwarding/Recommendation/Approval worklist queries and to authorize who
// may act on a request right now).
export function pendingRoleForStatus(status: TourStatus): RoleCode | null {
  switch (status) {
    case "PENDING_FORWARDING":
      return "FORWARDING";
    case "PENDING_RECOMMENDATION":
      return "RECOMMENDING";
    case "PENDING_APPROVAL":
    // Extension and settlement decisions both rest with the Approving
    // Authority (confirmed with the client, Oct 2026).
    case "PENDING_EXTENSION_APPROVAL":
    case "PENDING_SETTLEMENT_APPROVAL":
      return "APPROVING";
    default:
      return null;
  }
}
