/**
 * Slice 1 end-to-end test — the single Part-26 synthetic scenario:
 * patient requests ADHD assessment → admin triages and books → clinician
 * consults, drafts with AI assistance, reviews against evidence, signs,
 * and records the outcome. Synthetic data only.
 */
import { describe, expect, it } from "vitest";
import { InMemorySliceStore } from "./store";
import { SliceService } from "./service";
import type { SliceActor } from "./types";

const PATIENT: SliceActor = { actorId: "syn-patient", roles: ["PATIENT"] };
const ADMIN: SliceActor = { actorId: "syn-admin", roles: ["ADMIN"] };
const CLINICIAN: SliceActor = {
  actorId: "syn-clinician",
  roles: ["CLINICIAN"],
};

describe("slice end-to-end — referral to assessment", () => {
  it("completes the three-persona synthetic scenario", async () => {
    const store = new InMemorySliceStore();
    for (const [id, role] of [
      [PATIENT.actorId, "PATIENT"],
      [ADMIN.actorId, "ADMIN"],
      [CLINICIAN.actorId, "CLINICIAN"],
    ] as const) {
      store.upsertProfile({ id, displayName: id, roles: [role] });
    }
    const service = new SliceService(store);

    // 1. Patient: "I think I have ADHD — I want an assessment."
    const { referral, journey } = await service.requestAssessment(PATIENT, {
      pathway: "ADHD",
      referralSource: "SELF",
      presentingConcern:
        "Ongoing attention difficulties at work since childhood.",
      displayName: "Synthetic Patient",
    });
    expect(journey.stage).toBe("LEAD");

    // 2-4. Admin: validate, book, assign.
    service.validateReferral(ADMIN, referral.id, { status: "VALIDATED" });
    await service.bookFirstAppointment(ADMIN, referral.id, {
      scheduledFor: "2026-11-03T10:00:00Z",
    });
    const triaged = await service.assignClinician(
      ADMIN,
      referral.id,
      CLINICIAN.actorId,
    );
    expect(triaged.stage).toBe("TRIAGE");

    // 5-6. Clinician opens intake; patient completes it.
    await service.startIntake(CLINICIAN, referral.id);
    service.submitIntake(PATIENT, referral.id, {
      answers: {
        currentDifficulties: "Losing focus in meetings and missing deadlines.",
        childhoodDifficulties: "YES",
        educationSupport: "Extra time in exams.",
      },
      questionnaireScores: [
        { instrument: "ASRS", score: 5 },
        { instrument: "INFORMANT_ASRS", score: 4 },
      ],
      documentKinds: [
        "SCHOOL_REPORT",
        "GP_SUMMARY",
        "PHYSICAL_HEALTH_HISTORY",
        "INFORMANT_QUESTIONNAIRE",
      ],
    });

    // 7-9. Clinician: start assessment, record consent, ingest transcript.
    await service.startAssessment(CLINICIAN, referral.id);
    service.recordConsent(CLINICIAN, referral.id, {
      wordingVersion: "consent-v3",
      purpose: "Consultation recording and AI-assisted note drafting",
      consentingParty: "PATIENT",
    });
    const { segments, state } = service.ingestTranscript(
      CLINICIAN,
      referral.id,
      [
        {
          speaker: "CLINICIAN",
          startMs: 0,
          endMs: 5000,
          text: "Tell me about attention difficulties at work.",
          excluded: false,
        },
        {
          speaker: "PATIENT",
          startMs: 5000,
          endMs: 12000,
          text: "My attention drifts in long meetings and I miss actions.",
          excluded: false,
        },
        {
          speaker: "PATIENT",
          startMs: 12000,
          endMs: 18000,
          text: "At school I had extra time in exams for the same reason.",
          excluded: false,
        },
      ],
    );
    expect(segments.length).toBe(3);
    expect(state).toBe("DRAFT_READY");
    service.addBookmark(CLINICIAN, referral.id, {
      segmentId: segments[1]!.id,
      label: "Work impact",
    });

    // 10-11. AI draft (draft-only) → clinician review → sign.
    const draft = service.generateDraft(CLINICIAN, referral.id);
    expect(draft.status).toBe("AI_DRAFT_REQUIRES_CLINICIAN_REVIEW");
    expect(draft.statements.length).toBeGreaterThan(0);
    expect(draft.missingInformation).toEqual([]);
    for (const conflict of draft.conflicts) {
      service.resolveConflict(CLINICIAN, draft.id, conflict.id, "RESOLVED");
    }
    const { draft: approved, noteId } = service.approveDraft(
      CLINICIAN,
      draft.id,
    );
    expect(approved.status).toBe("APPROVED");
    expect(approved.signedNoteId).toBe(noteId);

    // 12. Outcome; 13-14. patient status + admin audit.
    const final = await service.recordOutcome(CLINICIAN, referral.id, {
      outcome: "CONFIRMED",
      diagnosisSummary: "Synthetic outcome for test purposes only.",
    });
    expect(final.stage).toBe("DIAGNOSIS_REVIEW");
    const status = service.getPatientStatus(PATIENT, referral.patientId);
    expect(status.stage).toBe("DIAGNOSIS_REVIEW");
    expect(status.plainStatus.length).toBeGreaterThan(0);
    expect(service.getAudit(ADMIN).length).toBeGreaterThan(10);
    expect(store.listTimeline(referral.patientId).length).toBeGreaterThan(5);
  });
});
