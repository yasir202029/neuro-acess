/**
 * PatientRow — single patient entry in the clinician worklist.
 */

import { Clock3, ChevronRight } from "lucide-react";
import type { WorkstationPatient } from "@/hooks/use-clinical-workstation";

const riskColor: Record<string, string> = {
  CRITICAL: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
  HIGH: "bg-[hsl(var(--destructive))]/[.85] text-[hsl(var(--destructive-foreground))]",
  MODERATE: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]",
  LOW: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
  NONE: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
};

export function PatientRow({ patient, active, onSelect }: { patient: WorkstationPatient; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${active ? "bg-[hsl(var(--primary))]/[.1] border-[hsl(var(--primary))]/[.3] text-[hsl(var(--primary))]" : "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/[.4]"}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-semibold truncate text-sm">{patient.displayName}</p>
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${riskColor[patient.riskSeverity]}`}>{patient.riskSeverity}</span>
        </div>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">NHS {patient.nhsNumber} &middot; {patient.pathway}</p>
        {patient.nextAppointmentAt && (
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]"><Clock3 className="mr-1 h-3 w-3" /> {new Date(patient.nextAppointmentAt).toLocaleDateString()}</p>
        )}
      </div>
      <ChevronRight size={12} className="text-[hsl(var(--muted-foreground))]" />
    </button>
  );
}
