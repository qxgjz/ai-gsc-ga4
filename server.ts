import express from 'express';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

// 从环境变量读取service account并写入文件
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  const saPath = path.join(process.cwd(), 'service-account.json');
  if (!fs.existsSync(saPath)) {
    fs.writeFileSync(saPath, process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    console.log('Service account written from environment variable');
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'ai-gsc-ga4-api' });
});

// 触发分析
app.post('/analyze', (req, res) => {
  const { site = 'aitoolcrux', days = 30 } = req.body;
  
  console.log(`Starting analysis for site: ${site}, days: ${days}`);
  
  const child = exec(`npm run pipeline -- --site ${site} --days ${days}`, {
    cwd: process.cwd(),
    env: { ...process.env, PATH: process.env.PATH }
  });
  
  let output = '';
  child.stdout?.on('data', (data) => {
    output += data;
    console.log(data.toString());
  });
  child.stderr?.on('data', (data) => {
    output += data;
    console.error(data.toString());
  });
  
  child.on('close', (code) => {
    console.log(`Analysis finished with code: ${code}`);
    res.json({ 
      success: code === 0, 
      code, 
      output,
      reportPath: code === 0 ? `/reports/${site}` : null
    });
  });
});

// 获取报告列表
app.get('/reports/:site', (req, res) => {
  const { site } = req.params;
  const reportsDir = path.join(process.cwd(), 'reports', site);
  
  if (!fs.existsSync(reportsDir)) {
    return res.status(404).json({ error: 'No reports found' });
  }
  
  const files = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();
  
  res.json({ site, reports: files });
});

// 获取最新报告
app.get('/reports/:site/latest', (req, res) => {
  const { site } = req.params;
  const reportsDir = path.join(process.cwd(), 'reports', site);
  
  if (!fs.existsSync(reportsDir)) {
    return res.status(404).json({ error: 'No reports found' });
  }
  
  const files = fs.readdirSync(reportsDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    return res.status(404).json({ error: 'No reports found' });
  }
  
  const latestReport = fs.readFileSync(path.join(reportsDir, files[0]), 'utf-8');
  res.set('Content-Type', 'text/markdown');
  res.send(latestReport);
});

app.listen(PORT, () => {
  console.log(`AI GSC+GA4 API server running on port ${PORT}`);
});
