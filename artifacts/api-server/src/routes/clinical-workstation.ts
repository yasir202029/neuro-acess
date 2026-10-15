import { Router, type IRouter } from "express";
import { z } from "zod";
import { authenticate, requirePermission, type AuthenticatedUser } from "../security/auth";
import { auditEvent } from "../security/audit";
import { ClinicalWorkstationService } from "../services/clinical-workstation.service";
import { WorkstationCapability, type WorkstationActor } from "../types/clinical-workstation";

const router: IRouter = Router();
const service = new ClinicalWorkstationService();

function actorFromUser(user: AuthenticatedUser): WorkstationActor {
  return {
    actorId: user.id,
    email: user.email,
    roles: [user.role],
    clinicId: user.clinicId ?? null,
    capabilities: new Set<string>() as unknown as ReadonlySet<WorkstationCapability>,
  };
}

function handleServiceError(res: import("express").Response, error: unknown): import("express").Response {
  if (error instanceof Error && "status" in error && "code" in error) {
    return res.status((error as { status: number }).status).json({
      error: error.message,
      code: (error as { code: string }).code,
    });
  }
  return res.status(500).json({ error: "Internal server error.", code: "INTERNAL_ERROR" });
}

const noteBody = z
  .object({
    type: z.enum(["CONSULTATION", "PROGRESS", "MEDICATION_REVIEW", "RISK_REVIEW", "SAFEGUARDING"]),
    body: z.string().min(5).max(50_000),
  })
  .strict();

const assessmentBody = z
  .object({
    instrument: z.enum(["ASRS", "AQ50", "CAT_Q", "PHQ9", "GAD7", "WURS", "DIVA", "RAADS_R"]),
    answers: z.array(z.number().int().min(0).max(8)).min(1).max(200),
    interpretation: z.string().min(1).max(2000),
  })
  .strict();

const carePlanBody = z
  .object({
    title: z.string().min(3).max(200),
    description: z.string().max(2000),
    category: z.enum(["MEDICATION", "THERAPY", "MONITORING", "REFERRAL", "LIFESTYLE"]),
    priority: z.enum(["ROUTINE", "URGENT"]),
    targetDate: z.string().datetime().nullable().optional(),
    ownerRole: z.string().min(1).max(100),
  })
  .strict();

const appointmentBody = z
  .object({
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    mode: z.enum(["VIDEO", "PHONE", "IN_PERSON"]),
    reason: z.string().min(1).max(500),
    locationOrLink: z.string().min(1).max(500),
  })
  .strict();

const mdtNoteBody = z
  .object({
    body: z.string().min(5).max(10_000),
    visibleToTeam: z.boolean().default(true),
  })
  .strict();

