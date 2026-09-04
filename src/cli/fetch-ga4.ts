import "dotenv/config";
import { parseArgs } from "../args.js";
import { loadConfig } from "../config.js";
import { getDateRange } from "../dates.js";
import { fetchGa4Snapshot } from "../ga4.js";
import { writeJson } from "../io.js";
import { snapshotPath } from "../paths.js";
import { selectSites } from "./sites.js";

const args = parseArgs();
const config = await loadConfig(args.config);
const range = getDateRange(args.days);

for (const site of selectSites(config, args.site)) {
  const snapshot = await fetchGa4Snapshot(site, range.startDate, range.endDate);
  const output = snapshotPath("ga4", site.id, range.startDate, range.endDate);
  await writeJson(output, snapshot);
  console.log(`Saved ${snapshot.rows.length} GA4 rows for ${site.id}: ${output}`);
}
