import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

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

export default router;
