import { google } from "googleapis";
import type { SiteConfig } from "./config.js";
import { createGoogleAuth } from "./google-auth.js";
import type { GscDimensionRow, GscRow, GscSnapshot } from "./types.js";

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

export async function fetchGscSnapshot(site: SiteConfig, startDate: string, endDate: string): Promise<GscSnapshot> {
  const auth = createGoogleAuth(SCOPES);
  const searchconsole = google.searchconsole({ version: "v1", auth });
  const rows: GscRow[] = [];
  const rowLimit = 25000;
  const totalsResponse = await searchconsole.searchanalytics.query({
    siteUrl: site.gscProperty,
    requestBody: {
      startDate,
      endDate,
      type: "web",
      rowLimit: 1,
      dataState: "final"
    }
  });
  const totalsRow = totalsResponse.data.rows?.[0];
  const [queries, pages, countries, devices] = await Promise.all([
    fetchDimensionRows(searchconsole, site.gscProperty, startDate, endDate, "query"),
    fetchDimensionRows(searchconsole, site.gscProperty, startDate, endDate, "page"),
    fetchDimensionRows(searchconsole, site.gscProperty, startDate, endDate, "country"),
    fetchDimensionRows(searchconsole, site.gscProperty, startDate, endDate, "device")
  ]);

  for (let startRow = 0; ; startRow += rowLimit) {
    const response = await searchconsole.searchanalytics.query({
      siteUrl: site.gscProperty,
      requestBody: {
        startDate,
        endDate,
        dimensions: ["page", "query", "country", "device"],
        type: "web",
        rowLimit,
        startRow,
        dataState: "final"
      }
    });

    const batch = response.data.rows ?? [];
    for (const row of batch) {
      const [page = "", query = "", country = "", device = ""] = row.keys ?? [];
      rows.push({
        page,
        query,
        country,
        device,
        clicks: Number(row.clicks ?? 0),
        impressions: Number(row.impressions ?? 0),
        ctr: Number(row.ctr ?? 0),
        position: Number(row.position ?? 0)
      });
    }

    if (batch.length < rowLimit) {
      break;
    }
  }

  return {
    siteId: site.id,
    property: site.gscProperty,
    startDate,
    endDate,
    totals: totalsRow
      ? {
          clicks: Number(totalsRow.clicks ?? 0),
          impressions: Number(totalsRow.impressions ?? 0),
          ctr: Number(totalsRow.ctr ?? 0),
          position: Number(totalsRow.position ?? 0)
        }
      : undefined,
    dimensions: {
      queries,
      pages,
      countries,
      devices
    },
    rows
  };
}

async function fetchDimensionRows(
  searchconsole: ReturnType<typeof google.searchconsole>,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimension: "query" | "page" | "country" | "device"
): Promise<GscDimensionRow[]> {
  const rows: GscDimensionRow[] = [];
  const rowLimit = 25000;

  for (let startRow = 0; ; startRow += rowLimit) {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: [dimension],
        type: "web",
        rowLimit,
        startRow,
        dataState: "final"
      }
    });

    const batch = response.data.rows ?? [];
    for (const row of batch) {
      rows.push({
        key: row.keys?.[0] ?? "",
        clicks: Number(row.clicks ?? 0),
        impressions: Number(row.impressions ?? 0),
        ctr: Number(row.ctr ?? 0),
        position: Number(row.position ?? 0)
      });
    }

    if (batch.length < rowLimit) {
      break;
    }
  }

  return rows;
}
