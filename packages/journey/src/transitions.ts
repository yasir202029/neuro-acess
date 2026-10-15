import type { Capability } from "@neurocare/permissions";
import type { CareStage } from "./stages.js";
import type { GeneratedNotification, GeneratedTask, TransitionCommand } from "./types.js";

/**
 * Facts about a patient the engine can inspect when validating a transition.
 * Supplied by the caller (the workflow-engine reads these from the DB). Keeping
 * this a plain data shape makes the journey package pure and unit-testable
 * without a database.
 */
export interface JourneyFacts {
  readonly currentStage: CareStage;
  readonly hasAssignedClinician: boolean;
  readonly hasIntakeCompleted: boolean;
  readonly openTaskTypes: readonly string[];
  readonly version: number; // optimistic-concurrency token
}

export type BlockingCondition =
  | "REQUIRES_ASSIGNED_CLINICIAN"
  | "REQUIRES_INTAKE_COMPLETED"
  | "REQUIRES_NO_OPEN_BLOCKERS";

export type RollbackPolicy =
  | "IRREVERSIBLE"
  | "CORRECTION_REQUIRED"
  | "FORWARD_ONLY";

export interface TransitionDefinition {
  readonly command: TransitionCommand;
  readonly from: readonly CareStage[] | null;
  readonly to: CareStage | null;
  readonly capability: Capability;
  readonly clinicalAuthorisation: boolean;
  readonly blocking: readonly BlockingCondition[];
  readonly generatesTasks: readonly GeneratedTask[];
  readonly notifications: readonly GeneratedNotification[];
  readonly auditAction: string;
  readonly rollback: RollbackPolicy;
  readonly patientLabel: string;
}

/**
 * The single declarative transition table. The engine is driven entirely by
 * this table — adding a workflow never means editing the engine, only this data.
 */
