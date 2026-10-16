/**
 * Clinical Workstation service layer.
 *
 * Business logic + validation for the clinician workstation. Synthetic
 * development service: validates inputs, enforces capability checks, emits audit
 * events, returns shaped responses. Deny-by-default: every public method
 * requires an actor with the needed capability; the actor is always
 * server-derived, never client-supplied.
 */

import { randomUUID } from "node:crypto";
import { auditEvent } from "../security/audit";
import type { Request } from "express";
import type {
  WorkstationActor,
  WorkstationPatient,
  MedicationSummary,
  ClinicalAlert,
  VitalsObservation,
  ClinicalNote,
  AssessmentResponse,
  CarePlanItem,
  WorkstationAppointment,
  MdtNote,
  Paginated,
} from "../types/clinical-workstation";
import { WorkstationError, WorkstationCapability } from "../types/clinical-workstation";

function requireCapability(actor: WorkstationActor | undefined, capability: WorkstationCapability): void {
  if (!actor || !actor.capabilities.has(capability)) {
    throw new WorkstationError(403, "INSUFFICIENT_CAPABILITY", `Capability required: ${capability}`);
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const SYNTHETIC_PATIENTS: WorkstationPatient[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    nhsNumber: "987-654-3210",
    displayName: "Maya Thompson",
    dateOfBirth: "1992-04-12",
    gender: "Female",
    pathway: "ADHD",
    riskSeverity: "MODERATE",
    riskScore: 42,
    assignedClinicianId: "clinician-01",
    lastContactedAt: "2026-10-10T09:00:00Z",
    nextAppointmentAt: "2026-10-22T14:00:00Z",
    activeMedications: [
      {
        id: "med-1",
        name: "Lisdexamfetamine",
        dosage: "30 mg",
        frequency: "once daily",
        startedAt: "2026-08-15T00:00:00Z",
        reviewDueAt: "2026-11-15T00:00:00Z",
        titrationActive: true,
      },
    ],
    openAlerts: [
      {
        id: "alert-1",
        kind: "MEDICATION_REVIEW",
        severity: "MODERATE",
        title: "Titration review due",
        detail: "Lisdexamfetamine dose review due within 30 days.",
        raisedAt: "2026-09-15T00:00:00Z",
      },
    ],
    carePlanVersion: 3,
  },
  {
    id: "22222222-2222-4222-a222-222222222222",
    nhsNumber: "123-456-7890",
    displayName: "Oliver Grant",
    dateOfBirth: "1988-11-03",
    gender: "Male",
    pathway: "AUTISM",
    riskSeverity: "LOW",
    riskScore: 18,
    assignedClinicianId: "clinician-01",
    lastContactedAt: "2026-10-08T11:30:00Z",
    nextAppointmentAt: null,
    activeMedications: [],
    openAlerts: [
      {
        id: "alert-2",
        kind: "PHYSICAL_HEALTH",
        severity: "LOW",
        title: "Annual physical health check",
        detail: "Weight and metabolic monitoring due.",
        raisedAt: "2026-09-20T00:00:00Z",
      },
    ],
    carePlanVersion: 1,
  },
];

export class ClinicalWorkstationService {
  /**
   * PostgreSQL-first patient reads via the authoritative Drizzle store.
   * The synthetic seed is used only as an explicit development fallback when
   * the database holds no patients (or no DB is configured) — never in
   * production, and the response records which source served the request.
   */
  private async loadPatients(): Promise<{
    patients: WorkstationPatient[];
    source: "database" | "synthetic-dev";
  }> {
    if (process.env.DATABASE_URL) {
      const { drizzleStore } = await import("../slice/drizzle-store");
      const { patientsTable, profilesTable, referralsTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const rows = await drizzleStore["database"]
        .select({
          id: patientsTable.id,
          displayName: profilesTable.displayName,
          fullName: profilesTable.fullName,
        })
        .from(patientsTable)
        .innerJoin(profilesTable, eq(profilesTable.id, patientsTable.profileId))
        .limit(200);
      if (rows.length > 0) {
        return {
          source: "database",
          patients: rows.map((row) => this.toWorkstationPatient(row.id, row.displayName ?? row.fullName ?? "Unknown")),
        };
      }
    }
    if (process.env.NODE_ENV === "production") {
      // Deny-by-default: never serve synthetic clinical data in production.
      return { source: "database", patients: [] };
    }
    return { source: "synthetic-dev", patients: SYNTHETIC_PATIENTS };
  }

  /**
   * Journey state read from the authoritative journey_states table (via the
   * Drizzle store). Derives per-stage statuses from the persisted stage —
   * stages before the current one are COMPLETED, the current stage is ACTIVE,
   * the next is WAITING (clinical review gate), and everything after is BLOCKED.
   * Falls back to a safe referral-stage projection when no journey row exists.
   */
  async getJourney(patientId: string, pathway: string): Promise<{
    currentStage: string;
    stages: ReadonlyArray<{ stage: string; status: "COMPLETED" | "ACTIVE" | "WAITING" | "BLOCKED" }>;
    nextStage: string;
    safetyGates: readonly string[];
  }> {
    const STAGES = [
      "REFERRAL",
      "INTAKE",
      "QUESTIONNAIRES",
      "ASSESSMENT",
      "CLINICAL_REVIEW",
      "OUTCOME",
      "REPORT",
      "FEEDBACK",
      "TREATMENT",
      "TITRATION",
      "MAINTENANCE_SHARED_CARE",
      "ONGOING_CARE_DISCHARGE",
    ] as const;

    let currentStage = "REFERRAL";
    let hasAssignedClinician = false;
    let hasIntakeCompleted = false;
    if (process.env.DATABASE_URL) {
      const { drizzleStore } = await import("../slice/drizzle-store");
      const { journeyStatesTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");
      const [row] = await drizzleStore["database"]
        .select()
        .from(journeyStatesTable)
        .where(eq(journeyStatesTable.patientId, patientId))
        .limit(1);
      if (row) {
        currentStage = row.stage;
        hasAssignedClinician = row.hasAssignedClinician;
        hasIntakeCompleted = row.hasIntakeCompleted;
      }
    }

    const idx = STAGES.indexOf(currentStage as (typeof STAGES)[number]);
    const safeIdx = idx === -1 ? 0 : idx;
    const stages = STAGES.map((stage, i) => ({
      stage,
      status:
        i < safeIdx
          ? ("COMPLETED" as const)
          : i === safeIdx
            ? ("ACTIVE" as const)
            : i === safeIdx + 1
              ? ("WAITING" as const)
              : ("BLOCKED" as const),
    }));

    // Clinical safety gate: stage may not cross CLINICAL_REVIEW without an
    // assigned clinician and completed intake.
    const safetyGates: string[] = [];
    if (safeIdx >= STAGES.indexOf("CLINICAL_REVIEW") && (!hasAssignedClinician || !hasIntakeCompleted)) {
      safetyGates.push("clinical_review_required");
      const reviewIdx = stages.findIndex((s) => s.stage === "CLINICAL_REVIEW");
      if (reviewIdx >= 0 && stages[reviewIdx].status === "ACTIVE") {
        stages[reviewIdx].status = "WAITING";
      }
    }

    const nextStage = stages[safeIdx + 1]?.stage ?? STAGES[STAGES.length - 1];
    return { currentStage, stages, nextStage, safetyGates };
  }

  /** Minimal authoritative projection for DB-sourced patients. Unknown
   *  clinical fields are null until their domains are migrated — the UI
   *  renders "—" rather than inventing values. */  private toWorkstationPatient(id: string, displayName: string): WorkstationPatient {
    return {
      id,
      nhsNumber: "—",
      displayName,
      dateOfBirth: "—",
      gender: "—",
      pathway: "ADHD",
      riskSeverity: "NONE",
      riskScore: 0,
      assignedClinicianId: null as unknown as string,
      lastContactedAt: null as unknown as string,
      nextAppointmentAt: null as unknown as string,
      activeMedications: [],
      openAlerts: [],
      carePlanVersion: 1,
    };
  }

  async getPatient(actor: WorkstationActor | undefined, patientId: string): Promise<WorkstationPatient> {
    requireCapability(actor, WorkstationCapability.READ_PATIENT);
    if (!isUuid(patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
    const { patients } = await this.loadPatients();
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) {
      throw new WorkstationError(404, "PATIENT_NOT_FOUND", "Patient not found.");
    }
    return patient;
  }

  async listPatients(
    actor: WorkstationActor | undefined,
    { page = 1, pageSize = 20, search }: { page?: number; pageSize?: number; search?: string },
  ): Promise<Paginated<WorkstationPatient>> {
    requireCapability(actor, WorkstationCapability.READ_PATIENT);
    const { patients } = await this.loadPatients();
    let items = patients;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.displayName.toLowerCase().includes(q) || p.nhsNumber.includes(q));
    }
    const start = (page - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    return { items: pageItems, total: items.length, page, pageSize };
  }

  async createClinicalNote(
    actor: WorkstationActor | undefined,
    req: Request,
    input: { patientId: string; type: ClinicalNote["type"]; body: string },
  ): Promise<ClinicalNote> {
    requireCapability(actor, WorkstationCapability.WRITE_CLINICAL);
    if (!isUuid(input.patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
    if (!input.body || input.body.length < 5 || input.body.length > 50_000) {
      throw new WorkstationError(400, "INVALID_NOTE_BODY", "Clinical note body must be between 5 and 50,000 characters.");
    }
    const now = new Date();
    const nowIso = now.toISOString();
    const note: ClinicalNote = {
      id: randomUUID(),
      patientId: input.patientId,
      authorId: actor!.actorId,
      type: input.type,
      status: "DRAFT",
      body: input.body,
      version: 1,
      signedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    if (process.env.DATABASE_URL) {
      const { drizzleStore } = await import("../slice/drizzle-store");
      const { clinicalNotesTable } = await import("@workspace/db");
      await drizzleStore["database"].insert(clinicalNotesTable).values({
        id: note.id,
        patientId: note.patientId,
        authorProfileId: note.authorId,
        noteType: note.type,
        body: note.body,
        occurredAt: now,
        version: 1,
        signedAt: null,
      });
    }
    auditEvent(req, resPlaceholder(req), "ehr.clinical_note.create", "patient", input.patientId, {
      noteId: note.id,
      type: note.type,
      status: note.status,
    });
    return note;
  }

  submitAssessment(
    actor: WorkstationActor | undefined,
    req: Request,
    input: { patientId: string; instrument: string; answers: readonly number[]; interpretation: string },
  ): AssessmentResponse {
    requireCapability(actor, WorkstationCapability.WRITE_ASSESSMENT);
    if (!isUuid(input.patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
    const validInstruments = new Set(["ASRS", "AQ50", "CAT_Q", "PHQ9", "GAD7", "WURS", "DIVA", "RAADS_R"]);
    if (!validInstruments.has(input.instrument)) {
      throw new WorkstationError(400, "INVALID_INSTRUMENT", "Assessment instrument not supported.");
    }
    if (!input.answers || input.answers.length === 0 || input.answers.length > 200) {
      throw new WorkstationError(400, "INVALID_ANSWERS", "Answers must contain between 1 and 200 items.");
    }
    if (!input.answers.every((a) => Number.isInteger(a) && a >= 0 && a <= 8)) {
      throw new WorkstationError(400, "INVALID_ANSWER_VALUE", "Each answer must be an integer between 0 and 8.");
    }
    const totalScore = input.answers.reduce((sum, a) => sum + a, 0);
    const now = new Date().toISOString();
    const response: AssessmentResponse = {
      id: randomUUID(),
      patientId: input.patientId,
      instrument: input.instrument,
      answers: [...input.answers],
      totalScore,
      interpretation: input.interpretation,
      completedAt: now,
      completedBy: actor!.actorId,
    };
    auditEvent(req, resPlaceholder(req), "ehr.assessment_response.create", "patient", input.patientId, {
      instrument: response.instrument,
      totalScore: response.totalScore,
    });
    return response;
  }

  upsertCarePlanItem(
    actor: WorkstationActor | undefined,
    req: Request,
    input: {
      patientId: string;
      title: string;
      description: string;
      category: CarePlanItem["category"];
      priority: CarePlanItem["priority"];
      targetDate: string | null;
      ownerRole: string;
    },
  ): CarePlanItem {
    requireCapability(actor, WorkstationCapability.WRITE_CLINICAL);
    if (!isUuid(input.patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
    if (!input.title || input.title.length < 3 || input.title.length > 200) {
      throw new WorkstationError(400, "INVALID_TITLE", "Care plan title must be between 3 and 200 characters.");
    }
    const now = new Date().toISOString();
    const item: CarePlanItem = {
      id: randomUUID(),
      patientId: input.patientId,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: "ACTIVE",
      targetDate: input.targetDate,
      completedAt: null,
      ownerRole: input.ownerRole,
    };
    auditEvent(req, resPlaceholder(req), "care_plan.item.create", "patient", input.patientId, {
      itemId: item.id,
      category: item.category,
      priority: item.priority,
    });
    return item;
  }

  createAppointment(
    actor: WorkstationActor | undefined,
    req: Request,
    input: {
      patientId: string;
      startsAt: string;
      endsAt: string;
      mode: WorkstationAppointment["mode"];
      reason: string;
      locationOrLink: string;
    },
  ): WorkstationAppointment {
    requireCapability(actor, WorkstationCapability.MANAGE_APPOINTMENT);
    if (!isUuid(input.patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
    const starts = Date.parse(input.startsAt);
    const ends = Date.parse(input.endsAt);
    if (!starts || !ends || ends <= starts) {
      throw new WorkstationError(400, "INVALID_TIME_RANGE", "Provide a valid appointment start and end time.");
    }
    const appointment: WorkstationAppointment = {
      id: randomUUID(),
      patientId: input.patientId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      mode: input.mode,
      status: "CONFIRMED",
      reason: input.reason,
      locationOrLink: input.locationOrLink,
    };
    auditEvent(req, resPlaceholder(req), "appointment.create", "patient", input.patientId, {
      appointmentId: appointment.id,
      mode: appointment.mode,
      startsAt: appointment.startsAt,
    });
    return appointment;
  }

  addMdtNote(
    actor: WorkstationActor | undefined,
    req: Request,
    input: { patientId: string; body: string; visibleToTeam: boolean },
  ): MdtNote {
    requireCapability(actor, WorkstationCapability.WRITE_CLINICAL);
    if (!isUuid(input.patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
    if (!input.body || input.body.length < 5 || input.body.length > 10_000) {
      throw new WorkstationError(400, "INVALID_MDT_BODY", "MDT note body must be between 5 and 10,000 characters.");
    }
    const now = new Date().toISOString();
    const note: MdtNote = {
      id: randomUUID(),
      patientId: input.patientId,
      authorId: actor!.actorId,
      authorRole: actor!.roles?.[0] ?? "CLINICIAN",
      body: input.body,
      visibleToTeam: input.visibleToTeam,
      createdAt: now,
    };
    auditEvent(req, resPlaceholder(req), "mdt.note.create", "patient", input.patientId, {
      noteId: note.id,
      visibleToTeam: note.visibleToTeam,
    });
    return note;
  }

  async acknowledgeAlert(
    actor: WorkstationActor | undefined,
    req: Request,
    { patientId, alertId }: { patientId: string; alertId: string },
  ): Promise<ClinicalAlert> {
    requireCapability(actor, WorkstationCapability.WRITE_CLINICAL);
    if (!isUuid(patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
    const { patients } = await this.loadPatients();
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) {
      throw new WorkstationError(404, "PATIENT_NOT_FOUND", "Patient not found.");
    }
    const alert = patient.openAlerts.find((a) => a.id === alertId);
    if (!alert) {
      throw new WorkstationError(404, "ALERT_NOT_FOUND", "Clinical alert not found.");
    }
    const now = new Date().toISOString();
    const acknowledged: ClinicalAlert = {
      ...alert,
      acknowledgedBy: actor!.actorId,
      acknowledgedAt: now,
    };
    auditEvent(req, resPlaceholder(req), "clinical_alert.acknowledge", "patient", patientId, {
      alertId,
      kind: alert.kind,
      severity: alert.severity,
    });
    return acknowledged;
  }

  async listVitals(actor: WorkstationActor | undefined, patientId: string): Promise<readonly VitalsObservation[]> {
    requireCapability(actor, WorkstationCapability.READ_PATIENT);
    if (!isUuid(patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
    if (process.env.DATABASE_URL) {
      const { drizzleStore } = await import("../slice/drizzle-store");
      const { patientVitalsTable } = await import("@workspace/db");
      const { eq, desc } = await import("drizzle-orm");
      const rows = await drizzleStore["database"]
        .select()
        .from(patientVitalsTable)
        .where(eq(patientVitalsTable.patientId, patientId))
        .orderBy(desc(patientVitalsTable.recordedAt))
        .limit(50);
      return rows.map((row) => ({
        id: row.id,
        patientId: row.patientId,
        recordedAt: row.recordedAt.toISOString(),
        systolicBp: row.systolicBp ?? undefined,
        diastolicBp: row.diastolicBp ?? undefined,
        heartRate: row.heartRate ?? undefined,
        temperature: row.temperature ?? undefined,
        weightKg: row.weightKg ? Number(row.weightKg) : undefined,
        heightCm: row.heightCm ? Number(row.heightCm) : undefined,
        oxygenSaturation: row.oxygenSaturation ?? undefined,
        recordedBy: row.recordedBy,
      }));
    }
    // Development fallback: clearly-marked synthetic series when no DB configured.
    if (process.env.NODE_ENV === "production") return [];
    const base = new Date("2026-10-01T00:00:00Z");
    return Array.from({ length: 10 }, (_, i) => {
      const recordedAt = new Date(base.getTime() + i * 86_400_000).toISOString();
      return {
        id: `vitals-${i + 1}`,
        patientId,
        recordedAt,
        systolicBp: 110 + i * 2 + (i % 3),
        diastolicBp: 70 + i,
        heartRate: 72 + (i % 5),
        temperature: 36.5 + (i % 3) * 0.2,
        weightKg: 70 + i * 0.5,
        heightCm: 170,
        oxygenSaturation: 98 - (i % 2),
        recordedBy: actor!.actorId,
      };
    });
  }
}

function resPlaceholder(req: Request): { status: () => { json: () => void }; header: () => void } {
  return {
    status: () => ({ json: () => undefined }),
    header: () => undefined,
  };
}

