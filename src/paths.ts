import { mkdir } from "node:fs/promises";
import path from "node:path";

export function dataDir(): string {
  return process.env.DATA_DIR ?? "data";
}

export function reportsDir(): string {
  return process.env.REPORTS_DIR ?? "reports";
}

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export function snapshotPath(kind: "gsc" | "ga4" | "analysis", siteId: string, startDate: string, endDate: string): string {
  return path.join(dataDir(), kind, siteId, `${startDate}_${endDate}.json`);
}

export function reportPath(siteId: string, startDate: string, endDate: string): string {
  return path.join(reportsDir(), siteId, `${startDate}_${endDate}.md`);
}
