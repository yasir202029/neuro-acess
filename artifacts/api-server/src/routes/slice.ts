/**
 * Slice 1 HTTP routes — referral to assessment.
 * See docs/delivery/SLICE1_DESIGN.md for contracts.
 */
import {
  Router,
  type Express,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import express from "express";
import { SliceService } from "../slice/service";
import { SliceError } from "../slice/types";
import { requirePermission } from "../security/auth";
import { requireFlag } from "../security/flags";
import { InMemorySliceStore, getSliceStore } from "../slice/store";

const PATHWAYS = new Set(["ADHD", "AUTISM", "BOTH"]);
const REFERRAL_SOURCES = new Set(["SELF", "GP", "OTHER"]);

function isNonEmptyString(value: unknown, max = 4000): value is string {
  return (
    typeof value === "string" && value.trim().length > 0 && value.length <= max
  );
}

function errorBody(err: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (err instanceof SliceError) {
    const body: Record<string, unknown> = {
      error: err.message,
      code: err.code,
    };
    if (err.details !== undefined) body.details = err.details;
    return { status: err.status, body };
  }
  return { status: 500, body: { error: "An unexpected error occurred." } };
}

function requireSlicePrincipal(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user)
    return res.status(401).json({ error: "Authentication is required." });
  return next();
}

function actorOf(req: Request) {
  const user = req.user!;
  return { actorId: user.id, roles: [user.role] as readonly string[] };
}

/** Express 5 types params as `string | string[]`; slice ids are single segments. */
function paramOf(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function asyncRoute(
  handler: (req: Request, res: Response) => Promise<unknown>,
) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((err: unknown) => {
      const mapped = errorBody(err);
      return res.status(mapped.status).json(mapped.body);
    });
  };
}

