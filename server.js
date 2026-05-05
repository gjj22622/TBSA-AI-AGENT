const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

// ── 課程設定（從環境變數讀，附預設值方便本機測試）─────────────
const CONFIG = {
  ORG_NAME:        process.env.ORG_NAME        || '大葉大學',
  ORG_SHORT:       process.env.ORG_SHORT       || '大葉',
  COURSE_MONTH:    process.env.COURSE_MONTH    || '2026/05',
  COURSE_MONTH_EN: process.env.COURSE_MONTH_EN || 'May 2026',
  LINE_URL:        process.env.LINE_URL        || 'https://line.me/ti/g2/vr2UuRrCCA',
  DATAROOM_URL:    process.env.DATAROOM_URL    || 'https://drive.google.com/drive/folders/1qw7NWRdzaGVDP2G6ZDoo3EEn4lfYZ3rf?usp=sharing',
  UPLOAD_URL:      process.env.UPLOAD_URL      || 'https://drive.google.com/drive/folders/1oE6IpSZD-Fod7DzTHaSazMF-JFPwk0H7?usp=sharing',
};

// ── 載入並填入 HTML 範本 ──────────────────────────────────────
const HTML_PATH = path.join(__dirname, 'public', 'index.html');
let htmlTemplate = fs.readFileSync(HTML_PATH, 'utf-8');

function renderHTML() {
  let out = htmlTemplate;
  for (const [key, val] of Object.entries(CONFIG)) {
    out = out.replaceAll(`{{${key}}}`, val);
  }
  return out;
}

// 首頁：注入 config 後回傳
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(renderHTML());
});

// 其他靜態資源（CSS / JS / 圖片）
app.use(express.static(path.join(__dirname, 'public')));

// ── 即時同步（SSE）────────────────────────────────────────────
let STATE = { labs: {}, steps: { day1: -1, day2: -1 }, hw: {} };
const clients = new Set();

function broadcast() {
  const msg = `data: ${JSON.stringify(STATE)}\n\n`;
  clients.forEach(c => { try { c.write(msg); } catch (_) { clients.delete(c); } });
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(STATE)}\n\n`);
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

app.get('/api/count', (req, res) => res.json({ count: clients.size }));

app.post('/api/update', (req, res) => {
  const { type, key, value } = req.body;
  if (type === 'labs')  STATE.labs[String(key)]  = !!value;
  if (type === 'steps') STATE.steps[String(key)] = Number(value);
  if (type === 'hw')    STATE.hw[String(key)]    = !!value;
  broadcast();
  res.json({ ok: true });
});

app.post('/api/reset', (req, res) => {
  STATE = { labs: {}, steps: { day1: -1, day2: -1 }, hw: {} };
  broadcast();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] port ${PORT}`);
  console.log(`[config] ORG_NAME=${CONFIG.ORG_NAME}`);
});
