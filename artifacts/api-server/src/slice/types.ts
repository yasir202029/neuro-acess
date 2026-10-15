/**
 * Slice 1 domain types — referral → assessment (docs/delivery/SLICE1_DESIGN.md).
 *
 * Synthetic development domain: no real patient data ever enters these
 * structures. Every string field is validated at the service/route boundary.
 */
import type { AuditActor } from "@neurocare/audit";
import type { CareStage } from "@neurocare/journey";

/** The authenticated principal for slice operations (server-derived). */
export type SliceActor = AuditActor;

export type Pathway = "ADHD" | "AUTISM" | "BOTH";
export type ReferralSource = "SELF" | "GP" | "OTHER";
export type ValidationStatus = "PENDING_VALIDATION" | "MISSING_INFORMATION" | "VALIDATED";

export interface PatientRecord {
  readonly id: string;
  /** Profile id of the owning user (the PATIENT principal). */
  readonly profileId: string;
  /** Synthetic display name only — never real patient data. */
  readonly displayName: string;
}

export interface ProfileRecord {
  readonly id: string;
  readonly displayName: string;
  readonly roles: readonly string[];
}

export interface Referral {
  readonly id: string;
  readonly patientId: string;
  readonly pathway: Pathway;
  readonly referralSource: ReferralSource;
  readonly presentingConcern: string;
  readonly validationStatus: ValidationStatus;
  readonly validationNote?: string;
  readonly assignedClinicianProfileId?: string;
  readonly appointmentId?: string;
  readonly createdAt: string;
}

export interface JourneySnapshot {
  readonly patientId: string;
  readonly stage: CareStage;
  readonly version: number;
  readonly hasAssignedClinician: boolean;
  readonly hasIntakeCompleted: boolean;
}

/** Controlled intake answer keys (synthetic questionnaire set). */
export interface IntakeAnswers {
  readonly currentDifficulties: string;
  readonly childhoodDifficulties: "YES" | "NO" | "UNCLEAR";
  readonly educationSupport?: string;
  readonly physicalHealth?: string;
}

export interface IntakeSubmission {
  readonly id: string;
  readonly referralId: string;
  readonly patientId: string;
  readonly answers: IntakeAnswers;
  readonly questionnaireScores: readonly { readonly instrument: string; readonly score: number }[];
  /** Kinds of supporting documents uploaded, e.g. SCHOOL_REPORT, GP_SUMMARY. */
  readonly documentKinds: readonly string[];
  readonly submittedAt: string;
}

export interface ConsentRecord {
  readonly id: string;
  readonly referralId: string;
  readonly patientId: string;
  readonly wordingVersion: string;
  readonly purpose: string;
  readonly consentingParty: "PATIENT" | "PROXY";
  readonly clinicianProfileId: string;
  readonly restrictions?: string;
  readonly recordedAt: string;
  readonly withdrawnAt?: string;
}

export type ConsultationState =
  | "NOT_STARTED"
  | "CONSENT_REQUIRED"
  | "READY"
  | "LISTENING"
  | "PAUSED"
  | "STOPPED"
  | "PROCESSING"
  | "DRAFT_READY"
  | "CLINICIAN_REVIEW"
  | "SIGNED"
  | "AMENDED"
  | "FAILED";

export type Speaker = "CLINICIAN" | "PATIENT";

export interface TranscriptSegment {
  readonly id: string;
  readonly speaker: Speaker;
  readonly startMs: number;
  readonly endMs: number;
  readonly text: string;
  readonly excluded: boolean;
}

export interface Bookmark {
  readonly id: string;
  readonly segmentId: string;
  readonly label: string;
  readonly createdAt: string;
}
export type EvidenceClass =
  | "DIRECT_TRANSCRIPT"
  | "STRUCTURED_RECORD"
  | "CLINICIAN_ENTERED"
  | "CALCULATED"
  | "TEMPLATE_LANGUAGE"
  | "AI_SYNTHESIS"
  | "UNSUPPORTED";

export interface DraftStatement {
  readonly id: string;
  readonly text: string;
  readonly classification: EvidenceClass;
  /** Segment ids or record paths backing this statement. */
  readonly sourceRefs: readonly string[];
}

export type ConflictResolution = "UNRESOLVED" | "ACCEPTED_AS_IS" | "RESOLVED";

export interface DraftConflict {
  readonly id: string;
  readonly description: string;
  readonly sourceRefs: readonly string[];
  readonly resolution: ConflictResolution;
  readonly resolvedBy?: string;
}

export type SafetyFindingKind =
  | "POTENTIAL_MEDICATION_DIRECTIVE"
  | "POTENTIAL_INSTRUCTION_IN_CONTENT"
  | "UNSUPPORTED_CLAIM";

export interface SafetyFinding {
  readonly id: string;
  readonly kind: SafetyFindingKind;
  readonly detail: string;
}

export type DraftStatus =
  | "AI_DRAFT_REQUIRES_CLINICIAN_REVIEW"
  | "AMENDED"
  | "APPROVED"
  | "REJECTED";

export interface AiDraft {
  readonly id: string;
  readonly referralId: string;
  readonly patientId: string;
  readonly status: DraftStatus;
  readonly statements: readonly DraftStatement[];
  readonly missingInformation: readonly string[];
  readonly conflicts: readonly DraftConflict[];
  readonly safetyFindings: readonly SafetyFinding[];
  readonly version: number;
  readonly createdByProfileId: string;
  readonly signedNoteId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClinicalNote {
  readonly id: string;
  readonly referralId: string;
  readonly patientId: string;
  readonly authorProfileId: string;
  readonly draftId: string;
  readonly body: string;
  readonly version: number;
  readonly signedAt: string;
}

export interface SliceTask {
  readonly id: string;
  readonly patientId: string;
  readonly type: string;
  readonly title: string;
  readonly assigneeRole?: string;
  readonly status: "OPEN" | "DONE";
  readonly createdAt: string;
}

export interface StoredTransition {
  readonly id: string;
  readonly patientId: string;
  readonly fromStage: string | null;
  readonly toStage: string;
  readonly command: string;
  readonly actorId: string;
  readonly reason?: string;
  readonly createdAt: string;
}

export interface NotificationRecord {
  readonly id: string;
  readonly patientId: string;
  readonly audience: string;
  readonly channel: string;
  readonly template: string;
  readonly createdAt: string;
}

/** Typed service error carrying an HTTP status and a stable machine code. */
export class SliceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "SliceError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

