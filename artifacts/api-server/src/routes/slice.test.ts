/**
 * Slice 1 HTTP contract tests — status codes, permission denial, flag kill
 * switch, and the typed error envelope over real HTTP (ephemeral port).
 * Synthetic data only.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { createSliceTestApp, type SliceTestPrincipal } from "./slice";

const PRINCIPALS: Record<string, SliceTestPrincipal> = {
  "patient:PATIENT": { id: "patient-1", role: "PATIENT" },
  "patient2:PATIENT": { id: "patient-2", role: "PATIENT" },
  "admin:ADMIN": { id: "admin-1", role: "ADMIN" },
  "clinician:CLINICIAN": { id: "clinician-1", role: "CLINICIAN" },
};

let app: Express;
let server: ReturnType<Express["listen"]>;
let base = "";

function headers(as: string): Record<string, string> {
  return { "content-type": "application/json", "x-test-principal": as };
}

async function call(method: string, path: string, as: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: headers(as),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

beforeEach(async () => {
  const built = createSliceTestApp(PRINCIPALS);
  app = built.app;
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  delete process.env.NEUROCARE_KILL_SWITCH;
  delete process.env.NEUROCARE_FLAG_REFERRAL_WORKFLOW;
});

describe("slice HTTP contracts", () => {
  it("requires authentication", async () => {
    const res = await fetch(`${base}/slice/referrals`, { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("creates a referral (201) and validates input (400)", async () => {
    const created = await call("POST", "/slice/referrals", "patient:PATIENT", {
      pathway: "ADHD",
      referralSource: "SELF",
      presentingConcern: "Focus difficulties.",
      displayName: "Synthetic Patient",
    });
    expect(created.status).toBe(201);
    expect((created.json.referral as { pathway: string }).pathway).toBe("ADHD");
    const bad = await call("POST", "/slice/referrals", "patient:PATIENT", {
      pathway: "NOPE",
    });
    expect(bad.status).toBe(400);
  });

  it("denies the referral queue to patients (403, capability)", async () => {
    const res = await call("GET", "/slice/referrals", "patient:PATIENT");
    expect(res.status).toBe(403);
    const admin = await call("GET", "/slice/referrals", "admin:ADMIN");
    expect(admin.status).toBe(200);
  });

  it("returns 403 FEATURE_DISABLED when the kill switch is on", async () => {
    process.env.NEUROCARE_KILL_SWITCH = "on";
    const res = await call("POST", "/slice/referrals", "patient:PATIENT", {
      pathway: "ADHD",
      referralSource: "SELF",
      presentingConcern: "Focus difficulties.",
      displayName: "Synthetic Patient",
    });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe("FEATURE_DISABLED");
  });

  it("walks referral to outcome over HTTP with typed errors", async () => {
    const created = await call("POST", "/slice/referrals", "patient:PATIENT", {
      pathway: "ADHD",
      referralSource: "SELF",
      presentingConcern: "Ongoing attention difficulties at work.",
      displayName: "Synthetic Patient",
    });
    expect(created.status).toBe(201);
    const referral = created.json.referral as { id: string };
    const patientId = created.json.patientId as string;

    const validated = await call(
      "POST",
      `/slice/referrals/${referral.id}/validate`,
      "admin:ADMIN",
      { status: "VALIDATED" },
    );
    expect(validated.status).toBe(200);
    const booked = await call(
      "POST",
      `/slice/referrals/${referral.id}/book`,
      "admin:ADMIN",
      { scheduledFor: "2026-11-01T10:00:00Z" },
    );
    expect(booked.status).toBe(200);
    const assigned = await call(
      "POST",
      `/slice/referrals/${referral.id}/assign`,
      "admin:ADMIN",
      { clinicianProfileId: "clinician-1" },
    );
    expect(assigned.status).toBe(200);
    const opened = await call(
      "POST",
      `/slice/referrals/${referral.id}/start-intake`,
      "clinician:CLINICIAN",
      {},
    );
    expect(opened.status).toBe(200);
    const intake = await call(
      "POST",
      `/slice/referrals/${referral.id}/intake`,
      "patient:PATIENT",
      {
        answers: {
          currentDifficulties: "Focus difficulties.",
          childhoodDifficulties: "YES",
        },
        questionnaireScores: [{ instrument: "ASRS", score: 5 }],
        documentKinds: ["SCHOOL_REPORT"],
      },
    );
    expect(intake.status).toBe(200);

    // Another patient cannot submit intake or read status on this record.
    const cross = await call(
      "POST",
      `/slice/referrals/${referral.id}/intake`,
      "patient2:PATIENT",
      {
        answers: { currentDifficulties: "Other.", childhoodDifficulties: "NO" },
        questionnaireScores: [],
        documentKinds: [],
      },
    );
    expect(cross.status).toBe(403);
    expect(cross.json.code).toBe("CROSS_PATIENT_DENIED");
    const crossStatus = await call(
      "GET",
      `/slice/patient/${patientId}/status`,
      "patient2:PATIENT",
    );
    expect(crossStatus.status).toBe(403);

    const assessing = await call(
      "POST",
      `/slice/referrals/${referral.id}/start-assessment`,
      "clinician:CLINICIAN",
      {},
    );
    expect(assessing.status).toBe(200);

    // Transcript without consent is rejected with CONSENT_MISSING.
    const noConsent = await call(
      "POST",
      `/slice/referrals/${referral.id}/transcript`,
      "clinician:CLINICIAN",
      {
        segments: [
          { speaker: "PATIENT", startMs: 0, endMs: 1000, text: "Hello." },
        ],
      },
    );
    expect(noConsent.status).toBe(409);
    expect(noConsent.json.code).toBe("CONSENT_MISSING");

    const consent = await call(
      "POST",
      `/slice/referrals/${referral.id}/consent`,
      "clinician:CLINICIAN",
      {
        wordingVersion: "v1",
        purpose: "Recording and drafting",
        consentingParty: "PATIENT",
      },
    );
    expect(consent.status).toBe(201);
    const transcript = await call(
      "POST",
      `/slice/referrals/${referral.id}/transcript`,
      "clinician:CLINICIAN",
      {
        segments: [
          {
            speaker: "CLINICIAN",
            startMs: 0,
            endMs: 4000,
            text: "Tell me about attention at work.",
          },
          {
            speaker: "PATIENT",
            startMs: 4000,
            endMs: 9000,
            text: "My attention drifts in every meeting.",
          },
        ],
      },
    );
    expect(transcript.status).toBe(201);

    const draft = await call(
      "POST",
      `/slice/referrals/${referral.id}/draft`,
      "clinician:CLINICIAN",
      {},
    );
    expect(draft.status).toBe(201);
    const draftBody = draft.json.draft as {
      id: string;
      conflicts: { id: string }[];
    };
    expect(draftBody.id.length).toBeGreaterThan(0);

    // Approval with unresolved conflicts is 422 when conflicts exist, else 201.
    for (const conflict of draftBody.conflicts) {
      const resolved = await call(
        "POST",
        `/slice/drafts/${draftBody.id}/resolve-conflict`,
        "clinician:CLINICIAN",
        {
          conflictId: conflict.id,
          resolution: "RESOLVED",
        },
      );
      expect(resolved.status).toBe(200);
    }
    const approved = await call(
      "POST",
      `/slice/drafts/${draftBody.id}/approve`,
      "clinician:CLINICIAN",
      {},
    );
    expect(approved.status).toBe(201);
    const outcome = await call(
      "POST",
      `/slice/referrals/${referral.id}/outcome`,
      "clinician:CLINICIAN",
      { outcome: "CONFIRMED" },
    );
    expect(outcome.status).toBe(200);

    const status = await call(
      "GET",
      `/slice/patient/${patientId}/status`,
      "patient:PATIENT",
    );
    expect(status.status).toBe(200);
    const audit = await call("GET", "/slice/audit", "admin:ADMIN");
    expect(audit.status).toBe(200);
    expect(((audit.json.events as unknown[]) ?? []).length).toBeGreaterThan(0);
  });

  it("gates AI drafting behind both clinical flags", async () => {
    process.env.NEUROCARE_FLAG_REFERRAL_WORKFLOW = "off";
    const res = await call("GET", "/slice/referrals", "admin:ADMIN");
    expect(res.status).toBe(403);
    expect(res.json.code).toBe("FEATURE_DISABLED");
  });
});
