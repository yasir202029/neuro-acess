/**
 * Patient 360 header — demographics, risk, alerts, and tab navigation.
 */

import { useState } from "react";
import { Stethoscope, Pill, HeartPulse, Clock3, FileText, ClipboardList, AlertTriangle, MessageCircle, ChevronRight } from "lucide-react";
import type { WorkstationPatient, VitalsObservation, ClinicalAlert, RiskSeverity } from "@/lib/clinical-api";

type Tab = "summary" | "notes" | "assessments" | "medications" | "careplan" | "vitals" | "risk" | "mdt" | "appointments";

const TAB_ICONS: Record<Tab, any> = {
  summary: Stethoscope,
  notes: FileText,
  assessments: ClipboardList,
  medications: Pill,
  careplan: ClipboardList,
  vitals: HeartPulse,
  risk: AlertTriangle,
  mdt: MessageCircle,
  appointments: Clock3,
};

export function PatientSummary({ patient, vitals, onSelectTab }: { patient: WorkstationPatient; vitals: VitalsObservation[] | null; onSelectTab: (tab: Tab) => void }) {
  const latest = vitals?.[vitals.length - 1];
  const [openTab, setOpenTab] = useState<Tab>("summary");

  const riskColor: Record<RiskSeverity, string> = {
    CRITICAL: "text-[hsl(var(--destructive))]",
    HIGH: "text-[hsl(var(--destructive))]",
    MODERATE: "text-[hsl(var(--warning))]",
    LOW: "text-[hsl(var(--secondary))]",
    NONE: "text-[hsl(var(--secondary))]",
  };

  return (
    <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <p className="text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Patient record</p>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${riskColor[patient.riskSeverity]}`}>{patient.riskSeverity} risk</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-.04em]">{patient.displayName}</h1>
          <p className="mt-[1px] text-sm text-[hsl(var(--muted-foreground))]">
            NHS {patient.nhsNumber} · {patient.pathway} pathway · {patient.gender}, {new Date(patient.dateOfBirth).toLocaleDateString()} ·
            assigned to {patient.assignedClinicianId}
          </p>
        </div>
        <div className="flex gap-2">
          <Chip label={patient.riskScore > 0 ? `Risk ${patient.riskScore}` : "Risk n/a"} accent={patient.riskScore >= 40} />
          <Chip label={patient.nextAppointmentAt ? new Date(patient.nextAppointmentAt).toLocaleDateString() : "No appointment"} accent={false} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Risk score" value={patient.riskScore} delta={patient.riskScore >= 40 ? "elevated" : "within band"} accent={patient.riskScore >= 40} />
        <MetricCard label="Care plan" value={`v${patient.carePlanVersion}`} delta={patient.openAlerts.length > 0 ? `${patient.openAlerts.length} open alert(s)` : "up to date"} accent={patient.openAlerts.length > 0} />
        <MetricCard label="Last contact" value={patient.lastContactedAt ? new Date(patient.lastContactedAt).toLocaleDateString() : "—"} delta={latest ? `Vitals ${new Date(latest.recordedAt).toLocaleDateString()}` : "no vitals"} accent={false} />
      </div>

      <div className="mt-5 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 grid grid-cols-2 gap-3">
          {patient.activeMedications.map((m) => (
            <MedChip key={m.id} name={m.name} dosage={m.dosage} titration={m.titrationActive} />
          ))}
        </div>
        <div className="flex-1">
          {patient.openAlerts.length > 0 ? (
            <AlertList alerts={patient.openAlerts} onAcknowledge={(id) => onSelectTab("risk")} />
          ) : (
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
              <p className="text-[12px] text-[hsl(var(--muted-foreground))]">No open clinical alerts.</p>
            </div>
          )}
        </div>
      <div className="mt-6 flex gap-2">
        {["summary", "notes", "assessments", "medications", "careplan", "vitals", "risk", "mdt", "appointments"].map((t) => {
          const Icon = TAB_ICONS[t as Tab];
          const active = openTab === t as Tab;
          return (
            <button
              key={t}
              onClick={() => { setOpenTab(t as Tab); onSelectTab(t as Tab); }}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${
                active
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]"
                  : "bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))]/[.4]"
              }`}
            >
              <Icon size={15} className={active ? "text-[hsl(var(--primary-foreground))]" : ""} />
              {t.charAt(0).toUpperCase() + t.slice(1)}
              <ChevronRight size={12} className="ml-auto opacity-50" />
            </button>
          );
        })}
      </div>
    </div>
  </div>
  );
}

function Chip({ label, accent }: { label: string; accent: boolean }) {
  return (
    <span className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold ${
      accent ? "bg-[hsl(var(--destructive))]/[.1] border-[hsl(var(--destructive))]/[.3] text-[hsl(var(--destructive))]" : "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))]"
    }`}>{label}</span>
  );
}

function MetricCard({ label, value, delta, accent }: { label: string; value: string | number; delta: string; accent: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${
      accent ? "bg-[hsl(var(--destructive))]/[.08] border-[hsl(var(--destructive))]/[.2]" : "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
    }`}>
    <p className="text-[10px] text-[hsl(var(--muted-foreground))]">{label}</p>
    <p className="mt-1 text-lg font-semibold">{value}</p>
    <p className="mt-[1px] text-[10px] text-[hsl(var(--muted-foreground))]">{delta}</p>
  </div>
);
}

function MedChip({ name, dosage, titration }: { name: string; dosage: string; titration: boolean }) {
  return (
    <span className="flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2 text-[12px]">
      <Pill className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
      <span className="font-semibold">{name}</span>
      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{dosage}</span>
      {titration && <span className="text-[10px] font-bold text-[hsl(var(--warning))]">TITRATING</span>}
    </span>
  );
}

function AlertList({ alerts, onAcknowledge }: { alerts: ClinicalAlert[]; onAcknowledge: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
      <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-2">Open alerts</p>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center gap-2 px-2 py-2 rounded-lg border border-[hsl(var(--border))]/[.5] bg-[hsl(var(--background))]/[.4] text-[11px]">
            <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{a.title}</p>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] truncate">{a.detail}</p>
            </div>
            <button onClick={() => onAcknowledge(a.id)} className="text-[10px] font-semibold underline underline-offset-2 hover:text-[hsl(var(--primary))]">
              Acknowledge
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
