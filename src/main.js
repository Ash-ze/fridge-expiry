import './style.css';
import { CATEGORIES, STORAGES, resolveFood, searchFoods, describeShelfLife, describeOpened } from './data/foods.js';
import {
  URGENCY,
  URGENCY_ORDER,
  activeItems,
  addDays,
  bannerText,
  consumePortion,
  daysLeft,
  defaultPortion,
  earlierDate,
  groupByUrgency,
  isValidISODate,
  markOpened,
  monthlyStats,
  openedExpiryFor,
  remainingText,
  shelfDaysFor,
  suggestExpiry,
  summarize,
  toISODate,
  unmarkOpened,
  urgencyOf,
} from './lib/expiry.js';
import { RECIPE_FILTERS, recipeKinds, suggestRecipes } from './lib/recipes.js';
import { draftFromEntry, draftsFromText, parseBatchText } from './lib/batch.js';
import {
  addToShopping,
  pendingCount,
  removeShopping,
  sanitizeShopping,
  sortShopping,
  toggleShopping,
} from './lib/shopping.js';
import { makeBackup, parseBackup, newId } from './lib/backup.js';
import * as store from './lib/store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const lsGet = (k, d = null) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : v;
  } catch {
    return d;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* 隐私模式下可能不可用 */
  }
};

const SHOP_KEY = 'fridge-keeper:shopping';

const state = {
  items: [],
  shopping: [],
  view: 'fridge',
  filter: 'all',
  query: '',
  recipeKind: 'all',
  recipeResults: [],
  editingId: null,
  expiryTouched: false,
  formBeforeOpen: null,
  emoji: '',
  category: 'other',
  actionId: null, // 「吃一部分」/「更多」正在操作的物品
  batch: [], // 购物清单模式的待确认列表
  batchShopIds: null, // 从购物清单放进冰箱时，保存后要移除的清单项
};

const today = () => toISODate();
const fmtQty = (n) => String(Math.round(Number(n) * 100) / 100);

