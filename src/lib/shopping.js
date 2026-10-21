// 购物清单：纯函数（列表进、列表出），存储由 main.js 负责。
// 每一项：{ id, name, qty, unit, from, done, createdAt }

import { newId } from './backup.js';
import { resolveFood } from '../data/foods.js';

const sameName = (a, b) => {
  const x = String(a).trim();
  const y = String(b).trim();
  if (x === y) return true;
  const fx = resolveFood(x);
  return !!fx && fx === resolveFood(y) && (fx.name === x || fx.name === y);
};

/**
 * 加入购物清单；未买到的同名项不重复添加（「番茄」和「西红柿」算同一样）。
 * @param entries 字符串或 {name, qty, unit}
 * @returns {{ list, added: string[], skipped: string[] }}
 */
export function addToShopping(list, entries, { from = '', now = new Date() } = {}) {
  const next = [...list];
  const added = [];
  const skipped = [];
  for (const raw of entries) {
    const e = typeof raw === 'string' ? { name: raw } : raw || {};
    const name = String(e.name || '').trim().slice(0, 40);
    if (!name) continue;
    if (next.some((s) => !s.done && sameName(s.name, name))) {
      skipped.push(name);
      continue;
    }
    const qty = Number(e.qty);
    next.push({
      id: newId(),
      name,
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      unit: String(e.unit || '').slice(0, 10),
      from: String(from || '').slice(0, 40),
      done: false,
      createdAt: now.toISOString(),
    });
    added.push(name);
  }
  return { list: next, added, skipped };
}

export function toggleShopping(list, id) {
  return list.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
}

export function removeShopping(list, ids) {
  const set = new Set(Array.isArray(ids) ? ids : [ids]);
  return list.filter((s) => !set.has(s.id));
}

/** 未买的在前（按添加顺序），已买到的在后 */
export function sortShopping(list) {
  return [...list.filter((s) => !s.done), ...list.filter((s) => s.done)];
}

export function pendingCount(list) {
  return list.filter((s) => !s.done).length;
}

/** 清洗（导入备份 / 读本地存储时用）；不合法的项丢弃 */
export function sanitizeShopping(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue;
    const name = String(s.name || '').trim().slice(0, 40);
    if (!name) continue;
    const qty = Number(s.qty);
    out.push({
      id: String(s.id || '').slice(0, 64) || newId(),
      name,
      qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
      unit: typeof s.unit === 'string' ? s.unit.slice(0, 10) : '',
      from: typeof s.from === 'string' ? s.from.slice(0, 40) : '',
      done: !!s.done,
      createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString(),
    });
  }
  return out;
}
