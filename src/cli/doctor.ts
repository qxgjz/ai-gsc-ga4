import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "../args.js";
import { loadConfig } from "../config.js";
import { selectSites } from "./sites.js";

type ServiceAccountJson = {
  client_email?: string;
  project_id?: string;
};

const args = parseArgs();
const config = await loadConfig(args.config);
const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

console.log("AI GSC + GA4 doctor");
console.log("");

if (!credentialsPath) {
  console.log("GOOGLE_APPLICATION_CREDENTIALS: missing");
} else {
  const resolvedPath = path.resolve(credentialsPath);
  console.log(`GOOGLE_APPLICATION_CREDENTIALS: ${resolvedPath}`);

  try {
    const raw = await readFile(resolvedPath, "utf8");
    const credentials = JSON.parse(raw) as ServiceAccountJson;
    console.log(`service_account.client_email: ${credentials.client_email ?? "missing"}`);
    console.log(`service_account.project_id: ${credentials.project_id ?? "missing"}`);
  } catch (error) {
    console.log(`service_account.read_error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log("");

for (const site of selectSites(config, args.site)) {
  console.log(`site.id: ${site.id}`);
  console.log(`site.name: ${site.name}`);
  console.log(`site.gscProperty: ${site.gscProperty}`);
  console.log(`site.ga4PropertyId: ${site.ga4PropertyId}`);
  console.log(`site.conversionEvents: ${site.conversionEvents.join(", ") || "(none)"}`);
  console.log("");
}
