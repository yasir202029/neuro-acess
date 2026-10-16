/**
 * QueueDetailDrawer — detail drawer for a Flowgrid queue item.
 */

import { useState } from "react";
import { X, ArrowRight, Loader2 } from "lucide-react";
import { ApexButton } from "../apex-ui/ApexButton";
import { ApexCard } from "../apex-ui/ApexCard";
import { StatusBadge } from "./StatusBadge";
import { workstationApi, type WorkQueueItem, type WorkQueueAction } from "@/lib/clinical-api";

interface QueueDetailDrawerProps {
  item: WorkQueueItem;
  onClose: () => void;
  onRefresh: () => void;
}

export function QueueDetailDrawer({ item, onClose, onRefresh }: QueueDetailDrawerProps) {
  const [isExecuting, setIsExecuting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const executeAction = async (action: WorkQueueAction) => {
    setIsExecuting(action.id);
    setError(null);
    setSuccess(null);
    try {
      await workstationApi.performQueueAction(item.id, action.id);
      setSuccess(`Action "${action.label}" completed`);
      setIsExecuting(null);
      onRefresh();
    } catch (err: any) {
      setIsExecuting(null);
      setError(err?.message ?? "Action failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true" aria-label="Queue item details">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-[hsl(var(--card))] shadow-2xl flex flex-col border-l border-[hsl(var(--border))]">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-[hsl(var(--foreground))]">Flowgrid Item</h3>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Queue item detail drawer</p>
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-[hsl(var(--secondary))]/[.1] text-[hsl(var(--muted-foreground))]">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[80dvh]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--secondary))]/[.1] text-[hsl(var(--secondary-foreground))] flex items-center justify-center text-sm font-bold">
                {item.displayName.charAt(0)}
              </div>
              <div>
                <p className="font-semibold text-[hsl(var(--foreground))]">{item.displayName}</p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Patient ID: {item.patientId}</p>
              </div>
            </div>
            <ApexCard className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))] mb-3">Workflow</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Workflow stage</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">{item.workflowStage}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Current status</span>
                  <StatusBadge status={item.status} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Task type</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">{item.taskType}</span>
                </div>
              </div>
            </ApexCard>
            <ApexCard className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))] mb-3">Owner & Timing</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Owner</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">{item.ownerDisplayName ?? "Unassigned"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Priority</span>
                  <span className="font-medium text-[hsl(var(--foreground))] capitalize">{item.priority}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Created</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">Due</span>
                  <span className="font-medium text-[hsl(var(--foreground))]">{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "—"}</span>
                </div>
              </div>
            </ApexCard>
            {item.blockingReason && (
              <ApexCard className="p-4 border-[hsl(var(--apex-amber-warning))]/[.2]">
                <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[hsl(var(--apex-amber-warning))] mb-2">Blocking Reason</p>
                <p className="text-sm text-[hsl(var(--foreground))]">{item.blockingReason}</p>
              </ApexCard>
            )}
            <div className="pt-4 border-t border-[hsl(var(--border))]">
              <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))] mb-3">Actions</p>
              <div className="space-y-2">
                {item.nextPermittedActions.length === 0 ? (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">No actions available for this item in its current state.</p>
                ) : (
                  item.nextPermittedActions.map((action: WorkQueueAction) => (
                    <div key={action.id}>
                      <button
                        onClick={() => executeAction(action)}
                        disabled={isExecuting === action.id || error !== null}
                        className={`w-full py-2.5 px-4 text-left rounded-md border text-sm font-medium transition-all ${isExecuting === action.id ? "bg-[hsl(var(--secondary))]/[.1] text-[hsl(var(--muted-foreground))] cursor-not-allowed" : "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]/[.1] border-[hsl(var(--border))]"}`}
                      >
                        {isExecuting === action.id ? (
                          <Loader2 size={14} className="mr-2 animate-spin" />
                        ) : (
                          <ArrowRight size={14} className="mr-2" />
                        )}
                        {action.label}
                        {action.requiresConfirmation && (
                          <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">requires confirmation</span>
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            {error && (
              <div className="mt-4 p-3 rounded-md bg-[hsl(var(--destructive))]/[.1] border border-[hsl(var(--destructive))]/[.2]">
                <p className="text-xs text-[hsl(var(--destructive-foreground))] font-medium">{error}</p>
              </div>
            )}
            {success && (
              <div className="mt-4 p-3 rounded-md bg-[hsl(var(--apex-success-green))]/[.1] border border-[hsl(var(--apex-success-green))]/[.2]">
                <p className="text-xs text-[hsl(var(--apex-success-green))] font-medium">{success}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
