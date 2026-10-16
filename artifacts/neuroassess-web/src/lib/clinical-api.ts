/**
 * Typed API client for the Clinical Workstation backend (`/workstation/*`).
 *
 * Mirrors the server domain types in `artifacts/api-server/src/types/clinical-workstation.ts`.
 * Backend is the source of truth; these types are kept in sync manually.
 */

import { api, type ApiError } from "./api-client";

export type ClinicalPathway = "ADHD" | "AUTISM" | "BOTH" | "GENERAL";
export type RiskSeverity = "NONE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface WorkstationPatient {
  id: string;
  nhsNumber: string;
  displayName: string;
  dateOfBirth: string;
  gender: string;
  pathway: ClinicalPathway;
  riskSeverity: RiskSeverity;
  riskScore: number;
  assignedClinicianId: string;
  lastContactedAt: string | null;
  nextAppointmentAt: string | null;
  activeMedications: MedicationSummary[];
  openAlerts: ClinicalAlert[];
  carePlanVersion: number;
}

export interface MedicationSummary {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startedAt: string;
  reviewDueAt: string | null;
  titrationActive: boolean;
}

export interface ClinicalAlert {
  id: string;
  kind: "RISK" | "SAFEGUARDING" | "MEDICATION_REVIEW" | "PHYSICAL_HEALTH" | "MISSED_APPOINTMENT";
  severity: RiskSeverity;
  title: string;
  detail: string;
  raisedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface VitalsObservation {
  id: string;
  patientId: string;
  recordedAt: string;
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  temperature?: number;
  weightKg?: number;
  heightCm?: number;
  oxygenSaturation?: number;
  recordedBy: string;
}

export interface ClinicalNote {
  id: string;
  patientId: string;
  authorId: string;
  type: "CONSULTATION" | "PROGRESS" | "MEDICATION_REVIEW" | "RISK_REVIEW" | "SAFEGUARDING";
  status: "DRAFT" | "PENDING_SIGN" | "SIGNED" | "AMENDED";
  body: string;
  version: number;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentResponse {
  id: string;
  patientId: string;
  instrument: string;
  answers: number[];
  totalScore: number;
  interpretation: string;
  completedAt: string;
  completedBy: string;
}

export interface CarePlanItem {
  id: string;
  patientId: string;
  title: string;
  description: string;
  category: "MEDICATION" | "THERAPY" | "MONITORING" | "REFERRAL" | "LIFESTYLE";
  priority: "ROUTINE" | "URGENT";
  status: "ACTIVE" | "COMPLETED" | "SUSPENDED" | "CANCELLED";
  targetDate: string | null;
  completedAt: string | null;
  ownerRole: string;
}

export interface WorkstationAppointment {
  id: string;
  patientId: string;
  startsAt: string;
  endsAt: string;
  mode: "VIDEO" | "PHONE" | "IN_PERSON";
  status: "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "DID_NOT_ATTEND";
  reason: string;
  locationOrLink: string;
}

export interface MdtNote {
  id: string;
  patientId: string;
  authorId: string;
  authorRole: string;
  body: string;
  visibleToTeam: boolean;
  createdAt: string;
}

export interface JourneyStage {
  stage:
    | "REFERRAL"
    | "INTAKE"
    | "QUESTIONNAIRES"
    | "ASSESSMENT"
    | "CLINICAL_REVIEW"
    | "OUTCOME"
    | "REPORT"
    | "FEEDBACK"
    | "TREATMENT"
    | "TITRATION"
    | "MAINTENANCE_SHARED_CARE"
    | "ONGOING_CARE_DISCHARGE";
  status: "COMPLETED" | "ACTIVE" | "WAITING" | "BLOCKED" | "CLINICAL_REVIEW_REQUIRED";
}

export interface ClinicalJourneyState {
  patientId: string;
  pathway: string;
  currentStage: string;
  stages: JourneyStage[];
  nextStage: string;
  safetyGates: string[];
}

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

export type WorkQueueFilterView =
  | "ALL"
  | "MINE"
  | "UNASSIGNED"
  | "DUE_TODAY"
  | "OVERDUE"
  | "BLOCKED"
  | "WAITING_FOR_PATIENT"
  | "WAITING_FOR_CLINICIAN"
  | "WAITING_FOR_ADMIN";

export interface WorkQueueAction {
  id: string;
  label: string;
  endpoint: string;
  method: "POST" | "PATCH" | "PUT";
  permission: string;
  requiresConfirmation: boolean;
}

export interface WorkQueueItem {
  id: string;
  patientId: string;
  displayName: string;
  taskType: WorkQueueTaskType;
  workflowStage: string;
  status: WorkQueueStatus;
  ownerId: string | null;
  ownerDisplayName: string | null;
  priority: WorkQueuePriority;
  createdAt: string;
  dueAt: string | null;
  blockingReason: string | null;
  nextPermittedActions: WorkQueueAction[];
}

export interface WorkQueueBucket {
  id: string;
  title: string;
  statusFilter: WorkQueueStatus | null;
  taskTypeFilter: WorkQueueTaskType | null;
  count: number;
}

export interface PaginatedWorkQueueItems {
  items: WorkQueueItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkQueueActionRequest {
  actionId: string;
  payload?: Record<string, unknown>;
}

export interface WorkQueueActionResponse {
  itemId: string;
  previousStatus: WorkQueueStatus;
  newStatus: WorkQueueStatus;
  auditEvent: string;
}

export interface SystemServiceStatus {
  name: string;
  status: "operational" | "degraded" | "standby" | "maintenance";
}

export interface SystemStatusResponse {
  services: SystemServiceStatus[];
  timestamp: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const workstationApi = {
  listPatients: (params?: { page?: number; pageSize?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params?.search) qs.set("search", params.search);
    const path = qs.toString() ? `/workstation/patients?${qs.toString()}` : "/workstation/patients";
    return api.get<Paginated<WorkstationPatient>>(path);
  },
  getPatient: (patientId: string) => api.get<WorkstationPatient>(`/workstation/patients/${patientId}`),
  getVitals: (patientId: string) => api.get<VitalsObservation[]>(`/workstation/patients/${patientId}/vitals`),
  createClinicalNote: (patientId: string, body: { type: ClinicalNote["type"]; body: string }) =>
    api.post<ClinicalNote>(`/workstation/patients/${patientId}/clinical-notes`, body),
  submitAssessment: (patientId: string, body: { instrument: string; answers: number[]; interpretation: string }) =>
    api.post<AssessmentResponse>(`/workstation/patients/${patientId}/assessments`, body),
  createCarePlanItem: (patientId: string, body: Omit<CarePlanItem, "id" | "patientId" | "status" | "completedAt">) =>
    api.post<CarePlanItem>(`/workstation/patients/${patientId}/care-plan`, body),
  createAppointment: (patientId: string, body: Omit<WorkstationAppointment, "id" | "patientId" | "status">) =>
    api.post<WorkstationAppointment>(`/workstation/patients/${patientId}/appointments`, body),
  createMdtNote: (patientId: string, body: { body: string; visibleToTeam?: boolean }) =>
    api.post<MdtNote>(`/workstation/patients/${patientId}/mdt-notes`, body),
  acknowledgeAlert: (patientId: string, alertId: string) =>
    api.post<ClinicalAlert>(`/workstation/patients/${patientId}/alerts/${alertId}/acknowledge`, {}),

  getJourney: (patientId: string) =>
    api.get<ClinicalJourneyState>(`/workstation/patients/${patientId}/journey`),

  getQueueSummary: () => api.get<{ buckets: WorkQueueBucket[] }>("/workstation/queue/summary"),

  getQueueItems: (params?: {
    bucketId?: string;
    filterView?: WorkQueueFilterView;
    search?: string;
    status?: WorkQueueStatus;
    taskType?: WorkQueueTaskType;
    owner?: string;
    priority?: WorkQueuePriority;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.bucketId) qs.set("bucketId", params.bucketId);
    if (params?.filterView) qs.set("filterView", params.filterView);
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    if (params?.taskType) qs.set("taskType", params.taskType);
    if (params?.owner) qs.set("owner", params.owner);
    if (params?.priority) qs.set("priority", params.priority);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
    const path = qs.toString() ? `/workstation/queue/items?${qs.toString()}` : "/workstation/queue/items";
    return api.get<PaginatedWorkQueueItems>(path);
  },

  performQueueAction: (itemId: string, actionId: string, payload?: Record<string, unknown>) =>
    api.post<WorkQueueActionResponse>(`/workstation/queue/items/${itemId}/actions/${actionId}`, { actionId, ...(payload ? { payload } : {}) }),

  getSystemStatus: () => api.get<SystemStatusResponse>("/system/status"),
};
