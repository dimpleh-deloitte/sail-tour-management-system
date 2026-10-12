// Acting-authority delegation (client requirement 6, Oct 2026).
//
// An authority who will be unavailable nominates an acting authority for a
// date range; anything pending at their stage during that window also appears
// in the delegate's worklist, and the delegate may act on it.
//
// Design notes
// ------------
// Delegation is additive, never a transfer: the original authority stays on
// the request (record.authorities is untouched) and can still act. This keeps
// the authority-resolution trail intact and means an expired delegation
// silently stops applying rather than orphaning requests. Who actually acted
// is recorded in workflow history either way.
import { store } from "../../repository/store.js";
import { Delegation, Employee, RoleCode } from "../../types.js";
import { ApiError } from "../../middleware/error-handler.js";
import { recordAudit } from "../audit/service.js";

export type DelegableRole = Extract<RoleCode, "FORWARDING" | "RECOMMENDING" | "APPROVING">;

export interface DelegationInput {
  toPersonNumber: string;
  roleCode: DelegableRole;
  fromDate: string;
  toDate: string;
  reason?: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A delegation is in force when it is active, not revoked, and today falls in its window. */
function isInForce(d: Delegation, onDate = todayIso()): boolean {
  return d.active && d.revokedAt === null && d.fromDate <= onDate && onDate <= d.toDate;
}

/**
 * Person numbers whose work `user` may act on for `role` right now — i.e. the
 * authorities who have delegated that role to this user.
 */
export function delegatorsFor(user: Employee, role: DelegableRole, onDate = todayIso()): string[] {
  return store.delegations
    .filter((d) => d.toPersonNumber === user.personNumber && d.roleCode === role && isInForce(d, onDate))
    .map((d) => d.fromPersonNumber);
}

/**
 * True when `user` may act for `assignedPersonNumber` at `role`, either as the
 * assigned authority themselves or as their acting authority.
 */
export function canActFor(
  user: Employee,
  assignedPersonNumber: string | null | undefined,
  role: DelegableRole,
  onDate = todayIso()
): boolean {
  if (!assignedPersonNumber) return false;
  if (assignedPersonNumber === user.personNumber) return true;
  return delegatorsFor(user, role, onDate).includes(assignedPersonNumber);
}

export function listMine(user: Employee): Delegation[] {
  return store.delegations
    .filter((d) => d.fromPersonNumber === user.personNumber || d.toPersonNumber === user.personNumber)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAll(): Delegation[] {
  return [...store.delegations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function create(user: Employee, input: DelegationInput): Delegation {
  if (!user.roles.includes(input.roleCode)) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      `You do not hold the ${input.roleCode} role, so you cannot delegate it.`
    );
  }
  if (input.toPersonNumber === user.personNumber) {
    throw new ApiError(400, "VALIDATION_ERROR", "You cannot delegate to yourself.", {
      toPersonNumber: "Select a different employee.",
    });
  }

  const delegate = store.employees.find((e) => e.personNumber === input.toPersonNumber);
  if (!delegate) {
    throw new ApiError(400, "VALIDATION_ERROR", "The selected acting authority was not found.", {
      toPersonNumber: "Unknown employee.",
    });
  }
  // The acting authority must be able to do the job they are being handed —
  // otherwise requests route to someone the rest of the system will refuse.
  if (!delegate.roles.includes(input.roleCode)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `${delegate.name} does not hold the ${input.roleCode} role and cannot act as your delegate for it.`,
      { toPersonNumber: "This employee does not hold the required role." }
    );
  }

  // Overlapping delegations of the same role would make routing ambiguous.
  const overlapping = store.delegations.find(
    (d) =>
      d.fromPersonNumber === user.personNumber &&
      d.roleCode === input.roleCode &&
      d.active &&
      d.revokedAt === null &&
      d.fromDate <= input.toDate &&
      input.fromDate <= d.toDate
  );
  if (overlapping) {
    throw new ApiError(
      409,
      "DELEGATION_OVERLAP",
      `You already have a ${input.roleCode} delegation to ${overlapping.toName} covering ${overlapping.fromDate} to ${overlapping.toDate}. Revoke it first.`
    );
  }

  const delegation: Delegation = {
    delegationId: store.newId(),
    fromPersonNumber: user.personNumber,
    fromName: user.name,
    toPersonNumber: delegate.personNumber,
    toName: delegate.name,
    roleCode: input.roleCode,
    fromDate: input.fromDate,
    toDate: input.toDate,
    reason: input.reason ?? null,
    active: true,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  };
  store.delegations.push(delegation);

  recordAudit({
    eventType: "DELEGATION_CREATED",
    entityType: "DELEGATION",
    entityId: delegation.delegationId,
    actorPersonNumber: user.personNumber,
    actorRole: input.roleCode,
    detail: {
      to: delegate.personNumber,
      roleCode: input.roleCode,
      fromDate: input.fromDate,
      toDate: input.toDate,
    },
    correlationId: null,
  });

  return delegation;
}

export function revoke(user: Employee, delegationId: string): Delegation {
  const delegation = store.delegations.find((d) => d.delegationId === delegationId);
  if (!delegation) {
    throw new ApiError(404, "NOT_FOUND", "Delegation not found.");
  }
  // The delegator owns it; HR Admin can clear one up on their behalf.
  const isOwner = delegation.fromPersonNumber === user.personNumber;
  if (!isOwner && !user.roles.includes("HR_ADMIN")) {
    throw new ApiError(403, "FORBIDDEN", "Only the delegating authority or an HR Admin may revoke this.");
  }
  if (delegation.revokedAt !== null) {
    throw new ApiError(409, "ALREADY_REVOKED", "This delegation has already been revoked.");
  }

  delegation.active = false;
  delegation.revokedAt = new Date().toISOString();

  recordAudit({
    eventType: "DELEGATION_REVOKED",
    entityType: "DELEGATION",
    entityId: delegationId,
    actorPersonNumber: user.personNumber,
    actorRole: isOwner ? delegation.roleCode : "HR_ADMIN",
    detail: { originalDelegate: delegation.toPersonNumber },
    correlationId: null,
  });

  return delegation;
}