export function createSliceRouter(service: SliceService): IRouter {
  const router: IRouter = Router();

  router.post(
    "/slice/referrals",
    requireSlicePrincipal,
    requirePermission("patient:write"),
    requireFlag("referralWorkflow"),
    asyncRoute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (
        typeof body.pathway !== "string" ||
        !PATHWAYS.has(body.pathway) ||
        typeof body.referralSource !== "string" ||
        !REFERRAL_SOURCES.has(body.referralSource) ||
        !isNonEmptyString(body.presentingConcern, 2000) ||
        !isNonEmptyString(body.displayName, 200)
      ) {
        return res
          .status(400)
          .json({
            error:
              "Valid pathway, source, concern and display name are required.",
          });
      }
      const result = await service.requestAssessment(actorOf(req), {
        pathway: body.pathway as "ADHD" | "AUTISM" | "BOTH",
        referralSource: body.referralSource as "SELF" | "GP" | "OTHER",
        presentingConcern: body.presentingConcern.trim(),
        displayName: body.displayName.trim(),
      });
      return res
        .status(201)
        .json({
          referral: result.referral,
          patientId: result.referral.patientId,
          journey: result.journey,
        });
    }),
  );

  router.post(
    "/slice/referrals/:id/validate",
    requireSlicePrincipal,
    requirePermission("patient:write"),
    requireFlag("referralWorkflow"),
    asyncRoute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const ok =
        body.status === "VALIDATED" || body.status === "MISSING_INFORMATION";
      if (!ok)
        return res
          .status(400)
          .json({ error: "Status must be VALIDATED or MISSING_INFORMATION." });
      if (
        body.note !== undefined &&
        (typeof body.note !== "string" || body.note.length > 2000)
      ) {
        return res
          .status(400)
          .json({ error: "Validation note must be at most 2000 characters." });
      }
      const trim = typeof body.note === "string" ? body.note.trim() : "";
      const referral = service.validateReferral(
        actorOf(req),
        paramOf(req, "id"),
        {
          status: body.status as "VALIDATED" | "MISSING_INFORMATION",
          note: trim.length > 0 ? trim : undefined,
        },
      );
      return res.status(200).json({ referral });
    }),
  );

  router.get(
    "/slice/referrals",
    requireSlicePrincipal,
    requirePermission("assessment:read"),
    requireFlag("referralWorkflow"),
    asyncRoute(async (req, res) => {
      const assignedOnly = req.user!.role === "CLINICIAN";
      const result = service.listReferrals(actorOf(req));
      const filtered = assignedOnly
        ? result.filter(
            (entry) =>
              entry.referral.assignedClinicianProfileId === req.user!.id,
          )
        : result;
      return res.status(200).json({ referrals: filtered });
    }),
  );

  router.post(
    "/slice/referrals/:id/book",
    requireSlicePrincipal,
    requirePermission("appointment:manage"),
    requireFlag("referralWorkflow"),
    asyncRoute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (
        typeof body.scheduledFor !== "string" ||
        Number.isNaN(Date.parse(body.scheduledFor))
      ) {
        return res
          .status(400)
          .json({ error: "A valid ISO-8601 appointment time is required." });
      }
      const journey = await service.bookFirstAppointment(
        actorOf(req),
        paramOf(req, "id"),
        {
          scheduledFor: body.scheduledFor,
        },
      );
      return res.status(200).json({ journey });
    }),
  );

  router.post(
    "/slice/referrals/:id/assign",
    requireSlicePrincipal,
    requirePermission("user:manage"),
    requireFlag("referralWorkflow"),
    asyncRoute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!isNonEmptyString(body.clinicianProfileId, 200)) {
        return res
          .status(400)
          .json({ error: "A clinician identifier is required." });
      }
      const journey = await service.assignClinician(
        actorOf(req),
        paramOf(req, "id"),
        (body.clinicianProfileId as string).trim(),
      );
      return res.status(200).json({ journey });
    }),
  );

  router.post(
    "/slice/referrals/:id/request-info",
    requireSlicePrincipal,
    requirePermission("patient:write"),
    requireFlag("referralWorkflow"),
    asyncRoute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (!isNonEmptyString(body.note, 2000)) {
        return res
          .status(400)
          .json({
            error: "A note describing the missing information is required.",
          });
      }
      const referral = service.validateReferral(
        actorOf(req),
        paramOf(req, "id"),
        {
          status: "MISSING_INFORMATION",
          note: (body.note as string).trim(),
        },
      );
      return res.status(200).json({ referral });
    }),
  );

  router.post(
    "/slice/referrals/:id/start-intake",
    requireSlicePrincipal,
    requirePermission("clinical:write"),
    requireFlag("intakeWorkflow"),
    asyncRoute(async (req, res) => {
      const journey = await service.startIntake(
        actorOf(req),
        paramOf(req, "id"),
      );
      return res.status(200).json({ journey });
    }),
  );

  router.post(
    "/slice/referrals/:id/intake",
    requireSlicePrincipal,
    requirePermission("patient:write"),
    requireFlag("intakeWorkflow"),
    asyncRoute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const answers = body.answers as Record<string, unknown> | undefined;
      const childhood = answers?.childhoodDifficulties;
      const childhoodOk =
        childhood === "YES" || childhood === "NO" || childhood === "UNCLEAR";
      const optOk = (v: unknown) =>
        v === undefined || (typeof v === "string" && v.length <= 4000);
      if (
        !answers ||
        !isNonEmptyString(answers.currentDifficulties, 4000) ||
        !childhoodOk ||
        !optOk(answers.educationSupport) ||
        !optOk(answers.physicalHealth)
      ) {
        return res
          .status(400)
          .json({ error: "Complete intake answers are required." });
      }
      const scores = body.questionnaireScores;
      const scoresOk =
        Array.isArray(scores) &&
        (scores as unknown[]).every((e) => {
          const r = e as Record<string, unknown>;
          const instrOk =
            typeof r.instrument === "string" &&
            r.instrument.trim().length > 0 &&
            r.instrument.length <= 100;
          return (
            instrOk && typeof r.score === "number" && Number.isFinite(r.score)
          );
        });
      if (!scoresOk)
        return res
          .status(400)
          .json({ error: "Scores must list instrument and numeric score." });
      const kinds = body.documentKinds;
      const kindsOk =
        Array.isArray(kinds) &&
        (kinds as unknown[]).every(
          (k) =>
            typeof k === "string" && k.trim().length > 0 && k.length <= 100,
        );
      if (!kindsOk)
        return res
          .status(400)
          .json({ error: "Document kinds must be a list of labels." });
      const edu = answers.educationSupport as string | undefined;
      const phys = answers.physicalHealth as string | undefined;
      const intake = service.submitIntake(actorOf(req), paramOf(req, "id"), {
        answers: {
          currentDifficulties: (answers.currentDifficulties as string).trim(),
          childhoodDifficulties: childhood as "YES" | "NO" | "UNCLEAR",
          ...(typeof edu === "string" && edu.trim().length > 0
            ? { educationSupport: edu.trim() }
            : {}),
          ...(typeof phys === "string" && phys.trim().length > 0
            ? { physicalHealth: phys.trim() }
            : {}),
        },
        questionnaireScores: (
          scores as { instrument: string; score: number }[]
        ).map((e) => ({
          instrument: e.instrument.trim(),
          score: e.score,
        })),
        documentKinds: (kinds as string[]).map((k) => k.trim()),
      });
      return res.status(200).json({ intake });
    }),
  );

  router.post(
    "/slice/referrals/:id/start-assessment",
    requireSlicePrincipal,
    requirePermission("clinical:write"),
    requireFlag("adhdAssessmentWorkflow"),
    asyncRoute(async (req, res) => {
      const journey = await service.startAssessment(
        actorOf(req),
        paramOf(req, "id"),
      );
      return res.status(200).json({ journey });
    }),
  );

  router.post(
    "/slice/referrals/:id/consent",
    requireSlicePrincipal,
    requirePermission("clinical:write"),
    requireFlag("consultationTranscription"),
    asyncRoute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const partyOk =
        body.consentingParty === "PATIENT" || body.consentingParty === "PROXY";
      const restrOk =
        body.restrictions === undefined ||
        (typeof body.restrictions === "string" &&
          body.restrictions.length <= 2000);
      if (
        !isNonEmptyString(body.wordingVersion, 100) ||
        !isNonEmptyString(body.purpose, 500) ||
        !partyOk ||
        !restrOk
      ) {
        return res
          .status(400)
          .json({ error: "Consent needs wording version, purpose and party." });
      }
      const restr =
        typeof body.restrictions === "string" ? body.restrictions.trim() : "";
      const consent = service.recordConsent(actorOf(req), paramOf(req, "id"), {
        wordingVersion: (body.wordingVersion as string).trim(),
        purpose: (body.purpose as string).trim(),
        consentingParty: body.consentingParty as "PATIENT" | "PROXY",
        restrictions: restr.length > 0 ? restr : undefined,
      });
      return res.status(201).json({ consent });
    }),
  );

  router.post(
    "/slice/referrals/:id/transcript",
    requireSlicePrincipal,
    requirePermission("clinical:write"),
    requireFlag("consultationTranscription"),
    asyncRoute(async (req, res) => {
      const raw = (req.body as Record<string, unknown>).segments;
      if (!Array.isArray(raw) || raw.length === 0 || raw.length > 500) {
        return res
          .status(400)
          .json({ error: "Provide 1-500 transcript segments." });
      }
      const cleaned: {
        speaker: "CLINICIAN" | "PATIENT";
        startMs: number;
        endMs: number;
        text: string;
        excluded: false;
      }[] = [];
      for (const item of raw as Record<string, unknown>[]) {
        const spkOk =
          item.speaker === "CLINICIAN" || item.speaker === "PATIENT";
        const startOk =
          typeof item.startMs === "number" &&
          Number.isFinite(item.startMs) &&
          item.startMs >= 0;
        const endOk =
          typeof item.endMs === "number" && Number.isFinite(item.endMs);
        const orderOk =
          startOk && endOk && (item.endMs as number) > (item.startMs as number);
        if (!spkOk || !orderOk || !isNonEmptyString(item.text, 4000)) {
          return res
            .status(400)
            .json({
              error: "Each segment needs speaker, ordered times and text.",
            });
        }
        cleaned.push({
          speaker: item.speaker as "CLINICIAN" | "PATIENT",
          startMs: item.startMs as number,
          endMs: item.endMs as number,
          text: (item.text as string).trim(),
          excluded: false,
        });
      }
      const result = service.ingestTranscript(
        actorOf(req),
        paramOf(req, "id"),
        cleaned,
      );
      return res.status(201).json(result);
    }),
  );

  router.post(
    "/slice/referrals/:id/bookmarks",
    requireSlicePrincipal,
    requirePermission("clinical:write"),
    requireFlag("consultationTranscription"),
    asyncRoute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      if (
        !isNonEmptyString(body.segmentId, 200) ||
        !isNonEmptyString(body.label, 500)
      ) {
        return res
          .status(400)
          .json({ error: "A segment identifier and label are required." });
      }
      const bookmark = service.addBookmark(actorOf(req), paramOf(req, "id"), {
        segmentId: (body.segmentId as string).trim(),
        label: (body.label as string).trim(),
      });
      return res.status(201).json({ bookmark });
    }),
  );

  router.post(
    "/slice/referrals/:id/draft",
    requireSlicePrincipal,
    requirePermission("ai:use"),
    requireFlag("clinicalAiEnabled", "clinicalNoteDrafting"),
    asyncRoute(async (req, res) => {
      const draft = service.generateDraft(actorOf(req), paramOf(req, "id"));
      return res.status(201).json({ draft });
    }),
  );

  router.post(
    "/slice/drafts/:id/amend",
    requireSlicePrincipal,
    requirePermission("clinical:write"),
    requireFlag("clinicalNoteDrafting"),
    asyncRoute(async (req, res) => {
      const raw = (req.body as Record<string, unknown>).edits;
      if (!Array.isArray(raw) || raw.length === 0) {
        return res
          .status(400)
          .json({ error: "At least one statement edit is required." });
      }
      const edits: { statementId: string; text: string }[] = [];
      for (const item of raw as Record<string, unknown>[]) {
        if (
          !isNonEmptyString(item.statementId, 200) ||
          !isNonEmptyString(item.text, 4000)
        ) {
          return res
            .status(400)
            .json({ error: "Each edit needs statement id and text." });
        }
        edits.push({
          statementId: (item.statementId as string).trim(),
          text: (item.text as string).trim(),
        });
      }
      const draft = service.amendDraft(actorOf(req), paramOf(req, "id"), edits);
      return res.status(200).json({ draft });
    }),
  );

  router.post(
    "/slice/drafts/:id/resolve-conflict",
    requireSlicePrincipal,
    requirePermission("clinical:write"),
    requireFlag("clinicalNoteDrafting"),
    asyncRoute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const resOk =
        body.resolution === "ACCEPTED_AS_IS" || body.resolution === "RESOLVED";
      if (!isNonEmptyString(body.conflictId, 200) || !resOk) {
        return res
          .status(400)
          .json({ error: "A conflict id and valid resolution are required." });
      }
      const draft = service.resolveConflict(
        actorOf(req),
        paramOf(req, "id"),
        (body.conflictId as string).trim(),
        body.resolution as "ACCEPTED_AS_IS" | "RESOLVED",
      );
      return res.status(200).json({ draft });
    }),
  );

  router.post(
    "/slice/drafts/:id/approve",
    requireSlicePrincipal,
    requirePermission("clinical:write"),
    requireFlag("clinicalNoteDrafting"),
    asyncRoute(async (req, res) => {
      const result = service.approveDraft(actorOf(req), paramOf(req, "id"));
      return res
        .status(201)
        .json({ draft: result.draft, noteId: result.noteId });
    }),
  );

  router.post(
    "/slice/referrals/:id/outcome",
    requireSlicePrincipal,
    requirePermission("clinical:write"),
    requireFlag("careJourneyEngine"),
    asyncRoute(async (req, res) => {
      const body = req.body as Record<string, unknown>;
      const outOk =
        body.outcome === "CONFIRMED" ||
        body.outcome === "NOT_CONFIRMED" ||
        body.outcome === "PARTIAL";
      if (!outOk)
        return res
          .status(400)
          .json({
            error: "Outcome must be CONFIRMED, NOT_CONFIRMED or PARTIAL.",
          });
      const summary = body.diagnosisSummary;
      if (
        summary !== undefined &&
        (typeof summary !== "string" || summary.length > 4000)
      ) {
        return res
          .status(400)
          .json({
            error: "Diagnosis summary must be at most 4000 characters.",
          });
      }
      const trim = typeof summary === "string" ? summary.trim() : "";
      const journey = await service.recordOutcome(
        actorOf(req),
        paramOf(req, "id"),
        {
          outcome: body.outcome as "CONFIRMED" | "NOT_CONFIRMED" | "PARTIAL",
          diagnosisSummary: trim.length > 0 ? trim : undefined,
        },
      );
      return res.status(200).json({ journey });
    }),
  );

  router.get(
    "/slice/patient/:id/status",
    requireSlicePrincipal,
    requirePermission("patient:read"),
    asyncRoute(async (req, res) => {
      const status = service.getPatientStatus(actorOf(req), paramOf(req, "id"));
      return res.status(200).json(status);
    }),
  );

  router.get(
    "/slice/referrals/:id/workup",
    requireSlicePrincipal,
    requirePermission("assessment:read"),
    requireFlag("referralWorkflow"),
    asyncRoute(async (req, res) => {
      const workup = service.getReferralWorkup(
        actorOf(req),
        paramOf(req, "id"),
      );
      return res.status(200).json(workup);
    }),
  );

  router.get(
    "/slice/timeline/:patientId",
    requireSlicePrincipal,
    requirePermission("patient:read"),
    requireFlag("careJourneyEngine"),
    asyncRoute(async (req, res) => {
      const events = service.getTimeline(
        actorOf(req),
        paramOf(req, "patientId"),
      );
      return res.status(200).json({ events });
    }),
  );

  router.get(
    "/slice/audit",
    requireSlicePrincipal,
    requirePermission("audit:read"),
    asyncRoute(async (req, res) => {
      const events = service.getAudit(actorOf(req));
      return res.status(200).json({ events });
    }),
  );

  return router;
}

