/**
 * Slice 1 domain tests — referral to assessment at the service layer.
 * Synthetic data only.
 */
import { describe, expect, it } from "vitest";
import { InMemorySliceStore } from "./store";
import { SliceService } from "./service";
import { SliceError, type SliceActor } from "./types";

const PATIENT: SliceActor = { actorId: "patient-1", roles: ["PATIENT"] };
const ADMIN: SliceActor = { actorId: "admin-1", roles: ["ADMIN"] };
const CLINICIAN: SliceActor = { actorId: "clinician-1", roles: ["CLINICIAN"] };

async function setup() {
  const store = new InMemorySliceStore();
  await store.upsertProfile({
    id: PATIENT.actorId,
    displayName: "P",
    roles: ["PATIENT"],
  });
  await store.upsertProfile({
    id: ADMIN.actorId,
    displayName: "A",
    roles: ["ADMIN"],
  });
  await store.upsertProfile({
    id: CLINICIAN.actorId,
    displayName: "C",
    roles: ["CLINICIAN"],
  });
  return { store, service: new SliceService(store) };
}

const INTAKE = {
  answers: {
    currentDifficulties: "Focus difficulties at work.",
    childhoodDifficulties: "YES" as const,
  },
  questionnaireScores: [{ instrument: "ASRS", score: 5 }],
  documentKinds: ["SCHOOL_REPORT", "GP_SUMMARY"],
};

async function request(service: SliceService) {
  return service.requestAssessment(PATIENT, {
    pathway: "ADHD",
    referralSource: "SELF",
    presentingConcern: "Focus difficulties.",
    displayName: "P",
  });
}

describe("slice service — referral lifecycle", () => {
  it("runs referral to assessment with audit and timeline", async () => {
    const { store, service } = await setup();
    const { referral, journey } = await request(service);
    expect(journey.stage).toBe("LEAD");
    await expect(request(service)).rejects.toMatchObject({
      status: 409,
      code: "REFERRAL_EXISTS",
    });
    const booked = await service.bookFirstAppointment(ADMIN, referral.id, {
      scheduledFor: "2026-11-01T10:00:00Z",
    });
    expect(booked.stage).toBe("BOOKED");
    const triaged = await service.assignClinician(
      ADMIN,
      referral.id,
      CLINICIAN.actorId,
    );
    expect(triaged.stage).toBe("TRIAGE");
    await expect(
      service.assignClinician(ADMIN, referral.id, "ghost"),
    ).rejects.toMatchObject({ status: 400, code: "UNKNOWN_CLINICIAN" });
    const opened = await service.startIntake(CLINICIAN, referral.id);
    expect(opened.stage).toBe("INTAKE");
    await service.submitIntake(PATIENT, referral.id, INTAKE);
    const assessing = await service.startAssessment(CLINICIAN, referral.id);
    expect(assessing.stage).toBe("ASSESSMENT");
    expect(
      (await store.listTransitions(referral.patientId)).length,
    ).toBeGreaterThanOrEqual(5);
    const status = await service.getPatientStatus(PATIENT, referral.patientId);
    expect(status.plainStatus.length).toBeGreaterThan(0);
    expect((await store.listAudit()).length).toBeGreaterThan(0);
    expect(
      (await store.listTimeline(referral.patientId)).length,
    ).toBeGreaterThan(0);
  });

  it("blocks START_ASSESSMENT until intake is completed", async () => {
    const { service } = await setup();
    const { referral } = await request(service);
    await service.bookFirstAppointment(ADMIN, referral.id, {
      scheduledFor: "2026-11-01T10:00:00Z",
    });
    await service.assignClinician(ADMIN, referral.id, CLINICIAN.actorId);
    await service.startIntake(CLINICIAN, referral.id);
    await expect(
      service.startAssessment(CLINICIAN, referral.id),
    ).rejects.toMatchObject({ status: 409, code: "JOURNEY_REJECTED" });
  });
});

