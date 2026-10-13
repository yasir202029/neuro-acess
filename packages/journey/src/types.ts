/**
 * A transition command is a typed intention, never a direct database update.
 * The UI dispatches one of these; the engine validates and applies it inside a
 * single transaction. Each command carries the structured fields required to
 * satisfy the transition's `requiredFields` precondition.
 */
export const transitionCommands = [
  "REQUEST_ASSESSMENT", // LEAD (entry): create the lead from a referral/self-referral
  "BOOK_APPOINTMENT", // LEAD -> BOOKED
  "TRIAGE_CASE", // BOOKED -> TRIAGE (assign clinician)
  "START_ASSESSMENT", // TRIAGE -> ASSESSMENT
  "REQUEST_MORE_INFORMATION", // ASSESSMENT -> MORE_INFORMATION_REQUIRED
  "PROVIDE_INFORMATION", // MORE_INFORMATION_REQUIRED -> ASSESSMENT
  "REQUEST_ECG", // ASSESSMENT -> ECG_REQUESTED
  "PROVIDE_PHYSICAL_HEALTH", // ECG_REQUESTED -> ASSESSMENT
  "RECORD_ASSESSMENT_OUTCOME", // ASSESSMENT -> DIAGNOSIS (clinical authorisation)
  "RECORD_DIAGNOSIS_NOT_CONFIRMED", // ASSESSMENT -> DIAGNOSIS_NOT_CONFIRMED
  "ESCALATE_TO_MDT", // any clinical stage -> (task/queue only, stage unchanged)
  "START_TITRATION", // DIAGNOSIS -> TITRATION (clinical)
  "RECORD_TITRATION_REVIEW", // TITRATION -> TITRATION (loop) or -> PRESCRIBING
  "START_PRESCRIBING", // TITRATION -> PRESCRIBING (clinical)
  "READY_FOR_MAINTENANCE", // PRESCRIBING -> MAINTENANCE (clinical)
  "INITIATE_SHARED_CARE", // MAINTENANCE -> SHARED_CARE (clinical)
  "COMPLETE_SHARED_CARE", // SHARED_CARE -> MAINTENANCE (clinical)
  "START_ANNUAL_REVIEW", // MAINTENANCE -> ANNUAL_REVIEW (clinical)
  "COMPLETE_ANNUAL_REVIEW", // ANNUAL_REVIEW -> MAINTENANCE (clinical)
  "CLOSE_EPISODE", // any -> OUTCOME
  "DISCHARGE_PATIENT", // any -> DISCHARGE
] as const;

export type TransitionCommand = (typeof transitionCommands)[number];

export function isTransitionCommand(value: unknown): value is TransitionCommand {
  return typeof value === "string" && (transitionCommands as readonly string[]).includes(value);
}

/** Structured payloads. Each command maps to one payload shape. */
export interface RequestAssessmentPayload {
  readonly referralSource: "SELF" | "GP" | "OTHER";
  readonly presentingConcern: string;
  readonly requestedPathway: "ADHD" | "AUTISM" | "BOTH";
}
export interface BookAppointmentPayload {
  readonly appointmentId: string;
  readonly scheduledFor: string; // ISO-8601
}
export interface TriageCasePayload {
  readonly assignedClinicianId: string;
}
export interface RecordAssessmentOutcomePayload {
  readonly outcome: "CONFIRMED" | "NOT_CONFIRMED" | "PARTIAL";
  readonly diagnosisSummary?: string;
}
export interface RecordTitrationReviewPayload {
  readonly tolerated: boolean;
  readonly effective: boolean;
  readonly advance: boolean; // true => continue titration; false => ready for prescribing
}
export interface GenericReasonPayload {
  readonly reason: string;
}

/** Discriminated union of every valid transition request. */
export type TransitionRequest =
  | { readonly command: "REQUEST_ASSESSMENT"; readonly payload: RequestAssessmentPayload }
  | { readonly command: "BOOK_APPOINTMENT"; readonly payload: BookAppointmentPayload }
  | { readonly command: "TRIAGE_CASE"; readonly payload: TriageCasePayload }
  | { readonly command: "START_ASSESSMENT"; readonly payload: GenericReasonPayload }
  | { readonly command: "REQUEST_MORE_INFORMATION"; readonly payload: GenericReasonPayload }
  | { readonly command: "PROVIDE_INFORMATION"; readonly payload: GenericReasonPayload }
  | { readonly command: "REQUEST_ECG"; readonly payload: GenericReasonPayload }
  | { readonly command: "PROVIDE_PHYSICAL_HEALTH"; readonly payload: GenericReasonPayload }
  | { readonly command: "RECORD_ASSESSMENT_OUTCOME"; readonly payload: RecordAssessmentOutcomePayload }
  | { readonly command: "RECORD_DIAGNOSIS_NOT_CONFIRMED"; readonly payload: GenericReasonPayload }
  | { readonly command: "ESCALATE_TO_MDT"; readonly payload: GenericReasonPayload }
  | { readonly command: "START_TITRATION"; readonly payload: GenericReasonPayload }
  | { readonly command: "RECORD_TITRATION_REVIEW"; readonly payload: RecordTitrationReviewPayload }
  | { readonly command: "START_PRESCRIBING"; readonly payload: GenericReasonPayload }
  | { readonly command: "READY_FOR_MAINTENANCE"; readonly payload: GenericReasonPayload }
  | { readonly command: "INITIATE_SHARED_CARE"; readonly payload: GenericReasonPayload }
  | { readonly command: "COMPLETE_SHARED_CARE"; readonly payload: GenericReasonPayload }
  | { readonly command: "START_ANNUAL_REVIEW"; readonly payload: GenericReasonPayload }
  | { readonly command: "COMPLETE_ANNUAL_REVIEW"; readonly payload: GenericReasonPayload }
  | { readonly command: "CLOSE_EPISODE"; readonly payload: GenericReasonPayload }
  | { readonly command: "DISCHARGE_PATIENT"; readonly payload: GenericReasonPayload };

export type TransitionCommandOf<T extends TransitionCommand> = Extract<
  TransitionRequest,
  { command: T }
>;

// --- Effects produced by a successful transition --------------------------

export type TaskType =
  | "PENDING_NOTE"
  | "PENDING_REPORT"
  | "PENDING_PRESCRIPTION"
  | "MISSING_DOCUMENT"
  | "INTAKE"
  | "MDT_REVIEW"
  | "MONITORING"
  | "ADMIN";

export interface GeneratedTask {
  readonly type: TaskType;
  readonly title: string;
  readonly assigneeRole?: "CLINICIAN" | "ADMIN" | "NURSE" | "FINANCE" | "PRESCRIBER" | "PATIENT";
  readonly dueInDays?: number;
}

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS";

export interface GeneratedNotification {
  readonly audience: "PATIENT" | "ASSIGNED_CLINICIAN" | "ADMIN" | "MDT";
  readonly channel: NotificationChannel;
  readonly template: string;
}