function fmtDate(iso) {
  if (!isValidISODate(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const sameYear = y === new Date().getFullYear();
  return sameYear ? `${m}月${d}日` : `${y}年${m}月${d}日`;
}

function iconFor(item) {
  if (item.emoji) return item.emoji;
  const food = resolveFood(item.name);
  if (food) return food.emoji;
  return CATEGORIES[item.category]?.emoji || '📦';
}

function openDialog(d) {
  if (typeof d.showModal === 'function') {
    if (!d.open) d.showModal();
  } else d.setAttribute('open', '');
}
function closeDialog(d) {
  if (d.open && typeof d.close === 'function') d.close();
  else d.removeAttribute('open');
}

// ---------------- 购物清单存储 ----------------

function loadShopping() {
  try {
    return sanitizeShopping(JSON.parse(lsGet(SHOP_KEY, '[]')));
  } catch {
    return [];
  }
}
function saveShopping(list) {
  state.shopping = list;
  lsSet(SHOP_KEY, JSON.stringify(list));
  updateShopBadge();
}
function updateShopBadge() {
  const n = pendingCount(state.shopping);
  const b = $('#shop-badge');
  b.textContent = n > 99 ? '99+' : String(n);
  b.hidden = n === 0;
}

// ---------------- 渲染：冰箱 ----------------

function renderMonthStrip() {
  const s = monthlyStats(state.items, today());
  const rate = s.total ? Math.round(s.wasteRate * 100) : 0;
  $('#month-strip').innerHTML = `
    <div class="ms-item"><span class="ms-num" data-stat="eaten">${s.eaten}</span><span>本月吃掉</span></div>
    <div class="ms-item"><span class="ms-num warn" data-stat="thrown">${s.thrown}</span><span>本月扔掉</span></div>
    <div class="ms-item"><span class="ms-num">${s.total ? rate + '%' : '–'}</span><span>浪费率</span></div>`;
}

function renderFilters(active) {
  const counts = { all: active.length, fridge: 0, freezer: 0, pantry: 0 };
  active.forEach((i) => counts[i.storage]++);
  const chips = [['all', '全部'], ...Object.entries(STORAGES).map(([k, v]) => [k, `${v.emoji} ${v.label}`])];
  $('#filter-chips').innerHTML = chips
    .map(
      ([k, label]) =>
        `<button type="button" role="tab" class="chip${state.filter === k ? ' on' : ''}" data-filter="${k}" aria-selected="${state.filter === k}">${label}<b>${counts[k]}</b></button>`,
    )
    .join('');
}

function itemHTML(it, t) {
  const days = daysLeft(it.expiryDate, t);
  const u = urgencyOf(days);
  const qty = it.qty && (it.qty !== 1 || it.unit) ? `<span class="qty">× ${esc(fmtQty(it.qty))}${esc(it.unit || '')}</span>` : '';
  const st = STORAGES[it.storage] || STORAGES.fridge;
  const opened = it.opened ? '<span class="tag-opened">已开封</span>' : '';
  return `
  <li class="item u-${u}" data-id="${esc(it.id)}">
    <div class="item-row">
      <div class="item-emoji" aria-hidden="true">${esc(iconFor(it))}</div>
      <div class="item-main">
        <div class="item-name"><span class="nm">${esc(it.name)}</span> ${qty}</div>
        <div class="item-meta"><span>${st.emoji} ${st.label}${opened}</span> <span>· ${fmtDate(it.expiryDate)}到期</span></div>
      </div>
      <div class="item-side">
        <span class="badge b-${u}">${URGENCY[u].label}</span>
        <span class="remain">${remainingText(days)}</span>
      </div>
    </div>
    <div class="item-actions">
      <button type="button" class="act eat" data-act="eat">😋 吃掉了</button>
      <button type="button" class="act part" data-act="portion">🍽️ 吃一部分</button>
      <button type="button" class="act throw" data-act="throw">🗑️ 扔掉了</button>
      <button type="button" class="act more" data-act="more" aria-label="更多操作：开封、编辑、删除" title="更多操作">⋯</button>
    </div>
  </li>`;
}

function renderFridge() {
  const t = today();
  const active = activeItems(state.items);
  renderMonthStrip();
  renderFilters(active);
  let list = state.filter === 'all' ? active : active.filter((i) => i.storage === state.filter);
  const q = state.query.trim();
  if (q) list = list.filter((i) => i.name.includes(q));
  const el = $('#item-list');
  if (!active.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🧺</div><p>冰箱还是空的</p><p class="muted">点底部的「＋ 添加」记录买回来的食材，<br/>一次买了很多可以用「购物清单模式」。</p></div>`;
    return;
  }
  if (!list.length) {
    el.innerHTML = `<div class="empty small"><p class="muted">没有符合条件的食材</p></div>`;
    return;
  }
  const groups = groupByUrgency(list, t);
  el.innerHTML = URGENCY_ORDER.filter((k) => groups[k].length)
    .map(
      (k) => `
      <section class="group g-${k}" data-group="${k}">
        <h3><span class="dot"></span>${URGENCY[k].label}<span class="count">${groups[k].length}</span></h3>
        <ul class="items">${groups[k].map((it) => itemHTML(it, t)).join('')}</ul>
      </section>`,
    )
    .join('');
}

// ---------------- 渲染：今天吃什么 ----------------

const KIND_LABEL = { quick: '快手', meat: '荤', veg: '素', soup: '汤' };

function inShoppingList(name) {
  return state.shopping.some((s) => !s.done && (s.name === name || resolveFood(s.name)?.name === resolveFood(name)?.name));
}

function renderRecipes() {
  const t = today();
  $('#recipe-filters').innerHTML = RECIPE_FILTERS.map(
    (f) =>
      `<button type="button" role="tab" class="chip${state.recipeKind === f.key ? ' on' : ''}" data-kind="${f.key}" aria-selected="${state.recipeKind === f.key}">${f.label}</button>`,
  ).join('');
  const results = suggestRecipes(state.items, { today: t, limit: 10, kind: state.recipeKind });
  state.recipeResults = results;
  const el = $('#recipe-list');
  if (!results.length) {
    const hasFood = activeItems(state.items).some((i) => daysLeft(i.expiryDate, t) >= 0);
    el.innerHTML =
      hasFood && state.recipeKind !== 'all'
        ? `<div class="empty small"><p>这一类暂时没有能用上冰箱食材的菜</p><p class="muted">换个分类看看，或者先把缺的食材买回来。</p></div>`
        : `<div class="empty"><div class="empty-icon">🍳</div><p>暂时没有可推荐的菜</p><p class="muted">先在冰箱里添加一些未过期的食材吧。</p></div>`;
    return;
  }
  const tag = (h, cls = '') => {
    const u = urgencyOf(h.days);
    return `<span class="ing have u-${u} ${cls}">${esc(h.ingredient)}${h.item.name !== h.ingredient ? `<small>（${esc(h.item.name)}）</small>` : ''}<em>${remainingText(h.days)}</em></span>`;
  };
  el.innerHTML = results
    .map((r, idx) => {
      const kinds = [...recipeKinds(r.recipe)].map((k) => KIND_LABEL[k]);
      const allListed = r.missing.length && r.missing.every(inShoppingList);
      return `
    <article class="recipe${idx === 0 ? ' top' : ''}" data-recipe="${esc(r.recipe.name)}">
      <div class="recipe-head">
        <span class="recipe-emoji" aria-hidden="true">${r.recipe.emoji}</span>
        <div>
          <h3>${esc(r.recipe.name)}${idx === 0 ? ' <span class="pick">首选</span>' : ''}</h3>
          <p class="muted">${r.missing.length ? `主料齐了 ${r.have.length}/${r.recipe.main.length}` : '主料都有'}${r.urgent ? `，能消耗 ${r.urgent} 样临期食材` : r.missing.length ? '' : '，可以直接做！'}</p>
          <p class="recipe-kinds">⏱ 约 ${r.recipe.time} 分钟${kinds.map((k) => `<span>${k}</span>`).join('')}</p>
        </div>
      </div>
      <div class="ings">
        ${r.have.map((h) => tag(h)).join('')}
        ${r.extrasHave.map((h) => tag(h, 'extra')).join('')}
      </div>
      ${
        r.missing.length
          ? `<div class="missing-row"><p class="missing">还缺：${r.missing.map(esc).join('、')}</p>
             <button type="button" class="btn small add-missing" data-add-missing ${allListed ? 'disabled' : ''}>${allListed ? '✓ 已在购物清单' : '🛒 缺的加入购物清单'}</button></div>`
          : ''
      }
      <details class="steps">
        <summary>做法 · ${r.recipe.steps.length} 步</summary>
        <ol>${r.recipe.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <p class="tip">💡 ${esc(r.recipe.tip)}</p>
      </details>
    </article>`;
    })
    .join('');
}

function addMissingToShopping(recipeName) {
  const r = state.recipeResults.find((x) => x.recipe.name === recipeName);
  if (!r || !r.missing.length) return;
  const { list, added } = addToShopping(state.shopping, r.missing, { from: r.recipe.name });
  saveShopping(list);
  renderRecipes();
  toast(added.length ? `已加入购物清单：${added.join('、')}` : '这些都已经在购物清单里了');
}

// ---------------- 渲染：购物清单 ----------------

function shopItemHTML(s) {
  const qty = s.qty !== 1 || s.unit ? `<small class="s-qty">× ${esc(fmtQty(s.qty))}${esc(s.unit)}</small>` : '';
  const food = resolveFood(s.name);
  return `<li class="shop-item${s.done ? ' done' : ''}" data-sid="${esc(s.id)}">
    <button type="button" class="check" role="checkbox" aria-checked="${s.done}" aria-label="${s.done ? '标记为没买' : '标记为已买到'}：${esc(s.name)}"></button>
    <span class="s-emoji" aria-hidden="true">${food ? food.emoji : '🛒'}</span>
    <span class="s-main"><span class="s-name">${esc(s.name)}</span> ${qty}${s.from ? `<small class="s-from">做${esc(s.from)}</small>` : ''}</span>
    <button type="button" class="s-del" aria-label="从清单删除：${esc(s.name)}">✕</button>
  </li>`;
}

function renderShopping() {
  const list = sortShopping(state.shopping);
  const pending = list.filter((s) => !s.done);
  const done = list.filter((s) => s.done);
  const el = $('#shop-list');
  if (!list.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🛒</div><p>购物清单是空的</p><p class="muted">在上面输入要买的东西，<br/>或在「今天吃什么」里把缺的食材一键加进来。</p></div>`;
    return;
  }
  el.innerHTML = `
    ${pending.length ? `<ul class="shop-items">${pending.map(shopItemHTML).join('')}</ul>` : '<p class="muted shop-alldone">全部买齐了 🎉</p>'}
    ${
      done.length
        ? `<section class="shop-done">
        <div class="shop-done-head">
          <h3>已买到 <span class="count">${done.length}</span></h3>
          <button type="button" class="link-btn" id="shop-clear">清除</button>
        </div>
        <ul class="shop-items">${done.map(shopItemHTML).join('')}</ul>
        <button type="button" class="btn primary block" id="shop-to-fridge">🧊 把已买到的放进冰箱（${done.length}）</button>
      </section>`
        : ''
    }`;
}

// ---------------- 渲染：统计设置 ----------------

function notifStatus() {
  if (!('Notification' in window)) return { text: '当前浏览器不支持通知', can: false };
  if (Notification.permission === 'granted') return { text: '已开启：打开应用时会提醒今天到期的食材', can: false };
  if (Notification.permission === 'denied') return { text: '通知已被拒绝，可在浏览器设置中重新允许', can: false };
  return { text: '开启后，打开应用时会弹出今天到期的提醒', can: true };
}

function renderMe() {
  const s = monthlyStats(state.items, today());
  const pctEaten = s.total ? Math.round((s.eaten / s.total) * 100) : 0;
  const history = state.items
    .filter((i) => i.status === 'eaten' || i.status === 'thrown')
    .sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)))
    .slice(0, 12);
  const n = notifStatus();
  const theme = lsGet('theme', 'auto');
  const [, mm] = s.month.split('-');
  $('#me-content').innerHTML = `
    <div class="card">
      <h2>${Number(mm)}月战绩</h2>
      <div class="big-stats">
        <div><b class="ok" id="stat-eaten">${s.eaten}</b><span>吃掉了</span></div>
        <div><b class="bad" id="stat-thrown">${s.thrown}</b><span>扔掉了</span></div>
      </div>
      <div class="bar" role="img" aria-label="吃掉占比 ${pctEaten}%"><span style="width:${s.total ? pctEaten : 0}%"></span></div>
      <p class="muted">${s.total ? (s.thrown === 0 ? '本月零浪费，太棒了！🎉' : `浪费率 ${Math.round(s.wasteRate * 100)}%，继续加油～`) : '本月还没有记录，吃掉或扔掉食材后会统计在这里。'}</p>
      <p class="hint">按条目统计；「吃一部分」只减少数量，吃完最后一份时才记一次「吃掉了」。</p>
    </div>

    <div class="card">
      <h2>到期提醒</h2>
      <p class="muted" id="notif-status">${n.text}</p>
      ${n.can ? '<button type="button" class="btn primary" id="notif-btn">开启通知提醒</button>' : ''}
      <p class="hint">提醒在本机生成，不经过任何服务器；需要打开应用后才会检查。</p>
    </div>

    <div class="card">
      <h2>外观</h2>
      <div class="seg" id="theme-seg">
        ${[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']]
          .map(([k, l]) => `<label><input type="radio" name="theme" value="${k}" ${theme === k ? 'checked' : ''}/><span>${l}</span></label>`)
          .join('')}
      </div>
    </div>

    <div class="card">
      <h2>数据备份</h2>
      <p class="muted">所有数据（含购物清单）只保存在这台设备的浏览器里。换手机或清理浏览器前，记得导出备份。</p>
      <div class="btn-row">
        <button type="button" class="btn" id="export-btn">⬇️ 导出 JSON</button>
        <button type="button" class="btn" id="import-btn">⬆️ 导入 JSON</button>
      </div>
    </div>

    <div class="card">
      <h2>最近处理</h2>
      ${
        history.length
          ? `<ul class="history">${history
              .map(
                (i) =>
                  `<li><span>${esc(iconFor(i))} ${esc(i.name)}</span><span class="${i.status === 'eaten' ? 'ok' : 'bad'}">${i.status === 'eaten' ? '吃掉了' : '扔掉了'} · ${fmtDate(i.doneAt)}</span></li>`,
              )
              .join('')}</ul>
             <button type="button" class="btn ghost small" id="clear-history">清空处理记录</button>`
          : '<p class="muted">还没有记录</p>'
      }
    </div>
    <p class="footnote">冰箱临期管家 · Fridge Expiry Manager · 开源 · 数据不离开本机<br/>内置保质期和开封后天数仅供参考，请以包装标注和实际状况为准。</p>`;
}

