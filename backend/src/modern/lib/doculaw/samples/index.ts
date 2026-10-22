import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* Server-only: the sample lease lives as plain .txt next to this file. */

export const SAMPLES = {
  "lease-v1": { file: "lease-v1.txt", name: "Sample lease (v1).txt" },
  "lease-v2": { file: "lease-v2.txt", name: "Sample lease (v2).txt" },
} as const;

export type SampleId = keyof typeof SAMPLES;

export function isSampleId(id: unknown): id is SampleId {
  return typeof id === "string" && Object.prototype.hasOwnProperty.call(SAMPLES, id);
}

export async function readSample(id: SampleId): Promise<string> {
  return readFile(join(__dirname, SAMPLES[id].file), "utf8");
}
