# AI GSC + GA4 数据分析工具

这个项目用于通过 Google 官方 API 只读拉取 Google Search Console 和 GA4 数据，生成 SEO 与自然搜索运营分析报告。工具只做数据读取、分析和建议输出，不会自动修改线上站点、SEO 内容或 GA4 配置。

## 功能

- 拉取 GSC 搜索表现数据：查询词、页面、国家、设备、点击、曝光、CTR、平均排名。
- 拉取 GA4 自然搜索落地页数据：sessions、engaged sessions、engagement rate、key events。
- 自动生成分析 JSON 和 Markdown 报告。
- 默认支持本期与上一周期对比，用于观察 SEO 和运营趋势。
- 支持多个站点，通过 `--site` 指定要分析的站点。

## 快速使用

如果项目已经完成 Google 权限、`.env` 和 `sites.config.json` 配置，日常使用只需要以下几步。

进入项目目录并安装依赖（已经安装过可跳过）：

```bash
cd ai-gsc-ga4
npm install
```

先检查当前凭证文件和站点配置是否能被读取：

```bash
npm run doctor -- --site China-Brush-Art
```

然后运行完整分析流程：

```bash
npm run pipeline -- --site China-Brush-Art --days 90
```

完成后，在以下目录查看 Markdown 报告：

```text
reports/China-Brush-Art/
```

报告文件按分析日期命名，例如：

```text
reports/China-Brush-Art/2026-03-17_2026-06-14.md
```

`pipeline` 会依次完成以下工作：

1. 拉取上一周期的 GSC 和 GA4 数据。
2. 拉取当前周期的 GSC 和 GA4 数据。
3. 计算当前周期与上一周期的变化。
4. 生成分析 JSON 和可直接阅读的 Markdown 报告。

工具默认避开最近 3 天，减少 Google 数据延迟造成的波动。因此，`--days 90` 表示截至 3 天前的连续 90 天，并同时拉取此前连续 90 天用于对比。

如果配置了其他站点，请将命令中的 `China-Brush-Art` 替换为 `sites.config.json` 中对应的 `id`。

### 如何选择命令

| 需求 | 命令 |
| --- | --- |
| 更新数据并生成完整报告 | `npm run pipeline -- --site <site-id> --days 90` |
| 检查凭证和站点配置 | `npm run doctor -- --site <site-id>` |
| 只更新 GSC 数据 | `npm run gsc:fetch -- --site <site-id> --days 90` |
| 只更新 GA4 数据 | `npm run ga4:fetch -- --site <site-id> --days 90` |
| 使用本地已有数据重新分析 | `npm run analyze -- --site <site-id> --days 90` |
| 使用已有分析结果重新生成报告 | `npm run report -- --site <site-id> --days 90` |

通常直接运行 `pipeline` 即可。只有在排查权限、单独更新某类数据或调整报告生成逻辑时，才需要使用其他命令。

## 准备 Google 权限

1. 在 Google Cloud Console 创建或选择一个项目。
2. 启用 API：
   - Google Search Console API
   - Google Analytics Data API
3. 创建 Service Account，并下载 JSON key。
4. 将 JSON key 放到项目目录，例如 `service-account.json`。
5. 在 Search Console 中，把 JSON 里的 `client_email` 添加到对应 GSC property。
6. 在 GA4 中，把同一个 `client_email` 添加到：

```text
管理 -> 媒体资源设置 -> 媒体资源访问权限管理
```

权限选择 `查看者 / Viewer`。

注意：GA4 这里要加在“媒体资源访问权限管理”，不要只加在“账号访问权限管理”。

## 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

填写：

```env
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
DATA_DIR=./data
REPORTS_DIR=./reports
```

`GOOGLE_APPLICATION_CREDENTIALS` 指向 Service Account JSON 文件路径。

## 配置站点

复制站点配置模板：

```bash
cp sites.config.example.json sites.config.json
```

示例：

```json
{
  "sites": [
    {
      "id": "China-Brush-Art",
      "name": "China Brush Art",
      "gscProperty": "sc-domain:chinabrush.art",
      "ga4PropertyId": "513327827",
      "defaultCountry": "USA",
      "defaultLanguage": "en",
      "conversionEvents": ["sign_up", "purchase", "generate_lead"],
      "segments": {
        "brandQueries": ["chinabrush"],
        "targetCountries": ["USA"],
        "contentPathPrefixes": ["/blog/", "/guides/"]
      }
    }
  ]
}
```

字段说明：

