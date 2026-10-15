/**
 * MDT Collaboration — multidisciplinary team notes with visibility control.
 */

import { useState } from "react";
import { MessageCircle, UserPlus, Clock } from "lucide-react";
import { useWorkstationPatient, type WorkstationPatient } from "@/hooks/use-clinical-workstation";
import { useCreateMdtNote } from "@/hooks/use-clinical-workstation";

export function MdtCollaboration({ patientId }: { patientId: string }) {
  const { data: patient } = useWorkstationPatient(patientId);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState(true);
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const createMdt = useCreateMdtNote(patientId);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setStatus("saved");
    createMdt.mutate({ body: body.trim(), visibleToTeam: visibility }, {
      onSuccess: () => { setBody(""); setVisibility(true); },
    });
  };

  const p = patient!;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">MDT collaboration</p>
          <h3 className="text-lg font-semibold">Team notes</h3>
        </div>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Visible to the full care team when enabled.</p>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 items-end">
          <textarea
            className="flex-1 min-h-[90px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            placeholder="Multidisciplinary note visible to the care team…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex items-center gap-2 text-[11px]">
            <input id="mdt-visible" type="checkbox" checked={visibility} onChange={(e) => setVisibility(e.target.checked)} className="rounded border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]" />
            <label htmlFor="mdt-visible" className="text-[hsl(var(--muted-foreground))]">Visible to team</label>
          </div>
          <button type="submit" disabled={createMdt.isPending || !body.trim()} className="rounded-xl border px-5 py-2.5 text-sm font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/[.9] disabled:opacity-50">
            <UserPlus size={15} className="mr-1.5" /> Add team note
          </button>
          {status === "saved" && <Clock className="ml-2 h-4 w-4 text-[hsl(var(--success))]" />}
        </form>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
        <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">Team thread</p>
        <div className="space-y-3">
          {(p?.openAlerts ?? []).slice(0, 3).map((a, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-[hsl(var(--secondary))]/[.3] flex items-center justify-center text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
                {i === 0 ? "MT" : i === 1 ? "NP" : "DR"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{["Consultant psychiatrist", "Specialist nurse", "Clinical psychologist"][i] ?? "Team member"}</p>
                <p className="mt-[1px] text-[11px] text-[hsl(var(--muted-foreground))]">{a.detail}</p>
                <p className="mt-[1px] text-[10px] text-[hsl(var(--muted-foreground))]">{new Date(a.raisedAt).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
