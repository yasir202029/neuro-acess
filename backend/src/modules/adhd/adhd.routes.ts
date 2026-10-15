import { Router } from 'express';
import { z } from 'zod';
import { Prisma, AssessmentStatus, AssessmentType, NoteType, Role } from '@prisma/client';
import { prisma } from '../../shared/db.js';
import { asyncHandler } from '../../shared/http.js';
import { audit } from '../../middleware/audit.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { badRequest, notFound } from '../../shared/errors.js';

import { ScreeningInstrument } from '@prisma/client';
const instrumentFor = (formKey: string): ScreeningInstrument => {
  const key = formKey.toUpperCase();
  return (Object.values(ScreeningInstrument) as string[]).includes(key)
    ? (key as ScreeningInstrument)
    : ScreeningInstrument.ASRS;
};

const router = Router();
router.use(requireAuth);
router.post('/screening', audit('ADHD_SCREENING_SUBMITTED', 'ScreeningResponse'), asyncHandler(async (req, res) => { const body = z.object({ assessmentId: z.string().cuid().optional(), formKey: z.string().min(1), version: z.string().min(1), answers: z.record(z.string(), z.unknown()) }).parse(req.body); const patient = await prisma.patient.findUnique({ where: { userId: req.user!.id } }); if (!patient) throw badRequest('Patient profile not found'); res.status(201).json(await prisma.screeningResponse.create({ data: { patientId: patient.id, instrument: instrumentFor(body.formKey), assessmentId: body.assessmentId, formKey: body.formKey, version: body.version, answers: body.answers as Prisma.InputJsonValue } })); }));
router.post('/assessments', requireRole(Role.CLINICIAN, Role.ADMIN), asyncHandler(async (req, res) => { const body = z.object({ patientId: z.string().cuid(), clinicianId: z.string().cuid().optional() }).parse(req.body); const assessment = await prisma.assessment.create({ data: { ...body, type: AssessmentType.ADHD, adhd: { create: {} } }, include: { adhd: true } }); res.status(201).json(assessment); }));
router.patch('/assessments/:id/workflow', requireRole(Role.CLINICIAN, Role.ADMIN), audit('ADHD_WORKFLOW_UPDATED', 'Assessment'), asyncHandler(async (req, res) => { const body = z.object({ status: z.nativeEnum(AssessmentStatus), formulation: z.string().max(20000).optional(), recommendations: z.record(z.string(), z.unknown()).optional() }).parse(req.body); res.json(await prisma.assessment.update({ where: { id: String(req.params.id), type: AssessmentType.ADHD }, data: body as Prisma.AssessmentUncheckedUpdateInput, include: { adhd: { include: { medicationReviews: true } } } })); }));
router.post('/assessments/:id/medication-reviews', requireRole(Role.CLINICIAN, Role.ADMIN), audit('ADHD_MEDICATION_REVIEW_CREATED', 'MedicationReview'), asyncHandler(async (req, res) => { const body = z.object({ medication: z.string().min(1), dose: z.string().optional(), response: z.string().optional(), sideEffects: z.string().optional(), nextReviewAt: z.coerce.date().optional() }).parse(req.body); const assessment = await prisma.adhdAssessment.findUnique({ where: { assessmentId: String(req.params.id) } }); if (!assessment) throw notFound('ADHD assessment not found'); res.status(201).json(await prisma.medicationReview.create({ data: { ...body, adhdAssessmentId: assessment.id, reviewedAt: new Date() } })); }));
router.get('/assessments/:id', asyncHandler(async (req, res) => { const item = await prisma.assessment.findFirst({ where: { id: String(req.params.id), type: AssessmentType.ADHD }, include: { screenings: true, adhd: { include: { medicationReviews: true } }, patient: { include: { user: { select: { firstName: true, lastName: true } } } } } }); if (!item) throw notFound('ADHD assessment not found'); res.json(item); }));
export default router;
