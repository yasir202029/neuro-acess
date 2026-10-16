import { Router, type IRouter } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authenticate, requirePermission } from "../security/auth";
import { auditEvent } from "../security/audit";
import { db } from "@workspace/db";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import {
  patientOnboardingTable,
  safetyScreeningTable,
  screeningQuestionnaireTable,
  patientVitalsTable,
  prescriptionTable,
  appointmentsTable,
  paymentsTable,
  profilesTable,
  patientsTable,

  type InsertPatientOnboarding,
  type InsertSafetyScreening,
  type InsertScreeningQuestionnaire,
  type InsertPatientVitals,
} from "@workspace/db";

const router: IRouter = Router();

// ── Patient onboarding ──
router.get("/patient/onboarding", authenticate, requirePermission("patient:read"), async (req, res) => {
  const userId = req.user!.id;
  const [onboarding] = await db
    .select()
    .from(patientOnboardingTable)
    .where(eq(patientOnboardingTable.patientId, userId))
    .limit(1);
  if (!onboarding) {
    return res.json({ patientId: userId, stage: "account", progress: 0, completedAt: null });
  }
  return res.json({
    patientId: onboarding.patientId,
    stage: onboarding.stage,
    progress: onboarding.progress,
    completedAt: onboarding.completedAt,
  });
});

router.post("/patient/onboarding", authenticate, requirePermission("patient:write"), async (req, res) => {
  const userId = req.user!.id;
  const body = z
    .object({
      stage: z.enum(["account", "screening", "book", "payment", "prepare"]),
      progress: z.number().int().min(0).max(100).optional(),
      completedAt: z.string().datetime().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid onboarding data.", code: "INVALID_ONBOARDING" });
  }
  const existing = await db
    .select()
    .from(patientOnboardingTable)
    .where(eq(patientOnboardingTable.patientId, userId))
    .limit(1);
  let result;
  if (existing.length > 0) {
    [result] = await db
      .update(patientOnboardingTable)
      .set({
        stage: body.data.stage,
        progress: body.data.progress ?? existing[0].progress,
        completedAt: body.data.completedAt ? new Date(body.data.completedAt) : existing[0].completedAt,
        updatedAt: new Date(),
      })
      .where(eq(patientOnboardingTable.patientId, userId))
      .returning();
  } else {
    [result] = await db
      .insert(patientOnboardingTable)
      .values({
        id: randomUUID(),
        patientId: userId,
        stage: body.data.stage,
        progress: body.data.progress ?? 0,
        completedAt: body.data.completedAt ? new Date(body.data.completedAt) : null,
      } as InsertPatientOnboarding)
      .returning();
  }
  auditEvent(req, res, "patient.onboarding.update", "patient", userId, { stage: body.data.stage });
  return res.json({
    patientId: result.patientId,
    stage: result.stage,
    progress: result.progress,
    completedAt: result.completedAt,
  });
});

// ── Safety screening ──
router.get("/patient/safety-screening", authenticate, requirePermission("patient:read"), async (req, res) => {
  const userId = req.user!.id;
  const [screening] = await db
    .select()
    .from(safetyScreeningTable)
    .where(eq(safetyScreeningTable.patientId, userId))
    .limit(1);
  if (!screening) {
    return res.json({ patientId: userId, status: "not_started" });
  }
  return res.json({
    patientId: screening.patientId,
    pathway: screening.pathway,
    status: screening.status,
    reviewNotes: screening.reviewNotes,
    reviewedAt: screening.reviewedAt,
  });
});

router.post("/patient/safety-screening", authenticate, requirePermission("patient:write"), async (req, res) => {
  const userId = req.user!.id;
  const body = z
    .object({
      pathway: z.enum(["ADHD", "AUTISM", "BOTH", "GENERAL"]),
      answers: z.record(z.string(), z.unknown()),
    })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid screening data.", code: "INVALID_SCREENING" });
  }
  const answers = body.data.answers as Record<string, unknown>;
  const hasSafetyConcern =
    answers.safeguardingConcern === true ||
    answers.currentMedication === "unsafe_combination" ||
    answers.ageEligibility === false;
  const status = hasSafetyConcern ? "review_required" : "pass";
  const existing = await db
    .select()
    .from(safetyScreeningTable)
    .where(eq(safetyScreeningTable.patientId, userId))
    .limit(1);
  let result;
  if (existing.length > 0) {
    [result] = await db
      .update(safetyScreeningTable)
      .set({ pathway: body.data.pathway, answers, status, updatedAt: new Date() })
      .where(eq(safetyScreeningTable.patientId, userId))
      .returning();
  } else {
    [result] = await db
      .insert(safetyScreeningTable)
      .values({
        id: randomUUID(),
        patientId: userId,
        pathway: body.data.pathway,
        answers,
        status,
      } as InsertSafetyScreening)
      .returning();
  }
  auditEvent(req, res, "patient.safety_screening.submit", "patient", userId, { status });
  return res.json({
    patientId: result.patientId,
    pathway: result.pathway,
    status: result.status,
    reviewNotes: result.reviewNotes,
  });
});
// ── Screening questionnaires ──
router.get("/patient/questionnaires", authenticate, requirePermission("patient:read"), async (req, res) => {
  const userId = req.user!.id;
  const rows = await db
    .select()
    .from(screeningQuestionnaireTable)
    .where(eq(screeningQuestionnaireTable.patientId, userId))
    .orderBy(desc(screeningQuestionnaireTable.createdAt));
  return res.json(
    rows.map((r) => ({
      id: r.id,
      questionnaireType: r.questionnaireType,
      version: r.version,
      status: r.status,
      totalScore: r.totalScore,
      interpretation: r.interpretation,
      completedAt: r.completedAt,
    }))
  );
});

