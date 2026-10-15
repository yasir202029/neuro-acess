import { Router } from 'express';
import { z } from 'zod';
import { MessageChannel, Role } from '@prisma/client';
import { prisma } from '../../shared/db.js';
import { asyncHandler } from '../../shared/http.js';
import { audit } from '../../middleware/audit.js';
import { requireAuth } from '../../middleware/auth.js';
import { NotificationsService } from '../../services/notifications.service.js';

const router = Router();
const notifications = new NotificationsService();
router.use(requireAuth);
router.get('/', asyncHandler(async (req, res) => { const patient = await prisma.patient.findUnique({ where: { userId: req.user!.id } }); const threads = await prisma.messageThread.findMany({ where: { patientId: patient?.id }, include: { messages: { orderBy: { createdAt: 'desc' } } }, orderBy: { updatedAt: 'desc' } }); res.json(threads); }));
router.post('/', audit('MESSAGE_CREATED', 'Message'), asyncHandler(async (req, res) => { const body = z.object({ patientId: z.string().cuid().optional(), channel: z.nativeEnum(MessageChannel).default(MessageChannel.IN_APP), subject: z.string().max(200).optional(), body: z.string().min(1).max(10000) }).parse(req.body); const patient = body.patientId ? { id: body.patientId } : await prisma.patient.findUniqueOrThrow({ where: { userId: req.user!.id }, select: { id: true } }); const thread = await prisma.messageThread.create({ data: { patientId: patient.id, subject: body.subject, messages: { create: { body: body.body, channel: body.channel, senderId: req.user!.id, status: 'QUEUED' } } }, include: { messages: true } }); if (body.channel === MessageChannel.EMAIL) await notifications.email('patient@example.com', body.subject ?? 'NeuroCare message', body.body); res.status(201).json(thread); }));
export default router;
