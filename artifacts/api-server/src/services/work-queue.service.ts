/**
 * Work Queue service layer for the APEX Operations Tower / Flowgrid.
 *
 * Synthetic development service: validates inputs, enforces capability checks,
 * emits audit events, returns shaped responses. Deny-by-default: every public
 * method requires an actor with the needed capability; the actor is always
 * server-derived, never client-supplied.
 *
 * In production this layer queries Drizzle/PostgreSQL for real queue items.
 * For development, synthetic queue items are returned and clearly marked.
 */

import { randomUUID } from "node:crypto";
import { auditEvent } from "../security/audit";
import type { Request } from "express";
import type {
  WorkQueueActor,
  WorkQueueItem,
  WorkQueueAction,
  WorkQueueBucket,
  PaginatedWorkQueueItems,
  WorkQueueActionRequest,
  WorkQueueActionResponse,
  WorkQueueStatus,
  WorkQueueTaskType,
  WorkQueuePriority,
  WorkQueueCapability,
  WorkQueueFilterView,
} from "../types/work-queue";
import { WorkQueueError, WORK_QUEUE_BUCKETS } from "../types/work-queue";
import { WorkQueueCapability as WQCap } from "../types/work-queue";
const SYNTHETIC_CLINICIANS: Array<{ id: string; displayName: string }> = [
  { id: "clinician-01", displayName: "Dr. Sarah Chen" },
  { id: "clinician-02", displayName: "Dr. Marcus Okonkwo" },
  { id: "clinician-03", displayName: "Dr. Elena Rodriguez" },
];

const SYNTHETIC_PATIENTS: Array<{ id: string; displayName: string }> = [
  { id: "patient-01", displayName: "Maya Thompson" },
  { id: "patient-02", displayName: "Oliver Grant" },
  { id: "patient-03", displayName: "Amelia Wright" },
  { id: "patient-04", displayName: "James Callahan" },
  { id: "patient-05", displayName: "Sophie Dubois" },
];

