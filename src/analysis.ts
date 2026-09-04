import type {
  AnalysisBreakdowns,
  AnalysisSnapshot,
  AnalysisTrend,
  GscDimensionRow,
  Ga4Snapshot,
  GscRow,
  GscSnapshot,
  Opportunity,
  RankedLandingPage,
  RankedSearchItem,
  SummaryMetrics,
  TrendMetric
} from "./types.js";

export function analyzeSnapshots(
  gsc: GscSnapshot,
  ga4: Ga4Snapshot,
  previous?: { gsc: GscSnapshot; ga4: Ga4Snapshot }
): AnalysisSnapshot {
  const summary = summarize(gsc, ga4);

  const opportunities = [
    ...findLowCtrOpportunities(gsc.rows),
    ...findStrikingDistanceOpportunities(gsc.rows),
    ...findLowEngagementOpportunities(ga4),
    ...findConversionGaps(ga4)
  ]
    .sort(compareOpportunity)
    .slice(0, 100);

  return {
    siteId: gsc.siteId,
    startDate: gsc.startDate,
    endDate: gsc.endDate,
    generatedAt: new Date().toISOString(),
    summary,
    trend: previous ? buildTrend(summary, summarize(previous.gsc, previous.ga4), previous.gsc) : undefined,
    breakdowns: buildBreakdowns(gsc, ga4),
    opportunities
  };
}

function summarize(gsc: GscSnapshot, ga4: Ga4Snapshot): SummaryMetrics {
  const totalClicks = gsc.totals?.clicks ?? sum(gsc.rows, (row) => row.clicks);
  const totalImpressions = gsc.totals?.impressions ?? sum(gsc.rows, (row) => row.impressions);
  const weightedPosition =
    gsc.totals?.position ?? (totalImpressions > 0 ? sum(gsc.rows, (row) => row.position * row.impressions) / totalImpressions : 0);

  return {
    totalClicks,
    totalImpressions,
    averageCtr: gsc.totals?.ctr ?? (totalImpressions > 0 ? totalClicks / totalImpressions : 0),
    averagePosition: weightedPosition,
    organicSessions: sum(ga4.rows, (row) => row.sessions),
    keyEvents: sum(ga4.rows, (row) => row.keyEvents)
  };
}

function buildTrend(current: SummaryMetrics, previous: SummaryMetrics, previousGsc: GscSnapshot): AnalysisTrend {
  return {
    previousStartDate: previousGsc.startDate,
    previousEndDate: previousGsc.endDate,
    totalClicks: trendMetric(current.totalClicks, previous.totalClicks),
    totalImpressions: trendMetric(current.totalImpressions, previous.totalImpressions),
    averageCtr: trendMetric(current.averageCtr, previous.averageCtr),
    averagePosition: trendMetric(current.averagePosition, previous.averagePosition),
    organicSessions: trendMetric(current.organicSessions, previous.organicSessions),
    keyEvents: trendMetric(current.keyEvents, previous.keyEvents)
  };
}

function trendMetric(current: number, previous: number): TrendMetric {
  return {
    current,
    previous,
    delta: current - previous,
    changeRate: previous === 0 ? null : (current - previous) / previous
  };
}

function buildBreakdowns(gsc: GscSnapshot, ga4: Ga4Snapshot): AnalysisBreakdowns {
  return {
    topQueries: rankedFromDimension(gsc.dimensions?.queries) ?? aggregateSearch(gsc.rows, (row) => row.query).slice(0, 20),
    topPages: rankedFromDimension(gsc.dimensions?.pages) ?? aggregateSearch(gsc.rows, (row) => row.page).slice(0, 20),
    topCountries: rankedFromDimension(gsc.dimensions?.countries) ?? aggregateSearch(gsc.rows, (row) => row.country).slice(0, 20),
    topDevices: rankedFromDimension(gsc.dimensions?.devices) ?? aggregateSearch(gsc.rows, (row) => row.device).slice(0, 10),
    queryClusters: aggregateSearch(gsc.rows, (row) => queryCluster(row.query)).slice(0, 20),
    topLandingPages: ga4.rows
      .map(
        (row): RankedLandingPage => ({
          landingPage: row.landingPage,
          sessions: row.sessions,
          engagedSessions: row.engagedSessions,
          engagementRate: row.engagementRate,
          keyEvents: row.keyEvents
        })
      )
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 20)
  };
}

