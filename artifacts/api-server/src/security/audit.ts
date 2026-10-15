import type { Request, Response } from "express";

/** Records are intentionally structured and exclude request bodies, tokens, and clinical free text. */
export function auditEvent(req: Request, _res: unknown, action: string, resourceType: string, resourceId?: string, details?: Record<string, unknown>) {
  req.log.info({ audit: true, actorId: req.user?.id, clinicId: req.user?.clinicId, action, resourceType, resourceId, details, method: req.method, path: req.path }, "audit event");
}
