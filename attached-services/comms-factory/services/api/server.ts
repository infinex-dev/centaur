import { readFileSync } from "node:fs";
import { startManifestRefresh } from "../../src/fact-grounder/sources/repo-manifest.js";
import { makeJsonServer, requirePostAuth, type Handler } from "./http.js";
import { handleAudit } from "./routes/audit.js";
import { handleBuildCard } from "./routes/build-card.js";
import { handleGenerate } from "./routes/generate.js";
import { handleGround } from "./routes/ground.js";
import { handleValidate } from "./routes/validate.js";
const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version?: string };

const routes = new Map<string, Handler>();

routes.set("GET /health", () => ({
  body: {
    ok: true,
    service: "comms-factory-api",
    version: packageJson.version,
    commit: process.env.COMMIT_SHA ?? "local",
    capabilities: {
      platform_pr: Boolean(process.env.GITHUB_TOKEN?.trim()),
      typefully: Boolean(process.env.TYPEFULLY_API_KEY?.trim()),
      display: Boolean(process.env.DISPLAYDEV_API_KEY?.trim()),
    },
  },
}));

for (const [path, handler] of [
  ["/validate", handleValidate],
  ["/audit", handleAudit],
  ["/ground", handleGround],
  ["/build-card", handleBuildCard],
  ["/generate", handleGenerate],
] as const) {
  routes.set(`POST ${path}`, async (ctx) => {
    requirePostAuth(ctx.request);
    return handler(ctx as never) as never;
  });
}

export const server = makeJsonServer(routes);

if (process.env.NODE_ENV !== "test") {
  // Build the routing manifest now and refresh hourly in the background;
  // /ground only ever reads the cached snapshot (stale-while-revalidate).
  startManifestRefresh();
  const port = Number(process.env.PORT ?? 8080);
  server.listen(port, () => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: "info", service: "comms-factory-api", event: "server_started", port }));
  });
}
