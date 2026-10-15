import type { RequestHandler } from 'express';
import { prisma } from '../shared/db.js';

export const audit = (action: string, resource: string): RequestHandler => async (req, _res, next) => {
  try {
    await prisma.auditEvent.create({ data: { actorId: req.user?.id, action, resource, resourceId: req.params.id ? String(req.params.id) : req.params.patientId ? String(req.params.patientId) : undefined, ipAddress: req.ip ? String(req.ip) : null, metadata: { method: req.method, path: req.path, requestId: (req as unknown as { requestId?: string }).requestId } } });
    next();
  } catch (error) { next(error); }
};
