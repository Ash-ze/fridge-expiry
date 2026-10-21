// 用 Playwright 把 public/icons/icon.svg 渲染成 PNG 图标：node scripts/gen-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const targets = [
  ['public/icons/icon-192.png', 192, false],
  ['public/icons/icon-512.png', 512, false],
  ['public/icons/apple-touch-icon.png', 180, true],
  ['public/icons/icon-maskable-512.png', 512, true],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, full] of targets) {
  await page.setViewportSize({ width: size, height: size });
  // maskable / apple 图标：铺满背景，内容缩小到安全区
  const inner = full
    ? `<div style="width:${size}px;height:${size}px;background:#f0803c;display:grid;place-items:center"><div style="width:${size * 0.8}px;height:${size * 0.8}px">${svg.replace('rx="112"', 'rx="0"')}</div></div>`
    : `<div style="width:${size}px;height:${size}px">${svg}</div>`;
  await page.setContent(`<html><body style="margin:0;background:transparent">${inner}</body></html>`);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', file);
}
await browser.close();
