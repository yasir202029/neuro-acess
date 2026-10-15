import { Router, type IRouter } from "express";
import { auditEvent } from "../security/audit";
import { requirePermission } from "../security/auth";
const router: IRouter = Router();
const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const vitalTypes = new Set(["BLOOD_PRESSURE", "HEART_RATE", "WEIGHT_KG", "TEMPERATURE_C", "OXYGEN_SATURATION", "BLOOD_GLUCOSE"]);
router.post("/patients/:patientId/files", requirePermission("document:write"), (req, res) => {
  if (!isUuid(req.params.patientId)) return res.status(400).json({ error: "Invalid patient identifier." });
  auditEvent(req, res, "patient_file.upload.request", "patient", req.params.patientId);
  return res.status(503).json({ error: "Secure upload storage is unavailable until object storage (Supabase Storage or S3) and the tenant repository are configured.", code: "FILE_STORAGE_UNAVAILABLE" });
});
router.post("/patients/:patientId/physical-health", requirePermission("patient:write"), (req, res) => {
  if (!isUuid(req.params.patientId)) return res.status(400).json({ error: "Invalid patient identifier." });
  const body = req.body as Record<string, unknown>;
  if (typeof body.type !== "string" || !vitalTypes.has(body.type) || typeof body.value !== "number" || !Number.isFinite(body.value) || (body.unit !== undefined && typeof body.unit !== "string")) return res.status(400).json({ error: "Invalid physical-health measurement." });
  auditEvent(req, res, "physical_health.record.request", "patient", req.params.patientId);
  return res.status(503).json({ error: "Physical-health records are unavailable until tenant-scoped storage is connected.", code: "CLINICAL_STORAGE_UNAVAILABLE" });
});
export default router;
