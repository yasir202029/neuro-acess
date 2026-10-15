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

// Hosts this server is actually reached on (set per-request by the router).
const reqHosts = new Set<string>();
app.use((req, _res, next) => {
  const host = req.headers.host;
  if (host) reqHosts.add(host);
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Same-origin requests carry the server's own host in Origin; always
      // allow them (single-service deploy serves SPA + API from one origin).
      const originHost = origin.replace(/^https?:\/\//, "");
      if (allowedOrigins.length === 0 && reqHosts.has(originHost)) return callback(null, true);
      logger.warn({ origin }, "CORS rejected cross-origin request");
      return callback(new Error("Origin not allowed by CORS policy"));
    },
    credentials: true,
  }),
);
app.use(
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
// Static SPA hosting: try the bundle-relative path first, then the repo layout
// (artifacts/<web>/dist) so the server works both bundled and from source.
import { existsSync } from "node:fs";
const webDistCandidates = [
  process.env.WEB_DIST_DIR ?? "",
  path.resolve(artifactDir, "..", "neuroassess-web", "dist"),
  path.resolve(artifactDir, "..", "..", "neuroassess-web", "dist"),
  path.resolve(artifactDir, "..", "..", "..", "artifacts", "neuroassess-web", "dist"),
].filter(Boolean);
const webDistDir = webDistCandidates.find((dir) => existsSync(path.join(dir, "index.html"))) ?? webDistCandidates[0]!;
app.use(express.static(webDistDir, { index: false, maxAge: "1h", immutable: false }));
app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
  res.sendFile(path.join(webDistDir, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "Not found." });
  });
});

export default app;