function render() {
  if (state.view === 'fridge') renderFridge();
  else if (state.view === 'recipes') renderRecipes();
  else if (state.view === 'shopping') renderShopping();
  else renderMe();
  updateShopBadge();
}

function setView(view) {
  state.view = view;
  $$('.view').forEach((v) => (v.hidden = v.id !== `view-${view}`));
  $$('.tabbar button[data-view]').forEach((b) => {
    const on = b.dataset.view === view;
    b.classList.toggle('active', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  render();
  window.scrollTo(0, 0);
}

// ---------------- 横幅、通知、提示 ----------------

function renderBanner() {
  const sum = summarize(state.items, today());
  const text = bannerText(sum);
  const el = $('#banner');
  if (!text || lsGet('banner-dismissed') === today()) {
    el.hidden = true;
    return;
  }
  const level = sum.expired || sum.today ? 'hot' : 'warm';
  el.className = `banner ${level}`;
  el.innerHTML = `<span class="banner-icon">${level === 'hot' ? '⏰' : '🔔'}</span><span class="banner-text">${esc(text)}</span><button type="button" class="banner-close" aria-label="今天不再显示">✕</button>`;
  el.hidden = false;
}

async function notifyToday() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const t = today();
  if (lsGet('notified-on') === t) return;
  const items = activeItems(state.items).filter((i) => daysLeft(i.expiryDate, t) === 0);
  if (!items.length) return;
  const names = items.map((i) => i.name);
  const body = `${names.slice(0, 5).join('、')}${names.length > 5 ? ` 等 ${names.length} 件` : ''} 今天到期，记得优先吃掉哦～`;
  const opts = { body, icon: './icons/icon-192.png', badge: './icons/icon-192.png', tag: `expiry-${t}` };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.active) await reg.showNotification('冰箱临期管家 · Fridge Expiry Manager', opts);
    else new Notification('冰箱临期管家 · Fridge Expiry Manager', opts);
    lsSet('notified-on', t);
  } catch {
    /* 部分浏览器（如安卓 Chrome）只允许通过 Service Worker 发通知，下次打开再试 */
  }
}

