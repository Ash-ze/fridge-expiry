// 生成分享卡片图 public/og.png（1200×630，用于 Open Graph / Twitter）：node scripts/gen-og.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const card = (emoji, name, meta, badge, color, soft) => `
  <div class="item" style="border-left-color:${color}">
    <div class="emoji">${emoji}</div>
    <div class="main"><b>${name}</b><span>${meta}</span></div>
    <span class="badge" style="color:${color};background:${soft}">${badge}</span>
  </div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; width:1200px; height:630px; background:#fff7ec; color:#3b2a1e;
    font-family: 'PingFang SC','Noto Sans CJK SC','Noto Sans SC','Microsoft YaHei',sans-serif; display:flex; align-items:center; }
  .left { flex:1; padding:0 40px 0 80px; }
  .logo { width:120px; height:120px; }
  h1 { font-size:68px; margin:28px 0 12px; letter-spacing:2px; }
  p { font-size:26px; color:#8a7462; margin:0 0 30px; line-height:1.5; }
  .pills span { display:inline-block; font-size:21px; font-weight:700; padding:7px 16px; border-radius:999px; background:#ffe6d3; color:#f0803c; margin:0 8px 12px 0; }
  .right { width:470px; padding-right:70px; display:flex; flex-direction:column; gap:18px; }
  .item { background:#fff; border-radius:22px; box-shadow:0 6px 20px rgba(120,72,30,.12); padding:18px 22px; display:flex; align-items:center; gap:18px; border-left:8px solid; }
  .emoji { font-size:40px; width:64px; height:64px; border-radius:18px; background:#fdecd6; display:grid; place-items:center; }
  .main { flex:1; display:flex; flex-direction:column; }
  .main b { font-size:28px; } .main span { font-size:20px; color:#8a7462; }
  .badge { font-size:20px; font-weight:700; padding:4px 14px; border-radius:999px; }
</style></head><body>
  <div class="left">
    <div class="logo">${svg}</div>
    <h1>冰箱临期管家</h1>
    <p>记下买回来的食材，按到期紧急程度排好队，<br/>推荐用快过期食材做的家常菜。</p>
    <div class="pills"><span>临期提醒</span><span>今天吃什么</span><span>购物清单</span><span>纯本地 · PWA</span></div>
  </div>
  <div class="right">
    ${card('🥛', '牛奶 × 2盒', '❄️ 冷藏 · 已开封', '今天到期', '#f08a24', '#ffe8cc')}
    ${card('🍅', '西红柿 × 3个', '❄️ 冷藏 · 明天到期', '3天内', '#c99400', '#fff3c4')}
    ${card('🥚', '鸡蛋 × 10个', '❄️ 冷藏 · 还剩 20 天', '正常', '#3f9d5a', '#dff3e3')}
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
console.log('wrote public/og.png');
