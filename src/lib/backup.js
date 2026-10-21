// JSON 备份的导出与导入校验。

import { isValidISODate } from './expiry.js';

export const BACKUP_APP = 'fridge-expiry-keeper';
export const BACKUP_VERSION = 1;
const STORAGE_KEYS = ['fridge', 'freezer', 'pantry'];
const STATUSES = ['active', 'eaten', 'thrown'];

export function makeBackup(items, now = new Date(), shopping = []) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    items,
    shopping,
  };
}

/** 清洗单个物品；不合法返回 null */
export function sanitizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim().slice(0, 40);
  if (!name || !isValidISODate(raw.expiryDate)) return null;
  const qty = Number(raw.qty);
  const opened = raw.opened
    ? {
        opened: true,
        openedDate: isValidISODate(raw.openedDate) ? raw.openedDate : null,
        expiryBeforeOpen: isValidISODate(raw.expiryBeforeOpen) ? raw.expiryBeforeOpen : null,
      }
    : {};
  return {
    id: String(raw.id || '').slice(0, 64) || newId(),
    name,
    emoji: typeof raw.emoji === 'string' ? raw.emoji.slice(0, 8) : '',
    category: typeof raw.category === 'string' ? raw.category.slice(0, 20) : 'other',
    qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
    unit: typeof raw.unit === 'string' ? raw.unit.slice(0, 10) : '',
    storage: STORAGE_KEYS.includes(raw.storage) ? raw.storage : 'fridge',
    purchaseDate: isValidISODate(raw.purchaseDate) ? raw.purchaseDate : raw.expiryDate,
    expiryDate: raw.expiryDate,
    status: STATUSES.includes(raw.status) ? raw.status : 'active',
    doneAt: isValidISODate(raw.doneAt) ? raw.doneAt : null,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    ...opened,
  };
}

/** 解析备份文本，返回 { items, skipped, shopping }；shopping 为 null 表示备份里没有购物清单；格式错误抛出中文异常 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的 JSON');
  }
  const list = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : null;
  if (!list) throw new Error('备份文件里没有找到物品列表');
  const items = [];
  let skipped = 0;
  for (const raw of list) {
    const it = sanitizeItem(raw);
    if (it) items.push(it);
    else skipped++;
  }
  const shopping = data && Array.isArray(data.shopping) ? data.shopping : null;
  return { items, skipped, shopping };
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
