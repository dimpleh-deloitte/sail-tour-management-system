// Audit logging — SSoT §22. Kept intentionally simple (in-memory) but
// structured exactly like the AUDIT_LOG table so a real repository swap is
// mechanical. Never logs secrets, tokens, or file contents (SSoT §18).
import { randomUUID } from "node:crypto";

export interface AuditEntry {
  auditId: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  actorPersonNumber: string | null;
  actorRole: string | null;
  eventAt: string;
  detail: Record<string, unknown> | null;
  correlationId: string | null;
}

const auditLog: AuditEntry[] = [];

export function recordAudit(entry: Omit<AuditEntry, "auditId" | "eventAt">) {
  auditLog.push({ ...entry, auditId: randomUUID(), eventAt: new Date().toISOString() });
}

export function listAudit(): AuditEntry[] {
  return [...auditLog].reverse();
}
