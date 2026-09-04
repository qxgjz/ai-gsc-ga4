export type GscRow = {
  page: string;
  query: string;
  country: string;
  device: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscTotals = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscDimensionRow = GscTotals & {
  key: string;
};

export type GscSnapshot = {
  siteId: string;
  property: string;
  startDate: string;
  endDate: string;
  totals?: GscTotals;
  dimensions?: {
    queries: GscDimensionRow[];
    pages: GscDimensionRow[];
    countries: GscDimensionRow[];
    devices: GscDimensionRow[];
  };
  rows: GscRow[];
};

export type Ga4LandingPageRow = {
  landingPage: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  keyEvents: number;
  conversionsByEvent: Record<string, number>;
};

export type Ga4Snapshot = {
  siteId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  rows: Ga4LandingPageRow[];
};

export type Opportunity = {
  type:
    | "low_ctr"
    | "striking_distance"
    | "traffic_drop"
    | "low_engagement"
    | "conversion_gap";
  priority: "high" | "medium" | "low";
  page: string;
  query?: string;
  evidence: Record<string, number | string>;
  recommendation: string;
};

export type SummaryMetrics = {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  organicSessions: number;
  keyEvents: number;
};

export type TrendMetric = {
  current: number;
  previous: number;
  delta: number;
  changeRate: number | null;
};

export type AnalysisTrend = {
  previousStartDate: string;
  previousEndDate: string;
  totalClicks: TrendMetric;
  totalImpressions: TrendMetric;
  averageCtr: TrendMetric;
  averagePosition: TrendMetric;
  organicSessions: TrendMetric;
  keyEvents: TrendMetric;
};

export type RankedSearchItem = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type RankedLandingPage = {
  landingPage: string;
  sessions: number;
  engagedSessions: number;
  engagementRate: number;
  keyEvents: number;
};

export type AnalysisBreakdowns = {
  topQueries: RankedSearchItem[];
  topPages: RankedSearchItem[];
  topCountries: RankedSearchItem[];
  topDevices: RankedSearchItem[];
  queryClusters: RankedSearchItem[];
  topLandingPages: RankedLandingPage[];
};

export type AnalysisSnapshot = {
  siteId: string;
  startDate: string;
  endDate: string;
  generatedAt: string;
  summary: SummaryMetrics;
  trend?: AnalysisTrend;
  breakdowns: AnalysisBreakdowns;
  opportunities: Opportunity[];
};