let toastTimer = null;
function toast(msg, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" id="undo-btn">撤销</button>' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  if (undo) {
    $('#undo-btn').onclick = async () => {
      el.hidden = true;
      await undo();
    };
  }
  toastTimer = setTimeout(() => (el.hidden = true), undo ? 5000 : 2500);
}

// ---------------- 数据操作 ----------------

async function saveItem(item) {
  await store.put(item);
  const idx = state.items.findIndex((i) => i.id === item.id);
  if (idx >= 0) state.items[idx] = item;
  else state.items.push(item);
}

async function refreshAfterChange() {
  render();
  renderBanner();
}

async function markDone(id, status) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  const prev = { ...it };
  await saveItem({ ...it, status, doneAt: today() });
  await refreshAfterChange();
  toast(status === 'eaten' ? `${it.name} 吃掉了，真棒 😋` : `${it.name} 已记为扔掉`, async () => {
    await saveItem(prev);
    await refreshAfterChange();
  });
}

async function deleteItem(id) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  await store.remove(id);
  state.items = state.items.filter((i) => i.id !== id);
  await refreshAfterChange();
  toast(`已删除 ${it.name}`, async () => {
    await saveItem(it);
    await refreshAfterChange();
  });
}

async function toggleOpened(id) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  const next = it.opened ? unmarkOpened(it) : markOpened(it, today());
  await saveItem(next);
  await refreshAfterChange();
  let msg;
  if (!next.opened) msg = `${it.name} 已取消开封标记，到期日恢复为 ${fmtDate(next.expiryDate)}`;
  else if (next.expiryDate !== it.expiryDate) msg = `${it.name} 已开封，到期日提前到 ${fmtDate(next.expiryDate)}`;
  else msg = `${it.name} 已标记开封，到期日不变`;
  toast(msg, async () => {
    await saveItem(it);
    await refreshAfterChange();
  });
}

// ---------------- 吃一部分 ----------------

const portionDialog = $('#portion-dialog');
const pAmount = $('#p-amount');

function portionItem() {
  return state.items.find((i) => i.id === state.actionId);
}
function itemQty(it) {
  return Number(it.qty) > 0 ? Number(it.qty) : 1;
}

function updatePortionLeft() {
  const it = portionItem();
  if (!it) return;
  const a = Number(pAmount.value);
  const left = Math.round((itemQty(it) - a) * 100) / 100;
  const el = $('#portion-left');
  if (!Number.isFinite(a) || a <= 0) el.textContent = '请填写吃了多少';
  else if (left <= 0) el.textContent = '全部吃完了，会记为「吃掉了」';
  else el.textContent = `吃完后还剩 ${fmtQty(left)}${it.unit || ''}`;
}

function openPortion(id) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  state.actionId = id;
  $('#portion-item').innerHTML = `<span aria-hidden="true">${esc(iconFor(it))}</span> <b>${esc(it.name)}</b><span class="muted"> · 现有 ${esc(fmtQty(itemQty(it)))}${esc(it.unit || '')}</span>`;
  pAmount.value = defaultPortion(it.qty);
  updatePortionLeft();
  openDialog(portionDialog);
}

async function submitPortion() {
  const it = portionItem();
  if (!it) return closeDialog(portionDialog);
  const a = Number(pAmount.value);
  if (!Number.isFinite(a) || a <= 0) {
    pAmount.focus();
    toast('请填写吃了多少');
    return;
  }
  const { item, finished, left } = consumePortion(it, a, today());
  closeDialog(portionDialog);
  if (finished) return markDone(it.id, 'eaten');
  await saveItem(item);
  await refreshAfterChange();
  toast(`${it.name} 吃了 ${fmtQty(a)}${it.unit || ''}，还剩 ${fmtQty(left)}${it.unit || ''}`, async () => {
    await saveItem(it);
    await refreshAfterChange();
  });
}

// ---------------- 更多操作（开封 / 编辑 / 删除） ----------------

const moreDialog = $('#more-dialog');

function openMore(id) {
  const it = state.items.find((i) => i.id === id);
  if (!it) return;
  state.actionId = id;
  const st = STORAGES[it.storage] || STORAGES.fridge;
  $('#more-title').textContent = `${iconFor(it)} ${it.name}`;
  $('#more-sub').textContent = `${st.emoji} ${st.label} · ${fmtDate(it.expiryDate)}到期${it.opened ? ` · ${fmtDate(it.openedDate) || ''}开封` : ''}`;
  const food = resolveFood(it.name);
  let label;
  let note;
  if (it.opened) {
    label = '🔒 取消已开封';
    note = isValidISODate(it.expiryBeforeOpen) ? `到期日恢复为 ${fmtDate(it.expiryBeforeOpen)}` : '到期日不变';
  } else {
    label = '🫙 标记为已开封';
    const oe = openedExpiryFor(it.name, it.storage, today());
    if (oe && earlierDate(oe, it.expiryDate) === oe && oe !== it.expiryDate) note = `${describeOpened(food)}，到期日会提前到 ${fmtDate(oe)}`;
    else if (oe) note = `${describeOpened(food)}，比现在的到期日晚，到期日不变`;
    else if (it.storage === 'freezer') note = '冷冻保存不影响到期日，只做标记';
    else note = '食材库没有它的开封保质期，只做标记';
  }
  $('[data-more="opened"]', moreDialog).innerHTML = `${label}<small>${esc(note)}</small>`;
  openDialog(moreDialog);
}

