import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldCheck, Route } from "lucide-react";
import { api } from "../api/client.js";
import { TourRequestRecord } from "../types.js";
import { Card } from "../components/ui/card.js";
import { Skeleton } from "../components/ui/skeleton.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { StatusChip } from "../components/shared/status-chip.js";
import { DistanceMatrix } from "../components/shared/distance-matrix.js";

// HR Admin — SSoT §25: exact powers/overrides are TBD. Read-only cross-
// request monitoring only, per Phase1 plan's honest-scope decision.
type AdminTab = "tours" | "distances";

export function AdminPage() {
  const [tours, setTours] = useState<TourRequestRecord[] | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<AdminTab>("tours");

  useEffect(() => {
    api.get<TourRequestRecord[]>("/admin/tours").then(setTours);
  }, []);

  const filtered = tours?.filter(
    (t) =>
      !search ||
      t.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      t.destCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-steel-800">
            <ShieldCheck className="h-5 w-5 text-sail-500" />
            HR Admin
          </h1>
          <p className="mt-1 text-sm text-steel-500">
            {tab === "tours"
              ? "Cross-request monitoring across the organization."
              : "Reference data behind the 500 km entitlement condition."}
          </p>
        </div>
        {tab === "tours" && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-400" />
            <input
              placeholder="Search request no. / employee / destination…"
              className="rounded-lg border border-steel-200 py-1.5 pl-8 pr-3 text-xs focus:border-sail-500 focus:outline-none focus:ring-1 focus:ring-sail-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {([
          { key: "tours", label: "All Tours", icon: ShieldCheck },
          { key: "distances", label: "Distance Matrix", icon: Route },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.key
                ? "bg-sail-500 text-white"
                : "border border-steel-200 bg-white text-steel-600 hover:bg-steel-50"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "distances" && (
        <div className="mt-4">
          <DistanceMatrix />
        </div>
      )}

      <Card className={`mt-4 overflow-hidden ${tab === "tours" ? "" : "hidden"}`}>
        {tours === null ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No tour requests found" subtitle="Try a different search term." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-steel-100 bg-steel-50/50 text-xs uppercase tracking-wide text-steel-400">
              <tr>
                <th className="px-4 py-3">Request No.</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((t) => (
                <tr key={t.requestId} className="border-b border-steel-50 transition-colors last:border-0 hover:bg-steel-50">
                  <td className="px-4 py-3">
                    <Link to={`/tours/${t.requestId}`} className="font-mono text-sail-600 hover:underline">
                      {t.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{t.employeeName}</td>
                  <td className="px-4 py-3">{t.destCode}</td>
                  <td className="px-4 py-3"><StatusChip status={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
