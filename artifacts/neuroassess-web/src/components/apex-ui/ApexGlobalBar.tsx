/**
 * ApexGlobalBar — top global bar for the clinical workstation.
 *
 * Contains:
 *   - NeuroCare Apex identity
 *   - Current workspace selector
 *   - Apex Command search (⌘K)
 *   - Active patient context badge
 *   - Task indicator
 *   - Notification indicator
 *   - Service status (ServicePulse)
 *   - User profile menu / secure logout
 */

import { useState } from 'react';
import {
  User,
  Search,
  Bell,
  ShieldAlert,
  Activity,
  Menu,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { GlobalSearchCommand } from '@/components/workstation/global-search-command';

export function ApexGlobalBar() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activePatient, setActivePatient] = useState<string | null>(null);

  return (
    <div className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
      {/* Left: Identity + workspace + search */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-[hsl(var(--primary))]" />
          <div>
            <p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">
              NeuroCare Apex
            </p>
            <h2 className="text-sm font-semibold">Clinical OS</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]">
            <option>Clinician Workstation</option>
            <option>Operations Tower</option>
            <option>Prescribing Bay</option>
            <option>Control Plane</option>
          </select>
        </div>
        <GlobalSearchCommand />
      </div>

      {/* Center: Active patient context */}
      <div className="flex items-center gap-3">
        {activePatient ? (
          <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5">
            <User className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <div>
              <p className="text-[10px] font-semibold text-[hsl(var(--foreground))]">{activePatient}</p>
              <p className="text-[9px] text-[hsl(var(--muted-foreground))]">Active patient</p>
            </div>
            <button
              onClick={() => setActivePatient(null)}
              className="p-1 rounded hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setActivePatient('Maya Thompson')}
            className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-l2))] px-3 py-1.5 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]/[.4]"
          >
            <User className="h-4 w-4" />
            <span>Select patient</span>
          </button>
        )}
      </div>

      {/* Right: Task indicator, notifications, service status, user menu */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--secondary))]">
          <Activity className="h-4 w-4 text-[hsl(var(--secondary-foreground))] animate-pulse" />
          <span className="text-[10px] font-semibold text-[hsl(var(--secondary-foreground))]">3 tasks</span>
        </div>
        <button
          className="relative p-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))]/[.4]"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[hsl(var(--destructive))]"></span>
        </button>
        <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5">
          <Activity className="h-4 w-4 text-[hsl(var(--muted-foreground))] animate-pulse" />
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">All systems operational</span>
        </div>
        <div className="relative group">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-1.5 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]/[.4]"
          >
            <User className="h-4 w-4" />
            <span>Dr. Sarah Chen</span>
            <ChevronDown size={14} className="text-[hsl(var(--muted-foreground))]" />
          </button>
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-[0_20px_50px_-5px_rgba(0,0,0,0.25)] py-2">
              <button className="flex w-full items-center gap-3 px-3 py-2 text-sm text-left text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]">
                <User className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                Profile
              </button>
              <button
                onClick={() => setUserMenuOpen(false)}
                className="flex w-full items-center gap-3 px-3 py-2 text-sm text-left text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/[.1]"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
