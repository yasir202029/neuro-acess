/**
 * Clinical Journey Processor — displays the patient's clinical pathway.
 *
 * Shows stages: REFERRAL → INTAKE → QUESTIONNAIRES → ASSESSMENT → CLINICAL_REVIEW
 * → OUTCOME → REPORT → FEEDBACK → TREATMENT → TITRATION → MAINTENANCE_SHARED_CARE
 * → ONGOING_CARE_DISCHARGE
 *
 * Stage statuses: COMPLETED, ACTIVE, WAITING, BLOCKED, CLINICAL_REVIEW_REQUIRED.
 * Never automatically crosses a clinical safety gate.
 */

import { useEffect, useState } from "react";
import { Clock, CheckCircle2, AlertTriangle, ShieldAlert, Clock as ClockIcon } from "lucide-react";
import { workstationApi, type ClinicalJourneyState } from "@/lib/clinical-api";

const STAGE_LABELS: Record<string, string> = {
  REFERRAL: "Referral",
  INTAKE: "Intake",
  QUESTIONNAIRES: "Questionnaires",
  ASSESSMENT: "Assessment",
  CLINICAL_REVIEW: "Clinical Review",
  OUTCOME: "Outcome",
  REPORT: "Report",
  FEEDBACK: "Feedback",
  TREATMENT: "Treatment",
  TITRATION: "Titration",
  MAINTENANCE_SHARED_CARE: "Maintenance / Shared Care",
  ONGOING_CARE_DISCHARGE: "Ongoing Care / Discharge",
};

const STAGE_STATUS_COLOURS: Record<string, string> = {
  COMPLETED: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]",
  ACTIVE: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]",
  WAITING: "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]",
  BLOCKED: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]",
  CLINICAL_REVIEW_REQUIRED: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]",
};

const STAGE_ICONS: Record<string, any> = {
  COMPLETED: CheckCircle2,
  ACTIVE: Clock,
  WAITING: ClockIcon,
  BLOCKED: ShieldAlert,
  CLINICAL_REVIEW_REQUIRED: AlertTriangle,
};

export function ClinicalJourneyProcessor({ patientId }: { patientId: string }) {
  const [journey, setJourney] = useState<ClinicalJourneyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    workstationApi
      .getJourney(patientId)
      .then((data) => {
        if (!cancelled) {
          setJourney(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Journey data unavailable");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-[hsl(var(--muted-foreground))]">
        <Clock size={16} className="mr-2 animate-spin" />
        Loading journey…
      </div>
    );
  }

  if (error || !journey) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-6 text-[12px] text-[hsl(var(--muted-foreground))]">
        {error}
      </div>
    );
  }

  const nextIndex = journey.stages.findIndex((s) => s.stage === journey.nextStage);
  const isBlocked = journey.safetyGates.length > 0;

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">
            Clinical Journey
          </p>
          <h3 className="text-lg font-semibold tracking-[-.03em]">{journey.pathway} Pathway</h3>
        </div>
        {isBlocked && (
          <span className="rounded-xl border border-[hsl(var(--warning))]/[.3] bg-[hsl(var(--warning))]/[.1] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--warning))]">
            Safety gate active
          </span>
        )}
      </div>

      <div className="relative">
        {/* Connector line */}
        <div className="absolute left-1/2 top-4 bottom-4 w-px bg-[hsl(var(--border))] -translate-x-1/2" />

        {journey.stages.map((stage, index) => {
          const isLast = index === journey.stages.length - 1;
          const isCurrent = stage.stage === journey.nextStage;
          const isCompleted =
            journey.stages.slice(0, index).every((s) => s.status === "COMPLETED");
          const statusColour = STAGE_STATUS_COLOURS[stage.status];
          const Icon = STAGE_ICONS[stage.status];

          return (
            <div key={stage.stage} className="relative z-10">
              {/* Stage node */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-bold">
                <span className={`h-2.5 w-2.5 rounded-full transition-colors ${statusColour}`} />
                <span>{stage.stage.replace(/_/g, " ")}</span>
                <span className={`text-[9px] ${statusColour}`}>{stage.status.replace(/_/g, " ")}</span>
              </div>

              {/* Connector to next */}
              {!isLast && (
                <div className="absolute left-1/2 top-[56px] bottom-[4px] w-px bg-[hsl(var(--border))] -translate-x-1/2" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px]">
        <span className="text-[hsl(var(--muted-foreground))]">Next stage:</span>
        <span className={`font-semibold ${STAGE_STATUS_COLOURS[journey.stages[nextIndex]?.status || "BLOCKED"]}`}>
          {journey.nextStage.replace(/_/g, " ")}
        </span>
      </div>

      {journey.safetyGates.length > 0 && (
        <div className="mt-3 rounded-lg border border-[hsl(var(--border))]/[.5] bg-[hsl(var(--background))]/[.4] p-3 text-[11px]">
          <ShieldAlert size={12} className="mr-1.5 text-[hsl(var(--warning))]" />
          <span className="font-medium">Clinical safety gate:</span>{" "}
          {journey.safetyGates.join(", ")} — clinician authorisation required before advancement.
        </div>
      )}
    </div>
  );
}