router.post("/patient/questionnaires", authenticate, requirePermission("patient:write"), async (req, res) => {
  const userId = req.user!.id;
  const body = z
    .object({
      questionnaireType: z.string().min(1),
      version: z.string().min(1),
      answers: z.record(z.string(), z.unknown()),
      totalScore: z.number().int().optional(),
      interpretation: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid questionnaire data.", code: "INVALID_QUESTIONNAIRE" });
  }
  const [result] = await db
    .insert(screeningQuestionnaireTable)
    .values({
      id: randomUUID(),
      patientId: userId,
      questionnaireType: body.data.questionnaireType,
      version: body.data.version,
      answers: body.data.answers,
      totalScore: body.data.totalScore,
      interpretation: body.data.interpretation,
      status: "completed",
      completedAt: new Date(),
    } as InsertScreeningQuestionnaire)
    .returning();
  auditEvent(req, res, "patient.questionnaire.submit", "patient", userId, {
    questionnaireType: body.data.questionnaireType,
  });
  return res.json({
    id: result.id,
    status: result.status,
    completedAt: result.completedAt,
  });
});
// ── Patient appointments ──
router.get("/patient/appointments", authenticate, requirePermission("patient:read"), async (req, res) => {
  const userId = req.user!.id;
  const rows = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.patientId, userId))
    .orderBy(asc(appointmentsTable.scheduledDate), asc(appointmentsTable.scheduledTime));
  return res.json(
    rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      clinicianId: r.clinicianId,
      type: r.assessmentType,
      startsAt: `${r.scheduledDate}T${r.scheduledTime}`,
      mode: "VIDEO",
      status: r.status,
      reason: "Initial assessment",
      locationOrLink: r.location,
    }))
  );
});

