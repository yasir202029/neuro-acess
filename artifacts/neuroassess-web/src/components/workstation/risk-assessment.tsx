/**
 * Risk Assessment — risk severity gauge and safeguarding actions.
 */

import type { WorkstationPatient } from "@/hooks/use-clinical-workstation";
import { useAcknowledgeAlert } from "@/hooks/use-clinical-workstation";
import { ShieldAlert, Clock, Mail } from "lucide-react";

export function RiskAssessment({ patient }: { patient: WorkstationPatient }) {
  const acknowledge = useAcknowledgeAlert(patient.id);

  const severityColor: Record<string, string> = {
    CRITICAL: "bg-[hsl(var(--destructive))]",
    HIGH: "bg-[hsl(var(--destructive))]",
    MODERATE: "bg-[hsl(var(--warning))]",
    LOW: "bg-[hsl(var(--secondary))]",
    NONE: "bg-[hsl(var(--secondary))]",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Clinical risk</p>
          <h3 className="text-lg font-semibold">Risk assessment</h3>
        </div>
        <ShieldAlert className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Risk score</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-3xl font-bold ${severityColor[patient.riskSeverity]}`}>{patient.riskScore}</span>
              <span className={`text-sm font-semibold ${severityColor[patient.riskSeverity]}`}>{patient.riskSeverity}</span>
            </div>
            <p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">
              Composite risk across medication, safeguarding, physical health and engagement.
            </p>
          </div>
          <div className="w-20 h-20 rounded-full border-[hsl(var(--border))] bg-[hsl(var(--background))] flex items-center justify-center relative">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="100" cy="100" r="80" stroke="[hsl(var(--border))]" strokeWidth="10" fill="none" />
              <circle cx="100" cy="100" r="80" stroke={severityColor[patient.riskSeverity]} strokeWidth="10" fill="none" strokeDasharray={Math.round((patient.riskScore / 100) * 502)} strokeDashoffset="502" className="transition-all duration-700" />
            </svg>
            <span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">{patient.riskScore}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
        <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-3">Open alerts</p>
        <div className="space-y-2">
          {patient.openAlerts.length > 0 ? patient.openAlerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-3 rounded-lg border border-[hsl(var(--border))]/[.5] bg-[hsl(var(--background))]/[.4]">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`px-1.5 py-0 rounded text-[9px] font-bold ${
                    a.severity === "CRITICAL" || a.severity === "HIGH"
                      ? "bg-[hsl(var(--destructive))]/[.1] border-[hsl(var(--destructive))]/[.3] text-[hsl(var(--destructive))]"
                      : "bg-[hsl(var(--warning))]/[.1] border-[hsl(var(--warning))]/[.3] text-[hsl(var(--warning))]"
                  }`}>{a.severity}</span>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))]">{a.kind}</span>
                </div>
                <p className="text-sm font-semibold truncate">{a.title}</p>
                <p className="mt-[1px] text-[10px] text-[hsl(var(--muted-foreground))] truncate">{a.detail}</p>
              </div>
              {!a.acknowledgedBy ? (
                <button
                  onClick={() => acknowledge.mutate(a.id)}
                  disabled={acknowledge.isPending}
                  className="text-[10px] font-semibold underline underline-offset-2 text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]/[.9] disabled:opacity-50"
                >
                  Acknowledge {acknowledge.isPending ? <Clock className="ml-1 h-3 w-3 animate-spin" /> : <Mail size={13} className="ml-1" />}
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))]">
                  <CheckCircle className="h-3 w-3 text-[hsl(var(--success))]" />
                  Acknowledged
                </span>
              )}
            </div>
          )) : (
            <p className="text-[12px] text-[hsl(var(--muted-foreground))]">No open risk or safeguarding alerts.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5 text-[12px] text-[hsl(var(--muted-foreground))]">
        <p className="font-semibold mb-1">Escalation</p>
        <p>If risk is CRITICAL or HIGH and the patient is in immediate danger, follow local safeguarding escalation and contact the duty clinician immediately.</p>
      </div>
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return <svg className={`h-4 w-4 ${className ?? ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>;
}
