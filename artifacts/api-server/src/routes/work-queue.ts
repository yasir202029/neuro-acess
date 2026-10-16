import { Router, type IRouter } from "express";
import { z } from "zod";
import { authenticate, requirePermission, type AuthenticatedUser } from "../security/auth";
import { auditEvent } from "../security/audit";
import { WorkQueueService } from "../services/work-queue.service";
import { WorkQueueActor, WorkQueueError, WorkQueueFilterView, type WorkQueueActionRequest } from "../types/work-queue";
import type { Capability } from "@neurocare/permissions";
import { hasPermission, permissions as allPermissions, type Permission } from "../security/roles";

const router: IRouter = Router();
const service = new WorkQueueService();

function actorFromUser(user: AuthenticatedUser): WorkQueueActor {
  // Derive the capability set server-side from the platform role grants —
  // never trust a client-supplied capability list.
  const role = user.role as Parameters<typeof hasPermission>[0];
  const capabilities = new Set<string>(
    allPermissions.filter((p) => hasPermission(role, p as Permission)),
  ) as unknown as ReadonlySet<Capability>;
  return {
    actorId: user.id,
    email: user.email,
    roles: [user.role] as unknown as string[],
    clinicId: user.clinicId ?? null,
    capabilities,
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

const queueItemIdParam = z.object({ itemId: z.string().uuid("Invalid queue item identifier.") });

const actionBody = z
  .object({
    actionId: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// ── Queue summary / buckets ──
router.get(
  "/workstation/queue/summary",
  authenticate,
  requirePermission("patient:read"),
  (req, res) => {
    try {
      const actor = actorFromUser(req.user!);
      const buckets = service.listQueueBuckets(actor);
      auditEvent(req, res, "workqueue.summary.read", "workstation");
      return res.json({ buckets });
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

// ── Queue items (paginated, filterable) ──
router.get(
  "/workstation/queue/items",
  authenticate,
  requirePermission("patient:read"),
  (req, res) => {
    try {
      const actor = actorFromUser(req.user!);
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const status = req.query.status as WorkQueueFilterView | undefined;
      const taskType = req.query.taskType as string | undefined;
      const owner = typeof req.query.owner === "string" ? req.query.owner : undefined;
      const priority = req.query.priority as string | undefined;
      const bucketId = typeof req.query.bucketId === "string" ? req.query.bucketId : undefined;
      const filterView = req.query.filterView as WorkQueueFilterView | undefined;

      const result = service.listQueueItems(actor, req, {
        bucketId,
        filterView,
        search,
        status: status as any,
        taskType: taskType as any,
        owner,
        priority: priority as any,
        page,
        pageSize,
      });

      auditEvent(req, res, "workqueue.items.read", "workstation");
      return res.json(result);
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

// ── Perform a next action on a queue item ──
router.post(
  "/workstation/queue/items/:itemId/actions/:actionId",
  authenticate,
  requirePermission("patient:write"),
  (req, res) => {
    try {
      const actor = actorFromUser(req.user!);
      const params = queueItemIdParam.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ error: "Invalid queue item identifier.", code: "INVALID_QUEUE_ITEM_ID" });
      }

      const body = actionBody.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({ error: "Invalid action request.", code: "INVALID_ACTION_REQUEST" });
      }

      const actionRequest: WorkQueueActionRequest = {
        actionId: body.data.actionId,
        payload: body.data.payload,
      };

      const result = service.performAction(actor, req, params.data.itemId, actionRequest);
      auditEvent(req, res, result.auditEvent, "queueItem", params.data.itemId, {
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
      });

      return res.json(result);
    } catch (error) {
      return handleServiceError(res, error);
    }
  },
);

export default router;