/**
 * AdminLeftNav — left navigation for the Admin Workstation.
 */

import { useState } from "react";
import { Menu } from "lucide-react";

const LEFT_NAV_ITEMS: Array<{ id: string; label: string; icon: any; href: string; incomplete?: boolean }> = [
  { id: "dashboard", label: "Dashboard", icon: Menu, href: "/admin" },
  { id: "referrals", label: "Referrals", icon: Menu, href: "#", incomplete: true },
  { id: "patients", label: "Patients", icon: Menu, href: "#", incomplete: true },
  { id: "clinicians", label: "Clinicians", icon: Menu, href: "#", incomplete: true },
  { id: "appointments", label: "Appointments", icon: Menu, href: "#", incomplete: true },
  { id: "assessment-queue", label: "Assessment Queue", icon: Menu, href: "#", incomplete: true },
  { id: "titration-queue", label: "Titration Queue", icon: Menu, href: "#", incomplete: true },
  { id: "prescription-admin", label: "Prescription Admin", icon: Menu, href: "#", incomplete: true },
  { id: "documents", label: "Documents", icon: Menu, href: "#", incomplete: true },
  { id: "reports", label: "Reports", icon: Menu, href: "#", incomplete: true },
  { id: "messages", label: "Messages", icon: Menu, href: "#", incomplete: true },
  { id: "tasks", label: "Tasks", icon: Menu, href: "#", incomplete: true },
  { id: "invoices", label: "Invoices", icon: Menu, href: "#", incomplete: true },
  { id: "payments", label: "Payments", icon: Menu, href: "#", incomplete: true },
  { id: "complaints", label: "Complaints/Feedback", icon: Menu, href: "#", incomplete: true },
  { id: "teams", label: "Teams", icon: Menu, href: "#", incomplete: true },
  { id: "notifications", label: "Notifications", icon: Menu, href: "#", incomplete: true },
  { id: "operations", label: "Operations", icon: Menu, href: "#", incomplete: true },
];

export function AdminLeftNav({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <aside
      className={`flex flex-col w-[280px] border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-300 ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Menu className="h-5 w-5 text-[hsl(var(--muted-foreground))] md:hidden cursor-pointer" onClick={onToggleSidebar} />
          <div>
            <p className="mono text-[9px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Admin Workstation</p>
            <h2 className="text-sm font-semibold tracking-[-.02em]">Operational Command</h2>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        <div className="space-y-0.5">
          {LEFT_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${
                "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]/[.4]"
              }`}
            >
              <item.icon size={16} className="text-[hsl(var(--muted-foreground))]" />
              <span className="flex-1 text-[12px]">{item.label}</span>
              {item.incomplete && (
                <span className="rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-1 py-0 text-[8px] font-bold text-[hsl(var(--muted-foreground))]">
                  Incomplete
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