function rankedFromDimension(rows: GscDimensionRow[] | undefined): RankedSearchItem[] | undefined {
  if (!rows) return undefined;
  return rows
    .map((row) => ({
      key: row.key,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
}

function aggregateSearch(rows: GscRow[], getKey: (row: GscRow) => string): RankedSearchItem[] {
  const groups = new Map<string, { key: string; clicks: number; impressions: number; positionImpressions: number }>();

  for (const row of rows) {
    const key = getKey(row) || "(empty)";
    const group = groups.get(key) ?? { key, clicks: 0, impressions: 0, positionImpressions: 0 };
    group.clicks += row.clicks;
    group.impressions += row.impressions;
    group.positionImpressions += row.position * row.impressions;
    groups.set(key, group);
  }

  return [...groups.values()]
    .map((group) => ({
      key: group.key,
      clicks: group.clicks,
      impressions: group.impressions,
      ctr: group.impressions > 0 ? group.clicks / group.impressions : 0,
      position: group.impressions > 0 ? group.positionImpressions / group.impressions : 0
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

function queryCluster(query: string): string {
  const value = query.toLowerCase();
  if (value.includes("signature")) return "signature";
  if (value.includes("cursive")) return "cursive";
  if (value.includes("english")) return "english-to-chinese";
  if (value.includes("traditional")) return "traditional";
  if (value.includes("ai")) return "ai";
  if (value.includes("maker") || value.includes("creator") || value.includes("converter") || value.includes("generate")) {
    return "maker/creator";
  }
  if (value.includes("calligraphy") || value.includes("caligraphy")) return "core-calligraphy-generator";
  return "other";
}

function findLowCtrOpportunities(rows: GscRow[]): Opportunity[] {
  return rows
    .filter((row) => row.impressions >= 200 && row.position <= 10 && row.ctr < expectedCtr(row.position) * 0.55)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 30)
    .map((row) => ({
      type: "low_ctr",
      priority: row.impressions >= 1000 && row.position <= 5 ? "high" : "medium",
      page: row.page,
      query: row.query,
      evidence: {
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: percent(row.ctr),
        position: round(row.position)
      },
      recommendation:
        "Review whether the title, meta description, and opening content match the query intent. Test a clearer benefit-led title and make sure the page answers the query early."
    }));
}

function findStrikingDistanceOpportunities(rows: GscRow[]): Opportunity[] {
  return rows
    .filter((row) => row.impressions >= 100 && row.position > 3 && row.position <= 15)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 30)
    .map((row) => ({
      type: "striking_distance",
      priority: row.impressions >= 800 && row.position <= 10 ? "high" : "medium",
      page: row.page,
      query: row.query,
      evidence: {
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: percent(row.ctr),
        position: round(row.position)
      },
      recommendation:
        "Strengthen this page for the query cluster: add missing subtopics, improve internal links from related pages, and check whether the page has enough first-hand or product-specific detail."
    }));
}

function findLowEngagementOpportunities(ga4: Ga4Snapshot): Opportunity[] {
  return ga4.rows
    .filter((row) => row.sessions >= 50 && row.engagementRate < 0.45)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20)
    .map((row) => ({
      type: "low_engagement",
      priority: row.sessions >= 300 ? "high" : "medium",
      page: row.landingPage,
      evidence: {
        sessions: row.sessions,
        engagedSessions: row.engagedSessions,
        engagementRate: percent(row.engagementRate),
        keyEvents: row.keyEvents
      },
      recommendation:
        "Inspect the landing page above the fold, mobile layout, page speed, and search intent fit. Add a clearer next step and align the page introduction with organic-search expectations."
    }));
}

function findConversionGaps(ga4: Ga4Snapshot): Opportunity[] {
  return ga4.rows
    .filter((row) => row.sessions >= 100 && row.keyEvents === 0)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 20)
    .map((row) => ({
      type: "conversion_gap",
      priority: row.sessions >= 500 ? "high" : "low",
      page: row.landingPage,
      evidence: {
        sessions: row.sessions,
        engagementRate: percent(row.engagementRate),
        keyEvents: row.keyEvents
      },
      recommendation:
        "Check whether this page should have a conversion path. If yes, add or improve the relevant CTA, lead capture, product link, signup path, or tracking event."
    }));
}

function expectedCtr(position: number): number {
  if (position <= 1.5) return 0.28;
  if (position <= 3) return 0.15;
  if (position <= 5) return 0.08;
  if (position <= 10) return 0.035;
  return 0.02;
}

function compareOpportunity(a: Opportunity, b: Opportunity): number {
  const priorityScore = { high: 3, medium: 2, low: 1 };
  const byPriority = priorityScore[b.priority] - priorityScore[a.priority];
  if (byPriority !== 0) return byPriority;

  const aVolume = Number(a.evidence.impressions ?? a.evidence.sessions ?? 0);
  const bVolume = Number(b.evidence.impressions ?? b.evidence.sessions ?? 0);
  return bVolume - aVolume;
}

function sum<T>(rows: T[], getValue: (row: T) => number): number {
  return rows.reduce((total, row) => total + getValue(row), 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function percent(value: number): string {
  return `${round(value * 100)}%`;
}
