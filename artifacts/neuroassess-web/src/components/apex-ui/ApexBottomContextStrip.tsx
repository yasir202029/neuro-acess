/**
 * ApexBottomContextStrip — bottom context strip showing current pathway stage,
 * save state, workflow status, and recent relevant events.
 *
 * Never exposes inappropriate technical data.
 */

import { Clock3, CheckCircle2, AlertTriangle, Save } from 'lucide-react';

const STAGE_ICONS: Record<string, any> = {
  REFERRAL: Clock3,
  INTAKE: Clock3,
  QUESTIONNAIRES: Clock3,
  ASSESSMENT: Clock3,
  CLINICAL_REVIEW: AlertTriangle,
  OUTCOME: Clock3,
  REPORT: Clock3,
  FEEDBACK: Clock3,
  TREATMENT: Clock3,
  TITRATION: Clock3,
  MAINTENANCE_SHARED_CARE: Clock3,
  ONGOING_CARE_DISCHARGE: Clock3,
};

const STAGE_COLOURS: Record<string, string> = {
  COMPLETED: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]',
  ACTIVE: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
  WAITING: 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]',
  BLOCKED: 'bg-[hsl(var(--critical-red))] text-white',
  'CLINICAL_REVIEW_REQUIRED': 'bg-[hsl(var(--apex-review-purple))] text-[hsl(var(--apex-review-purple-foreground), hsl(var(--apex-review-purple)))]',
};

export function ApexBottomContextStrip({
  currentStage,
  stageLabel,
  stageStatus,
  unsavedChanges,
  recentEvents,
}: {
  currentStage?: string;
  stageLabel?: string;
  stageStatus?: string;
  unsavedChanges?: boolean;
  recentEvents?: Array<{ time: string; event: string; actor?: string }>;
}) {
  return (
    <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3">
      {/* Pathway stage */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <span className="text-[10px] font-semibold text-[hsl(var(--foreground))]">
            {stageLabel || currentStage || 'No active pathway'}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[9px] font-bold ${STAGE_COLOURS[stageStatus ?? 'WAITING']}`}
          >
            {stageStatus?.replace(/_/g, ' ') || 'Waiting'}
          </span>
        </div>
        {unsavedChanges && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[hsl(var(--apex-amber-warning))]/[.3] bg-[hsl(var(--apex-amber-warning))]/[.1]">
            <Save className="h-3 w-3 text-[hsl(var(--apex-amber-warning))]" />
            <span className="text-[10px] font-semibold text-[hsl(var(--apex-amber-warning))]">
              Unsaved changes
            </span>
          </div>
        )}
      </div>

      {/* Recent events */}
      {recentEvents && recentEvents.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground))] mb-1">
            Recent activity
          </p>
          <div className="space-y-1">
            {recentEvents.slice(0, 3).map((event, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <Clock3 className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                <span className="text-[hsl(var(--muted-foreground))]">{event.event}</span>
                <span className="ml-auto text-[hsl(var(--muted-foreground))]">{event.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
