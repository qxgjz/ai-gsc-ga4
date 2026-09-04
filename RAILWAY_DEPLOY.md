# AI GSC+GA4 Railway 部署指南

## 项目概述
这是一个通过Google官方API获取GSC和GA4数据的分析工具，部署在Railway上可以解决大陆网络无法访问Google API的问题。

## 部署步骤

### 1. 准备工作
- 确保已有Railway账号（已注册）
- 确保已有Google Cloud项目，已启用Search Console API和Analytics Data API
- 已创建Service Account并下载JSON key
- 已在GSC中将service account的client_email添加为property所有者

### 2. 配置环境变量
在Railway项目中设置以下环境变量：

```
GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
PORT=3000
```

### 3. 上传Service Account
将service-account.json文件上传到Railway项目，或者将其内容作为环境变量传入。

### 4. 部署方式

#### 方式A：GitHub部署（推荐）
1. 将本项目推送到GitHub仓库
2. 在Railway中选择"Deploy from GitHub repo"
3. 选择对应的仓库
4. 配置环境变量
5. 点击部署

#### 方式B：CLI部署
```bash
# 登录Railway
railway login

# 初始化项目
railway init

# 部署
railway up

# 设置环境变量
railway variables set GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json
railway variables set PORT=3000
```

### 5. 验证部署
部署完成后，访问：
- 健康检查：`https://your-domain.up.railway.app/health`
- 触发分析：`POST https://your-domain.up.railway.app/analyze`
  ```json
  {
    "site": "aitoolcrux",
    "days": 30
  }
  ```
- 获取报告：`GET https://your-domain.up.railway.app/reports/aitoolcrux/latest`

## API接口

### GET /health
健康检查，返回服务状态

### POST /analyze
触发GSC+GA4分析
- 请求体：`{ "site": "aitoolcrux", "days": 30 }`
- 返回：分析结果和报告路径

### GET /reports/:site
获取指定站点的报告列表

### GET /reports/:site/latest
获取指定站点的最新报告（Markdown格式）

## 定时任务配置
在Railway中配置Cron Job，每天自动运行分析：
- 时间：每天凌晨3点（UTC）
- 命令：`npm run pipeline -- --site aitoolcrux --days 30`

## 注意事项
1. Service Account需要在GSC中被授权为property所有者
2. GA4 property ID需要正确配置（数字格式，不是G-XXXXXXXXXX）
3. 首次运行可能需要较长时间，请耐心等待
4. 数据有3天延迟，默认避开最近3天
