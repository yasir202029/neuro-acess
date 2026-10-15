/**
 * Vitals Chart — physical health time series with a sparkline-style table.
 */

import type { VitalsObservation } from "@/lib/clinical-api";

export function VitalsChart({ patientId, vitals }: { patientId: string; vitals: VitalsObservation[] | null }) {
  const rows = (vitals ?? []).slice().reverse();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Physical health</p>
          <h3 className="text-lg font-semibold">Vitals trend</h3>
        </div>
        <span className="rounded-full border border-[hsl(var(--border))] px-2 py-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">
          {rows.length} observations
        </span>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] overflow-hidden">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/[.3]">
              <th className="px-4 py-3 text-[hsl(var(--muted-foreground))] font-medium">Date</th>
              <th className="px-4 py-3 text-[hsl(var(--muted-foreground))] font-medium">BP (sys/dia)</th>
              <th className="px-4 py-3 text-[hsl(var(--muted-foreground))] font-medium">HR</th>
              <th className="px-4 py-3 text-[hsl(var(--muted-foreground))] font-medium">Temp</th>
              <th className="px-4 py-3 text-[hsl(var(--muted-foreground))] font-medium">Weight</th>
              <th className="px-4 py-3 text-[hsl(var(--muted-foreground))] font-medium">SpO₂</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {rows.length > 0 ? rows.map((v) => (
              <tr key={v.id} className="hover:bg-[hsl(var(--secondary))]/[.3] transition-colors">
                <td className="px-4 py-3 text-[hsl(var(--foreground))]">{new Date(v.recordedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">{v.systolicBp != null && v.diastolicBp != null ? `${v.systolicBp}/${v.diastolicBp}` : "—"}</td>
                <td className="px-4 py-3">{v.heartRate ?? "—"}</td>
                <td className="px-4 py-3">{v.temperature != null ? v.temperature.toFixed(1) : "—"}</td>
                <td className="px-4 py-3">{v.weightKg != null ? v.weightKg.toFixed(1) : "—"}</td>
                <td className="px-4 py-3">{v.oxygenSaturation ?? "—"}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[hsl(var(--muted-foreground))]">No vitals recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
