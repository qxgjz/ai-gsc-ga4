import type { AnalysisSnapshot, Opportunity, RankedLandingPage, RankedSearchItem, TrendMetric } from "./types.js";

export function renderMarkdownReport(analysis: AnalysisSnapshot): string {
  const lines: string[] = [];
  lines.push(`# ${analysis.siteId} SEO 与自然搜索运营分析报告`);
  lines.push("");
  lines.push(`分析周期：${analysis.startDate} 至 ${analysis.endDate}`);
  lines.push(`生成时间：${analysis.generatedAt}`);
  lines.push("");
  lines.push("## 核心摘要");
  lines.push("");
  lines.push(`- GSC 点击：${analysis.summary.totalClicks}`);
  lines.push(`- GSC 曝光：${analysis.summary.totalImpressions}`);
  lines.push(`- 平均 CTR：${percent(analysis.summary.averageCtr)}`);
  lines.push(`- 平均排名：${round(analysis.summary.averagePosition)}`);
  lines.push(`- Google organic sessions：${analysis.summary.organicSessions}`);
  lines.push(`- Key events：${analysis.summary.keyEvents}`);
  lines.push("");
  lines.push("> 口径说明：核心摘要中的 GSC 点击、曝光、CTR、平均排名来自 Search Console 无维度总计；查询词、页面、国家、设备表格分别来自对应单维度数据；关键词簇和机会点来自多维度明细。GSC 明细行会因隐私和低量查询限制被省略，因此明细表求和通常不会等于顶部总计。");
  lines.push("");

  lines.push("## 分析结论");
  lines.push("");
  for (const item of buildInsights(analysis)) {
    lines.push(`- ${item}`);
  }
  lines.push("");

  lines.push("## 建议操作");
  lines.push("");
  for (const item of buildActions(analysis)) {
    lines.push(`- ${item}`);
  }
  lines.push("");

  if (analysis.trend) {
    lines.push("## 环比趋势");
    lines.push("");
    lines.push(`对比周期：${analysis.trend.previousStartDate} 至 ${analysis.trend.previousEndDate}`);
    lines.push("");
    lines.push("| 指标 | 本期 | 上期 | 变化 | 变化率 |");
    lines.push("| --- | ---: | ---: | ---: | ---: |");
    lines.push(`| GSC 点击 | ${fmtInt(analysis.trend.totalClicks.current)} | ${fmtInt(analysis.trend.totalClicks.previous)} | ${fmtSigned(analysis.trend.totalClicks.delta)} | ${fmtRate(analysis.trend.totalClicks)} |`);
    lines.push(`| GSC 曝光 | ${fmtInt(analysis.trend.totalImpressions.current)} | ${fmtInt(analysis.trend.totalImpressions.previous)} | ${fmtSigned(analysis.trend.totalImpressions.delta)} | ${fmtRate(analysis.trend.totalImpressions)} |`);
    lines.push(`| 平均 CTR | ${percent(analysis.trend.averageCtr.current)} | ${percent(analysis.trend.averageCtr.previous)} | ${fmtSignedPercent(analysis.trend.averageCtr.delta)} | ${fmtRate(analysis.trend.averageCtr)} |`);
    lines.push(`| 平均排名 | ${round(analysis.trend.averagePosition.current)} | ${round(analysis.trend.averagePosition.previous)} | ${fmtSignedNumber(analysis.trend.averagePosition.delta)} | ${fmtRate(analysis.trend.averagePosition)} |`);
    lines.push(`| Organic sessions | ${fmtInt(analysis.trend.organicSessions.current)} | ${fmtInt(analysis.trend.organicSessions.previous)} | ${fmtSigned(analysis.trend.organicSessions.delta)} | ${fmtRate(analysis.trend.organicSessions)} |`);
    lines.push(`| Key events | ${fmtInt(analysis.trend.keyEvents.current)} | ${fmtInt(analysis.trend.keyEvents.previous)} | ${fmtSigned(analysis.trend.keyEvents.delta)} | ${fmtRate(analysis.trend.keyEvents)} |`);
    lines.push("");
  }

  lines.push("## 关键词簇");
  lines.push("");
  lines.push(renderSearchTable(analysis.breakdowns.queryClusters, "关键词簇", 12));
  lines.push("");

  lines.push("## Top 查询词");
  lines.push("");
  lines.push(renderSearchTable(analysis.breakdowns.topQueries, "查询词", 15));
  lines.push("");

  lines.push("## Top 页面");
  lines.push("");
  lines.push(renderSearchTable(analysis.breakdowns.topPages, "页面", 10));
  lines.push("");

  lines.push("## 国家和设备");
  lines.push("");
  lines.push("### 国家");
  lines.push("");
  lines.push(renderSearchTable(analysis.breakdowns.topCountries, "国家", 12));
  lines.push("");
  lines.push("### 设备");
  lines.push("");
  lines.push(renderSearchTable(analysis.breakdowns.topDevices, "设备", 10));
  lines.push("");

  lines.push("## GA4 自然搜索落地页");
  lines.push("");
  lines.push(renderLandingTable(analysis.breakdowns.topLandingPages, 15));
  lines.push("");

  lines.push("## 优先机会");
  lines.push("");

  if (analysis.opportunities.length === 0) {
    lines.push("本周期没有检测到满足阈值的优先机会。");
    return lines.join("\n");
  }

  for (const [index, opportunity] of analysis.opportunities.entries()) {
    lines.push(`### ${index + 1}. ${titleForOpportunity(opportunity)}`);
    lines.push("");
    lines.push(`- 优先级：${priorityLabel(opportunity.priority)}`);
    lines.push(`- 页面：${opportunity.page}`);
    if (opportunity.query) {
      lines.push(`- 查询词：${opportunity.query}`);
    }
    lines.push(`- 证据：${renderEvidence(opportunity.evidence)}`);
    lines.push(`- 建议：${translateRecommendation(opportunity.recommendation)}`);
    lines.push("");
  }

  return lines.join("\n");
}

