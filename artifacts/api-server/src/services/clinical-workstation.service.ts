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
  getPatient(actor: WorkstationActor | undefined, patientId: string): WorkstationPatient {
    requireCapability(actor, WorkstationCapability.READ_PATIENT);
    if (!isUuid(patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
    const patient = SYNTHETIC_PATIENTS.find((p) => p.id === patientId);
    if (!patient) {
      throw new WorkstationError(404, "PATIENT_NOT_FOUND", "Patient not found.");
    }
    return patient;
  }

  listPatients(
    actor: WorkstationActor | undefined,
    { page = 1, pageSize = 20, search }: { page?: number; pageSize?: number; search?: string },
  ): Paginated<WorkstationPatient> {
    requireCapability(actor, WorkstationCapability.READ_PATIENT);
    let items = SYNTHETIC_PATIENTS;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.displayName.toLowerCase().includes(q) || p.nhsNumber.includes(q));
    }
    const start = (page - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    return { items: pageItems, total: items.length, page, pageSize };
  }

  createClinicalNote(
    actor: WorkstationActor | undefined,
    req: Request,
    input: { patientId: string; type: ClinicalNote["type"]; body: string },
  ): ClinicalNote {
    requireCapability(actor, WorkstationCapability.WRITE_CLINICAL);
    if (!isUuid(input.patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
    if (!input.body || input.body.length < 5 || input.body.length > 50_000) {
      throw new WorkstationError(400, "INVALID_NOTE_BODY", "Clinical note body must be between 5 and 50,000 characters.");
    }
    const now = new Date().toISOString();
    const note: ClinicalNote = {
      id: randomUUID(),
      patientId: input.patientId,
      authorId: actor!.actorId,
      type: input.type,
      status: "DRAFT",
      body: input.body,
      version: 1,
      signedAt: null,
      createdAt: now,
      updatedAt: now,
    };
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

  acknowledgeAlert(
    actor: WorkstationActor | undefined,
    req: Request,
    { patientId, alertId }: { patientId: string; alertId: string },
  ): ClinicalAlert {
    requireCapability(actor, WorkstationCapability.WRITE_CLINICAL);
    if (!isUuid(patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
    const patient = SYNTHETIC_PATIENTS.find((p) => p.id === patientId);
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

  listVitals(actor: WorkstationActor | undefined, patientId: string): readonly VitalsObservation[] {
    requireCapability(actor, WorkstationCapability.READ_PATIENT);
    if (!isUuid(patientId)) {
      throw new WorkstationError(400, "INVALID_PATIENT_ID", "Invalid patient identifier.");
    }
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

