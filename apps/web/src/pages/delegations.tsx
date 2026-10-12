// Acting-authority delegation (client requirement 6).
//
// Self-service: an authority who will be unavailable nominates an acting
// authority for a date range, and anything pending at their stage during that
// window also appears in the delegate's worklist.
//
// Delegation is additive, never a transfer — the original authority stays on
// the request and can still act. That is enforced server-side; this page just
// says so plainly, because "reassigned" would otherwise imply the work left
// their queue.
import { useCallback, useEffect, useState } from "react";
import { CalendarRange, UserCheck, Users, X } from "lucide-react";
import { api, ApiClientError } from "../api/client.js";
import { useSession } from "../hooks/use-session.js";
import { Card, CardBody, CardHeader } from "../components/ui/card.js";
import { Button } from "../components/ui/button.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { Skeleton } from "../components/ui/skeleton.js";
import { Delegation, Employee, RoleCode } from "../types.js";

const inputClass =
  "w-full rounded-lg border border-steel-200 px-3 py-2 text-sm focus:border-sail-500 focus:outline-none focus:ring-1 focus:ring-sail-500";

const DELEGABLE_ROLES: RoleCode[] = ["FORWARDING", "RECOMMENDING", "APPROVING"];

const ROLE_LABELS: Record<string, string> = {
  FORWARDING: "Forwarding Authority",
  RECOMMENDING: "Recommending Authority",
  APPROVING: "Approving Authority",
};