export const transitionTable: Readonly<Record<TransitionCommand, TransitionDefinition>> = {
  REQUEST_ASSESSMENT: {
    command: "REQUEST_ASSESSMENT",
    from: null,
    to: "LEAD",
    capability: "patient:write",
    clinicalAuthorisation: false,
    blocking: [],
    generatesTasks: [{ type: "INTAKE", title: "Complete intake questionnaire", assigneeRole: "PATIENT", dueInDays: 7 }],
    notifications: [{ audience: "PATIENT", channel: "EMAIL", template: "referral_received" }],
    auditAction: "journey.referral.requested",
    rollback: "FORWARD_ONLY",
    patientLabel: "We received your request for an assessment",
  },
  BOOK_APPOINTMENT: {
    command: "BOOK_APPOINTMENT",
    from: ["LEAD"],
    to: "BOOKED",
    capability: "appointment:manage",
    clinicalAuthorisation: false,
    blocking: [],
    generatesTasks: [],
    notifications: [{ audience: "PATIENT", channel: "EMAIL", template: "appointment_booked" }],
    auditAction: "journey.appointment.booked",
    rollback: "FORWARD_ONLY",
    patientLabel: "Your first appointment is booked",
  },
  TRIAGE_CASE: {
    command: "TRIAGE_CASE",
    from: ["BOOKED"],
    to: "TRIAGE",
    capability: "user:manage",
    clinicalAuthorisation: false,
    blocking: [],
    generatesTasks: [{ type: "ADMIN", title: "Confirm triage and clinical pathway", assigneeRole: "ADMIN", dueInDays: 2 }],
    notifications: [{ audience: "ASSIGNED_CLINICIAN", channel: "IN_APP", template: "case_assigned" }],
    auditAction: "journey.case.triaged",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "Your case is being prepared for your clinician",
  },
  START_INTAKE: {
    command: "START_INTAKE",
    from: ["TRIAGE"],
    to: "INTAKE",
    capability: "clinical:write",
    clinicalAuthorisation: false,
    blocking: ["REQUIRES_ASSIGNED_CLINICIAN"],
    generatesTasks: [{ type: "INTAKE", title: "Complete intake questionnaire", assigneeRole: "PATIENT", dueInDays: 7 }],
    notifications: [{ audience: "PATIENT", channel: "IN_APP", template: "assessment_started" }],
    auditAction: "journey.intake.started",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "Please complete your intake information",
  },
  START_ASSESSMENT: {
    command: "START_ASSESSMENT",
    from: ["INTAKE"],
    to: "ASSESSMENT",
    capability: "clinical:write",
    clinicalAuthorisation: false,
    blocking: ["REQUIRES_ASSIGNED_CLINICIAN", "REQUIRES_INTAKE_COMPLETED"],
    generatesTasks: [{ type: "INTAKE", title: "Assign ADHD/Autism questionnaires", assigneeRole: "CLINICIAN", dueInDays: 3 }],
    notifications: [{ audience: "PATIENT", channel: "IN_APP", template: "assessment_started" }],
    auditAction: "journey.assessment.started",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "Your assessment has started",
  },
  RECORD_ASSESSMENT_OUTCOME: {
    command: "RECORD_ASSESSMENT_OUTCOME",
    from: ["ASSESSMENT"],
    to: "DIAGNOSIS_REVIEW",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [],
    notifications: [],
    auditAction: "journey.assessment.outcome_recorded",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "Your assessment outcome is being finalised",
  },
  CONFIRM_DIAGNOSIS: {
    command: "CONFIRM_DIAGNOSIS",
    from: ["DIAGNOSIS_REVIEW"],
    to: "DIAGNOSIS_CONFIRMED",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [{ type: "PENDING_REPORT", title: "Generate diagnostic report", assigneeRole: "CLINICIAN", dueInDays: 5 }],
    notifications: [{ audience: "PATIENT", channel: "IN_APP", template: "outcome_recorded" }],
    auditAction: "journey.diagnosis.confirmed",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "Your assessment outcome has been recorded",
  },
  RECORD_DIAGNOSIS_NOT_CONFIRMED: {
    command: "RECORD_DIAGNOSIS_NOT_CONFIRMED",
    from: ["DIAGNOSIS_REVIEW"],
    to: "DIAGNOSIS_NOT_CONFIRMED",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [{ type: "PENDING_REPORT", title: "Issue outcome letter", assigneeRole: "CLINICIAN", dueInDays: 5 }],
    notifications: [{ audience: "PATIENT", channel: "IN_APP", template: "outcome_recorded" }],
    auditAction: "journey.assessment.outcome_not_confirmed",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "Your assessment outcome has been recorded",
  },
  REQUEST_MORE_INFORMATION: {
    command: "REQUEST_MORE_INFORMATION",
    from: ["ASSESSMENT"],
    to: "MORE_INFORMATION_REQUIRED",
    capability: "assessment:write",
    clinicalAuthorisation: false,
    blocking: [],
    generatesTasks: [{ type: "MISSING_DOCUMENT", title: "Awaiting additional information", assigneeRole: "PATIENT", dueInDays: 14 }],
    notifications: [{ audience: "PATIENT", channel: "IN_APP", template: "more_information_required" }],
    auditAction: "journey.more_information.requested",
    rollback: "FORWARD_ONLY",
    patientLabel: "We need a little more information from you",
  },
  PROVIDE_INFORMATION: {
    command: "PROVIDE_INFORMATION",
    from: ["MORE_INFORMATION_REQUIRED"],
    to: "ASSESSMENT",
    capability: "document:write",
    clinicalAuthorisation: false,
    blocking: [],
    generatesTasks: [],
    notifications: [{ audience: "ASSIGNED_CLINICIAN", channel: "IN_APP", template: "information_received" }],
    auditAction: "journey.more_information.provided",
    rollback: "FORWARD_ONLY",
    patientLabel: "Thank you — we received your information",
  },
  REQUEST_ECG: {
    command: "REQUEST_ECG",
    from: ["ASSESSMENT"],
    to: "ECG_REQUESTED",
    capability: "assessment:write",
    clinicalAuthorisation: false,
    blocking: [],
    generatesTasks: [{ type: "MISSING_DOCUMENT", title: "Awaiting physical-health / ECG results", assigneeRole: "PATIENT", dueInDays: 21 }],
    notifications: [{ audience: "PATIENT", channel: "EMAIL", template: "ecg_requested" }],
    auditAction: "journey.ecg.requested",
    rollback: "FORWARD_ONLY",
    patientLabel: "We have requested some health checks before medication",
  },
  PROVIDE_PHYSICAL_HEALTH: {
    command: "PROVIDE_PHYSICAL_HEALTH",
    from: ["ECG_REQUESTED"],
    to: "ASSESSMENT",
    capability: "document:write",
    clinicalAuthorisation: false,
    blocking: [],
    generatesTasks: [],
    notifications: [{ audience: "ASSIGNED_CLINICIAN", channel: "IN_APP", template: "physical_health_received" }],
    auditAction: "journey.physical_health.provided",
    rollback: "FORWARD_ONLY",
    patientLabel: "Thank you — your health checks have been received",
  },
  ESCALATE_TO_MDT: {
    command: "ESCALATE_TO_MDT",
    from: ["ASSESSMENT", "DIAGNOSIS_REVIEW", "DIAGNOSIS_CONFIRMED", "TITRATION", "PRESCRIBING", "MAINTENANCE", "SHARED_CARE", "ANNUAL_REVIEW", "MORE_INFORMATION_REQUIRED", "ECG_REQUESTED"],
    to: "MDT_REVIEW",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [{ type: "MDT_REVIEW", title: "MDT review requested", assigneeRole: "CLINICIAN", dueInDays: 7 }],
    notifications: [{ audience: "MDT", channel: "IN_APP", template: "mdt_escalation" }],
    auditAction: "journey.mdt.escalated",
    rollback: "FORWARD_ONLY",
    patientLabel: "Your case has been discussed by the clinical team",
  },
  RESUME_FROM_MDT: {
    command: "RESUME_FROM_MDT",
    from: ["MDT_REVIEW"],
    to: "DIAGNOSIS_REVIEW",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [],
    notifications: [{ audience: "ASSIGNED_CLINICIAN", channel: "IN_APP", template: "mdt_outcome_recorded" }],
    auditAction: "journey.mdt.resumed",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "The clinical team has completed its review",
  },
  START_TITRATION: {
    command: "START_TITRATION",
    from: ["DIAGNOSIS_CONFIRMED"],
    to: "TITRATION",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [
      { type: "MONITORING", title: "Record baseline observations", assigneeRole: "PATIENT", dueInDays: 3 },
      { type: "PENDING_PRESCRIPTION", title: "Issue first titration prescription", assigneeRole: "PRESCRIBER", dueInDays: 2 },
    ],
    notifications: [{ audience: "PATIENT", channel: "IN_APP", template: "titration_started" }],
    auditAction: "journey.titration.started",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "Your medication titration has started",
  },
  RECORD_TITRATION_REVIEW: {
    command: "RECORD_TITRATION_REVIEW",
    from: ["TITRATION"],
    to: null, // engine chooses PRESCRIBING when advance=false, else stays TITRATION
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [],
    notifications: [],
    auditAction: "journey.titration.review_recorded",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "A medication review was recorded",
  },
  START_PRESCRIBING: {
    command: "START_PRESCRIBING",
    from: ["TITRATION"],
    to: "PRESCRIBING",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [{ type: "PENDING_PRESCRIPTION", title: "Issue maintenance prescription", assigneeRole: "PRESCRIBER", dueInDays: 7 }],
    notifications: [{ audience: "PATIENT", channel: "IN_APP", template: "prescribing_started" }],
    auditAction: "journey.prescribing.started",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "You have moved to stable prescribing",
  },
  READY_FOR_MAINTENANCE: {
    command: "READY_FOR_MAINTENANCE",
    from: ["PRESCRIBING"],
    to: "MAINTENANCE",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [{ type: "MONITORING", title: "Schedule periodic monitoring", assigneeRole: "NURSE", dueInDays: 90 }],
    notifications: [{ audience: "PATIENT", channel: "IN_APP", template: "maintenance_started" }],
    auditAction: "journey.maintenance.started",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "Your treatment is stable — welcome to maintenance",
  },
  INITIATE_SHARED_CARE: {
    command: "INITIATE_SHARED_CARE",
    from: ["MAINTENANCE"],
    to: "SHARED_CARE",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [{ type: "PENDING_REPORT", title: "Prepare shared-care agreement", assigneeRole: "CLINICIAN", dueInDays: 10 }],
    notifications: [{ audience: "ADMIN", channel: "IN_APP", template: "shared_care_initiated" }],
    auditAction: "journey.shared_care.initiated",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "We are setting up shared care with your GP",
  },
  COMPLETE_SHARED_CARE: {
    command: "COMPLETE_SHARED_CARE",
    from: ["SHARED_CARE"],
    to: "MAINTENANCE",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [],
    notifications: [{ audience: "PATIENT", channel: "IN_APP", template: "shared_care_complete" }],
    auditAction: "journey.shared_care.completed",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "Shared care with your GP is in place",
  },
  START_ANNUAL_REVIEW: {
    command: "START_ANNUAL_REVIEW",
    from: ["MAINTENANCE"],
    to: "ANNUAL_REVIEW",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [{ type: "MONITORING", title: "Complete annual review", assigneeRole: "CLINICIAN", dueInDays: 30 }],
    notifications: [{ audience: "PATIENT", channel: "EMAIL", template: "annual_review_started" }],
    auditAction: "journey.annual_review.started",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "It is time for your annual review",
  },
  COMPLETE_ANNUAL_REVIEW: {
    command: "COMPLETE_ANNUAL_REVIEW",
    from: ["ANNUAL_REVIEW"],
    to: "MAINTENANCE",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [],
    notifications: [{ audience: "PATIENT", channel: "IN_APP", template: "annual_review_complete" }],
    auditAction: "journey.annual_review.completed",
    rollback: "CORRECTION_REQUIRED",
    patientLabel: "Your annual review is complete",
  },
  CLOSE_EPISODE: {
    command: "CLOSE_EPISODE",
    from: ["ASSESSMENT", "DIAGNOSIS_REVIEW", "DIAGNOSIS_CONFIRMED", "DIAGNOSIS_NOT_CONFIRMED", "TITRATION", "PRESCRIBING", "MAINTENANCE", "SHARED_CARE", "ANNUAL_REVIEW", "MORE_INFORMATION_REQUIRED", "ECG_REQUESTED", "MDT_REVIEW"],
    to: "OUTCOME",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [],
    notifications: [{ audience: "PATIENT", channel: "EMAIL", template: "episode_closed" }],
    auditAction: "journey.episode.closed",
    rollback: "IRREVERSIBLE",
    patientLabel: "Your episode of care has been closed",
  },
  DISCHARGE_PATIENT: {
    command: "DISCHARGE_PATIENT",
    from: ["OUTCOME", "MAINTENANCE", "SHARED_CARE", "ANNUAL_REVIEW", "DIAGNOSIS_NOT_CONFIRMED", "DIAGNOSIS_CONFIRMED"],
    to: "DISCHARGE",
    capability: "clinical:write",
    clinicalAuthorisation: true,
    blocking: [],
    generatesTasks: [],
    notifications: [{ audience: "PATIENT", channel: "EMAIL", template: "discharged" }],
    auditAction: "journey.patient.discharged",
    rollback: "IRREVERSIBLE",
    patientLabel: "You have been discharged back to your GP",
  },
};
