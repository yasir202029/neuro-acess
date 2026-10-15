/**
 * RailCard — right rail card for command stack sections.
 */

export function RailCard({ label, sub, incomplete }: { label: string; sub: string; incomplete?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-[11px] ${
      incomplete ? "border-[hsl(var(--border))] bg-[hsl(var(--background))]" : "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
    }`}>
    <p className="font-semibold text-[hsl(var(--foreground))]">{label}</p>
    <p className="mt-[1px] text-[hsl(var(--muted-foreground))]">{sub}</p>
    {incomplete && (
      <div className="mt-2 flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--warning))]" />
        <span className="text-[9px] text-[hsl(var(--warning))] font-semibold">Development pending</span>
      </div>
    )}
  </div>
)
}
