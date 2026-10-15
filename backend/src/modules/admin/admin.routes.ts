import { Router } from 'express';
import { Role, UserStatus } from '@prisma/client';
import { prisma } from '../../shared/db.js';
import { asyncHandler } from '../../shared/http.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole(Role.ADMIN));
router.get('/users', asyncHandler(async (_req, res) => { res.json(await prisma.user.findMany({ select: { id: true, email: true, firstName: true, lastName: true, roles: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' } })); }));
router.patch('/users/:id/status', asyncHandler(async (req, res) => { const status = req.body.status as UserStatus; if (!Object.values(UserStatus).includes(status)) { res.status(400).json({ error: { code: 'BAD_STATUS', message: 'Invalid user status' } }); return; } res.json(await prisma.user.update({ where: { id: String(req.params.id) }, data: { status } })); }));
router.get('/reports/summary', asyncHandler(async (_req, res) => { const [users, patients, assessments, appointments, invoices] = await Promise.all([prisma.user.count(), prisma.patient.count(), prisma.assessment.count(), prisma.appointment.count(), prisma.invoice.count()]); res.json({ users, patients, assessments, appointments, invoices }); }));
export default router;