function nextActionsFor(status: WorkQueueStatus, taskType: WorkQueueTaskType, ownerId: string | null, actorId: string): readonly WorkQueueAction[] {
  const actions: WorkQueueAction[] = [];

  if (status === "NEW" && taskType === "NEW_REFERRAL") {
    actions.push({
      id: "assign-clinician",
      label: "Assign clinician",
      endpoint: "/workstation/queue/items/{id}/actions/assign-clinician",
      method: "POST",
      permission: "appointment:manage",
      requiresConfirmation: true,
    });
  }

  if (status === "WAITING_FOR_FORMS" && (ownerId === null || ownerId === "patient")) {
    actions.push({
      id: "send-reminder",
      label: "Send reminder",
      endpoint: "/workstation/queue/items/{id}/actions/send-reminder",
      method: "POST",
      permission: "patient:write",
      requiresConfirmation: false,
    });
  }

  if (status === "APPOINTMENT_REQUIRED") {
    actions.push({
      id: "schedule-appointment",
      label: "Schedule appointment",
      endpoint: "/workstation/queue/items/{id}/actions/schedule-appointment",
      method: "POST",
      permission: "appointment:manage",
      requiresConfirmation: true,
    });
  }

  if (status === "CLINICIAN_ASSIGNMENT_REQUIRED") {
    actions.push({
      id: "assign-clinician",
      label: "Assign clinician",
      endpoint: "/workstation/queue/items/{id}/actions/assign-clinician",
      method: "POST",
      permission: "appointment:manage",
      requiresConfirmation: true,
    });
  }

  if (status === "ASSESSMENT_PREPARATION") {
    actions.push({
      id: "open-patient",
      label: "Open patient",
      endpoint: "/workstation/queue/items/{id}/actions/open-patient",
      method: "POST",
      permission: "patient:read",
      requiresConfirmation: false,
    });
  }

  if (status === "ASSESSMENT_COMPLETE_REVIEW_REQUIRED") {
    actions.push({
      id: "open-assessment",
      label: "Open assessment",
      endpoint: "/workstation/queue/items/{id}/actions/open-assessment",
      method: "POST",
      permission: "clinical:write",
      requiresConfirmation: false,
    });
  }

  if (status === "REPORT_PENDING") {
    actions.push({
      id: "open-patient",
      label: "Open patient",
      endpoint: "/workstation/queue/items/{id}/actions/open-patient",
      method: "POST",
      permission: "patient:read",
      requiresConfirmation: false,
    });
    actions.push({
      id: "review-payment",
      label: "Review payment",
      endpoint: "/workstation/queue/items/{id}/actions/review-payment",
      method: "POST",
      permission: "billing:read",
      requiresConfirmation: false,
    });
  }

  if (status === "PAYMENT_REQUIRED") {
    actions.push({
      id: "review-payment",
      label: "Review payment",
      endpoint: "/workstation/queue/items/{id}/actions/review-payment",
      method: "POST",
      permission: "billing:read",
      requiresConfirmation: false,
    });
  }

  if (status === "TITRATION_REVIEW_DUE") {
    actions.push({
      id: "open-patient",
      label: "Open patient",
      endpoint: "/workstation/queue/items/{id}/actions/open-patient",
      method: "POST",
      permission: "patient:read",
      requiresConfirmation: false,
    });
  }

  if (status === "VITALS_REQUIRED") {
    actions.push({
      id: "open-patient",
      label: "Open patient",
      endpoint: "/workstation/queue/items/{id}/actions/open-patient",
      method: "POST",
      permission: "patient:read",
      requiresConfirmation: false,
    });
  }

  if (status === "PRESCRIPTION_ADMINISTRATION") {
    actions.push({
      id: "open-patient",
      label: "Open patient",
      endpoint: "/workstation/queue/items/{id}/actions/open-patient",
      method: "POST",
      permission: "patient:read",
      requiresConfirmation: false,
    });
  }

  if (status === "FOLLOW_UP_REQUIRED") {
    actions.push({
      id: "schedule-appointment",
      label: "Schedule appointment",
      endpoint: "/workstation/queue/items/{id}/actions/schedule-appointment",
      method: "POST",
      permission: "appointment:manage",
      requiresConfirmation: true,
    });
  }

  if (status === "ADMINISTRATIVE_EXCEPTION") {
    actions.push({
      id: "resolve-admin-task",
      label: "Resolve administrative task",
      endpoint: "/workstation/queue/items/{id}/actions/resolve-admin-task",
      method: "POST",
      permission: "patient:write",
      requiresConfirmation: true,
    });
  }

  return actions;
}
import { WorkQueueCapability as WQCap } from "../types/work-queue";

