/**
 * Persistence proof for DrizzleSliceStore (branch completion gate §37).
 *
 * Proves WRITE → READ BACK → RESTART → READ AGAIN for every migrated domain.
 *
 * Phase "write" seeds synthetic records through the real Drizzle store and
 * exits; the store instance is dropped. Phase "read" (a fresh test file
 * execution, i.e. a fresh process with fresh DB connections) re-reads every
 * seeded record through a newly constructed store — the "restart" in the
 * proof. Phase is selected with PERSISTENCE_PROOF_PHASE.
 * Skips cleanly when DATABASE_URL is not configured.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { describe, it, expect, beforeAll } from "vitest";
import type {
  AiDraft,
  ClinicalNote,
  ConsentRecord,
  IntakeSubmission,
  PatientRecord,
  ProfileRecord,
  Referral,
} from "./types";

const dbConfigured = !!process.env.DATABASE_URL;
const phase = process.env.PERSISTENCE_PROOF_PHASE ?? "write";
const seedFile = process.env.PERSISTENCE_PROOF_SEED ?? "/tmp/proof-seed.json";

// DrizzleSliceStore transitively imports @workspace/db, whose module init
// requires DATABASE_URL. Import lazily so machines without a provisioned
// database skip the suite instead of failing at module load.
const getStore = async () => {
  const mod = await import("./drizzle-store");
  return new mod.DrizzleSliceStore();
};

interface Seed {
  profileId: string;
  patientId: string;
  referralId: string;
  draftId: string;
  noteId: string;
}

const SYNTHETIC = {
  displayName: "Proof Patient (synthetic)",
  presentingConcern: "synthetic persistence proof",
  transcript: "synthetic transcript segment",
  bookmark: "key moment",
  note: "synthetic signed note",
  template: "PROOF_TEMPLATE",
};

describe.skipIf(!dbConfigured)(`persistence proof — ${phase}`, () => {
  if (phase === "write") {
    it("seeds every domain and reads each back in the same session", async () => {
      const store = await getStore();
      const profile: ProfileRecord = {
        id: `prof-${randomUUID().slice(0, 8)}`,
        displayName: SYNTHETIC.displayName,
        roles: ["PATIENT"],
      };
      await store.upsertProfile(profile);

      const patient: PatientRecord = await store.createPatient({
        id: `proof-${randomUUID().slice(0, 8)}`,
        profileId: profile.id,
        displayName: SYNTHETIC.displayName,
      });
      expect((await store.getPatient(patient.id))?.displayName).toBe(SYNTHETIC.displayName);
      expect((await store.findPatientByProfile(profile.id))?.id).toBe(patient.id);

      const referral: Referral = await store.createReferral({
        id: randomUUID(),
        patientId: patient.id,
        pathway: "ADHD",
        referralSource: "SELF",
        presentingConcern: SYNTHETIC.presentingConcern,
        validationStatus: "PENDING_VALIDATION",
        createdAt: new Date().toISOString(),
      });
      expect((await store.getReferral(referral.id))?.presentingConcern).toBe(
        SYNTHETIC.presentingConcern,
      );

      await store.createJourney(patient.id);
      await store.updateJourney(patient.id, { stage: "ASSESSMENT", version: 1 });
      const journey = await store.getJourney(patient.id);
      expect(journey?.stage).toBe("ASSESSMENT");
      expect(journey?.version).toBe(1);

      const intake: IntakeSubmission = {
        id: randomUUID(),
        referralId: referral.id,
        patientId: patient.id,
        answers: { currentDifficulties: "focus", childhoodDifficulties: "YES" },
        questionnaireScores: [{ instrument: "ASRS", score: 7 }],
        documentKinds: ["GP_SUMMARY"],
        submittedAt: new Date().toISOString(),
      };
      await store.saveIntake(intake);
      expect((await store.getIntake(referral.id))?.answers.childhoodDifficulties).toBe("YES");

      const consent: ConsentRecord = {
        id: randomUUID(),
        referralId: referral.id,
        patientId: patient.id,
        wordingVersion: "1.0",
        purpose: "ASSESSMENT",
        consentingParty: "PATIENT",
        clinicianProfileId: "clin-prov",
        recordedAt: new Date().toISOString(),
      };
      await store.createConsent(consent);
      expect((await store.getActiveConsent(referral.id))?.purpose).toBe("ASSESSMENT");

      await store.addSegments(referral.id, [
        {
          id: randomUUID(),
          speaker: "PATIENT",
          startMs: 0,
          endMs: 4000,
          text: SYNTHETIC.transcript,
          excluded: false,
        },
      ]);
      expect((await store.listSegments(referral.id))[0]?.text).toBe(SYNTHETIC.transcript);

      await store.addBookmark(referral.id, {
        id: randomUUID(),
        segmentId: "none",
        label: SYNTHETIC.bookmark,
        createdAt: new Date().toISOString(),
      });
      expect((await store.listBookmarks(referral.id))[0]?.label).toBe(SYNTHETIC.bookmark);

      await store.setConsultationState(referral.id, "DRAFT_READY");
      expect(await store.getConsultationState(referral.id)).toBe("DRAFT_READY");

      const draft: AiDraft = await store.createDraft({
        id: randomUUID(),
        referralId: referral.id,
        patientId: patient.id,
        status: "AI_DRAFT_REQUIRES_CLINICIAN_REVIEW",
        statements: [
          { id: "s1", text: "synthetic", classification: "CLINICIAN_ENTERED", sourceRefs: [] },
        ],
        missingInformation: [],
        conflicts: [],
        safetyFindings: [],
        version: 1,
        createdByProfileId: profile.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      expect((await store.getDraft(draft.id))?.status).toBe("AI_DRAFT_REQUIRES_CLINICIAN_REVIEW");

      const note: ClinicalNote = await store.createNote({
        id: randomUUID(),
        referralId: referral.id,
        patientId: patient.id,
        authorProfileId: profile.id,
        draftId: draft.id,
        body: SYNTHETIC.note,
        version: draft.version,
        signedAt: new Date().toISOString(),
      });
      expect((await store.getSignedNote(referral.id))?.body).toBe(SYNTHETIC.note);

      await store.updateDraft(draft.id, { status: "APPROVED", signedNoteId: note.id });
      expect((await store.getDraft(draft.id))?.signedNoteId).toBe(note.id);

      await store.createTasks([
        {
          id: randomUUID(),
          patientId: patient.id,
          type: "BOOK_APPOINTMENT",
          title: "book",
          status: "OPEN",
          createdAt: new Date().toISOString(),
        },
      ]);
      expect((await store.listOpenTasks(patient.id)).some((t) => t.type === "BOOK_APPOINTMENT")).toBe(
        true,
      );

      await store.appendTimeline({
        id: `${patient.id}:WORKFLOW_TRANSITION:${randomUUID()}`,
        type: "WORKFLOW_TRANSITION",
        occurredAt: new Date().toISOString(),
        recordedAt: new Date().toISOString(),
        title: "stage moved",
        visibility: "PATIENT",
        source: "persistence-proof",
        toStage: "ASSESSMENT",
      } as never);
      expect(
        (await store.listTimeline(patient.id)).some((e) => e.type === "WORKFLOW_TRANSITION"),
      ).toBe(true);

      await store.appendAudit({
        category: "JOURNEY",
        action: "persistence.proof",
        actor: { actorId: profile.id, roles: ["PATIENT"] },
        patientId: patient.id,
        metadata: { synthetic: true },
      } as never);
      expect((await store.listAudit()).some((e) => e.action === "persistence.proof")).toBe(true);

      await store.enqueueNotification({
        id: randomUUID(),
        patientId: patient.id,
        audience: "PATIENT",
        channel: "SYSTEM",
        template: SYNTHETIC.template,
        createdAt: new Date().toISOString(),
      });
      expect(
        (await store.listNotifications(patient.id)).some((n) => n.template === SYNTHETIC.template),
      ).toBe(true);

      const seed: Seed = {
        profileId: profile.id,
        patientId: patient.id,
        referralId: referral.id,
        draftId: draft.id,
        noteId: note.id,
      };
      writeFileSync(seedFile, JSON.stringify(seed));
    });
  }

  if (phase === "read") {
    beforeAll(() => {
      expect(
        existsSync(seedFile),
        "seed file missing — run the write phase first",
      ).toBe(true);
    });

    it("every domain survives a restart (fresh store, fresh connections)", async () => {
      const seed = JSON.parse(readFileSync(seedFile, "utf8")) as Seed;
      // Fresh process + newly constructed store = the "restart".
      const store = await getStore();

      expect((await store.getPatient(seed.patientId))?.displayName).toBe(SYNTHETIC.displayName);
      expect((await store.findPatientByProfile(seed.profileId))?.id).toBe(seed.patientId);
      expect((await store.getReferral(seed.referralId))?.presentingConcern).toBe(
        SYNTHETIC.presentingConcern,
      );
      expect((await store.getJourney(seed.patientId))?.stage).toBe("ASSESSMENT");
      expect((await store.getJourney(seed.patientId))?.version).toBe(1);
      expect((await store.getIntake(seed.referralId))?.answers.childhoodDifficulties).toBe("YES");
      expect((await store.getIntake(seed.referralId))?.questionnaireScores[0]?.instrument).toBe(
        "ASRS",
      );
      expect((await store.getActiveConsent(seed.referralId))?.purpose).toBe("ASSESSMENT");
      expect((await store.listSegments(seed.referralId))[0]?.text).toBe(SYNTHETIC.transcript);
      expect((await store.listBookmarks(seed.referralId))[0]?.label).toBe(SYNTHETIC.bookmark);
      expect(await store.getConsultationState(seed.referralId)).toBe("DRAFT_READY");
      const draft = await store.getDraft(seed.draftId);
      expect(draft?.status).toBe("APPROVED");
      expect(draft?.signedNoteId).toBe(seed.noteId);
      expect((await store.getSignedNote(seed.referralId))?.body).toBe(SYNTHETIC.note);
      expect((await store.getSignedNote(seed.referralId))?.version).toBe(1);
      expect((await store.listOpenTasks(seed.patientId)).some((t) => t.type === "BOOK_APPOINTMENT")).toBe(
        true,
      );
      expect(
        (await store.listTimeline(seed.patientId)).some((e) => e.type === "WORKFLOW_TRANSITION"),
      ).toBe(true);
      expect((await store.listAudit()).some((e) => e.action === "persistence.proof")).toBe(true);
      expect(
        (await store.listNotifications(seed.patientId)).some((n) => n.template === SYNTHETIC.template),
      ).toBe(true);
    });
  }
});
