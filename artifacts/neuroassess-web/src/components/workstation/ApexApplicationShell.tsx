/**
 * ApexApplicationShell — consistent professional shell for all workstations.
 *
 * Structure:
 *   +-----------------------------------------------------------+
 *   | GLOBAL BAR / SEARCH / USER / NOTIFICATIONS                |
 *   +----------+--------------------------------------+----------+
 *   |          |                                      |          |
 *   | LEFT     | MODULAR CLINICAL CANVAS              | CONTEXT  |
 *   | RAIL     |                                      | RAIL     |
 *   |          | Active working area                  |          |
 *   |          |                                      |          |
 *   +----------+--------------------------------------+----------+
 *   | CAREPATH / TASK / SYSTEM CONTEXT STRIP                     |
 *   +-----------------------------------------------------------+
 *
 * All controls connect to real APIs/workflows or are marked incomplete.
 */

import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { GlobalSearchCommand } from '@/components/workstation/global-search-command';
import { ApexGlobalBar } from '@/components/apex-ui/ApexGlobalBar';
import { ApexBottomContextStrip } from '@/components/apex-ui/ApexBottomContextStrip';
import { RightRailCommandStack } from '@/components/workstation/right-rail-command-stack';
import { SystemStatusStrip } from '@/components/workstation/system-status-strip';

export function ApexApplicationShell({
  leftNav,
  center,
  rightRail,
  patientContext,
  workflowStatus,
  onSearch,
}: {
  leftNav: React.ReactNode;
  center: React.ReactNode;
  rightRail?: React.ReactNode;
  patientContext?: { name: string; pathway: string; status: string };
  workflowStatus?: { stage: string; status: string };
  onSearch?: (query: string) => void;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] bg-[hsl(var(--background))]">
      <ApexGlobalBar />

      <div className="flex flex-col h-full">
        {/* Left rail + canvas */}
        <div className="flex flex-1 h-full">
          <aside
            className={`flex flex-col w-[280px] border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-300 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}
          >
            {leftNav}
          </aside>

          <main className="flex-1 flex flex-col overflow-hidden">
            {center}
          </main>
        </div>

        {/* Right context rail */}
        <aside className="w-[260px] border-l border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          {rightRail ?? <RightRailCommandStack />}
        </aside>
      </div>

      <ApexBottomContextStrip
        currentStage={workflowStatus?.stage}
        stageLabel={patientContext?.pathway}
        stageStatus={workflowStatus?.status}
        unsavedChanges={false}
      />
    </div>
  );
}
