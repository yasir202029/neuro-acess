import { afterEach, describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { isServerFlagEnabled, requireFlag } from "./flags";

const originalEnv = { ...process.env };
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env = { ...originalEnv };
  process.env.NODE_ENV = originalNodeEnv;
});

function mockRes() {
  const captured: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    json(body: unknown) {
      captured.body = body;
      return res;
    },
  };
  return { res: res as unknown as Response, captured };
}

describe("server flag enforcement", () => {
  it("development/test defaults enable the slice flags", () => {
    expect(isServerFlagEnabled("referralWorkflow", {})).toBe(true);
    expect(isServerFlagEnabled("clinicalNoteDrafting", {})).toBe(true);
    expect(isServerFlagEnabled("careJourneyEngine", {})).toBe(true);
  });

  it("production defaults are OFF without explicit enablement", () => {
    process.env.NODE_ENV = "production";
    expect(isServerFlagEnabled("referralWorkflow", {})).toBe(false);
    expect(isServerFlagEnabled("clinicalAiEnabled", {})).toBe(false);
  });

  it("global kill switch forces every flag OFF even when env enables it", () => {
    expect(
      isServerFlagEnabled("referralWorkflow", {
        NEUROCARE_KILL_SWITCH: "on",
        NEUROCARE_FLAG_REFERRAL_WORKFLOW: "on",
      }),
    ).toBe(false);
    expect(
      isServerFlagEnabled("clinicalNoteDrafting", {
        NEUROCARE_KILL_SWITCH: "1",
      }),
    ).toBe(false);
  });

  it("environment layer can disable a default-on flag", () => {
    expect(
      isServerFlagEnabled("referralWorkflow", {
        NEUROCARE_FLAG_REFERRAL_WORKFLOW: "off",
      }),
    ).toBe(false);
  });

  it("environment layer can enable a default-off flag", () => {
    expect(
      isServerFlagEnabled("adhdReportDrafting", {
        NEUROCARE_FLAG_ADHD_REPORT_DRAFTING: "on",
      }),
    ).toBe(true);
  });

  it("requireFlag passes when the flag resolves on", () => {
    const { res, captured } = mockRes();
    let nextCalled = false;
    process.env.NEUROCARE_FLAG_REFERRAL_WORKFLOW = "on";
    requireFlag("referralWorkflow")({} as Request, res, (() => {
      nextCalled = true;
    }) as NextFunction);
    expect(nextCalled).toBe(true);
    expect(captured.statusCode).toBeUndefined();
  });

  it("requireFlag rejects with 403 FEATURE_DISABLED when the kill switch is on", () => {
    const { res, captured } = mockRes();
    let nextCalled = false;
    process.env.NEUROCARE_KILL_SWITCH = "on";
    requireFlag("referralWorkflow")({} as Request, res, (() => {
      nextCalled = true;
    }) as NextFunction);
    expect(nextCalled).toBe(false);
    expect(captured.statusCode).toBe(403);
    expect(captured.body).toMatchObject({ code: "FEATURE_DISABLED" });
  });
});
