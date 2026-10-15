/**
 * Medication Manager — active medications, titration status, and care-plan capture.
 */

import { useState } from "react";
import { Pill, Clock, Plus, Stethoscope } from "lucide-react";
import { useWorkstationPatient, type WorkstationPatient } from "@/hooks/use-clinical-workstation";
import { useCreateCarePlanItem } from "@/hooks/use-clinical-workstation";

export function MedicationManager({ patient }: { patient: WorkstationPatient }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("MEDICATION");
  const createCarePlan = useCreateCarePlanItem(patient.id);

  const categories: { value: string; label: string }[] = [
    { value: "MEDICATION", label: "Medication" },
    { value: "THERAPY", label: "Therapy" },
    { value: "MONITORING", label: "Monitoring" },
    { value: "LIFESTYLE", label: "Lifestyle" },
    { value: "REFERRAL", label: "Referral" },
  ];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createCarePlan.mutate({
      title: title.trim(),
      description: "",
      category: category as any,
      priority: "ROUTINE",
      targetDate: null,
      ownerRole: "CLINICIAN",
    });
    setTitle("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Medications</p>
          <h3 className="text-lg font-semibold">Active medication list</h3>
        </div>
        <Stethoscope className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {patient.activeMedications.length > 0 ? (
          patient.activeMedications.map((m) => (
            <MedCard key={m.id} med={m} />
          ))
        ) : (
          <div className="col-span-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 text-center">
            <Pill className="mx-auto mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))/.5]" />
            <p className="text-[12px] text-[hsl(var(--muted-foreground))]">No active medications recorded.</p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 items-end">
          <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2 hidden sm:block">Add to care plan</p>
          <input
            className="flex-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-2.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            placeholder="Care-plan item title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button type="submit" disabled={createCarePlan.isPending} className="rounded-xl border px-5 py-2.5 text-sm font-semibold bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/[.9] disabled:opacity-50">
            <Plus size={15} className="mr-1.5" /> Add item
          </button>
          {createCarePlan.isPending && <Clock className="ml-2 h-4 w-4 animate-spin text-[hsl(var(--muted-foreground))]" />}
        </form>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
        <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">Titration safety</p>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Titrating medications are flagged in the worklist risk strip. Physical health checks
          (weight, BP, ECG) are required before dose changes per shared-care protocol.
        </p>
      </div>
    </div>
  );
}

function MedCard({ med }: { med: { id: string; name: string; dosage: string; frequency: string; startedAt: string; reviewDueAt: string | null; titrationActive: boolean } }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold">{med.name}</span>
        {med.titrationActive && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[hsl(var(--warning))]/[.1] border-[hsl(var(--warning))]/[.3] text-[hsl(var(--warning))]">Titrating</span>}
      </div>
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{med.dosage} · {med.frequency}</p>
      <p className="mt-[1px] text-[10px] text-[hsl(var(--muted-foreground))]">
        Started {new Date(med.startedAt).toLocaleDateString()} · {med.reviewDueAt ? `Review due ${new Date(med.reviewDueAt).toLocaleDateString()}` : "No review due"}
      </p>
    </div>
  );
}
