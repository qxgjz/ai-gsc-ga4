import "dotenv/config";
import { parseArgs } from "../args.js";
import { loadConfig } from "../config.js";
import { getDateRange } from "../dates.js";
import { fetchGscSnapshot } from "../gsc.js";
import { writeJson } from "../io.js";
import { snapshotPath } from "../paths.js";
import { selectSites } from "./sites.js";

const args = parseArgs();
const config = await loadConfig(args.config);
const range = getDateRange(args.days);

for (const site of selectSites(config, args.site)) {
  const snapshot = await fetchGscSnapshot(site, range.startDate, range.endDate);
  const output = snapshotPath("gsc", site.id, range.startDate, range.endDate);
  await writeJson(output, snapshot);
  console.log(`Saved ${snapshot.rows.length} GSC rows for ${site.id}: ${output}`);
}
