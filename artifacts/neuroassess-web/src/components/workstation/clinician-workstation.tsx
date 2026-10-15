import { useState, useMemo } from "react";
import { Search, UserRound, Clock3, ChevronRight } from "lucide-react";
import { useWorkstationPatients, useWorkstationPatient, useWorkstationVitals, type WorkstationPatient } from "@/hooks/use-clinical-workstation";
import type { VitalsObservation } from "@/lib/clinical-api";
import { PatientSummary } from "./patient-summary";
import { ClinicalNotesEditor } from "./clinical-notes-editor";
import { AssessmentBuilder } from "./assessment-builder";
import { MedicationManager } from "./medication-manager";
import { CarePlan } from "./care-plan";
import { VitalsChart } from "./vitals-chart";
import { RiskAssessment } from "./risk-assessment";
import { MdtCollaboration } from "./mdt-collaboration";

type Tab = "summary" | "notes" | "assessments" | "medications" | "careplan" | "vitals" | "risk" | "mdt" | "appointments";

export function ClinicianWorkstation() {
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");

  const { data: patientsPage, isLoading: patientsLoading } = useWorkstationPatients({ page: 1, pageSize: 50, search });
  const patients = patientsPage?.items ?? [];

  const patient = selectedPatientId ? useWorkstationPatient(selectedPatientId).data : null;
  const vitals = selectedPatientId ? (useWorkstationVitals(selectedPatientId).data ?? null) : null;

  const riskOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3, NONE: 4 };
  const sorted = useMemo(() => [...patients].sort((a, b) => riskOrder[a.riskSeverity] - riskOrder[b.riskSeverity]), [patients]);
  return (
    <div className="flex h-[100dvh] bg-[hsl(var(--background))]">
      <aside className="flex flex-col w-[340px] border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
          <div>
            <p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))]">Clinician Workstation</p>
            <h2 className="text-lg font-semibold tracking-[-.03em]">Patient Worklist</h2>
          </div>
          <span className="rounded-full border border-[hsl(var(--border))] px-2 py-1 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">{sorted.length} patients</span>
        </div>
        <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <input
              className="flex h-9 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 pl-10 py-2 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              placeholder="Search patient or NHS number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2">
          {patientsLoading ? (
            <div className="px-5 py-10 text-center text-[hsl(var(--muted-foreground))]">Loading worklist...</div>
          ) : sorted.length === 0 ? (
            <div className="px-5 py-10 text-center text-[hsl(var(--muted-foreground))]">No patients match.</div>
          ) : (
            <div className="space-y-1">{sorted.map((p) => (
              <PatientRow key={p.id} patient={p} active={selectedPatientId === p.id} onSelect={() => { setSelectedPatientId(p.id); setTab("summary"); }} />
            ))}</div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {!selectedPatientId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[hsl(var(--muted-foreground))]">
            <UserRound className="mb-3 h-12 w-12 text-[hsl(var(--muted-foreground))/.5]" />
            <p className="text-sm">Select a patient from the worklist to open their clinical record.</p>
          </div>
        ) : (
          <div className="flex flex-col h-[100dvh]">
            <PatientSummary patient={patient!} vitals={vitals} onSelectTab={setTab} />
            <div className="flex-1 overflow-y-auto border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6">
              {tab === "summary" && <WorkstationSummary patient={patient!} vitals={vitals} />}
              {tab === "notes" && <ClinicalNotesEditor patientId={patient!.id} />}
              {tab === "assessments" && <AssessmentBuilder patientId={patient!.id} />}
              {tab === "medications" && <MedicationManager patient={patient!} />}
              {tab === "careplan" && <CarePlan patientId={patient!.id} />}
              {tab === "vitals" && <VitalsChart patientId={patient!.id} vitals={vitals} />}
              {tab === "risk" && <RiskAssessment patient={patient!} />}
              {tab === "mdt" && <MdtCollaboration patientId={patient!.id} />}
              {tab === "appointments" && <div className="text-[hsl(var(--muted-foreground))]">Appointment scheduling via API.</div>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function PatientRow({ patient, active, onSelect }: { patient: WorkstationPatient; active: boolean; onSelect: () => void }) {
  const riskColor: Record<string, string> = {
    CRITICAL: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
    HIGH: "bg-[hsl(var(--destructive))]/[.85] text-[hsl(var(--destructive-foreground))]",
    MODERATE: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]",
    LOW: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
    NONE: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
  };
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all ${active ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]" : "bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/[.4]"}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-semibold truncate">{patient.displayName}</p>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${riskColor[patient.riskSeverity]}`}>{patient.riskSeverity}</span>
        </div>
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">NHS {patient.nhsNumber} &middot; {patient.pathway} &middot; {patient.gender}, {new Date(patient.dateOfBirth).toLocaleDateString()}</p>
        {patient.nextAppointmentAt && (
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]"><Clock3 className="mr-1 h-3 w-3" /> {new Date(patient.nextAppointmentAt).toLocaleDateString()}</p>
        )}
      </div>
      <ChevronRight size={14} className="text-[hsl(var(--muted-foreground))]" />
    </button>
  );
}

function WorkstationSummary({ patient, vitals }: { patient: WorkstationPatient; vitals: VitalsObservation[] | null }) {
  const latest = vitals?.[vitals.length - 1];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Risk score" value={patient.riskScore} sub={patient.riskSeverity} accent={patient.riskSeverity === "CRITICAL" || patient.riskSeverity === "HIGH"} />
      <StatCard label="Pathway" value={patient.pathway} sub="Care plan" accent={false} />
      <StatCard label="BP" value={latest?.systolicBp ? `${latest.systolicBp}/${latest.diastolicBp}` : "—"} sub={latest ? new Date(latest.recordedAt).toLocaleDateString() : "no vitals"} accent={false} />
      <StatCard label="Weight" value={latest?.weightKg ? `${latest.weightKg} kg` : "—"} sub={latest ? new Date(latest.recordedAt).toLocaleDateString() : "no vitals"} accent={false} />
    </div>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub: string; accent: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? "bg-[hsl(var(--destructive))]/[.1] border-[hsl(var(--destructive))]/[.3]" : "border-[hsl(var(--border))] bg-[hsl(var(--card))]"}`}>
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      <p className="mt-[1px] text-[10px] text-[hsl(var(--muted-foreground))]">{sub}</p>
    </div>
  );
}