// ---------------- 添加/编辑表单 ----------------

const dialog = $('#item-dialog');
const form = $('#item-form');
const fName = $('#f-name');
const fQty = $('#f-qty');
const fUnit = $('#f-unit');
const fPurchase = $('#f-purchase');
const fExpiry = $('#f-expiry');
const fOpened = $('#f-opened');

const storageVal = () => form.querySelector('input[name="storage"]:checked').value;
const setStorage = (v) => {
  const r = form.querySelector(`input[name="storage"][value="${v}"]`);
  if (r) r.checked = true;
};

function setEmoji(e) {
  state.emoji = e;
  $('#emoji-btn').textContent = e || '📦';
}

function formOpenedDate() {
  const existing = state.items.find((i) => i.id === state.editingId);
  return existing?.opened && isValidISODate(existing.openedDate) ? existing.openedDate : today();
}

function updateExpiryHint() {
  const food = resolveFood(fName.value);
  const hint = $('#expiry-hint');
  const oh = $('#opened-hint');
  if (!food) {
    const q = fName.value.trim();
    hint.textContent = !q ? '' : searchFoods(q, 1).length ? '从建议列表中选择，可自动填写到期日期。' : '没找到这个食材的默认保质期，请手动选择到期日期。';
    oh.textContent = '';
    return;
  }
  const st = storageVal();
  const d = shelfDaysFor(food, st);
  const ref = describeShelfLife(food);
  if (d == null) hint.textContent = `参考：${ref}（${STORAGES[st].label}没有默认值，请手动选择）`;
  else hint.textContent = `参考：${ref}${state.expiryTouched ? '' : ' · 已按' + STORAGES[st].label + (fOpened.checked && food.opened && st !== 'freezer' ? '和开封日' : '') + '自动填写'}`;
  if (food.opened) oh.textContent = `${describeOpened(food)}${fOpened.checked && st !== 'freezer' ? '，到期日已相应提前' : ''}`;
  else oh.textContent = fOpened.checked ? '没有开封保质期数据，只做标记' : '';
}

function autoFillExpiry() {
  if (state.expiryTouched) return updateExpiryHint();
  const exp = suggestExpiry(fName.value, storageVal(), fPurchase.value);
  if (exp) {
    if (fOpened.checked) {
      state.formBeforeOpen = exp;
      fExpiry.value = earlierDate(exp, openedExpiryFor(fName.value, storageVal(), formOpenedDate()));
    } else fExpiry.value = exp;
  }
  updateExpiryHint();
}

function onOpenedToggle() {
  if (fOpened.checked) {
    const oe = openedExpiryFor(fName.value, storageVal(), formOpenedDate());
    if (oe) {
      state.formBeforeOpen = fExpiry.value || suggestExpiry(fName.value, storageVal(), fPurchase.value);
      fExpiry.value = earlierDate(state.formBeforeOpen, oe);
    }
  } else if (state.formBeforeOpen) {
    fExpiry.value = state.formBeforeOpen;
    state.formBeforeOpen = null;
  }
  updateExpiryHint();
}

function applyFood(food, { setStorageToo = true } = {}) {
  fName.value = food.name;
  setEmoji(food.emoji);
  state.category = food.category;
  if (setStorageToo) setStorage(food.defaultStorage);
  hideAc();
  autoFillExpiry();
}

let acIndex = -1;
function hideAc() {
  $('#ac-list').hidden = true;
  acIndex = -1;
}
function showAc() {
  const res = searchFoods(fName.value, 8);
  const ul = $('#ac-list');
  if (!res.length || (res.length === 1 && res[0].name === fName.value.trim())) return hideAc();
  ul.innerHTML = res
    .map(
      (f, i) =>
        `<li role="option" data-name="${esc(f.name)}" id="ac-${i}"><span>${f.emoji} ${esc(f.name)}</span><small>${esc(describeShelfLife(f))}</small></li>`,
    )
    .join('');
  ul.hidden = false;
  acIndex = -1;
}

function renderEmojiPicker() {
  const set = new Set(Object.values(CATEGORIES).map((c) => c.emoji));
  ['🍅', '🥕', '🥔', '🧅', '🌽', '🍆', '🥒', '🍄', '🍌', '🍇', '🍓', '🍊', '🥩', '🍖', '🦐', '🧀', '🍞', '🍰', '🥫', '🍶'].forEach((e) => set.add(e));
  $('#emoji-picker').innerHTML = [...set].map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join('');
}

function openForm(item = null) {
  form.reset();
  state.editingId = item ? item.id : null;
  state.expiryTouched = !!item;
  state.emojiAuto = !item;
  state.formBeforeOpen = item?.opened ? item.expiryBeforeOpen || null : null;
  $('#dialog-title').textContent = item ? '编辑食材' : '添加食材';
  $('#save-more').hidden = !!item;
  $('#batch-btn').hidden = !!item;
  $('#emoji-picker').hidden = true;
  hideAc();
  if (item) {
    fName.value = item.name;
    fQty.value = item.qty;
    fUnit.value = item.unit || '';
    setStorage(item.storage);
    fPurchase.value = item.purchaseDate;
    fExpiry.value = item.expiryDate;
    fOpened.checked = !!item.opened;
    setEmoji(iconFor(item));
    state.category = item.category || 'other';
  } else {
    fQty.value = 1;
    setStorage('fridge');
    fPurchase.value = today();
    fExpiry.value = '';
    fOpened.checked = false;
    setEmoji('');
    state.category = 'other';
  }
  updateExpiryHint();
  openDialog(dialog);
  if (!item) setTimeout(() => fName.focus(), 50);
}

function closeForm() {
  hideAc();
  closeDialog(dialog);
}

