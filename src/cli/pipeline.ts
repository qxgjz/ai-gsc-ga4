import "dotenv/config";
import { parseArgs } from "../args.js";
import { analyzeSnapshots } from "../analysis.js";
import { loadConfig } from "../config.js";
import { getDateRanges } from "../dates.js";
import { fetchGa4Snapshot } from "../ga4.js";
import { fetchGscSnapshot } from "../gsc.js";
import { writeJson, writeText } from "../io.js";
import { reportPath, snapshotPath } from "../paths.js";
import { renderMarkdownReport } from "../report.js";
import { selectSites } from "./sites.js";

const args = parseArgs();
const config = await loadConfig(args.config);
const ranges = getDateRanges(args.days);

for (const site of selectSites(config, args.site)) {
  console.log(`Fetching previous GSC data for ${site.id}...`);
  const previousGsc = await fetchGscSnapshot(site, ranges.previous.startDate, ranges.previous.endDate);
  await writeJson(snapshotPath("gsc", site.id, ranges.previous.startDate, ranges.previous.endDate), previousGsc);

  console.log(`Fetching previous GA4 data for ${site.id}...`);
  const previousGa4 = await fetchGa4Snapshot(site, ranges.previous.startDate, ranges.previous.endDate);
  await writeJson(snapshotPath("ga4", site.id, ranges.previous.startDate, ranges.previous.endDate), previousGa4);

  console.log(`Fetching GSC data for ${site.id}...`);
  const gsc = await fetchGscSnapshot(site, ranges.current.startDate, ranges.current.endDate);
  await writeJson(snapshotPath("gsc", site.id, ranges.current.startDate, ranges.current.endDate), gsc);

  console.log(`Fetching GA4 data for ${site.id}...`);
  const ga4 = await fetchGa4Snapshot(site, ranges.current.startDate, ranges.current.endDate);
  await writeJson(snapshotPath("ga4", site.id, ranges.current.startDate, ranges.current.endDate), ga4);

  console.log(`Analyzing ${site.id}...`);
  const analysis = analyzeSnapshots(gsc, ga4, { gsc: previousGsc, ga4: previousGa4 });
  await writeJson(snapshotPath("analysis", site.id, ranges.current.startDate, ranges.current.endDate), analysis);

  const output = reportPath(site.id, ranges.current.startDate, ranges.current.endDate);
  await writeText(output, renderMarkdownReport(analysis));
  console.log(`Saved report for ${site.id}: ${output}`);
}