// ── Patient 360 ──
router.get(
  "/workstation/patients/:patientId",
  authenticate,
  requirePermission("patient:read"),
  (req, res) => {
    const parsed = patientIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid patient identifier.", code: "INVALID_PATIENT_ID" });
    try {
      const patient = service.getPatient(actorFromUser(req.user!), parsed.data.patientId);
      auditEvent(req, res, "workstation.patient.read", "patient", parsed.data.patientId);
      return res.json(patient);
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

// ── Patient list (paginated) ──
router.get(
  "/workstation/patients",
  authenticate,
  requirePermission("patient:read"),
  (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const result = service.listPatients(actorFromUser(req.user!), { page, pageSize, search });
      auditEvent(req, res, "workstation.patients.list", "patient");
      return res.json(result);
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

// ── Clinical notes ──
router.post(
  "/workstation/patients/:patientId/clinical-notes",
  authenticate,
  requirePermission("clinical:write"),
  (req, res) => {
    const params = patientIdParam.safeParse(req.params);
    const body = noteBody.safeParse(req.body);
    if (!params.success || !body.success) {
      return res.status(400).json({ error: "Invalid clinical note payload.", code: "INVALID_CLINICAL_NOTE" });
    }
    try {
      const note = service.createClinicalNote(actorFromUser(req.user!), req, {
        patientId: params.data.patientId,
        type: body.data.type,
        body: body.data.body,
      });
      auditEvent(req, res, "workstation.clinical_note.create", "patient", params.data.patientId, {
        noteId: note.id,
        type: note.type,
      });
      return res.status(201).json(note);
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

// ── Assessments ──
router.post(
  "/workstation/patients/:patientId/assessments",
  authenticate,
  requirePermission("assessment:write"),
  (req, res) => {
    const params = patientIdParam.safeParse(req.params);
    const body = assessmentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      return res.status(400).json({ error: "Invalid assessment payload.", code: "INVALID_ASSESSMENT" });
    }
    try {
      const response = service.submitAssessment(actorFromUser(req.user!), req, {
        patientId: params.data.patientId,
        instrument: body.data.instrument,
        answers: body.data.answers,
        interpretation: body.data.interpretation,
      });
      auditEvent(req, res, "workstation.assessment.create", "patient", params.data.patientId, {
        instrument: response.instrument,
        totalScore: response.totalScore,
      });
      return res.status(201).json(response);
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

// ── Care plans ──
router.post(
  "/workstation/patients/:patientId/care-plan",
  authenticate,
  requirePermission("clinical:write"),
  (req, res) => {
    const params = patientIdParam.safeParse(req.params);
    const body = carePlanBody.safeParse(req.body);
    if (!params.success || !body.success) {
      return res.status(400).json({ error: "Invalid care plan payload.", code: "INVALID_CARE_PLAN" });
    }
    try {
      const item = service.upsertCarePlanItem(actorFromUser(req.user!), req, {
        patientId: params.data.patientId,
        ...body.data,
        targetDate: body.data.targetDate ?? null,
      });
      auditEvent(req, res, "workstation.care_plan.create", "patient", params.data.patientId, {
        itemId: item.id,
        category: item.category,
      });
      return res.status(201).json(item);
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

// ── Appointments ──
router.post(
  "/workstation/patients/:patientId/appointments",
  authenticate,
  requirePermission("appointment:manage"),
  (req, res) => {
    const params = patientIdParam.safeParse(req.params);
    const body = appointmentBody.safeParse(req.body);
    if (!params.success || !body.success) {
      return res.status(400).json({ error: "Invalid appointment payload.", code: "INVALID_APPOINTMENT" });
    }
    try {
      const appointment = service.createAppointment(actorFromUser(req.user!), req, {
        patientId: params.data.patientId,
        ...body.data,
      });
      auditEvent(req, res, "workstation.appointment.create", "patient", params.data.patientId, {
        appointmentId: appointment.id,
      });
      return res.status(201).json(appointment);
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

// ── MDT collaboration ──
router.post(
  "/workstation/patients/:patientId/mdt-notes",
  authenticate,
  requirePermission("clinical:write"),
  (req, res) => {
    const params = patientIdParam.safeParse(req.params);
    const body = mdtNoteBody.safeParse(req.body);
    if (!params.success || !body.success) {
      return res.status(400).json({ error: "Invalid MDT note payload.", code: "INVALID_MDT_NOTE" });
    }
    try {
      const note = service.addMdtNote(actorFromUser(req.user!), req, {
        patientId: params.data.patientId,
        body: body.data.body,
        visibleToTeam: body.data.visibleToTeam,
      });
      auditEvent(req, res, "workstation.mdt_note.create", "patient", params.data.patientId, {
        noteId: note.id,
      });
      return res.status(201).json(note);
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

// ── Alerts ──
router.post(
  "/workstation/patients/:patientId/alerts/:alertId/acknowledge",
  authenticate,
  requirePermission("clinical:write"),
  (req, res) => {
    const params = z
      .object({ patientId: z.string().uuid(), alertId: z.string().min(1) })
      .safeParse(req.params);
    if (!params.success) {
      return res.status(400).json({ error: "Invalid alert reference.", code: "INVALID_ALERT_REF" });
    }
    try {
      const alert = service.acknowledgeAlert(actorFromUser(req.user!), req, {
        patientId: params.data.patientId,
        alertId: params.data.alertId,
      });
      auditEvent(req, res, "workstation.alert.acknowledge", "patient", params.data.patientId, {
        alertId: params.data.alertId,
      });
      return res.json(alert);
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

// ── Vitals ──
router.get(
  "/workstation/patients/:patientId/vitals",
  authenticate,
  requirePermission("patient:read"),
  (req, res) => {
    const parsed = patientIdParam.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: "Invalid patient identifier.", code: "INVALID_PATIENT_ID" });
    try {
      const vitals = service.listVitals(actorFromUser(req.user!), parsed.data.patientId);
      auditEvent(req, res, "workstation.vitals.list", "patient", parsed.data.patientId);
      return res.json(vitals);
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

export default router;

const patientIdParam = z.object({ patientId: z.string().uuid("Invalid patient identifier.") });
