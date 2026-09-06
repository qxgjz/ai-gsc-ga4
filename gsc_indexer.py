#!/usr/bin/env python3
"""
GSC Indexing Check and Submit Script
功能：
1. 读取网站sitemap.xml，获取所有URL
2. 使用Google Search Console URL Inspection API检查每个URL的收录状态
3. 对于未收录的URL，使用Indexing API提交索引请求
4. 生成详细报告到reports目录
5. 输出运行日志

注意：
- 每天提交URL有配额限制（默认每天200个URL）
- 需要服务账号有Indexing API和Search Console API权限
- 服务账号需要在GSC中被添加为该资源的所有者/完整权限用户
"""

import os
import sys
import json
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError

# Google API 认证
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("ERROR: 缺少依赖，请运行: pip install google-api-python-client google-auth")
    sys.exit(1)

# 配置
SITE_URL = "https://www.aitoolcrux.com/"
SITEMAP_URL = "https://www.aitoolcrux.com/sitemap.xml"
REPORT_OUTPUT_DIR = os.environ.get("REPORT_OUTPUT_DIR", "reports")
MAX_URLS_PER_RUN = 200  # 每天最多检查/提交的URL数量（GSC配额限制）
INDEXING_BATCH_SIZE = 100  # Indexing API每批最多100个URL
SLEEP_BETWEEN_REQUESTS = 0.5  # 请求间隔（秒），避免触发限流

# API 权限范围
SCOPES = [
    "https://www.googleapis.com/auth/webmasters",
    "https://www.googleapis.com/auth/indexing",
]


def log(message):
    """输出带时间戳的日志"""
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"[{timestamp}] {message}", flush=True)


def get_service_account_credentials():
    """获取服务账号认证"""
    credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "service-account.json")
    if not os.path.exists(credentials_path):
        log(f"ERROR: 服务账号文件不存在: {credentials_path}")
        sys.exit(1)
    
    credentials = service_account.Credentials.from_service_account_file(
        credentials_path, scopes=SCOPES
    )
    log(f"服务账号认证成功: {credentials.service_account_email}")
    return credentials