async function submitForm(keepOpen) {
  const name = fName.value.trim();
  if (!name) {
    fName.focus();
    toast('请填写食材名称');
    return;
  }
  if (!isValidISODate(fExpiry.value)) {
    autoFillExpiry();
    if (!isValidISODate(fExpiry.value)) {
      fExpiry.focus();
      toast('请选择到期日期');
      return;
    }
  }
  const food = resolveFood(name);
  const existing = state.items.find((i) => i.id === state.editingId);
  const qty = Number(fQty.value);
  const { opened: _o, openedDate: _od, expiryBeforeOpen: _eb, ...base } = existing || {};
  const item = {
    ...base,
    id: existing ? existing.id : newId(),
    name,
    emoji: state.emoji || food?.emoji || '',
    category: food?.category || state.category || 'other',
    qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
    unit: fUnit.value.trim(),
    storage: storageVal(),
    purchaseDate: isValidISODate(fPurchase.value) ? fPurchase.value : today(),
    expiryDate: fExpiry.value,
    status: existing?.status || 'active',
    doneAt: existing?.doneAt || null,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  if (fOpened.checked) {
    item.opened = true;
    item.openedDate = formOpenedDate();
    item.expiryBeforeOpen = isValidISODate(state.formBeforeOpen) ? state.formBeforeOpen : fExpiry.value;
  }
  await saveItem(item);
  await refreshAfterChange();
  if (keepOpen) {
    toast(`已添加 ${name}，继续下一个`);
    openForm();
  } else {
    closeForm();
    toast(existing ? `已更新 ${name}` : `已添加 ${name}`);
  }
}

// ---------------- 购物清单模式（批量添加） ----------------

const batchDialog = $('#batch-dialog');

function showBatchStep(step) {
  $('#batch-step-input').hidden = step !== 'input';
  $('#batch-step-confirm').hidden = step !== 'confirm';
  $('#batch-warn').textContent = '';
}

function openBatch({ text = '', drafts = null, shopIds = null } = {}) {
  state.batchShopIds = shopIds;
  $('#batch-text').value = text;
  if (drafts && drafts.length) {
    state.batch = drafts.map((d) => ({ ...d, touched: false }));
    renderBatchList();
    showBatchStep('confirm');
  } else {
    state.batch = [];
    showBatchStep('input');
  }
  openDialog(batchDialog);
  if (!drafts) setTimeout(() => $('#batch-text').focus(), 50);
}

function batchRowHTML(d, i) {
  const food = resolveFood(d.name);
  const missing = !isValidISODate(d.expiryDate);
  const hint = food
    ? `${describeShelfLife(food)}${missing ? ` · ${STORAGES[d.storage].label}没有默认值，请选择到期日` : ''}`
    : d.name.trim()
      ? '没找到默认保质期，请选择到期日'
      : '请填写名称';
  return `<li class="brow${missing ? ' invalid' : ''}" data-idx="${i}">
    <div class="brow-top">
      <span class="b-emoji" aria-hidden="true">${esc(d.emoji || (food ? food.emoji : '📦'))}</span>
      <input class="b-name" value="${esc(d.name)}" maxlength="40" aria-label="名称" />
      <input class="b-qty" type="number" min="0.1" step="any" inputmode="decimal" value="${esc(fmtQty(d.qty))}" aria-label="数量" />
      <input class="b-unit" value="${esc(d.unit)}" maxlength="10" placeholder="单位" aria-label="单位" />
      <button type="button" class="b-del" aria-label="移除 ${esc(d.name)}">✕</button>
    </div>
    <div class="brow-bot">
      <div class="seg mini" role="radiogroup" aria-label="存放位置">
        ${Object.entries(STORAGES)
          .map(([k, v]) => `<label><input type="radio" name="bs-${i}" value="${k}" ${d.storage === k ? 'checked' : ''}/><span>${v.label}</span></label>`)
          .join('')}
      </div>
      <input class="b-exp" type="date" value="${esc(d.expiryDate)}" aria-label="到期日期" />
    </div>
    <small class="b-hint">${esc(hint)}${missing ? '' : ` · 还剩 ${daysLeft(d.expiryDate, today())} 天`}</small>
  </li>`;
}

function renderBatchList() {
  $('#batch-list').innerHTML = state.batch.map(batchRowHTML).join('');
  $('#batch-save').textContent = `全部保存（${state.batch.length}）`;
}

function rerenderBatchRow(i) {
  const li = $(`#batch-list .brow[data-idx="${i}"]`);
  if (li) li.outerHTML = batchRowHTML(state.batch[i], i);
}

function parseBatch() {
  const drafts = draftsFromText($('#batch-text').value, today());
  if (!drafts.length) {
    $('#batch-text').focus();
    toast('没有识别到食材，用逗号隔开试试');
    return;
  }
  state.batch = drafts.map((d) => ({ ...d, touched: false }));
  renderBatchList();
  showBatchStep('confirm');
}

async function saveBatch() {
  const bad = state.batch.filter((d) => !d.name.trim() || !isValidISODate(d.expiryDate));
  if (bad.length) {
    renderBatchList();
    $('#batch-warn').textContent = `还有 ${bad.length} 样没有到期日期（或名称），请补上或移除。`;
    $('#batch-list .brow.invalid .b-exp, #batch-list .brow.invalid .b-name')?.focus();
    return;
  }
  const now = new Date().toISOString();
  const items = state.batch.map((d) => {
    const food = resolveFood(d.name);
    return {
      id: newId(),
      name: d.name.trim(),
      emoji: d.emoji || food?.emoji || '',
      category: food?.category || 'other',
      qty: Number(d.qty) > 0 ? Number(d.qty) : 1,
      unit: String(d.unit || '').trim(),
      storage: d.storage,
      purchaseDate: d.purchaseDate || today(),
      expiryDate: d.expiryDate,
      status: 'active',
      doneAt: null,
      createdAt: now,
    };
  });
  await store.putMany(items);
  state.items.push(...items);
  const prevShopping = state.shopping;
  if (state.batchShopIds) saveShopping(removeShopping(state.shopping, state.batchShopIds));
  state.batchShopIds = null;
  closeDialog(batchDialog);
  if (state.view !== 'fridge') setView('fridge');
  await refreshAfterChange();
  toast(`已添加 ${items.length} 样食材`, async () => {
    for (const it of items) await store.remove(it.id);
    const ids = new Set(items.map((i) => i.id));
    state.items = state.items.filter((i) => !ids.has(i.id));
    saveShopping(prevShopping);
    await refreshAfterChange();
  });
}

// ---------------- 主题 ----------------

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
  else delete root.dataset.theme;
}

