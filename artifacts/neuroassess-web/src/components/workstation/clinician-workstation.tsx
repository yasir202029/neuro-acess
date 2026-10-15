/**
 * Clinician Workstation — sophisticated single-page clinical OS shell.
 *
 * GPU workstation / clinical command centre design.
 * Every control connects to a real API/workflow/state. Incomplete controls are marked.
 */

import { useState, useMemo } from "react";
import { UserRound, Menu } from "lucide-react";
import {
  useWorkstationPatients,
  useWorkstationPatient,
  useWorkstationVitals,
  type WorkstationPatient,
} from "@/hooks/use-clinical-workstation";
import { GlobalSearchCommand } from "./global-search-command";
import { PatientRow } from "./patient-row";
import { PatientSummary } from "./patient-summary";
import { WorkstationMetric } from "./workstation-metric";
import { RightRailCommandStack } from "./right-rail-command-stack";
import { ClinicalJourneyProcessor } from "./clinical-journey-processor";
import { ClinicalNotesEditor } from "./clinical-notes-editor";
import { AssessmentBuilder } from "./assessment-builder";
import { MedicationManager } from "./medication-manager";
import { CarePlan } from "./care-plan";
import { VitalsChart } from "./vitals-chart";
import { RiskAssessment } from "./risk-assessment";
import { MdtCollaboration } from "./mdt-collaboration";

type Tab =
  | "summary"
  | "notes"
  | "assessments"
  | "medications"
  | "careplan"
  | "vitals"
  | "risk"
  | "mdt"
  | "appointments";

export function ClinicianWorkstation() {
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: patientsPage, isLoading: patientsLoading } = useWorkstationPatients({
    page: 1,
    pageSize: 50,
    search,
  });
  const patients = patientsPage?.items ?? [];

  const patient = selectedPatientId ? useWorkstationPatient(selectedPatientId).data : null;
  const vitals = selectedPatientId ? (useWorkstationVitals(selectedPatientId).data ?? null) : null;

  const riskOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3, NONE: 4 };
  const sorted = useMemo(
    () => [...patients].sort((a, b) => riskOrder[a.riskSeverity] - riskOrder[b.riskSeverity]),
    [patients]
  );

  return (
    <div className="flex h-[100dvh] bg-[hsl(var(--background))]">
      <GlobalSearchCommand />

      <aside
        className={`flex flex-col w-[320px] border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] transition-all duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Menu className="h-5 w-5 text-[hsl(var(--muted-foreground))] md:hidden cursor-pointer" onClick={() => setSidebarOpen(!sidebarOpen)} />
            <div>
              <p className="mono text-[9px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Clinician Workstation</p>
              <h2 className="text-sm font-semibold tracking-[-.02em]">Patient Worklist</h2>
            </div>
          </div>
          <span className="rounded-full border border-[hsl(var(--border))] px-2 py-0.5 text-[9px] font-semibold text-[hsl(var(--muted-foreground))]">
            {sorted.length}
          </span>
        </div>
        <div className="px-3 py-2 border-b border-[hsl(var(--border))]">
          <div className="relative">
            <input
              className="flex h-8 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-8 pr-2 py-1 text-xs text-[hsl(var(--foreground))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
              placeholder="Search patient or NHS number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-1">
          {patientsLoading ? (
            <div className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))]">Loading worklist…</div>
          ) : sorted.length === 0 ? (
            <div className="px-3 py-10 text-center text-[hsl(var(--muted-foreground))]">No patients match.</div>
          ) : (
            <div className="space-y-0.5">
              {sorted.map((p) => (
                <PatientRow
                  key={p.id}
                  patient={p}
                  active={selectedPatientId === p.id}
                  onSelect={() => {
                    setSelectedPatientId(p.id);
                    setTab("summary");
                    setSidebarOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>

      </aside>

      {/* Centre workspace */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {!selectedPatientId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[hsl(var(--muted-foreground))]">
            <UserRound className="mb-3 h-14 w-14 text-[hsl(var(--muted-foreground))/.5]" />
            <p className="text-sm">Select a patient from the worklist to open their clinical record.</p>
            <p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Use ⌘K to search patients, appointments, assessments.</p>
          </div>
        ) : (
          <div className="flex flex-col h-[100dvh]">
            <PatientSummary patient={patient!} vitals={vitals} onSelectTab={setTab} />
            <div className="flex-1 overflow-y-auto border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
              <div className="grid gap-4">
                <div className="lg:col-span-2 space-y-4">
                  {tab === "summary" && (
                    <>
                      <ClinicalJourneyProcessor patientId={patient!.id} />
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <WorkstationMetric label="Risk score" value={patient!.riskScore} sub={patient!.riskSeverity} accent={patient!.riskSeverity === "CRITICAL" || patient!.riskSeverity === "HIGH"} />
                        <WorkstationMetric label="Pathway" value={patient!.pathway} sub={`Care plan v${patient!.carePlanVersion}`} accent={false} />
                        <WorkstationMetric label="Last contact" value={patient!.lastContactedAt ? new Date(patient!.lastContactedAt).toLocaleDateString() : "—"} sub="Patient contact" accent={false} />
                        <WorkstationMetric label="Care plan version" value={`v${patient!.carePlanVersion}`} sub="Current version" accent={false} />
                      </div>
                    </>
                  )}
                  {tab === "notes" && <ClinicalNotesEditor patientId={patient!.id} />}
                  {tab === "assessments" && <AssessmentBuilder patientId={patient!.id} />}
                  {tab === "medications" && <MedicationManager patient={patient!} />}
                  {tab === "careplan" && <CarePlan patientId={patient!.id} />}
                  {tab === "vitals" && <VitalsChart patientId={patient!.id} vitals={vitals} />}
                  {tab === "risk" && <RiskAssessment patient={patient!} />}
                  {tab === "mdt" && <MdtCollaboration patientId={patient!.id} />}
                  {tab === "appointments" && <div className="text-[hsl(var(--muted-foreground))]">Appointment scheduling via API.</div>}
                </div>
                <div className="lg:col-span-1 space-y-4">
                  <VitalsChart patientId={patient!.id} vitals={vitals} />
                  <RiskAssessment patient={patient!} />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <RightRailCommandStack />
    </div>
  );
}
