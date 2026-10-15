import type { VisibilityLevel } from "./visibility.js";
import { canViewerSeeEvent, type ViewerClearance } from "./visibility.js";

/** Discriminated union of every source that can appear on the unified timeline. */
export type TimelineEvent =
  | TimelineWorkflowEvent
  | TimelineAppointmentEvent
  | TimelineNoteEvent
  | TimelineDiagnosisEvent
  | TimelinePrescriptionEvent
  | TimelineTitrationEvent
  | TimelineMonitoringEvent
  | TimelineMdtEvent
  | TimelineDocumentEvent
  | TimelineReportEvent
  | TimelineMessageEvent
  | TimelineTaskEvent
  | TimelineComplaintEvent
  | TimelineFinanceEvent;

interface BaseTimelineEvent {
  readonly id: string;
  /** When the thing happened in the real world. */
  readonly occurredAt: string;
  /** When it was recorded in the system (may differ for corrections/backfills). */
  readonly recordedAt: string;
  readonly actorId?: string;
  readonly title: string;
  readonly summary?: string;
  readonly visibility: VisibilityLevel;
  readonly relatedEntity?: { readonly type: string; readonly id: string };
  /** Set when this event supersedes/corrects an earlier one. */
  readonly amends?: { readonly eventId: string; readonly reason: string };
  /** Provenance: which service/module produced the event. */
  readonly source: string;
}

export interface TimelineWorkflowEvent extends BaseTimelineEvent {
  readonly type: "WORKFLOW_TRANSITION";
  readonly fromStage?: string;
  readonly toStage: string;
}
export interface TimelineAppointmentEvent extends BaseTimelineEvent {
  readonly type: "APPOINTMENT";
  readonly appointmentId: string;
  readonly status: string;
}
export interface TimelineNoteEvent extends BaseTimelineEvent {
  readonly type: "CLINICAL_NOTE";
  readonly noteId: string;
}
export interface TimelineDiagnosisEvent extends BaseTimelineEvent {
  readonly type: "DIAGNOSIS";
  readonly outcome: string;
}
export interface TimelinePrescriptionEvent extends BaseTimelineEvent {
  readonly type: "PRESCRIPTION_STATUS";
  readonly prescriptionId: string;
  readonly status: string;
}
export interface TimelineTitrationEvent extends BaseTimelineEvent {
  readonly type: "TITRATION_REVIEW";
  readonly titrationPlanId: string;
}
export interface TimelineMonitoringEvent extends BaseTimelineEvent {
  readonly type: "MONITORING";
  readonly observationId: string;
}
export interface TimelineMdtEvent extends BaseTimelineEvent {
  readonly type: "MDT";
  readonly queueItemId: string;
}
export interface TimelineDocumentEvent extends BaseTimelineEvent {
  readonly type: "DOCUMENT";
  readonly documentId: string;
}
export interface TimelineReportEvent extends BaseTimelineEvent {
  readonly type: "REPORT";
  readonly reportId: string;
}
export interface TimelineMessageEvent extends BaseTimelineEvent {
  readonly type: "MESSAGE";
  readonly threadId: string;
}
export interface TimelineTaskEvent extends BaseTimelineEvent {
  readonly type: "TASK";
  readonly taskId: string;
  readonly taskStatus: string;
}
export interface TimelineComplaintEvent extends BaseTimelineEvent {
  readonly type: "COMPLAINT";
  readonly complaintId: string;
}
export interface TimelineFinanceEvent extends BaseTimelineEvent {
  readonly type: "FINANCE";
  readonly invoiceId?: string;
  readonly status: string;
}

/** Sort newest-first by occurredAt then recordedAt (stable tiebreak on id). */
export function sortTimeline(events: readonly TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
    if (a.recordedAt !== b.recordedAt) return a.recordedAt < b.recordedAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

/**
 * Query-layer visibility filter. Callers MUST pass events through this before
 * returning them to a workspace; UI hiding is not sufficient.
 */
export function filterTimelineForViewer(
  events: readonly TimelineEvent[],
  viewer: ViewerClearance,
): TimelineEvent[] {
  return events.filter((event) => canViewerSeeEvent(viewer, event.visibility));
}
