// Generic worklist screen used for Manage Tour Forwarded / Recommendation
// Worklist / Manage Tour Approval (SSoT §14) — parametrized by role so the
// three near-identical screens share one implementation.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Inbox } from "lucide-react";
import { api } from "../api/client.js";
import { TourRequestRecord } from "../types.js";
import { Card } from "../components/ui/card.js";
import { Skeleton } from "../components/ui/skeleton.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { StatusChip } from "../components/shared/status-chip.js";

type Filter = "Pending" | "Approved" | "Rejected";

export function WorklistPage({ endpoint, title }: { endpoint: "forwarding" | "recommendation" | "approval"; title: string }) {
  const [filter, setFilter] = useState<Filter>("Pending");
  const [rows, setRows] = useState<TourRequestRecord[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setRows(null);
    api.get<TourRequestRecord[]>(`/worklists/${endpoint}?status=${filter}`).then(setRows);
  }, [endpoint, filter]);

  const filtered = rows?.filter(
    (r) =>
      !search ||
      r.requestNumber.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1 className="text-xl font-semibold text-steel-800">{title}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {(["Pending", "Approved", "Rejected"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? "bg-sail-500 text-white shadow-sm shadow-sail-200" : "border border-steel-200 bg-white text-steel-600 hover:bg-steel-50"
            }`}
          >
            {f}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel-400" />
          <input
            placeholder="Search request no. / employee…"
            className="rounded-lg border border-steel-200 py-1.5 pl-8 pr-3 text-xs focus:border-sail-500 focus:outline-none focus:ring-1 focus:ring-sail-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="mt-4 overflow-hidden">
        {rows === null ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : filtered?.length === 0 ? (
          <EmptyState icon={Inbox} title="No requests found" subtitle="Try a different status filter or search term." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-steel-100 bg-steel-50/50 text-xs uppercase tracking-wide text-steel-400">
              <tr>
                <th className="px-4 py-3">Tour Request No.</th>
                <th className="px-4 py-3">Control No.</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered?.map((r) => (
                <tr key={r.requestId} className="border-b border-steel-50 transition-colors last:border-0 hover:bg-steel-50">
                  <td className="px-4 py-3">
                    <Link to={`/tours/${r.requestId}`} className="font-mono text-sail-600 hover:underline">
                      {r.requestNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-steel-500">{r.controlNumber ?? "—"}</td>
                  <td className="px-4 py-3">{r.travelStartDate}</td>
                  <td className="px-4 py-3">{r.travelEndDate}</td>
                  <td className="px-4 py-3">{r.employeeName} <span className="text-xs text-steel-400">({r.staffNo})</span></td>
                  <td className="px-4 py-3"><StatusChip status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
