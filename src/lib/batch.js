// 购物清单模式：把「牛奶 2, 鸡蛋 10个, 两盒豆腐」这样的一段文字拆成多条食材，并补上默认值。

import { findFood, resolveFood } from '../data/foods.js';
import { suggestExpiry } from './expiry.js';

const UNITS = [
  '公斤', '千克', '毫升', 'kg', 'ml', 'g', 'L',
  '个', '盒', '袋', '瓶', '斤', '两', '克', '份', '把', '根', '颗', '只', '条', '块', '包', '罐', '听', '箱', '板', '串', '棵', '头', '升', '片', '枚', '桶', '杯', '束', '捆', '提',
];
const UNIT_RE = UNITS.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
const CN_NUM = '零一二两三四五六七八九十半';
const NUM_RE = `\\d+(?:\\.\\d+)?|[${CN_NUM}]+?`;

const SEPARATORS = /[,，、;；\n\r]+/;
const QTY_ONLY = new RegExp(`^[x×*]?(${NUM_RE})(${UNIT_RE})?$`, 'i');
const SUFFIX = new RegExp(`^(.+?)[x×*]?(\\d+(?:\\.\\d+)?)(${UNIT_RE})?$`, 'i');
const SUFFIX_CN = new RegExp(`^(.+?)[x×*]?([${CN_NUM}]+)(${UNIT_RE})$`, 'i');
const PREFIX = new RegExp(`^(${NUM_RE})(${UNIT_RE})(.+)$`, 'i');
const UNIT_ONLY = new RegExp(`^(${UNIT_RE})$`, 'i');

/** 中文数字 → 数字：一、两、十二、二十、半；无法识别返回 NaN */
export function parseNumber(s) {
  const str = String(s).trim();
  if (/^\d+(\.\d+)?$/.test(str)) return Number(str);
  if (str === '半') return 0.5;
  const digits = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (/^[零一二两三四五六七八九]$/.test(str)) return digits[str];
  const m = str.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/);
  if (m) return (m[1] ? digits[m[1]] : 1) * 10 + (m[2] ? digits[m[2]] : 0);
  return NaN;
}

function makeEntry(name, num, unit) {
  const n = String(name || '').trim();
  if (!n) return null;
  const qty = num == null ? 1 : parseNumber(num);
  return { name: n.slice(0, 40), qty: Number.isFinite(qty) && qty > 0 ? qty : 1, unit: unit || '' };
}

/** 解析单个片段（不含逗号），可能包含多个以空格分隔的食材，如 "牛奶 2 鸡蛋 10" */
function parseSegment(seg) {
  const tokens = seg.trim().split(/\s+/).filter(Boolean);
  const out = [];
  for (const tok of tokens) {
    const q = tok.match(QTY_ONLY);
    if (q) {
      // 纯数量：归到前一个还没写数量的食材上
      const prev = out[out.length - 1];
      if (prev && !prev._hasQty) {
        const v = parseNumber(q[1]);
        if (Number.isFinite(v) && v > 0) prev.qty = v;
        if (q[2]) prev.unit = q[2];
        prev._hasQty = true;
      }
      continue;
    }
    const prev = out[out.length - 1];
    if (UNIT_ONLY.test(tok) && prev && prev._hasQty && !prev.unit) {
      // "牛奶 2 盒"：单位单独写
      prev.unit = tok;
      continue;
    }
    const known = findFood(tok); // 本身就是食材名（如「三文鱼」）时不拆
    let m;
    let e = null;
    if (!known && (m = tok.match(PREFIX))) e = makeEntry(m[3], m[1], m[2]);
    else if ((m = tok.match(SUFFIX))) e = makeEntry(m[1], m[2], m[3]);
    else if (!known && (m = tok.match(SUFFIX_CN))) e = makeEntry(m[1], m[2], m[3]);
    if (e) {
      e._hasQty = true;
    } else {
      e = makeEntry(tok);
      if (!e) continue;
    }
    out.push(e);
  }
  return out;
}

/**
 * 解析一段购物清单文字。
 * 支持逗号 / 顿号 / 分号 / 换行分隔，数量写在前后都行："牛奶 2, 鸡蛋10个, 两盒豆腐, 西红柿×3"
 * @returns {Array<{name, qty, unit}>}
 */
export function parseBatchText(text) {
  return String(text || '')
    .split(SEPARATORS)
    .flatMap(parseSegment)
    .map(({ name, qty, unit }) => ({ name, qty, unit }));
}

/**
 * 为解析出的食材补上默认值：图标、分类、默认存放位置和到期日。
 * 没找到默认保质期的，expiryDate 为空字符串，需要用户在确认列表里手动选。
 */
export function draftFromEntry(entry, today) {
  const food = resolveFood(entry.name);
  const storage = food ? food.defaultStorage : 'fridge';
  return {
    name: entry.name,
    qty: entry.qty || 1,
    unit: entry.unit || '',
    emoji: food ? food.emoji : '',
    category: food ? food.category : 'other',
    known: !!food,
    storage,
    purchaseDate: today,
    expiryDate: suggestExpiry(entry.name, storage, today) || '',
  };
}

/** 文字 → 待确认列表 */
export function draftsFromText(text, today) {
  return parseBatchText(text).map((e) => draftFromEntry(e, today));
}
