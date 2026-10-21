// 端到端冒烟测试：先 `npm run build`，然后 `npm run test:e2e`。
// 会启动 vite preview（自动找空闲端口，也可用 E2E_PORT 指定），用 Playwright（Chromium）模拟手机操作，
// 并把截图保存到 screenshots/。
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';

const freePort = () =>
  new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });

const PORT = Number(process.env.E2E_PORT) || (await freePort());
const URL = `http://localhost:${PORT}/`;
const pad = (n) => String(n).padStart(2, '0');
const iso = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

mkdirSync('screenshots', { recursive: true });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('vite preview 启动超时')), 20000);
  server.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) {
      clearTimeout(timer);
      resolve();
    }
  });
  server.on('exit', (c) => reject(new Error('vite preview 退出: ' + c)));
});

const browser = await chromium.launch();
const errors = [];
let step = '';
const ok = (msg) => console.log('  ✓', msg);
const shot = async (page, name) => {
  await page.evaluate(() => (document.querySelector('#toast').hidden = true));
  await page.screenshot({ path: `screenshots/${name}.png`, animations: 'disabled' });
};

/** 检查窄屏布局：没有横向滚动；卡片按钮在任何滚动位置都不被底部导航等固定元素挡住 */
async function checkLayout(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `${label}：出现横向滚动 ${overflow}px`);
  const covered = await page.evaluate(async () => {
    document.querySelector('#toast').hidden = true; // 提示条只短暂出现，不算遮挡
    const bad = [];
    const topBottom = document.querySelector('.topbar').getBoundingClientRect().bottom;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    for (let y = 0; y <= max + 1; y += 120) {
      window.scrollTo(0, Math.min(y, max));
      await new Promise((r) => requestAnimationFrame(() => r()));
      const tabTop = document.querySelector('.tabbar').getBoundingClientRect().top;
      for (const b of document.querySelectorAll('#item-list .act')) {
        const r = b.getBoundingClientRect();
        if (r.top < topBottom || r.top >= tabTop) continue; // 滚到顶栏下面或导航栏下面属于正常滚动
        const cy = Math.min(r.top + r.height / 2, tabTop - 1);
        const el = document.elementFromPoint(r.left + r.width / 2, cy);
        const partlyHidden = r.bottom > tabTop && r.top < tabTop;
        if (!partlyHidden && el && !b.contains(el)) bad.push(`${b.textContent.trim()} @${y} 被 ${el.className || el.tagName} 挡住`);
      }
    }
    window.scrollTo(0, max);
    await new Promise((r) => requestAnimationFrame(() => r()));
    const last = [...document.querySelectorAll('#item-list .item-actions')].pop();
    const tabTop = document.querySelector('.tabbar').getBoundingClientRect().top;
    if (last && last.getBoundingClientRect().bottom > tabTop) bad.push('滚到底后最后一张卡片仍被导航栏挡住');
    window.scrollTo(0, 0);
    return bad;
  });
  assert.deepEqual(covered, [], `${label}：${covered.join('；')}`);
}