/** Test principal: id, email display, and canonical platform role. */
export interface SliceTestPrincipal {
  readonly id: string;
  readonly role:
    | "SUPER_ADMIN"
    | "ADMIN"
    | "CLINICIAN"
    | "PATIENT"
    | "RECEPTIONIST"
    | "FINANCE";
}

/**
 * Build an isolated Express app for HTTP contract tests.
 *
 * The synthetic principal travels in `x-test-principal` (`<id>:<ROLE>`).
 * This header is ONLY honoured here — production `app.ts` never installs
 * this injector and keeps Supabase `authenticate`. All `requirePermission`
 * capability checks, `requireFlag` gates and service record-scoping execute
 * identically in both paths.
 */
export function createSliceTestApp(
  principals: Readonly<Record<string, SliceTestPrincipal>>,
  store: InMemorySliceStore = new InMemorySliceStore(),
): { app: Express; service: SliceService; store: InMemorySliceStore } {
  const testApp: Express = express();
  testApp.use(express.json());
  testApp.use((req: Request, res: Response, next: NextFunction) => {
    const header = req.header("x-test-principal");
    if (!header)
      return res.status(401).json({ error: "Authentication is required." });
    const principal = principals[header];
    if (!principal)
      return res.status(401).json({ error: "Authentication is required." });
    req.user = {
      id: principal.id,
      email: `${principal.id}@synthetic.test`,
      role: principal.role,
      clinicId: null,
    };
    store.upsertProfile({
      id: principal.id,
      displayName: principal.id,
      roles: [principal.role],
    });
    return next();
  });
  const service = new SliceService(store);
  for (const principal of Object.values(principals)) {
    store.upsertProfile({
      id: principal.id,
      displayName: principal.id,
      roles: [principal.role],
    });
  }
  testApp.use("/api", createSliceRouter(service));
  return { app: testApp, service, store };
}

/** Production wiring: the shared process store behind the canonical guards. */
export function createSliceProductionRouter(): IRouter {
  return createSliceRouter(new SliceService(getSliceStore()));
}