function cycleTheme() {
  const order = ['auto', 'light', 'dark'];
  const cur = lsGet('theme', 'auto');
  const next = order[(order.indexOf(cur) + 1) % order.length];
  lsSet('theme', next);
  applyTheme(next);
  toast({ auto: '主题：跟随系统', light: '主题：浅色', dark: '主题：深色' }[next]);
  if (state.view === 'me') renderMe();
}

// ---------------- 备份 ----------------

function exportBackup() {
  const data = makeBackup(state.items, new Date(), state.shopping);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fridge-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`已导出 ${state.items.length} 条记录`);
}

async function importBackup(file) {
  try {
    const { items, skipped, shopping } = parseBackup(await file.text());
    await store.putMany(items);
    state.items = await store.getAll();
    if (shopping) {
      const map = new Map(state.shopping.map((s) => [s.id, s]));
      sanitizeShopping(shopping).forEach((s) => map.set(s.id, s));
      saveShopping([...map.values()]);
    }
    await refreshAfterChange();
    toast(`导入 ${items.length} 条${skipped ? `，跳过 ${skipped} 条无效记录` : ''}`);
  } catch (e) {
    toast(`导入失败：${e.message}`);
  }
}

// ---------------- 事件绑定 ----------------

function bindStepper(root, attr, input, getStep, min) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest(`[${attr}]`);
    if (!b) return;
    const step = getStep();
    const cur = Number(input.value) || 0;
    const v = Math.max(min(), Math.round((cur + Number(b.getAttribute(attr)) * step) * 100) / 100);
    input.value = v;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function bindEvents() {
  $('.tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) setView(b.dataset.view);
  });
  $('#fab').addEventListener('click', () => openForm());
  $('#theme-btn').addEventListener('click', cycleTheme);

  $('#banner').addEventListener('click', (e) => {
    if (e.target.closest('.banner-close')) {
      lsSet('banner-dismissed', today());
      $('#banner').hidden = true;
    }
  });

  $('#filter-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    state.filter = b.dataset.filter;
    renderFridge();
  });
  $('#search').addEventListener('input', (e) => {
    state.query = e.target.value;
    renderFridge();
  });

  $('#item-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.closest('.item').dataset.id;
    const act = b.dataset.act;
    if (act === 'eat') markDone(id, 'eaten');
    else if (act === 'throw') markDone(id, 'thrown');
    else if (act === 'portion') openPortion(id);
    else if (act === 'more') openMore(id);
  });

  // 所有底部弹窗：点遮罩或 ✕ 关闭
  for (const d of [dialog, batchDialog, portionDialog, moreDialog]) {
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) {
        if (d === dialog) closeForm();
        else closeDialog(d);
      }
    });
  }

  // 更多操作
  moreDialog.addEventListener('click', (e) => {
    const b = e.target.closest('[data-more]');
    if (!b) return;
    const id = state.actionId;
    closeDialog(moreDialog);
    if (b.dataset.more === 'opened') toggleOpened(id);
    else if (b.dataset.more === 'edit') openForm(state.items.find((i) => i.id === id));
    else if (b.dataset.more === 'delete') deleteItem(id);
  });

  // 吃一部分
  $('#portion-form').addEventListener('submit', (e) => {
    e.preventDefault();
    submitPortion();
  });
  pAmount.addEventListener('input', updatePortionLeft);
  bindStepper(
    $('#portion-form'),
    'data-pstep',
    pAmount,
    () => {
      const q = portionItem() ? itemQty(portionItem()) : 1;
      return q >= 2 ? 1 : q > 0.5 ? 0.5 : 0.1;
    },
    () => 0.1,
  );
  $('#portion-quick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-frac]');
    const it = portionItem();
    if (!b || !it) return;
    pAmount.value = Math.round(itemQty(it) * Number(b.dataset.frac) * 100) / 100;
    updatePortionLeft();
  });

  // 表单
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitForm(false);
  });
  $('#save-more').addEventListener('click', () => submitForm(true));
  $('#batch-btn').addEventListener('click', () => {
    const text = fName.value.trim();
    closeForm();
    openBatch({ text });
  });

  fName.addEventListener('input', () => {
    showAc();
    const food = resolveFood(fName.value);
    if (food) {
      if (!state.emoji || state.emojiAuto) {
        setEmoji(food.emoji);
        state.emojiAuto = true;
      }
      state.category = food.category;
    }
    autoFillExpiry();
  });
  fName.addEventListener('keydown', (e) => {
    const ul = $('#ac-list');
    const opts = $$('li', ul);
    if (ul.hidden || !opts.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      acIndex = (acIndex + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      opts.forEach((o, i) => o.classList.toggle('on', i === acIndex));
    } else if (e.key === 'Enter' && acIndex >= 0) {
      e.preventDefault();
      applyFood(resolveFood(opts[acIndex].dataset.name));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideAc();
    }
  });
  fName.addEventListener('blur', () => setTimeout(hideAc, 150));
  $('#ac-list').addEventListener('mousedown', (e) => e.preventDefault());
  $('#ac-list').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-name]');
    if (li) applyFood(resolveFood(li.dataset.name));
  });

  $('#emoji-btn').addEventListener('click', () => {
    const p = $('#emoji-picker');
    p.hidden = !p.hidden;
  });
  $('#emoji-picker').addEventListener('click', (e) => {
    const b = e.target.closest('[data-emoji]');
    if (!b) return;
    setEmoji(b.dataset.emoji);
    state.emojiAuto = false;
    $('#emoji-picker').hidden = true;
  });

  $('#f-storage').addEventListener('change', autoFillExpiry);
  fOpened.addEventListener('change', onOpenedToggle);
  fPurchase.addEventListener('change', autoFillExpiry);
  fExpiry.addEventListener('input', () => {
    state.expiryTouched = true;
    updateExpiryHint();
  });
  $('#quick-days').addEventListener('click', (e) => {
    const b = e.target.closest('[data-days]');
    if (!b) return;
    const base = isValidISODate(fPurchase.value) ? fPurchase.value : today();
    fExpiry.value = addDays(base, Number(b.dataset.days));
    state.expiryTouched = true;
    updateExpiryHint();
  });
  form.addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    const v = Math.max(1, Math.round((Number(fQty.value) || 0) + Number(b.dataset.step)));
    fQty.value = v;
  });

  // 购物清单模式
  $('#batch-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!$('#batch-step-input').hidden) parseBatch();
    else saveBatch();
  });
  $('#batch-text').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      parseBatch();
    }
  });
  $('#batch-examples').addEventListener('click', (e) => {
    const b = e.target.closest('[data-example]');
    if (b) $('#batch-text').value = b.dataset.example;
  });
  $('#batch-single').addEventListener('click', () => {
    closeDialog(batchDialog);
    openForm();
  });
  $('#batch-back').addEventListener('click', () => {
    if (!$('#batch-text').value.trim()) {
      $('#batch-text').value = state.batch.map((d) => `${d.name} ${fmtQty(d.qty)}${d.unit}`).join(', ');
    }
    showBatchStep('input');
  });
  const batchList = $('#batch-list');
  batchList.addEventListener('click', (e) => {
    const b = e.target.closest('.b-del');
    if (!b) return;
    state.batch.splice(Number(b.closest('.brow').dataset.idx), 1);
    if (!state.batch.length) return showBatchStep('input');
    renderBatchList();
  });
  batchList.addEventListener('input', (e) => {
    const li = e.target.closest('.brow');
    if (!li) return;
    const d = state.batch[Number(li.dataset.idx)];
    if (e.target.classList.contains('b-qty')) d.qty = Number(e.target.value) || 1;
    else if (e.target.classList.contains('b-unit')) d.unit = e.target.value;
    else if (e.target.classList.contains('b-exp')) {
      d.expiryDate = e.target.value;
      d.touched = true;
    }
  });
  batchList.addEventListener('change', (e) => {
    const li = e.target.closest('.brow');
    if (!li) return;
    const i = Number(li.dataset.idx);
    const d = state.batch[i];
    if (e.target.classList.contains('b-name')) {
      const fresh = draftFromEntry({ name: e.target.value.trim(), qty: d.qty, unit: d.unit }, today());
      Object.assign(d, { name: fresh.name, emoji: fresh.emoji, category: fresh.category, known: fresh.known });
      if (!d.touched) Object.assign(d, { storage: fresh.storage, expiryDate: fresh.expiryDate });
      rerenderBatchRow(i);
    } else if (e.target.type === 'radio') {
      d.storage = e.target.value;
      // 新位置没有默认值时清空，让用户自己选，避免沿用旧位置的日期
      if (!d.touched) d.expiryDate = suggestExpiry(d.name, d.storage, today()) || '';
      rerenderBatchRow(i);
    } else if (e.target.classList.contains('b-exp')) {
      rerenderBatchRow(i);
    }
  });

  // 今天吃什么
  $('#recipe-filters').addEventListener('click', (e) => {
    const b = e.target.closest('[data-kind]');
    if (!b) return;
    state.recipeKind = b.dataset.kind;
    renderRecipes();
  });
  $('#recipe-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-add-missing]');
    if (b) addMissingToShopping(b.closest('.recipe').dataset.recipe);
  });

  // 购物清单
  $('#shop-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#shop-input');
    const entries = parseBatchText(input.value);
    if (!entries.length) return input.focus();
    const { list, added, skipped } = addToShopping(state.shopping, entries);
    saveShopping(list);
    input.value = '';
    renderShopping();
    if (skipped.length) toast(`${skipped.join('、')} 已经在清单里了`);
    else if (added.length > 1) toast(`已加入 ${added.length} 样`);
  });
  $('#shop-list').addEventListener('click', (e) => {
    const li = e.target.closest('.shop-item');
    if (e.target.closest('.check') && li) {
      saveShopping(toggleShopping(state.shopping, li.dataset.sid));
      renderShopping();
    } else if (e.target.closest('.s-del') && li) {
      const prev = state.shopping;
      const it = prev.find((s) => s.id === li.dataset.sid);
      saveShopping(removeShopping(prev, li.dataset.sid));
      renderShopping();
      toast(`已从清单删除 ${it?.name || ''}`, () => {
        saveShopping(prev);
        renderShopping();
      });
    } else if (e.target.closest('#shop-clear')) {
      const prev = state.shopping;
      saveShopping(state.shopping.filter((s) => !s.done));
      renderShopping();
      toast('已清除已买到的项目', () => {
        saveShopping(prev);
        renderShopping();
      });
    } else if (e.target.closest('#shop-to-fridge')) {
      const done = state.shopping.filter((s) => s.done);
      openBatch({
        drafts: done.map((s) => draftFromEntry({ name: s.name, qty: s.qty, unit: s.unit }, today())),
        shopIds: done.map((s) => s.id),
      });
    }
  });

  // 统计设置页
  $('#me-content').addEventListener('click', async (e) => {
    const id = e.target.closest('button')?.id;
    if (id === 'export-btn') exportBackup();
    else if (id === 'import-btn') $('#import-file').click();
    else if (id === 'notif-btn') {
      const p = await Notification.requestPermission();
      renderMe();
      if (p === 'granted') {
        toast('通知已开启');
        notifyToday();
      }
    } else if (id === 'clear-history') {
      const done = state.items.filter((i) => i.status !== 'active');
      for (const i of done) await store.remove(i.id);
      state.items = state.items.filter((i) => i.status === 'active');
      render();
      toast('已清空处理记录（本月统计也会归零）');
    }
  });
  $('#me-content').addEventListener('change', (e) => {
    if (e.target.name === 'theme') {
      lsSet('theme', e.target.value);
      applyTheme(e.target.value);
    }
  });
  $('#import-file').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) importBackup(f);
    e.target.value = '';
  });

  // 跨过零点或从后台回来时刷新
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      render();
      renderBanner();
    }
  });
}

// ---------------- 启动 ----------------

async function init() {
  applyTheme(lsGet('theme', 'auto'));
  renderEmojiPicker();
  bindEvents();
  state.items = await store.getAll();
  state.shopping = loadShopping();
  setView('fridge');
  renderBanner();
  document.body.classList.add('ready');

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch {
      /* 离线缓存不可用时应用仍可正常使用 */
    }
  }
  notifyToday();
}

init();
