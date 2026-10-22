import type { Level } from "./types";

/* Reading levels for the Plain-English Dial. Kept apart from simplify.ts so the
   client bundle doesn't pull in the sample-lease fixtures. */
export const LEVEL_INFO: Record<Level, { label: string; hint: string }> = {
  lawyer: { label: "Lawyer", hint: "Same meaning, less clutter" },
  plain: { label: "Plain", hint: "Everyday words, every number kept" },
  eli5: { label: "ELI5", hint: "The simplest version" },
};
