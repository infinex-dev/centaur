import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import { resolve as pathResolve } from "node:path";

const PROJECT_ROOT = "/Users/opaque/.superset/projects/comms-factory";
const ENTRY = pathResolve(PROJECT_ROOT, "src/remotion/Root.tsx");
const PUBLIC_DIR = pathResolve(PROJECT_ROOT, "public");
const OUT = "/tmp/comms-factory-renders/combo-mark-test.png";

mkdirSync("/tmp/comms-factory-renders", { recursive: true });

const bundleLocation = await bundle(ENTRY, () => undefined, {
  publicDir: PUBLIC_DIR,
  webpackOverride: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      extensionAlias: { ".js": [".js", ".tsx", ".ts"] },
    },
  }),
});

const inputProps = {
  background_image_path: "_bg/perps-orderbook.png",
};

const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: "data-card-official",
  inputProps,
});

await renderStill({
  composition,
  serveUrl: bundleLocation,
  output: OUT,
  inputProps,
  // Frame past entry, into the hold
  frame: 60,
});

console.log("rendered:", OUT);
process.exit(0);