def fetch_sitemap_urls(sitemap_url):
    """从sitemap.xml获取所有URL"""
    log(f"正在获取sitemap: {sitemap_url}")
    try:
        req = Request(sitemap_url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(req, timeout=30) as response:
            content = response.read()
        
        # 解析XML
        root = ET.fromstring(content)
        
        # 处理sitemap index（包含子sitemap）
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        sitemap_locs = root.findall(".//sm:sitemap/sm:loc", ns)
        
        urls = []
        if sitemap_locs:
            log(f"发现 {len(sitemap_locs)} 个子sitemap，正在逐个获取...")
            for i, sitemap_loc in enumerate(sitemap_locs):
                sub_sitemap_url = sitemap_loc.text
                log(f"  子sitemap {i+1}/{len(sitemap_locs)}: {sub_sitemap_url}")
                try:
                    sub_req = Request(sub_sitemap_url, headers={"User-Agent": "Mozilla/5.0"})
                    with urlopen(sub_req, timeout=30) as sub_response:
                        sub_content = sub_response.read()
                    sub_root = ET.fromstring(sub_content)
                    sub_urls = [loc.text for loc in sub_root.findall(".//sm:url/sm:loc", ns)]
                    urls.extend(sub_urls)
                    log(f"    获取到 {len(sub_urls)} 个URL")
                except Exception as e:
                    log(f"    获取子sitemap失败: {e}")
                time.sleep(SLEEP_BETWEEN_REQUESTS)
        else:
            # 直接是URL列表
            urls = [loc.text for loc in root.findall(".//sm:url/sm:loc", ns)]
        
        # 去重
        urls = list(dict.fromkeys(urls))
        log(f"sitemap解析完成，共获取 {len(urls)} 个唯一URL")
        return urls
    except Exception as e:
        log(f"ERROR: 获取sitemap失败: {e}")
        return []


def inspect_url(searchconsole_service, site_url, url_to_check):
    """使用URL Inspection API检查单个URL的收录状态"""
    try:
        request = {
            "inspectionUrl": url_to_check,
            "siteUrl": site_url,
        }
        response = searchconsole_service.urlInspection().index().inspect(body=request).execute()
        
        inspection_result = response.get("inspectionResult", {})
        index_status_result = inspection_result.get("indexStatusResult", {})
        
        return {
            "url": url_to_check,
            "verdict": index_status_result.get("verdict", "UNKNOWN"),
            "coverageState": index_status_result.get("coverageState", "UNKNOWN"),
            "robotsTxtState": index_status_result.get("robotsTxtState", "UNKNOWN"),
            "indexingState": index_status_result.get("indexingState", "UNKNOWN"),
            "lastCrawlTime": index_status_result.get("lastCrawlTime", None),
            "pageFetchState": index_status_result.get("pageFetchState", "UNKNOWN"),
            "googleCanonical": index_status_result.get("googleCanonical", None),
            "userCanonical": index_status_result.get("userCanonical", None),
            "sitemap": index_status_result.get("sitemap", []),
            "referringUrls": index_status_result.get("referringUrls", []),
            "crawledAs": index_status_result.get("crawledAs", None),
        }
    except HttpError as e:
        error_content = e.content.decode("utf-8") if e.content else str(e)
        log(f"  URL检查失败 ({url_to_check}): HTTP {e.resp.status} - {error_content[:200]}")
        return {
            "url": url_to_check,
            "verdict": "ERROR",
            "coverageState": f"HTTP_ERROR_{e.resp.status}",
            "error": error_content[:500],
        }
    except Exception as e:
        log(f"  URL检查异常 ({url_to_check}): {e}")
        return {
            "url": url_to_check,
            "verdict": "ERROR",
            "coverageState": "EXCEPTION",
            "error": str(e)[:500],
        }


def submit_urls_for_indexing(indexing_service, urls_to_submit):
    """使用Indexing API批量提交URL索引请求"""
    if not urls_to_submit:
        log("没有需要提交的URL")
        return {"success": 0, "failed": 0, "results": []}
    
    log(f"正在提交 {len(urls_to_submit)} 个URL到Indexing API...")
    results = []
    success_count = 0
    failed_count = 0
    
    for i in range(0, len(urls_to_submit), INDEXING_BATCH_SIZE):
        batch = urls_to_submit[i:i + INDEXING_BATCH_SIZE]
        log(f"  批次 {i//INDEXING_BATCH_SIZE + 1}: {len(batch)} 个URL")
        
        for url in batch:
            try:
                request = {
                    "url": url,
                    "type": "URL_UPDATED",
                }
                response = indexing_service.urlNotifications().publish(body=request).execute()
                success_count += 1
                results.append({"url": url, "status": "success", "response": response})
                log(f"    ✓ 提交成功: {url}")
            except HttpError as e:
                failed_count += 1
                error_content = e.content.decode("utf-8") if e.content else str(e)
                results.append({"url": url, "status": "failed", "error": error_content[:300]})
                log(f"    ✗ 提交失败: {url} - HTTP {e.resp.status}: {error_content[:100]}")
            except Exception as e:
                failed_count += 1
                results.append({"url": url, "status": "failed", "error": str(e)[:300]})
                log(f"    ✗ 提交异常: {url} - {e}")
            time.sleep(SLEEP_BETWEEN_REQUESTS)
    
    log(f"Indexing API提交完成: 成功 {success_count}, 失败 {failed_count}")
    return {"success": success_count, "failed": failed_count, "results": results}


def generate_report(all_urls, inspection_results, indexing_results, start_time):
    """生成详细报告"""
    os.makedirs(REPORT_OUTPUT_DIR, exist_ok=True)
    
    end_time = datetime.utcnow()
    duration = (end_time - start_time).total_seconds()
    
    # 统计
    total_checked = len(inspection_results)
    passed_count = sum(1 for r in inspection_results if r.get("verdict") == "PASS")
    failed_count = sum(1 for r in inspection_results if r.get("verdict") == "FAIL")
    neutral_count = sum(1 for r in inspection_results if r.get("verdict") == "NEUTRAL")
    error_count = sum(1 for r in inspection_results if r.get("verdict") == "ERROR")
    unknown_count = total_checked - passed_count - failed_count - neutral_count - error_count
    
    # 未收录的URL（需要提交）
    urls_not_indexed = [
        r["url"] for r in inspection_results
        if r.get("verdict") in ["FAIL", "NEUTRAL", "UNKNOWN"]
        and "ERROR" not in r.get("coverageState", "")
    ]
    
    report = {
        "reportType": "gsc-indexing-check",
        "generatedAt": end_time.isoformat() + "Z",
        "siteUrl": SITE_URL,
        "sitemapUrl": SITEMAP_URL,
        "durationSeconds": round(duration, 2),
        "summary": {
            "totalUrlsInSitemap": len(all_urls),
            "urlsCheckedThisRun": total_checked,
            "urlsSkippedDueToLimit": max(0, len(all_urls) - MAX_URLS_PER_RUN),
            "indexedPass": passed_count,
            "notIndexedFail": failed_count,
            "neutral": neutral_count,
            "errors": error_count,
            "unknown": unknown_count,
            "urlsSubmittedForIndexing": indexing_results.get("success", 0),
            "indexingSubmissionsFailed": indexing_results.get("failed", 0),
        },
        "inspectionResults": inspection_results,
        "indexingResults": indexing_results.get("results", []),
        "urlsNotIndexed": urls_not_indexed,
        "configuration": {
            "maxUrlsPerRun": MAX_URLS_PER_RUN,
            "indexingBatchSize": INDEXING_BATCH_SIZE,
            "sleepBetweenRequests": SLEEP_BETWEEN_REQUESTS,
        },
    }
    
    # 保存JSON报告
    date_str = end_time.strftime("%Y-%m-%d")
    json_report_path = os.path.join(REPORT_OUTPUT_DIR, f"indexing-report-{date_str}.json")
    with open(json_report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    log(f"JSON报告已保存: {json_report_path}")
    
    # 生成Markdown报告
    md_report_path = os.path.join(REPORT_OUTPUT_DIR, f"indexing-report-{date_str}.md")
    md_content = generate_markdown_report(report)
    with open(md_report_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    log(f"Markdown报告已保存: {md_report_path}")
    
    return report


def generate_markdown_report(report):
    """生成Markdown格式报告"""
    s = report["summary"]
    lines = [
        f"# GSC 收录检查与提交报告",
        f"",
        f"**生成时间**: {report['generatedAt']}",
        f"**网站**: {report['siteUrl']}",
        f"**Sitemap**: {report['sitemapUrl']}",
        f"**运行时长**: {report['durationSeconds']} 秒",
        f"",
        f"## 核心摘要",
        f"",
        f"| 指标 | 数值 |",
        f"|------|------|",
        f"| Sitemap中URL总数 | {s['totalUrlsInSitemap']} |",
        f"| 本次检查URL数 | {s['urlsCheckedThisRun']} |",
        f"| 因配额限制跳过 | {s['urlsSkippedDueToLimit']} |",
        f"| 已收录 (PASS) | {s['indexedPass']} |",
        f"| 未收录 (FAIL) | {s['notIndexedFail']} |",
        f"| 中性 (NEUTRAL) | {s['neutral']} |",
        f"| 错误 (ERROR) | {s['errors']} |",
        f"| 未知 (UNKNOWN) | {s['unknown']} |",
        f"| 已提交索引请求 | {s['urlsSubmittedForIndexing']} |",
        f"| 提交失败 | {s['indexingSubmissionsFailed']} |",
        f"",
        f"## 收录状态分布",
        f"",
    ]
    
    if s["totalUrlsInSitemap"] > 0:
        indexed_pct = round(s["indexedPass"] / max(s["urlsCheckedThisRun"], 1) * 100, 1)
        lines.append(f"- 收录率: **{indexed_pct}%** (基于本次检查的{s['urlsCheckedThisRun']}个URL)")
        lines.append("")
    
    # 未收录URL列表
    if report["urlsNotIndexed"]:
        lines.extend([
            f"## 未收录URL列表（共{len(report['urlsNotIndexed'])}个）",
            f"",
        ])
        for i, url in enumerate(report["urlsNotIndexed"][:50], 1):
            lines.append(f"{i}. {url}")
        if len(report["urlsNotIndexed"]) > 50:
            lines.append(f"... 还有 {len(report['urlsNotIndexed']) - 50} 个URL，详见JSON报告")
        lines.append("")
    
    # 错误URL列表
    error_urls = [r for r in report["inspectionResults"] if r.get("verdict") == "ERROR"]
    if error_urls:
        lines.extend([
            f"## 检查出错的URL（共{len(error_urls)}个）",
            f"",
        ])
        for r in error_urls[:20]:
            lines.append(f"- **{r['url']}**: {r.get('coverageState', 'UNKNOWN')} - {r.get('error', '')[:100]}")
        lines.append("")
    
    lines.extend([
        "## 建议",
        "",
        "1. 对于未收录的URL，已自动提交Indexing API请求，通常1-3天内Google会重新抓取",
        "2. 如果URL持续未收录，请检查：内容质量、内部链接、外部链接、页面加载速度",
        "3. 新站收录通常需要2-6个月，请耐心等待，持续优化内容质量和外链建设",
        "4. 每天最多提交200个URL（GSC配额限制），本脚本会自动分批处理",
        "",
        "---",
        f"*报告由 ai-gsc-ga4 自动化系统生成*",
    ])
    
    return "\n".join(lines)


def main():
    """主函数"""
    start_time = datetime.utcnow()
    log("=" * 60)
    log("GSC 收录检查与提交脚本启动")
    log(f"网站: {SITE_URL}")
    log(f"Sitemap: {SITEMAP_URL}")
    log(f"最大检查URL数: {MAX_URLS_PER_RUN}")
    log("=" * 60)
    
    # 1. 获取服务账号认证
    credentials = get_service_account_credentials()
    
    # 2. 构建API服务
    log("正在构建Google API服务...")
    searchconsole_service = build("searchconsole", "v1", credentials=credentials)
    indexing_service = build("indexing", "v3", credentials=credentials)
    log("API服务构建成功")
    
    # 3. 获取sitemap中的所有URL
    all_urls = fetch_sitemap_urls(SITEMAP_URL)
    if not all_urls:
        log("ERROR: 未能从sitemap获取任何URL，脚本退出")
        sys.exit(1)
    
    # 4. 限制本次检查的URL数量
    urls_to_check = all_urls[:MAX_URLS_PER_RUN]
    if len(all_urls) > MAX_URLS_PER_RUN:
        log(f"URL数量超过配额限制，本次只检查前 {MAX_URLS_PER_RUN} 个，剩余 {len(all_urls) - MAX_URLS_PER_RUN} 个下次运行时检查")
    
    # 5. 逐个检查URL收录状态
    log(f"开始检查 {len(urls_to_check)} 个URL的收录状态...")
    inspection_results = []
    
    for i, url in enumerate(urls_to_check, 1):
        log(f"  [{i}/{len(urls_to_check)}] 检查: {url}")
        result = inspect_url(searchconsole_service, SITE_URL, url)
        inspection_results.append(result)
        
        verdict = result.get("verdict", "UNKNOWN")
        coverage = result.get("coverageState", "UNKNOWN")
        log(f"    结果: {verdict} - {coverage}")
        
        time.sleep(SLEEP_BETWEEN_REQUESTS)
    
    # 6. 统计未收录的URL
    urls_not_indexed = [
        r["url"] for r in inspection_results
        if r.get("verdict") in ["FAIL", "NEUTRAL", "UNKNOWN"]
        and "ERROR" not in r.get("coverageState", "")
    ]
    log(f"检查完成: 已收录 {sum(1 for r in inspection_results if r.get('verdict') == 'PASS')}, 未收录 {len(urls_not_indexed)}, 错误 {sum(1 for r in inspection_results if r.get('verdict') == 'ERROR')}")
    
    # 7. 提交未收录的URL到Indexing API
    indexing_results = {"success": 0, "failed": 0, "results": []}
    if urls_not_indexed:
        indexing_results = submit_urls_for_indexing(indexing_service, urls_not_indexed)
    else:
        log("所有已检查URL均已收录，无需提交索引请求")
    
    # 8. 生成报告
    log("正在生成报告...")
    report = generate_report(all_urls, inspection_results, indexing_results, start_time)
    
    # 9. 输出最终摘要
    log("=" * 60)
    log("运行完成！最终摘要:")
    log(f"  Sitemap URL总数: {report['summary']['totalUrlsInSitemap']}")
    log(f"  本次检查URL数: {report['summary']['urlsCheckedThisRun']}")
    log(f"  已收录 (PASS): {report['summary']['indexedPass']}")
    log(f"  未收录 (FAIL): {report['summary']['notIndexedFail']}")
    log(f"  已提交索引请求: {report['summary']['urlsSubmittedForIndexing']}")
    log(f"  运行时长: {report['durationSeconds']} 秒")
    log("=" * 60)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
