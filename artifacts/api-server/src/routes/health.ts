import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { authenticate } from "../security/auth";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  let dbStatus = "unavailable";
  try {
    await pool.query("SELECT 1");
    dbStatus = "connected";
  } catch {
    // Database not reachable — report status but don't fail the health check
  }
  res.json({ status: "ok", database: dbStatus });
});

/**
 * System status stream — operational status for workstation status displays.
 * Requires authentication. Reports aggregated status only, never sensitive
 * infrastructure internals.
 */
router.get("/system/status", authenticate, async (_req, res) => {
  let dbStatus = "unavailable";
  try {
    await pool.query("SELECT 1");
    dbStatus = "connected";
  } catch {
    dbStatus = "unavailable";
  }

  const services = [
    { name: "API", status: "operational" as const },
    { name: "Database", status: (dbStatus === "connected" ? "operational" : "degraded") as const },
    { name: "Message Delivery", status: "operational" as const },
    { name: "Document Processing", status: "operational" as const },
    { name: "Payment Services", status: "operational" as const },
    { name: "AI Service", status: "standby" as const },
    { name: "Background Jobs", status: "operational" as const },
  ];

  res.json({ services, timestamp: new Date().toISOString() });
});

export default router;
