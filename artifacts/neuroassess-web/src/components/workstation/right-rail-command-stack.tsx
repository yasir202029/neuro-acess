/**
 * RightRailCommandStack — right rail of the clinician workstation.
 *
 * Contextual command stack: Next Action, Outstanding Tasks, Alerts,
 * Workflow Status, Quick Actions, Recent Activity.
 */

import { Clock3, ClipboardList, AlertTriangle, ChevronRight, MessageCircle, Bell } from "lucide-react";
import { RailCard } from "./rail-card";
import { SystemStatusStrip } from "./system-status-strip";

const RIGHT_RAIL_SECTIONS: Array<{ id: string; label: string; icon: any; incomplete?: boolean }> = [
  { id: "nextaction", label: "Next Action", icon: Clock3, incomplete: true },
  { id: "tasks", label: "Outstanding Tasks", icon: ClipboardList, incomplete: true },
  { id: "alerts", label: "Alerts", icon: AlertTriangle },
  { id: "workflow", label: "Workflow Status", icon: ClipboardList, incomplete: true },
  { id: "quickactions", label: "Quick Actions", icon: ChevronRight, incomplete: true },
  { id: "activity", label: "Recent Activity", icon: MessageCircle, incomplete: true },
];

export function RightRailCommandStack() {
  return (
    <aside className="w-[280px] border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] flex flex-col">
      <div className="border-b border-[hsl(var(--border))] px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="mono text-[9px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Command Stack</p>
            <h2 className="text-sm font-semibold tracking-[-.02em]">Context</h2>
          </div>
        </div>
      </div>
      <div className="overflow-y-auto px-3">
        {RIGHT_RAIL_SECTIONS.map((section) => (
          <div key={section.id} className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-[.1em]">{section.label}</h3>
              {section.incomplete && (
                <span className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1 py-0 text-[8px] font-bold text-[hsl(var(--muted-foreground))]">
                  Incomplete
                </span>
              )}
            </div>
            <RailCard label="No data available" sub="Backend endpoint not yet connected" incomplete={section.incomplete} />
          </div>
        ))}
      </div>
      <SystemStatusStrip />
    </aside>
  );
}
