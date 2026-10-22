/* Request bodies for /api/doculaw/*. Limits keep a single request reasonable. */

import { z } from "zod";

export const LevelSchema = z.enum(["lawyer", "plain", "eli5"]);

export const RolesSchema = z.object({
  parties: z.array(z.string().max(40)).max(4),
  names: z.record(z.string(), z.string().max(160)),
  payer: z.string().max(40).nullable(),
});

const ClauseIn = z.object({
  id: z.string().max(80),
  citation: z.string().max(80),
  title: z.string().max(200),
  text: z.string().max(60_000),
  plain: z.string().max(20_000).optional(),
  parentTitle: z.string().max(200).optional(),
  parentId: z.string().max(80).nullable().optional(),
  childIds: z.array(z.string().max(80)).max(400).optional(),
});

export const AnalyzeBody = z.object({
  text: z.string().min(20, "There isn't enough text to read.").max(400_000, "That document is too long for this demo."),
  sampleId: z.string().max(40).nullable().optional(),
});

export const SimplifyBody = z.object({
  level: LevelSchema,
  sampleId: z.string().max(40).nullable().optional(),
  roles: RolesSchema,
  docNoun: z.string().max(20).default("agreement"),
  clauses: z.array(ClauseIn.pick({ id: true, citation: true, title: true, text: true })).min(1).max(1500),
});

export const ChatBody = z.object({
  question: z.string().trim().min(2, "Ask a question about the document.").max(600, "Keep the question under 600 characters."),
  perspective: z.string().max(40).default("neutral"),
  roles: RolesSchema,
  docNoun: z.string().max(20).default("agreement"),
  clauses: z.array(ClauseIn).min(1).max(1500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .default([]),
});

export const SelectionBody = z.object({
  action: z.enum(["explain", "simplify", "flag", "ask"]),
  selection: z.string().trim().min(2, "Select a few words first.").max(4000, "Select a shorter passage."),
  question: z.string().max(600).default(""),
  perspective: z.string().max(40).default("neutral"),
  roles: RolesSchema,
  clause: ClauseIn,
});

const DocIn = z.union([
  z.object({ text: z.string().min(20).max(400_000), name: z.string().max(200).optional() }),
  z.object({ sample: z.string().max(40) }),
]);

export const CompareBody = z.object({ a: DocIn, b: DocIn });

export function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid request.";
}
