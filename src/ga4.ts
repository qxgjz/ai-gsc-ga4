import { BetaAnalyticsDataClient } from "@google-analytics/data";
import type { SiteConfig } from "./config.js";
import type { Ga4LandingPageRow, Ga4Snapshot } from "./types.js";

export async function fetchGa4Snapshot(site: SiteConfig, startDate: string, endDate: string): Promise<Ga4Snapshot> {
  const client = new BetaAnalyticsDataClient();
  const conversionEvents = site.conversionEvents;
  const rowsByPage = new Map<string, Ga4LandingPageRow>();

  const [baseReport] = await runGa4Report(site, () =>
    client.runReport({
      property: `properties/${site.ga4PropertyId}`,
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "landingPagePlusQueryString" }],
      metrics: [
        { name: "sessions" },
        { name: "engagedSessions" },
        { name: "engagementRate" },
        { name: "keyEvents" }
      ],
      dimensionFilter: {
        andGroup: {
          expressions: [
            {
              filter: {
                fieldName: "sessionSource",
                stringFilter: { matchType: "EXACT", value: "google" }
              }
            },
            {
              filter: {
                fieldName: "sessionMedium",
                stringFilter: { matchType: "EXACT", value: "organic" }
              }
            }
          ]
        }
      },
      limit: 100000
    })
  );

  for (const row of baseReport.rows ?? []) {
    const landingPage = row.dimensionValues?.[0]?.value ?? "";
    rowsByPage.set(landingPage, {
      landingPage,
      sessions: metricNumber(row.metricValues?.[0]?.value),
      engagedSessions: metricNumber(row.metricValues?.[1]?.value),
      engagementRate: metricNumber(row.metricValues?.[2]?.value),
      keyEvents: metricNumber(row.metricValues?.[3]?.value),
      conversionsByEvent: {}
    });
  }

  if (conversionEvents.length > 0) {
    const [eventsReport] = await runGa4Report(site, () =>
      client.runReport({
        property: `properties/${site.ga4PropertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: "landingPagePlusQueryString" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              {
                filter: {
                  fieldName: "sessionSource",
                  stringFilter: { matchType: "EXACT", value: "google" }
                }
              },
              {
                filter: {
                  fieldName: "sessionMedium",
                  stringFilter: { matchType: "EXACT", value: "organic" }
                }
              },
              {
                filter: {
                  fieldName: "eventName",
                  inListFilter: { values: conversionEvents }
                }
              }
            ]
          }
        },
        limit: 100000
      })
    );

    for (const row of eventsReport.rows ?? []) {
      const landingPage = row.dimensionValues?.[0]?.value ?? "";
      const eventName = row.dimensionValues?.[1]?.value ?? "";
      const eventCount = metricNumber(row.metricValues?.[0]?.value);
      const existing =
        rowsByPage.get(landingPage) ??
        {
          landingPage,
          sessions: 0,
          engagedSessions: 0,
          engagementRate: 0,
          keyEvents: 0,
          conversionsByEvent: {}
        };
      existing.conversionsByEvent[eventName] = eventCount;
      rowsByPage.set(landingPage, existing);
    }
  }

  return {
    siteId: site.id,
    propertyId: site.ga4PropertyId,
    startDate,
    endDate,
    rows: [...rowsByPage.values()].sort((a, b) => b.sessions - a.sessions)
  };
}

function metricNumber(value: string | null | undefined): number {
  return value ? Number(value) : 0;
}

async function runGa4Report<T>(site: SiteConfig, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isPermissionDenied(error)) {
      throw new Error(
        [
          `GA4 permission denied for site "${site.id}" and property "${site.ga4PropertyId}".`,
          "Check that ga4PropertyId is the numeric GA4 Property ID, not the G- measurement ID.",
          "Then add the service account email from GOOGLE_APPLICATION_CREDENTIALS to GA4 Admin > Property access management with Viewer access."
        ].join(" ")
      );
    }

    throw error;
  }
}

function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    Number((error as { code?: unknown }).code) === 7
  );
}
