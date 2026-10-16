/**
 * AdminOperationalQueues — centre operational queues for the Admin Workstation.
 *
 * Live operational queue architecture:
 *   UI → AdminOperationalQueues → typed API client → authenticated Express route
 *   → RBAC/permission check → workflow/query service → Drizzle/PostgreSQL
 *   → real queue items.
 *
 * No hard-coded patient names, queue counts, statuses, owners, or next actions.
 * All data comes from the authorised backend.
 */

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Menu, Loader2 } from "lucide-react";
import { ApexButton } from "../apex-ui/ApexButton";
import { ApexCard } from "../apex-ui/ApexCard";
import { StatusBadge } from "./StatusBadge";
import { QueueDetailDrawer } from "./QueueDetailDrawer";
import {
  workstationApi,
  type WorkQueueItem,
  type WorkQueueFilterView,
  type WorkQueueBucket,
} from "@/lib/clinical-api";

const FILTER_OPTIONS: Array<{ id: WorkQueueFilterView; label: string }> = [
  { id: "ALL", label: "All Queues" },
  { id: "MINE", label: "My Queues" },
  { id: "UNASSIGNED", label: "Unassigned" },
  { id: "DUE_TODAY", label: "Due Today" },
  { id: "OVERDUE", label: "Overdue" },
  { id: "BLOCKED", label: "Blocked" },
  { id: "WAITING_FOR_PATIENT", label: "Waiting for Patient" },
  { id: "WAITING_FOR_CLINICIAN", label: "Waiting for Clinician" },
  { id: "WAITING_FOR_ADMIN", label: "Waiting for Admin" },
];

export function AdminOperationalQueues() {
  const [buckets, setBuckets] = useState<WorkQueueBucket[]>([]);
  const [items, setItems] = useState<WorkQueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [view, setView] = useState<"buckets" | "items">("buckets");
  const [filterView, setFilterView] = useState<WorkQueueFilterView>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<WorkQueueItem | null>(null);
  const [bucketId, setBucketId] = useState<string | undefined>(undefined);

  const loadSummary = useCallback(async () => {
    try {
      setError(null);
      const data = await workstationApi.getQueueSummary();
      setBuckets(data.buckets);
    } catch (err: any) {
      setError(err?.message ?? "Operational queues could not be loaded.");
    }
  }, []);

  const loadItems = useCallback(async () => {
    try {
      setError(null);
      const data = await workstationApi.getQueueItems({
        bucketId,
        filterView,
        search: search || undefined,
        page,
        pageSize,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err: any) {
      setError(err?.message ?? "Operational queues could not be loaded.");
    }
  }, [bucketId, filterView, search, page, pageSize]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadSummary(), loadItems()]).finally(() => setLoading(false));
  }, [loadSummary, loadItems]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
          <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
            <Loader2 size={14} className="animate-spin" />
            Loading operational work…
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[hsl(var(--destructive))]/[.2] bg-[hsl(var(--destructive))]/[.1] p-6">
          <p className="text-sm text-[hsl(var(--destructive-foreground))] font-medium">{error}</p>
        </div>
      </div>
    );
  }

  const bucketTitle = bucketId ? buckets.find((b) => b.id === bucketId)?.title ?? "Queue Items" : "Queue Items";

  const renderBuckets = () => (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="mono text-[9px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Flowgrid</p>
          <h2 className="text-lg font-semibold tracking-[-.03em]">Operational Queues</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search patients, tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/[.3]"
          />
          <ApexButton variant="secondary" onClick={() => { setFilterView("ALL"); setBucketId(undefined); loadItems(); }}>
            <RefreshCw size={14} className="mr-2" /> Refresh
          </ApexButton>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {buckets.map((bucket) => (
          <div
            key={bucket.id}
            className="p-3 cursor-pointer hover:border-[hsl(var(--primary))]/[.3] transition-colors"
            onClick={() => {
              setBucketId(bucket.id);
              setView("items");
              setPage(1);
            }}
          >
            <ApexCard className="p-4">
              <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-[.1em] mb-1">
                {bucket.title}
              </p>
              <p className="text-2xl font-bold text-[hsl(var(--foreground))]">{bucket.count}</p>
            </ApexCard>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-4 border-t border-[hsl(var(--border))]">
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Filter:</p>
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFilterView(f.id);
              setBucketId(undefined);
              setView("items");
              setPage(1);
            }}
            className={`rounded-md border px-3 py-1.5 text-[10px] font-medium transition-all ${filterView === f.id ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]" : "bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/[.1]"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderItems = () => (
    <div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => { setView("buckets"); setBucketId(undefined); }}
          className="flex items-center gap-2 text-[11px] font-medium text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]/[.8]"
        >
          <Menu size={14} /> Back to queues
        </button>
        <div>
          <h2 className="text-lg font-semibold tracking-[-.03em]">{bucketTitle}</h2>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{total} item{total !== 1 ? "s" : ""}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center">
          <p className="text-[hsl(var(--muted-foreground))] font-medium">No items currently require action.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/[.3]">
                <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">Who</th>
                <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">Work Item</th>
                <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">Stage</th>
                <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">Status</th>
                <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">Owner</th>
                <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">Due</th>
                <th className="px-4 py-2 text-left text-[hsl(var(--muted-foreground))] font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-[hsl(var(--secondary))]/[.3] transition-colors cursor-pointer group"
                  onClick={() => setSelectedItem(item)}
                >
                  <td className="px-4 py-2 text-[hsl(var(--foreground))] font-medium">{item.displayName}</td>
                  <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{item.taskType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</td>
                  <td className="px-4 py-2 text-[hsl(var(--muted-foreground))] font-medium">{item.workflowStage}</td>
                  <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{item.ownerDisplayName ?? "Unassigned"}</td>
                  <td className="px-4 py-2 text-[hsl(var(--muted-foreground))] font-medium">{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2 text-[hsl(var(--muted-foreground))]">{item.nextPermittedActions.length > 0 ? item.nextPermittedActions[0].label : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > pageSize && (
        <div className="flex items-center justify-between pt-4 border-t border-[hsl(var(--border))]">
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Showing {items.length} of {total}</p>
          <div className="flex items-center gap-2">
            <ApexButton variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</ApexButton>
            <ApexButton variant="secondary" disabled={page * pageSize >= total} onClick={() => setPage(page + 1)}>Next</ApexButton>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {view === "buckets" ? renderBuckets() : null}
      {view === "items" ? renderItems() : null}
      {selectedItem && (
        <QueueDetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} onRefresh={loadItems} />
      )}
    </div>
  );
}