router.post("/patient/appointments", authenticate, requirePermission("patient:write"), async (req, res) => {
  const userId = req.user!.id;
  const body = z
    .object({
      type: z.enum(["ADHD_ASSESSMENT", "AUTISM_ASSESSMENT", "FOLLOW_UP", "MEDICATION_REVIEW"]),
      scheduledDate: z.string().datetime(),
      mode: z.enum(["VIDEO", "PHONE", "IN_PERSON"]),
      reason: z.string().min(1).max(500),
      locationOrLink: z.string().min(1).max(500),
    })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid appointment data.", code: "INVALID_APPOINTMENT" });
  }
  const id = randomUUID();
  const [result] = await db
    .insert(appointmentsTable)
    .values({
      id,
      patientId: userId,
      assessmentType: body.data.type,
      scheduledDate: new Date(body.data.scheduledDate).toISOString().split("T")[0],
      scheduledTime: body.data.scheduledDate.split("T")[1].split(".")[0],
      status: "REQUESTED",
      location: body.data.locationOrLink,
    })
    .returning();
  auditEvent(req, res, "patient.appointment.book", "appointment", id, { type: body.data.type });
  return res.json({
    id: result.id,
    patientId: result.patientId,
    clinicianId: result.clinicianId,
    type: result.assessmentType,
    startsAt: `${result.scheduledDate}T${result.scheduledTime}`,
    mode: "VIDEO",
    status: result.status,
    reason: body.data.reason,
    locationOrLink: result.location,
  });
});
// ── Patient payments ──
router.get("/patient/payments", authenticate, requirePermission("patient:read"), async (req, res) => {
  const userId = req.user!.id;
  const rows = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.patientId, userId))
    .orderBy(desc(paymentsTable.createdAt));
  return res.json(
    rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      appointmentId: r.appointmentId,
      description: r.description,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
    }))
  );
});
// ── Patient dashboard ──
router.get("/patient/dashboard", authenticate, requirePermission("patient:read"), async (req, res) => {
  const userId = req.user!.id;
  const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, userId)).limit(1);
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.profileId, userId)).limit(1);
  const [onboarding] = await db
    .select()
    .from(patientOnboardingTable)
    .where(eq(patientOnboardingTable.patientId, userId))
    .limit(1);
  const [screening] = await db
    .select()
    .from(safetyScreeningTable)
    .where(eq(safetyScreeningTable.patientId, userId))
    .limit(1);
  const upcoming = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.patientId, userId),
        inArray(appointmentsTable.status, ["REQUESTED", "CONFIRMED"]),
      ),
    )
    .orderBy(asc(appointmentsTable.scheduledDate))
    .limit(1);
  return res.json({
    patient: {
      id: patient?.id ?? userId,
      displayName: profile?.fullName ?? "Patient",
      email: profile?.email ?? "",
      pathway: screening?.pathway ?? "GENERAL",
    },
    onboarding: {
      stage: onboarding?.stage ?? "account",
      progress: onboarding?.progress ?? 0,
    },
    safetyStatus: screening?.status ?? "not_started",
    nextAppointment: upcoming.length > 0
      ? {
          id: upcoming[0].id,
          type: upcoming[0].assessmentType,
          startsAt: `${upcoming[0].scheduledDate}T${upcoming[0].scheduledTime}`,
          status: upcoming[0].status,
        }
      : null,
  });
});
// ── Patient titration hub ──
router.get("/patient/titration", authenticate, requirePermission("patient:read"), async (req, res) => {
  const userId = req.user!.id;
  const [prescription] = await db
    .select()
    .from(prescriptionTable)
    .where(eq(prescriptionTable.patientId, userId))
    .orderBy(desc(prescriptionTable.createdAt))
    .limit(1);
  return res.json({
    patientId: userId,
    medication: prescription?.medication ?? null,
    dosage: prescription?.dosage ?? null,
    status: prescription?.status ?? "none",
    nextReview: prescription?.authorisedAt ?? null,
    titrationActive: prescription?.status === "authorised" || prescription?.status === "issued",
  });
});
// ── Patient vitals ──
router.get("/patient/vitals", authenticate, requirePermission("patient:read"), async (req, res) => {
  const userId = req.user!.id;
  const rows = await db
    .select()
    .from(patientVitalsTable)
    .where(eq(patientVitalsTable.patientId, userId))
    .orderBy(asc(patientVitalsTable.recordedAt));
  return res.json(
    rows.map((r) => ({
      id: r.id,
      patientId: r.patientId,
      recordedAt: r.recordedAt,
      recordedBy: r.recordedBy,
      systolicBp: r.systolicBp,
      diastolicBp: r.diastolicBp,
      heartRate: r.heartRate,
      temperature: r.temperature,
      weightKg: r.weightKg ? Number(r.weightKg) : null,
      heightCm: r.heightCm ? Number(r.heightCm) : null,
      oxygenSaturation: r.oxygenSaturation,
      contextualNote: r.contextualNote,
    }))
  );
});

router.post("/patient/vitals", authenticate, requirePermission("patient:write"), async (req, res) => {
  const userId = req.user!.id;
  const body = z
    .object({
      systolicBp: z.number().int().min(50).max(300).optional(),
      diastolicBp: z.number().int().min(30).max(200).optional(),
      heartRate: z.number().int().min(30).max(220).optional(),
      temperature: z.number().min(30).max(45).optional(),
      weightKg: z.number().min(1).max(300).optional(),
      heightCm: z.number().min(50).max(300).optional(),
      oxygenSaturation: z.number().int().min(50).max(100).optional(),
      contextualNote: z.string().max(1000).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid vitals data.", code: "INVALID_VITALS" });
  }
  const submissionId = randomUUID();
  const [result] = await db
    .insert(patientVitalsTable)
    .values({
      id: randomUUID(),
      patientId: userId,
      recordedBy: "patient",
      systolicBp: body.data.systolicBp,
      diastolicBp: body.data.diastolicBp,
      heartRate: body.data.heartRate,
      temperature: body.data.temperature,
      weightKg: body.data.weightKg,
      heightCm: body.data.heightCm,
      oxygenSaturation: body.data.oxygenSaturation,
      contextualNote: body.data.contextualNote,
      submissionId,
    } as InsertPatientVitals)
    .returning();
  auditEvent(req, res, "patient.vitals.submit", "patient", userId, { submissionId });
  return res.json({
    id: result.id,
    submissionId,
    recordedAt: result.recordedAt,
    recordedBy: result.recordedBy,
  });
});
// ── Patient prescriptions ──
router.get("/patient/prescriptions", authenticate, requirePermission("patient:read"), async (req, res) => {
  const userId = req.user!.id;
  const rows = await db
    .select()
    .from(prescriptionTable)
    .where(eq(prescriptionTable.patientId, userId))
    .orderBy(desc(prescriptionTable.createdAt));
  return res.json(
    rows.map((r) => ({
      id: r.id,
      medication: r.medication,
      dosage: r.dosage,
      frequency: r.frequency,
      status: r.status,
      authorisedAt: r.authorisedAt,
      issuedAt: r.issuedAt,
      createdAt: r.createdAt,
    }))
  );
});

export default router;
