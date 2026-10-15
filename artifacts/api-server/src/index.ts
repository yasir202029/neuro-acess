import app from "./app";
import { logger } from "./lib/logger";

// Render injects PORT automatically; local dev can rely on the default.
// NEVER commit a literal port for production — always honour the environment.
const rawPort = process.env["PORT"] ?? "3000";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  logger.info(
    {
      port,
      env: process.env.NODE_ENV ?? "development",
      allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "").length > 0 ? "configured" : "same-origin-only",
    },
    "NeuroAssess server listening (API + SPA, single origin)",
  );
});

server.on("error", (err: NodeJS.ErrnoException) => {
  logger.error({ err }, "Server failed to start");
  process.exit(1);
});

// Render sends SIGTERM on deploy/scale; drain gracefully instead of dropping
// in-flight clinical writes.
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — draining connections");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during graceful shutdown");
      process.exit(1);
    }
    process.exit(0);
  });
});
