/**
 * System Status Strip — operational status for workstation status displays.
 *
 * Shows aggregated service status without exposing sensitive infrastructure
 * internals. Accessible to authenticated clinical and admin roles.
 *
 * Colour states: NORMAL (operational), ACTIVE (operational), WAITING (standby),
 * WARNING (degraded), CRITICAL (maintenance), COMPLETED (operational).
 */

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { workstationApi, type SystemServiceStatus } from "@/lib/clinical-api";

const STATUS_COLOURS: Record<string, string> = {
  operational: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
  standby: "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
  degraded: "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]",
  maintenance: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
};

export function SystemStatusStrip() {
  const [status, setStatus] = useState<SystemServiceStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    workstationApi
      .getSystemStatus()
      .then((data) => {
        if (!cancelled) {
          setStatus(data.services);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Status unavailable — backend unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchStatus = async () => {
    setRefreshing(true);
    try {
      const data = await workstationApi.getSystemStatus();
      setStatus(data.services);
      setError(null);
    } catch (e: any) {
      setError("Status unavailable — backend unreachable");
    } finally {
      setRefreshing(false);
    }
  };

  if (!status && !error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-[11px] border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        <span className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
          <span className="h-2 w-2 rounded-full bg-[hsl(var(--muted))] animate-pulse" />
          System status
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
      <span className="flex items-center gap-1 text-[10px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-[.12em]">
        System status
      </span>
      {status?.map((service) => (
        <span
          key={service.name}
          className="flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[10px] font-semibold transition-colors"
        >
          <span
            className={`h-3 w-3 rounded-full transition-colors ${STATUS_COLOURS[service.status]}`}
          />
          <span>{service.name}</span>
        </span>
      ))}
      {error && (
        <span className="flex items-center gap-1 px-2 py-1 rounded-xl border border-[hsl(var(--destructive))]/[.3] bg-[hsl(var(--destructive))]/[.1] text-[10px] text-[hsl(var(--destructive))]">
          <span className="h-3 w-3 rounded-full bg-[hsl(var(--destructive))]" />
          {error}
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); fetchStatus(); }}
        disabled={refreshing}
        className="ml-1 p-1 rounded border border-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors disabled:opacity-50"
        title="Refresh status"
      >
        <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
      </button>
    </div>
  );
}