export function DelegationsPage() {
  const { user } = useSession();
  const [delegations, setDelegations] = useState<Delegation[] | null>(null);
  const [directory, setDirectory] = useState<Employee[]>([]);
  const [banner, setBanner] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const myDelegableRoles = (user?.roles ?? []).filter((r) => DELEGABLE_ROLES.includes(r));

  const [form, setForm] = useState({
    roleCode: "" as string,
    toPersonNumber: "",
    fromDate: "",
    toDate: "",
    reason: "",
  });

  const load = useCallback(async () => {
    setDelegations(await api.get<Delegation[]>("/delegations"));
  }, []);

  useEffect(() => {
    load();
    // The mock directory is the available pool of acting authorities. With a
    // real SSO/HCM provider this would be a proper employee search.
    api
      .get<Employee[]>("/auth/dev-directory")
      .then(setDirectory)
      .catch(() => setDirectory([]));
  }, [load]);

  useEffect(() => {
    if (!form.roleCode && myDelegableRoles.length > 0) {
      setForm((f) => ({ ...f, roleCode: myDelegableRoles[0] }));
    }
  }, [myDelegableRoles, form.roleCode]);

  // Only employees who actually hold the role can act for it — the server
  // enforces this too, but offering an impossible choice would be unkind.
  const eligibleDelegates = directory.filter(
    (e) => e.personNumber !== user?.personNumber && form.roleCode && e.roles.includes(form.roleCode as RoleCode)
  );

  async function create() {
    setBusy(true);
    setBanner(null);
    try {
      await api.post<Delegation>("/delegations", {
        toPersonNumber: form.toPersonNumber,
        roleCode: form.roleCode,
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: form.reason || null,
      });
      setForm((f) => ({ ...f, toPersonNumber: "", fromDate: "", toDate: "", reason: "" }));
      setBanner({ kind: "success", text: "Acting authority nominated." });
      await load();
    } catch (err) {
      setBanner({
        kind: "error",
        text: err instanceof ApiClientError ? err.message : "The delegation could not be created.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(delegationId: string) {
    setBusy(true);
    setBanner(null);
    try {
      await api.post<Delegation>(`/delegations/${delegationId}/revoke`, {});
      setBanner({ kind: "success", text: "Delegation revoked." });
      await load();
    } catch (err) {
      setBanner({
        kind: "error",
        text: err instanceof ApiClientError ? err.message : "The delegation could not be revoked.",
      });
    } finally {
      setBusy(false);
    }
  }

  const given = delegations?.filter((d) => d.fromPersonNumber === user?.personNumber) ?? [];
  const received = delegations?.filter((d) => d.toPersonNumber === user?.personNumber) ?? [];

  const canSubmit = form.roleCode && form.toPersonNumber && form.fromDate && form.toDate;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-steel-800">
          <Users className="h-5 w-5 text-sail-500" />
          Acting Authority
        </h1>
        <p className="mt-1 text-sm text-steel-500">
          Nominate someone to act on your pending approvals while you are unavailable.
        </p>
      </div>

      {banner && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            banner.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {banner.text}
        </div>
      )}

      {myDelegableRoles.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={Users}
              title="You hold no approval role"
              subtitle="Only Forwarding, Recommending and Approving Authorities can delegate."
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Nominate an acting authority"
            subtitle="Requests arriving in this window also reach your delegate. You keep access to them throughout."
          />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-steel-600">
                Role to delegate
                <select
                  className={`${inputClass} mt-1`}
                  value={form.roleCode}
                  onChange={(e) => setForm((f) => ({ ...f, roleCode: e.target.value, toPersonNumber: "" }))}
                >
                  {myDelegableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r] ?? r}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-medium text-steel-600">
                Acting authority
                <select
                  className={`${inputClass} mt-1`}
                  value={form.toPersonNumber}
                  onChange={(e) => setForm((f) => ({ ...f, toPersonNumber: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {eligibleDelegates.map((e) => (
                    <option key={e.personNumber} value={e.personNumber}>
                      {e.name} ({e.personNumber})
                    </option>
                  ))}
                </select>
                {form.roleCode && eligibleDelegates.length === 0 && (
                  <span className="mt-1 block text-[11px] text-amber-700">
                    No other employee holds the {ROLE_LABELS[form.roleCode] ?? form.roleCode} role.
                  </span>
                )}
              </label>

              <label className="block text-xs font-medium text-steel-600">
                From date
                <input
                  type="date"
                  className={`${inputClass} mt-1`}
                  value={form.fromDate}
                  onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))}
                />
              </label>

              <label className="block text-xs font-medium text-steel-600">
                To date
                <input
                  type="date"
                  min={form.fromDate || undefined}
                  className={`${inputClass} mt-1`}
                  value={form.toDate}
                  onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))}
                />
              </label>

              <label className="col-span-full block text-xs font-medium text-steel-600">
                Reason (optional)
                <input
                  className={`${inputClass} mt-1`}
                  placeholder="e.g. On leave"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </label>
            </div>

            <div className="mt-3">
              <Button disabled={busy || !canSubmit} onClick={create}>
                <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                Nominate acting authority
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <DelegationList
        title="Delegations you have given"
        emptyText="You have not nominated anyone."
        rows={given}
        loading={delegations === null}
        onRevoke={revoke}
        busy={busy}
        showRevoke
      />

      <DelegationList
        title="Delegations you have received"
        emptyText="Nobody has nominated you as their acting authority."
        rows={received}
        loading={delegations === null}
        busy={busy}
      />
    </div>
  );
}

function DelegationList({
  title,
  emptyText,
  rows,
  loading,
  onRevoke,
  busy,
  showRevoke,
}: {
  title: string;
  emptyText: string;
  rows: Delegation[];
  loading: boolean;
  onRevoke?: (id: string) => void;
  busy: boolean;
  showRevoke?: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-steel-400">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((d) => {
              const inForce = d.active && !d.revokedAt && d.fromDate <= today && today <= d.toDate;
              return (
                <li
                  key={d.delegationId}
                  className="flex items-start justify-between gap-3 border-b border-steel-50 pb-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-steel-800">
                      <span className="font-medium">{ROLE_LABELS[d.roleCode] ?? d.roleCode}</span>
                      {showRevoke ? ` → ${d.toName}` : ` ← ${d.fromName}`}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-steel-500">
                      <CalendarRange className="h-3 w-3" />
                      {d.fromDate} to {d.toDate}
                      {d.reason && ` · ${d.reason}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        d.revokedAt
                          ? "border-steel-200 bg-steel-50 text-steel-500"
                          : inForce
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-steel-200 bg-steel-50 text-steel-500"
                      }`}
                    >
                      {d.revokedAt ? "Revoked" : inForce ? "In force" : "Scheduled"}
                    </span>
                    {showRevoke && onRevoke && !d.revokedAt && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRevoke(d.delegationId)}
                        className="rounded-lg p-1 text-steel-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Revoke delegation"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
