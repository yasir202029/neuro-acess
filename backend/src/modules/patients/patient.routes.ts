import { Router } from 'express';
import { z } from 'zod';
import { audit } from '../../middleware/audit.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/http.js';
import { prisma } from '../../shared/db.js';
import { notFound } from '../../shared/errors.js';
import { Role } from '@prisma/client';

const router = Router();
router.use(requireAuth);
const profile = z.object({ nhsNumber: z.string().regex(/^\d{10}$/).optional(), dateOfBirth: z.coerce.date().optional(), sexAtBirth: z.string().max(50).optional(), gender: z.string().max(80).optional(), address: z.record(z.string(), z.string()).optional(), emergencyContact: z.record(z.string(), z.string()).optional(), preferredContact: z.string().max(30).optional(), consentToContact: z.boolean().optional(), medicalHistory: z.string().max(10000).optional(), currentMedication: z.array(z.record(z.string(), z.string())).optional(), accessibilityNeeds: z.string().max(2000).optional() });

router.get('/me', asyncHandler(async (req, res) => { const patient = await prisma.patient.findUnique({ where: { userId: req.user!.id }, include: { user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } } } }); if (!patient) throw notFound('Patient profile not found'); res.json(patient); }));
router.patch('/me', audit('PATIENT_PROFILE_UPDATED', 'Patient'), asyncHandler(async (req, res) => { const body = profile.parse(req.body); const patient = await prisma.patient.update({ where: { userId: req.user!.id }, data: body }); res.json(patient); }));
router.get('/:id', requireRole(Role.CLINICIAN, Role.ADMIN), asyncHandler(async (req, res) => { const patient = await prisma.patient.findUnique({ where: { id: String(req.params.id) }, include: { user: { select: { email: true, firstName: true, lastName: true, phone: true } }, assessments: true, appointments: true } }); if (!patient) throw notFound('Patient not found'); res.json(patient); }));
export default router;
