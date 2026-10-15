import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AssessmentStatus, AssessmentType, Role, ScreeningInstrument } from '@prisma/client';
import { prisma } from '../../shared/db.js';
import { asyncHandler } from '../../shared/http.js';
import { audit } from '../../middleware/audit.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { badRequest, notFound } from '../../shared/errors.js';

const instrumentFor = (formKey: string): ScreeningInstrument => {
  const key = formKey.toUpperCase();
  return (Object.values(ScreeningInstrument) as string[]).includes(key)
    ? (key as ScreeningInstrument)
    : ScreeningInstrument.AQ50;
};

const router = Router();
router.use(requireAuth);
router.post('/screening', audit('AUTISM_SCREENING_SUBMITTED', 'ScreeningResponse'), asyncHandler(async (req, res) => { const body = z.object({ assessmentId: z.string().cuid().optional(), formKey: z.string().min(1), version: z.string().min(1), answers: z.record(z.string(), z.unknown()) }).parse(req.body); const patient = await prisma.patient.findUnique({ where: { userId: req.user!.id } }); if (!patient) throw badRequest('Patient profile not found'); res.status(201).json(await prisma.screeningResponse.create({ data: { patientId: patient.id, instrument: instrumentFor(body.formKey), assessmentId: body.assessmentId, formKey: body.formKey, version: body.version, answers: body.answers as Prisma.InputJsonValue } })); }));
router.post('/assessments', requireRole(Role.CLINICIAN, Role.ADMIN), asyncHandler(async (req, res) => { const body = z.object({ patientId: z.string().cuid(), clinicianId: z.string().cuid().optional() }).parse(req.body); res.status(201).json(await prisma.assessment.create({ data: { ...body, type: AssessmentType.AUTISM, autism: { create: {} } }, include: { autism: true } })); }));
router.patch('/assessments/:id/workflow', requireRole(Role.CLINICIAN, Role.ADMIN), audit('AUTISM_WORKFLOW_UPDATED', 'Assessment'), asyncHandler(async (req, res) => { const body = z.object({ status: z.nativeEnum(AssessmentStatus), formulation: z.string().max(20000).optional(), recommendations: z.record(z.string(), z.unknown()).optional() }).parse(req.body); res.json(await prisma.assessment.update({ where: { id: String(req.params.id), type: AssessmentType.AUTISM }, data: body as Prisma.AssessmentUncheckedUpdateInput, include: { autism: true } })); }));
router.get('/assessments/:id', asyncHandler(async (req, res) => { const item = await prisma.assessment.findFirst({ where: { id: String(req.params.id), type: AssessmentType.AUTISM }, include: { screenings: true, autism: true, patient: { include: { user: { select: { firstName: true, lastName: true } } } } } }); if (!item) throw notFound('Autism assessment not found'); res.json(item); }));
export default router;
