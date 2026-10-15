/**
 * Care Plan — goal-oriented care items with status tracking.
 */

import { useState } from "react";
import { ClipboardList, CheckCircle2, Clock, Plus } from "lucide-react";
import { useCreateCarePlanItem } from "@/hooks/use-clinical-workstation";

export function CarePlan({ patientId }: { patientId: string }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("MEDICATION");
  const [priority, setPriority] = useState("ROUTINE");
  const createItem = useCreateCarePlanItem(patientId);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createItem.mutate({
      title: title.trim(),
      description: "",
      category: category as any,
      priority: priority as any,
      targetDate: null,
      ownerRole: "CLINICIAN",
    });
    setTitle("");
    setPriority("ROUTINE");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Care plan</p>
          <h3 className="text-lg font-semibold">Goals and actions</h3>
        </div>
        <ClipboardList className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="col-span-3 sm:col-span-2">
            <input
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              placeholder="Care-plan item (e.g. Titration review)…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <select value={category} onChange={(e) => setCategory(e.target.value as any)} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]">
            <option value="MEDICATION">Medication</option>
            <option value="THERAPY">Therapy</option>
            <option value="MONITORING">Monitoring</option>
            <option value="LIFESTYLE">Lifestyle</option>
            <option value="REFERRAL">Referral</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]">
            <option value="ROUTINE">Routine</option>
            <option value="URGENT">Urgent</option>
          </select>
          <button type="submit" disabled={createItem.isPending || !title.trim()} className="rounded-xl border px-5 py-2.5 text-sm font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/[.9] disabled:opacity-50">
            <Plus size={15} className="mr-1.5" /> Add
          </button>
          {createItem.isPending && <Clock className="ml-2 h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />}
        </form>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
        <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">Care-plan items created via API appear here.</p>
        <div className="rounded-lg border border-[hsl(var(--border))]/[.5] bg-[hsl(var(--background))]/[.4] p-3 text-[12px] text-[hsl(var(--muted-foreground))]">
          <CheckCircle2 size={14} className="mr-1.5" /> Sample: Titration review — MEDICATION · URGENT · ACTIVE
        </div>
      </div>
    </div>
  );
}
