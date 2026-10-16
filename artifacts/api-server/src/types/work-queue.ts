/**
 * Work Queue domain types for the APEX Operations Tower / Flowgrid.
 *
 * Synthetic development domain: no real patient data enters these structures.
 * Every boundary input is validated with zod before reaching the service layer.
 * Server-side enforcement: RBAC + tenant scoping on every call.
 */

import type { AuditActor } from "@neurocare/audit";
import type { Capability } from "@neurocare/permissions";

export type WorkQueueActor = AuditActor & {
  readonly capabilities: ReadonlySet<Capability>;
  readonly email: string;
  readonly clinicId: string | null;
};

export type WorkQueueStatus =
  | "NEW"
  | "WAITING_FOR_FORMS"
  | "WAITING_FOR_INFORMANT"
  | "APPOINTMENT_REQUIRED"
  | "CLINICIAN_ASSIGNMENT_REQUIRED"
  | "ASSESSMENT_PREPARATION"
  | "ASSESSMENT_COMPLETE_REVIEW_REQUIRED"
  | "REPORT_PENDING"
  | "PAYMENT_REQUIRED"
  | "TITRATION_REVIEW_DUE"
  | "VITALS_REQUIRED"
  | "PRESCRIPTION_ADMINISTRATION"
  | "FOLLOW_UP_REQUIRED"
  | "ADMINISTRATIVE_EXCEPTION";

export type WorkQueueTaskType =
  | "NEW_REFERRAL"
  | "INTAKE_QUESTIONNAIRE"
  | "INFORMANT_QUESTIONNAIRE"
  | "INITIAL_ASSESSMENT"
  | "FOLLOW_UP_ASSESSMENT"
  | "TITRATION_REVIEW"
  | "VITALS_CHECK"
  | "PRESCRIPTION_ADMIN"
  | "REPORT_WRITING"
  | "ADMINISTRATIVE_TASK";

export type WorkQueuePriority = "ROUTINE" | "URGENT" | "STAT";

export interface WorkQueueItem {
  readonly id: string;
  readonly patientId: string;
  readonly displayName: string;
  readonly taskType: WorkQueueTaskType;
  readonly workflowStage: string;
  readonly status: WorkQueueStatus;
  readonly ownerId: string | null;
  readonly ownerDisplayName: string | null;
  readonly priority: WorkQueuePriority;
  readonly createdAt: string;
  readonly dueAt: string | null;
  readonly blockingReason: string | null;
  readonly nextPermittedActions: readonly WorkQueueAction[];
}

export interface WorkQueueAction {
  readonly id: string;
  readonly label: string;
  readonly endpoint: string;
  readonly method: "POST" | "PATCH" | "PUT";
  readonly permission: string;
  readonly requiresConfirmation: boolean;
}

export interface WorkQueueBucket {
  readonly id: string;
  readonly title: string;
  readonly statusFilter: WorkQueueStatus | null;
  readonly taskTypeFilter: WorkQueueTaskType | null;
  readonly count: number;
}

export interface PaginatedWorkQueueItems {
  readonly items: readonly WorkQueueItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface WorkQueueActionRequest {
  readonly actionId: string;
  readonly payload?: Record<string, unknown>;
}

export interface WorkQueueActionResponse {
  readonly itemId: string;
  readonly previousStatus: WorkQueueStatus;
  readonly newStatus: WorkQueueStatus;
  readonly auditEvent: string;
}

export class WorkQueueError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "WorkQueueError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const WorkQueueCapability = {
  READ_QUEUE: "patient:read",
  WRITE_QUEUE: "patient:write",
  MANAGE_APPOINTMENT: "appointment:manage",
  WRITE_CLINICAL: "clinical:write",
  WRITE_ASSESSMENT: "assessment:write",
  READ_BILLING: "billing:read",
  WRITE_DOCUMENT: "document:write",
} as const;


