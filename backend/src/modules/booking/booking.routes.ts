import { Router } from 'express';
import { z } from 'zod';
import { AppointmentMode, AppointmentStatus, AssessmentType, Role } from '@prisma/client';
import { prisma } from '../../shared/db.js';
import { asyncHandler } from '../../shared/http.js';
import { audit } from '../../middleware/audit.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { badRequest, notFound } from '../../shared/errors.js';

const router = Router();
router.use(requireAuth);
const booking = z.object({ type: z.nativeEnum(AssessmentType), mode: z.nativeEnum(AppointmentMode), startsAt: z.coerce.date(), endsAt: z.coerce.date(), clinicianId: z.string().cuid().optional(), availabilityId: z.string().cuid().optional() });

router.get('/availability', asyncHandler(async (req, res) => { const query = z.object({ from: z.coerce.date(), to: z.coerce.date(), clinicianId: z.string().cuid().optional() }).parse(req.query); res.json(await prisma.availability.findMany({ where: { booked: false, startsAt: { gte: query.from, lte: query.to }, clinicianId: query.clinicianId }, orderBy: { startsAt: 'asc' } })); }));
router.post('/appointments', audit('APPOINTMENT_REQUESTED', 'Appointment'), asyncHandler(async (req, res) => { const body = booking.parse(req.body); const patient = await prisma.patient.findUnique({ where: { userId: req.user!.id } }); if (!patient) throw badRequest('A patient profile is required to book an assessment'); const appointment = await prisma.appointment.create({ data: { ...body, patientId: patient.id, status: AppointmentStatus.REQUESTED } }); res.status(201).json(appointment); }));
router.get('/appointments', asyncHandler(async (req, res) => { const patient = await prisma.patient.findUnique({ where: { userId: req.user!.id } }); const where = req.user!.roles.includes(Role.PATIENT) ? { patientId: patient?.id } : {}; res.json(await prisma.appointment.findMany({ where, include: { patient: { include: { user: { select: { firstName: true, lastName: true } } } }, clinician: { include: { user: { select: { firstName: true, lastName: true } } } } }, orderBy: { startsAt: 'asc' } })); }));
router.patch('/appointments/:id/status', requireRole(Role.CLINICIAN, Role.ADMIN), audit('APPOINTMENT_STATUS_UPDATED', 'Appointment'), asyncHandler(async (req, res) => { const body = z.object({ status: z.nativeEnum(AppointmentStatus), cancellationReason: z.string().max(500).optional() }).parse(req.body); const appointment = await prisma.appointment.update({ where: { id: String(req.params.id) }, data: body }); res.json(appointment); }));
router.post('/availability', requireRole(Role.CLINICIAN, Role.ADMIN), asyncHandler(async (req, res) => { const body = z.object({ startsAt: z.coerce.date(), endsAt: z.coerce.date(), mode: z.nativeEnum(AppointmentMode) }).parse(req.body); const clinician = await prisma.clinician.findUnique({ where: { userId: req.user!.id } }); if (!clinician) throw notFound('Clinician profile not found'); res.status(201).json(await prisma.availability.create({ data: { ...body, clinicianId: clinician.id } })); }));
export default router;
