// HQ -> destination distance maintenance (client requirement 7).
//
// These figures decide the §6(c) 500km threshold, which in turn decides
// E-1/E-2 air entitlement and whether a request needs special approval. They
// are therefore maintained reference data with a recorded source, not a
// free-text field on the request — and the matrix ships empty rather than
// guessing, so the coverage gap is visible here instead of silently
// producing wrong entitlement decisions.
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus, Route } from "lucide-react";
import { api, ApiClientError } from "../../api/client.js";
import { Card, CardBody, CardHeader } from "../ui/card.js";
import { Button } from "../ui/button.js";
import { Skeleton } from "../ui/skeleton.js";
import { DistanceMatrix as DistanceMatrixData } from "../../types.js";

const inputClass =
  "w-full rounded-lg border border-steel-200 px-3 py-2 text-sm focus:border-sail-500 focus:outline-none focus:ring-1 focus:ring-sail-500";

interface Lov {
  code: string;
  label: string;
}

export function DistanceMatrix() {
  const [data, setData] = useState<DistanceMatrixData | null>(null);
  const [headquarters, setHeadquarters] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<Lov[]>([]);
  const [banner, setBanner] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ headquarter: "", destCode: "", distanceKm: "", sourceRef: "" });

  const load = useCallback(async () => {
    setData(await api.get<DistanceMatrixData>("/admin/distances"));
  }, []);

  useEffect(() => {
    load();
    api.get<string[]>("/headquarters").then(setHeadquarters);
    api.get<Lov[]>("/destinations").then(setDestinations);
  }, [load]);

  async function save() {
    setBusy(true);
    setBanner(null);
    try {
      await api.put<{ updated: number }>("/admin/distances", {
        rows: [
          {
            headquarter: form.headquarter,
            destCode: form.destCode,
            distanceKm: Number(form.distanceKm),
            sourceRef: form.sourceRef,
          },
        ],
      });
      setForm((f) => ({ ...f, destCode: "", distanceKm: "" }));
      setBanner({ kind: "success", text: "Distance recorded." });
      await load();
    } catch (err) {
      setBanner({
        kind: "error",
        text: err instanceof ApiClientError ? err.message : "The distance could not be saved.",
      });
    } finally {
      setBusy(false);
    }
  }

  const destName = (code: string) => destinations.find((d) => d.code === code)?.label ?? code;

  const canSave =
    form.headquarter && form.destCode && Number(form.distanceKm) > 0 && form.sourceRef.trim().length > 0;

  return (
    <div className="space-y-4">
      {banner && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            banner.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {banner.text}
        </div>
      )}

      {data && data.coverage.recorded === 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">No distances recorded</p>
            <p className="mt-0.5 text-xs leading-snug">
              Until a headquarters/destination pair is recorded here, the 500 km condition cannot be verified
              automatically. Those requests are routed to special approval rather than being passed or failed
              silently — so the system stays usable, but every long-distance request needs a manual decision.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader
          title="Record a distance"
          subtitle="One-way distance in kilometres from the originating station."
        />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-steel-600">
              Headquarters
              <select
                className={`${inputClass} mt-1`}
                value={form.headquarter}
                onChange={(e) => setForm((f) => ({ ...f, headquarter: e.target.value }))}
              >
                <option value="">Select…</option>
                {headquarters.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-steel-600">
              Destination
              <select
                className={`${inputClass} mt-1`}
                value={form.destCode}
                onChange={(e) => setForm((f) => ({ ...f, destCode: e.target.value }))}
              >
                <option value="">Select…</option>
                {destinations.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-steel-600">
              One-way distance (km)
              <input
                type="number"
                min={1}
                className={`${inputClass} mt-1`}
                value={form.distanceKm}
                onChange={(e) => setForm((f) => ({ ...f, distanceKm: e.target.value }))}
              />
            </label>

            <label className="block text-xs font-medium text-steel-600">
              Source
              <input
                className={`${inputClass} mt-1`}
                placeholder="e.g. Indian Railways timetable 2026"
                value={form.sourceRef}
                onChange={(e) => setForm((f) => ({ ...f, sourceRef: e.target.value }))}
              />
              <span className="mt-1 block text-[11px] text-steel-400">
                Recorded so an approver can see where a figure came from.
              </span>
            </label>
          </div>

          <div className="mt-3">
            <Button disabled={busy || !canSave} onClick={save}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Save distance
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Recorded distances"
          subtitle={
            data
              ? `${data.coverage.recorded} of up to ${data.coverage.possiblePairs.toLocaleString("en-IN")} possible pairs (${data.coverage.headquarters} headquarters × ${data.coverage.activeDestinations} active destinations).`
              : undefined
          }
        />
        <CardBody>
          {!data ? (
            <Skeleton className="h-16 w-full" />
          ) : data.rows.length === 0 ? (
            <div className="py-8 text-center">
              <Route className="mx-auto h-6 w-6 text-steel-300" />
              <p className="mt-2 text-sm text-steel-500">No distances recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-steel-200 text-[11px] uppercase tracking-wide text-steel-400">
                  <tr>
                    <th className="pb-2 font-medium">Headquarters</th>
                    <th className="pb-2 font-medium">Destination</th>
                    <th className="pb-2 text-right font-medium">Distance</th>
                    <th className="pb-2 pl-4 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={`${r.headquarter}|${r.destCode}`} className="border-b border-steel-50 last:border-0">
                      <td className="py-2">{r.headquarter}</td>
                      <td className="py-2">{destName(r.destCode)}</td>
                      <td className="py-2 text-right tabular-nums">
                        {r.distanceKm.toLocaleString("en-IN")} km
                        {r.distanceKm > 500 && (
                          <span className="ml-1.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            &gt;500
                          </span>
                        )}
                      </td>
                      <td className="py-2 pl-4 text-xs text-steel-500">{r.sourceRef}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
