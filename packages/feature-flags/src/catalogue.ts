/**
 * Typed feature flags for controlled rollout of NeuroCare OS.
 *
 * Resolution precedence (highest wins):
 *   1. KILL SWITCH  — an emergency, privileged off that overrides everything.
 *   2. USER override — per-user, for authorised testing (must be audited).
 *   3. ORG override — per-organisation.
 *   4. ENV config   — per-environment (e.g. NEUROCARE_FLAG_TITRATION_TRACKING=on).
 *   5. DEFAULT      — development default baked into the catalogue.
 *
 * Flags are enforced on the server; the client only uses them to render the
 * correct affordances. A flag being "hidden" in the UI is never a security
 * control — permissions are.
 */

export const featureFlags = [
  "unifiedApplicationShell",
  "patientWorkspace",
  "clinicianWorkstation",
  "adminControlCentre",
  "financeWorkspace",
  "unifiedPatientTimeline",
  "careJourneyEngine",
  "prescriptionTracking",
  "repeatPrescriptionRequests",
  "titrationWorkflow",
  "mdtWorkflow",
  "sharedCareWorkflow",
  "annualReviewWorkflow",
  "physicalHealthMonitoring",
  "documentGeneration",
  "appointmentSelfService",
  "paymentTracking",
  "complaintsWorkflow",
  "referralWorkflow",
  "intakeWorkflow",
  "adhdAssessmentWorkflow",
  "autismAssessmentWorkflow",
  "diagnosisWorkflow",
  "prescribingWorkflow",
  "courierTracking",
  "videoConsultations",
  "clinicalAiEnabled",
  "consultationTranscription",
  "liveConsultationAssistant",
  "clinicalNoteDrafting",
  "adhdReportDrafting",
  "autismReportDrafting",
  "messageReplyDrafting",
  "titrationNoteDrafting",
  "clinicalLetterDrafting",
  "transcriptEvidenceReview",
  "contradictionDetection",
  "missingInformationDetection",
  "aiSafetyLayer",
  "localModelProvider",
  "approvedCloudModelProvider",
  "aiAuditReview",
] as const;

export type FeatureFlag = (typeof featureFlags)[number];

const flagSet: ReadonlySet<string> = new Set(featureFlags);

export function isFeatureFlag(value: unknown): value is FeatureFlag {
  return typeof value === "string" && flagSet.has(value);
}

/** Human-facing description surfaced in the dev flag panel. Never shown to unauthorised users. */
export interface FlagDescriptor {
  readonly key: FeatureFlag;
  readonly label: string;
  readonly description: string;
  /** Development default. Production defaults are governed by env/org config. */
  readonly developmentDefault: boolean;
  /** When true, changing this flag writes an audit entry (privileged flag). */
  readonly privileged: boolean;
}