- `id`：站点标识，命令里的 `--site` 使用这个值，大小写必须一致。
- `name`：站点展示名称。
- `gscProperty`：GSC property。域名资源使用 `sc-domain:example.com`，URL 前缀资源使用完整 URL。
- `ga4PropertyId`：GA4 媒体资源 ID，必须是纯数字，不是 `G-XXXXXXXXXX`。
- `conversionEvents`：你认为代表转化的 GA4 事件名。
- `brandQueries`：品牌词，用于后续区分品牌和非品牌搜索。
- `targetCountries`：目标国家。
- `contentPathPrefixes`：内容路径前缀。

## 安装依赖

```bash
npm install
```

## 常用命令

完整流程：

```bash
npm run pipeline -- --site China-Brush-Art --days 90
```

这个命令默认使用配置文件 `sites.config.json`，只需要指定站点和数据时长。

参数说明：

- `--site China-Brush-Art`：只分析 `sites.config.json` 中 `id` 为 `China-Brush-Art` 的站点。
- `--days 90`：分析最近 90 天数据。脚本会避开最近 3 天，降低 GSC/GA4 数据延迟影响。
- `--config sites.config.json`：可选参数。默认就是 `sites.config.json`，通常不用写。

完整命令也可以写成：

```bash
npm run pipeline -- --config sites.config.json --site China-Brush-Art --days 90
```

诊断当前脚本实际使用的凭证和站点配置：

```bash
npm run doctor -- --site China-Brush-Art
```

只拉 GSC：

```bash
npm run gsc:fetch -- --site China-Brush-Art --days 90
```

只拉 GA4：

```bash
npm run ga4:fetch -- --site China-Brush-Art --days 90
```

基于已有数据重新分析：

```bash
npm run analyze -- --site China-Brush-Art --days 90
```

基于已有分析结果重新生成 Markdown 报告：

```bash
npm run report -- --site China-Brush-Art --days 90
```

## 输出目录

GSC 原始快照：

```text
data/gsc/<site-id>/<start>_<end>.json
```

GA4 原始快照：

```text
data/ga4/<site-id>/<start>_<end>.json
```

分析结果：

```text
data/analysis/<site-id>/<start>_<end>.json
```

Markdown 报告：

```text
reports/<site-id>/<start>_<end>.md
```

## GSC 数据口径说明

报告里的 GSC 核心摘要使用 Search Console API 的无维度总计，应该更接近 GSC 页面顶部的总点击、总曝光、平均 CTR 和平均排名。

查询词、页面、国家、设备表格分别使用对应单维度数据，口径更接近 GSC 页面下方各个 tab。关键词簇和机会点使用多维度明细数据。Search Console 对带查询词等维度的数据会做隐私保护和低量数据省略，所以这些明细行求和通常不会等于顶部总计。这是 GSC 的正常口径差异，不代表 API 拉取失败。

## 趋势对比

`pipeline` 会默认拉取两个周期：

- 当前周期：例如最近 90 天，但结束日期会往前推 3 天。
- 上一周期：当前周期之前的同等长度周期。

报告中会输出环比趋势，包括：

- GSC 点击
- GSC 曝光
- 平均 CTR
- 平均排名
- Organic sessions
- Key events

如果只运行 `analyze`，脚本会尝试读取本地上一周期快照；如果没有上一周期数据，报告会只输出当前周期分析。

## 常见问题

### GA4 报 PERMISSION_DENIED

重点检查：

- `ga4PropertyId` 是纯数字媒体资源 ID，不是 `G-XXXXXXXXXX`。
- Service Account JSON 里的 `client_email` 已添加到 GA4 的“媒体资源访问权限管理”。
- 权限至少是 `查看者 / Viewer`。
- 当前 GA4 界面选中的媒体资源 ID 和 `sites.config.json` 中的 `ga4PropertyId` 一致。

### GSC 能跑，GA4 不能跑

这通常说明 Service Account 已经有 GSC 权限，但没有 GA4 媒体资源权限。GSC 和 GA4 都要添加同一个 `client_email`。

### Key events 一直是 0

检查 `conversionEvents` 是否填写了真实存在的 GA4 事件名。可以先在 GA4 后台确认事件名，再更新 `sites.config.json`。

如果产品核心动作是生成、下载或分享图片，可以考虑追踪：

- `generate_calligraphy`
- `download_image`
- `share_result`
- `sign_up`
- `purchase`

## 使用原则

报告中的建议只作为决策辅助。标题、内容、内链、结构化数据、重定向、产品路径和付费转化相关改动，都应由人工审核后再执行。
