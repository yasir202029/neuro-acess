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
  "unifiedConsole",
  "patientMyCare",
  "clinicianWorkstation",
  "adminControlCentre",
  "financeWorkspace",
  "unifiedPatientTimeline",
  "workflowAutomation",
  "prescriptionTracking",
  "repeatPrescriptionRequests",
  "titrationSafetyBranching",
  "mdtEscalation",
  "sharedCareWorkflow",
  "annualReviewWorkflow",
  "advancedMonitoring",
  "documentGeneration",
  "appointmentSelfService",
  "paymentTracking",
  "complaintManagement",
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
  { key: "unifiedConsole", label: "Unified Console", description: "Single authenticated shell replacing role portals", developmentDefault: true, privileged: true },
  { key: "patientMyCare", label: "Patient — My Care", description: "Patient self-service workspace", developmentDefault: true, privileged: false },
  { key: "clinicianWorkstation", label: "Clinician Workstation", description: "Task-driven clinical workstation", developmentDefault: true, privileged: false },
  { key: "adminControlCentre", label: "Admin Control Centre", description: "Operations, allocation and complaints", developmentDefault: true, privileged: false },
  { key: "financeWorkspace", label: "Finance Workspace", description: "Invoices, payments, earnings, reconciliation", developmentDefault: true, privileged: false },
  { key: "unifiedPatientTimeline", label: "Unified Patient Timeline", description: "Single normalised timeline across all events", developmentDefault: true, privileged: false },
  { key: "workflowAutomation", label: "Workflow Automation", description: "Auto task/notification generation on transitions", developmentDefault: true, privileged: true },
  { key: "prescriptionTracking", label: "Prescription Tracking", description: "Prescription fulfilment status tracking", developmentDefault: true, privileged: false },
  { key: "repeatPrescriptionRequests", label: "Repeat Prescription Requests", description: "Patient repeat-request flow", developmentDefault: true, privileged: false },
  { key: "titrationSafetyBranching", label: "Titration Safety Branching", description: "Structured titration decision branches", developmentDefault: true, privileged: true },
  { key: "mdtEscalation", label: "MDT Escalation", description: "MDT queue and outcome workflow", developmentDefault: true, privileged: false },
  { key: "sharedCareWorkflow", label: "Shared Care Workflow", description: "GP shared-care agreements", developmentDefault: true, privileged: false },
  { key: "annualReviewWorkflow", label: "Annual Review Workflow", description: "Annual review cycle", developmentDefault: true, privileged: false },
  { key: "advancedMonitoring", label: "Advanced Monitoring", description: "Vitals and observation monitoring", developmentDefault: true, privileged: false },
  { key: "documentGeneration", label: "Document Generation", description: "Report/letter generation from structured records", developmentDefault: false, privileged: true },
  { key: "appointmentSelfService", label: "Appointment Self-Service", description: "Patient book/reschedule", developmentDefault: true, privileged: false },
  { key: "paymentTracking", label: "Payment Tracking", description: "Patient invoice/payment visibility", developmentDefault: true, privileged: false },
  { key: "complaintManagement", label: "Complaint Management", description: "Complaints intake and workflow", developmentDefault: true, privileged: false },
];
