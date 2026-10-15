/**
 * Admin Workstation — operational command centre for clinic administration.
 *
 * Designed as an operational command centre with:
 *   - Left navigation for all admin functions
 *   - Centre operational queues with WHO, WHAT, STATUS, OWNER, NEXT ACTION
 *   - System status strip for operational visibility
 *
 * Restrained professional colours. Every control connects to a real
 * API/workflow/state or is marked as incomplete.
 */

import { useState } from "react";
import { GlobalSearchCommand } from "./global-search-command";
import { AdminLeftNav } from "./admin-left-nav";
import { AdminOperationalQueues } from "./admin-operational-queues";
import { SystemStatusStrip } from "./system-status-strip";

export function AdminWorkstation() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] bg-[hsl(var(--background))]">
      <GlobalSearchCommand />

      <AdminLeftNav onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="mono text-[9px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Admin Workstation</p>
              <h2 className="text-lg font-semibold tracking-[-.03em]">Operational Queues</h2>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <AdminOperationalQueues />
        </div>
      </main>

      <SystemStatusStrip />
    </div>
  );
}
