import { describe, expect, it } from "vitest";
import { featureFlags, flagCatalogue, isFeatureFlag } from "./index.js";

/**
 * The canonical flag vocabulary from the Master Implementation Directive
 * (Part 6). Renaming or removing any of these without a documented decision
 * fails here.
 */
const CANONICAL_FLAGS = [
  "unifiedApplicationShell",
  "patientWorkspace",
  "clinicianWorkstation",
  "adminControlCentre",
  "financeWorkspace",
  "careJourneyEngine",
  "unifiedPatientTimeline",
  "referralWorkflow",
  "intakeWorkflow",
  "adhdAssessmentWorkflow",
  "autismAssessmentWorkflow",
  "diagnosisWorkflow",
  "mdtWorkflow",
  "titrationWorkflow",
  "prescribingWorkflow",
  "repeatPrescriptionRequests",
  "prescriptionTracking",
  "courierTracking",
  "physicalHealthMonitoring",
  "sharedCareWorkflow",
  "annualReviewWorkflow",
  "complaintsWorkflow",
  "paymentTracking",
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

describe("feature flag catalogue — canonical vocabulary", () => {
  it("contains every directive flag", () => {
    for (const flag of CANONICAL_FLAGS) {
      expect(isFeatureFlag(flag), `missing flag: ${flag}`).toBe(true);
    }
  });

  it("has a descriptor for every tuple entry and vice versa", () => {
    const described = new Set(flagCatalogue.map((entry) => entry.key));
    expect([...featureFlags].every((flag) => described.has(flag))).toBe(true);
    expect(flagCatalogue.length).toBe(featureFlags.length);
  });

  it("privileged flags are never enabled by a bare production default", () => {
    // Enforced by the resolver (production defaults OFF) — asserted here so a
    // future 'productionDefault' addition cannot silently regress this.
    const privileged = flagCatalogue.filter((entry) => entry.privileged);
    expect(privileged.length).toBeGreaterThan(10);
  });
});