describe("slice service — isolation and permissions", () => {
  it("enforces own-record access and cross-patient isolation", async () => {
    const { store, service } = await setup();
    const other: SliceActor = { actorId: "patient-2", roles: ["PATIENT"] };
    await store.upsertProfile({
      id: other.actorId,
      displayName: "Other",
      roles: ["PATIENT"],
    });
    const { referral } = await request(service);
    await expect(
      service.submitIntake(other, referral.id, INTAKE),
    ).rejects.toMatchObject({ status: 403, code: "CROSS_PATIENT_DENIED" });
    await expect(
      service.getPatientStatus(other, referral.patientId),
    ).rejects.toThrowError(SliceError);
  });

  it("denies actions without the capability", async () => {
    const { store, service } = await setup();
    const { referral } = await request(service);
    // Per the permission matrix, patients may book their OWN appointment
    // (appointment:manage + ownership) but cannot triage, start intake, or draft.
    const ownBooking = await service.bookFirstAppointment(
      PATIENT,
      referral.id,
      { scheduledFor: "2026-11-01T10:00:00Z" },
    );
    expect(ownBooking.stage).toBe("BOOKED");
    const other: SliceActor = { actorId: "patient-2", roles: ["PATIENT"] };
    await store.upsertProfile({
      id: other.actorId,
      displayName: "Other",
      roles: ["PATIENT"],
    });
    await expect(
      service.bookFirstAppointment(other, referral.id, {
        scheduledFor: "2026-11-01T10:00:00Z",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.assignClinician(PATIENT, referral.id, CLINICIAN.actorId),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.startIntake(PATIENT, referral.id),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      (async () => service.generateDraft(ADMIN, referral.id))(),
    ).rejects.toMatchObject({ status: 403 });
  });
});

const SEGMENTS = [
  {
    speaker: "CLINICIAN" as const,
    startMs: 0,
    endMs: 4000,
    text: "Tell me about focus at work.",
    excluded: false,
  },
  {
    speaker: "PATIENT" as const,
    startMs: 4000,
    endMs: 9000,
    text: "I lose focus in long meetings.",
    excluded: false,
  },
];

async function toAssessment(service: SliceService) {
  const { referral } = await request(service);
  await service.bookFirstAppointment(ADMIN, referral.id, {
    scheduledFor: "2026-11-01T10:00:00Z",
  });
  await service.assignClinician(ADMIN, referral.id, CLINICIAN.actorId);
  await service.startIntake(CLINICIAN, referral.id);
  await service.submitIntake(PATIENT, referral.id, INTAKE);
  await service.startAssessment(CLINICIAN, referral.id);
  return referral;
}

describe("slice service — consultation and AI gating", () => {
  it("requires consent before transcript and draft", async () => {
    const { service } = await setup();
    const referral = await toAssessment(service);
    await expect(
      service.ingestTranscript(CLINICIAN, referral.id, SEGMENTS),
    ).rejects.toMatchObject({ status: 409, code: "CONSENT_MISSING" });
    await expect(
      service.generateDraft(CLINICIAN, referral.id),
    ).rejects.toMatchObject({ status: 409, code: "CONSENT_MISSING" });
    const consent = await service.recordConsent(CLINICIAN, referral.id, {
      wordingVersion: "v1",
      purpose: "Consultation recording and AI-assisted drafting",
      consentingParty: "PATIENT",
    });
    expect(consent.wordingVersion).toBe("v1");
    await expect(
      service.recordConsent(CLINICIAN, referral.id, {
        wordingVersion: "v1",
        purpose: "Again",
        consentingParty: "PATIENT",
      }),
    ).rejects.toMatchObject({ status: 409, code: "CONSENT_EXISTS" });
  });

  it("blocks approval while unsupported statements or conflicts remain", async () => {
    const { service } = await setup();
    const referral = await toAssessment(service);
    await service.recordConsent(CLINICIAN, referral.id, {
      wordingVersion: "v1",
      purpose: "Recording and drafting",
      consentingParty: "PATIENT",
    });
    await service.ingestTranscript(CLINICIAN, referral.id, SEGMENTS);
    const draft = await service.generateDraft(CLINICIAN, referral.id);
    expect(draft.status).toBe("AI_DRAFT_REQUIRES_CLINICIAN_REVIEW");
    expect(draft.missingInformation.length).toBeGreaterThan(0);
    for (const conflict of draft.conflicts) {
      await service.resolveConflict(
        CLINICIAN,
        draft.id,
        conflict.id,
        "RESOLVED",
      );
    }
    const { noteId } = await service.approveDraft(CLINICIAN, draft.id);
    expect(noteId.length).toBeGreaterThan(0);
    await expect(
      service.recordOutcome(CLINICIAN, referral.id, { outcome: "CONFIRMED" }),
    ).resolves.toMatchObject({ stage: "DIAGNOSIS_REVIEW" });
  });

  it("requires a signed note before recording the outcome", async () => {
    const { service } = await setup();
    const referral = await toAssessment(service);
    await expect(
      service.recordOutcome(CLINICIAN, referral.id, { outcome: "CONFIRMED" }),
    ).rejects.toMatchObject({ status: 409, code: "SIGNED_NOTE_REQUIRED" });
  });
});
