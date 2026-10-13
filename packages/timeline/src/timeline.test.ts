import { describe, expect, it } from "vitest";
import { canViewerSeeEvent, filterTimelineForViewer, sortTimeline, type TimelineWorkflowEvent, type VisibilityLevel } from "./index.js";

const event = (over: Partial<TimelineWorkflowEvent> = {}): TimelineWorkflowEvent => ({
  id: "e1",
  type: "WORKFLOW_TRANSITION",
  occurredAt: "2026-01-01T00:00:00Z",
  recordedAt: "2026-01-01T00:00:00Z",
  title: "t",
  visibility: "ASSIGNED_TEAM" as VisibilityLevel,
  toStage: "ASSESSMENT",
  source: "test",
  ...over,
});

describe("timeline — visibility enforcement", () => {
  it("patient cannot see assigned-team or finance events", () => {
    expect(canViewerSeeEvent({ kind: "PATIENT" }, "PATIENT")).toBe(true);
    expect(canViewerSeeEvent({ kind: "PATIENT" }, "ASSIGNED_TEAM")).toBe(false);
    expect(canViewerSeeEvent({ kind: "PATIENT" }, "FINANCE")).toBe(false);
  });

  it("finance can see finance events but not restricted", () => {
    expect(canViewerSeeEvent({ kind: "FINANCE" }, "FINANCE")).toBe(true);
    expect(canViewerSeeEvent({ kind: "FINANCE" }, "RESTRICTED")).toBe(false);
  });

  it("filters a mixed timeline for a patient viewer", () => {
    const events = [
      event({ id: "a", visibility: "PATIENT" }),
      event({ id: "b", visibility: "CLINICAL_ORG" }),
      event({ id: "c", visibility: "PATIENT" }),
    ];
    const visible = filterTimelineForViewer(events, { kind: "PATIENT" });
    expect(visible.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("treats unknown visibility as restricted", () => {
    expect(canViewerSeeEvent({ kind: "CLINICAL_ORG" }, "NOPE" as never)).toBe(false);
  });
});

describe("timeline — sorting", () => {
  it("sorts newest first", () => {
    const sorted = sortTimeline([
      event({ id: "old", occurredAt: "2026-01-01T00:00:00Z" }),
      event({ id: "new", occurredAt: "2026-02-01T00:00:00Z" }),
    ]);
    expect(sorted[0]?.id).toBe("new");
  });
});