function requireCapability(actor: WorkQueueActor | undefined, capability: WorkQueueCapability): void {
  if (!actor || !actor.capabilities.has(capability)) {
    throw new WorkQueueError(403, "INSUFFICIENT_CAPABILITY", `Capability required: ${capability}`);
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildSyntheticItems(actor: WorkQueueActor): WorkQueueItem[] {
  const items: WorkQueueItem[] = [];
  const clinicians = SYNTHETIC_CLINICIANS;
  const patients = SYNTHETIC_PATIENTS;

  const data: Array<{
    patientIndex: number;
    taskType: WorkQueueTaskType;
    workflowStage: string;
    status: WorkQueueStatus;
    ownerIndex: number | null;
    priority: WorkQueuePriority;
    createdAtOffsetDays: number;
    dueAtOffsetDays: number | null;
    blockingReason: string | null;
  }> = [
    { patientIndex: 0, taskType: "NEW_REFERRAL", workflowStage: "REFERRAL", status: "NEW", ownerIndex: null, priority: "URGENT", createdAtOffsetDays: -2, dueAtOffsetDays: null, blockingReason: null },
    { patientIndex: 1, taskType: "NEW_REFERRAL", workflowStage: "REFERRAL", status: "NEW", ownerIndex: null, priority: "ROUTINE", createdAtOffsetDays: -5, dueAtOffsetDays: null, blockingReason: null },
    { patientIndex: 2, taskType: "NEW_REFERRAL", workflowStage: "REFERRAL", status: "NEW", ownerIndex: null, priority: "ROUTINE", createdAtOffsetDays: -1, dueAtOffsetDays: null, blockingReason: null },
    { patientIndex: 0, taskType: "INTAKE_QUESTIONNAIRE", workflowStage: "INTAKE", status: "WAITING_FOR_FORMS", ownerIndex: null, priority: "ROUTINE", createdAtOffsetDays: -3, dueAtOffsetDays: -1, blockingReason: "Patient has not returned intake forms." },
    { patientIndex: 1, taskType: "INFORMANT_QUESTIONNAIRE", workflowStage: "INTAKE", status: "WAITING_FOR_INFORMANT", ownerIndex: null, priority: "ROUTINE", createdAtOffsetDays: -7, dueAtOffsetDays: -3, blockingReason: "Informant questionnaire outstanding." },
    { patientIndex: 3, taskType: "INITIAL_ASSESSMENT", workflowStage: "ASSESSMENT", status: "APPOINTMENT_REQUIRED", ownerIndex: null, priority: "URGENT", createdAtOffsetDays: -4, dueAtOffsetDays: 2, blockingReason: null },
    { patientIndex: 4, taskType: "INITIAL_ASSESSMENT", workflowStage: "ASSESSMENT", status: "CLINICIAN_ASSIGNMENT_REQUIRED", ownerIndex: null, priority: "ROUTINE", createdAtOffsetDays: -6, dueAtOffsetDays: null, blockingReason: null },
    { patientIndex: 2, taskType: "FOLLOW_UP_ASSESSMENT", workflowStage: "ASSESSMENT", status: "ASSESSMENT_PREPARATION", ownerIndex: 0, priority: "ROUTINE", createdAtOffsetDays: -8, dueAtOffsetDays: 5, blockingReason: null },
    { patientIndex: 1, taskType: "TITRATION_REVIEW", workflowStage: "TITRATION", status: "ASSESSMENT_COMPLETE_REVIEW_REQUIRED", ownerIndex: 0, priority: "URGENT", createdAtOffsetDays: -10, dueAtOffsetDays: null, blockingReason: null },
    { patientIndex: 0, taskType: "REPORT_WRITING", workflowStage: "REPORT", status: "REPORT_PENDING", ownerIndex: 0, priority: "ROUTINE", createdAtOffsetDays: -12, dueAtOffsetDays: -2, blockingReason: null },
    { patientIndex: 3, taskType: "PRESCRIPTION_ADMIN", workflowStage: "TREATMENT", status: "PAYMENT_REQUIRED", ownerIndex: null, priority: "URGENT", createdAtOffsetDays: -1, dueAtOffsetDays: 1, blockingReason: null },
    { patientIndex: 4, taskType: "VITALS_CHECK", workflowStage: "TREATMENT", status: "VITALS_REQUIRED", ownerIndex: 1, priority: "ROUTINE", createdAtOffsetDays: -3, dueAtOffsetDays: null, blockingReason: null },
    { patientIndex: 2, taskType: "PRESCRIPTION_ADMIN", workflowStage: "TREATMENT", status: "PRESCRIPTION_ADMINISTRATION", ownerIndex: 0, priority: "STAT", createdAtOffsetDays: 0, dueAtOffsetDays: null, blockingReason: null },
    { patientIndex: 3, taskType: "FOLLOW_UP_ASSESSMENT", workflowStage: "FOLLOW_UP", status: "FOLLOW_UP_REQUIRED", ownerIndex: 1, priority: "ROUTINE", createdAtOffsetDays: -14, dueAtOffsetDays: -1, blockingReason: null },
    { patientIndex: 4, taskType: "ADMINISTRATIVE_TASK", workflowStage: "ADMINISTRATION", status: "ADMINISTRATIVE_EXCEPTION", ownerIndex: null, priority: "URGENT", createdAtOffsetDays: -2, dueAtOffsetDays: 3, blockingReason: "Missing consent documentation." },
  ];

  for (const d of data) {
    const patient = SYNTHETIC_PATIENTS[d.patientIndex];
    const owner = d.ownerIndex !== null ? SYNTHETIC_CLINICIANS[d.ownerIndex] : null;
    const createdAt = new Date(Date.now() + d.createdAtOffsetDays * 86_400_000).toISOString();
    const dueAt = d.dueAtOffsetDays !== null ? new Date(Date.now() + d.dueAtOffsetDays * 86_400_000).toISOString() : null;

    items.push({
      id: randomUUID(),
      patientId: patient.id,
      displayName: patient.displayName,
      taskType: d.taskType,
      workflowStage: d.workflowStage,
      status: d.status,
      ownerId: owner?.id ?? null,
      ownerDisplayName: owner?.displayName ?? null,
      priority: d.priority,
      createdAt,
      dueAt,
      blockingReason: d.blockingReason,
      nextPermittedActions: nextActionsFor(d.status, d.taskType, d.ownerId ?? null, actor.actorId),
    });
  }

  return items;
}
export class WorkQueueService {
  private cachedItems: WorkQueueItem[] | null = null;

  private getItems(actor: WorkQueueActor): WorkQueueItem[] {
    if (!this.cachedItems) {
      this.cachedItems = buildSyntheticItems(actor);
    }
    return this.cachedItems;
  }

  listQueueBuckets(actor: WorkQueueActor | undefined): WorkQueueBucket[] {
    requireCapability(actor, WQCap.READ_QUEUE);
    const items = this.getItems(actor!);
    const buckets = [...WORK_QUEUE_BUCKETS];
    for (const bucket of buckets) {
      bucket.count = items.filter((i) => {
        if (bucket.statusFilter && i.status !== bucket.statusFilter) return false;
        if (bucket.taskTypeFilter && i.taskType !== bucket.taskTypeFilter) return false;
        return true;
      }).length;
    }
    return buckets;
  }
  listQueueItems(
    actor: WorkQueueActor | undefined,
    req: Request,
    {
      bucketId,
      filterView,
      search,
      status,
      taskType,
      owner,
      priority,
      page,
      pageSize,
    }: {
      bucketId?: string;
      filterView?: WorkQueueFilterView;
      search?: string;
      status?: WorkQueueStatus;
      taskType?: WorkQueueTaskType;
      owner?: string;
      priority?: WorkQueuePriority;
      page?: number;
      pageSize?: number;
    },
  ): PaginatedWorkQueueItems {
    requireCapability(actor, WQCap.READ_QUEUE);

    let items = this.getItems(actor!);

    if (bucketId) {
      const bucket = WORK_QUEUE_BUCKETS.find((b) => b.id === bucketId);
      if (bucket) {
        if (bucket.statusFilter) items = items.filter((i) => i.status === bucket.statusFilter);
        if (bucket.taskTypeFilter) items = items.filter((i) => i.taskType === bucket.taskTypeFilter);
      }
    }

    if (filterView) {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      switch (filterView) {
        case "MINE":
          items = items.filter((i) => i.ownerId === actor!.actorId);
          break;
        case "UNASSIGNED":
          items = items.filter((i) => i.ownerId === null);
          break;
        case "DUE_TODAY":
          items = items.filter((i) => i.dueAt && new Date(i.dueAt).getTime() >= todayStart && new Date(i.dueAt).getTime() < todayStart + 86_400_000);
          break;
        case "OVERDUE":
          items = items.filter((i) => i.dueAt && new Date(i.dueAt).getTime() < todayStart);
          break;
        case "BLOCKED":
          items = items.filter((i) => i.blockingReason !== null);
          break;
        case "WAITING_FOR_PATIENT":
          items = items.filter((i) => i.status === "WAITING_FOR_FORMS" || i.status === "WAITING_FOR_INFORMANT");
          break;
        case "WAITING_FOR_CLINICIAN":
          items = items.filter((i) => i.status === "CLINICIAN_ASSIGNMENT_REQUIRED");
          break;
        case "WAITING_FOR_ADMIN":
          items = items.filter((i) => i.status === "ADMINISTRATIVE_EXCEPTION");
          break;
        case "ALL":
        default:
          break;
      }
    }

    if (status) items = items.filter((i) => i.status === status);
    if (taskType) items = items.filter((i) => i.taskType === taskType);
    if (owner) items = items.filter((i) => i.ownerDisplayName?.toLowerCase().includes(owner.toLowerCase()));
    if (priority) items = items.filter((i) => i.priority === priority);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((i) => i.displayName.toLowerCase().includes(q) || i.taskType.toLowerCase().includes(q));
    }

    const p = Math.max(1, page ?? 1);
    const ps = Math.min(100, Math.max(1, pageSize ?? 20));
    const total = items.length;
    const start = (p - 1) * ps;
    const pageItems = items.slice(start, start + ps);

    return { items: pageItems, total, page: p, pageSize: ps };
  }
  performAction(
    actor: WorkQueueActor | undefined,
    req: Request,
    itemId: string,
    action: WorkQueueActionRequest,
  ): WorkQueueActionResponse {
    requireCapability(actor, WQCap.WRITE_QUEUE);

    if (!isUuid(itemId)) {
      throw new WorkQueueError(400, "INVALID_QUEUE_ITEM_ID", "Invalid queue item identifier.");
    }

    const items = this.getItems(actor!);
    const item = items.find((i) => i.id === itemId);
    if (!item) {
      throw new WorkQueueError(404, "QUEUE_ITEM_NOT_FOUND", "Queue item not found.");
    }

    const permittedAction = item.nextPermittedActions.find((a) => a.id === action.actionId);
    if (!permittedAction) {
      throw new WorkQueueError(403, "ACTION_NOT_PERMITTED", `Action "${action.actionId}" is not permitted for this queue item in its current state.`);
    }

    requireCapability(actor, permittedAction.permission as WorkQueueCapability);

    const previousStatus = item.status;
    let newStatus: WorkQueueStatus;

    switch (action.actionId) {
      case "assign-clinician":
        newStatus = "ASSESSMENT_PREPARATION";
        auditEvent(req, resPlaceholder(req), "workqueue.item.assign-clinician", "queueItem", itemId, { patientId: item.patientId, previousStatus, newStatus });
        break;
      case "send-reminder":
        newStatus = "WAITING_FOR_FORMS";
        auditEvent(req, resPlaceholder(req), "workqueue.item.send-reminder", "queueItem", itemId, { patientId: item.patientId, previousStatus, newStatus });
        break;
      case "schedule-appointment":
        newStatus = "APPOINTMENT_REQUIRED";
        auditEvent(req, resPlaceholder(req), "workqueue.item.schedule-appointment", "queueItem", itemId, { patientId: item.patientId, previousStatus, newStatus });
        break;
      case "open-patient":
        newStatus = previousStatus;
        auditEvent(req, resPlaceholder(req), "workqueue.item.open-patient", "queueItem", itemId, { patientId: item.patientId });
        break;
      case "open-assessment":
        newStatus = previousStatus;
        auditEvent(req, resPlaceholder(req), "workqueue.item.open-assessment", "queueItem", itemId, { patientId: item.patientId });
        break;
      case "review-payment":
        newStatus = "PAYMENT_REQUIRED";
        auditEvent(req, resPlaceholder(req), "workqueue.item.review-payment", "queueItem", itemId, { patientId: item.patientId, previousStatus, newStatus });
        break;
      case "resolve-admin-task":
        newStatus = "FOLLOW_UP_REQUIRED";
        auditEvent(req, resPlaceholder(req), "workqueue.item.resolve-admin-task", "queueItem", itemId, { patientId: item.patientId, previousStatus, newStatus });
        break;
      default:
        throw new WorkQueueError(400, "UNKNOWN_ACTION", `Unknown action "${action.actionId}".`);
    }

    return {
      itemId,
      previousStatus,
      newStatus,
      auditEvent: `workqueue.item.${action.actionId}`,
    };
  }
}

function resPlaceholder(req: Request): { status: () => { json: () => void }; header: () => void } {
  return {
    status: () => ({ json: () => undefined }),
    header: () => undefined,
  };
}
const NOW = new Date().toISOString();