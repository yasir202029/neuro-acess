/**
 * RightRailCommandStack — right rail of the clinician workstation.
 *
 * Contextual command stack: Next Action, Outstanding Tasks, Alerts,
 * Workflow Status, Quick Actions, Recent Activity.
 */

import { useWorkQueueSummary, useWorkQueueItems } from "@/hooks/use-clinical-workstation";
import { SystemStatusStrip } from "./system-status-strip";

function useQueueRailData() {
  const summary = useWorkQueueSummary();
  const items = useWorkQueueItems({ pageSize: 25 });
  const buckets = summary.data?.buckets ?? [];
  const countOf = (id: string) => buckets.find((b) => b.id === id)?.count ?? 0;
  const actionable = items.data?.items ?? [];
  const blocked = actionable.filter((i) => i.blockingReason);
  return {
    loading: summary.isLoading || items.isLoading,
    error: summary.isError || items.isError,
    counts: {
      nextAction: countOf("appointment-required") + countOf("clinician-assignment-required"),
      tasks: countOf("new-referrals") + countOf("report-pending"),
      alerts: blocked.length,
      activity: actionable.length,
      total: buckets.reduce((sum, b) => sum + b.count, 0),
    },
    items: actionable,
    blocked,
  };
}

function QueueCard({ label, sub, incomplete }: { label: string; sub: string; incomplete?: boolean }) {
  // Card rendering is shared by empty/loading/error states.
  return (
    <div className={`rounded-lg border p-3 text-[11px] ${
      incomplete ? "border-[hsl(var(--border))] bg-[hsl(var(--background))]" : "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
    }`}>
      <p className="font-semibold text-[hsl(var(--foreground))]">{label}</p>
      <p className="mt-[1px] text-[hsl(var(--muted-foreground))]">{sub}</p>
    </div>
  );
}

function QueueRow({ item }: { item: { id: string; displayName: string; status: string; priority: string } }) {
  const urgent = item.priority === "URGENT" || item.priority === "STAT";
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5 text-[11px]">
      <span className="flex items-center gap-2 truncate">
        <span className={`h-2 w-2 shrink-0 rounded-full ${urgent ? "bg-[hsl(var(--accent))]" : "bg-[hsl(var(--secondary))]"}`} />
        <span className="truncate font-semibold text-[hsl(var(--foreground))]">{item.displayName}</span>
      </span>
      <span className="shrink-0 text-[hsl(var(--muted-foreground))]">{item.status}</span>
    </div>
  );
}

export function RightRailCommandStack() {
  const { loading, error, counts, items, blocked } = useQueueRailData();

  const header = (
    <div className="border-b border-[hsl(var(--border))] px-4 py-3.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="mono text-[9px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Command Stack</p>
          <h2 className="text-sm font-semibold tracking-[-.02em]">Context</h2>
        </div>
        {!loading && !error && (
          <span className="rounded-full bg-[hsl(var(--accent))] px-2 py-0.5 text-[9px] font-bold text-[hsl(var(--accent-foreground))]">
            {counts.total} open
          </span>
        )}
      </div>
    </div>
  );

  const section = (label: string, badge: number | undefined, content: React.ReactNode) => (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-[.1em]">{label}</h3>
        {badge ? (
          <span className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1 py-0 text-[8px] font-bold text-[hsl(var(--muted-foreground))]">
            {badge}
          </span>
        ) : null}
      </div>
      {content}
    </div>
  );

  const emptyOrRows = (emptyLabel: string, emptySub: string, rows: typeof items) => {
    if (error) return <QueueCard label="Queue unavailable" sub="Could not load work queue" incomplete />;
    if (loading) return <QueueCard label="Loading…" sub="Fetching queue data" incomplete />;
    if (rows.length === 0) return <QueueCard label={emptyLabel} sub={emptySub} />;
    return rows.map((item) => (
      <div key={item.id} className="mb-2">
        <QueueRow item={item} />
      </div>
    ));
  };

  return (
    <aside className="flex w-[280px] flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]">
      {header}
      <div className="overflow-y-auto px-3">
        {section(
          "Next Action",
          counts.nextAction,
          <QueueCard
            label={error ? "Queue unavailable" : loading ? "Loading…" : counts.nextAction === 0 ? "Nothing pending" : `${counts.nextAction} action${counts.nextAction === 1 ? "" : "s"} required`}
            sub={error ? "Could not load work queue" : loading ? "Fetching next action" : counts.nextAction === 0 ? "No appointments or assignments required" : "Assign clinician or book appointment"}
            incomplete={!error && !loading && counts.nextAction > 0}
          />,
        )}
        {section(
          "Outstanding Tasks",
          counts.tasks,
          <QueueCard
            label={error ? "Queue unavailable" : loading ? "Loading…" : counts.tasks === 0 ? "No outstanding tasks" : `${counts.tasks} outstanding`}
            sub={error ? "Could not load work queue" : loading ? "Fetching tasks" : counts.tasks === 0 ? "New referrals and reports are clear" : "New referrals + pending reports"}
            incomplete={!error && !loading && counts.tasks > 0}
          />,
        )}
        {section("Alerts", counts.alerts, emptyOrRows("No blocked items", "Nothing is waiting on you", blocked.slice(0, 3)))}
        {section("Recent Activity", counts.activity, emptyOrRows("No recent activity", "Queue is clear", items.slice(0, 5)))}
      </div>
      <SystemStatusStrip />
    </aside>
  );
}
