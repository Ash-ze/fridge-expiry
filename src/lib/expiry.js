// 到期日与紧急程度相关的纯函数（无 DOM 依赖，便于测试）。
// 日期统一使用本地日期字符串 "YYYY-MM-DD"。

import { resolveFood } from '../data/foods.js';

const DAY_MS = 86400000;

export const URGENCY = {
  expired: { key: 'expired', label: '已过期', rank: 0 },
  today: { key: 'today', label: '今天到期', rank: 1 },
  soon: { key: 'soon', label: '3天内', rank: 2 },
  normal: { key: 'normal', label: '正常', rank: 3 },
};
export const URGENCY_ORDER = ['expired', 'today', 'soon', 'normal'];
export const SOON_DAYS = 3;

const pad = (n) => String(n).padStart(2, '0');

/** Date → "YYYY-MM-DD"（本地时区） */
export function toISODate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toUTCDay(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** 两个日期相差的天数（b - a），不受夏令时影响 */
export function diffDays(a, b) {
  return Math.round(toUTCDay(b) - toUTCDay(a));
}

/** 日期加天数 */
export function addDays(iso, days) {
  const t = (toUTCDay(iso) + days) * DAY_MS;
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 距离到期还剩几天：0 = 今天到期，负数 = 已过期 */
export function daysLeft(expiryDate, today = toISODate()) {
  return diffDays(today, expiryDate);
}

export function urgencyOf(days) {
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  if (days <= SOON_DAYS) return 'soon';
  return 'normal';
}

/** 给用户看的剩余时间文字 */
export function remainingText(days) {
  if (days < 0) return `已过期 ${-days} 天`;
  if (days === 0) return '今天到期';
  if (days === 1) return '明天到期';
  return `还剩 ${days} 天`;
}

/** 默认保质期天数（区间取较短一端）；没有该存放方式时返回 null */
export function defaultShelfDays(food, storage) {
  if (!food) return null;
  const d = food.days[storage];
  return d ? d.min : null;
}

// 冷冻没有专门数据时，只有这些分类按「冷藏 × 10」推算；蛋、果蔬、饮料、调料不适合冷冻，不给默认值。
const FREEZE_FALLBACK = new Set(['dairy', 'meat', 'poultry', 'seafood', 'tofu', 'staple', 'frozen', 'deli', 'mushroom']);

/** 某食材在某存放位置的默认天数（含推算规则）；没有合适的默认值返回 null */
export function shelfDaysFor(food, storage) {
  if (!food) return null;
  let days = defaultShelfDays(food, storage);
  if (days != null) return days;
  // 冷冻：可冻的分类按冷藏×10（上限180天）
  if (storage === 'freezer' && food.days.fridge && FREEZE_FALLBACK.has(food.category)) {
    return Math.min(food.days.fridge.min * 10, 180);
  }
  // 冷藏：未开封时放冰箱不会比常温坏得更快，沿用常温天数
  if (storage === 'fridge' && food.days.pantry) return food.days.pantry.min;
  return null;
}

/**
 * 根据名称、存放位置和购买日期推算默认到期日（未开封）。
 * 没有合适的默认值时返回 null，需要用户手动选择。
 */
export function suggestExpiry(name, storage, purchaseDate) {
  const food = resolveFood(name);
  if (!food || !isValidISODate(purchaseDate)) return null;
  const days = shelfDaysFor(food, storage);
  if (days == null) return null;
  return addDays(purchaseDate, days);
}

/** 两个日期取较早的一个（忽略无效值） */
export function earlierDate(a, b) {
  const va = isValidISODate(a);
  const vb = isValidISODate(b);
  if (va && vb) return a <= b ? a : b;
  return va ? a : vb ? b : null;
}

/**
 * 开封后的到期日：开封日期 + 开封保质期（取较短一端）。
 * 冷冻保存、或食材库没有开封数据时返回 null。
 */
export function openedExpiryFor(name, storage, openedDate) {
  if (storage === 'freezer' || !isValidISODate(openedDate)) return null;
  const food = resolveFood(name);
  if (!food || !food.opened) return null;
  return addDays(openedDate, food.opened.min);
}

/** 标记为已开封：到期日提前到「开封日 + 开封天数」（只会提前，不会延后），并记住原到期日以便撤销 */
export function markOpened(item, openedDate = toISODate()) {
  if (item.opened) return item;
  const openedExp = openedExpiryFor(item.name, item.storage, openedDate);
  return {
    ...item,
    opened: true,
    openedDate,
    expiryBeforeOpen: item.expiryDate,
    expiryDate: earlierDate(item.expiryDate, openedExp) || item.expiryDate,
  };
}

/** 取消已开封：恢复原到期日 */
export function unmarkOpened(item) {
  if (!item.opened) return item;
  const { opened, openedDate, expiryBeforeOpen, ...rest } = item;
  return { ...rest, expiryDate: isValidISODate(expiryBeforeOpen) ? expiryBeforeOpen : item.expiryDate };
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * 吃掉一部分：数量减少 amount。
 * 返回 { item, finished }；吃完（剩余 ≤ 0）时 finished = true，item 记为吃掉了。
 */
export function consumePortion(item, amount, today = toISODate()) {
  const qty = Number(item.qty) > 0 ? Number(item.qty) : 1;
  const a = Number(amount);
  if (!Number.isFinite(a) || a <= 0) throw new Error('数量要大于 0');
  const left = round2(qty - a);
  if (left <= 0) return { item: { ...item, status: 'eaten', doneAt: today }, finished: true, left: 0 };
  return { item: { ...item, qty: left }, finished: false, left };
}

/** 「吃一部分」默认数量：大于 1 时默认 1，否则默认一半 */
export function defaultPortion(qty) {
  const q = Number(qty) > 0 ? Number(qty) : 1;
  return q > 1 ? 1 : round2(q / 2);
}

/** 只保留在库（未吃完/未扔掉）的物品 */
export function activeItems(items) {
  return items.filter((it) => !it.status || it.status === 'active');
}

/** 按紧急程度排序：到期日早的在前，同一天按名称 */
export function sortByUrgency(items, today = toISODate()) {
  return [...items].sort((a, b) => {
    const da = daysLeft(a.expiryDate, today);
    const db = daysLeft(b.expiryDate, today);
    if (da !== db) return da - db;
    return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN');
  });
}

/** 分组：{ expired: [], today: [], soon: [], normal: [] }，组内已排序 */
export function groupByUrgency(items, today = toISODate()) {
  const groups = { expired: [], today: [], soon: [], normal: [] };
  for (const it of sortByUrgency(items, today)) {
    groups[urgencyOf(daysLeft(it.expiryDate, today))].push(it);
  }
  return groups;
}

/** 汇总：各紧急程度的数量 */
export function summarize(items, today = toISODate()) {
  const g = groupByUrgency(activeItems(items), today);
  return {
    expired: g.expired.length,
    today: g.today.length,
    soon: g.soon.length,
    normal: g.normal.length,
    total: g.expired.length + g.today.length + g.soon.length + g.normal.length,
  };
}

/** 启动横幅文案；没有需要关注的物品时返回 null */
export function bannerText(sum) {
  const parts = [];
  if (sum.expired) parts.push(`${sum.expired} 件已过期`);
  if (sum.today) parts.push(`${sum.today} 件今天到期`);
  if (sum.soon) parts.push(`${sum.soon} 件 3 天内到期`);
  if (!parts.length) return null;
  return `冰箱提醒：${parts.join('，')}`;
}

/** 本月（按 doneAt 所在月份）吃掉 vs 扔掉的统计 */
export function monthlyStats(items, today = toISODate()) {
  const month = today.slice(0, 7);
  let eaten = 0;
  let thrown = 0;
  for (const it of items) {
    if (!it.doneAt || String(it.doneAt).slice(0, 7) !== month) continue;
    if (it.status === 'eaten') eaten++;
    else if (it.status === 'thrown') thrown++;
  }
  const total = eaten + thrown;
  return { month, eaten, thrown, total, wasteRate: total ? thrown / total : 0 };
}
