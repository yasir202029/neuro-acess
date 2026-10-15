/**
 * WorkstationMetric — metric card for patient summary dashboard.
 */

export function WorkstationMetric({ label, value, sub, accent }: { label: string; value: string | number; sub: string; accent: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${
      accent ? "bg-[hsl(var(--destructive))]/[.1] border-[hsl(var(--destructive))]/[.3]" : "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
    }`}>
    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</p>
    <p className="mt-1 text-lg font-semibold">{value}</p>
    <p className="mt-[1px] text-[10px] text-[hsl(var(--muted-foreground))]">{sub}</p>
  </div>
)
}
