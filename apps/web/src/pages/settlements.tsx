// Bill Settlement worklist — the entry point for §11 obligations.
//
// Settlement used to be reachable only from an individual tour's detail
// page, and only once that tour had passed through three separate status
// transitions. That made a one-month statutory deadline effectively
// invisible: §11 makes the advance recoverable if the bill is late, so the
// employee has to be able to find the obligation without going looking for
// it. This page is that entry point.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, Receipt, Stamp } from "lucide-react";
import { api } from "../api/client.js";
import { Card, CardBody, CardHeader } from "../components/ui/card.js";
import { Skeleton } from "../components/ui/skeleton.js";
import { EmptyState } from "../components/ui/empty-state.js";
import { StatusChip } from "../components/shared/status-chip.js";
import { SettlementWorklist, SettlementWorklistRow } from "../types.js";

function rupees(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function SettlementsPage() {
  const [data, setData] = useState<SettlementWorklist | null>(null);

  const load = useCallback(async () => {
    setData(await api.get<SettlementWorklist>("/settlements/worklist"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const nothingAtAll =
    data.awaitingSubmission.length === 0 &&
    data.awaitingApproval.length === 0 &&
    data.awaitingMyDecision.length === 0 &&
    data.settled.length === 0;

  const overdueCount = data.awaitingSubmission.filter((r) => r.overdue).length;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-steel-800">
          <Receipt className="h-5 w-5 text-sail-500" />
          Bill Settlement
        </h1>
        <p className="mt-1 text-sm text-steel-500">
          Bills must be submitted within one month of completing the journey. A late bill makes the
          advance recoverable.
        </p>
      </div>

      {overdueCount > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              {overdueCount} bill{overdueCount === 1 ? " is" : "s are"} past the due date
            </p>
            <p className="mt-0.5 text-xs">The advance drawn on these tours is recoverable until they are settled.</p>
          </div>
        </div>
      )}

      {nothingAtAll && (
        <Card>
          <CardBody>
            <EmptyState
              icon={Receipt}
              title="Nothing to settle"
              subtitle="A tour appears here once you mark it complete. Settlement opens after the journey has started and ended."
            />
          </CardBody>
        </Card>
      )}

      <Section
        title="Action required — submit your bill"
        subtitle="These tours are complete and awaiting your claim."
        rows={data.awaitingSubmission}
        tone="action"
        showCountdown
      />

      <Section
        title="Awaiting approval"
        subtitle="Your submitted bills, with the Approving Authority."
        rows={data.awaitingApproval}
        tone="waiting"
      />

      <Section
        title="Awaiting your decision"
        subtitle="Settlements submitted to you as Approving Authority."
        rows={data.awaitingMyDecision}
        tone="approve"
      />

      <Section title="Settled" subtitle="Closed settlements." rows={data.settled} tone="done" />
    </div>
  );
}

function Section({
  title,
  subtitle,
  rows,
  tone,
  showCountdown,
}: {
  title: string;
  subtitle: string;
  rows: SettlementWorklistRow[];
  tone: "action" | "waiting" | "approve" | "done";
  showCountdown?: boolean;
}) {
  // An empty section is noise — only the overall empty state is worth showing.
  if (rows.length === 0) return null;

  const Icon = tone === "action" ? Receipt : tone === "approve" ? Stamp : tone === "done" ? CheckCircle2 : Clock;

  return (
    <Card>
      <CardHeader title={`${title} (${rows.length})`} subtitle={subtitle} />
      <CardBody className="space-y-2">
        {rows.map((r) => (
          <Link
            key={r.requestId}
            to={`/tours/${r.requestId}/settlement`}
            className="flex items-start justify-between gap-4 rounded-xl border border-steel-200 px-3 py-2.5 transition-colors hover:border-sail-500 hover:bg-sail-50"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 shrink-0 text-sail-600" />
                <span className="font-mono text-sm font-semibold text-steel-800">{r.requestNumber}</span>
                {tone === "approve" && <span className="text-xs text-steel-500">· {r.employeeName}</span>}
              </div>
              <p className="mt-0.5 text-[11px] text-steel-500">
                {r.destCode} · {r.travelStartDate} — {r.travelEndDate}
              </p>
              <p className="mt-1 text-[11px] text-steel-500">
                Advance drawn {rupees(r.advanceDrawn)}
                {r.totalClaimed !== null && <> · Claimed {rupees(r.totalClaimed)}</>}
                {r.netPayable !== null && (
                  <>
                    {" "}
                    ·{" "}
                    <span className={r.netPayable < 0 ? "text-red-700" : "text-emerald-700"}>
                      {r.netPayable < 0 ? "Recoverable" : "Payable"} {rupees(Math.abs(r.netPayable))}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <StatusChip status={r.status} />
              {showCountdown && (
                <p
                  className={`mt-1 text-[11px] font-medium ${
                    r.overdue
                      ? "text-red-700"
                      : (r.daysRemaining ?? 99) <= 7
                        ? "text-amber-700"
                        : "text-steel-500"
                  }`}
                >
                  {r.overdue
                    ? `Overdue since ${r.dueDate}`
                    : r.daysRemaining === 0
                      ? "Due today"
                      : `${r.daysRemaining} day${r.daysRemaining === 1 ? "" : "s"} left`}
                </p>
              )}
            </div>
          </Link>
        ))}
      </CardBody>
    </Card>
  );
}