export const flagCatalogue: readonly FlagDescriptor[] = [
  {
    key: "unifiedApplicationShell",
    label: "Unified Application Shell",
    description:
      "Single authenticated shell with permission-based workstations",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "patientWorkspace",
    label: "Patient Workspace",
    description: "Patient self-service workspace",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "clinicianWorkstation",
    label: "Clinician Workstation",
    description: "Task-driven clinical workstation",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "adminControlCentre",
    label: "Admin Control Centre",
    description: "Operations, allocation and complaints",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "financeWorkspace",
    label: "Finance Workspace",
    description: "Invoices, payments, earnings, reconciliation",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "unifiedPatientTimeline",
    label: "Unified Patient Timeline",
    description: "Single normalised timeline across all events",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "careJourneyEngine",
    label: "Care Journey Engine",
    description: "Typed care-journey transitions with tasks and audit",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "prescriptionTracking",
    label: "Prescription Tracking",
    description: "Prescription fulfilment status tracking",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "repeatPrescriptionRequests",
    label: "Repeat Prescription Requests",
    description: "Patient repeat-request flow",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "titrationWorkflow",
    label: "Titration Workflow",
    description: "Structured titration decision branches",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "mdtWorkflow",
    label: "MDT Workflow",
    description: "MDT queue and outcome workflow",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "sharedCareWorkflow",
    label: "Shared Care Workflow",
    description: "GP shared-care agreements",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "annualReviewWorkflow",
    label: "Annual Review Workflow",
    description: "Annual review cycle",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "physicalHealthMonitoring",
    label: "Physical Health Monitoring",
    description: "Vitals and observation monitoring",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "documentGeneration",
    label: "Document Generation",
    description: "Report/letter generation from structured records",
    developmentDefault: false,
    privileged: true,
  },
  {
    key: "appointmentSelfService",
    label: "Appointment Self-Service",
    description: "Patient book/reschedule",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "paymentTracking",
    label: "Payment Tracking",
    description: "Patient invoice/payment visibility",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "complaintsWorkflow",
    label: "Complaints Workflow",
    description: "Complaints intake and workflow",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "referralWorkflow",
    label: "Referral Workflow",
    description: "Referral creation, validation and allocation",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "intakeWorkflow",
    label: "Intake Workflow",
    description: "Intake questionnaires and document collection",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "adhdAssessmentWorkflow",
    label: "ADHD Assessment Workflow",
    description: "ADHD assessment pathway",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "autismAssessmentWorkflow",
    label: "Autism Assessment Workflow",
    description: "Autism assessment pathway",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "diagnosisWorkflow",
    label: "Diagnosis Workflow",
    description: "Diagnostic review and outcome recording",
    developmentDefault: true,
    privileged: false,
  },
  {
    key: "prescribingWorkflow",
    label: "Prescribing Workflow",
    description: "Prescription authorisation and signing",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "courierTracking",
    label: "Courier Tracking",
    description: "Prescription delivery tracking",
    developmentDefault: false,
    privileged: false,
  },
  {
    key: "videoConsultations",
    label: "Video Consultations",
    description: "Live video consultation provider",
    developmentDefault: false,
    privileged: true,
  },
  {
    key: "clinicalAiEnabled",
    label: "Clinical AI",
    description: "Master switch for all assistive clinical AI",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "consultationTranscription",
    label: "Consultation Transcription",
    description: "Consent-gated transcript capture and processing",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "liveConsultationAssistant",
    label: "Live Consultation Assistant",
    description: "In-consultation prompts and structure tracking",
    developmentDefault: false,
    privileged: true,
  },
  {
    key: "clinicalNoteDrafting",
    label: "Clinical Note Drafting",
    description: "AI draft of structured clinical notes",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "adhdReportDrafting",
    label: "ADHD Report Drafting",
    description: "AI draft of ADHD diagnostic reports",
    developmentDefault: false,
    privileged: true,
  },
  {
    key: "autismReportDrafting",
    label: "Autism Report Drafting",
    description: "AI draft of Autism diagnostic reports",
    developmentDefault: false,
    privileged: true,
  },
  {
    key: "messageReplyDrafting",
    label: "Message Reply Drafting",
    description: "AI draft replies to patient messages",
    developmentDefault: false,
    privileged: true,
  },
  {
    key: "titrationNoteDrafting",
    label: "Titration Note Drafting",
    description: "AI draft of titration review notes",
    developmentDefault: false,
    privileged: true,
  },
  {
    key: "clinicalLetterDrafting",
    label: "Clinical Letter Drafting",
    description: "AI draft of GP/shared-care letters",
    developmentDefault: false,
    privileged: true,
  },
  {
    key: "transcriptEvidenceReview",
    label: "Transcript Evidence Review",
    description: "Sentence-level evidence linking in review UI",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "contradictionDetection",
    label: "Contradiction Detection",
    description: "Surface conflicting information to clinicians",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "missingInformationDetection",
    label: "Missing Information Detection",
    description: "Surface missing required information",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "aiSafetyLayer",
    label: "AI Safety Layer",
    description: "Deterministic post-generation safety checks",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "localModelProvider",
    label: "Local Model Provider",
    description: "On-premise/local model gateway target",
    developmentDefault: true,
    privileged: true,
  },
  {
    key: "approvedCloudModelProvider",
    label: "Approved Cloud Model Provider",
    description: "Approved external model gateway target",
    developmentDefault: false,
    privileged: true,
  },
  {
    key: "aiAuditReview",
    label: "AI Audit Review",
    description: "Governance view of AI drafting activity",
    developmentDefault: true,
    privileged: true,
  },
];
