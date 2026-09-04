import "dotenv/config";
import { parseArgs } from "../args.js";
import { analyzeSnapshots } from "../analysis.js";
import { loadConfig } from "../config.js";
import { getDateRanges } from "../dates.js";
import { readJson, writeJson } from "../io.js";
import { snapshotPath } from "../paths.js";
import type { Ga4Snapshot, GscSnapshot } from "../types.js";
import { selectSites } from "./sites.js";

const args = parseArgs();
const config = await loadConfig(args.config);
const ranges = getDateRanges(args.days);

for (const site of selectSites(config, args.site)) {
  const gsc = await readJson<GscSnapshot>(snapshotPath("gsc", site.id, ranges.current.startDate, ranges.current.endDate));
  const ga4 = await readJson<Ga4Snapshot>(snapshotPath("ga4", site.id, ranges.current.startDate, ranges.current.endDate));
  const previous = await readPrevious(site.id, ranges.previous.startDate, ranges.previous.endDate);
  const analysis = analyzeSnapshots(gsc, ga4, previous);
  const output = snapshotPath("analysis", site.id, ranges.current.startDate, ranges.current.endDate);
  await writeJson(output, analysis);
  console.log(`Saved ${analysis.opportunities.length} opportunities for ${site.id}: ${output}`);
}

async function readPrevious(
  siteId: string,
  startDate: string,
  endDate: string
): Promise<{ gsc: GscSnapshot; ga4: Ga4Snapshot } | undefined> {
  try {
    const gsc = await readJson<GscSnapshot>(snapshotPath("gsc", siteId, startDate, endDate));
    const ga4 = await readJson<Ga4Snapshot>(snapshotPath("ga4", siteId, startDate, endDate));
    return { gsc, ga4 };
  } catch {
    return undefined;
  }
}