function titleForOpportunity(opportunity: Opportunity): string {
  const labels: Record<Opportunity["type"], string> = {
    low_ctr: "提升搜索结果点击率",
    striking_distance: "推动接近首页顶部的排名",
    traffic_drop: "排查流量下降",
    low_engagement: "提升落地页互动",
    conversion_gap: "补齐或修复转化路径"
  };
  return labels[opportunity.type];
}

function renderEvidence(evidence: Record<string, number | string>): string {
  return Object.entries(evidence)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function percent(value: number): string {
  return `${round(value * 100)}%`;
}

function renderSearchTable(rows: RankedSearchItem[], label: string, limit: number): string {
  const lines = [`| ${label} | 点击 | 曝光 | CTR | 平均排名 |`, "| --- | ---: | ---: | ---: | ---: |"];
  for (const row of rows.slice(0, limit)) {
    lines.push(`| ${escapeCell(row.key)} | ${row.clicks} | ${row.impressions} | ${percent(row.ctr)} | ${round(row.position)} |`);
  }
  return lines.join("\n");
}

function renderLandingTable(rows: RankedLandingPage[], limit: number): string {
  const lines = ["| 落地页 | Sessions | Engaged sessions | Engagement rate | Key events |", "| --- | ---: | ---: | ---: | ---: |"];
  for (const row of rows.slice(0, limit)) {
    lines.push(
      `| ${escapeCell(row.landingPage)} | ${row.sessions} | ${row.engagedSessions} | ${percent(row.engagementRate)} | ${row.keyEvents} |`
    );
  }
  return lines.join("\n");
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|");
}

function fmtInt(value: number): string {
  return Math.round(value).toString();
}

function fmtSigned(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : rounded.toString();
}

function fmtSignedNumber(value: number): string {
  const rounded = round(value);
  return rounded > 0 ? `+${rounded}` : rounded.toString();
}

function fmtSignedPercent(value: number): string {
  return value > 0 ? `+${percent(value)}` : percent(value);
}

function fmtRate(metric: TrendMetric): string {
  return metric.changeRate === null ? "N/A" : percent(metric.changeRate);
}

function priorityLabel(priority: Opportunity["priority"]): string {
  const labels = {
    high: "高",
    medium: "中",
    low: "低"
  };
  return labels[priority];
}

function translateRecommendation(value: string): string {
  const translations = new Map([
    [
      "Review whether the title, meta description, and opening content match the query intent. Test a clearer benefit-led title and make sure the page answers the query early.",
      "检查 title、meta description 和首屏内容是否匹配查询意图。优先测试更清晰、直接体现收益的标题，并确保页面开头快速回答用户需求。"
    ],
    [
      "Strengthen this page for the query cluster: add missing subtopics, improve internal links from related pages, and check whether the page has enough first-hand or product-specific detail.",
      "围绕该查询词簇强化页面：补齐缺失子主题，从相关页面增加内链，并检查页面是否有足够的产品细节或第一手信息。"
    ],
    [
      "Inspect the landing page above the fold, mobile layout, page speed, and search intent fit. Add a clearer next step and align the page introduction with organic-search expectations.",
      "检查落地页首屏、移动端布局、页面速度和搜索意图匹配度。补充更明确的下一步动作，并让页面开头贴合自然搜索用户预期。"
    ],
    [
      "Check whether this page should have a conversion path. If yes, add or improve the relevant CTA, lead capture, product link, signup path, or tracking event.",
      "确认该页面是否应该承担转化。如果是，请增加或优化 CTA、留资、产品入口、注册路径或埋点事件。"
    ]
  ]);

  return translations.get(value) ?? value;
}

function buildInsights(analysis: AnalysisSnapshot): string[] {
  const topPage = analysis.breakdowns.topPages[0];
  const topQuery = analysis.breakdowns.topQueries[0];
  const topCluster = analysis.breakdowns.queryClusters[0];
  const homeLanding = analysis.breakdowns.topLandingPages.find((row) => row.landingPage === "/");
  const insights: string[] = [];

  if (topPage && topPage.impressions > 0) {
    const share = topPage.impressions / analysis.summary.totalImpressions;
    insights.push(`搜索曝光高度集中在 ${topPage.key}，占总曝光约 ${percent(share)}，当前 SEO 主战场是这个页面。`);
  }

  if (topQuery) {
    insights.push(
      `最重要的查询词是 "${topQuery.key}"，贡献 ${topQuery.clicks} 次点击和 ${topQuery.impressions} 次曝光，平均排名 ${round(topQuery.position)}。`
    );
  }

  if (topCluster) {
    insights.push(
      `最大关键词簇是 ${topCluster.key}，说明 Google 主要把站点理解为该搜索意图下的工具型页面。`
    );
  }

  if (homeLanding) {
    insights.push(
      `GA4 中首页自然搜索会话为 ${homeLanding.sessions}，互动率 ${percent(homeLanding.engagementRate)}，但 Key events 为 ${homeLanding.keyEvents}。`
    );
  }

  if (analysis.summary.keyEvents === 0) {
    insights.push("当前没有记录到 Key events，暂时无法判断哪些关键词和页面真正带来业务价值。");
  }

  const desktop = analysis.breakdowns.topDevices.find((row) => row.key === "DESKTOP");
  const mobile = analysis.breakdowns.topDevices.find((row) => row.key === "MOBILE");
  if (desktop && mobile && desktop.position > mobile.position + 3) {
    insights.push(
      `桌面端平均排名 ${round(desktop.position)}，明显弱于移动端 ${round(mobile.position)}，需要单独检查桌面端搜索结果呈现和页面体验。`
    );
  }

  return insights;
}

function buildActions(analysis: AnalysisSnapshot): string[] {
  const topQuery = analysis.breakdowns.topQueries[0];
  const actions = [
    "先修 GA4 转化埋点，至少追踪核心生成、下载、分享、注册、购买或留资事件。",
    "优先优化当前最高曝光页面的 title、meta description、H1 和首屏内容，让它明确匹配主查询词。",
    "围绕已有排名的派生意图补充页面内容或独立入口，例如 signature、english-to-chinese、traditional、cursive 等词簇。",
    "检查与主词竞争的功能页，明确首页和功能页的关键词分工，避免多个页面争抢同一搜索意图。",
    "下一次运行 pipeline 后查看环比趋势，用数据确认改动是否带来曝光、点击、CTR、排名和转化提升。"
  ];

  if (topQuery) {
    actions.unshift(`把 "${topQuery.key}" 作为第一优先级关键词，不要先分散到大量低曝光博客内容。`);
  }

  return actions;
}
