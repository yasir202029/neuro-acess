import { describe, it, expect } from "vitest";
import { ClinicalWorkstationService } from "./clinical-workstation.service";
import { WorkstationCapability } from "../types/clinical-workstation";

const PATIENT_ID = "11111111-1111-4111-8111-111111111111";

const actor = {
  actorId: "clinician-01",
  email: "clinician@example.com",
  roles: ["CLINICIAN"],
  clinicId: null,
  capabilities: new Set([
    WorkstationCapability.READ_PATIENT,
    WorkstationCapability.WRITE_CLINICAL,
    WorkstationCapability.WRITE_ASSESSMENT,
    WorkstationCapability.MANAGE_APPOINTMENT,
  ]) as unknown as ReadonlySet<WorkstationCapability>,
};

const req: any = { log: { info: () => {} }, user: {} };

describe("ClinicalWorkstationService", () => {
  const svc = new ClinicalWorkstationService();

  it("getPatient returns the synthetic 360 summary", async () => {
    const p = await svc.getPatient(actor, PATIENT_ID);
    expect(p.displayName).toBe("Maya Thompson");
    expect(p.pathway).toBe("ADHD");
    expect(p.riskSeverity).toBe("MODERATE");
    expect(p.activeMedications.length).toBe(1);
    expect(p.openAlerts.length).toBe(1);
  });

  it("getPatient rejects unknown id and bad uuid", async () => {
    await expect(svc.getPatient(actor, "00000000-0000-4000-8000-000000000000")).rejects.toThrow(/Patient not found/);
    await expect(svc.getPatient(actor, "not-a-uuid")).rejects.toThrow(/Invalid patient identifier/);
  });

  it("listPatients paginates and searches", async () => {
    const all = await svc.listPatients(actor, { page: 1, pageSize: 10 });
    expect(all.total).toBe(2);
    expect(all.items.length).toBe(2);
    const found = await svc.listPatients(actor, { page: 1, pageSize: 10, search: "Oliver" });
    expect(found.items.length).toBe(1);
    expect(found.items[0].displayName).toBe("Oliver Grant");
  });

  it("listPatients enforces capability", async () => {
    const noRead = { ...actor, capabilities: new Set() as unknown as ReadonlySet<WorkstationCapability> };
    await expect(svc.listPatients(noRead, {})).rejects.toThrow(/Capability required/);
  });

  it("createClinicalNote creates a DRAFT note", () => {
    const note = svc.createClinicalNote(actor, req, {
      patientId: PATIENT_ID,
      type: "CONSULTATION",
      body: "Patient presents with inattentive symptoms.",
    });
    expect(note.status).toBe("DRAFT");
    expect(note.version).toBe(1);
    expect(note.authorId).toBe("clinician-01");
    expect(() =>
      svc.createClinicalNote(actor, req, { patientId: "bad", type: "CONSULTATION", body: "x" }),
    ).toThrow(/Invalid patient identifier/);
  });

  it("submitAssessment validates answers and computes score", () => {
    const resp = svc.submitAssessment(actor, req, {
      patientId: PATIENT_ID,
      instrument: "ASRS",
      answers: [4, 5, 3],
      interpretation: "Elevated inattentive subtype.",
    });
    expect(resp.totalScore).toBe(12);
    expect(resp.instrument).toBe("ASRS");
    expect(() =>
      svc.submitAssessment(actor, req, {
        patientId: "bad",
        instrument: "ASRS",
        answers: [1],
        interpretation: "x",
      }),
    ).toThrow(/Invalid patient identifier/);
  });

  it("upsertCarePlanItem creates an active item", () => {
    const item = svc.upsertCarePlanItem(actor, req, {
      patientId: PATIENT_ID,
      title: "Titration review",
      description: "Review lisdexamfetamine dose.",
      category: "MEDICATION",
      priority: "URGENT",
      targetDate: null,
      ownerRole: "CLINICIAN",
    });
    expect(item.status).toBe("ACTIVE");
    expect(item.category).toBe("MEDICATION");
    expect(item.priority).toBe("URGENT");
  });

  it("createAppointment confirms and validates time range", () => {
    const appt = svc.createAppointment(actor, req, {
      patientId: PATIENT_ID,
      startsAt: "2026-10-22T14:00:00Z",
      endsAt: "2026-10-22T15:00:00Z",
      mode: "VIDEO",
      reason: "Follow-up",
      locationOrLink: "https://video.example/session",
    });
    expect(appt.status).toBe("CONFIRMED");
    expect(appt.mode).toBe("VIDEO");
    expect(() =>
      svc.createAppointment(actor, req, {
        patientId: PATIENT_ID,
        startsAt: "2026-10-22T15:00:00Z",
        endsAt: "2026-10-22T14:00:00Z",
        mode: "VIDEO",
        reason: "x",
        locationOrLink: "x",
      }),
    ).toThrow(/Provide a valid appointment/);
  });

  it("addMdtNote records a team collaboration entry", () => {
    const note = svc.addMdtNote(actor, req, {
      patientId: PATIENT_ID,
      body: "MDT agrees on shared-care pathway.",
      visibleToTeam: true,
    });
    expect(note.visibleToTeam).toBe(true);
    expect(note.authorRole).toBe("CLINICIAN");
  });

  it("acknowledgeAlert marks an alert acknowledged", async () => {
    const alert = await svc.acknowledgeAlert(actor, req, {
      patientId: PATIENT_ID,
      alertId: "alert-1",
    });
    expect(alert.acknowledgedBy).toBe("clinician-01");
    expect(alert.acknowledgedAt).toBeDefined();
    await expect(
      svc.acknowledgeAlert(actor, req, { patientId: "bad", alertId: "alert-1" }),
    ).rejects.toThrow(/Invalid patient identifier/);
    await expect(
      svc.acknowledgeAlert(actor, req, {
        patientId: "00000000-0000-4000-8000-000000000000",
        alertId: "alert-1",
      }),
    ).rejects.toThrow(/Patient not found/);
  });

  it("listVitals returns a time series", () => {
    const vitals = svc.listVitals(actor, PATIENT_ID);
    expect(vitals.length).toBe(10);
    expect(vitals[0].systolicBp).toBeGreaterThan(0);
  });
});
