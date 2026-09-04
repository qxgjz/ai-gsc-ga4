import "dotenv/config";
import { parseArgs } from "../args.js";
import { loadConfig } from "../config.js";
import { getDateRange } from "../dates.js";
import { readJson, writeText } from "../io.js";
import { reportPath, snapshotPath } from "../paths.js";
import { renderMarkdownReport } from "../report.js";
import type { AnalysisSnapshot } from "../types.js";
import { selectSites } from "./sites.js";

const args = parseArgs();
const config = await loadConfig(args.config);
const range = getDateRange(args.days);

for (const site of selectSites(config, args.site)) {
  const analysis = await readJson<AnalysisSnapshot>(snapshotPath("analysis", site.id, range.startDate, range.endDate));
  const markdown = renderMarkdownReport(analysis);
  const output = reportPath(site.id, range.startDate, range.endDate);
  await writeText(output, markdown);
  console.log(`Saved report for ${site.id}: ${output}`);
}
