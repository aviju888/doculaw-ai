import { cp, mkdir, rm } from "node:fs/promises";
await rm("site", { recursive: true, force: true });
await mkdir("site/classic", { recursive: true });
await cp("modern/dist", "site", { recursive: true });
await cp("frontend/build", "site/classic", { recursive: true });