export const WORK_QUEUE_BUCKETS: readonly WorkQueueBucket[] = [
  { id: "new-referrals", title: "New Referrals", statusFilter: "NEW", taskTypeFilter: null, count: 0 },
  { id: "waiting-for-forms", title: "Waiting for Forms", statusFilter: "WAITING_FOR_FORMS", taskTypeFilter: null, count: 0 },
  { id: "waiting-for-informant", title: "Waiting for Informant", statusFilter: "WAITING_FOR_INFORMANT", taskTypeFilter: null, count: 0 },
  { id: "appointment-required", title: "Appointment Required", statusFilter: "APPOINTMENT_REQUIRED", taskTypeFilter: null, count: 0 },
  { id: "clinician-assignment-required", title: "Clinician Assignment Required", statusFilter: "CLINICIAN_ASSIGNMENT_REQUIRED", taskTypeFilter: null, count: 0 },
  { id: "assessment-preparation", title: "Assessment Preparation", statusFilter: "ASSESSMENT_PREPARATION", taskTypeFilter: null, count: 0 },
  { id: "assessment-complete-review-required", title: "Assessment Complete / Review Required", statusFilter: "ASSESSMENT_COMPLETE_REVIEW_REQUIRED", taskTypeFilter: null, count: 0 },
  { id: "report-pending", title: "Report Pending", statusFilter: "REPORT_PENDING", taskTypeFilter: null, count: 0 },
  { id: "payment-required", title: "Payment Required", statusFilter: "PAYMENT_REQUIRED", taskTypeFilter: null, count: 0 },
  { id: "titration-review-due", title: "Titration Review Due", statusFilter: "TITRATION_REVIEW_DUE", taskTypeFilter: null, count: 0 },
  { id: "vitals-required", title: "Vitals Required", statusFilter: "VITALS_REQUIRED", taskTypeFilter: null, count: 0 },
  { id: "prescription-administration", title: "Prescription Administration", statusFilter: "PRESCRIPTION_ADMINISTRATION", taskTypeFilter: null, count: 0 },
  { id: "follow-up-required", title: "Follow-up Required", statusFilter: "FOLLOW_UP_REQUIRED", taskTypeFilter: null, count: 0 },
  { id: "administrative-exception", title: "Administrative Exception", statusFilter: "ADMINISTRATIVE_EXCEPTION", taskTypeFilter: null, count: 0 },
] as const;

export type WorkQueueBucketId = (typeof WORK_QUEUE_BUCKETS)[number]["id"];

export type WorkQueueFilterView = "ALL" | "MINE" | "UNASSIGNED" | "DUE_TODAY" | "OVERDUE" | "BLOCKED" | "WAITING_FOR_PATIENT" | "WAITING_FOR_CLINICIAN" | "WAITING_FOR_ADMIN";

export function workflowStageLabel(stage: string): string {
  const labels: Record<string, string> = {
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
  return labels[stage] ?? stage;
}

export function workQueueStatusLabel(status: WorkQueueStatus): string {
  const labels: Record<WorkQueueStatus, string> = {
    NEW: "New",
    WAITING_FOR_FORMS: "Waiting for Forms",
    WAITING_FOR_INFORMANT: "Waiting for Informant",
    APPOINTMENT_REQUIRED: "Appointment Required",
    CLINICIAN_ASSIGNMENT_REQUIRED: "Clinician Assignment Required",
    ASSESSMENT_PREPARATION: "Assessment Preparation",
    ASSESSMENT_COMPLETE_REVIEW_REQUIRED: "Review Required",
    REPORT_PENDING: "Report Pending",
    PAYMENT_REQUIRED: "Payment Required",
    TITRATION_REVIEW_DUE: "Titration Review Due",
    VITALS_REQUIRED: "Vitals Required",
    PRESCRIPTION_ADMINISTRATION: "Prescription Administration",
    FOLLOW_UP_REQUIRED: "Follow-up Required",
    ADMINISTRATIVE_EXCEPTION: "Administrative Exception",
  };
  return labels[status];
}

export function workQueueTaskTypeLabel(taskType: WorkQueueTaskType): string {
  const labels: Record<WorkQueueTaskType, string> = {
    NEW_REFERRAL: "New Referral",
    INTAKE_QUESTIONNAIRE: "Intake Questionnaire",
    INFORMANT_QUESTIONNAIRE: "Informant Questionnaire",
    INITIAL_ASSESSMENT: "Initial Assessment",
    FOLLOW_UP_ASSESSMENT: "Follow-up Assessment",
    TITRATION_REVIEW: "Titration Review",
    VITALS_CHECK: "Vitals Check",
    PRESCRIPTION_ADMIN: "Prescription Administration",
    REPORT_WRITING: "Report Writing",
    ADMINISTRATIVE_TASK: "Administrative Task",
  };
  return labels[taskType];
}

export function workQueuePriorityLabel(priority: WorkQueuePriority): string {
  const labels: Record<WorkQueuePriority, string> = {
    ROUTINE: "Routine",
    URGENT: "Urgent",
    STAT: "STAT",
  };
  return labels[priority];
}
export type WorkQueueCapability = (typeof WorkQueueCapability)[keyof typeof WorkQueueCapability];