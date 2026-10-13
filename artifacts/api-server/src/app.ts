import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pinoHttp } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authenticate } from "./security/auth";

const app: Express = express();

// Render (and most PaaS reverse proxies) terminate TLS at the edge; trust the
// proxy so secure cookies / forwarded-proto behave correctly.
app.set("trust proxy", 1);

/**
 * CORS allow-list for same-origin + configured origins.
 *
 * Single-service Render deploy serves the SPA from the API origin, so most
 * traffic is same-origin (no preflight). Cross-origin is only permitted for
 * origins in ALLOWED_ORIGINS (comma-separated, e.g.
 * "https://app.example.com,https://admin.example.com"). Unset or empty =
 * same-origin only (browser same-origin requests carry no Origin header and
 * are unaffected; non-browser clients are unaffected).
 */
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn({ origin }, "CORS rejected cross-origin request");
      return callback(new Error("Origin not allowed by CORS policy"));
    },
    credentials: true,
  }),
);
  pinoHttp({
    logger,
    serializers: {
      req(req: { id: string; method: string; url?: string }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: { statusCode: number }) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", (req, res, next) => req.path === "/healthz" ? next() : authenticate(req, res, next), router);

/**
 * Single-service static hosting (Render web service serves web + API from one
 * origin). The Vite build output lives at ../neuroassess-web/dist relative to
 * the bundled server file at runtime. Unknown non-API routes fall through to
 * index.html so wouter client-side routing works on refresh/deep links.
 */
const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const webDistDir = path.resolve(artifactDir, "..", "neuroassess-web", "dist");
app.use(express.static(webDistDir, { index: false, maxAge: "1h", immutable: false }));
app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
  res.sendFile(path.join(webDistDir, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "Not found." });
  });
});

export default app;
