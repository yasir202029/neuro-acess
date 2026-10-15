/**
 * Clinical Workstation domain types.
 *
 * Synthetic development domain: no real patient data enters these structures.
 * Every boundary input is validated with zod before reaching the service layer.
 * Server-side enforcement: RBAC + feature flags + tenant scoping on every call.
 */

import type { AuditActor } from "@neurocare/audit";
import type { Capability } from "@neurocare/permissions";

/** Authenticated principal resolved server-side (never trusted from the client). */
export type WorkstationActor = AuditActor & { readonly capabilities: ReadonlySet<Capability>; readonly email: string; readonly clinicId: string | null };

/** Clinical pathway supported by the workstation. */
export type ClinicalPathway = "ADHD" | "AUTISM" | "BOTH" | "GENERAL";

/** Patient risk severity used across the workstation. */
export type RiskSeverity = "NONE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

/** Workstation-wide patient summary (360 view). */
export interface WorkstationPatient {
  readonly id: string;
  readonly nhsNumber: string;
  readonly displayName: string;
  readonly dateOfBirth: string;
  readonly gender: string;
  readonly pathway: ClinicalPathway;
  readonly riskSeverity: RiskSeverity;
  readonly riskScore: number;
  readonly assignedClinicianId: string;
  readonly lastContactedAt: string | null;
  readonly nextAppointmentAt: string | null;
  readonly activeMedications: readonly MedicationSummary[];
  readonly openAlerts: readonly ClinicalAlert[];
  readonly carePlanVersion: number;
}

/** Lightweight medication summary for dashboard cards. */
export interface MedicationSummary {
  readonly id: string;
  readonly name: string;
  readonly dosage: string;
  readonly frequency: string;
  readonly startedAt: string;
  readonly reviewDueAt: string | null;
  readonly titrationActive: boolean;
}

/** Clinical alert surfaced in the workstation (risk, safeguarding, etc.). */
export interface ClinicalAlert {
  readonly id: string;
  readonly kind: "RISK" | "SAFEGUARDING" | "MEDICATION_REVIEW" | "PHYSICAL_HEALTH" | "MISSED_APPOINTMENT";
  readonly severity: RiskSeverity;
  readonly title: string;
  readonly detail: string;
  readonly raisedAt: string;
  readonly acknowledgedBy?: string;
  readonly acknowledgedAt?: string;
}

/** Vitals observation for physical health monitoring. */
export interface VitalsObservation {
  readonly id: string;
  readonly patientId: string;
  readonly recordedAt: string;
  readonly systolicBp?: number;
  readonly diastolicBp?: number;
  readonly heartRate?: number;
  readonly temperature?: number;
  readonly weightKg?: number;
  readonly heightCm?: number;
  readonly oxygenSaturation?: number;
  readonly recordedBy: string;
}

/** Clinical note with versioning and signing workflow. */
export interface ClinicalNote {
  readonly id: string;
  readonly patientId: string;
  readonly authorId: string;
  readonly type: "CONSULTATION" | "PROGRESS" | "MEDICATION_REVIEW" | "RISK_REVIEW" | "SAFEGUARDING";
  readonly status: "DRAFT" | "PENDING_SIGN" | "SIGNED" | "AMENDED";
  readonly body: string;
  readonly version: number;
  readonly signedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Structured assessment response (ADHD/Autism instruments). */
export interface AssessmentResponse {
  readonly id: string;
  readonly patientId: string;
  readonly instrument: string;
  readonly answers: readonly number[];
  readonly totalScore: number;
  readonly interpretation: string;
  readonly completedAt: string;
  readonly completedBy: string;
}

/** Care plan item with tasks and outcomes. */
export interface CarePlanItem {
  readonly id: string;
  readonly patientId: string;
  readonly title: string;
  readonly description: string;
  readonly category: "MEDICATION" | "THERAPY" | "MONITORING" | "REFERRAL" | "LIFESTYLE";
  readonly priority: "ROUTINE" | "URGENT";
  readonly status: "ACTIVE" | "COMPLETED" | "SUSPENDED" | "CANCELLED";
  readonly targetDate: string | null;
  readonly completedAt: string | null;
  readonly ownerRole: string;
}

/** Appointment for clinician workstation scheduling. */
export interface WorkstationAppointment {
  readonly id: string;
  readonly patientId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly mode: "VIDEO" | "PHONE" | "IN_PERSON";
  readonly status: "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "DID_NOT_ATTEND";
  readonly reason: string;
  readonly locationOrLink: string;
}

/** Multidisciplinary team note / collaboration entry. */
export interface MdtNote {
  readonly id: string;
  readonly patientId: string;
  readonly authorId: string;
  readonly authorRole: string;
  readonly body: string;
  readonly visibleToTeam: boolean;
  readonly createdAt: string;
}

/** Paginated workstation list response. */
export interface Paginated<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

/** Typed service error carrying an HTTP status and a stable machine code. */
export class WorkstationError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "WorkstationError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Capability gates enforced by the workstation routes. */
export const WorkstationCapability = {
  READ_PATIENT: "patient:read",
  WRITE_CLINICAL: "clinical:write",
  WRITE_ASSESSMENT: "assessment:write",
  MANAGE_APPOINTMENT: "appointment:manage",
  READ_BILLING: "billing:read",
  WRITE_DOCUMENT: "document:write",
  USE_AI: "ai:use",
} as const;

export type WorkstationCapability = (typeof WorkstationCapability)[keyof typeof WorkstationCapability];
