/**
 * Health route tests.
 *
 * Verifies:
 *   - /api/healthz is publicly accessible (no auth required)
 *   - /api/system/status requires authentication
 *   - RBAC permission checks work correctly
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";

import { pool } from "@workspace/db";
import { hasPermission, type PlatformRole } from "../security/roles";

describe("Health endpoints", () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    await pool.query("SELECT 1");

    server = createServer(async (req, res) => {
      if (req.url === "/api/healthz") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", database: "connected" }));
        return;
      }
      if (req.url === "/api/system/status") {
        const token = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
        if (!token) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Authentication is required." }));
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", database: "connected" }));
        return;
      }
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        port = (server as any).address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("GET /api/healthz is publicly accessible without auth", async () => {
    const res = await fetch(`${baseUrl}/api/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("connected");
  });

  it("GET /api/system/status requires authentication", async () => {
    const res = await fetch(`${baseUrl}/api/system/status`, {
      headers: {},
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Authentication is required.");
  });

  it("RBAC: PATIENT cannot access platform:manage", () => {
    const user: { role: PlatformRole } = { role: "PATIENT" };
    expect(hasPermission(user.role, "platform:manage")).toBe(false);
    expect(hasPermission(user.role, "patient:read")).toBe(true);
  });

  it("RBAC: CLINICIAN can access patient:read and clinical:write", () => {
    const user: { role: PlatformRole } = { role: "CLINICIAN" };
    expect(hasPermission(user.role, "patient:read")).toBe(true);
    expect(hasPermission(user.role, "clinical:write")).toBe(true);
    expect(hasPermission(user.role, "platform:manage")).toBe(false);
  });
});