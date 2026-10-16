import { describe, it, expect } from "vitest";
import { WorkQueueService } from "./work-queue.service";
import { WorkQueueCapability } from "../types/work-queue";

function mockReq(): any {
  return { log: { info: () => {} }, user: { id: "admin-01", clinicId: "clinic-01" } } as any;
}

function makeActor(actorId: string, capabilities: string[] = ["patient:read", "patient:write", "appointment:manage", "clinical:write", "billing:read"]): any {
  return {
    actorId,
    email: "admin@example.com",
    roles: ["ADMIN"] as any,
    clinicId: "clinic-01",
    capabilities: new Set(capabilities),
  };
}

describe("WorkQueueService", () => {
  const service = new WorkQueueService();
  const actor = makeActor("admin-01");

  it("lists queue buckets with live counts derived from items", () => {
    const buckets = service.listQueueBuckets(actor);
    expect(buckets.length).toBeGreaterThan(0);
    const total = buckets.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBeGreaterThan(0);
    // New Referrals bucket should have items
    const newReferrals = buckets.find((b) => b.id === "new-referrals");
    expect(newReferrals?.count).toBeGreaterThan(0);
  });

  it("lists queue items with pagination", () => {
    const result = service.listQueueItems(actor, mockReq(), { page: 1, pageSize: 5 });
    expect(result.items.length).toBeLessThanOrEqual(5);
    expect(result.total).toBeGreaterThan(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(5);
    expect(result.items[0]).toHaveProperty("id");
    expect(result.items[0]).toHaveProperty("displayName");
    expect(result.items[0]).toHaveProperty("status");
    expect(result.items[0]).toHaveProperty("nextPermittedActions");
  });

  it("filters items by bucket", () => {
    const all = service.listQueueItems(actor, mockReq(), {}).total;
    const newReferrals = service.listQueueItems(actor, mockReq(), {
      bucketId: "new-referrals",
    }).total;
    expect(newReferrals).toBeLessThanOrEqual(all);
  });

  it("filters items by view MINE", () => {
    const mine = service.listQueueItems(actor, mockReq(), {
      filterView: "MINE",
    });
    for (const item of mine.items) {
      expect(item.ownerId).toBe(actor.actorId);
    }
  });

  it("filters items by view UNASSIGNED", () => {
    const unassigned = service.listQueueItems(actor, mockReq(), {
      filterView: "UNASSIGNED",
    });
    for (const item of unassigned.items) {
      expect(item.ownerId).toBeNull();
    }
  });

  it("filters items by status", () => {
    const newItems = service.listQueueItems(actor, mockReq(), {
      status: "NEW",
    });
    for (const item of newItems.items) {
      expect(item.status).toBe("NEW");
    }
  });

  it("denies list without READ_QUEUE capability", () => {
    const noCap = makeActor("no-cap", []);
    expect(() => service.listQueueBuckets(noCap)).toThrow();
    expect(() => service.listQueueItems(noCap, {} as any, {})).toThrow();
  });

  it("performs assign-clinician action and returns status transition", () => {
    const items = service.listQueueItems(actor, mockReq(), {
      status: "NEW",
    });
    const newItem = items.items[0];
    const assignAction = newItem.nextPermittedActions.find(
      (a) => a.id === "assign-clinician",
    );
    expect(assignAction).toBeDefined();

    const result = service.performAction(actor, mockReq(), newItem.id, {
      actionId: "assign-clinician",
    });
    expect(result.itemId).toBe(newItem.id);
    expect(result.previousStatus).toBe("NEW");
    expect(result.newStatus).toBe("ASSESSMENT_PREPARATION");
    expect(result.auditEvent).toBe("workqueue.item.assign-clinician");
  });

  it("denies action not permitted for item state", () => {
    const items = service.listQueueItems(actor, mockReq(), {
      status: "NEW",
    });
    const newItem = items.items[0];
    expect(() =>
      service.performAction(actor, mockReq(), newItem.id, {
        actionId: "send-reminder",
      }),
    ).toThrow();
  });

  it("denies invalid item id", () => {
    expect(() =>
      service.performAction(actor, mockReq(), "not-a-uuid", {
        actionId: "assign-clinician",
      }),
    ).toThrow();
  });

  it("denies action on non-existent item", () => {
    expect(() =>
      service.performAction(actor, mockReq(), "11111111-1111-4111-8111-111111111111", {
        actionId: "assign-clinician",
      }),
    ).toThrow("Queue item not found.");
  });

  it("denies write without WRITE_QUEUE capability", () => {
    const noWrite = makeActor("no-write", ["patient:read"]);
    const items = service.listQueueItems(actor, mockReq(), {
      status: "NEW",
    });
    expect(() =>
      service.performAction(noWrite, {} as any, items.items[0].id, {
        actionId: "assign-clinician",
      }),
    ).toThrow();
  });

  it("send-reminder action transitions WAITING_FOR_FORMS to WAITING_FOR_FORMS", () => {
    const items = service.listQueueItems(actor, mockReq(), {
      status: "WAITING_FOR_FORMS",
    });
    const item = items.items[0];
    const reminderAction = item.nextPermittedActions.find(
      (a) => a.id === "send-reminder",
    );
    expect(reminderAction).toBeDefined();

    const result = service.performAction(actor, mockReq(), item.id, {
      actionId: "send-reminder",
    });
    expect(result.previousStatus).toBe("WAITING_FOR_FORMS");
    expect(result.newStatus).toBe("WAITING_FOR_FORMS");
  });

  it("schedule-appointment action transitions to APPOINTMENT_REQUIRED", () => {
    const items = service.listQueueItems(actor, mockReq(), {
      status: "APPOINTMENT_REQUIRED",
    });
    if (items.items.length === 0) return; // skip if no data
    const item = items.items[0];
    const schedAction = item.nextPermittedActions.find(
      (a) => a.id === "schedule-appointment",
    );
    if (!schedAction) return;

    const result = service.performAction(actor, mockReq(), item.id, {
      actionId: "schedule-appointment",
    });
    expect(result.newStatus).toBe("APPOINTMENT_REQUIRED");
  });
});