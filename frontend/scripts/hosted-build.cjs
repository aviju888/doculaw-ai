// Vercel's existing project builds from frontend/. Keep both product interfaces
// in that deployment without moving its remote Root Directory setting.
const { existsSync, cpSync, mkdirSync, rmSync } = require("node:fs");
const { resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const root = resolve(__dirname, "../..");
const mode = process.argv[2];
if (!["install", "build"].includes(mode)) {
  throw new Error("Use hosted-build.cjs install or build.");
}
if (
  !["package.json", "backend/package.json", "modern/package.json"].every(
    (file) => existsSync(resolve(root, file)),
  )
) {
  throw new Error(
    "The combined DocuLaw build requires repository source outside frontend/. Enable Vercel’s “Include source files outside of the Root Directory in the Build Step” setting, or review changing the project Root Directory to the repository root. No Classic-only build was produced.",
  );
}
const command = mode === "install" ? "install:all" : "build";
const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", command],
  {
    cwd: root,
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
if (mode === "build") {
  const target = resolve(root, "frontend/site");
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  cpSync(resolve(root, "site"), target, { recursive: true });
  console.log(
    "Combined Modern + Classic static output prepared at frontend/site. The API remains a separate Node service.",
  );
}