try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    colorScheme: 'light',
    acceptDownloads: true,
  });
  await context.grantPermissions(['notifications'], { origin: URL.slice(0, -1) });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const itemCard = (name) => page.locator('#item-list .item', { has: page.locator(`.nm:text-is("${name}")`) });

  step = '打开应用';
  await page.goto(URL);
  await page.waitForSelector('body.ready');
  assert.match(await page.textContent('#item-list'), /冰箱还是空的/);
  ok('空状态显示正常');

  step = '自动补全添加牛奶';
  await page.click('#fab');
  await page.fill('#f-name', '牛');
  await page.waitForSelector('#ac-list li[data-name="牛奶"]');
  await shot(page, 'mobile-add');
  await page.click('#ac-list li[data-name="牛奶"]');
  assert.equal(await page.inputValue('#f-name'), '牛奶');
  assert.equal(await page.inputValue('#f-purchase'), iso(0));
  assert.equal(await page.inputValue('#f-expiry'), iso(7), '牛奶冷藏应默认 7 天');
  assert.equal(await page.textContent('#emoji-btn'), '🥛');
  assert.match(await page.textContent('#opened-hint'), /开封后2-3天/);
  await page.fill('#f-qty', '2');
  await page.fill('#f-unit', '盒');
  await page.click('#save-more');
  await waitSaved('牛奶');
  ok('牛奶 自动填写到期日（+7 天）并保存');

  async function waitSaved(name) {
    await page.waitForSelector(`#toast:has-text("已添加 ${name}")`);
    await page.waitForFunction(() => document.querySelector('#f-name').value === '');
  }
  const addItem = async (name, { expiry, storage, more = true } = {}) => {
    await page.fill('#f-name', name);
    if (storage) await page.click(`#f-storage input[value="${storage}"] + span`);
    if (expiry !== undefined) await page.fill('#f-expiry', expiry);
    await page.click(more ? '#save-more' : '#save-btn');
    if (more) await waitSaved(name);
  };
  step = '连续添加';
  await addItem('豆腐', { expiry: iso(0) });
  await addItem('番茄', { expiry: iso(1) });
  await addItem('菠菜', { expiry: iso(-2) });
  await addItem('苹果');
  await page.fill('#f-name', '鸡蛋');
  assert.equal(await page.inputValue('#f-expiry'), iso(30), '鸡蛋冷藏应默认 30 天');
  await page.click('#f-storage input[value="pantry"] + span');
  assert.equal(await page.inputValue('#f-expiry'), iso(14), '换成常温后到期日应重新计算');
  await page.click('#f-storage input[value="freezer"] + span');
  assert.match(await page.textContent('#expiry-hint'), /冷冻没有默认值/, '鸡蛋不适合冷冻，不应自动推算');
  await page.click('#f-storage input[value="fridge"] + span');
  assert.equal(await page.inputValue('#f-expiry'), iso(30));
  await page.click('#save-btn');
  await page.waitForSelector('#item-dialog:not([open])', { state: 'attached' });
  ok('添加 6 种食材（含存放位置切换重算到期日，鸡蛋冷冻不给默认值）');

  step = '表单里的已开封开关';
  await page.click('#fab');
  await page.fill('#f-name', '酸奶');
  assert.equal(await page.inputValue('#f-expiry'), iso(14));
  await page.click('.switch-row');
  assert.equal(await page.inputValue('#f-expiry'), iso(1), '酸奶开封后应提前到 1 天');
  await page.click('.switch-row');
  assert.equal(await page.inputValue('#f-expiry'), iso(14), '取消开封应恢复');
  await page.click('#item-dialog [data-close]');
  ok('勾选「已开封」时到期日按开封保质期提前，取消后恢复');

  step = '检查排序';
  const names = await page.$$eval('#item-list .item .nm', (els) => els.map((e) => e.textContent.trim()));
  assert.deepEqual(names, ['菠菜', '豆腐', '番茄', '牛奶', '鸡蛋', '苹果']);
  const groups = await page.$$eval('#item-list .group', (els) => els.map((e) => e.dataset.group));
  assert.deepEqual(groups, ['expired', 'today', 'soon', 'normal']);
  const remains = await page.$$eval('#item-list .remain', (els) => els.map((e) => e.textContent));
  assert.deepEqual(remains.slice(0, 4), ['已过期 2 天', '今天到期', '明天到期', '还剩 7 天']);
  assert.match(await page.textContent('#item-list .item[data-id] .qty'), /./);
  ok('按 已过期 / 今天到期 / 3天内 / 正常 排序：' + names.join(' > '));

  step = '启动横幅';
  await page.reload();
  await page.waitForSelector('body.ready');
  const banner = await page.textContent('#banner');
  assert.match(banner, /1 件已过期/);
  assert.match(banner, /1 件今天到期/);
  assert.match(banner, /1 件 3 天内到期/);
  ok('横幅：' + banner.replace('✕', '').trim());
  await shot(page, 'mobile-fridge');

  step = '筛选';
  await page.click('[data-filter="pantry"]');
  assert.equal(await page.locator('#item-list .item').count(), 0);
  await page.click('[data-filter="all"]');
  ok('存放位置筛选');

  step = '吃掉了 / 扔掉了';
  await itemCard('豆腐').locator('[data-act="eat"]').click();
  await itemCard('豆腐').waitFor({ state: 'detached' });
  await itemCard('菠菜').locator('[data-act="throw"]').click();
  await itemCard('菠菜').waitFor({ state: 'detached' });
  assert.equal(await page.textContent('[data-stat="eaten"]'), '1');
  assert.equal(await page.textContent('[data-stat="thrown"]'), '1');
  ok('豆腐 吃掉了、菠菜 扔掉了；本月统计 1 : 1');

  step = '吃一部分';
  await itemCard('牛奶').locator('[data-act="portion"]').click();
  assert.equal(await page.inputValue('#p-amount'), '1');
  assert.match(await page.textContent('#portion-left'), /还剩 1盒/);
  await page.click('#portion-save');
  await page.waitForSelector('#toast:has-text("还剩 1盒")');
  assert.match(await itemCard('牛奶').locator('.qty').textContent(), /× 1盒/);
  assert.equal(await page.textContent('[data-stat="eaten"]'), '1', '吃一部分不应计入吃掉条数');
  await itemCard('牛奶').locator('[data-act="portion"]').click();
  assert.equal(await page.inputValue('#p-amount'), '0.5', '只剩 1 时默认吃一半');
  await page.click('#portion-quick [data-frac="0.5"]');
  await page.click('#portion-save');
  await page.waitForSelector('#toast:has-text("还剩 0.5盒")');
  await page.click('#undo-btn');
  await page.waitForFunction(() => /× 1盒/.test(document.querySelector('#item-list').textContent));
  ok('牛奶 2盒 → 吃 1 盒剩 1 盒；再吃一半可撤销');

  step = '撤销删除';
  await itemCard('苹果').locator('[data-act="more"]').click();
  await page.click('[data-more="delete"]');
  await itemCard('苹果').waitFor({ state: 'detached' });
  await page.click('#undo-btn');
  await itemCard('苹果').waitFor();
  ok('「⋯」里删除后可撤销');

  step = '已开封';
  await itemCard('牛奶').locator('[data-act="more"]').click();
  assert.match(await page.textContent('[data-more="opened"]'), /提前到/);
  await page.click('[data-more="opened"]');
  await page.waitForSelector('#toast:has-text("已开封")');
  await page.waitForSelector('#item-list .g-soon .item:has-text("牛奶") .tag-opened');
  assert.equal(await itemCard('牛奶').locator('.remain').textContent(), '还剩 2 天');
  ok('牛奶 标记已开封：到期日提前到 2 天后，移入「3天内」');

  step = '编辑';
  await itemCard('牛奶').locator('[data-act="more"]').click();
  await page.click('[data-more="edit"]');
  assert.equal(await page.inputValue('#f-qty'), '1');
  assert.equal(await page.isChecked('#f-opened'), true);
  await page.click('.switch-row'); // 取消开封 → 恢复原到期日
  assert.equal(await page.inputValue('#f-expiry'), iso(7));
  await page.click('.switch-row');
  assert.equal(await page.inputValue('#f-expiry'), iso(2));
  await page.fill('#f-qty', '3');
  await page.click('#save-btn');
  await page.waitForSelector('#toast:has-text("已更新 牛奶")');
  assert.match(await itemCard('牛奶').locator('.qty').textContent(), /× 3盒/);
  await itemCard('牛奶').locator('[data-act="more"]').click();
  assert.match(await page.textContent('[data-more="opened"]'), /取消已开封/);
  await page.click('[data-more="opened"]');
  await page.waitForSelector('#item-list .g-normal .item:has-text("牛奶")');
  assert.equal(await itemCard('牛奶').locator('.tag-opened').count(), 0);
  ok('编辑保留开封状态；取消开封后到期日恢复为 7 天');

  step = '窄屏布局（360px）';
  await page.setViewportSize({ width: 360, height: 740 });
  await checkLayout(page, '360px 浅色');
  await page.setViewportSize({ width: 414, height: 800 });
  await checkLayout(page, '414px 浅色');
  await page.setViewportSize({ width: 390, height: 844 });
  ok('360 / 414px：无横向滚动，卡片按钮不被底部导航挡住');

  step = '今天吃什么';
  await page.click('.tabbar [data-view="recipes"]');
  await page.waitForSelector('#recipe-list .recipe');
  const top = await page.getAttribute('#recipe-list .recipe.top', 'data-recipe');
  const topIngs = await page.textContent('#recipe-list .recipe.top .ings');
  assert.match(top, /西红柿|番茄/);
  assert.match(topIngs, /鸡蛋/);
  const spinach = page.locator('#recipe-list .recipe[data-recipe="菠菜蛋汤"]');
  if (await spinach.count()) {
    assert.match(await spinach.locator('.missing').textContent(), /菠菜/, '扔掉的菠菜应显示为缺少');
  }
  ok(`首选菜：${top}（已有：${topIngs.replace(/\s+/g, ' ').trim()}）`);

  step = '菜谱筛选与做法';
  await page.click('#recipe-filters [data-kind="soup"]');
  const soups = await page.$$eval('#recipe-list .recipe', (els) => els.map((e) => e.dataset.recipe));
  assert.ok(soups.length > 0 && soups.every((n) => n.includes('汤')), '「汤」筛选只显示汤：' + soups.join('、'));
  await page.click('#recipe-filters [data-kind="meat"]');
  const meatKinds = await page.$$eval('#recipe-list .recipe .recipe-kinds', (els) => els.map((e) => e.textContent));
  assert.ok(meatKinds.every((k) => k.includes('荤')));
  await page.click('#recipe-filters [data-kind="quick"]');
  const quickTimes = await page.$$eval('#recipe-list .recipe-kinds', (els) => els.map((e) => Number(e.textContent.match(/约 (\d+) 分钟/)[1])));
  assert.ok(quickTimes.length && quickTimes.every((t) => t <= 15));
  await page.click('#recipe-filters [data-kind="all"]');
  await page.click('#recipe-list .recipe.top summary');
  const stepsN = await page.locator('#recipe-list .recipe.top .steps ol li').count();
  assert.ok(stepsN >= 3 && stepsN <= 5, '每道菜 3-5 步');
  ok(`筛选 汤（${soups.length}）/ 荤 / 快手；首选菜做法 ${stepsN} 步`);
  await shot(page, 'mobile-recipes');

  step = '缺的食材加入购物清单';
  const withMissing = page.locator('#recipe-list .recipe:has([data-add-missing]:not([disabled]))').first();
  const missingText = (await withMissing.locator('.missing').textContent()).replace('还缺：', '').split('、');
  await withMissing.locator('[data-add-missing]').click();
  await page.waitForSelector('#toast:has-text("已加入购物清单")');
  assert.equal(await page.textContent('#shop-badge'), String(missingText.length));
  ok(`把缺的 ${missingText.join('、')} 加入购物清单`);

  step = '购物清单';
  await page.click('.tabbar [data-view="shopping"]');
  for (const m of missingText) await page.waitForSelector(`.shop-item:has-text("${m}")`);
  await page.fill('#shop-input', '可乐 2, 西红柿, 鸡腿 4个, 生菜');
  await page.press('#shop-input', 'Enter');
  await page.waitForSelector('.shop-item:has-text("可乐")');
  await page.fill('#shop-input', '番茄');
  await page.press('#shop-input', 'Enter');
  await page.waitForSelector('#toast:has-text("已经在清单里了")');
  assert.equal(await page.locator('#shop-list .shop-item').count(), missingText.length + 4);
  const pendingLeft = missingText.length + 2; // 勾掉两样之后还剩的
  await page.click(`.shop-item:has-text("${missingText[0]}") .check`);
  await page.click('.shop-item:has-text("可乐") .check');
  await page.waitForSelector('.shop-done .shop-item:has-text("可乐")');
  assert.equal(await page.textContent('#shop-badge'), String(pendingLeft));
  await shot(page, 'mobile-shopping');
  await page.click('#shop-to-fridge');
  await page.waitForSelector('#batch-step-confirm:not([hidden])');
  assert.equal(await page.locator('#batch-list .brow').count(), 2);
  await page.click('#batch-save');
  await page.waitForSelector('#toast:has-text("已添加 2 样食材")');
  await itemCard('可乐').waitFor();
  assert.equal(await page.textContent('#shop-badge'), String(pendingLeft));
  ok('购物清单：添加（自动去重）、勾选、把已买到的一键放进冰箱');

  step = '购物清单模式（批量添加）';
  await page.click('#fab');
  await page.click('#batch-btn');
  await page.fill('#batch-text', '酸奶 2, 鸡蛋 10个, 两盒豆腐, 神秘食材');
  await page.click('#batch-parse');
  const rows = page.locator('#batch-list .brow');
  assert.equal(await rows.count(), 4);
  assert.equal(await rows.nth(0).locator('.b-name').inputValue(), '酸奶');
  assert.equal(await rows.nth(0).locator('.b-qty').inputValue(), '2');
  assert.equal(await rows.nth(0).locator('.b-exp').inputValue(), iso(14));
  assert.equal(await rows.nth(1).locator('.b-unit').inputValue(), '个');
  assert.equal(await rows.nth(2).locator('.b-name').inputValue(), '豆腐');
  assert.equal(await rows.nth(2).locator('.b-qty').inputValue(), '2');
  assert.equal(await rows.nth(3).locator('.b-exp').inputValue(), '', '不认识的食材没有默认到期日');
  await rows.nth(1).locator('input[value="freezer"] + span').click();
  assert.equal(await rows.nth(1).locator('.b-exp').inputValue(), '', '鸡蛋冷冻没有默认值');
  await rows.nth(1).locator('input[value="fridge"] + span').click();
  assert.equal(await rows.nth(1).locator('.b-exp').inputValue(), iso(30));
  await shot(page, 'mobile-batch');
  await page.click('#batch-save');
  assert.match(await page.textContent('#batch-warn'), /1 样没有到期日期/);
  await rows.nth(3).locator('.b-del').click();
  await page.click('#batch-save');
  await page.waitForSelector('#toast:has-text("已添加 3 样食材")');
  await page.waitForSelector('#batch-dialog:not([open])', { state: 'attached' });
  ok('输入「酸奶 2, 鸡蛋 10个, 两盒豆腐, 神秘食材」→ 确认列表 → 保存 3 样');

  step = '统计设置与导出';
  await page.click('.tabbar [data-view="me"]');
  assert.equal(await page.textContent('#stat-eaten'), '1');
  assert.equal(await page.textContent('#stat-thrown'), '1');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#export-btn')]);
  const backup = JSON.parse(readFileSync(await download.path(), 'utf8'));
  assert.equal(backup.app, 'fridge-expiry-keeper');
  assert.equal(backup.items.length, 11);
  assert.equal(backup.shopping.length, pendingLeft);
  ok('导出 JSON 备份（含购物清单）：' + download.suggestedFilename());

  step = '导入';
  await page.setInputFiles('#import-file', {
    name: 'b.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ items: [{ id: 'imp1', name: '果汁', expiryDate: iso(5), storage: 'fridge', opened: true, openedDate: iso(0), expiryBeforeOpen: iso(14) }] })),
  });
  await page.waitForSelector('#toast:has-text("导入 1 条")');
  ok('导入 JSON 备份');

  step = '深色模式';
  await page.click('#theme-seg input[value="dark"] + span');
  await page.click('.tabbar [data-view="fridge"]');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(bg, 'rgb(31, 26, 22)');
  await page.waitForSelector('#item-list .item:has-text("果汁") .tag-opened');
  await shot(page, 'mobile-fridge-dark');
  await page.setViewportSize({ width: 360, height: 740 });
  await checkLayout(page, '360px 深色');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#theme-btn'); // dark → auto
  ok('深色模式切换（360px 深色布局检查通过）');

  step = 'Service Worker 离线';
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('body.ready');
  assert.ok((await page.locator('#item-list .item').count()) >= 10);
  assert.equal(await page.textContent('#shop-badge'), String(pendingLeft));
  await context.setOffline(false);
  ok('离线刷新仍可打开，数据和购物清单仍在');

  step = 'manifest 与 Open Graph';
  const manifest = await (await page.request.get(URL + 'manifest.webmanifest')).json();
  assert.equal(manifest.name, '冰箱临期管家');
  assert.equal(await page.getAttribute('meta[property="og:image"]', 'content'), 'https://ash-ze.github.io/fridge-expiry/og.png');
  assert.equal((await page.request.get(URL + 'og.png')).status(), 200);
  ok('manifest、og:image 可访问');

  step = '拼接 README 总览图';
  const b64 = (n) => readFileSync(`screenshots/${n}.png`).toString('base64');
  const shotsPage = await browser.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
  await shotsPage.setContent(`<html><body style="margin:0;background:#fdecd6;display:flex;gap:24px;padding:28px;box-sizing:border-box;justify-content:center">
    ${['mobile-fridge', 'mobile-recipes', 'mobile-shopping', 'mobile-batch']
      .map((n) => `<img src="data:image/png;base64,${b64(n)}" style="width:264px;border-radius:22px;box-shadow:0 8px 24px rgba(120,72,30,.18)">`)
      .join('')}</body></html>`);
  await shotsPage.screenshot({ path: 'screenshots/overview.png', fullPage: true });
  await shotsPage.close();
  ok('screenshots/overview.png');

  assert.deepEqual(errors, [], '页面不应有报错');
  console.log('\n全部通过 ✅');
} catch (e) {
  console.error(`\n✗ 失败于「${step}」：`, e.message);
  if (errors.length) console.error('页面错误：', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  server.stdout.destroy();
}
